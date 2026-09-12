// app/api/chat/route.ts — the support assistant's endpoint.
//
// POST { conversation_id, message, history?, context?, page?, contact? } → a server-sent-event stream:
//   event: status  data: {"state":"thinking" | "forwarding" | "connecting"}
//   event: answer  data: { text, sources, ref, escalate?, handoff?, intent, rung, language, suggestions,
//                          contact_required, contact_prefill?; and, forwarded to the team: delivery, note? }
//   event: done    data: {}
//
// Why events and not token streaming: the number gate in lib/assistant/answer.ts needs the
// whole model output before anything is shown. Streaming tokens and then discovering a bad
// price at the end would already have shown it. So the stream carries status and then ONE
// validated answer; the widget shows a typing indicator in between. Free models are fast for
// three sentences, and correctness is the product here.
//
// This route works with no external configuration at all — it then serves the retrieved
// answer (rung 3). ASSISTANT_* turns on model phrasing; the Supabase variables turn on the
// support record. Neither is needed for a correct answer.
//
// Contact before the handoff (owner decision, 2026-09-12): the team gets a conversation only
// with a way to reach the customer back. When the assistant decides to hand off it asks for a
// name and mobile number and answers with contact_required; the widget shows a card. The card's
// fields arrive in `contact` and mean one thing whatever the record holds — "hand me over with
// these" — and never reach a model: a model phrasing a contact line once promised a call-back
// nobody would make (seen locally, 2026-09-12). A number typed into the message while the ask
// is open counts too. The handoff is opened before the customer is told so. A safety escalation
// alerts the team at once and asks alongside. A signed-in customer is offered the number on
// their profile to confirm.
//
// Same posture as app/api/lead/route.ts: nodejs runtime, force-dynamic, the service-role key
// server-side only, raw fetch to PostgREST, no client SDK.

import { NextResponse, after } from 'next/server';
import { answer, type Turn, type Answer } from '@/lib/assistant/answer';
import { providerFromEnv } from '@/lib/assistant/provider';
import { COPY } from '@/lib/assistant/copy';
import { suggestionsFor } from '@/lib/assistant/suggestions';
import { refFor } from '@/lib/assistant/ref';
import { corsHeaders } from '@/lib/assistant/cors';
import { recordClientFromEnv, upsertConversation, insertMessages, patchConversation, getConversation, profileContact, type RecordClient, type ConversationRow } from '@/lib/support/record';
import { chatwootFromEnv } from '@/lib/support/chatwoot';
import { handedOffFrom, awaitingHandoffFrom, awaitingContactFrom, holdMessage, forwardMessage, forwardReply, startHandoff, captureContact, noteContact } from '@/lib/support/handoff';
import { normalisePhone, formatPhone, cleanName, parseContactMessage, contactLine, type ContactDetails } from '@/lib/support/contact';
import { SUPPORT_HOURS, isWithinSupportHours } from '@/data/seo/contact';
import { CITY_BY_SLUG, LOCALITY_BY_PATH, SERVICE_BY_SLUG, PLAN_BY_KEY } from '@/data/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ─── Limits ─────────────────────────────────────────────────────────────────────────────────
// In-memory, per server instance. Vercel runs several instances, so these are soft; the hard
// limits are the per-conversation turn cap (which the client cannot inflate past the history
// it sends) and, for spend, OpenRouter's own daily cap, which returns 429 and drops us to rung
// 3. These exist to stop one client from monopolising an instance, not to be an audit control.

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY_TURNS = 12;
const MAX_TURNS_PER_CONVERSATION = 40;
const PER_IP_PER_MINUTE = 20;
const DAILY_MODEL_CALLS = Number(process.env.ASSISTANT_DAILY_MODEL_CALLS ?? 800);

const ipHits = new Map<string, number[]>();
let modelCallsToday = { day: '', count: 0 };

function rateLimited(ip: string, now: number): boolean {
  const cutoff = now - 60_000;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  ipHits.set(ip, hits);
  if (ipHits.size > 5000) ipHits.clear(); // crude memory bound
  return hits.length > PER_IP_PER_MINUTE;
}

function underDailyCeiling(now: Date): boolean {
  const day = now.toISOString().slice(0, 10);
  if (modelCallsToday.day !== day) modelCallsToday = { day, count: 0 };
  return modelCallsToday.count < DAILY_MODEL_CALLS;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req, 'POST, OPTIONS') });
}

// ─── Input ──────────────────────────────────────────────────────────────────────────────────

interface Body {
  conversation_id?: string;
  message?: string;
  history?: Array<{ role?: string; content?: string }>;
  page?: string;
  context?: { city?: string; locality?: string; service?: string; plan?: string; device?: string };
  /** The contact card's fields, when the message is the card being sent. */
  contact?: { name?: unknown; phone?: unknown };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitiseHistory(raw: Body['history']): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is { role: 'user' | 'assistant'; content: string } => !!t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY_TURNS);
}

/** Page context is attacker-controllable input; only slugs that exist in the data layer are kept. */
function sanitiseContext(c: Body['context']) {
  if (!c || typeof c !== 'object') return {};
  const city = typeof c.city === 'string' && CITY_BY_SLUG.has(c.city as never) ? c.city : undefined;
  const locality = city && typeof c.locality === 'string' && LOCALITY_BY_PATH.has(`${city}/${c.locality}`) ? c.locality : undefined;
  const service = typeof c.service === 'string' && SERVICE_BY_SLUG.has(c.service as never) ? c.service : undefined;
  const plan = typeof c.plan === 'string' && PLAN_BY_KEY.has(c.plan as never) ? c.plan : undefined;
  const device = typeof c.device === 'string' && /^(mobile|tablet|desktop|app_android|app_ios)$/.test(c.device) ? c.device : undefined;
  return { city, locality, service, plan, device };
}

/**
 * What this message carries as contact details: the card's fields, validated here whatever the
 * client did, or a number typed into the message itself. `line` is the transcript's wording for
 * the card's details; a typed message is its own line.
 */
interface GivenContact {
  contact: ContactDetails | null;
  line: string | null;
  /** The card sent something that is not an Indian mobile. */
  invalid: boolean;
  /** The message reads as an attempt at a number, valid or not. */
  attempted: boolean;
}

function contactFrom(raw: Body['contact'], message: string): GivenContact {
  if (raw && typeof raw === 'object') {
    const phone = normalisePhone(typeof raw.phone === 'string' ? raw.phone : null);
    if (!phone) return { contact: null, line: null, invalid: true, attempted: true };
    const contact: ContactDetails = { name: cleanName(typeof raw.name === 'string' ? raw.name : null), phone };
    return { contact, line: contactLine(COPY.contactLineLabels, contact.name, formatPhone(phone)), invalid: false, attempted: true };
  }
  const parsed = parseContactMessage(message);
  if (parsed.phone) return { contact: { name: parsed.name, phone: parsed.phone }, line: null, invalid: false, attempted: true };
  return { contact: null, line: null, invalid: false, attempted: parsed.attempted };
}

// ─── Signed-in customers ────────────────────────────────────────────────────────────────────
// Optional. The booking app sends the Supabase session token; we verify it the way the edge
// functions do — by asking Supabase Auth, never by trusting a user id in the body.

async function userIdFromToken(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!auth?.startsWith('Bearer ') || !url || !key) return null;
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: auth },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return typeof user.id === 'string' ? user.id : null;
  } catch {
    return null;
  }
}

/** The name and number on a signed-in customer's profile, offered back on the card to confirm. */
async function prefillFor(record: RecordClient | null, userId: string | null): Promise<{ name: string | null; phone: string | null } | null> {
  if (!record || !userId) return null;
  const p = await profileContact(record, userId);
  if (!p) return null;
  const phone = p.phone ? normalisePhone(p.phone) : null;
  const name = cleanName(p.name);
  if (!phone && !name) return null;
  return { name, phone: phone ? formatPhone(phone) : null };
}

// ─── The support record (Initiative 4) ──────────────────────────────────────────────────────
// Written after the response is sent, so a slow database never slows the customer. Failures
// are logged inside lib/support/record.ts; they do not affect the answer. Requires the
// migrations in supabase/migrations/20260911*.sql to have been applied.

interface RecordInput {
  conversationId: string;
  ref: string;
  channel: 'site_chat' | 'app_chat';
  userId: string | null;
  page?: string;
  context: ReturnType<typeof sanitiseContext>;
  userMessage: string;
  a: Answer;
  now: Date;
  turnIndex: number;
}

/** The conversation row for this turn. Escalation fields are set when the turn escalates and never cleared by a later turn: an escalation waiting for the customer's number (awaitingContactFrom) must survive whatever is asked meanwhile. */
async function persistConversation(client: RecordClient, r: RecordInput): Promise<boolean> {
  const escalating = !!(r.a.handoff || r.a.contactRequired);
  return upsertConversation(client, {
    id: r.conversationId,
    ref: r.ref,
    channel: r.channel,
    anon_id: r.userId ? null : r.conversationId,
    user_id: r.userId,
    started_from: r.page?.slice(0, 300) ?? null,
    city_slug: r.a.entities.city ?? r.context.city ?? null,
    locality_slug: r.a.entities.locality?.slug ?? r.context.locality ?? null,
    service_slug: r.a.entities.service ?? r.context.service ?? null,
    plan_key: r.a.entities.plan ?? r.context.plan ?? null,
    topic: r.a.intent,
    ...(escalating ? { escalated: true, escalated_at: r.now.toISOString(), escalation_reason: r.a.escalate ?? null } : {}),
    device: r.context.device ?? null,
    language: r.a.language,
    last_message_at: r.now.toISOString(),
  });
}

async function persist(r: RecordInput): Promise<void> {
  const client = recordClientFromEnv();
  if (!client) return;
  if (!(await persistConversation(client, r))) return;

  await insertMessages(client, [
    { conversation_id: r.conversationId, sender: 'customer', body: r.userMessage, turn_index: r.turnIndex, created_at: r.now.toISOString() },
    {
      conversation_id: r.conversationId,
      sender: 'assistant',
      body: r.a.text,
      turn_index: r.turnIndex + 1,
      grounded_sources: r.a.sources,
      model_id: r.a.modelId,
      rung: r.a.rung,
      gate_rejected: r.a.gateRejected,
      redacted: r.a.redacted,
      created_at: new Date(r.now.getTime() + 1).toISOString(),
    },
  ]);
}

// ─── Handler ────────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const cors = corsHeaders(req, 'POST, OPTIONS');
  const now = new Date();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  if (rateLimited(ip, now.getTime())) {
    return NextResponse.json({ error: COPY.rateLimited }, { status: 429, headers: cors });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: cors });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400, headers: cors });
  if (message.length > MAX_MESSAGE_CHARS) return NextResponse.json({ error: COPY.tooLong }, { status: 413, headers: cors });

  const conversationId = typeof body.conversation_id === 'string' && UUID.test(body.conversation_id) ? body.conversation_id.toLowerCase() : crypto.randomUUID();
  const history = sanitiseHistory(body.history);
  const context = sanitiseContext(body.context);
  const page = typeof body.page === 'string' ? body.page : undefined;

  const turnIndex = history.length;
  if (turnIndex >= MAX_TURNS_PER_CONVERSATION * 2) {
    return NextResponse.json({ error: COPY.escalateTurnLimit }, { status: 429, headers: cors });
  }

  const userId = await userIdFromToken(req);
  const provider = underDailyCeiling(now) ? providerFromEnv() : null;
  const record = recordClientFromEnv();
  const chatwoot = chatwootFromEnv();
  const ref = refFor(conversationId);
  const channel: 'site_chat' | 'app_chat' = userId ? 'app_chat' : 'site_chat';
  const inHours = isWithinSupportHours(now);
  const given = contactFrom(body.contact, message);
  const fromCard = !!body.contact;

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  const sse = (start: (controller: ReadableStreamDefaultController) => Promise<void>) =>
    new Response(new ReadableStream({ start }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    });
  /** One fixed answer, no model: the fields every answer carries, overridden by what this one says. */
  const reply = (event: Record<string, unknown>, work?: () => Promise<void>) =>
    sse(async (controller) => {
      send(controller, 'status', { state: 'thinking' });
      send(controller, 'answer', {
        conversation_id: conversationId,
        ref,
        mode: 'assistant',
        sources: [],
        language: null,
        rung: 3,
        handoff: null,
        talk_to_team: COPY.talkToTeam,
        contact_required: false,
        contact_prefill: null,
        suggestions: [],
        ...event,
      });
      send(controller, 'done', {});
      controller.close();
      if (work) {
        after(async () => {
          try {
            await work();
          } catch (e) {
            console.error('[chat] after() threw', e);
          }
        });
      }
    });

  // Where this conversation stands: with the team, about to be, waiting for the customer's
  // number, or the assistant's.
  const lookup = record ? await getConversation(record, conversationId) : null;
  const row = lookup?.ok ? lookup.row : null;
  const handoff = row ? handedOffFrom(row) : null;
  const opening = !handoff && !!row && awaitingHandoffFrom(row, now);
  const awaitingContact = !handoff && !opening && !!row && awaitingContactFrom(row, now);

  // ── The card sent a number that is not one. Nothing is recorded; the card comes back. ──
  if (fromCard && given.invalid) {
    return reply({ text: COPY.invalidPhone, intent: 'human', escalate: row?.escalation_reason ?? 'asked_for_human', contact_required: true, contact_prefill: await prefillFor(record, userId) });
  }

  // ── With the team, or about to be. The conversation is the person's now: the message goes
  // to them and the assistant says nothing — no answer alongside, no model call — until the
  // team closes the conversation (owner decision, 2026-09-12). The widget shows a delivery
  // line under the customer's bubble instead, and outside support hours a note on when the
  // team is back. Contact details given now — after a safety handoff, which asks alongside,
  // or a corrected number — go on the record and the Chatwoot contact's name. While the
  // Chatwoot conversation is still being opened the message is held on the record and
  // startHandoff posts it the moment the conversation exists. ──
  if (record && row && (handoff || opening)) {
    const line = given.line ?? message;
    const delivered = handoff ? await forwardMessage(record, chatwoot, handoff, line, now) : await holdMessage(record, conversationId, line, now, given.contact);
    if (handoff && given.contact) await noteContact(record, chatwoot, handoff, given.contact);
    const contactRequired = !row.contact_phone && !given.contact;
    return sse(async (controller) => {
      send(controller, 'status', { state: 'forwarding' });
      send(controller, 'answer', {
        conversation_id: conversationId,
        ref,
        mode: 'forwarded',
        delivered,
        text: '',
        delivery: delivered ? COPY.sentToTeam : COPY.notSentToTeam,
        note: inHours ? null : COPY.teamBack(SUPPORT_HOURS.label, SUPPORT_HOURS.replyWithinHours),
        sources: [],
        intent: 'handed_off',
        language: null,
        rung: null,
        escalate: null,
        handoff: { inHours, text: '' },
        talk_to_team: COPY.talkToTeam,
        contact_required: contactRequired,
        contact_prefill: contactRequired ? await prefillFor(record, userId) : null,
        suggestions: [],
      });
      send(controller, 'done', {});
      controller.close();
    });
  }

  // The details are in: the handoff, now, and only then the word that it happened. Writes the
  // customer's line and the assistant's reply to the record afterwards.
  const captureInto = async (controller: ReadableStreamDefaultController, rec: RecordClient, target: ConversationRow, contact: ContactDetails, line: string) => {
    send(controller, 'status', { state: 'connecting' });
    const result = await captureContact(
      rec,
      chatwoot,
      target,
      {
        conversationId,
        ref,
        contact,
        line,
        page: page ?? null,
        city: context.city ?? target.city_slug ?? null,
        locality: context.locality ?? target.locality_slug ?? null,
        service: context.service ?? target.service_slug ?? null,
        plan: context.plan ?? target.plan_key ?? null,
        signedIn: !!userId,
      },
      now,
    );
    const chatwootId = result.status === 'saved' ? null : result.chatwootConversationId;
    if (result.status === 'saved') console.error(`[chat] handoff for ${ref}: details saved, Chatwoot not opened (${result.reason})`);
    const phone = formatPhone(contact.phone);
    const text =
      chatwootId === null
        ? COPY.contactSaved(contact.name, phone)
        : inHours
          ? COPY.contactThanksInHours(contact.name)
          : COPY.contactThanksOutOfHours(contact.name, phone, SUPPORT_HOURS.label, SUPPORT_HOURS.replyWithinHours);
    send(controller, 'answer', {
      conversation_id: conversationId,
      ref,
      mode: 'assistant',
      text,
      sources: [],
      intent: 'human',
      language: null,
      rung: 3,
      escalate: target.escalation_reason ?? 'asked_for_human',
      handoff: chatwootId === null ? null : { inHours, text },
      talk_to_team: COPY.talkToTeam,
      contact_required: false,
      contact_prefill: null,
      suggestions: [],
    });
    send(controller, 'done', {});
    controller.close();
    after(async () => {
      try {
        if (chatwootId !== null) {
          const h = { row: { ...target, contact_name: contact.name ?? target.contact_name ?? null, contact_phone: contact.phone, chatwoot_conversation_id: chatwootId }, chatwootConversationId: chatwootId };
          await forwardReply(rec, chatwoot, h, { text, rung: 3, modelId: null }, now);
        } else {
          await insertMessages(rec, [{ conversation_id: conversationId, sender: 'assistant', body: text, rung: 3, created_at: new Date(now.getTime() + 1).toISOString() }]);
        }
      } catch (e) {
        console.error('[chat] after() threw (contact)', e);
      }
    });
  };

  // ── The card was sent: the customer's details, for the team, never for a model. Whatever the
  // record holds this means "hand me over with these": a row that is waiting goes straight on;
  // a stale ask, or a card kept from an earlier visit, renews the escalation; a conversation the
  // record never saw gets its row now. Only with no record at all is there nothing to do but
  // say so and point at WhatsApp and the phone. ──
  if (fromCard && given.contact) {
    const unsaved = () => reply({ text: COPY.contactNotSaved, intent: 'human', escalate: 'asked_for_human' });
    if (!record || !lookup?.ok) return unsaved();
    let target = row;
    if (!target) {
      await upsertConversation(record, {
        id: conversationId,
        ref,
        channel,
        anon_id: userId ? null : conversationId,
        user_id: userId,
        started_from: page?.slice(0, 300) ?? null,
        topic: 'human',
        escalated: true,
        escalated_at: now.toISOString(),
        escalation_reason: 'asked_for_human',
        device: context.device ?? null,
        last_message_at: now.toISOString(),
      });
      const again = await getConversation(record, conversationId);
      target = again.ok ? again.row : null;
      if (!target) return unsaved();
    } else if (!awaitingContact) {
      const renewed = { escalated: true, escalated_at: now.toISOString(), escalation_reason: target.escalation_reason ?? 'asked_for_human' };
      await patchConversation(record, conversationId, renewed);
      target = { ...target, ...renewed };
    }
    const rec = record;
    const t = target;
    return sse((controller) => captureInto(controller, rec, t, given.contact!, given.line ?? message));
  }

  // ── Waiting for the customer's name and number, and they typed them — or tried to. A
  // number in the message completes the handoff; a try that is not a number is answered with
  // what one looks like. Anything else is a question like any other, answered below with the
  // card kept up. ──
  if (record && row && awaitingContact) {
    if (given.contact) {
      const rec = record;
      return sse((controller) => captureInto(controller, rec, row, given.contact!, message));
    }
    if (given.attempted) {
      const rec = record;
      return reply({ text: COPY.invalidPhone, intent: 'human', escalate: row.escalation_reason ?? 'asked_for_human', contact_required: true, contact_prefill: await prefillFor(record, userId) }, async () => {
        await insertMessages(rec, [
          { conversation_id: conversationId, sender: 'customer', body: message, turn_index: turnIndex, created_at: now.toISOString() },
          { conversation_id: conversationId, sender: 'assistant', body: COPY.invalidPhone, turn_index: turnIndex + 1, rung: 3, created_at: new Date(now.getTime() + 1).toISOString() },
        ]);
        await patchConversation(rec, conversationId, { last_message_at: now.toISOString() });
      });
    }
  }

  // ── The assistant's. A number already on the record means a fresh escalation need not ask
  // again; an ask still unanswered keeps the card up under whatever is answered now. ──
  const contactKnown = !!row?.contact_phone;
  return sse(async (controller) => {
    send(controller, 'status', { state: 'thinking' });
    try {
      const a = await answer({ message, history, signedIn: !!userId, now, contactKnown }, { provider });
      modelCallsToday.count += a.modelCalls;
      const contactRequired = !!a.contactRequired || awaitingContact;
      const recordInput: RecordInput = { conversationId, ref, channel, userId, page, context, userMessage: message, a, now, turnIndex };

      // "call me on 98765 43210": the details came with the ask. The row is written now, since
      // the capture needs it, and the ask itself is never shown.
      if (record && lookup?.ok && given.contact && a.contactRequired && !a.handoff) {
        const rec = record;
        if (await persistConversation(rec, recordInput)) {
          const fresh = await getConversation(rec, conversationId);
          if (fresh.ok && fresh.row) {
            await captureInto(controller, rec, fresh.row, given.contact, message);
            return;
          }
        }
      }

      send(controller, 'answer', {
        conversation_id: conversationId,
        ref,
        mode: 'assistant',
        text: a.text,
        sources: a.sources,
        intent: a.intent,
        language: a.language,
        rung: a.rung,
        escalate: a.escalate ?? null,
        handoff: a.handoff ?? null,
        talk_to_team: a.escalate ? COPY.talkToTeam : null,
        contact_required: contactRequired,
        contact_prefill: contactRequired ? await prefillFor(record, userId) : null,
        suggestions: contactRequired ? [] : suggestionsFor(a),
      });

      after(async () => {
        try {
          await persist(recordInput);
          // A handoff that need not wait for details — safety, or a number already on the
          // record — opens the conversation in Chatwoot with the record's transcript. Only
          // after persist(), so the row holds this turn too and Chatwoot's id can be written
          // onto it. A handoff waiting for details is opened by captureContact instead.
          if (a.handoff) {
            const result = await startHandoff(record, chatwoot, {
              conversationId,
              ref,
              transcript: [...history, { role: 'user', content: message }, { role: 'assistant', content: a.text }],
              escalationReason: a.escalate ?? null,
              page: page ?? null,
              city: a.entities.city ?? context.city ?? null,
              locality: a.entities.locality?.slug ?? context.locality ?? null,
              service: a.entities.service ?? context.service ?? null,
              plan: a.entities.plan ?? context.plan ?? null,
              signedIn: !!userId,
            });
            if (result.status === 'failed') console.error(`[chat] handoff for ${ref} failed: ${result.reason}`);
          }
        } catch (e) {
          console.error('[chat] after() threw', e);
        }
      });
    } catch (e) {
      console.error('[chat] answer threw', e);
      send(controller, 'answer', {
        conversation_id: conversationId,
        ref,
        mode: 'assistant',
        text: COPY.refuse,
        sources: [],
        intent: 'unknown',
        rung: 3,
        escalate: 'low_confidence',
        handoff: null,
        talk_to_team: COPY.talkToTeam,
        contact_required: awaitingContact,
        contact_prefill: null,
        suggestions: awaitingContact ? [] : suggestionsFor({ intent: 'unknown' }),
      });
    } finally {
      // captureInto closes the stream itself; closing twice would throw.
      if (controller.desiredSize !== null) {
        send(controller, 'done', {});
        controller.close();
      }
    }
  });
}

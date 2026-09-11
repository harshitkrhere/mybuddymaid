// app/api/chat/route.ts — the support assistant's endpoint.
//
// POST { conversation_id, message, history?, context?, page? } → a server-sent-event stream:
//   event: status  data: {"state":"thinking"}
//   event: answer  data: { text, sources, ref, escalate?, handoff?, intent, rung, language }
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
// Same posture as app/api/lead/route.ts: nodejs runtime, force-dynamic, the service-role key
// server-side only, raw fetch to PostgREST, no client SDK.

import { NextResponse, after } from 'next/server';
import { answer, type Turn, type Answer } from '@/lib/assistant/answer';
import { providerFromEnv } from '@/lib/assistant/provider';
import { COPY } from '@/lib/assistant/copy';
import { refFor } from '@/lib/assistant/ref';
import { recordClientFromEnv, upsertConversation, insertMessages } from '@/lib/support/record';
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

// ─── CORS ───────────────────────────────────────────────────────────────────────────────────
// The site and the booking app are same-origin. The native app (Initiative 1) will not be;
// its origins are added to ASSISTANT_ALLOWED_ORIGINS when it exists.

const ALLOWED_ORIGINS = new Set(
  (process.env.ASSISTANT_ALLOWED_ORIGINS ?? 'https://mybuddymaid.in,https://www.mybuddymaid.in')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin));
  return allowed
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        Vary: 'Origin',
      }
    : {};
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// ─── Input ──────────────────────────────────────────────────────────────────────────────────

interface Body {
  conversation_id?: string;
  message?: string;
  history?: Array<{ role?: string; content?: string }>;
  page?: string;
  context?: { city?: string; locality?: string; service?: string; plan?: string; device?: string };
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

async function persist(r: RecordInput): Promise<void> {
  const client = recordClientFromEnv();
  if (!client) return;

  const ok = await upsertConversation(client, {
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
    escalated: !!r.a.handoff,
    escalated_at: r.a.handoff ? r.now.toISOString() : null,
    escalation_reason: r.a.handoff ? r.a.escalate : null,
    device: r.context.device ?? null,
    language: r.a.language,
    last_message_at: r.now.toISOString(),
  });
  if (!ok) return;

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
  const cors = corsHeaders(req);
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

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, 'status', { state: 'thinking' });
      try {
        const a = await answer({ message, history, signedIn: !!userId, now }, { provider });
        if (a.rung === 1) modelCallsToday.count += 1;

        const ref = refFor(conversationId);
        send(controller, 'answer', {
          conversation_id: conversationId,
          ref,
          text: a.text,
          sources: a.sources,
          intent: a.intent,
          language: a.language,
          rung: a.rung,
          escalate: a.escalate ?? null,
          handoff: a.handoff ?? null,
          talk_to_team: a.escalate ? COPY.talkToTeam : null,
        });

        after(() =>
          persist({
            conversationId,
            ref,
            channel: userId ? 'app_chat' : 'site_chat',
            userId,
            page,
            context,
            userMessage: message,
            a,
            now,
            turnIndex,
          }).catch((e) => console.error('[chat] persist threw', e)),
        );
      } catch (e) {
        console.error('[chat] answer threw', e);
        send(controller, 'answer', { conversation_id: conversationId, ref: refFor(conversationId), text: COPY.refuse, sources: [], intent: 'unknown', rung: 3, escalate: 'low_confidence', handoff: null, talk_to_team: COPY.talkToTeam });
      } finally {
        send(controller, 'done', {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}

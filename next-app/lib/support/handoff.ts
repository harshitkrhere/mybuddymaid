// lib/support/handoff.ts — what happens to a website conversation once a person is involved.
//
// Three moments, each a function the routes call:
//
//   startHandoff   the assistant has decided to escalate. Open the conversation in Chatwoot
//                  with the record's copy of the transcript (never the caller's) and remember
//                  Chatwoot's id on our record. Runs after the reply is sent (next/server's
//                  after()), so it never slows the customer.
//                  Idempotent: a conversation already handed off is left alone.
//
//   forwardMessage the customer typed again after the handoff. It goes to the person in
//                  Chatwoot as the customer's own message, and is recorded.
//
//   forwardReply   the assistant's last word once the details are in — "passed to our team" —
//                  to Chatwoot too, so the person sees what the customer was told. After that
//                  the assistant says nothing until the team closes the conversation (owner
//                  decision, 2026-09-12): every message is the person's to answer.
//
//   pullReplies    the widget asks "anything from the team yet?". Chatwoot is asked for the
//                  conversation's messages, the agent's replies are recorded (idempotent on
//                  chatwoot_message_id — the webhook may have written them first), and the
//                  ones the widget has not shown are returned. This is the free-tier path;
//                  it keeps working when the webhook arrives.
//
//   captureContact the customer has given the name and number the handoff waited for (owner
//                  decision, 2026-09-12: the team gets a conversation only with a way to reach
//                  the customer back). Onto the record, then the handoff — synchronously, so
//                  "passed to our team" is said only once it is true.
//
//   noteContact    details given once the conversation is already with the team: onto the
//                  record, and the Chatwoot contact takes the name.
//
// Both the record (Supabase) and Chatwoot are injected, so handoff.test.ts drives every path
// with stubs. If either is not configured the functions do the safe thing: nothing, and say so.

import type { ChatwootClient, Transcript } from './chatwoot';
import { openHandoff, postCustomerMessage, postAssistantMessage, fetchMessages, fetchStatus, renameContact } from './chatwoot';
import { waitsForContact, type ContactDetails } from './contact';
import { assistantChatwootIds, getConversation, insertMessages, listMessagesAfter, listTranscript, patchConversation, type ConversationRow, type RecordClient } from './record';

/** How long after the last message the team's replies stay readable with the conversation id alone. */
const REPLIES_WINDOW_MS = 24 * 60 * 60 * 1000;
/** How long after a handoff is decided its Chatwoot conversation may still be opening. */
const HANDOFF_OPENING_MS = 2 * 60 * 1000;

// ─── Start ──────────────────────────────────────────────────────────────────────────────────

export interface StartHandoffInput {
  conversationId: string;
  ref: string;
  transcript: Transcript[];
  escalationReason?: string | null;
  page?: string | null;
  city?: string | null;
  locality?: string | null;
  service?: string | null;
  plan?: string | null;
  signedIn?: boolean;
}

export type StartResult = { status: 'opened'; chatwootConversationId: number } | { status: 'already'; chatwootConversationId: number } | { status: 'skipped'; reason: string } | { status: 'failed'; reason: string };

export async function startHandoff(record: RecordClient | null, chatwoot: ChatwootClient | null, h: StartHandoffInput): Promise<StartResult> {
  if (!chatwoot) return { status: 'skipped', reason: 'chatwoot not configured' };
  // Without the record there is nowhere to remember Chatwoot's id, so later messages could not
  // be forwarded and replies could not be pulled. Open nothing rather than open something orphaned.
  if (!record) return { status: 'skipped', reason: 'record not configured' };

  const lookup = await getConversation(record, h.conversationId);
  if (!lookup.ok) return { status: 'failed', reason: 'record lookup failed' };
  const existing = lookup.row;
  // Open with the team already: nothing to do. Closed by the team and escalated again: that
  // conversation is resolved, so a new one is opened for the same contact and the row reopened.
  if (existing?.chatwoot_conversation_id && !existing.closed_at) return { status: 'already', chatwootConversationId: existing.chatwoot_conversation_id };

  // The transcript is the server's copy of the conversation, never the caller's. What the
  // widget sends as history is the visitor's to edit; the person reading the handoff must see
  // what was actually said. The caller's copy stands in only when the record holds nothing.
  const recorded = await listTranscript(record, h.conversationId);
  const transcript: Transcript[] = recorded.length ? recorded.map((m) => ({ role: m.sender === 'assistant' ? 'assistant' : 'user', content: m.body })) : h.transcript;

  const chatwootId = await openHandoff(chatwoot, {
    conversationId: h.conversationId,
    ref: h.ref,
    transcript,
    contactName: existing?.contact_name ?? null,
    contactPhone: existing?.contact_phone ?? null,
    page: h.page ?? null,
    city: h.city ?? null,
    locality: h.locality ?? null,
    service: h.service ?? null,
    plan: h.plan ?? null,
    escalationReason: h.escalationReason ?? null,
    signedIn: !!h.signedIn,
  });
  if (chatwootId === null) return { status: 'failed', reason: 'chatwoot refused' };

  const ok = await patchConversation(record, h.conversationId, {
    chatwoot_conversation_id: chatwootId,
    chatwoot_inbox_id: chatwoot.inboxId,
    escalated: true,
    closed_at: null, // a row the team had closed is open again, with the new conversation
  });
  if (!ok) console.error(`[handoff] opened Chatwoot conversation ${chatwootId} but could not record it on ${h.conversationId}`);

  // Anything the customer wrote while the conversation was being opened — their name and
  // number, typically, since that is what the handoff asks for — was held on the record and is
  // in neither the transcript nor Chatwoot. Post it now, in order, so the person sees it.
  const sinceIso = recorded.length ? recorded[recorded.length - 1].created_at : undefined;
  if (sinceIso) {
    const held = await listMessagesAfter(record, h.conversationId, sinceIso, ['customer']);
    for (const m of held) if (!m.chatwoot_message_id) await postCustomerMessage(chatwoot, h.conversationId, chatwootId, m.body);
  }
  return { status: 'opened', chatwootConversationId: chatwootId };
}

// ─── The handed-off state ───────────────────────────────────────────────────────────────────

export interface HandedOff {
  row: ConversationRow;
  chatwootConversationId: number;
}

/**
 * Whether messages on this conversation go to the person rather than the bot: it has a Chatwoot
 * conversation the team has not closed. No time limit — the conversation is the team's until
 * they close it, however long the silence, and the assistant does not answer meanwhile (owner
 * decision, 2026-09-12). Reading the team's replies is bounded separately: recentlyActive.
 */
export async function handedOff(record: RecordClient | null, conversationId: string): Promise<HandedOff | null> {
  if (!record) return null;
  const lookup = await getConversation(record, conversationId);
  if (!lookup.ok || !lookup.row) return null;
  return handedOffFrom(lookup.row);
}

/** Open with the team: a Chatwoot conversation the team has not closed. */
export function openInChatwoot(row: ConversationRow): boolean {
  return !!row.chatwoot_conversation_id && !row.closed_at;
}

/** The same decision from a row already in hand, so a route that looked it up need not ask twice. */
export function handedOffFrom(row: ConversationRow): HandedOff | null {
  if (!row.chatwoot_conversation_id || row.closed_at) return null;
  return { row, chatwootConversationId: row.chatwoot_conversation_id };
}

/**
 * Whether the team's replies may be read with the conversation id alone: a message on either
 * side within the last day. This bounds how long a leaked id grants access to what the team
 * wrote; the customer's own next message re-arms it.
 */
export function recentlyActive(row: ConversationRow, now: Date = new Date()): boolean {
  const last = row.last_message_at ? new Date(row.last_message_at).getTime() : 0;
  return now.getTime() - last <= REPLIES_WINDOW_MS;
}

/**
 * A handoff decided moments ago whose Chatwoot conversation is still being opened: escalated,
 * not open with the team (none yet, or the team closed the last one), within the opening window. What the customer writes now is held on the
 * record (holdMessage) and posted by startHandoff once the conversation exists. The window
 * keeps a handoff that failed from holding messages forever.
 *
 * Not an escalation that is waiting for the customer's number: nothing is opening there until
 * the details are in, and treating it as opening held the card's details as if a conversation
 * existed and opened none (live, 2026-09-12). Safety, and a reason whose number is already on
 * the record, open at once and are opening.
 */
export function awaitingHandoffFrom(row: ConversationRow, now: Date = new Date()): boolean {
  if (openInChatwoot(row) || !row.escalated || !row.escalated_at) return false;
  if (!row.contact_phone && waitsForContact(row.escalation_reason)) return false;
  const since = now.getTime() - new Date(row.escalated_at).getTime();
  return since >= 0 && since <= HANDOFF_OPENING_MS;
}

/**
 * A message written while the Chatwoot conversation is being opened: onto the record, for
 * startHandoff to post. Contact details in it go on the row as well.
 */
export async function holdMessage(record: RecordClient, conversationId: string, content: string, now: Date = new Date(), contact: ContactDetails | null = null): Promise<boolean> {
  const ok = await insertMessages(record, [{ conversation_id: conversationId, sender: 'customer', body: content, created_at: now.toISOString() }]);
  const fields: Partial<ConversationRow> = { last_message_at: now.toISOString() };
  if (contact) {
    fields.contact_phone = contact.phone;
    if (contact.name) fields.contact_name = contact.name;
  }
  await patchConversation(record, conversationId, fields);
  return ok;
}

// ─── Contact before the handoff ─────────────────────────────────────────────────────────────
// An escalation that waits for details is on the record as escalated, with a reason, no number
// and no Chatwoot id. The customer's next message with a number in it — from the card or typed
// — completes it, and the conversation is opened there and then.

/** How long an escalation waits for the customer's details before a fresh ask is needed. */
const CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** An escalation waiting for the customer's name and number: a reason that waits, no number, no Chatwoot conversation, within a day. */
export function awaitingContactFrom(row: ConversationRow, now: Date = new Date()): boolean {
  if (openInChatwoot(row) || row.contact_phone || !row.escalated || !row.escalated_at) return false;
  if (!waitsForContact(row.escalation_reason)) return false;
  const since = now.getTime() - new Date(row.escalated_at).getTime();
  return since >= 0 && since <= CONTACT_WINDOW_MS;
}

export interface CaptureInput {
  conversationId: string;
  ref: string;
  contact: ContactDetails;
  /** The details as a line of the transcript, in the copy's words. */
  line: string;
  page?: string | null;
  city?: string | null;
  locality?: string | null;
  service?: string | null;
  plan?: string | null;
  signedIn?: boolean;
}

export type CaptureResult = { status: 'opened' | 'already'; chatwootConversationId: number } | { status: 'saved'; reason: string };

/**
 * The details are in: onto the record as the customer's turn and the row's contact fields, then
 * the handoff — synchronously, so the customer hears "passed to our team" only once it is true,
 * and nothing typed meanwhile can fall between the ask and the opening. 'saved' means the record
 * has the details but Chatwoot could not be opened: the team still has a number to call, and the
 * next escalation on this conversation goes straight through with it.
 */
export async function captureContact(record: RecordClient, chatwoot: ChatwootClient | null, row: ConversationRow, c: CaptureInput, now: Date = new Date()): Promise<CaptureResult> {
  await insertMessages(record, [{ conversation_id: c.conversationId, sender: 'customer', body: c.line, created_at: now.toISOString() }]);
  const fields: Partial<ConversationRow> = { contact_phone: c.contact.phone, last_message_at: now.toISOString() };
  if (c.contact.name) fields.contact_name = c.contact.name;
  await patchConversation(record, c.conversationId, fields);

  const result = await startHandoff(record, chatwoot, {
    conversationId: c.conversationId,
    ref: c.ref,
    transcript: [{ role: 'user', content: c.line }],
    escalationReason: row.escalation_reason ?? null,
    page: c.page ?? null,
    city: c.city ?? null,
    locality: c.locality ?? null,
    service: c.service ?? null,
    plan: c.plan ?? null,
    signedIn: !!c.signedIn,
  });
  if (result.status === 'opened' || result.status === 'already') return { status: result.status, chatwootConversationId: result.chatwootConversationId };
  return { status: 'saved', reason: result.reason };
}

/**
 * Details given once the conversation is already with the team — after a safety handoff, which
 * alerts first and asks alongside, or a customer correcting their number. The message itself was
 * forwarded like any other; this puts the details on the record and the name on the Chatwoot
 * contact, where the sidebar shows it.
 */
export async function noteContact(record: RecordClient, chatwoot: ChatwootClient | null, h: HandedOff, contact: ContactDetails): Promise<void> {
  const fields: Partial<ConversationRow> = { contact_phone: contact.phone };
  if (contact.name) fields.contact_name = contact.name;
  await patchConversation(record, h.row.id, fields);
  if (chatwoot && contact.name) await renameContact(chatwoot, h.row.id, contact.name);
}

// ─── Forward ────────────────────────────────────────────────────────────────────────────────

export async function forwardMessage(record: RecordClient, chatwoot: ChatwootClient | null, h: HandedOff, content: string, now: Date = new Date()): Promise<boolean> {
  const chatwootMessageId = chatwoot ? await postCustomerMessage(chatwoot, h.row.id, h.chatwootConversationId, content) : null;
  // Record it even if Chatwoot refused: the transcript is ours, and the pull will not
  // double-write because the id is only set when Chatwoot accepted it.
  await insertMessages(record, [{ conversation_id: h.row.id, sender: 'customer', body: content, chatwoot_message_id: chatwootMessageId, created_at: now.toISOString() }]);
  await patchConversation(record, h.row.id, { last_message_at: now.toISOString() });
  return chatwootMessageId !== null;
}

export interface ForwardedReply {
  text: string;
  sources?: unknown;
  modelId?: string | null;
  rung?: number | null;
  gateRejected?: boolean;
  redacted?: string[];
}

/** The assistant's answer to a forwarded message: to Chatwoot as the bot, and onto the record. */
export async function forwardReply(record: RecordClient, chatwoot: ChatwootClient | null, h: HandedOff, reply: ForwardedReply, now: Date = new Date()): Promise<void> {
  const chatwootMessageId = chatwoot ? await postAssistantMessage(chatwoot, h.row.id, h.chatwootConversationId, reply.text) : null;
  await insertMessages(record, [
    {
      conversation_id: h.row.id,
      sender: 'assistant',
      body: reply.text,
      grounded_sources: reply.sources ?? null,
      model_id: reply.modelId ?? null,
      rung: reply.rung ?? null,
      gate_rejected: !!reply.gateRejected,
      redacted: reply.redacted ?? [],
      chatwoot_message_id: chatwootMessageId,
      created_at: new Date(now.getTime() + 1).toISOString(),
    },
  ]);
}

// ─── Pull ───────────────────────────────────────────────────────────────────────────────────

export interface Reply {
  id: number | null;
  sender: 'agent' | 'assistant';
  body: string;
  created_at: string;
}

export interface PullResult {
  replies: Reply[];
  /** open | pending | resolved | snoozed, or null when Chatwoot could not be asked. */
  status: string | null;
  closed: boolean;
}

export async function pullReplies(record: RecordClient, chatwoot: ChatwootClient | null, h: HandedOff, afterIso: string, now: Date = new Date()): Promise<PullResult> {
  let status: string | null = null;
  if (chatwoot) {
    const messages = await fetchMessages(chatwoot, h.row.id, h.chatwootConversationId);
    const outgoing = messages.filter((m) => (m.message_type === 'outgoing' || m.message_type === 'template') && !m.private && m.content.trim());
    // The assistant's own replies were posted as the bot and are already on the record; they
    // are not the team's, whatever sender type Chatwoot reports for them.
    const ours = await assistantChatwootIds(record, h.row.id, outgoing.map((m) => m.id));
    const fromTeam = outgoing.filter((m) => !ours.has(m.id));
    if (fromTeam.length) {
      // Idempotent on chatwoot_message_id; a 409 from the unique index is success.
      await insertMessages(
        record,
        fromTeam.map((m) => ({
          conversation_id: h.row.id,
          sender: m.sender?.type === 'agent_bot' ? ('assistant' as const) : ('agent' as const),
          body: m.content,
          chatwoot_message_id: m.id,
          created_at: m.created_at,
        })),
      );
      const firstHuman = fromTeam.find((m) => m.sender?.type !== 'agent_bot');
      const patch: Partial<ConversationRow> = { last_message_at: now.toISOString() };
      if (firstHuman && !h.row.first_agent_reply_at) patch.first_agent_reply_at = firstHuman.created_at;
      if (firstHuman?.sender?.name && !h.row.handled_by) patch.handled_by = firstHuman.sender.name;
      await patchConversation(record, h.row.id, patch);
    }
    status = await fetchStatus(chatwoot, h.row.id, h.chatwootConversationId);
    if (status === 'resolved' && !h.row.closed_at) {
      await patchConversation(record, h.row.id, { outcome: h.row.outcome ?? 'resolved', closed_at: now.toISOString() });
    }
  }

  // What the widget has not shown yet: what people wrote, from the record — which now includes
  // anything the pull above wrote, and anything the webhook wrote before it. The assistant's
  // turns are never here; the widget showed those as they were answered.
  const rows = await listMessagesAfter(record, h.row.id, afterIso, ['agent']);
  const replies: Reply[] = rows
    .filter((r) => r.chatwoot_message_id) // only what came from Chatwoot
    .map((r) => ({ id: r.chatwoot_message_id ?? null, sender: 'agent', body: r.body, created_at: r.created_at ?? now.toISOString() }));

  return { replies, status, closed: status === 'resolved' };
}

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
//   forwardReply   the assistant could still answer that message from the published facts,
//                  so it did — and the answer goes to Chatwoot too, as the bot, so the person
//                  sees the whole exchange. A question the assistant cannot answer is only
//                  forwarded, with an acknowledgement.
//
//   pullReplies    the widget asks "anything from the team yet?". Chatwoot is asked for the
//                  conversation's messages, the agent's replies are recorded (idempotent on
//                  chatwoot_message_id — the webhook may have written them first), and the
//                  ones the widget has not shown are returned. This is the free-tier path;
//                  it keeps working when the webhook arrives.
//
// Both the record (Supabase) and Chatwoot are injected, so handoff.test.ts drives every path
// with stubs. If either is not configured the functions do the safe thing: nothing, and say so.

import type { ChatwootClient, Transcript } from './chatwoot';
import { openHandoff, postCustomerMessage, postAssistantMessage, fetchMessages, fetchStatus } from './chatwoot';
import { assistantChatwootIds, getConversation, insertMessages, listMessagesAfter, listTranscript, patchConversation, type ConversationRow, type RecordClient } from './record';

const HANDOFF_WINDOW_MS = 24 * 60 * 60 * 1000;
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
  if (existing?.chatwoot_conversation_id) return { status: 'already', chatwootConversationId: existing.chatwoot_conversation_id };

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
 * Whether messages on this conversation should go to the person rather than the bot: it has a
 * Chatwoot conversation, it is not closed, and it was active in the last 24 hours. The window
 * bounds how long possession of a conversation id grants access to what the team wrote.
 */
export async function handedOff(record: RecordClient | null, conversationId: string, now: Date = new Date()): Promise<HandedOff | null> {
  if (!record) return null;
  const lookup = await getConversation(record, conversationId);
  if (!lookup.ok || !lookup.row) return null;
  return handedOffFrom(lookup.row, now);
}

/** The same decision from a row already in hand, so a route that looked it up need not ask twice. */
export function handedOffFrom(row: ConversationRow, now: Date = new Date()): HandedOff | null {
  if (!row.chatwoot_conversation_id || row.closed_at) return null;
  const last = row.last_message_at ? new Date(row.last_message_at).getTime() : 0;
  if (now.getTime() - last > HANDOFF_WINDOW_MS) return null;
  return { row, chatwootConversationId: row.chatwoot_conversation_id };
}

/**
 * A handoff decided moments ago whose Chatwoot conversation is still being opened: escalated,
 * no Chatwoot id yet, within the opening window. What the customer writes now is held on the
 * record (holdMessage) and posted by startHandoff once the conversation exists. The window
 * keeps a handoff that failed from holding messages forever.
 */
export function awaitingHandoffFrom(row: ConversationRow, now: Date = new Date()): boolean {
  if (row.chatwoot_conversation_id || !row.escalated || !row.escalated_at || row.closed_at) return false;
  const since = now.getTime() - new Date(row.escalated_at).getTime();
  return since >= 0 && since <= HANDOFF_OPENING_MS;
}

/** A message written while the Chatwoot conversation is being opened: onto the record, for startHandoff to post. */
export async function holdMessage(record: RecordClient, conversationId: string, content: string, now: Date = new Date()): Promise<boolean> {
  const ok = await insertMessages(record, [{ conversation_id: conversationId, sender: 'customer', body: content, created_at: now.toISOString() }]);
  await patchConversation(record, conversationId, { last_message_at: now.toISOString() });
  return ok;
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

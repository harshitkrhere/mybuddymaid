// lib/support/chatwoot-webhook.ts — Chatwoot's events, into the support record.
//
// Chatwoot is the team's working surface; Supabase is the system of record (owner decision
// 15). Every message an agent sends, and every conversation that starts on WhatsApp or email,
// arrives here and is written into support_conversations / support_messages, so the record
// is complete on every channel and the weekly report and the decision-8 gate can count them.
//
// Authentication is the webhook signature, verified over the RAW body before anything is
// parsed — the same discipline as supabase/functions/razorpay-webhook/handler.ts. Chatwoot
// signs sha256=HMAC-SHA256(secret, "{timestamp}.{raw_body}") and sends the timestamp
// alongside; a timestamp more than five minutes old is refused so a captured request cannot
// be replayed later. Nothing below the signature check runs on unverified input.
//
// Idempotent: a redelivered event finds its message already recorded (unique index on
// chatwoot_message_id) and does nothing. Safe to receive N times. And one-way: an incoming
// message on the API inbox is one our own server posted through the Client API — the
// transcript at handoff, the customer's later messages, the assistant's turns from the
// visitor's side (handoff.ts) — and is on the record already, so its echo is acknowledged and
// not written. Incoming on every other channel is a customer writing to the team.
//
// This module is pure logic with the record client injected, so chatwoot-webhook.test.ts
// drives it with real HMACs and a stubbed PostgREST. The route in app/api/chatwoot/webhook
// is three lines.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { refFor } from '@/lib/assistant/ref';
import { findConversationByChatwootId, insertMessages, patchConversation, upsertConversation, type Channel, type ConversationRow, type RecordClient, type Sender } from './record';

export const MAX_SKEW_SECONDS = 5 * 60;

// ─── Signature ──────────────────────────────────────────────────────────────────────────────

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing' | 'stale' | 'mismatch' };

export function verifyChatwootSignature(
  rawBody: string,
  headers: { signature: string | null; timestamp: string | null },
  secret: string,
  now: Date = new Date(),
): VerifyResult {
  if (!headers.signature || !headers.timestamp) return { ok: false, reason: 'missing' };
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale' };

  const expected = createHmac('sha256', secret).update(`${headers.timestamp}.${rawBody}`).digest('hex');
  const received = headers.signature.replace(/^sha256=/, '').trim();
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' };
  return { ok: true };
}

// ─── Payload (tolerant) ─────────────────────────────────────────────────────────────────────

interface ChatwootSender {
  id?: number;
  name?: string;
  type?: string; // 'contact' | 'user' | 'agent_bot' in current versions; absent in older ones
  phone_number?: string;
  email?: string;
}

interface ChatwootConversation {
  id?: number;
  inbox_id?: number;
  status?: string; // open | pending | resolved | snoozed
  channel?: string; // 'Channel::Api' | 'Channel::Whatsapp' | 'Channel::Email' | …
  custom_attributes?: Record<string, unknown>;
  meta?: { sender?: ChatwootSender; assignee?: ChatwootSender | null };
  contact_inbox?: { source_id?: string };
}

export interface ChatwootEvent {
  event?: string;
  id?: number;
  content?: string | null;
  message_type?: string | number; // 'incoming' | 'outgoing' | 'activity' | 'template' (or 0/1/2/3)
  private?: boolean;
  created_at?: string | number;
  sender?: ChatwootSender;
  conversation?: ChatwootConversation;
  // conversation_* events put the conversation's own fields at the top level.
  status?: string;
  inbox_id?: number;
  channel?: string;
  custom_attributes?: Record<string, unknown>;
  meta?: ChatwootConversation['meta'];
  account?: { id?: number };
}

const MESSAGE_TYPES: Record<number, string> = { 0: 'incoming', 1: 'outgoing', 2: 'activity', 3: 'template' };

function messageType(e: ChatwootEvent): string {
  return typeof e.message_type === 'number' ? (MESSAGE_TYPES[e.message_type] ?? 'unknown') : String(e.message_type ?? 'unknown');
}

export function channelFrom(chatwootChannel: string | undefined): Channel {
  const c = (chatwootChannel ?? '').toLowerCase();
  if (c.includes('whatsapp')) return 'whatsapp';
  if (c.includes('email')) return 'email';
  if (c.includes('sms') || c.includes('voice') || c.includes('call')) return 'phone';
  return 'site_chat';
}

/**
 * Chatwoot's API channel has exactly one client here: our server, posting as the visitor. An
 * incoming message there is never news — it is what handoff.ts just sent, already recorded.
 */
export function isOwnClientChannel(chatwootChannel: string | undefined): boolean {
  return (chatwootChannel ?? '').toLowerCase() === 'channel::api';
}

function senderFrom(e: ChatwootEvent): Sender | null {
  const type = messageType(e);
  if (type === 'incoming') return 'customer';
  if (type === 'outgoing' || type === 'template') return e.sender?.type === 'agent_bot' ? 'assistant' : 'agent';
  return null; // activity lines ("Conversation was resolved") are not transcript
}

function iso(v: string | number | undefined, fallback: Date): string {
  if (typeof v === 'number') return new Date(v * 1000).toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback.toISOString();
}

// ─── Handling ───────────────────────────────────────────────────────────────────────────────

export type HandleResult =
  | { status: 'recorded'; conversationId: string; created: boolean }
  | { status: 'ignored'; reason: string }
  | { status: 'retry'; reason: string };

/**
 * Route one verified event into the record. Returns 'retry' only for a database failure,
 * so the route can answer 503 and Chatwoot (or the nightly reconciliation) can try again.
 */
export async function handleChatwootEvent(e: ChatwootEvent, client: RecordClient, now: Date = new Date()): Promise<HandleResult> {
  switch (e.event) {
    case 'message_created':
      return onMessageCreated(e, client, now);
    case 'conversation_status_changed':
    case 'conversation_updated':
    case 'conversation_resolved':
      return onConversationChanged(e, client, now);
    default:
      return { status: 'ignored', reason: `unsubscribed event ${e.event ?? '(none)'}` };
  }
}

async function ensureConversation(
  conv: ChatwootConversation,
  contact: ChatwootSender | undefined,
  client: RecordClient,
  now: Date,
): Promise<{ id: string; created: boolean; existing: ConversationRow | null } | null> {
  if (typeof conv.id !== 'number') return null;
  const lookup = await findConversationByChatwootId(client, conv.id);
  if (!lookup.ok) return null; // do not create on a failed lookup — that is how duplicates happen
  if (lookup.row) return { id: lookup.row.id, created: false, existing: lookup.row };

  // A conversation that began in Chatwoot — WhatsApp, email, or one an agent opened on the API inbox.
  // Our escalations create their row first and carry chatwoot_conversation_id, so they never
  // land here. Where the Chatwoot conversation carries our id as a custom attribute (set by
  // the escalation path), honour it instead of creating a second row.
  const ours = conv.custom_attributes?.mbm_conversation_id;
  const id = typeof ours === 'string' && /^[0-9a-f-]{36}$/i.test(ours) ? ours.toLowerCase() : crypto.randomUUID();
  const ok = await upsertConversation(client, {
    id,
    ref: refFor(id),
    channel: channelFrom(conv.channel),
    chatwoot_conversation_id: conv.id,
    chatwoot_inbox_id: typeof conv.inbox_id === 'number' ? conv.inbox_id : null,
    contact_name: contact?.name ?? null,
    contact_phone: contact?.phone_number ?? null,
    // A conversation a person is already handling is, by definition, escalated.
    escalated: true,
    escalated_at: now.toISOString(),
    escalation_reason: 'asked_for_human',
    started_at: now.toISOString(),
    last_message_at: now.toISOString(),
  });
  if (!ok) return null;
  return { id, created: true, existing: null };
}

async function onMessageCreated(e: ChatwootEvent, client: RecordClient, now: Date): Promise<HandleResult> {
  const conv = e.conversation;
  if (!conv || typeof conv.id !== 'number' || typeof e.id !== 'number') return { status: 'ignored', reason: 'malformed message event' };
  if (e.private) return { status: 'ignored', reason: 'private note' };
  const sender = senderFrom(e);
  if (!sender) return { status: 'ignored', reason: `message_type ${messageType(e)}` };
  if (sender === 'customer' && isOwnClientChannel(conv.channel)) return { status: 'ignored', reason: 'echo of a message our own client posted' };
  const body = typeof e.content === 'string' ? e.content.trim() : '';
  if (!body) return { status: 'ignored', reason: 'empty content' };

  const contact = sender === 'customer' ? e.sender : conv.meta?.sender;
  const ensured = await ensureConversation(conv, contact, client, now);
  if (!ensured) return { status: 'retry', reason: 'could not find or create the conversation' };

  const createdAt = iso(e.created_at, now);
  const inserted = await insertMessages(client, [
    { conversation_id: ensured.id, sender, body, chatwoot_message_id: e.id, created_at: createdAt },
  ]);
  if (!inserted) return { status: 'retry', reason: 'message insert failed' };

  const patch: Parameters<typeof patchConversation>[2] = { last_message_at: createdAt };
  if (sender === 'agent') {
    if (!ensured.existing?.first_agent_reply_at) patch.first_agent_reply_at = createdAt;
    if (e.sender?.name) patch.handled_by = e.sender.name;
  }
  await patchConversation(client, ensured.id, patch); // best effort; the message is already recorded

  return { status: 'recorded', conversationId: ensured.id, created: ensured.created };
}

async function onConversationChanged(e: ChatwootEvent, client: RecordClient, now: Date): Promise<HandleResult> {
  const conv: ChatwootConversation = e.conversation ?? { id: e.id, inbox_id: e.inbox_id, status: e.status, channel: e.channel, custom_attributes: e.custom_attributes, meta: e.meta };
  if (typeof conv.id !== 'number') return { status: 'ignored', reason: 'malformed conversation event' };

  const lookup = await findConversationByChatwootId(client, conv.id);
  if (!lookup.ok) return { status: 'retry', reason: 'conversation lookup failed' };
  const existing = lookup.row;
  if (!existing) return { status: 'ignored', reason: 'conversation not in the record yet' };

  const patch: Parameters<typeof patchConversation>[2] = {};
  const status = (conv.status ?? e.status ?? '').toLowerCase();
  if (status === 'resolved') {
    if (!existing.outcome) patch.outcome = 'resolved';
    if (!existing.closed_at) patch.closed_at = now.toISOString();
  } else if (status === 'open' && existing.closed_at) {
    patch.closed_at = null; // reopened
  }
  const assignee = conv.meta?.assignee;
  if (assignee?.name && assignee.name !== existing.handled_by) patch.handled_by = assignee.name;

  if (!Object.keys(patch).length) return { status: 'ignored', reason: 'nothing to change' };
  const ok = await patchConversation(client, existing.id, patch);
  return ok ? { status: 'recorded', conversationId: existing.id, created: false } : { status: 'retry', reason: 'conversation patch failed' };
}

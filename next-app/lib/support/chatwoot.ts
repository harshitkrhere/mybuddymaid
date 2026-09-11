// lib/support/chatwoot.ts — the two Chatwoot APIs we use, as much of them as we use.
//
// Chatwoot's free tier has no personal API access tokens ("available on paid plans"), and an
// agent bot's token is refused for creating contacts or conversations ("Access to this
// endpoint is not authorized for bots" — seen live, 2026-09-11). What the free tier does give
// an API-channel inbox is its CLIENT API: the public, token-free endpoints a custom chat
// client uses, keyed by the inbox identifier shown on the inbox page. That is exactly what
// our widget is — a custom client of the "Website assistant" inbox — so it does the work here:
//
//   Client API (no token; the visitor's side of the conversation)
//     create the contact and the conversation, post what the customer typed, list what the
//     team replied, read the conversation's status.
//   Bot token (Application API; the bot's side)
//     the private hand-off note, the assistant's own turns as outgoing messages, and
//     toggle_status → open so the conversation leaves the bot's "pending" queue. Every one
//     of these is on Chatwoot's bot-accessible list. Without the token the conversation
//     still exists, with the assistant's turns posted as the visitor with a prefix; it just
//     stays pending until someone opens it.
//
// One contact per website conversation, whose Client-API identifier (source_id) is our own
// conversation id — so nothing has to be stored to find it again, and a redelivered handoff
// finds the same contact. Plain fetch, injectable for tests; every failure returns null or
// false with a log line.

import { createHmac } from 'node:crypto';

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ChatwootClient {
  apiUrl: string;
  accountId: string;
  inboxId: number;
  /** The inbox identifier shown on the inbox page; keys the Client API. Not a secret. */
  inboxIdentifier: string;
  /** The agent bot's access token, or null: then the bot-side steps are skipped. */
  token: string | null;
  /** Only when the inbox enforces user identity validation. */
  hmacToken: string | null;
  fetchImpl: FetchLike;
  timeoutMs: number;
}

export function chatwootFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl?: FetchLike): ChatwootClient | null {
  const apiUrl = env.CHATWOOT_API_URL?.replace(/\/+$/, '');
  const accountId = env.CHATWOOT_ACCOUNT_ID;
  const inboxId = Number(env.CHATWOOT_INBOX_ID);
  const inboxIdentifier = env.CHATWOOT_INBOX_IDENTIFIER?.trim();
  if (!apiUrl || !accountId || !Number.isFinite(inboxId) || inboxId <= 0 || !inboxIdentifier) return null;
  return {
    apiUrl,
    accountId,
    inboxId,
    inboxIdentifier,
    token: env.CHATWOOT_API_TOKEN?.trim() || null,
    hmacToken: env.CHATWOOT_HMAC_TOKEN?.trim() || null,
    fetchImpl: fetchImpl ?? (globalThis.fetch as FetchLike),
    timeoutMs: 8000,
  };
}

export interface ChatwootMessage {
  id: number;
  content: string;
  /** 'incoming' (customer) | 'outgoing' (agent or bot) | 'activity' | 'template' */
  message_type: string;
  private: boolean;
  created_at: string; // ISO
  sender: { name?: string; type?: string } | null;
}

interface Result<T> {
  status: number;
  body: T | null;
}

async function call<T>(c: ChatwootClient, url: string, init: RequestInit, what: string): Promise<Result<T>> {
  try {
    const res = await c.fetchImpl(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(c.timeoutMs),
    });
    const text = await res.text();
    let body: T | null = null;
    try {
      body = text ? (JSON.parse(text) as T) : null;
    } catch {
      body = null;
    }
    if (!res.ok) console.error(`[chatwoot] ${what} → ${res.status} ${text.slice(0, 200)}`);
    return { status: res.status, body };
  } catch (e) {
    console.error(`[chatwoot] ${what} threw`, e instanceof Error ? e.message : e);
    return { status: 0, body: null };
  }
}

/** Client API: /public/api/v1/inboxes/{inbox_identifier}/… — no token. */
function client<T>(c: ChatwootClient, path: string, init: RequestInit, what: string): Promise<Result<T>> {
  return call<T>(c, `${c.apiUrl}/public/api/v1/inboxes/${encodeURIComponent(c.inboxIdentifier)}${path}`, init, what);
}

/** Application API as the bot: /api/v1/accounts/{account_id}/… — bot token. */
async function bot<T>(c: ChatwootClient, path: string, init: RequestInit, what: string): Promise<Result<T>> {
  if (!c.token) return { status: 0, body: null };
  return call<T>(c, `${c.apiUrl}/api/v1/accounts/${c.accountId}${path}`, { ...init, headers: { api_access_token: c.token } }, what);
}

const contactPath = (sourceId: string) => `/contacts/${encodeURIComponent(sourceId)}`;
const conversationPath = (sourceId: string, chatwootConversationId: number) => `${contactPath(sourceId)}/conversations/${chatwootConversationId}`;

// ─── Contacts ───────────────────────────────────────────────────────────────────────────────

interface ClientContact {
  id?: number;
  source_id?: string;
  pubsub_token?: string;
}

/**
 * The contact for a website conversation, created if needed. Its Client-API identifier is our
 * conversation id, which Chatwoot honours as the source_id and treats as idempotent: asking
 * again returns the same contact.
 */
async function ensureContact(c: ChatwootClient, conversationId: string, name: string, phone: string | null): Promise<string | null> {
  const body: Record<string, unknown> = { identifier: conversationId, source_id: conversationId, name };
  if (phone) body.phone_number = phone;
  if (c.hmacToken) body.identifier_hash = createHmac('sha256', c.hmacToken).update(conversationId).digest('hex');
  const r = await client<ClientContact>(c, '/contacts', { method: 'POST', body: JSON.stringify(body) }, 'create contact');
  if (r.status !== 200 && r.status !== 201) return null;
  const sourceId = typeof r.body?.source_id === 'string' && r.body.source_id ? r.body.source_id : conversationId;
  if (sourceId !== conversationId) console.warn(`[chatwoot] contact source_id ${sourceId} differs from conversation ${conversationId}; later calls will not find it`);
  return sourceId;
}

// ─── Handoff ────────────────────────────────────────────────────────────────────────────────

export interface Transcript {
  role: 'user' | 'assistant';
  content: string;
}

export interface HandoffInput {
  /** Our conversation id (uuid) and short reference (MBM-XXXXX). */
  conversationId: string;
  ref: string;
  transcript: Transcript[];
  /** What the assistant knows about the visitor; all optional, none required. */
  contactName?: string | null;
  contactPhone?: string | null;
  page?: string | null;
  city?: string | null;
  locality?: string | null;
  service?: string | null;
  plan?: string | null;
  escalationReason?: string | null;
  signedIn?: boolean;
}

/** Shown in front of an assistant turn when it has to be posted from the visitor's side. */
export const ASSISTANT_PREFIX = 'Assistant: ';

/**
 * Open a Chatwoot conversation for a handoff. Returns the Chatwoot conversation id, or null
 * if the contact or the conversation could not be created (the caller keeps the WhatsApp/phone
 * handoff, which is live regardless). Failures after that leave a shorter transcript or a
 * pending status, never a missing conversation.
 */
export async function openHandoff(c: ChatwootClient, h: HandoffInput): Promise<number | null> {
  const name = h.contactName?.trim() || `Website visitor ${h.ref}`;
  const sourceId = await ensureContact(c, h.conversationId, name, h.contactPhone ?? null);
  if (!sourceId) return null;

  const created = await client<{ id?: number }>(
    c,
    `${contactPath(sourceId)}/conversations`,
    {
      method: 'POST',
      body: JSON.stringify({
        custom_attributes: {
          mbm_conversation_id: h.conversationId,
          mbm_ref: h.ref,
          mbm_page: h.page ?? '',
          mbm_city: h.city ?? '',
          mbm_locality: h.locality ?? '',
          mbm_service: h.service ?? '',
          mbm_plan: h.plan ?? '',
          mbm_reason: h.escalationReason ?? '',
          mbm_signed_in: h.signedIn ? 'yes' : 'no',
        },
      }),
    },
    'create conversation',
  );
  const conversationId = created.body?.id;
  if (typeof conversationId !== 'number') return null;

  // The private note first, so it sits above the transcript in the agent's view.
  const header = `[${h.ref}] Handed off by the website assistant${h.escalationReason ? ` — ${h.escalationReason.replace(/_/g, ' ')}` : ''}. Transcript follows.`;
  await bot(c, `/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content: header, message_type: 'outgoing', private: true }) }, 'post header note');

  // The transcript, oldest first. The customer's turns are posted from the visitor's side;
  // the assistant's as the bot, or from the visitor's side with a prefix if there is no token.
  for (const t of h.transcript) {
    if (t.role === 'user') {
      await client(c, `${conversationPath(sourceId, conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ content: t.content }) }, 'post transcript (visitor)');
      continue;
    }
    const asBot = await bot(c, `/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content: t.content, message_type: 'outgoing' }) }, 'post transcript (assistant)');
    if (asBot.status < 200 || asBot.status >= 300) {
      await client(c, `${conversationPath(sourceId, conversationId)}/messages`, { method: 'POST', body: JSON.stringify({ content: ASSISTANT_PREFIX + t.content }) }, 'post transcript (assistant, as visitor)');
    }
  }

  // A bot-attached inbox parks a new conversation as pending. The bot hands it to a person by
  // opening it — the one status change a bot token is allowed to make.
  const opened = await bot(c, `/conversations/${conversationId}/toggle_status`, { method: 'POST', body: JSON.stringify({ status: 'open' }) }, 'open conversation');
  if (opened.status < 200 || opened.status >= 300) console.warn(`[chatwoot] conversation ${conversationId} left pending (no bot token, or the call failed)`);

  return conversationId;
}

// ─── After the handoff ──────────────────────────────────────────────────────────────────────

/** A message the customer typed after being handed off goes to the person, as theirs. */
export async function postCustomerMessage(c: ChatwootClient, conversationId: string, chatwootConversationId: number, content: string): Promise<number | null> {
  const r = await client<{ id?: number }>(
    c,
    `${conversationPath(conversationId, chatwootConversationId)}/messages`,
    { method: 'POST', body: JSON.stringify({ content }) },
    'post customer message',
  );
  return typeof r.body?.id === 'number' ? r.body.id : null;
}

/**
 * The assistant's own reply after a handoff, so the person sees the whole exchange: as the bot
 * when there is a token, otherwise from the visitor's side with a prefix. Returns Chatwoot's id.
 */
export async function postAssistantMessage(c: ChatwootClient, conversationId: string, chatwootConversationId: number, content: string): Promise<number | null> {
  const asBot = await bot<{ id?: number }>(c, `/conversations/${chatwootConversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, message_type: 'outgoing' }) }, 'post assistant reply');
  if (typeof asBot.body?.id === 'number') return asBot.body.id;
  const asVisitor = await client<{ id?: number }>(
    c,
    `${conversationPath(conversationId, chatwootConversationId)}/messages`,
    { method: 'POST', body: JSON.stringify({ content: ASSISTANT_PREFIX + content }) },
    'post assistant reply (as visitor)',
  );
  return typeof asVisitor.body?.id === 'number' ? asVisitor.body.id : null;
}

interface RawMessage {
  id?: number;
  content?: string | null;
  message_type?: string | number;
  private?: boolean;
  created_at?: string | number;
  sender?: { name?: string; type?: string } | null;
}

const TYPES: Record<number, string> = { 0: 'incoming', 1: 'outgoing', 2: 'activity', 3: 'template' };

/**
 * Every message on a conversation, oldest first, in a normalised shape. The Client API already
 * leaves out private notes and activity lines. Empty on failure.
 */
export async function fetchMessages(c: ChatwootClient, conversationId: string, chatwootConversationId: number): Promise<ChatwootMessage[]> {
  const r = await client<RawMessage[] | { payload?: RawMessage[] }>(c, `${conversationPath(conversationId, chatwootConversationId)}/messages`, { method: 'GET' }, 'list messages');
  const rows: RawMessage[] = Array.isArray(r.body) ? r.body : (r.body?.payload ?? []);
  return rows
    .filter((m): m is Required<Pick<RawMessage, 'id'>> & RawMessage => typeof m.id === 'number')
    .map((m) => ({
      id: m.id,
      content: typeof m.content === 'string' ? m.content : '',
      message_type: typeof m.message_type === 'number' ? (TYPES[m.message_type] ?? 'unknown') : String(m.message_type ?? 'unknown'),
      private: !!m.private,
      created_at: typeof m.created_at === 'number' ? new Date(m.created_at * 1000).toISOString() : new Date(String(m.created_at)).toISOString(),
      sender: m.sender ?? null,
    }))
    .sort((a, b) => a.id - b.id);
}

/** Current status of a conversation: open | pending | resolved | snoozed, or null when unknown. */
export async function fetchStatus(c: ChatwootClient, conversationId: string, chatwootConversationId: number): Promise<string | null> {
  const r = await client<Array<{ id?: number; status?: string }> | { payload?: Array<{ id?: number; status?: string }> }>(
    c,
    `${contactPath(conversationId)}/conversations`,
    { method: 'GET' },
    'list conversations',
  );
  const rows = Array.isArray(r.body) ? r.body : (r.body?.payload ?? []);
  const row = rows.find((x) => x.id === chatwootConversationId);
  return typeof row?.status === 'string' ? row.status : null;
}

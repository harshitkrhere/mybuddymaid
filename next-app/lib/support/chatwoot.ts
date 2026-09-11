// lib/support/chatwoot.ts — the Chatwoot Application API, as much of it as we use.
//
// Three operations, all against the "Website assistant" API-channel inbox:
//   openHandoff        — a website conversation the assistant is handing to a person becomes
//                        a Chatwoot conversation, transcript included, status OPEN so it lands
//                        in the queue (a bot-attached inbox otherwise parks it as "pending").
//   postCustomerMessage — after the handoff, what the customer types next goes to the person,
//                        not the bot.
//   fetchMessages      — what the person replied, for the widget to show. This is the
//                        free-tier path (owner: no paid webhooks yet); when the webhook is
//                        live it simply arrives twice and the record's unique index dedupes.
//
// Plain fetch, injectable for tests, and every failure returns null or false with a log line.
// The token is a Chatwoot agent-bot access token (no seat cost); it never leaves the server.

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ChatwootClient {
  apiUrl: string;
  accountId: string;
  inboxId: number;
  token: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
}

export function chatwootFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl?: FetchLike): ChatwootClient | null {
  const apiUrl = env.CHATWOOT_API_URL?.replace(/\/+$/, '');
  const accountId = env.CHATWOOT_ACCOUNT_ID;
  const inboxId = Number(env.CHATWOOT_INBOX_ID);
  const token = env.CHATWOOT_API_TOKEN;
  if (!apiUrl || !accountId || !Number.isFinite(inboxId) || inboxId <= 0 || !token) return null;
  return { apiUrl, accountId, inboxId, token, fetchImpl: fetchImpl ?? (globalThis.fetch as FetchLike), timeoutMs: 8000 };
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

async function call<T>(c: ChatwootClient, path: string, init: RequestInit, what: string): Promise<{ status: number; body: T | null }> {
  try {
    const res = await c.fetchImpl(`${c.apiUrl}/api/v1/accounts/${c.accountId}${path}`, {
      ...init,
      headers: { api_access_token: c.token, 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
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

// ─── Contacts ───────────────────────────────────────────────────────────────────────────────

interface ContactPayload {
  id?: number;
  payload?: { contact?: { id?: number }; contact_inbox?: { source_id?: string } };
  contact_inboxes?: Array<{ source_id?: string; inbox?: { id?: number } }>;
}

interface Contact {
  id: number;
  sourceId: string;
}

function parseContact(body: ContactPayload | null, inboxId: number): Contact | null {
  if (!body) return null;
  const id = body.payload?.contact?.id ?? body.id;
  const fromPayload = body.payload?.contact_inbox?.source_id;
  // A source_id belongs to one inbox; one for another inbox would be refused at conversation
  // creation, so only ours counts (or an entry that does not say which inbox it is for).
  const list = body.contact_inboxes ?? [];
  const fromList = list.find((ci) => ci.inbox?.id === inboxId)?.source_id ?? list.find((ci) => !ci.inbox)?.source_id;
  const sourceId = fromPayload ?? fromList;
  return typeof id === 'number' && typeof sourceId === 'string' ? { id, sourceId } : null;
}

/**
 * The contact for a website conversation. One per conversation, identified by our conversation
 * id, so a redelivered handoff finds the same contact rather than creating a second one.
 */
async function ensureContact(c: ChatwootClient, identifier: string, name: string, phone: string | null): Promise<Contact | null> {
  const created = await call<ContactPayload>(
    c,
    '/contacts',
    { method: 'POST', body: JSON.stringify({ inbox_id: c.inboxId, identifier, name, ...(phone ? { phone_number: phone } : {}) }) },
    'create contact',
  );
  if (created.status === 200 || created.status === 201) return parseContact(created.body, c.inboxId);

  // 422 = identifier (or phone) already taken: find it instead.
  if (created.status === 422) {
    const found = await call<{ payload?: ContactPayload[] }>(c, `/contacts/search?q=${encodeURIComponent(identifier)}`, { method: 'GET' }, 'search contact');
    const hit = found.body?.payload?.[0];
    if (hit) {
      const contact = parseContact(hit, c.inboxId);
      if (contact) return contact;
      // Known contact but not yet in this inbox: attach it.
      if (typeof hit.id === 'number') {
        const ci = await call<{ source_id?: string }>(c, `/contacts/${hit.id}/contact_inboxes`, { method: 'POST', body: JSON.stringify({ inbox_id: c.inboxId }) }, 'attach contact to inbox');
        if (typeof ci.body?.source_id === 'string') return { id: hit.id, sourceId: ci.body.source_id };
      }
    }
  }
  return null;
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

/**
 * Open a Chatwoot conversation for a handoff. Returns the Chatwoot conversation id, or null
 * if any step failed (the caller keeps the WhatsApp/phone handoff, which is live regardless).
 */
export async function openHandoff(c: ChatwootClient, h: HandoffInput): Promise<number | null> {
  const name = h.contactName?.trim() || `Website visitor ${h.ref}`;
  const contact = await ensureContact(c, h.conversationId, name, h.contactPhone ?? null);
  if (!contact) return null;

  const created = await call<{ id?: number }>(
    c,
    '/conversations',
    {
      method: 'POST',
      body: JSON.stringify({
        source_id: contact.sourceId,
        inbox_id: c.inboxId,
        contact_id: contact.id,
        status: 'open',
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

  // The transcript, oldest first: the customer's turns as incoming, the assistant's as outgoing.
  // Posted one by one because the API has no batch endpoint; a failure mid-way leaves a
  // shorter transcript, not a missing conversation, so it is not treated as fatal.
  const header = `[${h.ref}] Handed off by the website assistant${h.escalationReason ? ` — ${h.escalationReason.replace(/_/g, ' ')}` : ''}. Transcript follows.`;
  await call(c, `/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content: header, message_type: 'outgoing', private: true }) }, 'post header note');
  for (const t of h.transcript) {
    await call(
      c,
      `/conversations/${conversationId}/messages`,
      { method: 'POST', body: JSON.stringify({ content: t.content, message_type: t.role === 'user' ? 'incoming' : 'outgoing' }) },
      'post transcript message',
    );
  }

  // Belt and braces: a bot-attached inbox can park a new conversation as pending regardless of
  // the status asked for at creation. Open it explicitly so it is in the queue.
  await call(c, `/conversations/${conversationId}/toggle_status`, { method: 'POST', body: JSON.stringify({ status: 'open' }) }, 'open conversation');

  return conversationId;
}

// ─── After the handoff ──────────────────────────────────────────────────────────────────────

/** A message the customer typed after being handed off goes to the person, as theirs. */
export async function postCustomerMessage(c: ChatwootClient, chatwootConversationId: number, content: string): Promise<number | null> {
  const r = await call<{ id?: number }>(
    c,
    `/conversations/${chatwootConversationId}/messages`,
    { method: 'POST', body: JSON.stringify({ content, message_type: 'incoming' }) },
    'post customer message',
  );
  return typeof r.body?.id === 'number' ? r.body.id : null;
}

interface MessagesPayload {
  payload?: Array<{
    id?: number;
    content?: string | null;
    message_type?: string | number;
    private?: boolean;
    created_at?: string | number;
    sender?: { name?: string; type?: string } | null;
  }>;
}

const TYPES: Record<number, string> = { 0: 'incoming', 1: 'outgoing', 2: 'activity', 3: 'template' };

/** Every message on a conversation, oldest first, in a normalised shape. Empty on failure. */
export async function fetchMessages(c: ChatwootClient, chatwootConversationId: number): Promise<ChatwootMessage[]> {
  const r = await call<MessagesPayload>(c, `/conversations/${chatwootConversationId}/messages`, { method: 'GET' }, 'list messages');
  const rows = r.body?.payload ?? [];
  return rows
    .filter((m): m is Required<Pick<typeof m, 'id'>> & typeof m => typeof m.id === 'number')
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

/** Current status of a conversation: open | pending | resolved | snoozed, or null on failure. */
export async function fetchStatus(c: ChatwootClient, chatwootConversationId: number): Promise<string | null> {
  const r = await call<{ status?: string }>(c, `/conversations/${chatwootConversationId}`, { method: 'GET' }, 'get conversation');
  return typeof r.body?.status === 'string' ? r.body.status : null;
}

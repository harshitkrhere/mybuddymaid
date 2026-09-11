// lib/support/record.ts — the support record's one write path from the site.
//
// Both /api/chat and /api/chatwoot/webhook write to support_conversations and
// support_messages through this file. It talks PostgREST over fetch with the service-role
// key, the same posture as app/api/lead/route.ts: server-side only, no client SDK, and RLS
// is never involved because the service role bypasses it — which is why every caller must
// itself have established what it is allowed to write (an authenticated customer's own
// conversation; a Chatwoot event with a valid signature).
//
// Nothing here throws to the caller on a database error: it logs and returns false, because
// a record that failed to write must never turn into a customer who failed to get an answer.

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface RecordClient {
  url: string;
  key: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
}

export function recordClientFromEnv(env: Record<string, string | undefined> = process.env, fetchImpl?: FetchLike): RecordClient | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key, fetchImpl: fetchImpl ?? (globalThis.fetch as FetchLike), timeoutMs: 6000 };
}

export type Channel = 'site_chat' | 'app_chat' | 'whatsapp' | 'phone' | 'email';
export type Sender = 'customer' | 'assistant' | 'agent' | 'system';

export interface ConversationRow {
  id: string;
  ref: string;
  channel: Channel;
  anon_id?: string | null;
  user_id?: string | null;
  started_from?: string | null;
  city_slug?: string | null;
  locality_slug?: string | null;
  service_slug?: string | null;
  plan_key?: string | null;
  topic?: string | null;
  escalated?: boolean;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  handled_by?: string | null;
  first_agent_reply_at?: string | null;
  outcome?: string | null;
  device?: string | null;
  language?: string | null;
  chatwoot_conversation_id?: number | null;
  chatwoot_inbox_id?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  started_at?: string;
  last_message_at?: string;
  closed_at?: string | null;
}

export interface MessageRow {
  conversation_id: string;
  sender: Sender;
  body: string;
  turn_index?: number;
  grounded_sources?: unknown;
  model_id?: string | null;
  rung?: number | null;
  gate_rejected?: boolean;
  redacted?: string[];
  chatwoot_message_id?: number | null;
  created_at?: string;
}

function headers(c: RecordClient, extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: c.key, Authorization: `Bearer ${c.key}`, 'content-type': 'application/json', ...extra };
}

async function call(c: RecordClient, path: string, init: RequestInit, what: string): Promise<Response | null> {
  try {
    const res = await c.fetchImpl(`${c.url}/rest/v1/${path}`, { ...init, signal: AbortSignal.timeout(c.timeoutMs) });
    if (!res.ok) {
      console.error(`[support-record] ${what} failed`, res.status, (await res.text()).slice(0, 300));
      return null;
    }
    return res;
  } catch (e) {
    console.error(`[support-record] ${what} threw`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Insert or merge a conversation by id. Escalation fields only ever move forward at the call sites. */
export async function upsertConversation(c: RecordClient, row: ConversationRow): Promise<boolean> {
  const res = await call(
    c,
    'support_conversations?on_conflict=id',
    { method: 'POST', headers: headers(c, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row) },
    'conversation upsert',
  );
  return !!res;
}

/** Set fields on an existing conversation. */
export async function patchConversation(c: RecordClient, id: string, fields: Partial<ConversationRow>): Promise<boolean> {
  const res = await call(
    c,
    `support_conversations?id=eq.${encodeURIComponent(id)}`,
    { method: 'PATCH', headers: headers(c, { Prefer: 'return=minimal' }), body: JSON.stringify(fields) },
    'conversation patch',
  );
  return !!res;
}

export type Lookup = { ok: true; row: ConversationRow | null } | { ok: false };

/**
 * The conversation Chatwoot knows by this id. "Not found" and "could not look" are different
 * answers: on a database error the caller must NOT create a fresh row, or a transient failure
 * turns one Chatwoot conversation into two records.
 */
export async function findConversationByChatwootId(c: RecordClient, chatwootId: number): Promise<Lookup> {
  const res = await call(
    c,
    `support_conversations?chatwoot_conversation_id=eq.${chatwootId}&select=id,ref,channel,user_id,escalated,first_agent_reply_at,handled_by,outcome,closed_at&limit=1`,
    { method: 'GET', headers: headers(c) },
    'conversation lookup',
  );
  if (!res) return { ok: false };
  try {
    const rows = (await res.json()) as ConversationRow[];
    return { ok: true, row: rows[0] ?? null };
  } catch {
    return { ok: false };
  }
}

/**
 * Insert messages. A duplicate chatwoot_message_id (a redelivered webhook) is success, not
 * failure: PostgREST answers 409 on the unique index, and the row we wanted is already there.
 */
export async function insertMessages(c: RecordClient, rows: MessageRow[]): Promise<boolean> {
  if (!rows.length) return true;
  try {
    const res = await c.fetchImpl(`${c.url}/rest/v1/support_messages`, {
      method: 'POST',
      headers: headers(c, { Prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(c.timeoutMs),
    });
    if (res.ok) return true;
    if (res.status === 409) return true; // already recorded
    console.error('[support-record] message insert failed', res.status, (await res.text()).slice(0, 300));
    return false;
  } catch (e) {
    console.error('[support-record] message insert threw', e instanceof Error ? e.message : e);
    return false;
  }
}

// lib/leads/store.ts — the two writes /api/lead makes, over PostgREST with the service-role key
// (the same posture as lib/support/record.ts): insert the lead, and later link the Chatwoot
// conversation to it. Nothing here throws: a failed insert is a 502 to the caller, a failed
// link is a log line, and the phone number never appears in either.
import type { RecordClient } from '@/lib/support/record';
import type { LeadRow } from './validate';

function headers(c: RecordClient, prefer: string): Record<string, string> {
  return { apikey: c.key, Authorization: `Bearer ${c.key}`, 'content-type': 'application/json', Prefer: prefer };
}

/** Inserts the row and returns the new id, or null when the database refused or did not answer. */
export async function insertLead(c: RecordClient, row: LeadRow): Promise<{ id: string } | null> {
  try {
    const res = await c.fetchImpl(`${c.url}/rest/v1/leads?select=id`, {
      method: 'POST',
      headers: headers(c, 'return=representation'),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(c.timeoutMs),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[lead] insert failed', res.status, text.slice(0, 300));
      return null;
    }
    const parsed: unknown = text ? JSON.parse(text) : null;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const id = first && typeof first === 'object' ? (first as { id?: unknown }).id : undefined;
    return typeof id === 'string' && id ? { id } : null;
  } catch (e) {
    console.error('[lead] insert threw', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Records which Chatwoot conversation carries this lead, so the row and the inbox thread find each other. */
export async function linkLeadConversation(c: RecordClient, id: string, chatwootConversationId: number): Promise<boolean> {
  try {
    const res = await c.fetchImpl(`${c.url}/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(c, 'return=minimal'),
      body: JSON.stringify({ chatwoot_conversation_id: chatwootConversationId, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(c.timeoutMs),
    });
    if (!res.ok) console.error('[lead] link failed', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error('[lead] link threw', e instanceof Error ? e.message : e);
    return false;
  }
}

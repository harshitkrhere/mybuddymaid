// Run: npx tsx --test lib/leads/store.test.ts
//
// The two PostgREST writes behind /api/lead against a stub fetch: the insert carries the
// service key and asks for the id back, the link patches one row by id, and every failure —
// a refused status, an empty body, a thrown fetch — comes back as null/false, never a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insertLead, linkLeadConversation } from './store';
import type { RecordClient, FetchLike } from '@/lib/support/record';
import type { LeadRow } from './validate';

const ROW: LeadRow = {
  name: 'Priya',
  phone: '9876543210',
  city_slug: 'gurgaon',
  locality_slug: 'dlf-phase-3',
  pincode: '122010',
  entity_slug: null,
  society: null,
  service_slug: 'cook',
  source_page: '/gurgaon/dlf-phase-3/cook',
  status: 'new',
  attribution: null,
};

function stub(status = 201, body: unknown = [{ id: 'lead-1' }]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    // a 204 may not carry a body, even an empty string — undici throws on it
    const payload = status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body);
    return new Response(payload, { status });
  };
  const client: RecordClient = { url: 'https://ref.supabase.co', key: 'sb_secret_test', fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

test('insertLead posts the row with the service key and asks for the id back', async () => {
  const { client, calls } = stub();
  assert.deepEqual(await insertLead(client, ROW), { id: 'lead-1' });
  assert.equal(calls[0].url, 'https://ref.supabase.co/rest/v1/leads?select=id');
  assert.equal(calls[0].init.method, 'POST');
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h.apikey, 'sb_secret_test');
  assert.equal(h.Authorization, 'Bearer sb_secret_test');
  assert.equal(h.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), ROW);
});

test('insertLead returns null on a refused insert, an empty body, or a thrown fetch', async () => {
  assert.equal(await insertLead(stub(400, { message: 'check constraint' }).client, ROW), null);
  assert.equal(await insertLead(stub(201, []).client, ROW), null);
  const offline: RecordClient = {
    url: 'https://ref.supabase.co',
    key: 'k',
    timeoutMs: 1000,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  };
  assert.equal(await insertLead(offline, ROW), null);
});

test('linkLeadConversation patches the one row by id', async () => {
  const { client, calls } = stub(204, '');
  assert.ok(await linkLeadConversation(client, 'lead-1', 4242));
  assert.equal(calls[0].url, 'https://ref.supabase.co/rest/v1/leads?id=eq.lead-1');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.equal(JSON.parse(String(calls[0].init.body)).chatwoot_conversation_id, 4242);
  assert.ok(!(await linkLeadConversation(stub(500, 'nope').client, 'lead-1', 4242)));
});

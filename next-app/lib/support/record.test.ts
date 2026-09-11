// Run: npx tsx --test lib/support/record.test.ts
//
// The one PostgREST rule that bit us live: a bulk insert's objects must all have the same
// keys (PGRST102). A customer turn and an assistant turn never do, so insertMessages widens
// them — with the table's NOT NULL defaults, never a null that the column would refuse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignKeys, insertMessages, type RecordClient, type FetchLike, type MessageRow } from './record';

const customer: MessageRow = { conversation_id: 'c1', sender: 'customer', body: 'hi', turn_index: 0, created_at: '2026-09-15T05:30:00.000Z' };
const assistant: MessageRow = {
  conversation_id: 'c1',
  sender: 'assistant',
  body: 'hello',
  turn_index: 1,
  grounded_sources: [{ id: 'faq-1' }],
  model_id: 'google/gemma-3-27b-it:free',
  rung: 1,
  gate_rejected: false,
  redacted: ['phone'],
  created_at: '2026-09-15T05:30:00.001Z',
};

test('alignKeys gives every row the same keys, filling NOT NULL columns with their defaults and the rest with null', () => {
  const [c, a] = alignKeys([customer, assistant]);
  assert.deepEqual(Object.keys(c).sort(), Object.keys(a).sort());
  assert.equal(c.grounded_sources, null);
  assert.equal(c.model_id, null);
  assert.equal(c.rung, null);
  assert.equal(c.gate_rejected, false);
  assert.deepEqual(c.redacted, []);
  assert.equal(c.turn_index, 0);
  // The assistant row is untouched.
  assert.deepEqual(a, { ...assistant });
});

test('alignKeys: a webhook row without turn_index gets 0, and a row without created_at gets a timestamp', () => {
  const rows: MessageRow[] = [
    { conversation_id: 'c1', sender: 'agent', body: 'yes', chatwoot_message_id: 9002, created_at: '2026-09-15T05:31:00.000Z' },
    { conversation_id: 'c1', sender: 'customer', body: 'ok', turn_index: 3 },
  ];
  const [agent, cust] = alignKeys(rows);
  assert.equal(agent.turn_index, 0);
  assert.equal(cust.chatwoot_message_id, null);
  assert.match(String(cust.created_at), /^\d{4}-\d{2}-\d{2}T/);
});

test('insertMessages sends the aligned rows; 409 counts as recorded', async () => {
  const bodies: unknown[] = [];
  const mk = (status: number): RecordClient => {
    const fetchImpl: FetchLike = async (_url, init) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(null, { status });
    };
    return { url: 'http://stub.local', key: 'k', fetchImpl, timeoutMs: 1000 };
  };
  assert.equal(await insertMessages(mk(201), [customer, assistant]), true);
  const sent = bodies[0] as Record<string, unknown>[];
  assert.deepEqual(Object.keys(sent[0]).sort(), Object.keys(sent[1]).sort());
  assert.equal(await insertMessages(mk(409), [customer]), true);
  assert.equal(await insertMessages(mk(400), [customer]), false);
  assert.equal(await insertMessages(mk(500), []), true, 'nothing to insert is success');
});

// Run: npx tsx --test lib/support/chatwoot-webhook.test.ts
//
// The receiver, driven with real HMAC signatures and a stubbed PostgREST that records what
// it was asked to write. Nothing touches the network. The signature cases mirror the
// discipline of supabase/functions/__tests__/razorpay-webhook.test.ts: verify over the raw
// bytes, refuse before parsing, treat a redelivery as success.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyChatwootSignature, handleChatwootEvent, channelFrom, MAX_SKEW_SECONDS, type ChatwootEvent } from './chatwoot-webhook';
import type { RecordClient, FetchLike } from './record';

const SECRET = 'whsec_test_0123456789';
const NOW = new Date('2026-09-15T05:30:00Z');

function sign(raw: string, at: Date = NOW, secret = SECRET) {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return { signature, timestamp };
}

// ─── A PostgREST double ─────────────────────────────────────────────────────────────────────

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function stubClient(opts: { existing?: Record<number, object>; insertStatus?: number; failLookup?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace(/^https?:\/\/[^/]+\/rest\/v1\//, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    if (method === 'GET' && path.startsWith('support_conversations?chatwoot_conversation_id=eq.')) {
      if (opts.failLookup) return new Response('db down', { status: 500 });
      const id = Number(path.match(/eq\.(\d+)/)![1]);
      const row = opts.existing?.[id];
      return new Response(JSON.stringify(row ? [row] : []), { status: 200 });
    }
    if (method === 'POST' && path.startsWith('support_messages')) return new Response(null, { status: opts.insertStatus ?? 201 });
    return new Response(null, { status: 204 });
  };
  const client: RecordClient = { url: 'http://stub.local', key: 'k', fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

// ─── Payloads, shaped like Chatwoot's ───────────────────────────────────────────────────────

const incoming = (over: Partial<ChatwootEvent> = {}): ChatwootEvent => ({
  event: 'message_created',
  id: 9001,
  content: 'Is Hauz Khas covered?',
  message_type: 'incoming',
  private: false,
  created_at: '2026-09-15T05:29:50Z',
  sender: { id: 5, name: 'Priya', type: 'contact', phone_number: '+919876543210' },
  conversation: { id: 567, inbox_id: 67, status: 'open', channel: 'Channel::Whatsapp', meta: { sender: { name: 'Priya', phone_number: '+919876543210' } } },
  account: { id: 185110 },
  ...over,
});

const agentReply = (over: Partial<ChatwootEvent> = {}): ChatwootEvent =>
  incoming({ id: 9002, content: 'Yes, we do — which service do you need?', message_type: 'outgoing', sender: { id: 1, name: 'Info', type: 'user' }, ...over });

// ─── Signature ──────────────────────────────────────────────────────────────────────────────

test('a correctly signed body is accepted', () => {
  const raw = JSON.stringify(incoming());
  assert.deepEqual(verifyChatwootSignature(raw, sign(raw), SECRET, NOW), { ok: true });
});

test('missing headers, a wrong secret, a tampered body and a stale timestamp are all refused', () => {
  const raw = JSON.stringify(incoming());
  const good = sign(raw);
  assert.equal(verifyChatwootSignature(raw, { signature: null, timestamp: good.timestamp }, SECRET, NOW).ok, false);
  assert.equal(verifyChatwootSignature(raw, { signature: good.signature, timestamp: null }, SECRET, NOW).ok, false);
  assert.deepEqual(verifyChatwootSignature(raw, sign(raw, NOW, 'wrong'), SECRET, NOW), { ok: false, reason: 'mismatch' });
  assert.deepEqual(verifyChatwootSignature(raw + ' ', good, SECRET, NOW), { ok: false, reason: 'mismatch' });
  const old = new Date(NOW.getTime() - (MAX_SKEW_SECONDS + 1) * 1000);
  assert.deepEqual(verifyChatwootSignature(raw, sign(raw, old), SECRET, NOW), { ok: false, reason: 'stale' });
});

test('the signature is over the exact bytes: re-serialised JSON does not verify', () => {
  const raw = '{"event":"message_created",  "id": 1}';
  const good = sign(raw);
  assert.equal(verifyChatwootSignature(JSON.stringify(JSON.parse(raw)), good, SECRET, NOW).ok, false);
});

// ─── Events ─────────────────────────────────────────────────────────────────────────────────

test('a WhatsApp message on an unknown conversation creates the conversation as escalated, on the whatsapp channel, with the contact', async () => {
  const { client, calls } = stubClient();
  const r = await handleChatwootEvent(incoming(), client, NOW);
  assert.equal(r.status, 'recorded');
  if (r.status !== 'recorded') return;
  assert.equal(r.created, true);

  const upsert = calls.find((c) => c.method === 'POST' && c.path.startsWith('support_conversations'))!;
  const row = upsert.body as Record<string, unknown>;
  assert.equal(row.channel, 'whatsapp');
  assert.equal(row.chatwoot_conversation_id, 567);
  assert.equal(row.chatwoot_inbox_id, 67);
  assert.equal(row.contact_name, 'Priya');
  assert.equal(row.contact_phone, '+919876543210');
  assert.equal(row.escalated, true);
  assert.match(String(row.ref), /^MBM-[A-Z2-9]{5}$/);

  const insert = calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!;
  const msg = (insert.body as Array<Record<string, unknown>>)[0];
  assert.equal(msg.sender, 'customer');
  assert.equal(msg.body, 'Is Hauz Khas covered?');
  assert.equal(msg.chatwoot_message_id, 9001);
  assert.equal(msg.conversation_id, r.conversationId);
});

test('an agent reply on a known conversation records an agent message and the first-reply time, once', async () => {
  const existing = { id: 'aaaaaaaa-0000-4000-8000-000000000001', ref: 'MBM-AAAAA', channel: 'site_chat', first_agent_reply_at: null, handled_by: null };
  const { client, calls } = stubClient({ existing: { 567: existing } });
  const r = await handleChatwootEvent(agentReply(), client, NOW);
  assert.equal(r.status, 'recorded');
  if (r.status !== 'recorded') return;
  assert.equal(r.created, false);
  assert.equal(r.conversationId, existing.id);
  assert.ok(!calls.some((c) => c.method === 'POST' && c.path.startsWith('support_conversations')), 'no new conversation');

  const msg = (calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>)[0];
  assert.equal(msg.sender, 'agent');
  const patch = calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.first_agent_reply_at, '2026-09-15T05:29:50.000Z');
  assert.equal(patch.handled_by, 'Info');

  // A second agent reply does not move first_agent_reply_at.
  const { client: c2, calls: calls2 } = stubClient({ existing: { 567: { ...existing, first_agent_reply_at: '2026-09-15T05:29:50.000Z', handled_by: 'Info' } } });
  await handleChatwootEvent(agentReply({ id: 9003 }), c2, NOW);
  const patch2 = calls2.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch2.first_agent_reply_at, undefined);
});

test('a bot-sent message is recorded as the assistant, not an agent', async () => {
  const { client, calls } = stubClient({ existing: { 567: { id: 'aaaaaaaa-0000-4000-8000-000000000001' } } });
  await handleChatwootEvent(agentReply({ sender: { id: 2, name: 'MyBuddyMaid Assistant', type: 'agent_bot' } }), client, NOW);
  const msg = (calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>)[0];
  assert.equal(msg.sender, 'assistant');
  const patch = calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.first_agent_reply_at, undefined, 'a bot reply is not a human reply');
});

test('private notes, activity lines and empty messages are not transcript', async () => {
  const { client, calls } = stubClient({ existing: { 567: { id: 'aaaaaaaa-0000-4000-8000-000000000001' } } });
  for (const e of [incoming({ private: true }), incoming({ message_type: 'activity', content: 'Conversation was resolved' }), incoming({ message_type: 2 }), incoming({ content: '   ' })]) {
    const r = await handleChatwootEvent(e, client, NOW);
    assert.equal(r.status, 'ignored', JSON.stringify(e).slice(0, 80));
  }
  assert.equal(calls.length, 0, 'nothing was written');
});

test('numeric message_type values are understood', async () => {
  const { client, calls } = stubClient({ existing: { 567: { id: 'aaaaaaaa-0000-4000-8000-000000000001' } } });
  await handleChatwootEvent(incoming({ message_type: 0 }), client, NOW);
  await handleChatwootEvent(agentReply({ id: 9004, message_type: 1 }), client, NOW);
  const senders = calls.filter((c) => c.method === 'POST' && c.path.startsWith('support_messages')).map((c) => (c.body as Array<Record<string, unknown>>)[0].sender);
  assert.deepEqual(senders, ['customer', 'agent']);
});

test('a redelivered message (409 from the unique index) is success, not a retry', async () => {
  const { client } = stubClient({ existing: { 567: { id: 'aaaaaaaa-0000-4000-8000-000000000001' } }, insertStatus: 409 });
  const r = await handleChatwootEvent(incoming(), client, NOW);
  assert.equal(r.status, 'recorded');
});

test('a database failure asks for a retry instead of acknowledging', async () => {
  const { client } = stubClient({ failLookup: true });
  const r = await handleChatwootEvent(incoming(), client, NOW);
  assert.equal(r.status, 'retry');
});

test('resolving a known conversation sets the outcome and closed_at; reopening clears closed_at', async () => {
  const existing = { id: 'aaaaaaaa-0000-4000-8000-000000000001', outcome: null, closed_at: null, handled_by: null };
  const { client, calls } = stubClient({ existing: { 567: existing } });
  const r = await handleChatwootEvent({ event: 'conversation_status_changed', id: 567, status: 'resolved', meta: { assignee: { name: 'Info' } } }, client, NOW);
  assert.equal(r.status, 'recorded');
  const patch = calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.outcome, 'resolved');
  assert.equal(patch.closed_at, NOW.toISOString());
  assert.equal(patch.handled_by, 'Info');

  const { client: c2, calls: calls2 } = stubClient({ existing: { 567: { ...existing, outcome: 'resolved', closed_at: NOW.toISOString() } } });
  await handleChatwootEvent({ event: 'conversation_status_changed', id: 567, status: 'open' }, c2, NOW);
  const patch2 = calls2.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch2.closed_at, null);
  assert.equal(patch2.outcome, undefined, 'an outcome already set is not overwritten');
});

test('a status change for a conversation not in the record is ignored, not created', async () => {
  const { client, calls } = stubClient();
  const r = await handleChatwootEvent({ event: 'conversation_status_changed', id: 999, status: 'resolved' }, client, NOW);
  assert.equal(r.status, 'ignored');
  assert.ok(!calls.some((c) => c.method === 'POST'));
});

test('a Chatwoot conversation that carries our id as a custom attribute is written under that id', async () => {
  const { client, calls } = stubClient();
  const ours = 'bbbbbbbb-1111-4222-8333-444444444444';
  const r = await handleChatwootEvent(incoming({ conversation: { id: 700, inbox_id: 67, channel: 'Channel::Api', custom_attributes: { mbm_conversation_id: ours } } }), client, NOW);
  assert.equal(r.status, 'recorded');
  const upsert = calls.find((c) => c.method === 'POST' && c.path.startsWith('support_conversations'))!.body as Record<string, unknown>;
  assert.equal(upsert.id, ours);
});

test('unsubscribed events are acknowledged and write nothing', async () => {
  const { client, calls } = stubClient();
  const r = await handleChatwootEvent({ event: 'conversation_typing_on', id: 1 }, client, NOW);
  assert.equal(r.status, 'ignored');
  assert.equal(calls.length, 0);
});

test('channel mapping', () => {
  assert.equal(channelFrom('Channel::Whatsapp'), 'whatsapp');
  assert.equal(channelFrom('Channel::Email'), 'email');
  assert.equal(channelFrom('Channel::Sms'), 'phone');
  assert.equal(channelFrom('Channel::Api'), 'site_chat');
  assert.equal(channelFrom(undefined), 'site_chat');
});

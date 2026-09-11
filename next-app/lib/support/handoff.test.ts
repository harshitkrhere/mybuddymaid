// Run: npx tsx --test lib/support/handoff.test.ts
//
// The three moments after the assistant escalates, with the record (PostgREST) and Chatwoot
// both stubbed: opening the Chatwoot conversation once and only once, deciding whether a
// message goes to the person or the bot, and pulling the team's replies so the widget can show
// them — idempotently, because the webhook may have recorded the same message first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHandoff, handedOff, handedOffFrom, awaitingHandoffFrom, holdMessage, forwardMessage, forwardReply, pullReplies } from './handoff';
import type { ChatwootClient } from './chatwoot';
import type { RecordClient, FetchLike, ConversationRow } from './record';

const NOW = new Date('2026-09-15T05:30:00Z');
const ID = 'aaaaaaaa-0000-4000-8000-000000000001';

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/** PostgREST double: one conversation row, a message table, and a log of every call. */
function record(row: Partial<ConversationRow> | null, opts: { messages?: object[]; fail?: boolean; insertStatus?: number } = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace(/^https?:\/\/[^/]+\/rest\/v1\//, '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    if (opts.fail) return new Response('db down', { status: 500 });
    if (method === 'GET' && path.startsWith('support_conversations?id=eq.')) {
      return new Response(JSON.stringify(row ? [{ id: ID, ref: 'MBM-AAAAA', channel: 'site_chat', ...row }] : []), { status: 200 });
    }
    if (method === 'GET' && path.startsWith('support_messages?') && path.includes('sender=eq.assistant&chatwoot_message_id=in.')) {
      const ids = path.match(/chatwoot_message_id=in\.\(([^)]*)\)/)![1].split(',').map(Number);
      const rows = (opts.messages ?? []).filter((m) => (m as { sender: string }).sender === 'assistant' && ids.includes((m as { chatwoot_message_id: number }).chatwoot_message_id));
      return new Response(JSON.stringify(rows.map((m) => ({ chatwoot_message_id: (m as { chatwoot_message_id: number }).chatwoot_message_id }))), { status: 200 });
    }
    if (method === 'GET' && path.startsWith('support_messages?') && path.includes('order=created_at.desc')) {
      // The transcript: the conversation's own turns, newest first, as PostgREST would answer.
      // A row marked `late` was written after this snapshot; only the after-query below sees it.
      const rows = (opts.messages ?? []).filter((m) => ['customer', 'assistant'].includes((m as { sender: string }).sender) && !(m as { late?: boolean }).late);
      return new Response(JSON.stringify(rows.slice().reverse()), { status: 200 });
    }
    if (method === 'GET' && path.startsWith('support_messages?')) {
      const after = decodeURIComponent(path.match(/created_at=gt\.([^&]+)/)![1]);
      const senders = path.match(/sender=in\.\(([^)]*)\)/)![1].split(',');
      const rows = (opts.messages ?? []).filter((m) => (m as { created_at: string }).created_at > after && senders.includes((m as { sender: string }).sender));
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (method === 'POST' && path.startsWith('support_messages')) return new Response(null, { status: opts.insertStatus ?? 201 });
    return new Response(null, { status: 204 });
  };
  const client: RecordClient = { url: 'http://stub.local', key: 'k', fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

/** Chatwoot double: enough of both APIs for a handoff, a forwarded message and a pull. */
function chatwoot(opts: { messages?: object[]; status?: string; refuse?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace('https://app.chatwoot.com/public/api/v1/inboxes/inbox-ident', '').replace('https://app.chatwoot.com/api/v1/accounts/185110', '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    if (opts.refuse) return new Response('nope', { status: 500 });
    if (path === '/contacts') return new Response(JSON.stringify({ id: 7, source_id: ID }), { status: 200 });
    if (method === 'POST' && path === `/contacts/${ID}/conversations`) return new Response(JSON.stringify({ id: 4242 }), { status: 200 });
    if (method === 'POST' && path.endsWith('/messages')) return new Response(JSON.stringify({ id: 900 + calls.length }), { status: 200 });
    if (path.endsWith('/toggle_status')) return new Response(JSON.stringify({}), { status: 200 });
    if (method === 'GET' && path.endsWith('/messages')) return new Response(JSON.stringify(opts.messages ?? []), { status: 200 });
    if (method === 'GET' && path === `/contacts/${ID}/conversations`) return new Response(JSON.stringify([{ id: 4242, status: opts.status ?? 'open' }]), { status: 200 });
    return new Response('unexpected', { status: 500 });
  };
  const client: ChatwootClient = { apiUrl: 'https://app.chatwoot.com', accountId: '185110', inboxId: 136538, inboxIdentifier: 'inbox-ident', token: 't', hmacToken: null, fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

const INPUT = { conversationId: ID, ref: 'MBM-AAAAA', transcript: [{ role: 'user' as const, content: 'talk to a human' }, { role: 'assistant' as const, content: 'Of course.' }], escalationReason: 'asked_for_human' };

// ─── startHandoff ───────────────────────────────────────────────────────────────────────────

test('startHandoff: skipped without Chatwoot or without the record — nothing is opened', async () => {
  const r = record({});
  assert.deepEqual(await startHandoff(r.client, null, INPUT), { status: 'skipped', reason: 'chatwoot not configured' });
  const cw = chatwoot();
  assert.deepEqual(await startHandoff(null, cw.client, INPUT), { status: 'skipped', reason: 'record not configured' });
  assert.equal(cw.calls.length, 0);
});

test('startHandoff: opens the conversation and writes Chatwoot’s id, inbox and escalated onto our row', async () => {
  const r = record({ chatwoot_conversation_id: null });
  const cw = chatwoot();
  const result = await startHandoff(r.client, cw.client, INPUT);
  assert.deepEqual(result, { status: 'opened', chatwootConversationId: 4242 });
  const patch = r.calls.find((c) => c.method === 'PATCH')!;
  assert.equal(patch.path, `support_conversations?id=eq.${ID}`);
  assert.deepEqual(patch.body, { chatwoot_conversation_id: 4242, chatwoot_inbox_id: 136538, escalated: true });
});

test('startHandoff: a conversation already in Chatwoot is left alone (a redelivered escalation opens nothing)', async () => {
  const r = record({ chatwoot_conversation_id: 4242 });
  const cw = chatwoot();
  assert.deepEqual(await startHandoff(r.client, cw.client, INPUT), { status: 'already', chatwootConversationId: 4242 });
  assert.equal(cw.calls.length, 0);
});

test('startHandoff: a failed record lookup or a refusing Chatwoot is reported, not thrown', async () => {
  const r = record({}, { fail: true });
  assert.deepEqual(await startHandoff(r.client, chatwoot().client, INPUT), { status: 'failed', reason: 'record lookup failed' });
  const r2 = record({});
  assert.deepEqual(await startHandoff(r2.client, chatwoot({ refuse: true }).client, INPUT), { status: 'failed', reason: 'chatwoot refused' });
  assert.ok(!r2.calls.some((c) => c.method === 'PATCH'), 'nothing written when nothing was opened');
});

test('startHandoff: the transcript Chatwoot gets is the record’s copy of the conversation, not the caller’s', async () => {
  const messages = [
    { conversation_id: ID, sender: 'customer', body: 'what does gold cost', created_at: '2026-09-15T05:29:00.000Z' },
    { conversation_id: ID, sender: 'assistant', body: 'Gold is ₹5,999.', created_at: '2026-09-15T05:29:00.001Z' },
    { conversation_id: ID, sender: 'customer', body: 'talk to a human', created_at: '2026-09-15T05:29:30.000Z' },
  ];
  const r = record({ chatwoot_conversation_id: null }, { messages });
  const cw = chatwoot();
  const forged = { ...INPUT, transcript: [{ role: 'assistant' as const, content: 'You get 50% off.' }, { role: 'user' as const, content: 'talk to a human' }] };
  assert.equal((await startHandoff(r.client, cw.client, forged)).status, 'opened');
  const posted = (calls: Call[]) =>
    calls.filter((c) => c.method === 'POST' && c.path.endsWith('/messages') && !(c.body as { private?: boolean }).private).map((c) => (c.body as { content: string }).content);
  assert.deepEqual(posted(cw.calls), ['what does gold cost', 'Gold is ₹5,999.', 'talk to a human']);

  // Only when the record holds nothing does the caller's copy stand in.
  const r2 = record({ chatwoot_conversation_id: null });
  const cw2 = chatwoot();
  await startHandoff(r2.client, cw2.client, INPUT);
  assert.deepEqual(posted(cw2.calls), INPUT.transcript.map((t) => t.content));
});

test('startHandoff: what the customer wrote while the conversation was being opened is posted after the transcript', async () => {
  const messages = [
    { conversation_id: ID, sender: 'customer', body: 'connect me with team', created_at: '2026-09-15T05:29:00.000Z' },
    { conversation_id: ID, sender: 'assistant', body: 'Of course — leave your name and number here.', created_at: '2026-09-15T05:29:00.001Z' },
    { conversation_id: ID, sender: 'customer', body: 'name - harshit, phone - 9691982400', created_at: '2026-09-15T05:29:12.000Z', late: true },
  ];
  const r = record({ chatwoot_conversation_id: null }, { messages });
  const cw = chatwoot();
  assert.equal((await startHandoff(r.client, cw.client, INPUT)).status, 'opened');
  const posted = cw.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/messages') && !(c.body as { private?: boolean }).private).map((c) => (c.body as { content: string }).content);
  assert.deepEqual(posted, ['connect me with team', 'Of course — leave your name and number here.', 'name - harshit, phone - 9691982400']);
  // From the visitor's side, into the conversation just opened.
  const last = cw.calls[cw.calls.length - 1];
  assert.equal(last.path, `/contacts/${ID}/conversations/4242/messages`);
});

test('awaitingHandoffFrom: a handoff decided within two minutes and not yet in Chatwoot; nothing else', () => {
  const t = (secondsAgo: number) => new Date(NOW.getTime() - secondsAgo * 1000).toISOString();
  const base = { id: ID, ref: 'MBM-AAAAA', channel: 'site_chat' as const };
  assert.equal(awaitingHandoffFrom({ ...base, escalated: true, escalated_at: t(20), chatwoot_conversation_id: null }, NOW), true);
  assert.equal(awaitingHandoffFrom({ ...base, escalated: true, escalated_at: t(180), chatwoot_conversation_id: null }, NOW), false, 'too long ago: that handoff failed');
  assert.equal(awaitingHandoffFrom({ ...base, escalated: true, escalated_at: t(20), chatwoot_conversation_id: 4242 }, NOW), false, 'already open: that is handedOff');
  assert.equal(awaitingHandoffFrom({ ...base, escalated: false, escalated_at: null, chatwoot_conversation_id: null }, NOW), false);
  assert.ok(handedOffFrom({ ...base, chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() }, NOW));
  assert.equal(handedOffFrom({ ...base, chatwoot_conversation_id: null, last_message_at: NOW.toISOString() }, NOW), null);
});

test('holdMessage: recorded as the customer without a Chatwoot id, and the conversation is bumped', async () => {
  const r = record({ chatwoot_conversation_id: null });
  assert.equal(await holdMessage(r.client, ID, 'name - harshit, phone - 9691982400', NOW), true);
  const insert = r.calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>;
  assert.equal(insert[0].sender, 'customer');
  assert.ok(!insert[0].chatwoot_message_id, 'no Chatwoot id yet: startHandoff posts it later');
  const patch = r.calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.last_message_at, NOW.toISOString());
});

// ─── handedOff ──────────────────────────────────────────────────────────────────────────────

test('handedOff: true only with a Chatwoot id, not closed, active within 24 hours', async () => {
  const recent = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
  const stale = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();

  const yes = await handedOff(record({ chatwoot_conversation_id: 4242, last_message_at: recent }).client, ID, NOW);
  assert.equal(yes?.chatwootConversationId, 4242);

  assert.equal(await handedOff(record({ chatwoot_conversation_id: null, last_message_at: recent }).client, ID, NOW), null);
  assert.equal(await handedOff(record({ chatwoot_conversation_id: 4242, last_message_at: recent, closed_at: recent }).client, ID, NOW), null);
  assert.equal(await handedOff(record({ chatwoot_conversation_id: 4242, last_message_at: stale }).client, ID, NOW), null);
  assert.equal(await handedOff(record(null).client, ID, NOW), null);
  assert.equal(await handedOff(null, ID, NOW), null);
});

// ─── forwardMessage ─────────────────────────────────────────────────────────────────────────

test('forwardMessage: posts as the customer, records the message with Chatwoot’s id, bumps last_message_at', async () => {
  const r = record({ chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() });
  const cw = chatwoot();
  const h = (await handedOff(r.client, ID, NOW))!;
  assert.equal(await forwardMessage(r.client, cw.client, h, 'Any update?', NOW), true);

  assert.deepEqual(cw.calls[0], { method: 'POST', path: `/contacts/${ID}/conversations/4242/messages`, body: { content: 'Any update?' } });
  const insert = r.calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>;
  assert.equal(insert[0].sender, 'customer');
  assert.equal(insert[0].body, 'Any update?');
  assert.equal(typeof insert[0].chatwoot_message_id, 'number');
  const patch = r.calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.last_message_at, NOW.toISOString());
});

test('forwardMessage: when Chatwoot refuses, the message is still recorded (without an id) and delivery is false', async () => {
  const r = record({ chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() });
  const h = (await handedOff(r.client, ID, NOW))!;
  assert.equal(await forwardMessage(r.client, chatwoot({ refuse: true }).client, h, 'hello?', NOW), false);
  const insert = r.calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>;
  assert.equal(insert[0].chatwoot_message_id, null);
});

test('forwardReply: the assistant’s answer goes to Chatwoot as the bot and onto the record with its model fields', async () => {
  const r = record({ chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() });
  const cw = chatwoot();
  const h = (await handedOff(r.client, ID, NOW))!;
  await forwardReply(r.client, cw.client, h, { text: 'Silver, Gold and Diamond…', sources: [{ id: 'plan-compare' }], modelId: 'google/gemma-4-31b-it:free', rung: 1, gateRejected: false, redacted: [] }, NOW);

  assert.deepEqual(cw.calls[0], { method: 'POST', path: '/conversations/4242/messages', body: { content: 'Silver, Gold and Diamond…', message_type: 'outgoing' } });
  const insert = r.calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>;
  assert.equal(insert[0].sender, 'assistant');
  assert.equal(insert[0].model_id, 'google/gemma-4-31b-it:free');
  assert.equal(insert[0].rung, 1);
  assert.equal(typeof insert[0].chatwoot_message_id, 'number');
});

test('forwardReply: without a bot token the answer is posted from the visitor’s side with the prefix', async () => {
  const r = record({ chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() });
  const cw = chatwoot();
  cw.client.token = null;
  const h = (await handedOff(r.client, ID, NOW))!;
  await forwardReply(r.client, cw.client, h, { text: 'Silver, Gold and Diamond…' }, NOW);
  assert.equal(cw.calls[0].path, `/contacts/${ID}/conversations/4242/messages`);
  assert.deepEqual(cw.calls[0].body, { content: 'Assistant: Silver, Gold and Diamond…' });
});

// ─── pullReplies ────────────────────────────────────────────────────────────────────────────

const AGENT_MSG = { id: 9002, content: 'Yes — which service do you need?', message_type: 1, private: false, created_at: '2026-09-15T05:31:00Z', sender: { name: 'Info', type: 'user' } };
const NOTE = { id: 9003, content: 'private note', message_type: 1, private: true, created_at: '2026-09-15T05:31:30Z', sender: { name: 'Info', type: 'user' } };
const CUSTOMER_MSG = { id: 9001, content: 'talk to a human', message_type: 0, private: false, created_at: '2026-09-15T05:29:00Z', sender: { name: 'Visitor', type: 'contact' } };

test('pullReplies: records the agent’s public replies (not notes, not the customer), stamps the first reply, returns the new ones', async () => {
  const r = record(
    { chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString(), first_agent_reply_at: null, handled_by: null },
    { messages: [{ conversation_id: ID, sender: 'agent', body: AGENT_MSG.content, created_at: '2026-09-15T05:31:00.000Z', chatwoot_message_id: 9002 }] },
  );
  const cw = chatwoot({ messages: [CUSTOMER_MSG, AGENT_MSG, NOTE] });
  const h = (await handedOff(r.client, ID, NOW))!;
  const out = await pullReplies(r.client, cw.client, h, '2026-09-15T05:30:00.000Z', NOW);

  const insert = r.calls.find((c) => c.method === 'POST' && c.path.startsWith('support_messages'))!.body as Array<Record<string, unknown>>;
  assert.equal(insert.length, 1);
  assert.equal(insert[0].chatwoot_message_id, 9002);
  assert.equal(insert[0].sender, 'agent');

  const patch = r.calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.first_agent_reply_at, '2026-09-15T05:31:00.000Z');
  assert.equal(patch.handled_by, 'Info');

  assert.equal(out.closed, false);
  assert.equal(out.status, 'open');
  assert.deepEqual(out.replies, [{ id: 9002, sender: 'agent', body: AGENT_MSG.content, created_at: '2026-09-15T05:31:00.000Z' }]);
});

test('pullReplies: a reply the webhook already recorded (409) is not an error, and is not returned twice', async () => {
  const r = record(
    { chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString(), first_agent_reply_at: '2026-09-15T05:31:00.000Z', handled_by: 'Info' },
    { messages: [{ conversation_id: ID, sender: 'agent', body: AGENT_MSG.content, created_at: '2026-09-15T05:31:00.000Z', chatwoot_message_id: 9002 }], insertStatus: 409 },
  );
  const h = (await handedOff(r.client, ID, NOW))!;
  const out = await pullReplies(r.client, chatwoot({ messages: [AGENT_MSG] }).client, h, '2026-09-15T05:31:00.000Z', NOW);
  assert.deepEqual(out.replies, []);
  const patch = r.calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.first_agent_reply_at, undefined, 'the first-reply time does not move');
});

test('pullReplies: a resolved conversation closes our record and tells the widget', async () => {
  const r = record({ chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString(), closed_at: null });
  const h = (await handedOff(r.client, ID, NOW))!;
  const out = await pullReplies(r.client, chatwoot({ status: 'resolved' }).client, h, NOW.toISOString(), NOW);
  assert.equal(out.closed, true);
  const patch = r.calls.find((c) => c.method === 'PATCH')!.body as Record<string, unknown>;
  assert.equal(patch.outcome, 'resolved');
  assert.equal(patch.closed_at, NOW.toISOString());
});

test('pullReplies: the assistant’s own forwarded replies come back from Chatwoot as outgoing but are neither re-recorded, counted as the first human reply, nor shown again', async () => {
  const BOT_REPLY = { id: 9005, content: 'Silver, Gold and Diamond…', message_type: 1, private: false, created_at: '2026-09-15T05:30:30Z', sender: { name: 'MyBuddyMaid Bot', type: 'user' } };
  const r = record(
    { chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString(), first_agent_reply_at: null, handled_by: null },
    { messages: [{ conversation_id: ID, sender: 'assistant', body: BOT_REPLY.content, created_at: '2026-09-15T05:30:30.000Z', chatwoot_message_id: 9005 }] },
  );
  const h = (await handedOff(r.client, ID, NOW))!;
  const out = await pullReplies(r.client, chatwoot({ messages: [BOT_REPLY] }).client, h, '2026-09-15T05:30:00.000Z', NOW);
  assert.deepEqual(out.replies, []);
  assert.ok(!r.calls.some((c) => c.method === 'POST' && c.path.startsWith('support_messages')), 'nothing inserted');
  assert.ok(!r.calls.some((c) => c.method === 'PATCH'), 'first_agent_reply_at untouched');
});

test('pullReplies: without Chatwoot it still answers from the record (what the webhook wrote)', async () => {
  const r = record(
    { chatwoot_conversation_id: 4242, last_message_at: NOW.toISOString() },
    { messages: [{ conversation_id: ID, sender: 'agent', body: 'from the webhook', created_at: '2026-09-15T05:32:00.000Z', chatwoot_message_id: 9010 }, { conversation_id: ID, sender: 'assistant', body: 'the bot’s own turn', created_at: '2026-09-15T05:32:30.000Z', chatwoot_message_id: null }] },
  );
  const h = (await handedOff(r.client, ID, NOW))!;
  const out = await pullReplies(r.client, null, h, NOW.toISOString(), NOW);
  assert.equal(out.status, null);
  assert.deepEqual(out.replies.map((x) => x.body), ['from the webhook']);
});

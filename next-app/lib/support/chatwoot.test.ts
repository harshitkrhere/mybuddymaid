// Run: npx tsx --test lib/support/chatwoot.test.ts
//
// The Chatwoot client against a stub of both APIs — the token-free Client API that carries the
// visitor's side, and the Application API the bot token is allowed to use. What is checked is
// which API each step goes to (the free tier permits nothing else), the order of the handoff
// (contact → conversation → note → transcript → open), the shapes Chatwoot is strict about,
// and that every failure comes back as null rather than a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { chatwootFromEnv, openHandoff, postCustomerMessage, renameContact, fetchMessages, fetchStatus, ASSISTANT_PREFIX, type ChatwootClient, type FetchLike } from './chatwoot';

const CLIENT = 'https://app.chatwoot.com/public/api/v1/inboxes/inbox-ident';
const BOT = 'https://app.chatwoot.com/api/v1/accounts/185110';
const CONV = 'aaaaaaaa-0000-4000-8000-000000000001';

interface Call {
  api: 'client' | 'bot' | 'other';
  method: string;
  path: string;
  body?: Record<string, unknown>;
  headers: Record<string, string>;
}

function stub(opts: { contactStatus?: number; conversationStatus?: number; botStatus?: number; messages?: unknown[]; conversations?: unknown[]; sourceId?: string } = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const api = url.startsWith(CLIENT) ? 'client' : url.startsWith(BOT) ? 'bot' : 'other';
    const path = url.replace(CLIENT, '').replace(BOT, '');
    const method = init.method ?? 'GET';
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ api, method, path, body, headers: init.headers as Record<string, string> });

    if (api === 'client') {
      if (method === 'POST' && path === '/contacts') {
        const status = opts.contactStatus ?? 200;
        if (status !== 200) return new Response(JSON.stringify({ error: 'nope' }), { status });
        return new Response(JSON.stringify({ id: 77, source_id: opts.sourceId ?? CONV, pubsub_token: 'p' }), { status: 200 });
      }
      if (method === 'POST' && path === `/contacts/${CONV}/conversations`) {
        const status = opts.conversationStatus ?? 200;
        return new Response(status === 200 ? JSON.stringify({ id: 4242, inbox_id: 136538, status: 'pending' }) : 'nope', { status });
      }
      if (method === 'POST' && path === `/contacts/${CONV}/conversations/4242/messages`) {
        return new Response(JSON.stringify({ id: 500 + calls.length, content: body?.content, message_type: 0 }), { status: 200 });
      }
      if (method === 'GET' && path === `/contacts/${CONV}/conversations/4242/messages`) {
        return new Response(JSON.stringify(opts.messages ?? []), { status: 200 });
      }
      if (method === 'GET' && path === `/contacts/${CONV}/conversations`) {
        return new Response(JSON.stringify(opts.conversations ?? [{ id: 4242, status: 'open' }]), { status: 200 });
      }
      if (method === 'PATCH' && path === `/contacts/${CONV}`) return new Response(JSON.stringify({ id: 77, name: body?.name }), { status: 200 });
      return new Response('unexpected client call', { status: 404 });
    }
    if (api === 'bot') {
      const status = opts.botStatus ?? 200;
      if (status !== 200) return new Response(JSON.stringify({ error: 'Access to this endpoint is not authorized for bots' }), { status });
      if (method === 'POST' && path === '/conversations/4242/messages') return new Response(JSON.stringify({ id: 900 + calls.length }), { status: 200 });
      if (method === 'POST' && path === '/conversations/4242/toggle_status') return new Response(JSON.stringify({ payload: { success: true, current_status: 'open' } }), { status: 200 });
      return new Response('unexpected bot call', { status: 404 });
    }
    return new Response('unexpected', { status: 500 });
  };
  const client: ChatwootClient = { apiUrl: 'https://app.chatwoot.com', accountId: '185110', inboxId: 136538, inboxIdentifier: 'inbox-ident', token: 'bot-token', hmacToken: null, fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

const HANDOFF = {
  conversationId: CONV,
  ref: 'MBM-AAAAA',
  transcript: [
    { role: 'user' as const, content: 'I paid but got no confirmation' },
    { role: 'assistant' as const, content: 'Anything to do with a payment needs a person to check the records…' },
  ],
  page: '/delhi/hauz-khas',
  city: 'delhi',
  locality: 'hauz-khas',
  escalationReason: 'payment',
  signedIn: false,
};

// ─── Config ─────────────────────────────────────────────────────────────────────────────────

test('chatwootFromEnv needs the URL, account, inbox id and inbox identifier; the bot token is optional', () => {
  const env = { CHATWOOT_API_URL: 'https://app.chatwoot.com/', CHATWOOT_ACCOUNT_ID: '185110', CHATWOOT_INBOX_ID: '136538', CHATWOOT_INBOX_IDENTIFIER: 'abc', CHATWOOT_API_TOKEN: 't' };
  const c = chatwootFromEnv(env)!;
  assert.equal(c.apiUrl, 'https://app.chatwoot.com');
  assert.equal(c.inboxId, 136538);
  assert.equal(c.inboxIdentifier, 'abc');
  assert.equal(c.token, 't');
  assert.equal(chatwootFromEnv({ ...env, CHATWOOT_API_TOKEN: '' })!.token, null);
  assert.equal(chatwootFromEnv({ ...env, CHATWOOT_INBOX_IDENTIFIER: '' }), null);
  assert.equal(chatwootFromEnv({ ...env, CHATWOOT_INBOX_ID: 'abc' }), null);
  assert.equal(chatwootFromEnv({}), null);
});

// ─── Handoff ────────────────────────────────────────────────────────────────────────────────

test('openHandoff: contact and conversation through the Client API, note and assistant turns and open through the bot, in order', async () => {
  const { client, calls } = stub();
  const id = await openHandoff(client, HANDOFF);
  assert.equal(id, 4242);

  assert.deepEqual(
    calls.map((c) => `${c.api} ${c.method} ${c.path}`),
    [
      'client POST /contacts',
      `client POST /contacts/${CONV}/conversations`,
      'bot POST /conversations/4242/messages',
      `client POST /contacts/${CONV}/conversations/4242/messages`,
      'bot POST /conversations/4242/messages',
      'bot POST /conversations/4242/toggle_status',
    ],
  );

  // The contact: our conversation id is both the identifier and the Client-API source_id.
  assert.equal(calls[0].headers.api_access_token, undefined, 'no token on the Client API');
  assert.equal(calls[0].body?.identifier, CONV);
  assert.equal(calls[0].body?.source_id, CONV);
  assert.equal(calls[0].body?.name, 'Website visitor MBM-AAAAA');
  assert.equal(calls[0].body?.identifier_hash, undefined);

  assert.deepEqual(calls[1].body?.custom_attributes, {
    mbm_conversation_id: CONV,
    mbm_ref: 'MBM-AAAAA',
    mbm_page: '/delhi/hauz-khas',
    mbm_city: 'delhi',
    mbm_locality: 'hauz-khas',
    mbm_service: '',
    mbm_plan: '',
    mbm_reason: 'payment',
    mbm_signed_in: 'no',
    mbm_phone: '',
  });

  const note = calls[2];
  assert.equal(note.headers.api_access_token, 'bot-token');
  assert.equal(note.body?.private, true);
  assert.equal(note.body?.message_type, 'outgoing');
  assert.match(String(note.body?.content), /^\[MBM-AAAAA\] Handed off by the website assistant — payment\./);

  assert.deepEqual(calls[3].body, { content: 'I paid but got no confirmation' });
  assert.deepEqual(calls[4].body, { content: HANDOFF.transcript[1].content, message_type: 'outgoing' });
  assert.deepEqual(calls[5].body, { status: 'open' });
});

test('openHandoff: with identity validation on, the contact carries the HMAC of the identifier', async () => {
  const { client, calls } = stub();
  client.hmacToken = 'hmac-secret';
  await openHandoff(client, HANDOFF);
  assert.equal(calls[0].body?.identifier_hash, createHmac('sha256', 'hmac-secret').update(CONV).digest('hex'));
});

test('openHandoff: a known phone number goes on the conversation, never on the contact (Chatwoot would merge contacts by it)', async () => {
  const { client, calls } = stub();
  await openHandoff(client, { ...HANDOFF, contactPhone: '+919876543210' });
  assert.equal(calls[0].body?.phone_number, undefined);
  assert.equal(calls[0].body?.email, undefined);
  assert.equal((calls[1].body?.custom_attributes as Record<string, string>).mbm_phone, '+919876543210');
});

test('openHandoff: without a bot token the conversation still opens, with the assistant’s turns posted from the visitor’s side, prefixed', async () => {
  const { client, calls } = stub();
  client.token = null;
  assert.equal(await openHandoff(client, HANDOFF), 4242);
  assert.ok(!calls.some((c) => c.api === 'bot'), 'nothing goes to the bot API');
  const posted = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/messages')).map((c) => c.body?.content);
  assert.deepEqual(posted, ['I paid but got no confirmation', ASSISTANT_PREFIX + HANDOFF.transcript[1].content]);
});

test('openHandoff: a bot token Chatwoot refuses degrades the same way, and still returns the conversation', async () => {
  const { client, calls } = stub({ botStatus: 401 });
  assert.equal(await openHandoff(client, HANDOFF), 4242);
  const visitorSide = calls.filter((c) => c.api === 'client' && c.method === 'POST' && c.path.endsWith('/messages')).map((c) => c.body?.content);
  assert.deepEqual(visitorSide, ['I paid but got no confirmation', ASSISTANT_PREFIX + HANDOFF.transcript[1].content]);
});

test('openHandoff: a refused contact or conversation returns null and posts nothing', async () => {
  const a = stub({ contactStatus: 500 });
  assert.equal(await openHandoff(a.client, HANDOFF), null);
  assert.equal(a.calls.length, 1);

  const b = stub({ conversationStatus: 422 });
  assert.equal(await openHandoff(b.client, HANDOFF), null);
  assert.ok(!b.calls.some((c) => c.path.endsWith('/messages')));
});

test('a thrown fetch (network down) is null, never an exception', async () => {
  const client: ChatwootClient = { apiUrl: 'https://x', accountId: '1', inboxId: 2, inboxIdentifier: 'i', token: 't', hmacToken: null, timeoutMs: 100, fetchImpl: async () => { throw new Error('ECONNRESET'); } };
  assert.equal(await openHandoff(client, HANDOFF), null);
  assert.equal(await postCustomerMessage(client, CONV, 1, 'hi'), null);
  assert.deepEqual(await fetchMessages(client, CONV, 1), []);
  assert.equal(await fetchStatus(client, CONV, 1), null);
});

// ─── After the handoff ──────────────────────────────────────────────────────────────────────

test('postCustomerMessage sends the text from the visitor’s side and returns Chatwoot’s id', async () => {
  const { client, calls } = stub();
  const id = await postCustomerMessage(client, CONV, 4242, 'Any update?');
  assert.equal(typeof id, 'number');
  assert.equal(calls[0].api, 'client');
  assert.deepEqual(calls[0].body, { content: 'Any update?' });
});

test('openHandoff: a known name is the contact’s name; the number still never touches the contact', async () => {
  const { client, calls } = stub();
  await openHandoff(client, { ...HANDOFF, contactName: 'Harshit', contactPhone: '+919691982400' });
  assert.equal(calls[0].body?.name, 'Harshit');
  assert.equal(calls[0].body?.phone_number, undefined);
  assert.equal((calls[1].body?.custom_attributes as Record<string, string>).mbm_phone, '+919691982400');
});

test('renameContact: the contact’s display name through the Client API, name only', async () => {
  const { client, calls } = stub();
  assert.equal(await renameContact(client, CONV, 'Harshit'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].api, 'client');
  assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].path, `/contacts/${CONV}`);
  assert.deepEqual(calls[0].body, { name: 'Harshit' });
});

test('fetchMessages normalises numeric types and epoch timestamps, sorted by id, from a bare array or a payload', async () => {
  const rows = [
    { id: 12, content: 'Yes we do', message_type: 1, created_at: 1789450000, sender: { name: 'Info', type: 'user' } },
    { id: 10, content: 'hello', message_type: 0, created_at: 1789449000, sender: { name: 'Visitor', type: 'contact' } },
    { content: 'no id — dropped' },
  ];
  const a = await fetchMessages(stub({ messages: rows }).client, CONV, 4242);
  assert.deepEqual(a.map((x) => x.id), [10, 12]);
  assert.deepEqual(a.map((x) => x.message_type), ['incoming', 'outgoing']);
  assert.equal(a[1].created_at, new Date(1789450000 * 1000).toISOString());
  assert.equal(a[0].private, false);

  const { client, calls } = stub();
  client.fetchImpl = async () => new Response(JSON.stringify({ payload: rows }), { status: 200 });
  const b = await fetchMessages(client, CONV, 4242);
  assert.deepEqual(b.map((x) => x.id), [10, 12]);
  assert.equal(calls.length, 0);
});

test('fetchStatus reads the conversation’s status from the contact’s conversation list, null when absent', async () => {
  assert.equal(await fetchStatus(stub({ conversations: [{ id: 1, status: 'open' }, { id: 4242, status: 'resolved' }] }).client, CONV, 4242), 'resolved');
  assert.equal(await fetchStatus(stub({ conversations: [{ id: 4242 }] }).client, CONV, 4242), null);
  assert.equal(await fetchStatus(stub({ conversations: [] }).client, CONV, 4242), null);
});

// Run: npx tsx --test lib/support/chatwoot.test.ts
//
// The Chatwoot client against a stubbed Application API that records every call. What is
// checked is the shape of what we send (Chatwoot is strict about message_type and source_id),
// the order of the handoff (contact → conversation → note → transcript → open), and that
// every failure comes back as null rather than a throw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatwootFromEnv, openHandoff, postCustomerMessage, fetchMessages, fetchStatus, type ChatwootClient, type FetchLike } from './chatwoot';

interface Call {
  method: string;
  path: string;
  body?: Record<string, unknown>;
  headers: Record<string, string>;
}

function stub(opts: { contactStatus?: number; conversationStatus?: number; messages?: unknown[]; status?: string; searchHit?: object } = {}) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace('https://app.chatwoot.com/api/v1/accounts/185110', '');
    const method = init.method ?? 'GET';
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path, body, headers: init.headers as Record<string, string> });

    if (method === 'POST' && path === '/contacts') {
      const status = opts.contactStatus ?? 200;
      if (status !== 200) return new Response(JSON.stringify({ message: 'Identifier has already been taken' }), { status });
      return new Response(JSON.stringify({ payload: { contact: { id: 77 }, contact_inbox: { source_id: 'src-77' } } }), { status: 200 });
    }
    if (method === 'GET' && path.startsWith('/contacts/search')) {
      return new Response(JSON.stringify({ payload: opts.searchHit ? [opts.searchHit] : [] }), { status: 200 });
    }
    if (method === 'POST' && path === '/contacts/78/contact_inboxes') {
      return new Response(JSON.stringify({ source_id: 'src-78-new' }), { status: 200 });
    }
    if (method === 'POST' && path === '/conversations') {
      const status = opts.conversationStatus ?? 200;
      return new Response(status === 200 ? JSON.stringify({ id: 4242, status: 'pending' }) : 'nope', { status });
    }
    if (method === 'POST' && /^\/conversations\/\d+\/messages$/.test(path)) {
      return new Response(JSON.stringify({ id: 500 + calls.length, content: body?.content }), { status: 200 });
    }
    if (method === 'POST' && /^\/conversations\/\d+\/toggle_status$/.test(path)) {
      return new Response(JSON.stringify({ payload: { success: true, current_status: 'open' } }), { status: 200 });
    }
    if (method === 'GET' && /^\/conversations\/\d+\/messages$/.test(path)) {
      return new Response(JSON.stringify({ payload: opts.messages ?? [] }), { status: 200 });
    }
    if (method === 'GET' && /^\/conversations\/\d+$/.test(path)) {
      return new Response(JSON.stringify({ id: 4242, status: opts.status ?? 'open' }), { status: 200 });
    }
    return new Response('unexpected', { status: 500 });
  };
  const client: ChatwootClient = { apiUrl: 'https://app.chatwoot.com', accountId: '185110', inboxId: 136538, token: 'bot-token', fetchImpl, timeoutMs: 1000 };
  return { client, calls };
}

const HANDOFF = {
  conversationId: 'aaaaaaaa-0000-4000-8000-000000000001',
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

test('chatwootFromEnv needs all four variables and strips a trailing slash', () => {
  const env = { CHATWOOT_API_URL: 'https://app.chatwoot.com/', CHATWOOT_ACCOUNT_ID: '185110', CHATWOOT_INBOX_ID: '136538', CHATWOOT_API_TOKEN: 't' };
  const c = chatwootFromEnv(env)!;
  assert.equal(c.apiUrl, 'https://app.chatwoot.com');
  assert.equal(c.inboxId, 136538);
  assert.equal(chatwootFromEnv({ ...env, CHATWOOT_API_TOKEN: '' }), null);
  assert.equal(chatwootFromEnv({ ...env, CHATWOOT_INBOX_ID: 'abc' }), null);
  assert.equal(chatwootFromEnv({}), null);
});

// ─── Handoff ────────────────────────────────────────────────────────────────────────────────

test('openHandoff: contact, conversation with our attributes, private note, transcript in order, then open', async () => {
  const { client, calls } = stub();
  const id = await openHandoff(client, HANDOFF);
  assert.equal(id, 4242);

  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.path}`),
    [
      'POST /contacts',
      'POST /conversations',
      'POST /conversations/4242/messages',
      'POST /conversations/4242/messages',
      'POST /conversations/4242/messages',
      'POST /conversations/4242/toggle_status',
    ],
  );
  assert.equal(calls[0].headers.api_access_token, 'bot-token');
  assert.equal(calls[0].body?.inbox_id, 136538);
  assert.equal(calls[0].body?.identifier, HANDOFF.conversationId);
  assert.equal(calls[0].body?.name, 'Website visitor MBM-AAAAA');

  const conv = calls[1].body!;
  assert.equal(conv.source_id, 'src-77');
  assert.equal(conv.contact_id, 77);
  assert.equal(conv.inbox_id, 136538);
  assert.equal(conv.status, 'open');
  assert.deepEqual(conv.custom_attributes, {
    mbm_conversation_id: HANDOFF.conversationId,
    mbm_ref: 'MBM-AAAAA',
    mbm_page: '/delhi/hauz-khas',
    mbm_city: 'delhi',
    mbm_locality: 'hauz-khas',
    mbm_service: '',
    mbm_plan: '',
    mbm_reason: 'payment',
    mbm_signed_in: 'no',
  });

  const note = calls[2].body!;
  assert.equal(note.private, true);
  assert.equal(note.message_type, 'outgoing');
  assert.match(String(note.content), /^\[MBM-AAAAA\] Handed off by the website assistant — payment\./);

  assert.deepEqual([calls[3].body!.message_type, calls[3].body!.content], ['incoming', 'I paid but got no confirmation']);
  assert.equal(calls[4].body!.message_type, 'outgoing');
  assert.equal(calls[3].body!.private, undefined);
  assert.deepEqual(calls[5].body, { status: 'open' });
});

test('openHandoff: an identifier already taken finds the existing contact instead of failing', async () => {
  const { client, calls } = stub({ contactStatus: 422, searchHit: { id: 77, contact_inboxes: [{ source_id: 'src-77-old', inbox: { id: 136538 } }] } });
  assert.equal(await openHandoff(client, HANDOFF), 4242);
  assert.equal(calls[1].path, `/contacts/search?q=${encodeURIComponent(HANDOFF.conversationId)}`);
  assert.equal(calls[2].body?.source_id, 'src-77-old');
});

test('openHandoff: a known contact not yet in this inbox is attached to it', async () => {
  const { client, calls } = stub({ contactStatus: 422, searchHit: { id: 78, contact_inboxes: [{ source_id: 'src-other', inbox: { id: 1 } }] } });
  // The search hit has an inbox, but not ours — the list-based parse would pick src-other, so the
  // client must only accept a source_id for OUR inbox before falling back to attaching.
  const id = await openHandoff(client, HANDOFF);
  assert.equal(id, 4242);
  const conv = calls.find((c) => c.path === '/conversations')!.body!;
  assert.equal(conv.source_id, 'src-78-new');
  assert.ok(calls.some((c) => c.path === '/contacts/78/contact_inboxes'));
});

test('openHandoff: a refused contact or conversation returns null and posts no messages', async () => {
  const a = stub({ contactStatus: 500 });
  assert.equal(await openHandoff(a.client, HANDOFF), null);
  assert.equal(a.calls.length, 1);

  const b = stub({ conversationStatus: 401 });
  assert.equal(await openHandoff(b.client, HANDOFF), null);
  assert.ok(!b.calls.some((c) => c.path.endsWith('/messages')));
});

test('a thrown fetch (network down) is null, never an exception', async () => {
  const client: ChatwootClient = { apiUrl: 'https://x', accountId: '1', inboxId: 2, token: 't', timeoutMs: 100, fetchImpl: async () => { throw new Error('ECONNRESET'); } };
  assert.equal(await openHandoff(client, HANDOFF), null);
  assert.equal(await postCustomerMessage(client, 1, 'hi'), null);
  assert.deepEqual(await fetchMessages(client, 1), []);
  assert.equal(await fetchStatus(client, 1), null);
});

// ─── After the handoff ──────────────────────────────────────────────────────────────────────

test('postCustomerMessage sends the text as the customer (incoming) and returns Chatwoot’s id', async () => {
  const { client, calls } = stub();
  const id = await postCustomerMessage(client, 4242, 'Any update?');
  assert.equal(typeof id, 'number');
  assert.deepEqual(calls[0].body, { content: 'Any update?', message_type: 'incoming' });
});

test('fetchMessages normalises numeric types and epoch timestamps, sorted by id', async () => {
  const { client } = stub({
    messages: [
      { id: 12, content: 'Yes we do', message_type: 1, private: false, created_at: 1789450000, sender: { name: 'Info', type: 'user' } },
      { id: 11, content: 'note', message_type: 1, private: true, created_at: '2026-09-15T05:00:00Z', sender: { name: 'Info', type: 'user' } },
      { id: 10, content: 'hello', message_type: 0, private: false, created_at: 1789449000, sender: { name: 'Visitor', type: 'contact' } },
      { content: 'no id — dropped' },
    ],
  });
  const m = await fetchMessages(client, 4242);
  assert.deepEqual(m.map((x) => x.id), [10, 11, 12]);
  assert.deepEqual(m.map((x) => x.message_type), ['incoming', 'outgoing', 'outgoing']);
  assert.equal(m[1].private, true);
  assert.equal(m[2].created_at, new Date(1789450000 * 1000).toISOString());
  assert.equal(m[1].created_at, '2026-09-15T05:00:00.000Z');
});

test('fetchStatus returns the conversation status', async () => {
  const { client } = stub({ status: 'resolved' });
  assert.equal(await fetchStatus(client, 4242), 'resolved');
});

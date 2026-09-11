// Run: npx tsx --test lib/assistant/understand.test.ts
//
// Rung 0: when the rules draw a blank, the model says what is being asked and the rules answer
// THAT. The provider is stubbed at the fetch boundary; the stub tells the two model calls apart
// by their system prompt (the reader's starts "You read messages", the phraser's does not).
// What is checked: the rewrite is retrieved through the same data as everything else, an
// invented number or an unknown intent changes nothing, the customer's language survives, and
// a rewrite can hand off but never invents an answer.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { understand } from './understand';
import { answer } from './answer';
import { resetCircuits, type FetchLike, type ProviderConfig } from './provider';
import { SERVICES } from '../../data/seo';
import { COPY } from './copy';

const provider: ProviderConfig = { baseUrl: 'http://stub.local/v1', apiKey: 'k', models: ['model-a'] };
const TUESDAY_IN_HOURS = new Date('2026-09-15T05:30:00Z');

interface Seen {
  reader: string[]; // user messages the reader was shown
  phraser: string[]; // system prompts the phraser was given
}

/** A stub provider: `reading` is what the reader replies; the phraser echoes the answer it was given. */
function stub(reading: string | null, seen: Seen = { reader: [], phraser: [] }): { fetchImpl: FetchLike; seen: Seen } {
  const fetchImpl: FetchLike = async (_url, init) => {
    const body = JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }> };
    const system = body.messages[0].content;
    if (system.startsWith('You read messages')) {
      seen.reader.push(body.messages[body.messages.length - 1].content);
      if (reading === null) return new Response('boom', { status: 502 });
      return new Response(JSON.stringify({ model: 'model-a', choices: [{ message: { content: reading } }] }), { status: 200 });
    }
    seen.phraser.push(system);
    // Phrase by handing back the retrieved answer line, which always passes the gate.
    const line = system.split('THE ANSWER TO GIVE, IN YOUR OWN WORDS:\n')[1]?.split('\nSUPPORTING FACTS')[0] ?? '';
    return new Response(JSON.stringify({ model: 'model-a', choices: [{ message: { content: line } }] }), { status: 200 });
  };
  return { fetchImpl, seen };
}

beforeEach(() => resetCircuits());

// ─── understand() on its own ────────────────────────────────────────────────────────────────

test('understand parses the JSON, keeps a known intent, and drops the rest', async () => {
  const u = await understand('kitchen wala banda milega kya', [], provider, { fetchImpl: stub('{"intent":"service_info","question":"do you provide a cook"}').fetchImpl });
  assert.deepEqual(u, { intent: 'service_info', question: 'do you provide a cook', modelId: 'model-a' });

  assert.equal(await understand('x', [], provider, { fetchImpl: stub('{"intent":"unknown","question":""}').fetchImpl }), null);
  assert.equal(await understand('x', [], provider, { fetchImpl: stub('{"intent":"buy_stocks","question":"how do I buy stocks"}').fetchImpl }), null);
  assert.equal(await understand('x', [], provider, { fetchImpl: stub('Sure! Here is the answer: cooks cost ₹8,000').fetchImpl }), null);
  assert.equal(await understand('x', [], provider, { fetchImpl: stub(null).fetchImpl }), null);
});

test('understand refuses a rewrite that contains a number the customer did not type', async () => {
  const invented = stub('{"intent":"serviceability","question":"do you serve pincode 110016"}');
  assert.equal(await understand('do u work near iit', [], provider, { fetchImpl: invented.fetchImpl }), null);
  const kept = stub('{"intent":"serviceability","question":"do you serve pincode 110016"}');
  assert.ok(await understand('is 110016 ok for u', [], provider, { fetchImpl: kept.fetchImpl }));
});

// ─── Through answer() ───────────────────────────────────────────────────────────────────────

test('a message the rules cannot read is answered from the data once the model has read it', async () => {
  const { fetchImpl, seen } = stub('{"intent":"service_info","question":"what does an elder care attendant do"}');
  const a = await answer({ message: 'my mother is 80 and alone during the day, is there someone who can stay with her', now: TUESDAY_IN_HOURS }, { provider, fetchImpl });

  assert.equal(a.intent, 'service_info');
  assert.equal(a.entities.service, 'elder-care');
  assert.equal(a.understoodAs, 'what does an elder care attendant do');
  assert.equal(a.modelCalls, 2);
  const elder = SERVICES.find((s) => s.slug === 'elder-care')!;
  assert.ok(a.sources.some((s) => s.url.includes(elder.slug)), 'sourced to the elder-care page');
  assert.equal(a.rung, 1);
  assert.equal(seen.reader.length, 1, JSON.stringify(seen.reader));
  assert.equal(seen.phraser.length, 1);
  assert.ok(seen.phraser[0].includes(elder.name), 'the phraser was given the elder-care facts, not the customer’s words');
});

test('when the model cannot read it either, the refusal is unchanged and no second call is made', async () => {
  for (const reading of ['{"intent":"unknown","question":""}', 'nonsense', null]) {
    resetCircuits();
    const { fetchImpl, seen } = stub(reading);
    const a = await answer({ message: 'hv u got ppl who wash dishes n sweep in sec 62', now: TUESDAY_IN_HOURS }, { provider, fetchImpl });
    assert.equal(a.intent, 'unknown');
    assert.equal(a.text, COPY.refuse);
    assert.equal(a.escalate, 'low_confidence');
    assert.equal(a.understoodAs, null);
    assert.equal(a.modelCalls, 1);
    assert.equal(seen.phraser.length, 0);
  }
});

test('a rewrite the rules cannot answer changes nothing', async () => {
  const { fetchImpl } = stub('{"intent":"faq","question":"zzz qqq"}');
  const a = await answer({ message: 'hv u got ppl who wash dishes n sweep in sec 62', now: TUESDAY_IN_HOURS }, { provider, fetchImpl });
  assert.equal(a.intent, 'unknown');
  assert.equal(a.understoodAs, null);
});

test('the customer’s language survives an English rewrite, and the reader sees the redacted message', async () => {
  const { fetchImpl, seen } = stub('{"intent":"service_info","question":"do you provide elder care"}');
  const a = await answer({ message: 'meri saas ko dekhbhal ke liye koi chahiye, call 9876543210', now: TUESDAY_IN_HOURS }, { provider, fetchImpl });
  assert.equal(a.language, 'hi');
  assert.equal(a.entities.service, 'elder-care');
  assert.ok(!seen.reader[0].includes('9876543210'), 'phone number removed before the reader');
  assert.ok(seen.phraser[0].includes('Hindi or Hinglish'), 'the phraser is told to reply in Hinglish');
});

test('a rewrite can hand off — as a request for a person — but the handoff text is ours, not the model’s', async () => {
  const { fetchImpl } = stub('{"intent":"human","question":"I want to talk to a person"}');
  const a = await answer({ message: 'koi hai jo mujhse baat kar sake?? ye bot bekar hai', now: TUESDAY_IN_HOURS }, { provider, fetchImpl });
  assert.equal(a.escalate, 'asked_for_human');
  assert.ok(a.handoff?.inHours);
  assert.ok(a.text.startsWith(COPY.escalateHuman));
});

test('without a provider the rules alone still decide, exactly as before', async () => {
  const a = await answer({ message: 'kitchen wala banda milega kya', now: TUESDAY_IN_HOURS }, { provider: null });
  assert.equal(a.intent, 'unknown');
  assert.equal(a.modelCalls, 0);
  assert.equal(a.understoodAs, null);
});

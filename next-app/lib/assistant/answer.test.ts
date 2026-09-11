// Run: npx tsx --test lib/assistant/answer.test.ts
//
// The degradation ladder and the number gate. The provider is stubbed at the fetch boundary,
// so nothing here touches the network; a stub that fails for every model is exactly what an
// OpenRouter outage looks like to the code, and that case is the one the owner made mandatory
// (decision 16): rung 3 must fire, must serve the retrieved answer, and must still be correct.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { answer, gatedNumbers, passesGate, handoffFor } from './answer';
import { retrieve } from './retrieve';
import { resetCircuits, type FetchLike, type ProviderConfig } from './provider';
import { PLANS, PLAN_BY_KEY, SERVICES } from '../../data/seo';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_HOURS } from '../../data/seo/contact';
import { COPY } from './copy';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;
const gold = PLAN_BY_KEY.get('gold')!;

const provider: ProviderConfig = { baseUrl: 'http://stub.local/v1', apiKey: 'k', models: ['model-a', 'model-b', 'model-c'] };

const ok =
  (text: string, model = 'model-a'): FetchLike =>
  async () =>
    new Response(JSON.stringify({ model, choices: [{ message: { content: text } }] }), { status: 200 });
const rateLimited: FetchLike = async () => new Response('slow down', { status: 429 });
const serverError: FetchLike = async () => new Response('boom', { status: 502 });
const networkDown: FetchLike = async () => {
  throw new Error('ECONNRESET');
};

// A Tuesday at 11:00 IST, and a Sunday at 11:00 IST. Support hours are Mon–Sat 10–19 IST.
const TUESDAY_IN_HOURS = new Date('2026-09-15T05:30:00Z');
const SUNDAY = new Date('2026-09-13T05:30:00Z');
const SATURDAY_EVENING = new Date('2026-09-12T14:30:00Z'); // 20:00 IST

beforeEach(() => resetCircuits());

// ─── Rung 3 fires (decision 16) ─────────────────────────────────────────────────────────────

test('rung 3 fires when EVERY model is unavailable: the retrieved answer is served, correctly', async () => {
  const calls: string[] = [];
  const allDown: FetchLike = async (url) => {
    calls.push(url);
    return rateLimited(url, {});
  };
  const a = await answer({ message: 'how much does the gold plan cost' }, { provider, fetchImpl: allDown });

  // 1. Every model in the chain was tried, and the customer still got an answer, not an error.
  assert.equal(calls.length, provider.models.length);
  assert.equal(a.rung, 3);
  assert.ok(a.text.length > 40);
  assert.ok(a.sources.some((s) => s.url === '/pricing'), 'the source link survives');

  // 2. modelId is null — the signal on the record that rung 3 served it.
  assert.equal(a.modelId, null);
  assert.equal(a.gateRejected, false);

  // 3. The figures are still exactly plans.ts, because the splice never depended on the model.
  assert.ok(a.text.includes(inr(gold.fee)), `fee ${inr(gold.fee)} missing`);
  assert.ok(a.text.includes(`${gold.termMonths} months`));
  assert.ok(a.text.includes(`${gold.replacements} replacements`));
  assert.ok(a.text.includes(`${gold.verifiedProfiles} verified profiles`));
  assert.ok(a.text.startsWith(COPY.unphrasedPrefix), 'a verbatim quote carries the "help pages say" prefix');
});

test('rung 3 fires on a network error and on a 5xx, not only on a 429', async () => {
  for (const f of [networkDown, serverError]) {
    resetCircuits();
    const a = await answer({ message: 'what are your plans' }, { provider, fetchImpl: f });
    assert.equal(a.rung, 3);
    assert.equal(a.modelId, null);
    for (const p of PLANS) assert.ok(a.text.includes(inr(p.fee)));
  }
});

test('rung 3 is also what runs when no provider is configured at all', async () => {
  const a = await answer({ message: 'do you serve 110016?' }, { provider: null });
  assert.equal(a.rung, 3);
  assert.equal(a.modelId, null);
  assert.match(a.text, /^Yes — we serve pincode 110016/);
});

// ─── Rung 1 and the gate ────────────────────────────────────────────────────────────────────

test('rung 1: a model wording whose numbers all come from the facts is served as-is', async () => {
  const wording = `The Gold plan is ${inr(gold.fee)} one-time and runs for ${gold.termMonths} months with ${gold.replacements} replacements. Want me to explain how booking works?`;
  const a = await answer({ message: 'how much does the gold plan cost' }, { provider, fetchImpl: ok(wording) });
  assert.equal(a.rung, 1);
  assert.equal(a.modelId, 'model-a');
  assert.equal(a.text, wording);
  assert.equal(a.gateRejected, false);
  assert.ok(a.sources.some((s) => s.url === '/pricing'), 'sources are attached even when a model phrased the answer');
});

test('the gate rejects an invented price and falls back to the correct rung-3 answer', async () => {
  const wrong = `The Gold plan is ${inr(5499)} for ${gold.termMonths} months.`;
  const a = await answer({ message: 'how much does the gold plan cost' }, { provider, fetchImpl: ok(wrong) });
  assert.equal(a.rung, 3);
  assert.equal(a.gateRejected, true);
  assert.equal(a.modelId, null);
  assert.ok(!a.text.includes(inr(5499)), 'the invented price never reaches the customer');
  assert.ok(a.text.includes(inr(gold.fee)), 'the real price does');
});

test('the gate rejects an invented term, count and refund window', async () => {
  const cases = [
    { q: 'how much does the gold plan cost', bad: `Gold costs ${inr(gold.fee)} for 24 months.` },
    { q: 'how many replacements in gold', bad: `Gold includes 7 replacements.` },
    { q: 'what is your refund policy', bad: 'You can get a refund within 90 days.' },
    { q: 'what is your refund policy', bad: 'Refunds carry a 25% processing fee.' },
  ];
  for (const c of cases) {
    resetCircuits();
    const a = await answer({ message: c.q }, { provider, fetchImpl: ok(c.bad) });
    assert.equal(a.gateRejected, true, `should reject: "${c.bad}"`);
    assert.equal(a.rung, 3);
  }
});

test('the gate tolerates small bare numbers, numbers the customer typed, and the phone number', async () => {
  const cases = [
    { q: 'how much does the gold plan cost', good: `Two things to note: Gold is ${inr(gold.fee)} and it runs ${gold.termMonths} months.` },
    { q: 'my budget is 15000, which plan', good: `Within ₹15,000 every plan fits: Silver, Gold and Diamond are ${PLANS.map((p) => inr(p.fee)).join(', ')}.` },
    { q: 'how do i reach you', good: `Call us on ${SUPPORT_PHONE_DISPLAY} — the team is there ${SUPPORT_HOURS.label}.` },
  ];
  for (const c of cases) {
    resetCircuits();
    const a = await answer({ message: c.q }, { provider, fetchImpl: ok(c.good) });
    assert.equal(a.gateRejected, false, `should accept: "${c.good}"`);
    assert.equal(a.rung, 1);
  }
});

test('gatedNumbers catches money, units and large numbers, and ignores small bare integers', () => {
  assert.deepEqual([...gatedNumbers('₹4,999 one-time, 10 months, 3 replacements, two things, 8 cities, 110016')].sort((a, b) => a - b), [3, 10, 4999, 110016]);
  assert.deepEqual([...gatedNumbers('Rs 5999 and 25% off')].sort((a, b) => a - b), [25, 5999]);
  assert.deepEqual([...gatedNumbers('no figures at all')], []);
});

// ─── Redaction reaches the provider ─────────────────────────────────────────────────────────

test('what the model receives has the phone number removed but the pincode intact; the record keeps the original', async () => {
  let body = '';
  const capture: FetchLike = async (url, init) => {
    body = String(init.body);
    return ok('Yes, we serve 110016.')(url, init);
  };
  // Not "call me": that phrase is (correctly) a request for a person, which never reaches a model.
  const message = 'I am in 110016, my number is 9876543210';
  const a = await answer({ message }, { provider, fetchImpl: capture });
  assert.ok(!body.includes('9876543210'), 'phone number leaked to the provider');
  assert.ok(body.includes('110016'), 'pincode was over-redacted');
  assert.deepEqual(a.redacted, ['phone']);
  assert.equal(a.entities.pincode, '110016');
});

test('history handed to the model is bounded and redacted too', async () => {
  let body = '';
  const capture: FetchLike = async (url, init) => {
    body = String(init.body);
    return ok('ok')(url, init);
  };
  const history = Array.from({ length: 20 }, (_, i) => ({ role: (i % 2 ? 'assistant' : 'user') as 'user' | 'assistant', content: `turn ${i} call 9876543210` }));
  await answer({ message: 'and the price?', history }, { provider, fetchImpl: capture });
  const parsed = JSON.parse(body) as { messages: Array<{ role: string; content: string }> };
  // system + 6 history + current
  assert.equal(parsed.messages.length, 8);
  assert.ok(!body.includes('9876543210'));
});

// ─── Escalation and handoff ─────────────────────────────────────────────────────────────────

test('asking for a person hands off with the in-hours text during support hours', async () => {
  const a = await answer({ message: 'i want to talk to a person', now: TUESDAY_IN_HOURS }, { provider, fetchImpl: ok('should not be called') });
  assert.equal(a.escalate, 'asked_for_human');
  assert.equal(a.handoff?.inHours, true);
  assert.ok(a.text.includes(SUPPORT_PHONE_DISPLAY));
  assert.equal(a.modelId, null, 'handoffs never go through a model');
});

test('outside support hours the handoff carries the 24-hour promise', async () => {
  for (const when of [SUNDAY, SATURDAY_EVENING]) {
    const a = await answer({ message: 'i want to talk to a person', now: when }, { provider: null });
    assert.equal(a.handoff?.inHours, false, when.toISOString());
    assert.ok(a.text.includes(`${SUPPORT_HOURS.replyWithinHours} hours`));
    assert.ok(a.text.includes(SUPPORT_HOURS.label));
  }
});

test('handoffFor evaluates support hours in IST, not the server clock', () => {
  assert.equal(handoffFor(TUESDAY_IN_HOURS).inHours, true);
  assert.equal(handoffFor(new Date('2026-09-15T13:29:00Z')).inHours, true); // 18:59 IST
  assert.equal(handoffFor(new Date('2026-09-15T13:30:00Z')).inHours, false); // 19:00 IST
  assert.equal(handoffFor(new Date('2026-09-15T04:29:00Z')).inHours, false); // 09:59 IST
});

test('a refund request escalates and quotes the policy for reference', async () => {
  const a = await answer({ message: 'i want a refund now', now: TUESDAY_IN_HOURS }, { provider: null });
  assert.equal(a.escalate, 'refund');
  assert.ok(a.text.includes('60 days'));
  assert.ok(a.text.includes('3 suitable verified profiles'));
});

test('an off-topic question refuses and OFFERS a person; it does not hand off by itself', async () => {
  const a = await answer({ message: 'what is the weather today' }, { provider: null });
  assert.equal(a.escalate, 'low_confidence');
  assert.equal(a.text, COPY.refuse);
  assert.equal(a.handoff, undefined);
});

test('three refusals in a row hand off (turn limit)', async () => {
  const history = [
    { role: 'user' as const, content: 'what is the weather' },
    { role: 'assistant' as const, content: COPY.refuse },
    { role: 'user' as const, content: 'tell me a joke' },
    { role: 'assistant' as const, content: COPY.refuse },
  ];
  const a = await answer({ message: 'who won the match', history, now: TUESDAY_IN_HOURS }, { provider: null });
  assert.equal(a.escalate, 'turn_limit');
  assert.ok(a.handoff);
});

// ─── The hallucination gate, over the whole eval set ────────────────────────────────────────

test('every rung-3 answer passes the number gate against its own retrieval', async () => {
  const questions = [
    'how much does the gold plan cost',
    'what are your plans',
    'what is your refund policy',
    'my maid left, can i get a replacement',
    'are helpers police verified',
    'contact number',
    'cook charges',
    'full time maid salary in mumbai',
    'do you serve 110016?',
    'which areas do you cover',
    ...SERVICES.map((s) => `what does a ${s.name.toLowerCase()} do`),
    ...PLANS.map((p) => `${p.key} plan details`),
  ];
  for (const q of questions) {
    const a = await answer({ message: q }, { provider: null });
    assert.ok(passesGate(a.text, retrieve(q), q), `rung-3 answer for "${q}" contains a number not in its facts`);
  }
});

test('every rupee figure in every plan or policy answer is a fee or a salary band from the data layer', async () => {
  const legitimate = new Set<number>([...PLANS.map((p) => p.fee), ...SERVICES.flatMap((s) => Object.values(s.pricing).flatMap((b) => [b.from, b.to]))]);
  const questions = ['what are your plans', ...PLANS.map((p) => `${p.key} plan details`), ...SERVICES.map((s) => `${s.name.toLowerCase()} charges`), 'what is your refund policy'];
  for (const q of questions) {
    const a = await answer({ message: q }, { provider: null });
    for (const m of a.text.matchAll(/₹\s?([\d,]+)/g)) {
      const n = Number(m[1].replace(/,/g, ''));
      assert.ok(legitimate.has(n), `"${q}": ₹${m[1]} is not a plan fee or a service band`);
    }
  }
});

// ─── Provider request shape ─────────────────────────────────────────────────────────────────

test('OpenRouter requests carry reasoning:{enabled:false} by default; a custom extra body replaces it; other hosts get nothing extra', async () => {
  const { providerFromEnv } = await import('./provider');
  const or = providerFromEnv({ ASSISTANT_BASE_URL: 'https://openrouter.ai/api/v1', ASSISTANT_API_KEY: 'k', ASSISTANT_MODELS: 'a' })!;
  assert.deepEqual(or.extraBody, { reasoning: { enabled: false } });
  const custom = providerFromEnv({ ASSISTANT_BASE_URL: 'https://openrouter.ai/api/v1', ASSISTANT_API_KEY: 'k', ASSISTANT_MODELS: 'a', ASSISTANT_EXTRA_BODY: '{"top_p":0.9}' })!;
  assert.deepEqual(custom.extraBody, { top_p: 0.9 });
  const other = providerFromEnv({ ASSISTANT_BASE_URL: 'https://api.openai.com/v1', ASSISTANT_API_KEY: 'k', ASSISTANT_MODELS: 'a' })!;
  assert.equal(other.extraBody, undefined);

  // And the field actually reaches the wire.
  let body = '';
  const capture: FetchLike = async (url, init) => {
    body = String(init.body);
    return ok('fine')(url, init);
  };
  await answer({ message: 'what are your plans' }, { provider: or, fetchImpl: capture });
  assert.deepEqual(JSON.parse(body).reasoning, { enabled: false });
});

test('a model that returns no content (a reasoning model that spent its budget thinking) is treated as unavailable', async () => {
  const empty: FetchLike = async () => new Response(JSON.stringify({ model: 'm', choices: [{ message: { content: null, reasoning: 'thinking…' } }] }), { status: 200 });
  const a = await answer({ message: 'what are your plans' }, { provider, fetchImpl: empty });
  assert.equal(a.rung, 3);
  assert.equal(a.modelId, null);
});

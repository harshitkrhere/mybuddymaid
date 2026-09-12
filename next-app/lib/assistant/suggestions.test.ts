// Run: npx tsx --test lib/assistant/suggestions.test.ts
//
// The chips under an answer: few, relevant, never the question just answered, and absent once
// a person has the conversation. Every prompt offered is one retrieve.ts answers with the
// intent it names — a chip that led to the refusal would be worse than no chip at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsFor, MAX_SUGGESTIONS } from './suggestions';
import { retrieve, type Intent } from './retrieve';
import { COPY } from './copy';

const INTENTS: Intent[] = [
  'greeting', 'serviceability', 'pricing', 'plan_detail', 'service_info', 'refund_question', 'refund_request', 'replacement',
  'verification', 'booking_process', 'booking_status', 'contact', 'human', 'complaint', 'safety', 'payment_issue', 'not_offered', 'faq', 'unknown',
];

test('at most three, all drawn from the approved prompts', () => {
  const allowed = new Set<string>(Object.values(COPY.prompts));
  for (const intent of INTENTS) {
    const s = suggestionsFor({ intent });
    assert.ok(s.length <= MAX_SUGGESTIONS, intent);
    for (const p of s) assert.ok(allowed.has(p), `${intent}: ${p}`);
  }
});

test('never offers the question just answered', () => {
  assert.ok(!suggestionsFor({ intent: 'pricing' }).includes(COPY.prompts.pricing));
  assert.ok(!suggestionsFor({ intent: 'serviceability' }).includes(COPY.prompts.areas));
  assert.ok(!suggestionsFor({ intent: 'service_info' }).includes(COPY.prompts.services));
  assert.ok(!suggestionsFor({ intent: 'replacement' }).includes(COPY.prompts.replacements));
});

test('nothing once a person has the conversation; a greeting and a blank both get somewhere to go', () => {
  assert.deepEqual(suggestionsFor({ intent: 'human', handoff: { inHours: true, text: '' } }), []);
  assert.deepEqual(suggestionsFor({ intent: 'pricing', handoff: { inHours: true, text: '' } }), []);
  assert.deepEqual(suggestionsFor({ intent: 'human', contactRequired: true }), [], 'the contact card is up; nothing competes with it');
  assert.equal(suggestionsFor({ intent: 'greeting' }).length, 3);
  assert.equal(suggestionsFor({ intent: 'unknown' }).length, 3);
  // A refusal is shown with the WhatsApp-or-call card, so the team chip would repeat it.
  assert.ok(!suggestionsFor({ intent: 'unknown' }).includes(COPY.prompts.team));
  assert.ok(suggestionsFor({ intent: 'booking_process' }).includes(COPY.prompts.team), 'where no card is shown, the chip is the way to a person');
});

test('every prompt, and every starter, is answered by the retrieval with the intent it names — never the refusal', () => {
  const expected: Record<string, Intent> = {
    [COPY.prompts.services]: 'service_info',
    [COPY.prompts.pricing]: 'pricing',
    [COPY.prompts.areas]: 'serviceability',
    [COPY.prompts.verification]: 'faq',
    [COPY.prompts.replacements]: 'replacement',
    [COPY.prompts.booking]: 'booking_process',
    [COPY.prompts.gold]: 'plan_detail',
    [COPY.prompts.team]: 'human',
  };
  for (const [q, intent] of Object.entries(expected)) {
    const r = retrieve(q);
    assert.equal(r.intent, intent, q);
    assert.notEqual(r.escalate, 'low_confidence', q);
  }
  for (const q of COPY.starters) assert.ok(q in expected, `starter "${q}" is not one of the checked prompts`);
});

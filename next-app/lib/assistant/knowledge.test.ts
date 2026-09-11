// Run: npx tsx --test lib/assistant/knowledge.test.ts
//
// The corpus is data, so these are data-driven assertions: every entry is sourced to a real
// page, the plan entries carry whatever plans.ts says today, and the sentences the bot uses
// for policy and verification appear in the source of the page they cite — so a copy change
// on the page that is not mirrored here fails the build instead of being quoted wrongly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { KNOWLEDGE, KNOWLEDGE_BY_ID, KNOWLEDGE_STATS, numbersIn, ALWAYS_ALLOWED_NUMBERS } from './knowledge';
import { PLANS, CITIES, ALL_LOCALITIES, SERVICES, REFUND_WINDOW_DAYS, REFUND_PROFILE_THRESHOLD } from '../../data/seo';
import { SUPPORT_HOURS } from '../../data/seo/contact';

const page = (p: string) => readFileSync(path.join(__dirname, '..', '..', 'app', p, 'page.tsx'), 'utf8');

test('every entry has an id, a question, an answer and a site-relative source', () => {
  const ids = new Set<string>();
  for (const e of KNOWLEDGE) {
    assert.ok(e.id && !ids.has(e.id), `duplicate or empty id: ${e.id}`);
    ids.add(e.id);
    assert.ok(e.q.trim().length > 5, `${e.id}: empty question`);
    assert.ok(e.a.trim().length > 20, `${e.id}: empty answer`);
    assert.match(e.source.url, /^\/[a-z0-9\-/]*$/, `${e.id}: source is not a site path: ${e.source.url}`);
    assert.ok(e.source.title, `${e.id}: source has no title`);
  }
});

test('the corpus covers every city, service and plan, and carries the FAQ pools', () => {
  assert.equal(KNOWLEDGE_STATS.cities, CITIES.length);
  assert.equal(KNOWLEDGE_STATS.services, SERVICES.length);
  assert.equal(KNOWLEDGE_STATS.plans, PLANS.length);
  assert.equal(KNOWLEDGE_STATS.localities, ALL_LOCALITIES.length);
  assert.ok(KNOWLEDGE_STATS.faqs >= 180, `expected at least the 184 curated FAQs, got ${KNOWLEDGE_STATS.faqs}`);
  for (const s of SERVICES) assert.ok(KNOWLEDGE_BY_ID.has(`service-${s.slug}`), `no entry for service ${s.slug}`);
  for (const p of PLANS) assert.ok(KNOWLEDGE_BY_ID.has(`plan-${p.key}`), `no entry for plan ${p.key}`);
});

test('plan entries quote exactly what plans.ts says — fee, term, replacements, profiles', () => {
  for (const p of PLANS) {
    const e = KNOWLEDGE_BY_ID.get(`plan-${p.key}`)!;
    const nums = numbersIn(e.a);
    assert.ok(nums.has(p.fee), `${p.key}: fee ${p.fee} missing from "${e.a}"`);
    assert.ok(nums.has(p.termMonths), `${p.key}: term ${p.termMonths} missing`);
    assert.ok(nums.has(p.replacements), `${p.key}: replacements ${p.replacements} missing`);
    assert.ok(nums.has(p.verifiedProfiles), `${p.key}: profiles ${p.verifiedProfiles} missing`);
    assert.equal(e.source.url, '/pricing');
    // And nothing that is NOT a plan figure — the entry may not smuggle in a number from elsewhere.
    for (const n of nums) {
      assert.ok([p.fee, p.termMonths, p.replacements, p.verifiedProfiles].includes(n), `${p.key}: unexpected number ${n} in plan entry`);
    }
  }
});

test('the refund entry quotes the published window and threshold, and nothing else', () => {
  const e = KNOWLEDGE_BY_ID.get('policy-refund')!;
  const nums = numbersIn(e.a);
  assert.deepEqual([...nums].sort((a, b) => a - b), [REFUND_PROFILE_THRESHOLD, REFUND_WINDOW_DAYS].sort((a, b) => a - b));
  assert.equal(e.source.url, '/replacement-policy');
  const src = page('replacement-policy');
  assert.match(src, /REFUND_PROFILE_THRESHOLD/, 'the page must render the threshold from the data layer');
  assert.match(src, /REFUND_WINDOW_DAYS/, 'the page must render the window from the data layer');
  for (const phrase of ['refundable, minus a processing fee', 'successfully hired', 'becomes unresponsive']) {
    assert.ok(src.includes(phrase), `replacement-policy page no longer says "${phrase}" — update policy-refund in knowledge.ts`);
  }
});

test('the replacement entry mirrors the published page, including the 48-hour target', () => {
  const e = KNOWLEDGE_BY_ID.get('policy-replacement')!;
  const src = page('replacement-policy');
  for (const phrase of ['leaves, stops coming', 'does not match the duties agreed', 'not working for your household', 'within 48 hours', 'original stated requirements']) {
    assert.ok(src.includes(phrase), `replacement-policy page no longer says "${phrase}" — update policy-replacement in knowledge.ts`);
    assert.ok(e.a.includes(phrase), `policy-replacement entry does not say "${phrase}"`);
  }
  for (const p of PLANS) {
    assert.ok(e.a.includes(`${p.replacements} replacements over ${p.termMonths} months`), `${p.key} replacements/term missing from the replacement entry`);
  }
});

test('the verification entries mirror /how-we-verify', () => {
  const src = page('how-we-verify');
  const checks = KNOWLEDGE_BY_ID.get('verification-checks')!;
  const limits = KNOWLEDGE_BY_ID.get('verification-limits')!;
  for (const phrase of ['Aadhaar validation', 'reference checks', 'behavioural assessment', 'Police verification', 'Gold and Diamond', 'verification dossier']) {
    assert.ok(src.includes(phrase), `how-we-verify no longer says "${phrase}"`);
    assert.ok(checks.a.includes(phrase), `verification-checks entry does not say "${phrase}"`);
  }
  for (const phrase of ['Verification reduces risk; it does not eliminate it', 'predict future behaviour', 'medical or psychiatric evaluation']) {
    assert.ok(src.includes(phrase), `how-we-verify no longer says "${phrase}"`);
    assert.ok(limits.a.includes(phrase), `verification-limits entry does not say "${phrase}"`);
  }
});

test('the contact entry carries the published support hours and the 24-hour promise', () => {
  const e = KNOWLEDGE_BY_ID.get('contact-support')!;
  assert.ok(e.a.includes(SUPPORT_HOURS.label));
  assert.ok(e.a.includes(`${SUPPORT_HOURS.replyWithinHours} hours`));
});

test('numbersIn normalises Indian formatting and ignores digits inside words', () => {
  assert.deepEqual([...numbersIn('₹4,999 one-time, 10-month term, 3 replacements')], [4999, 10, 3]);
  assert.deepEqual([...numbersIn('₹16,000 to ₹26,000 per month')], [16000, 26000]);
  assert.deepEqual([...numbersIn('pincode 110016 and G7 block, v2 app')], [110016]);
  assert.deepEqual([...numbersIn('no numbers here')], []);
});

test('the always-allowed set is only the phone number and the coverage counts', () => {
  const allowed = [...ALWAYS_ALLOWED_NUMBERS].sort((a, b) => a - b);
  assert.ok(allowed.includes(CITIES.length));
  assert.ok(allowed.includes(ALL_LOCALITIES.length));
  // Hours and the 24-hour promise are NOT always-allowed: "24" would let "24 months" through.
  assert.ok(!allowed.includes(SUPPORT_HOURS.replyWithinHours));
  assert.ok(!allowed.includes(SUPPORT_HOURS.openHour));
  // No plan fee or term either: those must come from a retrieved entry, never for free.
  for (const p of PLANS) {
    assert.ok(!allowed.includes(p.fee), `plan fee ${p.fee} must not be always-allowed`);
    assert.ok(!allowed.includes(p.termMonths), `plan term ${p.termMonths} must not be always-allowed`);
  }
});

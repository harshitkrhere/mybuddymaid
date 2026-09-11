// Run: npx tsx --test lib/assistant/redact.test.ts
//
// What leaves for a model provider must not carry a phone number, email or card number the
// customer typed (owner decision 17; Privacy Policy 2.0 §3.6). Pincodes stay, because
// serviceability depends on them and six digits is not a phone number.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, REDACTED } from './redact';

test('Indian mobile numbers in every common shape are removed', () => {
  for (const s of ['9876543210', '+919876543210', '+91 98765 43210', '91-98765-43210', '098765 43210', '98765.43210', 'call me on 9876543210 please']) {
    const r = redact(s);
    assert.ok(!/\d{5}/.test(r.text.replace(REDACTED.phone, '')), `phone survived in "${r.text}"`);
    assert.ok(r.removed.includes('phone'), `phone not reported removed for "${s}"`);
  }
});

test('email addresses are removed', () => {
  const r = redact('mail me at harshit.k@example.co.in thanks');
  assert.equal(r.text, `mail me at ${REDACTED.email} thanks`);
  assert.deepEqual(r.removed, ['email']);
});

test('card-like digit runs are removed, and are not mistaken for a phone number', () => {
  const r = redact('my card is 4111 1111 1111 1111');
  assert.equal(r.text, `my card is ${REDACTED.card}`);
  assert.deepEqual(r.removed, ['card']);
});

test('a six-digit pincode is preserved, even next to a phone number', () => {
  const r = redact('I am in 110016, call 9876543210');
  assert.ok(r.text.includes('110016'), `pincode lost: "${r.text}"`);
  assert.ok(!r.text.includes('9876543210'));
  assert.deepEqual(r.removed, ['phone']);
});

test('prices, plan terms and years are left alone', () => {
  for (const s of ['is gold ₹5,999?', 'within 60 days', '10 months', 'since 2026', 'sector 50', '3 replacements']) {
    const r = redact(s);
    assert.equal(r.text, s, `over-redacted "${s}" to "${r.text}"`);
    assert.deepEqual(r.removed, []);
  }
});

test('the original is untouched — redaction returns a new string', () => {
  const original = 'ring me 9876543210';
  const r = redact(original);
  assert.equal(original, 'ring me 9876543210');
  assert.notEqual(r.text, original);
});

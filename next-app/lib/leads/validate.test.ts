// Run: npx tsx --test lib/leads/validate.test.ts
//
// The rules behind /api/lead, against fixtures rather than the data layer, so each rejection
// is exercised on its own: the phone normalisation the DB CHECK depends on, the footprint
// checks that keep anything outside the eight cities out of the table, the caps that match the
// column limits, the attribution whitelist, the honeypot, and the same-origin test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, normalisePhone, sanitiseAttribution, sourcePage, originAllowed, clientIp, MESSAGES, type LeadRules } from './validate';

const RULES: LeadRules = {
  cityExists: (c) => c === 'gurgaon',
  localityExists: (c, l) => c === 'gurgaon' && l === 'dlf-phase-3',
  serviceExists: (s) => s === 'cook',
  pincodeServiceable: (p) => p === '122010',
  entityExists: (c, l, e) => c === 'gurgaon' && l === 'dlf-phase-3' && e === 'park-place',
};
const GOOD = { name: ' Priya  Sharma ', phone: '+91 98765 43210', city: 'gurgaon', locality: 'dlf-phase-3', service: 'cook', pincode: '122010', page: '/gurgaon/dlf-phase-3/cook?utm_source=x#top' };

function row(input: Record<string, unknown>) {
  const v = validateLead(input, RULES);
  assert.ok(v.ok && !v.honeypot, `expected a row, got ${JSON.stringify(v)}`);
  return v.row;
}
function rejection(input: Record<string, unknown>) {
  const v = validateLead(input, RULES);
  assert.ok(!v.ok, `expected a rejection, got ${JSON.stringify(v)}`);
  return v;
}

test('a complete request becomes exactly the row the migration accepts', () => {
  assert.deepEqual(row(GOOD), {
    name: 'Priya Sharma',
    phone: '9876543210',
    city_slug: 'gurgaon',
    locality_slug: 'dlf-phase-3',
    pincode: '122010',
    entity_slug: null,
    society: null,
    service_slug: 'cook',
    source_page: '/gurgaon/dlf-phase-3/cook',
    status: 'new',
    attribution: null,
  });
});

test('phone: Indian mobiles in the forms people type, and nothing else', () => {
  for (const ok of ['9876543210', '+91 98765 43210', '91-9876543210', '098765 43210', '(+91) 98765-43210']) assert.equal(normalisePhone(ok), '9876543210', ok);
  for (const bad of ['5876543210', '98765', '12345678901', '+1 202 555 0100', '', undefined, 9876543210]) assert.equal(normalisePhone(bad), null, String(bad));
  assert.equal(rejection({ ...GOOD, phone: '12345' }).error, MESSAGES.phone);
});

test('name: at least two characters once whitespace is collapsed, at most eighty', () => {
  assert.equal(rejection({ ...GOOD, name: ' P ' }).field, 'name');
  assert.equal(rejection({ ...GOOD, name: undefined }).field, 'name');
  assert.equal(row({ ...GOOD, name: 'x'.repeat(200) }).name.length, 80);
});

test('the footprint: city, locality-in-city, service, pincode and entity are all checked against the data layer', () => {
  assert.equal(rejection({ ...GOOD, city: 'jaipur' }).field, 'city');
  assert.equal(rejection({ ...GOOD, city: 'Gurgaon' }).field, 'city', 'slugs only, never display names');
  assert.equal(rejection({ ...GOOD, locality: 'sector-50' }).field, 'locality');
  assert.equal(rejection({ ...GOOD, service: 'plumber' }).field, 'service');
  assert.equal(rejection({ ...GOOD, pincode: '302001' }).field, 'pincode');
  assert.equal(rejection({ ...GOOD, pincode: '012345' }).field, 'pincode');
  assert.equal(rejection({ ...GOOD, entity: 'nowhere' }).field, 'entity');
  assert.equal(row({ ...GOOD, entity: 'park-place' }).entity_slug, 'park-place');
  // the optional fields may be absent or empty
  const r = row({ ...GOOD, service: '', pincode: undefined, page: undefined });
  assert.equal(r.service_slug, null);
  assert.equal(r.pincode, null);
  assert.equal(r.source_page, null);
});

test('free text is trimmed and capped to the column limits; the page keeps its path only', () => {
  assert.equal(row({ ...GOOD, society: `  Tower   B,\n Park Place ${'x'.repeat(200)}` }).society!.length, 120);
  assert.equal(row({ ...GOOD, society: '   ' }).society, null);
  assert.equal(sourcePage('/noida/sector-50?gclid=abc'), '/noida/sector-50');
  assert.equal(sourcePage('https://evil.example/x'), null);
  assert.equal(sourcePage('/' + 'a'.repeat(400))!.length, 300);
});

test('attribution: whitelisted keys, strings only, capped; anything else is dropped', () => {
  const a = sanitiseAttribution({ last: { utm_source: 'google', gclid: 'x'.repeat(500), phone: '9999999999', nested: { a: 1 } }, first: null });
  assert.deepEqual(a, { last: { utm_source: 'google', gclid: 'x'.repeat(200) }, first: null });
  assert.equal(sanitiseAttribution({ last: { phone: '9999999999' } }), null);
  assert.equal(sanitiseAttribution('utm_source=google'), null);
  assert.equal(sanitiseAttribution(null), null);
  assert.deepEqual(row({ ...GOOD, attribution: { first: { referrer: 'https://x.example/' } } }).attribution, { last: null, first: { referrer: 'https://x.example/' } });
});

test('the honeypot: a filled hidden field is accepted and produces no row; whitespace does not count', () => {
  assert.deepEqual(validateLead({ ...GOOD, website: 'http://spam.example' }, RULES), { ok: true, honeypot: true });
  const blank = validateLead({ ...GOOD, website: '   ' }, RULES);
  assert.ok(blank.ok && !blank.honeypot);
});

test('origin: only the host that served the form, from either header Vercel sets', () => {
  assert.ok(originAllowed('https://mybuddymaid.in', ['mybuddymaid.in']));
  assert.ok(originAllowed('https://mybuddymaid.in', [null, 'MyBuddyMaid.in']));
  assert.ok(originAllowed('https://preview-abc.vercel.app', ['preview-abc.vercel.app', 'mybuddymaid.in']));
  assert.ok(!originAllowed('https://evil.example', ['mybuddymaid.in']));
  assert.ok(!originAllowed('null', ['mybuddymaid.in']), 'the opaque origin a sandboxed frame sends');
  assert.ok(!originAllowed(null, ['mybuddymaid.in']));
  assert.ok(!originAllowed('https://mybuddymaid.in', [null, undefined]));
});

test('clientIp: the first forwarded address, else x-real-ip, else unknown', () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
  assert.equal(clientIp(h({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })), '203.0.113.9');
  assert.equal(clientIp(h({ 'x-real-ip': '203.0.113.7' })), '203.0.113.7');
  assert.equal(clientIp(h({})), 'unknown');
});

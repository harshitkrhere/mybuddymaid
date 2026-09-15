// Run: npx tsx --test lib/growth/classify-legacy.test.ts
//
// The first data check (2026-09-15) showed why the weekly report never made the relaunch cliff
// visible: 2,848 retired URLs still drew most of the site's Google clicks, and the classifier
// filed every one of them under 'trust', so the per-city and national numbers were both wrong.
// Retired URLs are now their own two types — gone (410) and redirected (301, attributed to the
// page they land on) — and only the real trust pages are 'trust'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import redirectMap from '../seo-engine/redirect-map.json';
import { classify, cityBucket } from './classify';

const redirects = redirectMap.redirects as Record<string, string>;
const gone = redirectMap.gone as string[];

test('a retired 410 URL is legacy-gone and rolls up to "other", never to a city or national', () => {
  assert.ok(gone.length > 2000, 'the map is populated');
  for (const p of gone.slice(0, 50)) {
    const c = classify(`https://mybuddymaid.in${p}`);
    assert.equal(c.type, 'legacy-gone', p);
    assert.equal(cityBucket(c), 'other', p);
  }
});

test('a redirected legacy URL is legacy-redirected and carries the city and type of the page it lands on', () => {
  const c = classify('/best-cook-service-in-bangalore');
  assert.equal(c.type, 'legacy-redirected');
  assert.equal(c.target, '/services/cook/bangalore');
  assert.equal(c.targetType, 'service-city');
  assert.equal(c.city, 'bangalore');
  assert.equal(c.service, 'cook');
  assert.equal(cityBucket(c), 'bangalore');
  const about = classify('/about-us');
  assert.equal(about.targetType, 'trust');
  assert.equal(cityBucket(about), 'national');
  for (const [from, to] of Object.entries(redirects).slice(0, 200)) {
    const x = classify(from);
    assert.equal(x.type, 'legacy-redirected', from);
    assert.equal(x.target, classify(to).path, from);
  }
});

test('only the real trust pages are trust; an unknown one-segment path is other', () => {
  for (const p of ['/about', '/contact', '/pricing', '/how-we-verify', '/replacement-policy', '/terms-of-service', '/privacy-policy', '/services']) assert.equal(classify(p).type, 'trust', p);
  assert.equal(classify('/hyderabad').type, 'other');
  assert.equal(classify('/maid-service-in-nowhere').type, 'other');
});

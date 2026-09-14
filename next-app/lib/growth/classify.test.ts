// Run: npx tsx --test lib/growth/classify.test.ts
//
// The classifier is the one place a URL is turned into a city and a page type for every
// growth report. Data-driven over the real estate, like lib/seo-engine/sitemaps.test.ts:
// if a route is added and the classifier does not know it, its traffic would silently land
// in 'other' and every per-city number would be understated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES_BY_TIER, TIER1_CITIES, TIER2_CITIES, cityBucket, classify, pathOf } from './classify';
import { allIndexableUrls } from '../seo-engine/sitemaps';

test('pathOf strips host, query, fragment and trailing slash', () => {
  assert.equal(pathOf('https://mybuddymaid.in/gurgaon/dlf-phase-1/?utm_source=x#top'), '/gurgaon/dlf-phase-1');
  assert.equal(pathOf('https://mybuddymaid.in/'), '/');
  assert.equal(pathOf('/pricing/'), '/pricing');
});

test('every page type in the architecture is recognised', () => {
  const cases: Array<[string, string, string]> = [
    ['/', 'home', ''],
    ['/services/cook', 'service-hub', ''],
    ['/services/cook/gurgaon', 'service-city', 'gurgaon'],
    ['/services', 'trust', ''],
    ['/gurgaon', 'city', 'gurgaon'],
    ['/gurgaon/old-gurgaon', 'zone', 'gurgaon'],
    ['/gurgaon/dlf-phase-1', 'locality', 'gurgaon'],
    ['https://mybuddymaid.in/gurgaon/dlf-phase-1/cook', 'service-locality', 'gurgaon'],
    ['/noida/sector-50/some-society', 'entity', 'noida'],
    ['/pincode/122011', 'pincode', 'gurgaon'],
    ['/blog/how-to-hire-maid-india-2026', 'blog', ''],
    ['/how-we-verify', 'trust', ''],
    ['/hyderabad', 'trust', ''],
    ['/hyderabad/banjara-hills', 'other', ''],
  ];
  for (const [path, type, city] of cases) {
    const c = classify(path);
    assert.equal(c.type, type, `${path} → ${c.type}, expected ${type}`);
    assert.equal(c.city, city, `${path} → city ${c.city}, expected ${city}`);
  }
});

test('every indexable URL classifies to a known type and a city bucket', () => {
  const urls = allIndexableUrls();
  assert.ok(urls.length > 2000, 'the estate is populated');
  for (const u of urls) {
    const c = classify(u);
    assert.notEqual(c.type, 'other', `${u} is unclassified`);
    assert.notEqual(cityBucket(c), 'other', `${u} has no city bucket`);
  }
});

test('the brief’s tiers come from the data layer: six Tier-1 cities, two Tier-2, Tier 1 first', () => {
  assert.deepEqual([...TIER1_CITIES].sort(), ['bangalore', 'delhi', 'gurgaon', 'mumbai', 'noida', 'pune']);
  assert.deepEqual([...TIER2_CITIES].sort(), ['greater-noida', 'mangalore']);
  assert.deepEqual(CITIES_BY_TIER.slice(0, 6), TIER1_CITIES);
});

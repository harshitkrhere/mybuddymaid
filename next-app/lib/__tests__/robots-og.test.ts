// Run: npx tsx --test lib/__tests__/robots-og.test.ts
//
// Audit 2.3 (FIN-B10, FIN-SEO02, FIN-S05): robots.txt blocked every query-string URL —
// every ad landing URL — and the /og endpoint every page's og:image points at, while /og
// itself would render any text under the brand. Now robots allows both, and /og accepts
// only parameters the site signed, when OG_SIGNING_SECRET is set.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import robots from '../../app/robots';
import { ogImagePath, signOg } from '../seo-engine/og-sign';
import { verifyOg } from '../seo-engine/og-verify';

test('robots.txt no longer blocks query strings or the OG image endpoint', () => {
  const rule = robots().rules as { disallow: string[] };
  const rules = Array.isArray(rule) ? rule[0] : rule;
  assert.ok(!rules.disallow.includes('/*?*'), 'ad landing URLs (?gclid=…) must be crawlable');
  assert.ok(!rules.disallow.includes('/og'), 'the og:image endpoint must be fetchable');
  for (const kept of ['/api/', '/app', '/_spa/', '/maintenance']) assert.ok(rules.disallow.includes(kept), `${kept} must stay blocked`);
});

test('ogImagePath signs when a secret is configured and not otherwise', () => {
  const unsigned = ogImagePath('Maid Service in Gurgaon', 'Gurgaon', undefined);
  assert.equal(unsigned, '/og?t=Maid+Service+in+Gurgaon&s=Gurgaon');
  const signed = new URL(ogImagePath('Maid Service in Gurgaon', 'Gurgaon', 'test-secret'), 'https://x');
  assert.equal(signed.searchParams.get('sig'), signOg('Maid Service in Gurgaon', 'Gurgaon', 'test-secret'));
  assert.match(signed.searchParams.get('sig') ?? '', /^[0-9a-f]{32}$/);
});

test('the edge verifier accepts the Node signature and rejects tampering', async () => {
  const sig = signOg('Maid Service in Gurgaon', 'Gurgaon', 'test-secret');
  assert.equal(await verifyOg('Maid Service in Gurgaon', 'Gurgaon', sig, 'test-secret'), true);
  assert.equal(await verifyOg('Maid Service in Chennai', 'Gurgaon', sig, 'test-secret'), false);
  assert.equal(await verifyOg('Maid Service in Gurgaon', 'Gurgaon', sig, 'other-secret'), false);
  assert.equal(await verifyOg('Maid Service in Gurgaon', 'Gurgaon', '', 'test-secret'), false);
});

test('long titles are trimmed before signing, exactly as the endpoint trims them', async () => {
  const long = 'x'.repeat(120);
  const url = new URL(ogImagePath(long, long, 'test-secret'), 'https://x');
  assert.equal(url.searchParams.get('t')?.length, 80);
  assert.equal(url.searchParams.get('s')?.length, 100);
  assert.equal(await verifyOg(url.searchParams.get('t')!, url.searchParams.get('s')!, url.searchParams.get('sig')!, 'test-secret'), true);
});

// Run: npx tsx --test lib/growth/inspection.test.ts
//
// The census is the only "indexed" number the reports have, so the ledger must be right about
// three things: which URLs get inspected today (never-seen first, then oldest, under the cap),
// what a verdict change looks like (previousVerdict is kept so PASS→FAIL transitions can be
// listed), and that a quota refusal keeps the partial results instead of losing the day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLedger, inspectPaths, mergeLedger, parseInspection, planSlice, summarizeLedger, type InspectionResult } from './inspection';

const NOW = new Date('2026-09-14T02:17:00Z');
const result = (verdict: InspectionResult['verdict'], coverageState = 'Submitted and indexed'): InspectionResult => ({
  verdict,
  coverageState,
  indexingState: 'INDEXING_ALLOWED',
  robotsTxtState: 'ALLOWED',
  pageFetchState: 'SUCCESSFUL',
  lastCrawlTime: '2026-09-10T00:00:00Z',
  googleCanonical: null,
  userCanonical: null,
  inSitemap: true,
});

test('planSlice takes never-inspected paths first, then the oldest, and respects cap and minimum age', () => {
  const estate = ['/a', '/b', '/c', '/d'];
  let ledger = emptyLedger('sc-domain:x');
  ledger = mergeLedger(ledger, [{ path: '/a', result: result('PASS') }], estate, new Date('2026-09-01T00:00:00Z'));
  ledger = mergeLedger(ledger, [{ path: '/b', result: result('PASS') }], estate, new Date('2026-09-12T00:00:00Z'));
  const slice = planSlice(estate, ledger, { cap: 3, minAgeDays: 5, now: NOW });
  assert.deepEqual(slice, ['/c', '/d', '/a'], 'b was inspected 2 days ago and is skipped; a (13 days) comes after the never-seen');
  assert.deepEqual(planSlice(estate, ledger, { cap: 1, minAgeDays: 5, now: NOW }), ['/c']);
});

test('parseInspection reads the indexStatusResult and refuses unknown verdicts', () => {
  const r = parseInspection({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', sitemap: ['x'], lastCrawlTime: '2026-09-10T00:00:00Z' } } });
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.inSitemap, true);
  assert.equal(r.googleCanonical, null);
  assert.equal(parseInspection({ inspectionResult: { indexStatusResult: { verdict: 'MAYBE' } } }).verdict, 'VERDICT_UNSPECIFIED');
  assert.equal(parseInspection(null).coverageState, '');
});

test('mergeLedger keeps the previous verdict on change and retires paths that left the estate', () => {
  const estate = ['/a', '/b'];
  let ledger = mergeLedger(emptyLedger('s'), [{ path: '/a', result: result('PASS') }, { path: '/b', result: result('PASS') }, { path: '/gone', result: result('PASS') }], estate, new Date('2026-09-01T00:00:00Z'));
  assert.equal(ledger.entries['/gone'].retired, true);
  ledger = mergeLedger(ledger, [{ path: '/a', result: result('FAIL', 'Crawled - currently not indexed') }], estate, NOW);
  assert.equal(ledger.entries['/a'].previousVerdict, 'PASS');
  assert.equal(ledger.entries['/a'].previousVerdictAt, '2026-09-01T00:00:00.000Z');
  assert.equal(ledger.entries['/a'].city, '');
  ledger = mergeLedger(ledger, [{ path: '/gone', result: result('PASS') }], ['/a', '/b', '/gone'], NOW);
  assert.equal(ledger.entries['/gone'].retired, undefined, 'a path back in the estate is un-retired');
});

test('summarizeLedger counts PASS vs other per city and type, freshness, and PASS→non-PASS transitions', () => {
  const estate = ['/gurgaon', '/gurgaon/dlf-phase-1', '/noida', '/pricing'];
  let ledger = mergeLedger(emptyLedger('s'), [{ path: '/gurgaon', result: result('PASS') }, { path: '/gurgaon/dlf-phase-1', result: result('PASS') }], estate, new Date('2026-08-20T00:00:00Z'));
  ledger = mergeLedger(ledger, [{ path: '/gurgaon/dlf-phase-1', result: result('FAIL', 'Discovered - currently not indexed') }, { path: '/noida', result: result('PASS') }], estate, NOW);
  const s = summarizeLedger(ledger, estate, NOW);
  assert.equal(s.estate, 4);
  assert.equal(s.inspected, 3);
  assert.equal(s.fresh, 2);
  assert.equal(s.stale, 1);
  assert.equal(s.byVerdict.PASS, 2);
  assert.equal(s.byCoverageState['Discovered - currently not indexed'], 1);
  assert.deepEqual(s.byCity.gurgaon, { estate: 2, pass: 1, other: 1, fresh: 1 });
  assert.equal(s.byCity.national.estate, 1, '/pricing counts as national estate even before inspection');
  assert.equal(s.byPageType.locality.other, 1);
  assert.deepEqual(s.transitions, [{ path: '/gurgaon/dlf-phase-1', from: 'PASS', to: 'FAIL', at: NOW.toISOString() }]);
});

test('inspectPaths records per-path failures, retries a 429, and keeps partial results when the quota refuses', async () => {
  const calls: string[] = [];
  let quotaHits = 0;
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { inspectionUrl: string };
    calls.push(body.inspectionUrl);
    if (body.inspectionUrl.endsWith('/bad')) return new Response('not in property', { status: 400 });
    if (body.inspectionUrl.endsWith('/quota')) {
      quotaHits++;
      return new Response('rate limit', { status: 429 });
    }
    return new Response(JSON.stringify({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'ok' } } }), { status: 200 });
  };
  const sleep = async () => undefined;
  const out = await inspectPaths({ site: 's', siteUrl: 'https://x', token: 't', fetchImpl }, ['/ok', '/bad', '/quota', '/never'], { concurrency: 1, sleep });
  assert.deepEqual(out.results.map((r) => r.path), ['/ok']);
  assert.deepEqual(out.failures, [{ path: '/bad', status: 400 }]);
  assert.equal(quotaHits, 4, 'one try plus three retries');
  assert.match(out.stoppedEarly ?? '', /429/);
  assert.ok(!calls.some((c) => c.endsWith('/never')), 'nothing is attempted after the quota refuses');
});

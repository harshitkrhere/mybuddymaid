// Run: npx tsx --test lib/growth/gsc.test.ts
//
// The Search Console aggregation is where a per-city number is born. The invariants that
// matter: positions are impression-weighted (a page with 1 impression at position 1 must
// not drag a city's average down), a keyword with no row stays null rather than becoming 0,
// and the join marks a keyword as off-target when a different URL than the one keywords.csv
// assigns is the one Google shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateByPage, cityPagePattern, joinKeywords, parseSitemapsList, saBody, trackedKeywords, weightedPosition, type SaRow } from './gsc';
import type { KeywordRow } from './keywords';

const row = (keys: string[], impressions: number, clicks: number, position: number): SaRow => ({ keys, impressions, clicks, ctr: impressions ? clicks / impressions : 0, position });
const S = 'https://mybuddymaid.in';

test('weightedPosition weights by impressions and is null with none', () => {
  assert.equal(weightedPosition([{ position: 1, impressions: 1 }, { position: 21, impressions: 99 }]), 20.8);
  assert.equal(weightedPosition([]), null);
});

test('aggregateByPage rolls pages up into city buckets, page types and hosts', () => {
  const rows = [
    row([`${S}/gurgaon/dlf-phase-1/cook`], 100, 5, 8),
    row([`${S}/gurgaon`], 300, 30, 4),
    row([`${S}/`], 50, 10, 2),
    row(['https://www.mybuddymaid.in/gurgaon'], 7, 0, 30),
  ];
  const a = aggregateByPage(rows);
  assert.equal(a.byCity.gurgaon.impressions, 407);
  assert.equal(a.byCity.gurgaon.clicks, 35);
  assert.equal(a.byCity.gurgaon.pages, 3);
  assert.equal(a.byCity.gurgaon.position, 5.4);
  assert.equal(a.byCity.national.impressions, 50);
  assert.equal(a.byPageType['service-locality'].clicks, 5);
  assert.equal(a.hosts['www.mybuddymaid.in'], 7);
});

test('joinKeywords sums rows per query, picks the top page and flags off-target ranking', () => {
  const tracked: KeywordRow[] = [
    { keyword: 'cook in dlf phase 1', targetUrl: '/gurgaon/dlf-phase-1/cook', city: 'gurgaon', priority: 'very-high', pageType: 'service x locality (cook)', targetIndexable: true, index: 0 },
    { keyword: 'maid service in gurgaon', targetUrl: '/gurgaon', city: 'gurgaon', priority: 'very-high', pageType: 'city', targetIndexable: true, index: 1 },
    { keyword: 'never searched', targetUrl: '/gurgaon', city: 'gurgaon', priority: 'high', pageType: 'city', targetIndexable: true, index: 2 },
  ];
  const rows = [
    row(['Cook in DLF Phase 1', `${S}/gurgaon/dlf-phase-1/cook`], 40, 4, 6),
    row(['cook in dlf phase 1', `${S}/gurgaon/dlf-phase-1`], 10, 0, 14),
    row(['maid service in gurgaon', `${S}/services/full-time-maid/gurgaon`], 80, 3, 9),
  ];
  const cur = joinKeywords(tracked, rows);
  const a = cur.get('cook in dlf phase 1');
  assert.ok(a);
  assert.equal(a.impressions, 50);
  assert.equal(a.clicks, 4);
  assert.equal(a.position, 7.6);
  assert.ok(a.onTarget);
  const b = cur.get('maid service in gurgaon');
  assert.ok(b && !b.onTarget, 'a different URL ranking for the query is a cannibalisation signal');
  assert.equal(cur.get('never searched'), undefined);
  const out = trackedKeywords(tracked, cur, new Map());
  assert.equal(out[2].current, null, 'no row → null, never 0');
  assert.equal(out[0].previous, null);
});

test('cityPagePattern matches a city’s hubs and its service × city page, nothing else', () => {
  const re = new RegExp(cityPagePattern('noida', S));
  for (const ok of [`${S}/noida`, `${S}/noida/sector-50`, `${S}/noida/sector-50/cook`, `${S}/services/cook/noida`]) assert.ok(re.test(ok), ok);
  for (const no of [`${S}/greater-noida`, `${S}/greater-noida/gaur-city`, `${S}/services/cook`, `${S}/services/cook/greater-noida`, `${S}/`]) assert.ok(!re.test(no), no);
});

test('saBody asks for final data with the filter group only when a filter is given', () => {
  const w = { start: '2026-09-05', end: '2026-09-11' };
  const plain = saBody(w, ['page'], { aggregationType: 'byPage' });
  assert.equal(plain.dataState, 'final');
  assert.equal(plain.rowLimit, 25000);
  assert.equal('dimensionFilterGroups' in plain, false);
  const filtered = saBody(w, ['query', 'page'], { filters: [{ dimension: 'page', operator: 'includingRegex', expression: '^x' }] });
  assert.equal(filtered.dimensionFilterGroups?.[0].filters[0].operator, 'includingRegex');
});

test('parseSitemapsList sums submitted URLs and strips the site URL from shard paths', () => {
  const json = {
    sitemap: [
      { path: `${S}/sitemaps/gurgaon-hubs-1.xml`, lastDownloaded: '2026-09-10T02:00:00.000Z', isPending: false, errors: '0', warnings: '2', contents: [{ type: 'web', submitted: '55', indexed: '0' }] },
      { path: `${S}/sitemaps/pincodes-1.xml`, isPending: true },
    ],
  };
  const list = parseSitemapsList(json, S);
  assert.deepEqual(list[0], { path: '/sitemaps/gurgaon-hubs-1.xml', submitted: 55, lastDownloaded: '2026-09-10T02:00:00.000Z', isPending: false, errors: 0, warnings: 2 });
  assert.equal(list[1].submitted, null);
  assert.equal(list[1].isPending, true);
});

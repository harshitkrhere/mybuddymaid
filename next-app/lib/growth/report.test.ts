// Run: npx tsx --test lib/growth/report.test.ts
//
// The composer is what the owner reads on Monday. Three things it must never do: invent a
// number for a source that did not report (it writes "n/a"), show a delta against nothing,
// or stay silent when the indexed count falls. The thresholds are pinned here so a change
// to them is a reviewed code change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES } from '../../data/seo';
import { composeBaseline, composeWeeklyReport, fmtDelta, type ReportInputs } from './report';
import type { GscSnapshot, InspectionSummary, SupabaseSnapshot, WeeklySummary } from './types';

const W = { current: { start: '2026-09-05', end: '2026-09-11' }, previous: { start: '2026-08-29', end: '2026-09-04' } };
const metrics = (impressions: number, clicks: number, position: number | null, pages = 10) => ({ impressions, clicks, position, pages });

function gsc(overrides: Partial<GscSnapshot> = {}): GscSnapshot {
  return {
    kind: 'gsc',
    version: 1,
    generatedAt: '2026-09-14T02:47:00Z',
    site: 'sc-domain:mybuddymaid.in',
    windows: W,
    byCity: {
      current: { gurgaon: metrics(1000, 40, 12.4), noida: metrics(500, 10, 18), national: metrics(200, 30, 3) },
      previous: { gurgaon: metrics(800, 50, 14), noida: metrics(400, 8, 19), national: metrics(150, 20, 3.5) },
    },
    byPageType: { current: {}, previous: {} },
    hostsByImpressions: { 'mybuddymaid.in': 1700 },
    topPages: [{ path: '/gurgaon', clicks: 30, impressions: 600 }],
    keywords: [
      { city: 'gurgaon', keyword: 'maid service in gurgaon', targetUrl: '/gurgaon', priority: 'very-high', current: { impressions: 300, clicks: 12, position: 6.2, topPage: 'https://mybuddymaid.in/gurgaon', onTarget: true }, previous: null },
      { city: 'gurgaon', keyword: 'cook in gurgaon', targetUrl: '/services/cook/gurgaon', priority: 'very-high', current: null, previous: null },
    ],
    sitemaps: [{ path: '/sitemaps/gurgaon-hubs-1.xml', submitted: 55, lastDownloaded: '2026-09-10T00:00:00Z', isPending: false, errors: 0, warnings: 0 }],
    expansion: [{ city: 'hyderabad', name: 'Hyderabad', impressions: 90, clicks: 1, queries: 4, topQueries: ['maid in hyderabad'] }],
    errors: [],
    ...overrides,
  };
}

function census(pass: number): InspectionSummary {
  return {
    asOf: '2026-09-14T02:17:00Z',
    estate: 2533,
    inspected: 2533,
    fresh: 2400,
    stale: 133,
    retired: 0,
    byVerdict: { PASS: pass, NEUTRAL: 2533 - pass },
    byCoverageState: { 'Submitted and indexed': pass, 'Crawled - currently not indexed': 2533 - pass },
    byCity: { gurgaon: { estate: 355, pass: 300, other: 55, fresh: 340 } },
    byPageType: { locality: { estate: 342, pass: 300, other: 42, fresh: 330 } },
    transitions: [{ path: '/gurgaon/sector-49/cook', from: 'PASS', to: 'NEUTRAL', at: '2026-09-13T02:17:00Z' }],
  };
}

function supabase(): SupabaseSnapshot {
  const bookings = (total: number) => ({ total, confirmed: 0, byStatus: { pending: total }, byCity: { gurgaon: total }, byService: {}, unmappedCity: 0 });
  return {
    kind: 'supabase',
    version: 1,
    generatedAt: '2026-09-14T02:47:00Z',
    windows: W,
    signups: { current: 4, previous: 2 },
    bookings: { current: bookings(2), previous: bookings(1) },
    support: { current: { conversations: 9, escalated: 3, leadCaptured: 1, byCity: { gurgaon: 5 } }, previous: { conversations: 6, escalated: 2, leadCaptured: 0, byCity: {} } },
    leads: { current: { total: 3, byCity: { gurgaon: 3 }, byService: {}, byStatus: { new: 3 }, staleNew: 12 }, previous: { total: 0, byCity: {}, byService: {}, byStatus: {}, staleNew: 0 } },
    errors: [],
  };
}

function inputs(overrides: Partial<ReportInputs> = {}): ReportInputs {
  return {
    asOf: '2026-09-11',
    generatedAt: '2026-09-14T02:47:00Z',
    windows: W,
    cities: CITIES,
    estateByCity: { gurgaon: 355, noida: 401, delhi: 589, mumbai: 365, pune: 221, bangalore: 220, 'greater-noida': 86, mangalore: 177, national: 119 },
    gsc: gsc(),
    ga4: null,
    bing: null,
    supabase: supabase(),
    census: census(2200),
    previous: null,
    baseline: null,
    notes: ['GA4: not connected'],
    ...overrides,
  };
}

test('fmtDelta renders a signed percentage and stays silent when either side is missing', () => {
  assert.equal(fmtDelta(120, 100), ' (+20%)');
  assert.equal(fmtDelta(80, 100), ' (-20%)');
  assert.equal(fmtDelta(5, 0), ' (new)');
  assert.equal(fmtDelta(null, 100), '');
  assert.equal(fmtDelta(100, null), '');
});

test('the report has a row for every city, Tier 1 first, with n/a for sources that did not report', () => {
  const { markdown, summary } = composeWeeklyReport(inputs());
  const lines = markdown.split('\n');
  const rowFor = (name: string) => lines.find((l) => l.startsWith(`| ${name} |`));
  const gurgaon = rowFor('Gurgaon');
  assert.ok(gurgaon);
  assert.match(gurgaon, /\| 355 \| 300 \| 1000 \(\+25%\) \| 40 \(-20%\) \| 12\.4 \(-1\.6\) \| 6\.2 \(1\/2\) \| n\/a \| n\/a \| n\/a \| n\/a \| 5 \(new\) \| 3 \(new\) \| 2 \(\+100%\) \|/);
  const mangalore = rowFor('Mangalore') as string;
  assert.match(mangalore, /\| 177 \| n\/a \| 0 \| 0 \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| n\/a \| 0 \| 0 \| 0 \|/, 'a city a connected source did not mention had zero, not n/a');
  assert.ok(rowFor('Mangalore'), 'Tier-2 cities are present');
  assert.ok(lines.indexOf(rowFor('Pune') as string) < lines.indexOf(rowFor('Greater Noida') as string), 'Tier 1 before Tier 2');
  assert.match(markdown, /- GA4: not connected/);
  assert.match(markdown, /cook in gurgaon \| — \| — \| — \| — \|/, 'a keyword with no impressions shows a dash, never 0');
  assert.match(markdown, /Hyderabad \| 90 \| 1 \| 4/);
  assert.match(markdown, /1 URL\(s\) left PASS/);
  assert.equal(summary.cities.gurgaon.impressions, 1000);
  assert.equal(summary.site.indexedPass, 2200);
  assert.equal(summary.site.organicSessions, null);
});

test('alerts fire on an indexed-count drop, a stale-lead backlog and a www host, and respect the noise guards', () => {
  const previous: WeeklySummary = { asOf: '2026-09-04', windows: W, cities: {}, site: { indexedPass: 2500 }, alerts: [] };
  const { alerts } = composeWeeklyReport(inputs({ previous, gsc: gsc({ hostsByImpressions: { 'mybuddymaid.in': 1000, 'www.mybuddymaid.in': 120 } }) }));
  const ids = alerts.map((a) => a.id);
  assert.ok(ids.includes('gsc-indexed-drop'), '2200 vs 2500 is a 12% drop');
  assert.ok(ids.includes('stale-leads'));
  assert.ok(ids.includes('canonical-host:www.mybuddymaid.in'));
  assert.ok(!ids.includes('tier1-clicks-drop'), 'a click drop on fewer than 50 previous clicks is noise');
  assert.equal(alerts.find((a) => a.id === 'gsc-indexed-drop')?.severity, 'critical');
  const quiet = composeWeeklyReport(inputs({ previous: { ...previous, site: { indexedPass: 2210 } }, supabase: null, gsc: gsc({ hostsByImpressions: { 'mybuddymaid.in': 1000, 'www.mybuddymaid.in': 6 } }) }));
  assert.deepEqual(quiet.alerts, [], 'a handful of stray www impressions is noise, not an alert');
});

test('the baseline table says which sources were not connected instead of carrying a zero', () => {
  const i = inputs({ supabase: null, census: null });
  const md = composeBaseline(i, composeWeeklyReport(i));
  assert.match(md, /\| Signups \| n\/a — source not connected \|/);
  assert.match(md, /\| Impressions, all cities \| 1700 \|/);
  assert.match(md, /\| Indexed pages, Google \(PASS census\) \| n\/a — source not connected \|/);
});

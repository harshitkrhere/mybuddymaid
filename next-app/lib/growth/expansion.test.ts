// Run: npx tsx --test lib/growth/expansion.test.ts
//
// The locality lock says demand outside the footprint is logged, never built for. The log
// must therefore never count a served city under another spelling (Gurugram, Navi Mumbai,
// Noida Extension are served), must match city names as whole words ("hyderabadi cook" is
// not Hyderabad demand), and must keep a bounded, dated history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ZONES } from '../../data/seo';
import { mergeExpansionLog, outsideFootprintCandidates, outsideFootprintDemand } from './expansion';

const legacy = [
  { slug: 'hyderabad', name: 'Hyderabad' },
  { slug: 'gurugram', name: 'Gurugram' },
  { slug: 'navi-mumbai', name: 'Navi Mumbai' },
  { slug: 'greater-noida-west', name: 'Greater Noida West' },
  { slug: 'chennai', name: 'Chennai' },
  { slug: 'thane', name: 'Thane' },
];

test('served cities and zones are excluded from the candidate list under any spelling', () => {
  const c = outsideFootprintCandidates(legacy, CITIES, ZONES);
  assert.deepEqual(c.map((x) => x.slug), ['hyderabad', 'chennai', 'thane']);
});

test('demand is matched on whole words and ranked by impressions', () => {
  const candidates = outsideFootprintCandidates(legacy, CITIES, ZONES);
  const row = (q: string, impressions: number, clicks = 0) => ({ keys: [q], impressions, clicks, ctr: 0, position: 10 });
  const rows = outsideFootprintDemand(
    [row('maid in hyderabad', 120, 2), row('Hyderabad cook service', 30), row('hyderabadi cook recipe', 500), row('maid agency chennai', 200, 1), row('cook in noida', 900)],
    candidates,
  );
  assert.deepEqual(
    rows.map((r) => [r.city, r.impressions, r.clicks, r.queries]),
    [
      ['chennai', 200, 1, 1],
      ['hyderabad', 150, 2, 2],
    ],
  );
  assert.deepEqual(rows[1].topQueries, ['maid in hyderabad', 'Hyderabad cook service']);
});

test('mergeExpansionLog prepends the week, replaces a re-run of the same week and keeps a bounded history', () => {
  const rows = [{ city: 'hyderabad', name: 'Hyderabad', impressions: 150, clicks: 2, queries: 2, topQueries: ['maid in hyderabad'] }];
  const first = mergeExpansionLog(null, rows, '2026-09-11');
  assert.match(first, /^# Expansion candidates/);
  assert.match(first, /## Week ending 2026-09-11/);
  const second = mergeExpansionLog(first, [], '2026-09-18');
  assert.ok(second.indexOf('2026-09-18') < second.indexOf('2026-09-11'), 'newest first');
  const rerun = mergeExpansionLog(second, rows, '2026-09-18');
  assert.equal(rerun.match(/## Week ending 2026-09-18/g)?.length, 1);
  let log: string | null = null;
  for (let i = 1; i <= 30; i++) log = mergeExpansionLog(log, [], `2026-10-${String(i).padStart(2, '0')}`, 26);
  assert.equal(log?.match(/## Week ending/g)?.length, 26);
});

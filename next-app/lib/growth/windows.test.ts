// Run: npx tsx --test lib/growth/windows.test.ts
//
// Every growth snapshot is keyed by the window end and carries a "previous" window, so a
// wrong day here would misalign Search Console, GA4, Bing and the database counts against
// each other silently. The defaults are pinned: a three-day lag and two adjacent 7-day windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, defaultEnd, inWindow, isIsoDate, weeklyWindows } from './windows';

test('weeklyWindows gives two adjacent, non-overlapping 7-day windows ending on the given day', () => {
  const w = weeklyWindows('2026-09-11');
  assert.deepEqual(w.current, { start: '2026-09-05', end: '2026-09-11' });
  assert.deepEqual(w.previous, { start: '2026-08-29', end: '2026-09-04' });
  assert.equal(daysBetween(w.current.start, w.current.end), 6);
  assert.equal(addDays(w.previous.end, 1), w.current.start);
});

test('defaultEnd lags the run date by three days (Search Console data is final by then)', () => {
  assert.equal(defaultEnd(new Date('2026-09-14T08:17:00Z')), '2026-09-11');
  assert.equal(defaultEnd(new Date('2026-03-02T00:00:00Z')), '2026-02-27');
});

test('inWindow compares by UTC day and includes both ends', () => {
  const w = { start: '2026-09-05', end: '2026-09-11' };
  assert.ok(inWindow('2026-09-05T00:00:00Z', w));
  assert.ok(inWindow('2026-09-11T23:59:59.999Z', w));
  assert.ok(!inWindow('2026-09-12T00:00:00Z', w));
  assert.ok(!inWindow('2026-09-04', w));
});

test('a non-date window end is rejected rather than producing NaN windows', () => {
  assert.ok(!isIsoDate('2026-9-1'));
  assert.ok(!isIsoDate('2026-13-40'));
  assert.throws(() => weeklyWindows('yesterday'));
});

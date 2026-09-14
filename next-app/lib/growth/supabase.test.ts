// Run: npx tsx --test lib/growth/supabase.test.ts
//
// bookings.city is free text today ("Sector 50, Noida", "Bengaluru"), so the per-city booking
// count depends on a normaliser that prefers the longest matching name — "Greater Noida" must
// not be counted as Noida — and admits it cannot map a city it does not serve. Leads are
// counted only once the table exists; before that the snapshot says null, not 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, ZONES } from '../../data/seo';
import { bookingCounts, buildSupabaseSnapshot, leadCounts, normaliseCityText, supportCounts } from './supabase';

const W = { current: { start: '2026-09-05', end: '2026-09-11' }, previous: { start: '2026-08-29', end: '2026-09-04' } };

test('normaliseCityText maps free text through city, alt and zone names, longest first', () => {
  assert.equal(normaliseCityText('Sector 50, Noida', CITIES, ZONES), 'noida');
  assert.equal(normaliseCityText('Gaur City, Greater Noida West', CITIES, ZONES), 'greater-noida');
  assert.equal(normaliseCityText('Navi Mumbai', CITIES, ZONES), 'mumbai');
  assert.equal(normaliseCityText('Bengaluru', CITIES, ZONES), 'bangalore');
  assert.equal(normaliseCityText('Gurugram', CITIES, ZONES), 'gurgaon');
  assert.equal(normaliseCityText('Chennai', CITIES, ZONES), null);
  assert.equal(normaliseCityText('', CITIES, ZONES), null);
});

test('bookingCounts uses city_slug when present, counts confirmed statuses and unmapped cities', () => {
  const rows = [
    { created_at: '2026-09-06T10:00:00Z', status: 'pending', service: 'cook', city: 'DLF Phase 1, Gurgaon', city_slug: null },
    { created_at: '2026-09-07T10:00:00Z', status: 'active', service: 'cook', city: 'anything', city_slug: 'noida' },
    { created_at: '2026-09-08T10:00:00Z', status: 'completed', service: 'full-time-maid', city: 'Chennai' },
    { created_at: '2026-08-30T10:00:00Z', status: 'pending', service: 'cook', city: 'Pune' },
  ];
  const c = bookingCounts(rows, W.current, CITIES, ZONES);
  assert.equal(c.total, 3);
  assert.equal(c.confirmed, 2);
  assert.deepEqual(c.byCity, { gurgaon: 1, noida: 1 });
  assert.equal(c.unmappedCity, 1);
  assert.deepEqual(c.byStatus, { pending: 1, active: 1, completed: 1 });
  assert.equal(bookingCounts(rows, W.previous, CITIES, ZONES).byCity.pune, 1);
});

test('support and lead counts respect the window; stale leads are counted across all time', () => {
  const s = supportCounts(
    [
      { started_at: '2026-09-06T10:00:00Z', city_slug: 'gurgaon', escalated: true, outcome: 'lead_captured' },
      { started_at: '2026-09-06T11:00:00Z', city_slug: null, escalated: false, outcome: null },
      { started_at: '2026-08-01T10:00:00Z', city_slug: 'gurgaon', escalated: true, outcome: null },
    ],
    W.current,
  );
  assert.deepEqual(s, { conversations: 2, escalated: 1, leadCaptured: 1, byCity: { gurgaon: 1 } });
  const now = new Date('2026-09-14T09:00:00Z');
  const l = leadCounts(
    [
      { created_at: '2026-09-06T10:00:00Z', status: 'new', city_slug: 'noida', service_slug: 'cook' },
      { created_at: '2026-09-13T20:00:00Z', status: 'new', city_slug: 'noida', service_slug: 'cook' },
      { created_at: '2026-09-07T10:00:00Z', status: 'contacted', city_slug: 'pune', service_slug: null },
    ],
    W.current,
    now,
  );
  assert.equal(l.total, 2);
  assert.equal(l.staleNew, 1, 'only the lead older than 24 h is stale');
  assert.deepEqual(l.byStatus, { new: 1, contacted: 1 });
});

test('the snapshot reports leads as null until the table exists', () => {
  const snap = buildSupabaseSnapshot({
    generatedAt: '2026-09-14T02:47:00Z',
    now: new Date('2026-09-14T02:47:00Z'),
    windows: W,
    signups: [{ created_at: '2026-09-06T00:00:00Z' }, { created_at: '2026-09-01T00:00:00Z' }],
    bookings: [],
    support: [],
    leads: null,
    cities: CITIES,
    zones: ZONES,
    errors: [],
  });
  assert.equal(snap.leads, null);
  assert.deepEqual(snap.signups, { current: 1, previous: 1 });
});

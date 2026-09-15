// Run: npx tsx --test lib/seo-engine/entity-match.test.ts
//
// The society a customer typed is the first demand signal the Phase 5 entity list has had.
// Matching must be conservative — a wrong match prefills `serve? = y` on the wrong society,
// which is a fabricated fact — so: same locality only, whole-name or unambiguous containment,
// two plausible candidates is no match. The worksheet order puts named societies first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Entity } from '../../data/seo/types';
import { aggregatePlacements, attachSignals, matchEntity, signalLabel, societyKey, worksheetRank } from './entity-match';

const entity = (city: string, locality: string, slug: string, name: string, altNames: string[] = []): Entity => ({
  slug,
  city: city as Entity['city'],
  locality,
  kind: 'society',
  name,
  altNames,
  pincode: '122010',
  facts: {},
  source: 'test',
  licence: 'test',
  status: 'draft',
  updatedAt: '2026-09-15',
});

test('societyKey drops case, punctuation and the words that only say "housing"', () => {
  assert.equal(societyKey('DLF Park Place Society'), 'dlf park place');
  assert.equal(societyKey('Mahagun Moderne Apartments, Tower-4'), 'mahagun moderne tower 4');
  assert.equal(societyKey('  Shree Ganesh CHS Ltd '), 'shree ganesh');
  assert.equal(societyKey(null), '');
});

test('matchEntity: exact name or alt name, else one unambiguous containment, else nothing', () => {
  const cands = [
    { slug: 'mahagun-moderne', name: 'Mahagun Moderne', altNames: ['MAHAGUN MODERNE'] },
    { slug: 'mahagun-mywoods', name: 'Mahagun Mywoods' },
    { slug: 'park-place', name: 'DLF Park Place' },
  ];
  assert.equal(matchEntity('mahagun moderne society', cands)?.slug, 'mahagun-moderne');
  assert.equal(matchEntity('Mahagun Moderne Tower 4', cands)?.slug, 'mahagun-moderne', 'contains the whole candidate name');
  assert.equal(matchEntity('Park Place', cands)?.slug, 'park-place', 'contained in the candidate name');
  assert.equal(matchEntity('Mahagun', cands), null, 'two candidates could be meant, and the key is too short');
  assert.equal(matchEntity('Mahagun Marvella', cands), null);
  assert.equal(matchEntity('', cands), null);
});

test('aggregatePlacements groups bookings and requests per society within a locality, spelling variants together', () => {
  const rows = aggregatePlacements(
    [
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: 'DLF Park Place', entity_slug: null, created_at: '2026-09-10T10:00:00Z' },
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: 'dlf park place society', entity_slug: null, created_at: '2026-09-12T10:00:00Z' },
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: null, entity_slug: 'park-place', created_at: '2026-09-01T10:00:00Z' },
      { city_slug: null, locality_slug: null, society: 'ignored: no locality', entity_slug: null, created_at: '2026-09-01T10:00:00Z' },
    ],
    [{ city_slug: 'pune', locality_slug: 'bavdhan', society: 'Srishti Vihar', entity_slug: null, created_at: '2026-09-15T04:00:00Z' }],
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { city: 'gurgaon', locality: 'dlf-phase-3', entity_slug: null, society: 'DLF Park Place', societyKey: 'dlf park place', bookings: 2, leads: 0, last: '2026-09-12' });
  assert.equal(rows[1].entity_slug, 'park-place');
  assert.deepEqual(rows[2], { city: 'pune', locality: 'bavdhan', entity_slug: null, society: 'Srishti Vihar', societyKey: 'srishti vihar', bookings: 0, leads: 1, last: '2026-09-15' });
});

test('attachSignals credits the entity in the same locality and lists the rest as unmatched', () => {
  const entities = [entity('gurgaon', 'dlf-phase-3', 'park-place', 'DLF Park Place'), entity('gurgaon', 'dlf-phase-1', 'park-place', 'Park Place (Phase 1)')];
  const rows = aggregatePlacements(
    [
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: 'park place', entity_slug: null, created_at: '2026-09-10T10:00:00Z' },
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: null, entity_slug: 'park-place', created_at: '2026-09-11T10:00:00Z' },
      { city_slug: 'gurgaon', locality_slug: 'dlf-phase-3', society: 'Nowhere Heights', entity_slug: null, created_at: '2026-09-09T10:00:00Z' },
    ],
    [],
  );
  const { matched, unmatched } = attachSignals(rows, entities);
  assert.deepEqual(matched.get('gurgaon/dlf-phase-3/park-place'), { bookings: 2, leads: 0, last: '2026-09-11', society: 'park place' });
  assert.equal(matched.has('gurgaon/dlf-phase-1/park-place'), false, 'never across localities');
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].society, 'Nowhere Heights');
  assert.equal(signalLabel(matched.get('gurgaon/dlf-phase-3/park-place')), '2 bookings · last 2026-09-11');
  assert.equal(signalLabel(undefined), '');
});

test('worksheetRank: named societies first (bookings before requests), then Tier 1, then hero localities', () => {
  const r = (signal: { bookings: number; leads: number } | undefined, tier: 1 | 2, hero: boolean) => worksheetRank({ signal: signal ? { ...signal, last: '2026-09-15', society: null } : undefined, tier, heroLocality: hero });
  assert.ok(r({ bookings: 1, leads: 0 }, 2, false) < r({ bookings: 0, leads: 3 }, 1, true), 'one booking beats any number of requests');
  assert.ok(r({ bookings: 0, leads: 1 }, 2, false) < r(undefined, 1, true), 'one request beats no signal');
  assert.ok(r(undefined, 1, false) < r(undefined, 2, true), 'Tier 1 before Tier 2');
  assert.ok(r(undefined, 1, true) < r(undefined, 1, false), 'hero locality first within a tier');
  assert.ok(r({ bookings: 3, leads: 0 }, 1, true) < r({ bookings: 1, leads: 5 }, 1, true), 'more bookings first');
});

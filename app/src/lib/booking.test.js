// Run: npm test (vitest) from app/
//
// The bookings row gains the data layer's location columns with the 2026-09-15 migration,
// which the owner applies by hand. The app must work on both sides of that moment: write the
// full row, and on PostgREST's "unknown column" answer write the row the old table accepts.
import { expect, test } from 'vitest';
import { bookingRow, legacyBookingRow, isUnknownColumnError, LEGACY_COLUMNS, LOCATION_COLUMNS } from './booking';

const INPUT = {
  service_type: 'cook',
  email: 'a@b.c',
  phone: '9876543210',
  city: 'DLF Phase 3, Gurgaon',
  notes: '',
  city_slug: 'gurgaon',
  locality_slug: 'dlf-phase-3',
  pincode: '122010',
  society: '  Tower  B ',
  attribution: { last: { gclid: 'x' }, first: null },
};

test('bookingRow carries the old columns unchanged and the new ones in data-layer shape', () => {
  const row = bookingRow(INPUT, { userId: 'u1', profileCity: 'Noida' });
  expect(row).toMatchObject({
    user_id: 'u1',
    service: 'cook',
    city: 'DLF Phase 3, Gurgaon',
    status: 'pending',
    city_slug: 'gurgaon',
    locality_slug: 'dlf-phase-3',
    pincode: '122010',
    society: 'Tower B',
    attribution: { last: { gclid: 'x' }, first: null },
  });
  expect(Object.keys(row).sort()).toEqual([...LEGACY_COLUMNS, ...LOCATION_COLUMNS].sort());
  expect(bookingRow({ service_type: 'cook' }, { userId: 'u1', profileCity: 'Noida' })).toMatchObject({ city: 'Noida', city_slug: null, society: null, attribution: null });
});

test('legacyBookingRow is the same booking without the columns the old table lacks', () => {
  const legacy = legacyBookingRow(bookingRow(INPUT, { userId: 'u1' }));
  expect(Object.keys(legacy).sort()).toEqual([...LEGACY_COLUMNS].sort());
  expect(legacy.city).toBe('DLF Phase 3, Gurgaon');
});

test('isUnknownColumnError recognises PostgREST’s answer and nothing else', () => {
  expect(isUnknownColumnError({ code: 'PGRST204', message: "Could not find the 'society' column of 'bookings' in the schema cache" })).toBe(true);
  expect(isUnknownColumnError({ message: 'column "attribution" of relation "bookings" does not exist' })).toBe(true);
  expect(isUnknownColumnError({ code: '23514', message: 'new row violates check constraint' })).toBe(false);
  expect(isUnknownColumnError(null)).toBe(false);
});

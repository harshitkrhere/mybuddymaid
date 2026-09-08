// Run: npm test (vitest) from app/
//
// FIN-U03: the booking sheet said "Booking Confirmed!" for a row written with
// status 'pending', then redirected to a list that shows it as Pending two seconds later.
// A request is received; a person confirms it. Source-level, like the other copy
// assertions: the string is the defect.
import { expect, test } from 'vitest';
import source from './ServiceDetailPage.jsx?raw';

test('the booking success sheet reports a received request, not a confirmed booking (FIN-U03)', () => {
  const success = source.match(/className="booking-success"[\s\S]*?<\/div>/);
  expect(success, 'the booking-success block').not.toBeNull();
  expect(success[0]).toContain('Request received');
  expect(success[0]).not.toMatch(/confirmed/i);
});

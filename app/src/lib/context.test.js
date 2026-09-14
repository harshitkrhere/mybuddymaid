// Run: npm test (vitest) from app/
//
// FIN-B02 / FIN-B09: the site's "Book in the app" link carried city, locality and service in
// its query string and the app threw them away. The context module is the fix: parse only
// what the data layer knows, keep it for the session, route once, pre-fill for the rest.
import { beforeEach, expect, test } from 'vitest';
import { CONTEXT_KEY, parseContext, captureContext, readContext, destinationFor, markRouted, fromLegacy } from './context';

beforeEach(() => sessionStorage.clear());

test('parseContext keeps only values the data layer knows', () => {
  const ctx = parseContext('?city=gurgaon&locality=dlf-phase-3&service=cook&plan=gold');
  expect(ctx).toMatchObject({ city: 'gurgaon', locality: 'dlf-phase-3', service: 'cook', serviceSlug: 'cook', plan: 'gold' });
  expect(parseContext('?city=jaipur&locality=c-scheme')).toBeNull();
  // a locality is only kept under its own city
  const wrongCity = parseContext('?city=noida&locality=dlf-phase-3');
  expect(wrongCity.city).toBe('noida');
  expect(wrongCity.locality).toBeUndefined();
  expect(parseContext('?service=plumber&plan=platinum')).toBeNull();
  expect(parseContext('')).toBeNull();
});

test('a data-layer service maps to the app’s own id; one the app does not list keeps the slug only', () => {
  expect(parseContext('?service=babysitter-nanny')).toMatchObject({ service: 'nanny', serviceSlug: 'babysitter-nanny' });
  expect(parseContext('?service=elder-care').service).toBe('elderly-care');
  expect(parseContext('?service=domestic-help')).toMatchObject({ service: null, serviceSlug: 'domestic-help' });
});

test('captureContext stores a valid context and leaves an existing one alone when the URL has none', () => {
  captureContext('?city=pune&locality=kothrud&service=cook');
  expect(readContext()).toMatchObject({ city: 'pune', locality: 'kothrud', service: 'cook' });
  captureContext('');
  expect(readContext()).toMatchObject({ city: 'pune' });
  captureContext('?city=mumbai');
  expect(readContext().city).toBe('mumbai');
});

test('destinationFor: the service page, the services list for an area or an unlisted service, pricing for a plan', () => {
  expect(destinationFor({ service: 'cook' })).toBe('/services/cook');
  expect(destinationFor({ serviceSlug: 'domestic-help', service: null })).toBe('/services');
  expect(destinationFor({ city: 'gurgaon', locality: 'dlf-phase-3' })).toBe('/services');
  expect(destinationFor({ plan: 'gold' })).toBe('/pricing');
  expect(destinationFor({ intent: 'book' })).toBe('/services');
  expect(destinationFor(null)).toBeNull();
  expect(destinationFor({ service: 'cook', routed: true })).toBeNull();
});

test('markRouted stops the context routing again but keeps it for pre-filling', () => {
  captureContext('?city=gurgaon&locality=dlf-phase-3&service=cook');
  expect(destinationFor(readContext())).toBe('/services/cook');
  markRouted();
  expect(destinationFor(readContext())).toBeNull();
  expect(readContext()).toMatchObject({ city: 'gurgaon', locality: 'dlf-phase-3', routed: true });
});

test('the pre-2026-09 bare-string value still works, and a corrupt value reads as nothing', () => {
  expect(fromLegacy('cook')).toMatchObject({ service: 'cook', serviceSlug: 'cook' });
  expect(fromLegacy('postnatal')).toMatchObject({ service: 'postnatal', serviceSlug: null });
  expect(fromLegacy('gold')).toEqual({ plan: 'gold' });
  expect(fromLegacy('book')).toEqual({ intent: 'book' });
  expect(fromLegacy('nonsense')).toBeNull();
  sessionStorage.setItem(CONTEXT_KEY, 'nanny');
  expect(destinationFor(readContext())).toBe('/services/nanny');
  sessionStorage.setItem(CONTEXT_KEY, '{not json');
  expect(readContext()).toBeNull();
});

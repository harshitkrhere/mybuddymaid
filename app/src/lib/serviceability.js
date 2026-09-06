// app/src/lib/serviceability.js — the booking app's view of the service footprint.
//
// The data comes from next-app/data/seo via
// `npm run seo:export-spa` (next-app/scripts/seo/export-serviceability.ts), which writes
// serviceability.json. Nothing here is hand-maintained: the SEO pages, the sitemaps and
// this booking form all read the same single source of truth, so an area we do not serve
// can never be offered here.
import data from './serviceability.json';

export const CITIES = data.cities;
export const LOCALITIES = data.localities;
export const SERVICES_LIST = data.services;
export const PINCODES = data.pincodes;

/** Localities we serve in a city, alphabetically. */
export function localitiesForCity(citySlug) {
  return LOCALITIES.filter((l) => l.city === citySlug);
}

export function cityBySlug(slug) {
  return CITIES.find((c) => c.slug === slug) || null;
}

export function localityBySlug(citySlug, localitySlug) {
  return LOCALITIES.find((l) => l.city === citySlug && l.slug === localitySlug) || null;
}

/** True when a 6-digit pincode is inside the service footprint. */
export function isServiceablePincode(pin) {
  return Object.prototype.hasOwnProperty.call(PINCODES, String(pin).trim());
}

/** Resolve a pincode to { city, localities: [{slug,name}] }, or null if not served. */
export function lookupPincode(pin) {
  const rec = PINCODES[String(pin).trim()];
  if (!rec) return null;
  return {
    city: cityBySlug(rec.city),
    localities: rec.localities.map((s) => localityBySlug(rec.city, s)).filter(Boolean),
  };
}

/**
 * The string stored in the bookings.city column. The column predates the locality data
 * model and is a free-text field, so we write "Locality, City" when we have both — it is
 * what the operations team needs to see — and just the city name otherwise.
 */
export function bookingLocationLabel(citySlug, localitySlug) {
  const c = cityBySlug(citySlug);
  const l = localitySlug ? localityBySlug(citySlug, localitySlug) : null;
  if (!c) return '';
  return l ? `${l.name}, ${c.name}` : c.name;
}

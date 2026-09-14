// app/src/lib/booking.js — the row createBooking writes, and the fallback while the database
// is behind the code.
//
// The 2026-09-15 migration (supabase/migrations/20260915120000_leads_and_placement_locality.sql)
// gives bookings the same location shape as the SEO data layer — city_slug, locality_slug,
// pincode, society — plus attribution (how the visitor arrived), so every booking is a demand
// signal for a specific society and the Phase 5 society list can be built from real
// placements. The owner applies migrations by hand, and the app must not depend on the order:
// PostgREST rejects a row naming a column it does not know (PGRST204), so on that error the
// insert is retried with the columns that have always existed. The booking is never lost;
// only its location detail is, until the migration lands.
export const LEGACY_COLUMNS = ['user_id', 'service', 'email', 'phone', 'city', 'notes', 'status'];
export const LOCATION_COLUMNS = ['city_slug', 'locality_slug', 'pincode', 'society', 'attribution'];

/** How the visitor arrived, as index.html recorded it (the same keys as the site); null when unknown. */
export function readAttribution() {
  try {
    const last = JSON.parse(sessionStorage.getItem('mbm_attr') || 'null');
    const first = JSON.parse(localStorage.getItem('mbm_first_attr') || 'null');
    return last || first ? { last, first } : null;
  } catch {
    return null;
  }
}

export function bookingRow(input, { userId, profileCity }) {
  const society = typeof input.society === 'string' ? input.society.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  return {
    user_id: userId,
    service: input.service_type,
    email: input.email || '',
    phone: input.phone || '',
    city: input.city || profileCity || 'Delhi',
    notes: input.notes || '',
    status: 'pending',
    city_slug: input.city_slug || null,
    locality_slug: input.locality_slug || null,
    pincode: input.pincode || null,
    society: society || null,
    attribution: input.attribution || null,
  };
}

/** The same booking with only the columns that exist before the migration. */
export function legacyBookingRow(row) {
  const out = {};
  for (const k of LEGACY_COLUMNS) out[k] = row[k];
  return out;
}

/** PostgREST's answer to a column it has not heard of. */
export function isUnknownColumnError(err) {
  if (!err) return false;
  if (err.code === 'PGRST204') return true;
  const m = String(err.message || '');
  return /column .* does not exist/i.test(m) || (/schema cache/i.test(m) && /column/i.test(m));
}

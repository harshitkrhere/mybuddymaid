-- ═══════════════════════════════════════════════════════════════
-- PROPOSAL — NOT APPLIED. Review docs/seo/leads-schema-proposal.md first.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor) after approval.
--
-- Two things:
--   1. the `leads` table the SEO site's lead form has been waiting on
--      (next-app/app/api/lead/route.ts; LEADS_ENABLED / NEXT_PUBLIC_LEADS_ENABLED)
--   2. locality / pincode / society columns on `bookings`, so a placement can be
--      attributed to the data layer instead of a free-text city
--
-- Both write the SAME location shape the SEO data layer uses (city slug, locality
-- slug, 6-digit pincode, optional entity slug), so every future lead and booking is a
-- demand signal for a specific society, and the Phase 5 entity list can be built
-- from real placements instead of the owner's memory.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. LEADS ─────────────────────────────────────────────────
-- Unauthenticated: the location pages post here through the Next.js route, which
-- validates every location value against next-app/data/seo before it reaches the DB
-- and inserts with the service-role key. Browsers never touch this table directly.

CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone         TEXT NOT NULL CHECK (phone ~ '^[0-9]{10}$'),
  -- location, in data-layer shape. The route already rejects anything outside the
  -- footprint; the CHECKs are the second line of defence.
  city_slug     TEXT NOT NULL CHECK (city_slug ~ '^[a-z0-9-]+$'),
  locality_slug TEXT NOT NULL CHECK (locality_slug ~ '^[a-z0-9-]+$'),
  pincode       TEXT CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$'),
  -- Phase 5: the entity page the lead came from, if any (data/seo/entities.json slug)
  entity_slug   TEXT CHECK (entity_slug IS NULL OR entity_slug ~ '^[a-z0-9-]+$'),
  -- what the customer typed for their society/building, verbatim; this is the raw
  -- material for new entity candidates and is never rendered anywhere
  society       TEXT CHECK (society IS NULL OR char_length(society) <= 120),
  service_slug  TEXT CHECK (service_slug IS NULL OR service_slug ~ '^[a-z0-9-]+$'),
  source_page   TEXT CHECK (source_page IS NULL OR char_length(source_page) <= 300),
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'contacted', 'converted', 'unserviceable', 'spam')),
  -- set when the lead becomes a booking, so conversion per society is measurable
  booking_id    UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: nothing but the service role (the Next.js route, the owner's
-- dashboard tooling) may read or write leads. This matches email_logs after the
-- security migration (H1). Do NOT add an anon INSERT policy — the route validates the
-- footprint and a direct anon insert would bypass that.

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_locality   ON leads (city_slug, locality_slug);
CREATE INDEX IF NOT EXISTS idx_leads_entity     ON leads (city_slug, locality_slug, entity_slug)
  WHERE entity_slug IS NOT NULL;

-- ─── 2. BOOKINGS: attributable location ───────────────────────
-- `city` stays as-is (free text, used by the booking app today). The new columns are
-- nullable so existing rows and the current app keep working; the app is then updated
-- to fill them from app/src/lib/serviceability.json (exported by `npm run seo:export-spa`).

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_slug     TEXT CHECK (city_slug IS NULL OR city_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locality_slug TEXT CHECK (locality_slug IS NULL OR locality_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pincode       TEXT CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entity_slug   TEXT CHECK (entity_slug IS NULL OR entity_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS society       TEXT CHECK (society IS NULL OR char_length(society) <= 120);

CREATE INDEX IF NOT EXISTS idx_bookings_locality ON bookings (city_slug, locality_slug)
  WHERE locality_slug IS NOT NULL;

-- The restricted UPDATE policy from security-migration.sql (H2) already limits users
-- to their own rows; the app only ever writes notes/city/society/locality from the UI.
-- No policy change is needed for these columns.

-- ─── 3. PLACEMENT ROLL-UP used by the entity importer ──────────
-- One row per society we have actually placed in, with the demand signal. This is what
-- `scripts/seo/import-entities.ts --placements` will read (service role, read-only).

CREATE OR REPLACE VIEW placement_societies AS
SELECT
  city_slug,
  locality_slug,
  entity_slug,
  lower(trim(society))                       AS society_key,
  max(society)                               AS society,
  min(pincode)                               AS pincode,
  count(*) FILTER (WHERE status IN ('active', 'completed')) AS placements,
  count(*)                                   AS bookings,
  max(created_at)                            AS last_booking_at
FROM bookings
WHERE locality_slug IS NOT NULL
  AND (society IS NOT NULL OR entity_slug IS NOT NULL)
GROUP BY city_slug, locality_slug, entity_slug, lower(trim(society));

-- Views do not carry RLS; keep this view readable by the service role only.
REVOKE ALL ON placement_societies FROM anon, authenticated;

-- ─── VERIFICATION (run after applying) ────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('leads','bookings');
--   expected: both true
-- SELECT policyname FROM pg_policies WHERE tablename = 'leads';
--   expected: no rows (service role only)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'
--   AND column_name IN ('city_slug','locality_slug','pincode','entity_slug','society');
--   expected: 5 rows

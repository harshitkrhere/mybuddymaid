-- ═══════════════════════════════════════════════════════════════
-- Leads, and attributable bookings — Phase 1 task 1.4 (AUDIT/18-REMEDIATION-PLAN.md),
-- growth plan W2 Tranche B. Proposed on 2026-09-06 (docs/seo/leads-schema-proposal.md),
-- promoted from migrations-pending/ on 2026-09-15 with `attribution` and
-- `chatwoot_conversation_id` added.
--
-- APPLYING IT IS THE OWNER'S STEP. Additive only: one new table, one new view, six
-- nullable columns on bookings. Nothing existing is modified, and every statement is
-- idempotent, so running it twice (SQL editor now, `supabase db push` later) is harmless.
--
-- It ships in the same pull request as the code that depends on it:
--   next-app/app/api/lead/route.ts    inserts city_slug / locality_slug / service_slug /
--                                     entity_slug / society / attribution (FIN-B03)
--   app/src/context/AuthContext.jsx   writes the new bookings columns, and falls back to
--                                     the old column set while this file is not yet applied
--   next-app/lib/leads/schema.test.ts pins the route's insert columns to this file
--
-- Two things:
--   1. the `leads` table the SEO site's call-back form has been waiting on
--      (LEADS_ENABLED / NEXT_PUBLIC_LEADS_ENABLED stay off until this is applied)
--   2. locality / pincode / society / attribution columns on `bookings`, so a placement can
--      be attributed to the data layer instead of a free-text city
--
-- Both write the SAME location shape the SEO data layer uses (city slug, locality slug,
-- 6-digit pincode, optional entity slug), so every future lead and booking is a demand
-- signal for a specific society, and the Phase 5 entity list can be built from real
-- placements instead of the owner's memory.
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
  -- how the visitor arrived — utm_* values, an ad click id, the referrer, the landing
  -- page — as the site's analytics bootstrap recorded it: {"last": {...}, "first": {...}}.
  -- Whitelisted keys only, written by the route; never a name, e-mail or phone number.
  attribution   JSONB CHECK (attribution IS NULL OR jsonb_typeof(attribution) = 'object'),
  -- the Chatwoot conversation the route opened in the team's inbox for this request, so
  -- the weekly report can count leads that reached the inbox and the team can find the
  -- thread from the row
  chatwoot_conversation_id BIGINT,
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
-- nullable so existing rows keep working; the booking app fills them from
-- app/src/lib/serviceability.json (exported by `npm run seo:export-spa`), and until this
-- file is applied it retries with the old column set, so no booking is lost either way.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_slug     TEXT CHECK (city_slug IS NULL OR city_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS locality_slug TEXT CHECK (locality_slug IS NULL OR locality_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pincode       TEXT CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS entity_slug   TEXT CHECK (entity_slug IS NULL OR entity_slug ~ '^[a-z0-9-]+$');
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS society       TEXT CHECK (society IS NULL OR char_length(society) <= 120);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS attribution   JSONB CHECK (attribution IS NULL OR jsonb_typeof(attribution) = 'object');

CREATE INDEX IF NOT EXISTS idx_bookings_locality ON bookings (city_slug, locality_slug)
  WHERE locality_slug IS NOT NULL;

-- The restricted UPDATE grant (20260908052000) lists notes, city and updated_at; the new
-- columns are INSERT-time values and stay out of it. The INSERT policy (own rows only) is
-- unchanged and is not column-restricted, so the booking app can write them.

-- ─── 3. PLACEMENT ROLL-UP used by the entity importer ──────────
-- One row per society we have actually placed in, with the demand signal. This is what
-- `scripts/seo/import-entities.ts --placements` will read (service role, read-only).
--
-- `placements` counts bookings whose status the team has moved to active/completed. As of
-- 2026-09-15 the team does not maintain status — every request is called, and the row
-- stays 'pending' — so `bookings` is the honest demand signal and `placements` is kept
-- for the day status is maintained.

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
--   AND column_name IN ('city_slug','locality_slug','pincode','entity_slug','society','attribution');
--   expected: 6 rows
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'
--   AND column_name IN ('attribution','chatwoot_conversation_id');
--   expected: 2 rows

# Proposal: make leads and bookings attributable to a society

**Status: proposed, not applied.** The SQL is in
[`app/migrations/2026-09-06-leads-and-placement-locality.sql`](../../app/migrations/2026-09-06-leads-and-placement-locality.sql).
It touches the live Supabase project and needs the owner to run it.

## Why

The Phase 5 pilot needs a list of societies MyBuddyMaid already places helpers in — the
first entity batch is limited to those, because their facts are verifiable. That list
cannot be produced today: `bookings` stores a free-text `city` and `notes`, nothing
about locality, pincode or society. The list exists only in WhatsApp and CRM history.

The lead form on every location page is still disabled for the same underlying reason —
the `leads` table it posts to was never created (ASSUMPTIONS.md #12). Writing that
migration now, with the right shape, fixes both: **every future lead and booking becomes
a demand signal for a specific society**, and the entity list builds itself from real
placements instead of memory.

## What changes

### 1. `leads` table (new)

| Column | Shape | Note |
|---|---|---|
| `city_slug`, `locality_slug` | data-layer slugs | already validated by `app/api/lead/route.ts` against `next-app/data/seo` |
| `pincode` | 6 digits, nullable | route already checks `isServiceable()` |
| `entity_slug` | nullable | the entity page the lead came from (Phase 5) |
| `society` | free text ≤ 120, nullable | what the customer typed; raw material for new candidates, never rendered |
| `service_slug`, `source_page`, `status` | | `status` gains `unserviceable` and `spam` so bad leads are measurable, not deleted |
| `booking_id` | FK → bookings | set on conversion, so conversion per society is measurable |

RLS on, **no policies**: only the service role (the Next.js route, the owner's tooling)
reads or writes. Same posture as `email_logs` after the security migration. No anon
INSERT policy — a direct insert would bypass the footprint validation in the route.

### 2. `bookings` gains five nullable columns

`city_slug`, `locality_slug`, `pincode`, `entity_slug`, `society`. Nullable, so existing
rows and the current booking app keep working; `city` (free text) stays. The booking app
then fills them from `app/src/lib/serviceability.json`, which `npm run seo:export-spa`
already generates from the data layer — so the app and the SEO site agree on every slug.

### 3. `placement_societies` view

One row per society with placements (`status IN ('active','completed')`), with counts
and last booking date. This is the read-only source for the importer.

## Code that goes with it (apply together, not before)

The DB insert rejects unknown columns, so these land in the same deploy as the migration:

1. `next-app/app/api/lead/route.ts` — rename `city`/`locality`/`service` in the insert to
   `city_slug`/`locality_slug`/`service_slug`; accept and validate `entity` (must exist in
   `ENTITY_BY_PATH` for that locality) and `society` (trimmed, ≤ 120 chars).
2. `next-app/lib/seo-engine/compose-entity.ts` — add `entity: entity.slug` to the entity
   page's `cta`, and `next-app/components/seo/LeadForm.tsx` posts it. Add an optional
   "Society / building" text field to the form on locality pages (not needed on entity
   pages, where it is known).
3. `app/src/...` booking flow — when the customer picks a city, offer the locality list
   from `serviceability.json` and a free-text society field; write the five new columns.
4. `next-app/scripts/seo/import-entities.ts --placements` — reads `placement_societies`
   with the service-role key and emits worksheet rows (`serve? = y` pre-filled, since a
   placement is proof of service) for `--csv`. Existing entities are matched by
   `entity_slug` first, then by normalised `society` text against name/altNames.
5. Flip `LEADS_ENABLED=true` and `NEXT_PUBLIC_LEADS_ENABLED=true` in Vercel.

## What this does not do

- It does not backfill history. Past bookings have no locality; the owner's first
  worksheet triage is still manual. From the day this ships, it stops being manual.
- It does not change pricing, plans, or any public page.
- It does not add an admin UI. The owner reads leads through the Supabase dashboard or
  whatever he uses today; a lightweight leads view is a separate decision.

## Rollback

`DROP VIEW placement_societies; DROP TABLE leads;` and
`ALTER TABLE bookings DROP COLUMN city_slug, DROP COLUMN locality_slug, DROP COLUMN pincode, DROP COLUMN entity_slug, DROP COLUMN society;`
— all additive, nothing existing is modified.

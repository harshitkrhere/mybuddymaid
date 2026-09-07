# 09 — Database

Source of truth: `app/supabase-schema.sql`, `app/security-migration.sql`, and
`app/migrations/2026-09-06-leads-and-placement-locality.sql` (explicitly marked
**"PROPOSAL — NOT APPLIED"**).

There is no migration tool, no migration history table and no ordering guarantee. Schema
changes are SQL files a human is expected to paste into the Supabase SQL editor. See
FIN-DB06.

## Schema as it stands

| Table | Rows own | RLS | Policies |
|---|---|---|---|
| `profiles` | user | on | SELECT / INSERT / UPDATE, all `auth.uid() = id` |
| `bookings` | user | on | SELECT, INSERT own; UPDATE "restricted" — **not actually restricted**, see FIN-S04 |
| `user_plans` | user | on | **SELECT only** — INSERT/UPDATE dropped by the security migration. Correct. |
| `email_logs` | system | on, **no policies** | service role only. Correct. |
| `leads` | — | — | **does not exist** |
| `placement_societies` (view) | — | — | **does not exist**; depends on columns that also do not exist |

---

## [FIN-DB01] `user_plans.razorpay_payment_id` has no unique constraint

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Database / Payments

**Location:** `app/supabase-schema.sql:103`

```sql
razorpay_payment_id TEXT,
```
No `UNIQUE`, no index, nullable. This is the database-side half of FIN-S02: with no
uniqueness, `verify-razorpay-payment` can insert the same payment id unlimited times, each
insert granting a fresh `expires_at` and a full reset of `replacements_used`.

**Fix — deploy this before the function fix; it is safe and makes the bug unexploitable
immediately:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_rzp_payment
  ON user_plans (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
```
Check for existing duplicates first:
```sql
SELECT razorpay_payment_id, count(*) FROM user_plans
WHERE razorpay_payment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
```

---

## [FIN-DB02] Nothing enforces one active plan per user, and the check that exists is racy

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Database / Concurrency

**Location:** `supabase/functions/create-razorpay-order/index.ts:62-71`; no constraint in `supabase-schema.sql:98-111`

The "you already have an active plan" rule is enforced only in application code, only in
`create-razorpay-order`, and it is a classic check-then-act:

```ts
const { data: existingPlan } = await supabaseAdmin
  .from('user_plans').select('id, plan_name, is_active')
  .eq('user_id', user.id).eq('is_active', true).maybeSingle();
if (existingPlan) return jsonResponse({ error: 'You already have an active plan' }, 409);
```

Three problems:
1. **No check at all in `verify-razorpay-payment`** — the function that actually creates the
   row. It deactivates and inserts unconditionally.
2. **TOCTOU.** Two concurrent order creations both read "no active plan" and both proceed.
3. **`maybeSingle()` throws when more than one row matches.** So once two active plans exist —
   by any route, including the FIN-S02 replay — this query errors, the `const { data }`
   destructure yields `undefined` (the error is discarded; there is no `error` binding), the
   guard silently passes, and the user can buy again. The failure mode of the guard is to
   disable itself.

**Fix:**
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_one_active
  ON user_plans (user_id) WHERE is_active;
```
and in the function, capture and handle the error rather than discarding it:
```ts
const { data, error } = await supabaseAdmin.from('user_plans')
  .select('id').eq('user_id', user.id).eq('is_active', true).limit(1);
if (error) return jsonResponse({ error: 'Could not check plan status' }, 500);
if (data?.length) return jsonResponse({ error: 'You already have an active plan' }, 409);
```
The partial unique index also makes the deactivate-then-insert sequence in
`verify-razorpay-payment` safe: if the deactivate silently failed, the insert now fails loudly
instead of creating a second active plan.

---

## [FIN-DB03] The `leads` table and booking locality columns are proposed but never applied

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Database / Product

**Location:** `app/migrations/2026-09-06-leads-and-placement-locality.sql:1-3`

The file's own first line says **"PROPOSAL — NOT APPLIED."** Consequences:

- `/api/lead` cannot work (and would fail on column names anyway — FIN-B03).
- `bookings` has no `city_slug`, `locality_slug`, `pincode`, `entity_slug` or `society`, so
  every booking's location is stored as the free-text `city` column containing
  `"Dwarka, Delhi"` (`serviceability.js:50-55`). That string cannot be joined, grouped or
  filtered against the data layer.
- The `placement_societies` view — the input to `scripts/seo/import-entities.ts --placements`,
  and the intended engine for Phase 5 entity pages — references five columns that do not
  exist. The Phase 5 roadmap is blocked at the schema layer.
- `entities.json` is `{}` (0 entities), which is consistent with the above.

**Why it matters strategically.** The proposal document explains the goal well: every lead
and booking becomes a demand signal for a specific locality/society, so the entity page list
is built from real placements instead of memory. That is the right idea, and none of it is
running. Meanwhile bookings are accumulating with unstructured locations, so the historical
data being created today cannot be back-filled cleanly.

**Fix:** apply the migration. The DDL itself is well designed — `CHECK` constraints mirror
the route's validation, indexes cover the intended query patterns, `leads` has RLS on with no
policies (service role only, correctly matching `email_logs`), and the view is explicitly
`REVOKE`d from `anon, authenticated` because views do not carry RLS. Then update
`AuthContext.createBooking` to write the slug columns it already has in hand:

```js
// ServiceDetailPage passes citySlug/localitySlug but only the label survives today
city: locationLabel, city_slug: citySlug, locality_slug: localitySlug,
pincode: localityBySlug(citySlug, localitySlug)?.pincodes[0] ?? null,
```

---

## [FIN-DB04] `fetchBookings` is an unbounded `SELECT *` with no pagination

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Database / Performance

**Location:** `app/src/context/AuthContext.jsx:53-57`

```js
.from('bookings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
```
No `.limit()`, no `.range()`. It runs on every auth state change and on every manual refresh,
and `BookingsPage` renders all of it.

**Scale behaviour** (as the brief asks):
- **10 rows:** fine.
- **10,000 rows** (a corporate account, or a bug that duplicates bookings): ~1–3 MB over the
  wire on mobile, 10,000 React nodes, a visibly frozen page.
- **1,000,000:** the query is per-user, so this only arises via a data bug — but if it did,
  the request would time out and the app's home screen would never load, because
  `loadUserData` awaits it.

`idx_bookings_user_id` and `idx_bookings_created_at DESC` exist, so the index path is fine;
the problem is the unbounded result set.

**Fix:** `.limit(50)` with a "Load more" using `.range()`. Also narrow `select('*')` to the
eight columns `BookingsPage` actually renders — `notes` in particular can be long.

---

## [FIN-DB05] Index coverage does not match the query shapes

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Database / Performance

**Location:** `app/supabase-schema.sql:129-130`

```sql
CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_user_plans_active  ON user_plans(is_active);
```
The only two queries against this table are:
```
.eq('user_id', x).eq('is_active', true).order('purchased_at', desc).limit(1)   -- AuthContext:34-41
.eq('user_id', x).eq('is_active', true)                                        -- create-razorpay-order:62-67
```
Both are `(user_id, is_active)`. The standalone `is_active` boolean index is close to useless
— a two-value column has terrible selectivity and Postgres will usually ignore it.

**Fix:**
```sql
DROP INDEX IF EXISTS idx_user_plans_active;
CREATE INDEX IF NOT EXISTS idx_user_plans_user_active
  ON user_plans (user_id, is_active, purchased_at DESC);
```
Similarly, `idx_bookings_status` on a 4-value column is low value on its own; if operations
queries by status it wants `(status, created_at DESC)`.

Low urgency at current volume — worth doing when the plan/booking tables are next touched.

---

## [FIN-DB06] No migration tooling, ordering or history

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Database / Operations

**Location:** `app/supabase-schema.sql`, `app/security-migration.sql`, `app/migrations/*.sql`

Three SQL files in two different directories with no naming convention, no sequence numbers,
no `schema_migrations` table and no runner. `supabase/config.toml` does not exist, so the
Supabase CLI's migration workflow is not in use either.

**The concrete risk is already visible.** `ASSUMPTIONS.md` #50 records that the app was moved
to a new Supabase project (`irqsjuwkbcmnooyivakq`) and that *"the new project needs the schema
scripts, the Google provider, the /app/splash redirect URL and the edge functions deployed
before sign-in and booking work end to end."* There is no way to verify from the repository
which of those steps were completed. Nobody can answer "what schema is production running?"
without opening the Supabase dashboard.

Also: `security-migration.sql` must run **after** `supabase-schema.sql` (it drops policies the
first creates) and `supabase-schema.sql` is not idempotent for policies — `CREATE POLICY` has
no `IF NOT EXISTS`, so re-running it on a live database errors partway through, leaving the
run half-applied.

**Fix:** adopt the Supabase CLI migration workflow.
```
supabase/
  config.toml
  migrations/
    20260101000000_initial_schema.sql
    20260102000000_security_hardening.sql
    20260906000000_leads_and_placement_locality.sql
    20260908000000_payment_idempotency.sql
```
`supabase db push` then applies in order and records history. Make each file idempotent
(`DROP POLICY IF EXISTS` before every `CREATE POLICY`). This is a half-day of work and it is
the prerequisite for shipping FIN-DB01, FIN-DB02 and FIN-S04 with any confidence.

---

## Booking state machine — as actually implemented

The brief asks for the real states, not assumed ones. There is no state machine. There is a
CHECK constraint and a UI that partly disagrees with it.

**Defined** (`supabase-schema.sql:30`): `pending` · `active` · `completed` · `cancelled`
**Rendered** (`BookingsPage.jsx:9-15`): `pending` · `confirmed` · `active` · `completed` · `cancelled`

- `confirmed` is rendered but cannot exist (FIN-B11).
- **Only `pending` is ever written** — `AuthContext.createBooking:162` hard-codes it, and
  there is no other write path in the application.
- **No transition is implemented anywhere.** Nothing moves a booking to `active`,
  `completed` or `cancelled` — no admin UI, no edge function, no scheduled job. Those states
  can only be set by hand in the Supabase dashboard, or by the customer themselves via the
  unrestricted UPDATE policy (FIN-S04), which is the wrong actor.
- `assigned_helper TEXT` exists and is rendered (`BookingsPage.jsx:59`) but is never written.

**Impossible / unreachable transitions:** every transition out of `pending` is unreachable
through the product. The lifecycle exists in the schema and in the customer's expectations
(set by the "Booking Confirmed!" screen, FIN-U03) but not in the system.

The plan lifecycle is similar: `user_plans.replacements_used` defaults to 0 and **nothing in
the codebase ever increments it** — no replacement request flow exists. `is_active` is only
ever set by `verify-razorpay-payment`; nothing expires a plan when `expires_at` passes, so an
expired plan still reads as active everywhere in the UI.

**Recommendation.** Either build the operational surface (an admin view + a status-transition
function with an audit trail), or stop implying it exists — remove `assigned_helper` from the
UI and reword the confirmation. Right now the database models a business process the software
does not run, which is how data quietly diverges from reality.

## Data-integrity notes

- **No `updated_at` triggers.** `profiles`, `bookings` and `leads` all declare
  `updated_at TIMESTAMPTZ DEFAULT now()`, but only `AuthContext.updateProfile:143` sets it,
  and only on `profiles`. Add a shared `BEFORE UPDATE` trigger.
- **`handle_new_user` copies only `id` and `phone`.** `profiles.email` and `full_name` stay
  null until the user completes onboarding. That is by design (it is what `OnboardingGuard`
  keys off), but it means `profiles.email` is unreliable — every consumer should use
  `auth.users.email`, and most do.
- **Orphan risk on `user_plans` and `email_logs`.** `profiles.id` and `bookings.user_id` have
  `ON DELETE CASCADE`; `user_plans.user_id REFERENCES auth.users` (no cascade) and
  `email_logs.user_id` has no FK at all. `delete-account` deletes them explicitly, but if that
  function partially fails (FIN-S09), those rows survive. Add `ON DELETE CASCADE` to
  `user_plans.user_id` and let the database guarantee it.
- **`email_logs.resend_response JSONB` stores full provider responses forever** with no
  retention policy. Add a scheduled delete beyond 90 days.
- **No unique constraint preventing duplicate bookings.** A double-tap on a slow connection
  is guarded only by the client's `submitting` flag. Consider a partial unique index on
  `(user_id, service, created_at::date)` or a short-window dedupe.

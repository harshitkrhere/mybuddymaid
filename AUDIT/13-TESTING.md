# 13 — Test coverage

## What exists

**One test file. Seven tests. All passing.**

```
next-app/lib/blog/legacy-header.test.ts   — 7 tests, 556 ms, 7 pass / 0 fail
```

Run with `npm test` (`tsx --test lib/**/*.test.ts`). Verified during this audit.

The tests themselves are **good** — genuinely better than most tests in codebases with 100×
the coverage. They test `stripLegacyHeader()` for: full-fragment stripping, no-op on clean
input, partial fragments in any order, not touching an `<h1>` later in the body, each piece
stripped at most once, and then two data-driven assertions over the real corpus:

```ts
test('every ported post has no <h1> and no leading fragment after stripping', ...)
test('exactly three ported posts carried the fragment', ...)
```

That last pair is the pattern worth copying: assert an invariant over the actual production
data, so the test fails when the data changes rather than only when the code does.

## What does not exist

There are no tests for anything that handles money, identity, personal data or the site's
primary business logic.

| Business-critical behaviour | Tested |
|---|---|
| Razorpay signature verification | **no** |
| Payment amount / status / order verification | **no** |
| Plan activation and idempotency | **no** |
| The "already has an active plan" rule | **no** |
| Row Level Security policies | **no** |
| Authentication and route guards | **no** |
| Account deletion (DPDP erasure) | **no** |
| `/api/lead` validation and insert | **no** — this is the one whose absence caused FIN-B03 |
| The compose engine (2,513 pages of output) | **no** |
| Metadata / canonical / robots generation | **no** |
| Sitemap generation | **no** |
| The redirect map and `proxy.ts` | **no** |
| Serviceability lookups (`isServiceable`, `getNearby`, pincode resolution) | **no** |
| Any React component, on either front-end | **no** |
| Any end-to-end journey | **no** |
| CI running any of the above | **no CI exists** |

There is **no CI configuration of any kind** — no `.github/workflows`, no Vercel check beyond
the build. `npm run prebuild` does run `seo:validate && seo:redirects && seo:gate` before
every build, which is a real gate on data quality and stops a malformed data layer reaching
production. That is genuinely valuable and is the closest thing this project has to CI. But it
validates *data*, not *behaviour*.

---

## [FIN-T01] No test covers any money, identity or personal-data path

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Testing / Risk

The three findings with the highest severity in this audit — FIN-S01 (unauthenticated email
relay), FIN-S02 (payment replay) and FIN-S03 (fail-open verification) — are each a single
missing conditional, and each would be caught by a test that takes under twenty lines to
write. FIN-B03 (the lead API column mismatch) would have been caught the first time anyone
ran an integration test against a real table.

That is the argument in a sentence: this project's defect profile is exactly the shape that
cheap tests catch.

**Recommended minimum suite — in priority order.** This is not a coverage target; it is a
list of the specific things that must not silently break.

### Tier 1 — the money and identity path (write these first)

```
supabase/functions/__tests__/verify-payment.test.ts
  ✓ rejects a request with no Authorization header                    → 401
  ✓ rejects the public anon key                                       → 401
  ✓ rejects a tampered signature                                      → 403
  ✓ rejects plan_name mismatched against the order notes              → 403
  ✓ rejects an amount mismatch                                        → 403
  ✓ FAILS CLOSED when the Razorpay lookup errors  (FIN-S03)           → 503, no row written
  ✓ replaying the same payment_id creates exactly one plan (FIN-S02)  → second call returns the first
  ✓ another user's payment_id is refused                              → 409

supabase/functions/__tests__/send-email.test.ts
  ✓ send-package-email rejects an unauthenticated caller  (FIN-S01)   → 401
  ✓ send-booking-email rejects the anon key               (FIN-S01)   → 401
  ✓ the recipient is always token.user.email, never body.user_email
```
Deno has a built-in test runner (`deno test`), so this needs no new tooling. Stub the Razorpay
and Resend endpoints with a local fetch mock.

### Tier 2 — RLS, which is the entire authorisation layer

```
supabase/__tests__/rls.test.ts   (two real anon-key sessions, users A and B)
  ✓ A cannot SELECT B's bookings / profile / user_plans        → 0 rows
  ✓ A cannot INSERT a booking with user_id = B                 → error
  ✓ A cannot INSERT into user_plans at all                     → error
  ✓ A cannot UPDATE their own booking's status  (FIN-S04)      → error   ← fails today
  ✓ authenticated cannot SELECT email_logs                     → 0 rows
```
The fourth assertion **fails against the current schema** and is the test that proves
FIN-S04. Write it before the fix, watch it fail, then fix.

### Tier 3 — the lead API and the data layer

```
next-app/app/api/__tests__/lead.test.ts
  ✓ valid payload inserts one row with the correct column names  (FIN-B03)
  ✓ unserved locality                                            → 400
  ✓ unknown city / service                                       → 400
  ✓ 9-digit and 11-digit phones                                  → 400
  ✓ "+91 98765 43210" normalises to 9876543210
  ✓ pincode "012345" behaves consistently with the DB CHECK       (FIN-API01)
  ✓ 6 requests in a minute                                       → 429   (after FIN-S06)

next-app/data/seo/__tests__/serviceability.test.ts
  ✓ every locality's pincodes resolve back to that locality
  ✓ getNearby() never returns the locality itself, never crosses cities
  ✓ every city/zone/locality slug avoids RESERVED_SLUGS
  ✓ CITY_BY_SLUG / LOCALITY_BY_PATH have no duplicate keys
```
Note the last group largely duplicates what `scripts/seo/validate.ts` already asserts —
so the cheapest version of this tier is to make `seo:validate` exit non-zero on failure (it
already does) and run it in CI, rather than rewriting its assertions as tests.

### Tier 4 — the composition engine, as invariants over real output

Following the pattern the existing test file already uses:
```
next-app/lib/seo-engine/__tests__/compose.test.ts
  ✓ allCorePages() yields a unique `path` for every page
  ✓ every page has exactly one h1 and a non-empty description ≤ 155 chars
  ✓ every title ≤ 68 chars
  ✓ no page's mainText contains "[VERIFY]"
  ✓ every `nearby`/`related` path resolves to a page that allCorePages() also yields
  ✓ canonicalPath === path on every page
```
These are cheap (one traversal), they run in seconds, and they protect 2,513 pages from a
whole class of regression.

### Tier 5 — one end-to-end journey

```
e2e/booking.spec.ts   (Playwright)
  ✓ /gurgaon/dlf-phase-3/cook → "Book in the app" → the booking form
    opens with Gurgaon / DLF Phase 3 / Cook preselected               (FIN-B02)
```
One test. It is the single most valuable test this product could have, because it asserts the
handoff between the two applications — the seam where nothing else looks.

---

## [FIN-T02] No CI pipeline

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Testing / Process

Nothing runs `tsc`, `eslint`, `npm test`, `seo:validate` or `seo:gate` automatically. All of
them exist and all of them pass or nearly pass today (`tsc` clean; `npm test` 7/7; eslint has
65 source errors, all but one deliberate — see FIN-DEP03).

**Fix — `.github/workflows/ci.yml`, roughly 30 lines:**
```yaml
on: [push, pull_request]
jobs:
  next-app:
    steps:
      - run: npm ci                       # in next-app
      - run: npx tsc --noEmit
      - run: npm run lint                 # after FIN-DEP03 makes this pass
      - run: npm test
      - run: npm run seo:validate && npm run seo:gate
  spa:
    steps:
      - run: npm ci && npx vite build     # in app
```
Add one more check that would have caught a real class of problem in this repository:
**assert that `next-app/public/_spa` matches a fresh build of `app/`.** Today nothing enforces
that the committed SPA artifact is current. Build it in CI and `diff` the output; fail if it
differs.

## Assessment

The brief warns against judging by percentage, and that is right here. The issue is not that
coverage is ~0%. It is that **the untested surface is precisely the surface where the
findings are**: five of the six HIGH-severity findings in this audit sit in code with no test,
and four of them are single-line defects that a twenty-line test would have caught before
deploy.

The existing test file proves the team can write good tests — data-driven, invariant-based,
tightly scoped. There just are not any others.

**If only one thing is done:** write the Tier 1 payment tests before re-enabling checkout.
They are eleven assertions, they need no new tooling, and they cover the three findings most
likely to cost real money.

# 03 — Bugs

Defects in behaviour. Security defects are in `04-SECURITY.md`; content contradictions in
`16-CONTENT.md`.

---

## [FIN-B01] The privacy policy and terms of service render completely unstyled in production

**Severity:** HIGH · **Confidence:** CONFIRMED (verified against the live site) · **Category:** Bug / UX / Trust

**Location:** `next-app/app/privacy-policy/page.tsx:16-42`, `next-app/app/terms-of-service/page.tsx:16-45`,
`next-app/styles/static-pages.css` (never imported)

**Affected functionality:** the two pages Google, Razorpay, AdSense and cautious customers
open to decide whether this business is real.

**What is happening.** Both pages use the classes `static-hero`, `container`,
`static-content`, `static-article`, `legal` and `seo-breadcrumb`. Those classes are defined
only in `next-app/styles/static-pages.css`, and **nothing imports that file**. The only
stylesheets imported anywhere are `app/globals.css` (root layout), `styles/home.css` (home)
and `styles/blog.css` (blog index).

**Evidence — live.**
```
$ curl -s https://mybuddymaid.in/privacy-policy | grep -oE '<link[^>]*stylesheet[^>]*>'
<link rel="stylesheet" href="/_next/static/immutable/chunks/3tm0eq5ufv_tm.css" .../>   ← one file only

$ curl -s https://mybuddymaid.in/_next/static/immutable/chunks/3tm0eq5ufv_tm.css | grep -c static-hero
0
```
Occurrences in the only stylesheet those pages load:
`static-hero` 0 · `static-content` 0 · `static-article` 0 · `seo-breadcrumb` 0 · `.container` 0.
(For contrast, `site-header` appears twice and `hero__tagline` once — the layout chrome *is*
styled; only the page body is not.)

**Why it is a problem.** Everything between the header and footer renders as raw
`<h1>`/`<h2>`/`<p>` at full viewport width with no max-width, no spacing scale and no
typography. On a desktop monitor the legal text runs edge to edge in ~200-character lines.
It is the single most visually broken thing on the site, and it is on the two pages that
exist specifically to establish legitimacy.

**Root cause.** These two pages were ported from the retired static site and kept its class
names; the accompanying stylesheet was committed but the `import` was never added. `styles/cities-hub.css`
has the same problem but no page currently uses its classes, so it is merely dead (FIN-D04).

**Reproduction:** open https://mybuddymaid.in/privacy-policy on a desktop browser. Compare
with https://mybuddymaid.in/about (which uses `TrustPage` and is styled correctly).

**Expected:** the same contained, typeset presentation as the other five trust pages.
**Actual:** unstyled full-bleed document flow.

**Business impact:** damages the exact trust these pages exist to build; a reviewer at
Razorpay or AdSense reading these pages sees an unfinished site.
**Technical impact:** none functionally.

**Recommended solution — the smallest safe fix is not to import the orphan CSS, it is to
delete it and use the shell that already works.** Rewrite both pages on `TrustPage`, exactly
as `/about`, `/contact`, `/pricing`, `/how-we-verify` and `/replacement-policy` already do:

```tsx
export default function PrivacyPolicyPage() {
  return (
    <TrustPage title="Privacy policy" intro="How we collect, use and protect your personal information." path="/privacy-policy">
      <h2>1. Information we collect</h2>
      ...
    </TrustPage>
  );
}
```
This also fixes three secondary defects for free: they gain `BreadcrumbList` JSON-LD, they
gain the closing CTA, and they stop being the only two pages on the site with a bespoke
breadcrumb markup. Then delete `styles/static-pages.css`.

**Tests required:** a build-time assertion that every class used in `app/**/*.tsx` resolves
in an imported stylesheet would be ideal but is heavy; at minimum, add
`/privacy-policy` and `/terms-of-service` to a visual smoke check.
**Regression risk:** low. Content is unchanged; only the wrapper changes.

---

## [FIN-B02] Every "Book in the app" CTA drops its city/locality/service context

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Bug / Conversion / Analytics

**Location:**
Producer: `next-app/components/seo/CtaButtons.tsx:29`, `next-app/app/page.tsx:38`, `next-app/components/home/SalaryEstimator.tsx:78`
Consumer that does not exist: `app/src/pages/AuthPage.jsx:50,83`, `app/src/pages/SplashScreen.jsx:27`

**What is happening.** Every location page builds a context-carrying link:

```tsx
// CtaButtons.tsx:29
const appHref = `/app/auth?city=${...}&locality=${...}&service=${...}`;
```

The SPA never reads those query parameters. `grep -rn "searchParams\|useSearchParams\|location.search" app/src` returns
**nothing**. What the SPA *does* read is `sessionStorage.getItem('mbm_redirect_context')` —
in three places:

```
app/src/pages/AuthPage.jsx:50      const ctx = sessionStorage.getItem('mbm_redirect_context');
app/src/pages/AuthPage.jsx:83      const ctx = sessionStorage.getItem('mbm_redirect_context');
app/src/pages/SplashScreen.jsx:27  const ctx = location.state?.redirectContext || sessionStorage.getItem('mbm_redirect_context');
```

and **`grep -rn "setItem('mbm_redirect_context'" app/src next-app` returns zero results.**
Nothing anywhere in the repository ever writes that key.

**Why it is a problem.** Three consequences, all invisible in monitoring:
1. A visitor who lands on `/gurgaon/dlf-phase-3/cook` and clicks "Book in the app" arrives
   at a generic sign-up with no memory of what they wanted. They must re-enter city, area
   and service from scratch — after signing up.
2. The `SplashScreen` context router (`SplashScreen.jsx:30-37`) — which would send a
   service-intent visitor straight to `/services/cook` — is unreachable. Every user lands on
   `/home`.
3. There is no join between the SEO page that produced a signup and the signup itself. GA4
   `app_click` events carry the locality, but nothing downstream of the click does, so
   locality-level ROI cannot be computed.

**Root cause.** The producer was migrated to query parameters (a good change — query params
survive a cold tab, sessionStorage does not) but the consumer was never updated, and the
sessionStorage writer was lost in the rebuild.

**Reproduction:** open https://mybuddymaid.in/gurgaon/dlf-phase-3/cook, click "Book in the
app", observe `/app/auth?city=gurgaon&locality=dlf-phase-3&service=cook`, sign in, and land
on `/app/home` with no preselection.

**Expected:** the booking form opens pre-filled with Gurgaon / DLF Phase 3 / Cook.
**Actual:** context discarded.

**Business impact:** the whole point of 2,052 service×locality pages is locality-specific
intent, and it is thrown away at the exact moment it becomes actionable. This is the largest
single conversion defect in the product.

**Recommended solution.** Read the query parameters at the SPA entry point and persist them
across the OAuth round-trip (which destroys the URL), then consume them in the booking form.

```jsx
// app/src/main.jsx — before render, once
const q = new URLSearchParams(window.location.search);
const ctx = { city: q.get('city') || '', locality: q.get('locality') || '', service: q.get('service') || '' };
if (ctx.city || ctx.locality || ctx.service) sessionStorage.setItem('mbm_ctx', JSON.stringify(ctx));
```
```jsx
// SplashScreen.jsx — replace the dead branching
const ctx = JSON.parse(sessionStorage.getItem('mbm_ctx') || '{}');
const spaService = Object.entries(SPA_SERVICE_MAP).find(([, slug]) => slug === ctx.service)?.[0];
navigate(spaService ? `/services/${spaService}` : '/home', { replace: true });
```
```jsx
// ServiceDetailPage.jsx — seed the selects
const [citySlug, setCitySlug] = useState(ctx.city || '');
const [localitySlug, setLocalitySlug] = useState(ctx.locality || '');
```
Note `SPA_SERVICE_MAP` in `serviceability.json` maps SPA ids → SEO slugs; you need the
inverse, and `postnatal` has no SEO slug, so guard for `undefined`.

Keep `sessionStorage` as the carrier (it survives the Google OAuth redirect) but write it
from the URL, which is the durable part.

**Tests required:** an E2E that lands on a service×locality page, clicks through, and
asserts the booking form's city/area/service selects. This is the highest-value E2E test the
product could have.
**Regression risk:** low — today's behaviour is "ignore everything", so any reading is an
improvement. Guard against a `service` value with no SPA equivalent.

---

## [FIN-B03] `/api/lead` writes column names that do not exist in the `leads` schema

**Severity:** HIGH (blocking, latent) · **Confidence:** CONFIRMED · **Category:** Bug / Data

**Location:** `next-app/app/api/lead/route.ts:63-72` vs `app/migrations/2026-09-06-leads-and-placement-locality.sql:22-44`

**What is happening.** The route posts this body to PostgREST:

```ts
{ name, phone, city, locality, service, pincode, source_page, status }
//             ^^^^  ^^^^^^^^  ^^^^^^^
```
The migration that defines the table declares:

```sql
city_slug     TEXT NOT NULL ...
locality_slug TEXT NOT NULL ...
service_slug  TEXT ...
```

`city`, `locality` and `service` do not exist. PostgREST rejects unknown columns with
`PGRST204`/400, `res.ok` is false, and the route returns `502 {"error":"Could not save lead"}`
for **every** submission. The user sees "Could not send — please use WhatsApp or call
instead."

**Why this is not visible today.** The feature is triple-gated: `LEADS_ENABLED !== 'true'`
returns 503 first (**verified live**: `POST /api/lead` → `503 {"error":"Lead capture is not
enabled"}`), the `leads` table is explicitly marked *"PROPOSAL — NOT APPLIED"*, and the form
only renders when `NEXT_PUBLIC_LEADS_ENABLED=true`. So this is a live landmine, not a live
outage — it detonates the day someone applies the migration and flips the flags, which is
exactly when nobody will be looking at 502s.

**Root cause.** The route and the migration were written against different naming
conventions and never executed together, because the table has never existed.

**Reproduction:** apply the migration, set `LEADS_ENABLED=true` and the Supabase env vars,
POST a valid lead. Expect 502.

**Recommended solution.** Change the route, not the schema — the schema's `_slug` suffixes
are correct and match the data layer's vocabulary everywhere else:

```ts
body: JSON.stringify({
  name,
  phone,
  city_slug: city,
  locality_slug: locality,
  service_slug: service || null,
  pincode: body.pincode ?? null,
  source_page: (body.page ?? '').slice(0, 300),
  status: 'new',
}),
```
While in this file, also fix the adjacent gap: `body.pincode` is inserted raw when present,
and the DB CHECK is `^[1-9][0-9]{5}$` while `isServiceable()` accepts `^\d{6}$` — a pincode
starting with `0` passes the route and is rejected by the database. Normalise with
`body.pincode?.trim() || null` and align the regexes.

**Tests required:** an integration test against a real `leads` table asserting a 200 and one
row with the correct columns. This is the test whose absence caused the bug.
**Regression risk:** none — the current behaviour is a hard failure.

---

## [FIN-B04] The Razorpay checkout modal labels the plan term in "days" when the value is months

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Bug / Payments / Trust

**Location:** `app/src/pages/PricingPage.jsx:95`; value produced at `supabase/functions/create-razorpay-order/index.ts:115`

```ts
// create-razorpay-order/index.ts:115
plan_duration: plan.durationMonths,          // 10 | 12 | 18
```
```jsx
// PricingPage.jsx:95
description: `${orderData.plan_display_name} Package — ${orderData.plan_duration} days`,
```

The Razorpay payment sheet — the last screen a customer reads before paying ₹5,999 — would
say **"Gold Package — 12 days"**.

**Why it is a problem.** It contradicts every other surface (the site says 12 months, the
plan card says 12 months, the confirmation email says 12 months) at the highest-anxiety
moment in the funnel. It is also a consumer-protection problem: the payment descriptor is
part of what the customer agreed to.

**Not currently reachable** because `PURCHASES_PAUSED = true` (`PricingPage.jsx:12`) returns
before the Razorpay path. It will be reachable the moment checkout is re-enabled.

**Fix:** `${orderData.plan_duration} months`. Better: return a preformatted
`plan_duration_label: `${plan.durationMonths} months`` from the function so the unit lives
next to the number, in the same file, once.

**Tests required:** assert the `description` string in a unit test over the options object.
**Regression risk:** none.

---

## [FIN-B05] Phone fields never populate from the user's saved profile

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Bug / UX

**Location:** `app/src/pages/PricingPage.jsx:36`, `app/src/pages/ServiceDetailPage.jsx:21`

```jsx
const [buyPhone, setBuyPhone] = useState(profile?.phone || '');    // PricingPage:36
const [bookPhone, setBookPhone] = useState(profile?.phone || '');  // ServiceDetailPage:21
```

`useState(x)` uses `x` only on the first render. `AuthContext` deliberately calls
`setLoading(false)` *before* the profile query resolves (`AuthContext.jsx:82-85`, commented
"Unblock immediately"), so these components almost always mount with `profile === null` and
capture `''` permanently. Later profile updates re-render but never update the state.

`ProfilePage.jsx:23-29` has exactly the `useEffect` sync that these two are missing, which
confirms the pattern is understood — it was just not applied here.

**Impact.** Every returning user must re-type their mobile number on every booking and every
purchase attempt, on mobile, in a bottom sheet. It is a small friction multiplied across the
only two conversion actions in the app.

**Fix:**
```jsx
useEffect(() => { if (profile?.phone) setBookPhone(profile.phone); }, [profile?.phone]);
```
Or, better, hoist a `useProfileField('phone')` hook so this cannot be forgotten a fourth time.

**Tests required:** render with a delayed profile resolution and assert the input value.
**Regression risk:** low. Do not clobber a value the user has already typed — the guard
above only sets when `profile.phone` is truthy; add a "touched" ref if you want to be strict.

---

## [FIN-B06] The lead form fails silently on an invalid phone number

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Bug / UX / Accessibility

**Location:** `next-app/components/seo/LeadForm.tsx:24-27`

```tsx
async function submit(e: React.FormEvent) {
  e.preventDefault();
  if (!/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10))) return;   // ← silent
  setState('sending');
```

On an invalid phone the function returns without setting an error state, without focusing the
field and without any DOM change. The user presses "Request a call back" and **nothing
happens at all** — no spinner, no message, no visual response.

The `pattern="[0-9+ ]{10,14}"` attribute on the input catches some cases via native
validation, but it accepts `+ + + + + + + + + +` (ten valid characters, zero digits), which
then hits this branch and dies silently.

There is also a client/server validation mismatch: the client requires nothing of `name`
beyond `required`, while the server requires `name.length >= 2` (`route.ts:40`).

**Fix:**
```tsx
const digits = phone.replace(/\D/g, '').slice(-10);
if (!/^\d{10}$/.test(digits)) { setPhoneError('Enter a 10-digit mobile number'); return; }
if (name.trim().length < 2)   { setNameError('Enter your name'); return; }
```
and render the message with `aria-describedby` / `aria-invalid` on the input so screen
readers get it too.

**Tests required:** submit with `"++++++++++"` and assert an error message is rendered.
**Regression risk:** none. Not currently reachable (the form only renders when
`NEXT_PUBLIC_LEADS_ENABLED=true`), so fix it alongside FIN-B03 before launch.

---

## [FIN-B07] Onboarding shows "Please select your state" under a field labelled "City"

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Bug / Copy

**Location:** `app/src/pages/OnboardingPage.jsx:25` (message) vs `:85` (label)

```jsx
if (!state) { setError('Please select your state'); return; }   // :25
<label><MapPin size={14} /> City</label>                        // :85
```
Residue from the removed `INDIAN_STATES` list (see the comment at `constants.js:135-138`).
The state variable is still named `state` and holds a **city name**, which is also why
`profiles.city` stores a city while the variable reads as a state.

**Fix:** `'Please select your city'`, and rename the local `state` → `city` in
`OnboardingPage.jsx` and `ProfilePage.jsx` to stop the confusion recurring.

---

## [FIN-B08] Every authenticated entry is delayed by a hard-coded 4-second splash screen

**Severity:** LOW (MEDIUM for conversion) · **Confidence:** CONFIRMED · **Category:** Bug / UX

**Location:** `app/src/pages/SplashScreen.jsx:12-15,18-40`

```jsx
useEffect(() => { const t = setTimeout(() => setTimerDone(true), 4000); ... }, []);
useEffect(() => { if (!timerDone) return; ... }, [timerDone]);
```
The 4-second timer is unconditional — it is a branding delay, not a loading state. Both
sign-in paths and the Google OAuth return all route through `/splash`.

Secondary defect: the second effect depends only on `[timerDone]`. If `loading` is still true
at t=4s, neither guard branch matches, the user is sent to `/home`, `ProtectedRoute` shows a
spinner, and then bounces them to `/auth` — a user who signed in successfully can be shown
the sign-in page again on a slow connection.

**Fix:** cut the timer to ~800ms *or* make it a real loading gate:
`Promise.all([minDelay(600), authResolved])`. Add `isAuthenticated` and `loading` to the
effect's dependency array so the decision is re-evaluated when auth resolves.

**Impact:** 4 seconds of dead time at the highest-intent moment in the funnel, on every
single session.

---

## [FIN-B09] Splash routes plan-intent users to a profile tab that does not exist

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Bug / Dead code

**Location:** `app/src/pages/SplashScreen.jsx:36`

```jsx
else if (planNames.includes(ctx)) destination = '/profile?tab=packages';
```
`ProfilePage.jsx` has no tabs and never reads a `tab` query parameter. The user would land on
the profile form. Currently unreachable anyway (FIN-B02), but it must be corrected rather
than carried forward when that fix lands — the correct destination is `/pricing`.

---

## [FIN-B10] `robots.txt` blocks every URL with a query string, including paid-traffic landing pages

**Severity:** LOW–MEDIUM · **Confidence:** CONFIRMED · **Category:** Bug / SEO / Marketing

**Location:** `next-app/app/robots.ts:10`

```ts
disallow: ['/api/', '/app', '/app/', '/_spa/', '/maintenance', '/og', '/*?*'],
```
**Verified live** in the served `robots.txt`.

`Disallow: /*?*` is a blunt instrument. The site has no query-driven content, so the
duplicate-content intent is sound, but the rule also blocks:
- every ad landing URL carrying `?gclid=`, `?utm_source=`, `?fbclid=` — Google Ads will
  report "Destination not crawlable" and Quality Score suffers;
- `/og?t=...&s=...`, i.e. **every OG image on the site** (already blocked separately by
  `Disallow: /og`), so Google cannot fetch the social preview for any page.

**Fix:** delete `/*?*` and rely on the self-referencing `rel=canonical` that
`page-metadata.ts:21` already emits on every page — that is the correct tool for parameter
duplication and it is already in place. Also remove `Disallow: /og` so image and rich-result
fetching works; if `/og` is signed per FIN-S05, there is no abuse reason to block it.

---

## [FIN-B11] Bookings list renders a `confirmed` status the database cannot produce

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Bug / Dead code

**Location:** `app/src/pages/BookingsPage.jsx:11` vs `app/supabase-schema.sql:30`

```jsx
confirmed: { label: 'Confirmed', color: '#3B82F6', ... },
```
```sql
status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','completed','cancelled'))
```
`confirmed` is not in the CHECK constraint, so the branch is unreachable. Harmless, but it
indicates the UI and the schema disagree about the booking state machine — see
`09-DATABASE.md` for the full state-machine analysis.

**Fix:** either drop the entry or add `confirmed` to the constraint and define where it is
set. Pick one; do not leave both models in the codebase.

---

## [FIN-B12] Footer copyright year is frozen at build time

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Bug

**Location:** `next-app/components/shared/Footer.tsx:82`

```tsx
© {new Date().getFullYear()} MyBuddyMaid.
```
`Footer` is a server component inside a root layout used by `force-static` pages, so the year
is evaluated during `next build` and baked into 2,500+ HTML files. On 1 January the whole
site shows the previous year until someone redeploys.

**Fix:** hard-code the founding year and omit the current one (`© MyBuddyMaid`), or set it
from a build-time constant that a scheduled deploy refreshes. The first option is simpler
and is what most static sites do.

---

## Checked and found correct

| Behaviour | Verdict |
|---|---|
| `www` → apex canonicalisation | **Verified live**: 308, single hop |
| Legacy `.html` → clean URL | **Verified live**: `/blog/x.html` → 301 → `/blog/x` |
| 404 handling | **Verified live**: real 404 status with a useful city-list page |
| Duplicate `<h1>` on ported blog posts | **Fixed and verified live**: exactly 1 `<h1>`. `stripLegacyHeader` is careful (anchored, once-each, order-independent) and its 7 tests pass |
| `tsc --noEmit` | **Clean**, zero errors, `strict: true` |
| Blog HTML injection surface | 0 `<script>` tags, 0 inline event handlers across all 35 ported posts |
| Deployed SPA bundle currency | Current — ships ₹4,999 / ₹5,999 / ₹6,999 matching `plans.ts` |
| Double-submit protection | Present on all four forms via a `submitting`/`sending` disabled state |
| INR formatting | Correct `en-IN` grouping via `Intl.NumberFormat`, used consistently server and client |
| Indian phone handling | Consistent: strip non-digits, take last 10, require exactly 10 |
| Timezone handling | No timezone bugs found. `expires_at` uses `TIMESTAMPTZ` and ISO strings throughout; dates are display-only elsewhere |

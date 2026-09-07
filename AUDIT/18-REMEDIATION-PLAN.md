# 18 — Remediation plan

Ordered by risk retired per hour spent. Every task names the finding, the exact file, the
change, the expected result and the test.

**Complexity key:** S = under an hour · M = half a day · L = 1–3 days · XL = a week or more.

---

## PHASE 0 — Emergency (this week)

Live security and integrity defects, plus the two prerequisites that make the rest safe to
ship. Total: roughly **3 working days**.

### 0.1 — Authenticate the two live email functions · FIN-S01 · **S** (2 h)
**Files:** `supabase/functions/send-package-email/index.ts:403`, `send-booking-email/index.ts:669`;
new `supabase/functions/_shared/auth.ts`
**Change:** extract the six-line `auth.getUser()` check the payment functions already use into
`_shared/auth.ts`; call it in both email functions; then **stop reading identity from the
body** — recipient becomes `user.email`, `user_id` becomes `user.id`. For
`send-package-email`, re-read `plan_name`/`amount_paid`/`expires_at` from `user_plans` by
`user.id` rather than trusting the payload.
**Expected:** an unauthenticated or anon-key call returns 401; a valid user token can only
ever email themselves.
**Test:** no header → 401 · anon key → 401 · valid token + someone else's `user_id` → mail
still goes to the token owner.
**Regression risk:** low — the SPA already sends the session token via `functions.invoke`.

### 0.2 — Database constraints for payment integrity · FIN-DB01, FIN-DB02 · **S** (1 h)
**File:** new migration
```sql
-- check for existing violations first
SELECT razorpay_payment_id, count(*) FROM user_plans
 WHERE razorpay_payment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
SELECT user_id, count(*) FROM user_plans WHERE is_active GROUP BY 1 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_rzp_payment
  ON user_plans (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_one_active
  ON user_plans (user_id) WHERE is_active;
```
**Expected:** FIN-S02 becomes unexploitable immediately, before any function code changes.
**Why first:** this is the cheapest, highest-leverage change in the whole plan. Ship it today.
**Regression risk:** low, but resolve any duplicates the two `SELECT`s find before creating
the indexes.

### 0.3 — Make payment verification fail closed and bind the payment to the plan · FIN-S03, FIN-S02, FIN-P01, FIN-P04 · **M** (4 h)
**File:** `supabase/functions/verify-razorpay-payment/index.ts:104-173`
**Change, in order:**
1. Idempotency: look up `razorpay_payment_id` first; if found and it belongs to this user,
   return it with 200; if it belongs to another user, 409.
2. Fail closed: `if (!paymentCheckResponse.ok) return 503` — no activation on an unverified payment.
3. Fetch the **order** and assert `notes.user_id === user.id`, `notes.plan_name === plan_name`,
   `order.amount === plan.pricePaise`. Better: take `plan_name` from `order.notes`, not the body.
4. Constant-time signature comparison.
5. `AbortSignal.timeout(8000)` on both Razorpay fetches, with one retry.
**Expected:** every combination of tampered plan, replayed payment, foreign order and gateway
outage is rejected, and nothing is activated on an unverified payment.
**Test:** the eight assertions in `13-TESTING.md` Tier 1.
**Regression risk:** medium — a Razorpay outage now blocks activation instead of granting it.
That is correct, and it is why 0.4 ships in the same week.

### 0.4 — Add the Razorpay webhook · FIN-P02, FIN-P03 · **L** (1 d)
**File:** new `supabase/functions/razorpay-webhook/index.ts`
**Change:** verify `x-razorpay-signature` over the **raw** body before parsing; handle
`payment.captured` (activate, idempotently — the 0.2 index makes duplicates safe),
`refund.processed` (deactivate), `payment.failed` (record). Deploy with `--no-verify-jwt`;
its authentication is the Razorpay signature. Add `RAZORPAY_WEBHOOK_SECRET`.
**Expected:** a payment that succeeds while the browser closes still activates; a refund
revokes the plan.
**Test:** replay the same event 3× → one plan · tampered signature → 401 · refund → `is_active = false`.
**Note:** this must exist before checkout is re-enabled. It is what makes 0.3's fail-closed
behaviour safe.

### 0.5 — Make the booking UPDATE policy actually restrict columns · FIN-S04 · **S** (1 h)
**File:** new migration replacing `app/security-migration.sql:29-39`
```sql
REVOKE UPDATE ON bookings FROM authenticated;
GRANT UPDATE (notes, city, updated_at) ON bookings TO authenticated;
```
**Expected:** `PATCH` of `notes` succeeds; `PATCH` of `status` is refused.
**Test:** the RLS suite in `13-TESTING.md` Tier 2 — write the failing assertion first.

### 0.6 — Adopt migration tooling · FIN-DB06 · **M** (4 h)
**Change:** add `supabase/config.toml`, move all SQL into `supabase/migrations/` with
timestamps, make every file idempotent (`DROP POLICY IF EXISTS` before each `CREATE POLICY`).
**Why it is in Phase 0:** tasks 0.2 and 0.5 are schema changes. Shipping them without a
migration history means nobody can later verify what production actually has — which is the
exact situation `ASSUMPTIONS.md` #50 describes for the Supabase project move.

### 0.7 — Check Vercel preview environment separation · **S** (5 m, but do it now)
Confirm in the Vercel dashboard that Preview deployments do **not** point at the production
Supabase project. If they do, preview builds write to production data. A five-minute check
with a large downside; see `17-DEPLOYMENT.md`.

---

## PHASE 1 — Critical (next two weeks)

User-visible breakage and the conversion path. Roughly **5 working days**.

### 1.1 — Fix the two legal pages · FIN-B01, FIN-SEO04 · **S** (2 h)
**Files:** `app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`
**Change:** wrap both in `TrustPage` exactly as `/about` does; delete
`styles/static-pages.css`; add both to `TRUST_PAGES` in `sitemaps.ts`.
**Expected:** both pages match the other five trust pages, gain breadcrumb JSON-LD, and enter
the sitemap.
**Verify:** `curl -s https://mybuddymaid.in/privacy-policy | grep static-hero` returns nothing
and the page renders contained.

### 1.2 — Re-point the paused-checkout funnel · FIN-U01 · **S** (3 h)
**Files:** `next-app/app/page.tsx:314`, `next-app/app/pricing/page.tsx`, `serviceability.json` export
**Change:** export `purchasesPaused` through `serviceability.json` so both front-ends read one
flag. While true, plan CTAs link to WhatsApp prefilled with the plan name, and one line on
`/pricing` and the home page says online payment is paused.
**Expected:** an eight-step dead end becomes a one-tap WhatsApp conversation.
**This is the highest-value change per hour in the entire plan.**

### 1.3 — Carry CTA context into the app · FIN-B02, FIN-B09 · **L** (1 d)
**Files:** `app/src/main.jsx`, `SplashScreen.jsx:27-37`, `ServiceDetailPage.jsx:24-25`
**Change:** read `?city&locality&service` at SPA entry, persist to `sessionStorage` (it must
survive the Google OAuth redirect), consume in the splash router and seed the booking selects.
Guard for a `service` with no SPA equivalent (`postnatal` has none).
**Expected:** landing on `/gurgaon/dlf-phase-3/cook` and clicking through opens the booking
form pre-filled.
**Test:** the single Playwright test in `13-TESTING.md` Tier 5 — the most valuable test this
product can have.

### 1.4 — Turn on lead capture, correctly · FIN-B03, FIN-B06, FIN-S06, FIN-DB03, FIN-U02, FIN-API01, FIN-API02 · **L** (1 d)
**Order matters:**
1. Apply the `leads` migration (now via 0.6's tooling).
2. `api/lead/route.ts:63-72` — rename to `city_slug`/`locality_slug`/`service_slug`; align the
   pincode regex with the DB CHECK; reject foreign `Origin`s.
3. `LeadForm.tsx:26` — replace the silent `return` with an error state and `aria-describedby`.
4. Add IP rate limiting and Turnstile.
5. Only then set `LEADS_ENABLED=true` **and** `NEXT_PUBLIC_LEADS_ENABLED=true` (both, or the
   form and the API disagree).
**Expected:** every location page can capture a lead; nothing outside the footprint can be written.
**Test:** the integration suite in `13-TESTING.md` Tier 3.

### 1.5 — Write the Tier-1 tests and stand up CI · FIN-T01, FIN-T02, FIN-DEP03 · **L** (1 d)
Payment and auth tests (11 assertions, `deno test`), the RLS suite, then a GitHub Actions
workflow running `tsc`, `lint`, `test`, `seo:validate`, `seo:gate`, and a diff of a fresh SPA
build against `public/_spa`. Fix the eslint config first so `lint` can pass.

### 1.6 — Small high-impact bug fixes · **S** (2 h total)
| Finding | File | Change |
|---|---|---|
| FIN-B04 | `PricingPage.jsx:95` | "days" → "months" |
| FIN-B05 | `PricingPage.jsx:36`, `ServiceDetailPage.jsx:21` | `useEffect` sync from profile |
| FIN-U03 | `ServiceDetailPage.jsx:120` + `send-booking-email` subjects | "Request received", not "Booking Confirmed!" |
| FIN-C07 | `AppLayout.jsx:46-47` | real plan or "No active plan"; remove "Demo User" |
| FIN-B07 | `OnboardingPage.jsx:25` | "city", not "state" |
| FIN-B08 | `SplashScreen.jsx:12,40` | 4 s → 800 ms; fix the dependency array |
| FIN-PF01 | `blog/[slug]/page.tsx:79`, `app/index.html:9` | delete the AdSense loader |

### 1.7 — Resolve the refund-policy contradiction · FIN-C01, FIN-C02 · **S** (2 h + legal)
Single refund term in `/terms-of-service`, rendered from `REFUND_WINDOW_DAYS` and
`REFUND_PROFILE_THRESHOLD`; `/replacement-policy` summarises and links. Rewrite terms §3 to
describe the flow that actually runs, and §1's service list to match `services.ts`.
**Needs a lawyer's eye, not just an engineer's.**

---

## PHASE 2 — Growth (weeks 3–6)

### 2.1 — Measure the SEO position before changing it · FIN-SEO01, FIN-PF05 · **S** (2 h)
Run `npm run seo:gsc`. Get Indexed vs "Crawled – currently not indexed" vs "Discovered" for
the `/[city]/[area]/[slug]` group. Read Vercel Speed Insights p75 LCP/INP/CLS by route group.
**Everything in 2.2 and 2.5 depends on these two numbers. Do not skip this.**

### 2.2 — Raise the content gate and reduce the indexed surface · FIN-SEO01 · **XL**
Gate service×locality pages on real local data (`localIntro ≥ 120 words`, `landmarks ≥ 3`,
`localFaqs ≥ 3`, `helperSourceAreas ≥ 1`) — `composeServiceLocality:392-395` already computes
these as `missingRequired` and does not act on them. Raise the local-token floor to 0.65 and
add a sentence-level uniqueness metric. Demote failures to `noindex, follow`; do not delete.
Expect the indexed set to fall from 2,489 to something in the 600–1,200 range, then grow back
as real content is written.

### 2.3 — Fix the robots and OG configuration · FIN-B10, FIN-SEO02, FIN-S05, FIN-SEO05 · **S** (3 h)
Remove `Disallow: /*?*` and `Disallow: /og`; HMAC-sign `/og` parameters instead of blocking
them; skip the single-item breadcrumb on the home page.

### 2.4 — Accessibility · FIN-A01, FIN-A02, FIN-A03, FIN-A05, FIN-A06 · **L** (1.5 d)
`heroChildren` on `SeoPage` to fix DOM order; delete the three phantom controls; convert the
three overlays to native `<dialog>`; add a skip link; run axe on three pages and fix what it
finds. Also fix the SPA's form-label associations — one mechanical pass affecting every screen.

### 2.5 — Performance · FIN-PF02, FIN-PF03, FIN-PF04 · **L** (1 d)
Route-level `React.lazy` in the SPA; inject the Razorpay script on demand; trim Plus Jakarta
Sans to the weights actually used; memoise `buildShards()`. Re-measure against 2.1's baseline.

### 2.6 — Consent and privacy compliance · FIN-S07 · **L** (1 d + legal)
Consent gate before `load()` in `Analytics.tsx`; Google consent-mode defaults; rewrite the
privacy policy to cover the seven missing DPDP disclosures.

### 2.7 — Observability · FIN-E04, and `10-API.md` · **M** (0.5 d)
Sentry in all three runtimes; `/api/health` with the build SHA and a Supabase check; an uptime
monitor; a weekly query over `email_logs` for `status != 'sent'`.

---

## PHASE 3 — Engineering quality (weeks 6–12)

| # | Task | Findings | Complexity |
|---|---|---|---|
| 3.1 | `helpers` + `helper_verifications` + `placements` + `replacements` schema, populated by ops | FIN-C04, FIN-C05 | L |
| 3.2 | Generate `PLAN_DETAILS` for the edge functions from `plans.ts`; add `_shared/contact.ts` | FIN-P05, FIN-TD01 | M |
| 3.3 | Split `AuthContext` into `useProfile` / `usePlan` / `useBookings` with real error states | FIN-TD03 | L |
| 3.4 | Build the SPA in CI instead of committing the artifact; add `deploy:functions` | FIN-E02, FIN-TD04 | M |
| 3.5 | npm workspaces; `shared/` for plan data, contact constants and types | FIN-TD02, FIN-DEP01 | L |
| 3.6 | Split `compose.ts` into `compose/` and `copy/`; add the Tier-4 invariant tests | FIN-TD05 | M |
| 3.7 | Transactional account deletion via a `SECURITY DEFINER` rpc; add missing cascades | FIN-S09 | M |
| 3.8 | Root `README` covering three projects, three deploy paths, the env contract | FIN-E01, FIN-TD08 | M |
| 3.9 | Booking pagination; composite indexes; `updated_at` triggers | FIN-DB04, FIN-DB05 | M |
| 3.10 | Report-only CSP with a hashed inline analytics script | FIN-S10 | M |

---

## PHASE 4 — Nice to have

| Task | Findings |
|---|---|
| Delete ~450 lines of confirmed dead code | FIN-D01–D09 |
| Pin `esm.sh` Supabase version; add `engines` + `.nvmrc`; clear `npm audit` | FIN-DEP01, DEP02 |
| Delete the `headers` block from `vercel.json` | FIN-E03 |
| Drop the footer year | FIN-B12 |
| Reconcile the booking state machine (`confirmed`) | FIN-B11 |
| Reduce CTA density to one primary per page | FIN-U04 |
| Add "forgot password" and "resend verification" to `AuthPage` | `08-UX` |
| Show a booking reference number | `08-UX` |
| Replace the maintenance page's fabricated telemetry | `15-DEAD-CODE` |
| Publish support hours next to every WhatsApp CTA | FIN-C-notes |
| Reconcile `/app/terms` with `/terms-of-service` | FIN-C-notes |

---

## Gate before re-enabling checkout

Do not set `PURCHASES_PAUSED = false` until every box in
`11-PAYMENTS.md` → *"Verification checklist before re-enabling checkout"* is ticked. That
checklist is the acceptance criteria for Phase 0 plus tasks 1.5 and 1.6.

## Sequencing note

Phase 0 tasks 0.2 and 0.5 are database-only and can ship **today**, independently of
everything else. They retire the two integrity risks with the worst downside for about an hour
of work, and they are safe to apply ahead of the code changes that depend on them. If nothing
else in this plan happens this week, do those two.

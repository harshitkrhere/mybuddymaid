# 00 — Executive summary

**MyBuddyMaid engineering audit** · 2026-09-08 · commit `6cb719f9` (`main`, clean tree)
Scope: all 237 tracked files across three applications, plus non-mutating live verification
against https://mybuddymaid.in and the project's own Supabase endpoints.
No code was modified.

---

## Findings

| Severity | Count |
|---|---|
| CRITICAL | **0** |
| HIGH | **9** |
| MEDIUM | **19** |
| LOW | **11** |
| INFO | **1** |
| **Total** | **40** |

**Why nothing is rated CRITICAL.** Nothing found allows anonymous cross-tenant data access,
anonymous payment fraud, or destruction of production data. Row Level Security is correctly
configured on all four user tables and is the one control the architecture depends on most.
The nine HIGH findings are serious and several are live in production — but each requires
either an authenticated account or one step beyond simply opening the site. Rating them
CRITICAL would devalue the word for the day something genuinely is.

**What was verified live** (non-mutating): `www`→apex 308 · `.html`→clean 301 · 404 handling ·
all six security headers · `robots.txt` and `sitemap.xml` · locality page metadata and
`index, follow` · single `<h1>` on blog posts · `/api/lead` returns 503 · `/og` returns 200 to
arbitrary text · deployment status of all six edge functions · that the **public anon key from
the site's own JS bundle passes the Supabase function gateway** · that `/privacy-policy` ships
zero matching CSS.

**Confirmation stopped one step short** where finishing would have caused a real side effect:
FIN-S01's final send (a real email to a real inbox) and the payment replays (a real charge).
Both are CONFIRMED from code plus reachability; neither was executed.

---

## Top 10 most important problems

### 1. Two live edge functions send branded email to any address, with no caller check — FIN-S01
`send-package-email/index.ts:403`, `send-booking-email/index.ts:669`.
Neither reads the `Authorization` header. Recipient, name, plan, amount and payment ID all
come from the request body. The Supabase gateway rejects requests with no header — but it
accepts the **anon key, which is shipped inside `/_spa/assets/index-BXK52Lnq.js` to every
visitor**. I verified live that this key reaches function code.
**Why it matters:** anyone who views source can send unlimited, DKIM-signed
`noreply@mybuddymaid.in` email that renders as a genuine plan confirmation. That is a phishing
kit aimed at your own customers, and it burns your domain's deliverability for the real ones.
**Fix:** the same six lines the payment functions already use, plus deriving the recipient from
the token. **Effort: 2 hours.**

### 2. One payment can be replayed for unlimited plan renewals — FIN-S02 + FIN-DB01
`verify-razorpay-payment/index.ts:146-173`; `supabase-schema.sql:103`.
The function deactivates existing plans and inserts a new one with a fresh `expires_at` on
every call, and `razorpay_payment_id` has no `UNIQUE` constraint. A customer who paid once
holds a valid signature triple forever.
**Fix:** a partial unique index (15 minutes) makes it unexploitable today; the idempotent
early-return follows. **Effort: 3 hours.**

### 3. Payment verification fails open — FIN-S03
`verify-razorpay-payment/index.ts:127`. The amount check, the status check and the
captured/authorised gate all sit inside `if (paymentCheckResponse.ok)`. A Razorpay timeout,
429 or 5xx skips every one of them and the plan activates anyway.
This compounds: the HMAC signature covers `order_id|payment_id` only — it does **not** bind
`plan_name`. So the amount check is the sole barrier between "paid ₹4,999 for Silver" and
"granted ₹6,999 Diamond", and it is the check that disappears under load.
**Fix:** return 503 instead of falling through; assert `order_id` and `notes.user_id`, which
`create-razorpay-order` already writes and nothing reads back. **Effort: 2 hours.**

### 4. The privacy policy and terms of service render completely unstyled in production — FIN-B01
`app/privacy-policy/page.tsx`, `app/terms-of-service/page.tsx`.
Both use classes from `styles/static-pages.css`, which **nothing imports**. Verified live: the
only stylesheet those pages load contains `static-hero` 0 times, `static-content` 0,
`static-article` 0, `.container` 0. The body renders as raw full-bleed text.
**Why it matters:** these are the two pages Google, Razorpay, AdSense and a cautious customer
open to decide whether this business is real. On a trust-led site, they are the most visually
broken thing you ship. **Fix:** move both onto the `TrustPage` shell the other five trust pages
already use. **Effort: 2 hours.**

### 5. Every "Book in the app" CTA throws away its locality context — FIN-B02
`CtaButtons.tsx:29` builds `/app/auth?city=…&locality=…&service=…` on all 2,052 service pages.
The SPA never reads query parameters. It reads `sessionStorage['mbm_redirect_context']` in
three places, and **nothing in the repository ever writes that key**.
**Why it matters:** the entire point of a 342-locality architecture is capturing
locality-specific intent, and it is discarded at the exact moment it becomes actionable. There
is also no join between the SEO page that produced a signup and the signup, so per-locality ROI
cannot be computed. **Effort: 1 day.**

### 6. The plan CTAs lead to an eight-step dead end — FIN-U01
"Choose Gold" → sign-up → email verification → onboarding → 4-second splash → pricing → re-type
your phone → *"Online payment is temporarily unavailable, message us on WhatsApp."*
The WhatsApp button was on the page they started from. Checkout was paused
(`PURCHASES_PAUSED = true`) but the funnel leading to it was never re-pointed.
**Fix:** while checkout is paused, point plan CTAs at WhatsApp prefilled with the plan name —
the message already exists in `PricingPage.jsx:15` — and say it on the pricing page instead of
in a modal at step 8. **Effort: 3 hours. Highest value per hour in the entire plan.**

### 7. A payment that succeeds while the browser closes is silently lost — FIN-P02
There is **no webhook**. Plan activation depends entirely on the browser calling
`verify-razorpay-payment` from Razorpay's client-side handler. Close the tab, lose signal, get
a phone call — the money is captured and no plan exists. No reconciliation, no retry, nothing.
The only recovery is the message at `PricingPage.jsx:117`: *"Contact support if amount was
deducted."* **This gets worse once #3 is fixed**, which is why they must ship together.
**Effort: 1 day.**

### 8. 2,052 pages are differentiated mainly by name substitution — FIN-SEO01
`compose.ts:382-489`. Per-page prose comes from a **4-way switch on `housingProfile`**, two
conditionals, and shared task lists identical across all 342 localities. The quality gate
passes 2,489 of 2,513 pages — but it measures Jaccard distance on 5-word shingles (which name
substitution alone defeats) and "share of sentences containing the page's own name".
**Neither measures informational value.**
To be fair: this is a far better version of this pattern than most, the underlying data is real,
and unverified claims are genuinely withheld. But the page count exceeds the volume of
distinct information available, which is what Google's scaled-content policy targets.
**First action is measurement, not a rewrite:** run `npm run seo:gsc` and count Indexed vs
"Crawled – currently not indexed" for that route group. Google may have already decided.

### 9. The migration that claims to lock down booking columns locks down nothing — FIN-S04
`security-migration.sql:29-39`. Titled *"Restrict booking UPDATE to safe columns only… NOT
status/amount/payment_id"*, and the restriction is written as a **comment**. The `WITH CHECK`
is identical to the `USING` clause. Any authenticated user can `PATCH` their own booking's
`status`, `amount`, `payment_id` and `assigned_helper` straight through PostgREST with the
public anon key.
Blast radius is their own rows only — but it corrupts every operational report, and a control
documented as fixed but not implemented is worse than a known gap. **Effort: 1 hour** (column-level `GRANT`).

### 10. Nothing that handles money, identity or personal data has a test — FIN-T01
One test file, seven tests, covering HTML string stripping. Zero tests for payment
verification, RLS, authentication, account deletion, the lead API or the composition engine.
There is no CI at all.
**Five of the six HIGH findings above are single missing conditionals**, each of which a
twenty-line test would have caught. FIN-B03 — the lead API writing `city` where the schema says
`city_slug` — would have been caught the first time anyone ran it against a real table.
**Effort: 1 day for the payment/auth suite. Write it before re-enabling checkout.**

---

## Top 10 quick wins

Each under an hour, each retiring real risk.

| # | Fix | Finding | Time |
|---|---|---|---|
| 1 | `CREATE UNIQUE INDEX … ON user_plans (razorpay_payment_id)` | FIN-DB01 | 15 m |
| 2 | `CREATE UNIQUE INDEX … ON user_plans (user_id) WHERE is_active` | FIN-DB02 | 15 m |
| 3 | Column-level `GRANT UPDATE (notes, city)` on `bookings` | FIN-S04 | 30 m |
| 4 | "12 days" → "12 months" in the Razorpay checkout description | FIN-B04 | 15 m |
| 5 | Delete the AdSense loader — 150 KB on 35 blog pages with zero ad units | FIN-PF01 | 15 m |
| 6 | Remove `Disallow: /*?*` — it blocks every `gclid`/`utm` ad landing URL | FIN-B10 | 10 m |
| 7 | Rename `city`/`locality`/`service` → `*_slug` in `/api/lead` | FIN-B03 | 15 m |
| 8 | Fix "Premium Plus" and "Demo User" in the app sidebar | FIN-C07 | 30 m |
| 9 | "Booking Confirmed!" → "Request received" | FIN-U03 | 30 m |
| 10 | Pin `esm.sh/@supabase/supabase-js@2` → `@2.112.2` in all six functions | FIN-DEP01 | 15 m |

Plus a five-minute check with a large downside: **confirm Vercel Preview deployments do not
point at the production Supabase project.**

---

## Top 10 long-term engineering improvements

1. **A `helpers` + `helper_verifications` + `placements` schema.** The site makes five specific
   verification claims on 2,513 pages and there is **no helpers table anywhere**. The checks
   may well be performed by hand — but there is no system of record, so the company cannot
   substantiate its own most important claim. This is the largest *business* gap found.
2. **A payment-events table and a real payment funnel.** Orders created → attempted → captured
   → activated are four numbers that do not exist anywhere today.
3. **Generate the edge functions' plan data from `plans.ts`** instead of hand-copying it into
   two Deno files. A missed copy is a total purchase outage visible only in production.
4. **CI, with an SPA staleness check.** `public/_spa` is a committed build artifact; nothing
   verifies it matches `app/src`. It is current today by discipline alone.
5. **Split `AuthContext` into hooks with real error states.** Today every failure is caught,
   logged to a console nobody reads, and rendered as an empty state — a database outage is
   indistinguishable from having no bookings.
6. **Sentry + a health endpoint + request IDs.** The marketing side is instrumented four times
   over; payments, bookings, deletion and email have no instrumentation at all.
7. **A `shared/` package and npm workspaces.** Two front-ends currently share no code, no
   types, no constants and no session. The broken CTA handoff is what that costs.
8. **Replace the local-token gate with a sentence-level uniqueness metric**, and publish
   service×locality pages only where genuinely local data exists.
9. **Supabase CLI migrations.** Three SQL files, two directories, no history, no ordering, not
   idempotent.
10. **A root README covering all three projects, all three deploy paths and the environment
    contract.** The SEO subsystem is documented beautifully; the payment and auth subsystems —
    where every serious finding lives — are documented not at all.

---

## If I were the CTO, this is what I would fix first

**Week one, in this order.**

**Day 1, before anything else — two SQL statements and one config check.** The unique index on
`razorpay_payment_id` and the partial unique index on one-active-plan-per-user. Thirty minutes,
no code deploy, and they make the payment replay unexploitable immediately. Then confirm Vercel
Preview is not pointed at production Supabase. If nothing else in this audit gets done this
week, do these.

**Day 1–2 — close the email relay (FIN-S01).** It is two hours of work and it is the one live
finding where an outsider, today, with nothing but view-source, can do reputational damage you
cannot undo. Email deliverability takes months to rebuild.

**Day 2–4 — make payment verification honest (FIN-S03, FIN-P01) and add the webhook (FIN-P02).**
These ship together or not at all: failing closed without a webhook converts a silent
over-grant into a stranded paying customer. Do not re-enable checkout until the checklist in
`11-PAYMENTS.md` is fully ticked. Write the eleven payment tests as you go — they are the
cheapest insurance in the plan.

**Day 5 — two things a customer sees.** Fix the unstyled legal pages (two hours), and re-point
the plan CTAs at WhatsApp (three hours). The second one is worth more than everything else in
this list combined in revenue terms: right now your loudest buttons route high-intent visitors
through eight steps to a message telling them to use the button they already had.

**Then, week two:** carry CTA context into the app, turn on lead capture properly, and stand up
CI.

**And separately, in parallel, get one number:** open Search Console and count how many of the
2,052 service×locality pages Google has actually indexed. Everything about the SEO strategy —
whether to keep 2,489 pages or demote 1,500 of them — depends on that number, and nobody has
looked. The tooling to fetch it (`npm run seo:gsc`) already exists in this repository.

---

## Would I trust this application with real customers, real bookings, real payments and real personal data?

**Bookings and personal data: yes, with the Phase 0 fixes.** RLS is correctly configured and
is doing real work. The service-role key never reaches a client. There is no IDOR, no SQL
injection, no XSS surface, no exposed secret, no open redirect. Account deletion is
authorisation-correct. The two gaps — the unrestricted booking-column UPDATE and the
non-transactional deletion — are contained and cheap to fix.

**Payments: not yet, and it is right that they are paused.** The foundation is genuinely good —
server-side pricing, server-side order creation, real HMAC verification, RLS blocking direct
plan inserts. That is more than most Indian SMB checkouts get right. But three defects sit on
top of it: no idempotency, a verification path that fails open, and no webhook. Each is a few
hours of work. **Do not un-pause checkout until all three and the eleven tests are done.**

**Marketing and trust content: yes on the writing, no on two specifics.** The prose is honest
and well-judged, and the deliberate refusal to publish invented testimonials and unverified
locality claims is a real, unusual discipline. But two published refund policies contradict
each other on the same site, with one linking to the other as authoritative — and the two
pages that establish legitimacy render unstyled.

**Honest overall assessment.** This is a **well-engineered SEO platform bolted to a
half-finished product**, and the seam between them is where almost every serious finding lives.
The Next.js side shows real judgement: one source of truth, near-zero JavaScript across 2,513
pages, a quality gate that will noindex its own output, unverified claims withheld rather than
asserted, and 50 numbered assumption entries explaining why each decision was made. I found
myself confirming several findings faster *because* a comment explained the trade-off honestly.

The transactional side has none of that discipline. Two of six edge functions forgot the auth
check the other four have. The security migration's central control is a comment. A schema
migration the product depends on is marked "NOT APPLIED". Business constants are hand-copied
across runtime boundaries. And nothing that touches money has a single test.

The pattern is consistent and diagnosable: **wherever this codebase has one owner and one
source of truth, it is excellent; wherever a rule has to be remembered separately in three
places, it has been forgotten in at least one.** That is not a talent problem, it is a
structure problem, and it is why the recommendations lean on shared modules, generated
constants and CI rather than on care.

None of this warrants a rewrite. The architecture is sound, the data layer is a genuine asset,
and the highest-severity findings are individually small — most of the Top 10 are hours, not
weeks. **Phase 0 is about three days of work and it retires every live risk found.**

---

## Coverage confirmation

| Area | Inspected |
|---|---|
| All 237 tracked files | yes |
| Every route (25 Next.js + 11 SPA) | yes — `02-ROUTES.md` |
| Every API route and edge function (7) | yes, incl. live deployment status |
| Every database table, policy, index and migration | yes — `09-DATABASE.md` |
| Every external integration (Supabase, Razorpay, Resend, GA4, Umami, Vercel, AdSense) | yes |
| Payment flow, end to end | yes — `11-PAYMENTS.md` |
| Auth and authorisation, incl. RLS | yes — `04-SECURITY.md` |
| All four forms | yes — validation, submit, error, double-submit |
| All five user journeys (A–E) | yes — `08-UX-CONVERSION.md` |
| SEO: metadata, canonicals, robots, sitemaps, JSON-LD, cannibalisation | yes — `06-SEO.md` |
| Accessibility (static review) | yes — `07-ACCESSIBILITY.md` |
| Content and every public trust claim, cross-referenced to implementation | yes — `16-CONTENT.md` |
| Dependencies, both projects, `npm audit` run | yes — `12-DEPENDENCIES.md` |
| Dead code and duplication | yes — `14`, `15` |
| Deployment and environment | yes — `17-DEPLOYMENT.md` |
| Live site cross-check | yes, non-mutating |
| **Core Web Vitals** | **NOT MEASURED** — see `05-PERFORMANCE.md` for how |
| **Rendered-DOM / screen-reader a11y testing** | **NOT POSSIBLE IN THIS ENVIRONMENT** — the browser pane blocked the site's CSS and JS |
| **Mobile rendering at 320/375/390/414 px** | **NOT POSSIBLE IN THIS ENVIRONMENT** — assessed from CSS only; no styles exist below the 480 px breakpoint, which should be checked on a real device |
| **Search Console indexation data** | **NOT AVAILABLE** — requires account access; `npm run seo:gsc` exists to fetch it |

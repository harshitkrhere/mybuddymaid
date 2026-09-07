# 16 — Content, copy and trust claims

Section 34 of the brief asks: for every public claim, *where is this implemented?* That
question drives this document, and it produces the two most important findings in it.

## Overall quality

The prose is good. It is written in plain English, avoids marketing inflation, uses Indian
domestic-help vocabulary correctly (`jhadu-pocha`, `bartan`, `japa`, live-in vs full-time),
and states limits honestly — *"Verification reduces risk; it does not eliminate it"*,
*"Indicative monthly bands, not quotes"*, *"we do not maintain branch offices in each
locality, and we do not claim to"*.

`ASSUMPTIONS.md` #47 records that invented social proof ("12,000+ happy families", "4.9/5 —
500+ reviews", "100% police verified", four named testimonials) was deliberately removed
rather than reproduced. That decision costs conversion and buys defensibility, and it is
correct. No spelling or grammar errors were found in the hand-written pages.

The problems are not with the writing. They are that **two important claims contradict each
other across pages**, and that **several trust claims have no system behind them**.

---

## [FIN-C01] The refund policy contradicts itself across two linked pages

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Content / Legal / Trust

**Location:** `next-app/app/replacement-policy/page.tsx:62-68` vs `next-app/app/terms-of-service/page.tsx:34-35`

`/replacement-policy` states a specific, conditional, largely non-refundable policy:

> The platform fee is refundable, minus a processing fee, **only if** we are unable to provide
> **3** suitable verified profiles matching your original stated requirements within **60 days**
> of payment. Refunds are not issued once a candidate has been successfully hired, or where the
> client becomes unresponsive. **The full terms are in our terms of service.**

Follow that link. `/terms-of-service` §5 states something materially different:

> Cancellation requests are processed within 7 business days. Refund eligibility depends on
> the stage of service and is **assessed on a case-by-case basis**.

These are not two descriptions of one policy. One is a narrow conditional entitlement with a
hard 60-day/3-profile test; the other is open-ended discretion. And the first page explicitly
points at the second as authoritative, so a customer following the trail ends up further from
an answer than when they started.

**Why it is serious.** This is the term a customer will invoke when things go wrong, and it is
the term a payment gateway, a consumer forum or a chargeback process will read. Under Indian
consumer-protection law, ambiguity in a standard-form contract is construed against the
drafter. Two published, contradictory refund terms is the worst possible position to argue
from.

**Recommended solution.** Write the refund terms **once**, in `/terms-of-service`, and have
`/replacement-policy` summarise and link to it rather than restate it. The constants
`REFUND_WINDOW_DAYS = 60` and `REFUND_PROFILE_THRESHOLD = 3` already exist in
`data/seo/plans.ts:58-60` — render them in both places from the same source so they cannot
drift again. (`/pricing` already imports both constants and then never uses them, which
suggests this was the intent.) This needs a legal review, not just an engineering fix.

---

## [FIN-C02] The terms of service describe a payment flow that is switched off

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Content / Trust

**Location:** `next-app/app/terms-of-service/page.tsx:30-31`

> **3. Booking & Payments** — Bookings are confirmed upon payment. All payments are processed
> securely through Razorpay.

Neither sentence is true today:
- Online checkout is disabled (`PricingPage.jsx:12`, `PURCHASES_PAUSED = true`), so no payment
  can be made through the product at all.
- The booking flow that *does* work (`ServiceDetailPage` → `createBooking`) takes **no
  payment whatsoever** — it writes a row with `status: 'pending'` and no `amount` or
  `payment_id`. So "bookings are confirmed upon payment" describes neither the paused flow nor
  the working one.

Related, same file: §1 lists *"postnatal care specialists"* as a service. The SEO data layer
has no postnatal service (it is folded into `babysitter-nanny`, per `services.ts:1-5`), and
the SPA's `postnatal` entry has no price band at all — it renders as "Premium"
(`constants.js:106`). A customer reading the terms would reasonably expect a bookable
postnatal service.

**Fix:** rewrite §3 to describe what actually happens — a request is submitted, the team
contacts the customer, the platform fee is collected when the booking is confirmed (currently
over WhatsApp or by phone). Reconcile §1's service list with `data/seo/services.ts`.

---

## [FIN-C03] The police-verification claim differs between the website and the confirmation email

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Content / Trust

**Location:** `data/seo/plans.ts:40` and `app/how-we-verify/page.tsx:34` vs
`supabase/functions/send-plan-email/index.ts:25-31`

| Surface | Gold plan says |
|---|---|
| `plans.ts:40` | `policeVerification: true` |
| Home page plan card (`app/page.tsx:311`) | "Police verification included" |
| `/how-we-verify:34` | "Comprehensive police verification is conducted for helpers placed on our Gold and Diamond plans." |
| Home page verify section (`compose.ts:895`) | "police verification is completed for Gold and Diamond plans" |
| `send-plan-email` `PLAN_FEATURES.gold` | **"Enhanced Reference & Background Checks"** — police verification is listed only for `diamond` |

Five surfaces say Gold includes police verification; the sixth, a customer-facing email, does
not. The site is consistent with itself; the email is the outlier.

**Mitigating:** `send-plan-email` is **not deployed** (404, verified) and has no caller — the
live email function is `send-package-email`, whose Gold benefits do not mention verification
tier at all. So no customer receives the contradictory version today.

**Fix:** deleting `send-plan-email` (FIN-D01) resolves this. When writing benefit copy into
`send-package-email`, derive it from the plan record rather than restating it — the same
`policeVerification` boolean the site renders.

---

## [FIN-C04] The verification claims have no implementation, no data and no record

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Content / Trust / Business logic

**Location:** claims at `app/how-we-verify/page.tsx:22-52`, `compose.ts:352-360` (on all 2,513
pages), `app/page.tsx:186-201`. Implementation: **none found.**

The site makes five specific, repeated verification claims:

1. "Aadhaar validation… we keep the identity record on file"
2. "Previous-employer reference checks… we contact households where the helper has worked before"
3. "Behavioural assessment… every applicant is assessed in person"
4. "Comprehensive police verification is conducted for Gold and Diamond plans"
5. "Before placement we share the verification dossier for the helper you select, including
   identity proofs and police-verification status"

Cross-referencing against the codebase, as the brief requires:

- There is **no helpers/maids table** in any schema file.
- There is **no verification record, status field, document store or dossier** anywhere.
  Supabase Storage is not used at all.
- `bookings.assigned_helper` is a nullable `TEXT` column that **nothing ever writes** and no
  interface populates.
- There is no admin surface, no applicant flow and no screening workflow in either front-end.
- The word "dossier" appears in exactly one place: the marketing copy.

**These claims may well be completely true** — this is an operations-led business, and the
checks are plausibly done by hand with paper and WhatsApp. Nothing in this audit suggests
dishonesty. The finding is narrower and still important:

**There is no system of record.** The company cannot, from its own software, answer "was this
helper police-verified, when, by whom, and where is the evidence?" If a placement goes wrong —
and in this industry one eventually will — the claims on 2,513 public pages are the standard
the company will be held to, and there is nothing in the product to substantiate them.

This is also the biggest *business* gap the audit found, not just a technical one: the
verification data is the company's most defensible asset and it is not being captured.

**Recommended solution.** A minimal, genuinely useful schema — five tables, no UI needed
initially, populated by the ops team through the Supabase dashboard:

```sql
helpers(id, full_name, phone, city_slug, locality_slug, status, created_at)
helper_verifications(id, helper_id, kind, status, verified_at, verified_by,
                     document_ref, notes)      -- kind: aadhaar | reference | behavioural | police
helper_services(helper_id, service_slug)
placements(id, booking_id, helper_id, started_at, ended_at, outcome)
replacements(id, plan_id, placement_id, requested_at, fulfilled_at, reason)
```
That is one afternoon of SQL. It makes the claims auditable, it makes `assigned_helper`
meaningful, it makes `replacements_used` incrementable (FIN-C05), and it produces exactly the
placement data `docs/seo/leads-schema-proposal.md` says Phase 5 needs.

**Until then:** the claims should stay as they are only if the operator confirms the manual
process actually runs. If any of the five is aspirational rather than current, it must come off
the site — the same standard already applied to the removed testimonials, and to the
`[VERIFY]` mechanism that withholds unconfirmed locality claims.

---

## [FIN-C05] The replacement policy is published in detail and implemented nowhere

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Content / Business logic

**Location:** claims at `app/replacement-policy/page.tsx`, `compose.ts:361-368` (all 2,513
pages), `app/page.tsx:202-217`. Implementation: partial and inert.

The site commits to specific counts: 3 replacements over 10 months (Silver), 5 over 12 (Gold),
10 over 18 (Diamond), with a new profile shared within 48 hours.

What exists in the system:
- `user_plans.replacements_total` — written once at plan activation. Correct.
- `user_plans.replacements_used` — defaults to 0 and **is never incremented by any code path**.
  `grep -rn "replacements_used" --include=*.ts --include=*.jsx .` finds it only in the schema,
  in the insert (set to 0) and in one read for display (`PricingPage.jsx:232`).
- There is **no replacement request flow** — no button, no form, no function, no table.
  `/replacement-policy` says "Message us on WhatsApp or call", which is honest, but means
  nothing is recorded.
- Nothing expires a plan when `expires_at` passes, so `PricingPage` will display an expired
  plan as "Active" with its full replacement count remaining, indefinitely.

**Consequence:** the counter the customer sees — *"{total − used} replacements left"*
(`PricingPage.jsx:232`) — **always shows the full allowance**, no matter how many replacements
have actually been provided. A customer who has used all five of their Gold replacements still
sees "5 replacements left". That is a display of contractual entitlement that is wrong in the
company's disfavour, and it will be quoted back at the ops team.

**Fix:** the `replacements` table in FIN-C04, plus a trigger or function that increments
`replacements_used`, plus a `expires_at > now()` condition wherever a plan is read as active.
Until then, consider hiding the "replacements left" counter rather than showing a number that
is known to be wrong.

---

## [FIN-C06] The privacy policy is thin and does not meet DPDP requirements

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Content / Compliance

Covered in full as **FIN-S07** in `04-SECURITY.md`. Summarised here because the remedy is a
content task: seven required disclosures are missing (grievance officer, retention periods,
the full processor list, cross-border transfer, breach notification, children's data, and the
self-serve deletion the app actually implements), the page is dated "August 2026", and it
renders unstyled (FIN-B01).

---

## [FIN-C07] Development placeholders shipped to production in the booking app

**Severity:** LOW · **Confidence:** CONFIRMED (present in the deployed bundle) · **Category:** Content / Trust

**Location:** `app/src/components/AppLayout.jsx:46-47`

```jsx
<div className="sum-name">{profile?.full_name || 'Demo User'}</div>
<div className="sum-plan"><Sparkles size={12}/> Premium Plus</div>
```

- **"Premium Plus" is hard-coded for every user**, regardless of plan — or of having no plan
  at all. Verified present in the shipped bundle
  (`next-app/public/_spa/assets/index-BXK52Lnq.js`). There is no "Premium Plus" plan; the
  plans are Silver, Gold and Diamond. A free user's sidebar tells them they are on a premium
  tier that does not exist.
- **"Demo User"** is a development placeholder visible to any user whose profile has not
  loaded.

**Fix:** render the real plan from `userPlan` (`AuthContext` already holds it), or "No active
plan" with a link to `/pricing` — which is also the better conversion prompt. Replace "Demo
User" with the user's email or an empty state.

---

## Smaller content notes

| Note | Location |
|---|---|
| `/app/terms` duplicates `/terms-of-service` with different wording — two versions of the agreement | `app/src/pages/TermsPage.jsx` |
| Terminology drift: "helper" (site) vs "Buddy" (emails: "Curated Buddy Profile") vs "professional" (terms) vs "maid" (titles) | site-wide |
| City naming is handled well — `Gurgaon (Gurugram)`, `Bangalore (Bengaluru)`, `Mangalore (Mangaluru)` consistently, via `TITLE_ALT` | `lib/seo-engine/meta.ts:37-41` |
| Support hours ("Mon–Sun 9 AM–9 PM") appear in exactly one place and not on `/contact` | `PricingPage.jsx:200` |
| The phone number `9355114869` is a literal in **14 files** across all three projects, in five different formats | see `14-TECHNICAL-DEBT.md` |
| "Founded 2021" appears on `/about` and in `Organization` JSON-LD — consistent | `about/page.tsx:48`, `jsonld.ts:14` |
| Registered office address is identical across `/about`, `/contact`, the footer and JSON-LD — consistent | 4 locations |
| SPA `PLATFORM_FEATURES` advertises "Secure Razorpay payments" on the page where payment is disabled, and "Dedicated relationship manager" as a platform-wide benefit when `plans.ts` gives it to Gold only | `PricingPage.jsx:20-29` |
| The maintenance page shows fabricated progress (84%) and invented subsystem names | `lib/maintenance.ts:11-22` — see `15-DEAD-CODE.md` |

## Claim-to-implementation cross-reference (brief §34)

| Public claim | Implementation found |
|---|---|
| "Verified helpers" (every page, every badge) | **None.** No helpers table, no verification records — FIN-C04 |
| "Police verified" (Gold/Diamond) | **None.** A boolean in `plans.ts` that drives copy only — FIN-C04 |
| "Replacement policy" (every page) | **Partial.** Counts stored; never decremented; no request flow — FIN-C05 |
| "Book online" / "Book in the app" | **Partial.** Creates a `pending` booking row; no scheduling, no assignment, no payment — FIN-U03 |
| "Payment" / "Secure Razorpay payments" | **Built but disabled.** Functions live, client paused — see `11-PAYMENTS.md` |
| "Aim to share a replacement profile in 48 hrs" | **None.** No SLA tracking, no timestamps on replacement requests |
| "1/3/5 verified profiles shared" | **None.** No profile-sharing mechanism exists |
| "Dedicated relationship manager" (Gold+) | **None.** No account-manager assignment anywhere |
| "24/7 support via WhatsApp" (SPA) | **Contradicted** by the stated Mon–Sun 9 AM–9 PM hours |
| "342 localities across 8 cities" | **Fully implemented and verified.** The data layer is real, exported, and enforced everywhere |
| "Indicative pricing bands" | **Fully implemented.** Single source, rendered consistently, correctly labelled as indicative |
| "If an area has no page, we do not serve it yet" | **Fully implemented and mechanically enforced.** The best claim on the site |

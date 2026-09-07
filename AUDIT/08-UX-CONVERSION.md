# 08 — UX and conversion

Walked as a first-time customer. The governing question throughout: *would a first-time
customer know exactly what to do next?*

## The central problem, stated once

**The site has five prominent calls to action. Three of them work, and the two that look most
like "buying" lead to a dead end.**

| CTA | Where | What actually happens |
|---|---|---|
| WhatsApp | every page, hero + footer CTA + mobile sticky bar + desktop floating button | Works. Opens WhatsApp with a locality-specific prefilled message. Good. |
| Call | every page, hero + sticky bar | Works. `tel:+919355114869`. |
| "Book in the app" / "Book Now" / "Choose Gold" | every SEO page hero, every home service card, every plan card, the salary estimator | → `/app/auth` with context that is **silently discarded** (FIN-B02) → sign up → onboarding → 4-second splash → and for a plan, a modal saying *"Online payment is temporarily unavailable… message us on WhatsApp"* |
| Lead form ("Request a call back") | would be on every location page | **Never renders.** `NEXT_PUBLIC_LEADS_ENABLED` is not set, and the API returns 503. |
| Email | footer, contact page | Works. |

So the only on-site conversion mechanism is disabled, and the most visually prominent CTAs
route a high-intent visitor through account creation to reach a message telling them to use
WhatsApp — which was available in one tap on the page they left.

---

## [FIN-U01] The primary purchase path terminates in a "contact us instead" modal, five steps in

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** UX / Conversion

**Location:** `next-app/app/page.tsx:314` → `app/src/pages/PricingPage.jsx:12,45-52,160-210`

**The full journey for "Choose Gold" on the home page:**

1. Click **Choose Gold** (`app/page.tsx:314` → `/app/auth?city=&locality=&service=`)
2. Land on a sign-in/sign-up screen. No explanation of why an account is needed, no mention
   of the plan just selected — the context was dropped (FIN-B02).
3. Create an account with email + password → **"Verification link sent to your email"**
   (`AuthPage.jsx:107`). The journey now requires leaving the site, opening email, clicking a
   link and coming back.
4. Onboarding form: name, mobile, city.
5. **4-second splash screen** (FIN-B08).
6. `/app/home`, with no memory of Gold. Navigate to Pricing.
7. Select Gold, enter mobile again (it did not prefill — FIN-B05), click **Get Gold — ₹5,999**.
8. Modal: *"Online payment is temporarily unavailable… message us on WhatsApp or call us."*

Eight steps, one email round-trip, one account, and the outcome is the WhatsApp button that
was on the page in step 0.

**Why it is a problem.** Every step is a drop-off point, and the value exchange is inverted:
the customer is asked to create an account *before* being told anything they could not
already see. The paused-checkout modal itself is well written and honest — the problem is
that it is discovered at step 8 instead of step 1.

**Root cause.** Checkout was paused (`ASSUMPTIONS.md` #50 — the Razorpay account is on hold)
but the funnel that leads to checkout was not re-pointed.

**Recommended solution — do not rebuild the funnel, re-point it while checkout is paused.**

1. **Make the plan CTAs go where the conversion actually happens.** While
   `PURCHASES_PAUSED` is true, change the home page plan buttons from `appHref()` to a
   WhatsApp link prefilled with the plan name — the same message
   `PricingPage.jsx:15-16` already composes:
   ```tsx
   const planHref = (p) => whatsappUrl(`Hi MyBuddyMaid, I would like to book the ${p.name} package. Please help me complete the booking.`);
   ```
   One line per plan card. It removes seven steps.
2. **Say it on the pricing page, not in a modal.** Add one line under "Platform plans" on
   `/pricing` and the home page: *"Online payment is paused right now — we complete bookings
   over WhatsApp or by phone."* Honesty stated up front reads as competence; the same fact
   discovered after signing up reads as a bug.
3. **Keep "Book in the app" for booking, not buying.** The service-booking flow
   (`ServiceDetailPage`) *does* work end to end and does not need payment. It is a reasonable
   destination — once FIN-B02 makes it arrive pre-filled.
4. Drive a single flag. Today `PURCHASES_PAUSED` lives in the SPA only, so the Next.js site
   cannot see it. Export it through `serviceability.json` (or a shared constant) so one
   change flips both surfaces.

**Business impact:** this is the difference between a visitor messaging you in one tap and
abandoning at step 3. Given that WhatsApp is currently the *only* working conversion path,
routing the loudest CTAs away from it is the most expensive UX decision in the product.
**Effort:** hours, not days.

---

## [FIN-U02] The site's only on-page lead capture is disabled, so every conversion leaves the site

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** UX / Conversion

**Location:** `components/seo/SeoPage.tsx:11,52`; `app/api/lead/route.ts:23-25`

`LeadForm` renders only when `NEXT_PUBLIC_LEADS_ENABLED === 'true'`. It is not set. The API
returns 503 (**verified live**), the `leads` table is marked *"PROPOSAL — NOT APPLIED"*, and
if it were applied the insert would fail on column names (FIN-B03).

So on all 2,513 location pages there is **no way to leave your number**. A visitor who is
interested but not ready to open WhatsApp — browsing at work, comparing providers,
researching for a parent — has no action available. Every conversion requires jumping to a
different app.

**Why this matters more than it looks.** The whole architecture exists to capture
locality-specific intent, and `docs/seo/leads-schema-proposal.md` describes building the
business's demand model from exactly this data. None of it is being collected.

**Fix, in order:** apply the migration → fix FIN-B03 (column names) → fix FIN-B06 (silent
failure) → add rate limiting (FIN-S06) → set both flags. That is a day of work and it turns
on the site's primary conversion mechanism.

Consider also placing the form *below* the fold rather than in the hero — the hero already
carries three CTAs, and a form there competes with the WhatsApp button that currently
converts.

---

## Journey-by-journey findings

### Journey A — Visitor → homepage → city → service → contact
**Works.** The home page states cities, services, price anchoring, plans and process before
asking for anything. City → zone/locality → service navigation is coherent and every page has
WhatsApp/Call. The `Cities` nav link goes to `/#cities` (an anchor on the home page), which
is a slightly odd choice — from a locality page, "Cities" navigates you home rather than to a
city index — but the footer lists every city on every page, so nobody is stranded.

### Journey B — Google → landing page → service → locality → contact
**Works, and is the strongest journey.** A visitor landing on `/gurgaon/dlf-phase-3/cook`
gets pincodes, housing context, landmark references, price band, six FAQs, nearby areas and
a WhatsApp link prefilled with *"Hi MyBuddyMaid, I need a cook in DLF Phase 3, Gurgaon
(122002)."* That prefill is genuinely excellent — it means the WhatsApp conversation starts
with the operator already knowing service, locality and pincode.

### Journey C — WhatsApp CTA
**Works well.** Locality-aware prefilled text, `target="_blank" rel="noopener"`, tracked with
`data-mbm-*`. The one gap: nothing on the page sets expectations about *response time*. The
final CTA says "we reply during working hours" but never says what those are. The maintenance
config knows them (`Mon–Sun 9 AM–9 PM`, per `PricingPage.jsx:200`) — put that next to the
button.

### Journey D — Phone CTA
**Works.** `tel:+919355114869`, displayed consistently as `+91 93551 14869` everywhere.
Note the number appears in eight files as a literal — see `14-TECHNICAL-DEBT.md`.

### Journey E — App / booking flow
**Partially works, and over-promises.** Sign-up → onboarding → services → booking sheet →
`bookings.insert` → confirmation email. That path is real. But:
- The booking sheet says **"Booking Confirmed!"** with a green check
  (`ServiceDetailPage.jsx:120`) for a row whose `status` is `'pending'`, with no helper
  assigned, no date, no time and no payment. Nothing has been confirmed — a request has been
  received. See FIN-U03.
- The bookings list then shows the same item as **"Pending"**, contradicting the confirmation
  the user just saw.
- No booking can be cancelled or edited from the UI.

---

## [FIN-U03] "Booking Confirmed!" is shown for an unconfirmed request

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** UX / Trust

**Location:** `app/src/pages/ServiceDetailPage.jsx:118-123`; contradicted by `BookingsPage.jsx:10`

```jsx
<CheckCircle2 size={56} color="#34D399" />
<h3>Booking Confirmed!</h3>
<p>We'll contact you shortly to finalize details.</p>
```
The two sentences contradict each other, and the row is written with `status: 'pending'`
(`AuthContext.jsx:162`). Two seconds later the user is redirected to a list where the same
item reads "Pending".

For a service where a stranger will enter the customer's home, "confirmed" carries weight.
Setting an expectation you immediately walk back is the fastest way to lose the trust the
rest of the site works hard to build.

**Fix:** *"Request received"* / *"We'll call you within 24 hours to arrange interviews."*
Align the confirmation email's subject line the same way — `send-booking-email` currently
uses subjects like *"Booking Confirmed — Your Part-Time Home Helper is Being Arranged"*,
which has the same problem inside a single sentence.

---

## [FIN-U04] CTA overload on every location page

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** UX / Conversion

**Location:** `components/seo/SeoPage.tsx:51,170,173`; `app/page.tsx:409`

A single locality page renders:
- `CtaButtons` in the hero — WhatsApp, Call, **Book in the app** (3 buttons)
- `CtaButtons` again in the "Ready to book?" section (3 more)
- `StickyCta` fixed to the bottom on mobile (2 more)
- on the home page additionally: a floating WhatsApp button on desktop, plus a "Book Now"
  button on each of six service cards and each of three plan cards

On a phone that is eight identical-weight CTAs for three destinations, one of which (FIN-U01)
leads nowhere useful. When everything is primary, nothing is.

**Fix:** pick one primary action per page and make the others visually secondary.
- Hero: WhatsApp primary (it is the path that converts), Call as a quiet text button, drop
  "Book in the app" from the hero entirely while checkout is paused.
- Keep the sticky bar (it is well built — the body padding reserves its height so it causes
  no layout shift).
- Keep the closing CTA.
That removes three buttons per page and clarifies the remaining ones.

---

## Smaller UX observations

| Observation | Location | Note |
|---|---|---|
| Sign-up requires email verification before first sign-in, with no resend option | `AuthPage.jsx:107` | A user who mistypes their email is permanently stuck with no recovery path in the UI |
| No "forgot password" anywhere | `AuthPage.jsx` | Supabase supports it; the UI does not expose it. A returning customer who forgets their password cannot get in |
| "Premium Plus" shown to every user | `AppLayout.jsx:47` | See FIN-C07; a free user's sidebar claims a plan they do not have. Confirmed present in the shipped bundle |
| "Demo User" fallback name | `AppLayout.jsx:46` | Leaks development placeholder into production |
| `/app/terms` duplicates `/terms-of-service` with different text | `TermsPage.jsx` | Two versions of the terms a customer is agreeing to |
| No order/booking reference number shown to the user | `BookingsPage.jsx` | The UUID exists but is never displayed, so a customer calling support cannot identify their booking |
| Support hours stated in only one place | `PricingPage.jsx:200` | "Mon–Sun 9 AM–9 PM" should be on `/contact` and next to every WhatsApp CTA |
| No pricing shown before login inside the app | — | Actually fine: `/pricing` on the marketing site is public and complete |

## What is genuinely good, and should not be changed

- **Price transparency.** "Two numbers to understand: the one-time platform fee, and the
  monthly salary you pay the helper directly" is the clearest framing of this business model
  I have seen, and it is repeated consistently on the home page, `/pricing` and every
  location page's pricing note.
- **The salary estimator** answers the real question ("what will this actually cost me
  monthly?") without a form, works without JavaScript on first render, and correctly labels
  itself as indicative rather than a quote.
- **No fabricated social proof.** No invented testimonials, no fake review counts, no
  "12,000+ happy families". `ASSUMPTIONS.md` #47 records that these were deliberately
  removed. That decision costs short-term conversion and buys long-term defensibility, and it
  is the right one.
- **The paused-checkout modal copy** — "Nothing is charged until you confirm" — is honest and
  well written. It is in the wrong place (FIN-U01), not badly written.
- **"If an area has no page, we do not serve it yet."** Publishing the exact footprint and
  saying no outside it is a real differentiator, and the architecture enforces it mechanically.

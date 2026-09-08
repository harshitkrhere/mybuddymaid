# 04 — Security

Scope: this repository's own code and configuration, plus non-mutating verification against
the production origin and the project's own Supabase endpoints. No exploitation was
performed; where confirming a finding end-to-end would have caused a real side effect (an
email to a real address, a real plan row), the test was stopped one step short and is marked
as such.

## Method note — what "authenticated" means here

Supabase's Edge Function gateway rejects requests with no `Authorization` header. Verified
live:

```
POST /functions/v1/send-package-email   (no Authorization header)
→ 401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}
```

That is the **platform gateway**, not the function. The gateway accepts the project **anon
key**, which is shipped to every visitor inside `/_spa/assets/index-BXK52Lnq.js`. Verified
live that the public anon key passes the gateway and reaches function code:

```
POST /functions/v1/create-razorpay-order   Authorization: Bearer <anon key from public bundle>
→ 401 {"error":"Invalid or expired auth token"}      ← the FUNCTION's message, not the gateway's
```

So throughout this document, "gateway-protected" means "protected from nobody who can view
the page source". Only a function that itself calls `supabaseAdmin.auth.getUser(token)` is
actually protected.

---

## [FIN-S01] Two deployed edge functions send branded email to any address, with no caller check

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Security / Abuse

**Location:**
`supabase/functions/send-package-email/index.ts:403-508`
`supabase/functions/send-booking-email/index.ts:669-746`

**Affected functionality:** transactional email from `noreply@mybuddymaid.in` via Resend.

**What is happening.** Both functions read the payload, validate only that required *fields
are present*, and send. Neither reads the `Authorization` header, neither calls
`auth.getUser()`, and neither cross-checks `user_id` against the caller. Every value used in
the email — `user_email` (the recipient), `user_name`, `plan_name`, `amount_paid`,
`razorpay_payment_id`, `expires_at`, `city`, `notes` — comes straight from the request body.

Contrast with `create-razorpay-order/index.ts:36-50`, which does it correctly.

**Why it is a problem.** Anyone who opens the site, views source and copies the anon key can
send unlimited, fully-attacker-controlled email that is **DKIM-signed by mybuddymaid.in** and
renders as a genuine MyBuddyMaid plan-confirmation or booking-confirmation. That is a
turnkey phishing kit against the company's own customers ("your Diamond plan is active, call
this number"), and each abusive send burns the domain's Resend reputation and deliverability
for real customers.

**Root cause.** The three money/identity functions were hardened; the three email functions
were not. There is no shared auth middleware, so the check has to be remembered per file and
was not.

**Evidence.**
- `grep -n "getUser\|authHeader" supabase/functions/send-*/index.ts` → **no matches**.
- Live: both return `200` to an OPTIONS preflight (deployed).
- Live: the public anon key demonstrably passes the gateway (see method note).

**Reproduction (final step deliberately not executed).**
1. `curl -s https://mybuddymaid.in/_spa/assets/index-BXK52Lnq.js | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'` — the anon key. *(Executed; key recovered, role=anon.)*
2. `POST .../functions/v1/send-package-email` with that key and a body naming any recipient.
   **Not executed** — it would deliver a real email to a real inbox.

**Expected:** reject any caller who is not the authenticated owner of `user_id`.
**Actual:** sends.

**Business impact:** brand-impersonation phishing against your own customers; domain
blocklisting; Resend account suspension; loss of all transactional deliverability.
**Technical impact:** unbounded third-party spend; `email_logs` polluted with forged `user_id`s.

**Recommended solution.** Add the same three-line check the payment functions already use,
and bind the payload to the caller:

```ts
const authHeader = req.headers.get('Authorization');
if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401);
const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
if (error || !user) return jsonResponse({ error: 'Invalid or expired auth token' }, 401);
// then IGNORE the body's identity fields entirely:
const recipient = user.email;          // never body.user_email
const userId    = user.id;             // never body.user_id
```
For `send-package-email`, also re-read the plan from `user_plans` by `user.id` instead of
trusting `plan_name` / `amount_paid` / `expires_at` from the body.

**Implementation:** factor the check into `supabase/functions/_shared/auth.ts` and import it
in all six functions, so the next function cannot forget.
**Tests required:** no-header → 401; anon key → 401; valid user token + someone else's
`user_id` → email still goes to the token owner.
**Regression risk:** low. The SPA already sends the user's session token via
`supabase.functions.invoke`, so the authorised path is unchanged.

---

## [FIN-S02] Payment verification has no idempotency — one payment can be replayed for unlimited plan extensions

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Security / Payments / Data integrity

**Location:** `supabase/functions/verify-razorpay-payment/index.ts:146-173`;
schema gap at `app/supabase-schema.sql:103`

**What is happening.** On every successful call the function unconditionally:
1. sets `is_active = false` on all the user's active plans (line 147-151), then
2. inserts a **new** `user_plans` row with `expires_at = now() + durationMonths` (155-171).

There is no check that `razorpay_payment_id` has already been redeemed, and
`app/supabase-schema.sql:103` declares it as a plain `razorpay_payment_id TEXT` — **no
UNIQUE constraint**.

**Why it is a problem.** A customer who has legitimately paid once holds a valid
`(order_id, payment_id, signature)` triple. Replaying that triple every 11 months renews the
plan forever from a single payment. Nothing detects it: the signature is valid, the amount
matches, the Razorpay status is `captured`. The `create-razorpay-order` "you already have an
active plan" guard (line 62-71) does not help, because the replay skips order creation
entirely.

**Root cause.** The function was designed as "verify then activate" with no notion of a
payment being consumed. The duplicate-prevention check lives in the wrong function.

**Reproduction:** complete one real purchase, capture the handler payload, re-POST it to
`verify-razorpay-payment` with the same session token. Each call produces another
`user_plans` row with a fresh `expires_at`. *(Not executed — requires a real payment.)*

**Business impact:** unbounded revenue leakage per paying customer; corrupted plan history;
`replacements_total` reset to full on every replay, so replacement cover is unlimited too.

**Recommended solution — two layers.**

1. Database (authoritative):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_rzp_payment
  ON user_plans (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
```
2. Function: check first and return the existing plan idempotently rather than erroring —
```ts
const { data: existing } = await supabaseAdmin
  .from('user_plans').select('*').eq('razorpay_payment_id', razorpay_payment_id).maybeSingle();
if (existing) {
  if (existing.user_id !== user.id) return jsonResponse({ error: 'Payment already redeemed' }, 409);
  return jsonResponse({ success: true, plan: existing, message: 'Plan already active' });
}
```
Also verify the order belongs to this user by fetching the Razorpay order and comparing
`notes.user_id` to `user.id` — `create-razorpay-order:92-96` already writes it and nothing
ever reads it back.

**Tests required:** same payload twice → one row, second returns the first; another user's
payment_id → 409.
**Regression risk:** low. Deploy the unique index first — it is safe on an empty/small table
and makes the bug unexploitable immediately even before the function ships.

---

## [FIN-S03] The amount and payment-status checks fail open

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Security / Payments

**Location:** `supabase/functions/verify-razorpay-payment/index.ts:118-144`

**What is happening.**
```ts
const paymentCheckResponse = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {...});
if (paymentCheckResponse.ok) {          // ← everything below is conditional
  // amount === plan.pricePaise ?
  // status === captured | authorized ?
}
// ...falls through and activates the plan regardless
```
If Razorpay returns 429, 5xx, times out, or the credentials are wrong, `.ok` is false, the
whole verification block is skipped, and the plan is activated with **no amount check and no
status check**.

**Why it matters, concretely.** The HMAC signature is computed over `order_id|payment_id`
only — it does **not** bind `plan_name`. So the amount check at line 132 is the *only* thing
stopping a customer who paid ₹4,999 for Silver from re-posting the same valid signature with
`plan_name: "diamond"` and receiving a ₹6,999 plan with 10 replacements over 18 months. Under
a Razorpay outage — or a deliberately induced one via rate-limiting — that single guard
disappears.

**Root cause:** the failure branch of a security control was never written.

**Recommended solution.** Fail closed:
```ts
if (!paymentCheckResponse.ok) {
  console.error('[verify] Razorpay lookup failed', paymentCheckResponse.status);
  return jsonResponse({ error: 'Could not verify payment with the gateway. No amount has been lost — contact support.' }, 503);
}
const paymentData = await paymentCheckResponse.json();
if (paymentData.amount !== plan.pricePaise) return jsonResponse({ error: 'Payment amount mismatch' }, 403);
if (paymentData.order_id !== razorpay_order_id) return jsonResponse({ error: 'Order mismatch' }, 403);
if (paymentData.status !== 'captured' && paymentData.status !== 'authorized')
  return jsonResponse({ error: `Payment not completed: ${paymentData.status}` }, 402);
```
Add `order_id` comparison (currently never checked) and a short retry with backoff before
giving up, so a transient blip does not strand a paying customer.

**Tests required:** stub the Razorpay endpoint to 500 → expect 503 and **no** `user_plans`
row; stub an amount mismatch → 403.
**Regression risk:** medium — a Razorpay outage will now block activation instead of
silently granting it. That is the correct trade, but it makes FIN-P02 (no reconciliation
path) urgent: pair this with the webhook in `11-PAYMENTS.md`.

---

## [FIN-S04] The "restrict booking UPDATE to safe columns" migration does not restrict anything

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Security / Authorization

**Location:** `app/security-migration.sql:29-39`

**What is happening.** The migration is titled *"H2 FIX: Restrict booking UPDATE to safe
columns only — Users should only be able to update notes and city, NOT status/amount/payment_id"*
and then ships this policy:

```sql
CREATE POLICY "Users can update own bookings (restricted)"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Prevent status manipulation: status must remain unchanged
    -- This is enforced by only allowing updates from the app UI
    -- which only updates notes/city fields
  );
```

The restriction is a comment. The `WITH CHECK` is identical to the `USING` clause. The
stated control — "enforced by only allowing updates from the app UI" — is not a control at
all: the browser holds the anon key and can `PATCH /rest/v1/bookings?id=eq.<own id>` directly.

**Why it is a problem.** Any authenticated user can set their own booking's `status` to
`active` or `completed`, write an arbitrary `amount`, `payment_id` and `assigned_helper`.
Blast radius is limited to their own rows (the `USING` clause does hold), so this is not a
cross-tenant breach — but it corrupts every operational and revenue report built on
`bookings`, and it is precisely the control the migration claims to have added. A security
control that is documented as fixed but is not implemented is worse than a known gap.

**Recommended solution.** Postgres RLS cannot express per-column restrictions in a policy,
so use column privileges, which it can:

```sql
DROP POLICY IF EXISTS "Users can update own bookings (restricted)" ON bookings;
CREATE POLICY "Users can update own bookings" ON bookings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON bookings FROM authenticated;
GRANT  UPDATE (notes, city, society, locality_slug, city_slug, pincode, updated_at)
  ON bookings TO authenticated;
```
Optionally belt-and-braces with a `BEFORE UPDATE` trigger that raises if
`NEW.status IS DISTINCT FROM OLD.status` and `current_setting('role') <> 'service_role'`.

**Tests required:** as an authenticated user, `PATCH` `notes` → 200; `PATCH` `status` → 403.
**Regression risk:** low — confirm the app only ever writes `notes`/`city` (it does today;
`AuthContext` has no booking-update path at all).

---

## [FIN-S05] `/og` is an unauthenticated, unbounded branded-image generator

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Security / Brand abuse / Cost

**Location:** `next-app/app/og/route.tsx:7-44`

**What is happening.** `GET /og?t=<anything>&s=<anything>` renders the caller's text, up to
80 + 100 characters, onto a MyBuddyMaid-branded 1200×630 card and serves it from the apex
domain with `Cache-Control: public, max-age=31536000, immutable`. There is no signature, no
allowlist, no referrer check and no rate limit.

**Verified live:** `GET https://mybuddymaid.in/og?t=TEST&s=SUB` → `200 image/png`.

**Why it is a problem.** Two distinct issues.
1. **Brand abuse.** An attacker can craft `https://mybuddymaid.in/og?t=...` saying anything
   and post the link anywhere. WhatsApp, X and Facebook will render it as an image *hosted on
   mybuddymaid.in*. The domain lends the content credibility it has not consented to.
2. **Cost / availability.** Each distinct query string is an uncached edge render with a
   satori layout pass. An attacker iterating query strings drives unbounded Vercel edge
   function invocations with a single-line loop.

**Recommended solution.** Sign the parameters. The site already generates every legitimate
`/og` URL server-side in `lib/seo-engine/page-metadata.ts:9-12`, so adding a signature costs
nothing at the call sites:

```ts
// page-metadata.ts
const sig = createHmac('sha256', process.env.OG_SIGNING_SECRET!).update(`${t}|${s}`).digest('base64url').slice(0, 16);
return `/og?t=${...}&s=${...}&k=${sig}`;

// og/route.tsx
if (k !== expected(title, subtitle)) return new Response('Not found', { status: 404 });
```
Cheaper interim mitigation if you would rather not add a secret: hash-allowlist. At build
time emit the set of legitimate `t|s` pairs to a JSON file and 404 anything not in it.

**Tests required:** legitimate page's OG URL → 200; tampered `t` → 404.
**Regression risk:** low, but the change invalidates previously-shared OG URLs, so ship it
with a redeploy rather than mid-campaign.

---

## [FIN-S06] `/api/lead` has no rate limiting, bot protection or deduplication

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Security / Abuse

**Location:** `next-app/app/api/lead/route.ts:22-79`

**What is happening.** The route is a public, unauthenticated `POST` that writes to the
database with the **service-role key**. Validation of the *values* is good — city, locality,
service and pincode are all checked against the data layer, so nothing outside the footprint
can be written, and the phone is normalised to 10 digits. But there is no rate limit, no
CAPTCHA/Turnstile, no honeypot, no origin check and no duplicate suppression.

It is disabled today (`LEADS_ENABLED !== 'true'` → 503, verified live), so this is a
pre-launch finding, not a live exposure.

**Why it is a problem.** The moment it is switched on, a trivial loop fills the `leads` table
with valid-looking rows and poisons the only demand signal the business plans to build on
(`docs/seo/leads-schema-proposal.md`). Every row also costs sales-team time to call.

**Recommended solution (in order of value per effort):**
1. Rate limit by IP: 5/minute, 20/hour. On Vercel, `@vercel/kv` or Upstash; ~15 lines.
2. Duplicate suppression: `UNIQUE (phone, city_slug, locality_slug)` over a rolling window,
   or `ON CONFLICT DO NOTHING` against a partial index on `(phone, created_at::date)`.
3. Cloudflare Turnstile on the form — invisible, free, and materially better than a honeypot.
4. Reject requests whose `Origin` is not the site's own.

**Tests required:** 6 rapid posts → 6th returns 429; same phone twice in a minute → one row.
**Regression risk:** none while the route is disabled. Ship it *before* `LEADS_ENABLED=true`.

---

## [FIN-S07] No consent mechanism for analytics and advertising; privacy policy is not DPDP-adequate

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Security / Privacy / Compliance

**Location:** `components/shared/Analytics.tsx:37-54`, `app/blog/[slug]/page.tsx:79`,
`app/privacy-policy/page.tsx:26-39`, `app/index.html:7-9`

**What is happening.** GA4, Umami, Vercel Analytics, Vercel Speed Insights and (on blog
posts and inside the SPA shell) Google AdSense all load unconditionally. There is no consent
banner, no consent-mode signal to gtag, and no way to decline. The privacy policy's only
statement on the subject is *"You can disable analytics cookies in your browser settings"*.

The policy is also missing items that India's DPDP Act 2023 and the SPDI Rules require of a
data fiduciary handling names, phone numbers, addresses and payment references:
- no named **Grievance Officer** with contact details (mandatory);
- no **retention periods** for any category;
- no complete list of processors — Razorpay, GA and Umami are named; **Supabase, Resend,
  Vercel, Google AdSense are not**, though all four process personal data;
- no cross-border transfer disclosure (Supabase/Resend/Vercel are outside India);
- no breach-notification commitment; no children's-data position;
- no mention of the in-app self-serve account deletion that `ProfilePage.tsx:50-69`
  actually implements — the policy says to email instead;
- dated "Last updated: August 2026" while the site shipped material changes in September.

**Why it is a problem.** Regulatory exposure under DPDP (penalties are per-breach and
substantial), and a straightforwardly weaker trust page than the rest of the site deserves —
this company's differentiator is *"verification you can see"*, and its privacy page is four
sentences long and renders unstyled (FIN-B01).

**Recommended solution.**
1. Add a consent gate before `load()` in `Analytics.tsx`. The script already defers loading
   until first interaction or 4s, so the hook is a one-line condition, plus
   `gtag('consent','default',{ analytics_storage:'denied', ad_storage:'denied' })` and an
   `update` on accept.
2. Do not load AdSense at all until consent (it is currently loaded for zero benefit —
   FIN-PF01 — so the simplest fix is to remove it).
3. Rewrite the privacy policy to cover the seven gaps above. This is a lawyer-reviewable
   content task, not an engineering one, but the page must also be fixed (FIN-B01).

**Regression risk:** analytics volume will drop by the decline rate. That is the correct
outcome, and Vercel Analytics (cookieless) keeps baseline traffic visible either way.

---

## [FIN-S08] `email_logs` rows are written with a caller-supplied `user_id`

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Security / Data integrity

**Location:** `send-package-email/index.ts:483,499,516`, `send-booking-email/index.ts:611-616`

Consequence of FIN-S01: because neither function authenticates the caller, the `user_id`
written to `email_logs` is whatever the body said. An attacker can attribute forged sends to
any user id, or to a fabricated one. The table has RLS enabled with no policies, so only the
service role can read it — the data is not *exposed*, it is *corruptible*.

**Fix:** falls out of FIN-S01 — write `user.id`, never `body.user_id`.

---

## [FIN-S09] Account deletion is non-transactional and can leave partial data

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Security / Privacy / Data integrity

**Location:** `supabase/functions/delete-account/index.ts:69-118`

Five sequential deletes (`email_logs`, `user_plans`, `bookings`, `profiles`, then
`auth.admin.deleteUser`) with no transaction. Each failure is collected into
`deletionResults` and the function reports `PARTIAL`. If step 5 succeeds but an earlier step
failed, orphaned personal data survives with no auth user to link it to — and no retry, no
alert, and no dead-letter record. Conversely if step 5 fails after steps 1-4 succeed, the
user still has a login but no data.

The authorisation itself is correct: `auth.getUser(token)` then delete only `user.id`, with
an explicit `confirm: 'DELETE_MY_ACCOUNT'` body requirement. No IDOR here.

**Fix:** move the four table deletes into one `SECURITY DEFINER` Postgres function called
via `rpc()` so they commit atomically, then call `auth.admin.deleteUser` last; on any
failure, return 500 and write a row to a `deletion_failures` table for manual follow-up.
`ON DELETE CASCADE` already exists on `profiles.id` and `bookings.user_id`, so deleting the
auth user would cascade those two automatically — `user_plans.user_id` and `email_logs`
have no cascade and are the ones that actually need the explicit deletes.

---

## [FIN-S10] No Content-Security-Policy

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Security / Defence in depth

**Location:** `next-app/next.config.ts:5-12`

The header set is good — `nosniff`, `X-Frame-Options: DENY`, HSTS with preload,
`Referrer-Policy`, `Permissions-Policy` — and all were **verified live**. There is no CSP.

The site's exposure is genuinely low (server-rendered, one `dangerouslySetInnerHTML` over
first-party static HTML that was verified to contain zero `<script>` tags and zero inline
event handlers, and `serializeLd()` correctly escapes `<` in JSON-LD). CSP is defence in
depth, not a fix for a known hole.

**Fix:** start in report-only, because the inline analytics bootstrap needs a nonce or hash:
```
Content-Security-Policy-Report-Only:
  default-src 'self'; script-src 'self' 'nonce-<per-request>' https://www.googletagmanager.com
  https://cloud.umami.is https://pagead2.googlesyndication.com https://checkout.razorpay.com;
  connect-src 'self' https://*.supabase.co https://*.google-analytics.com https://cloud.umami.is;
  img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none';
```
Note the site is statically generated, so a per-request nonce needs the header set from
`proxy.ts`; hashing the (constant) bootstrap script is simpler.

---

## Controls that are correct — checked, no finding raised

These were examined and found adequate. Listing them so a future reviewer does not re-litigate.

| Area | Verdict |
|---|---|
| Client-side price manipulation | **Prevented.** `create-razorpay-order:23-27,59,89` resolves the amount from a server-side table; the client sends only `plan_name`. Reference implementation quality. |
| Razorpay signature verification | **Correct.** HMAC-SHA256 over `order_id\|payment_id` with the server secret, `verify-razorpay-payment:30-53`. |
| Direct client INSERT into `user_plans` | **Blocked.** `security-migration.sql:11-12` drops the INSERT and UPDATE policies. `AuthContext.purchasePlan` would now fail — it is dead code (FIN-D02). |
| IDOR on `bookings` / `user_plans` / `profiles` SELECT | **Prevented by RLS** — `USING (auth.uid() = ...)` on all three. There is no `/api/bookings/[id]`-style route to bypass it. |
| `email_logs` exposure | **Fixed** by `security-migration.sql:21` (RLS on, no policies → service role only). |
| SQL injection | **Not applicable.** No string-concatenated SQL anywhere; PostgREST parameterises; `/api/lead` sends a JSON body, not SQL. |
| Path traversal / SSRF | **Not applicable.** No user-controlled file paths; the only outbound fetches are to fixed Razorpay/Resend/Supabase hosts. |
| Open redirect | **None found.** `proxy.ts` redirect targets come from a prebuilt map, never from the request. |
| XSS via JSON-LD | **Handled.** `serializeLd()` escapes `<` as `<` (`jsonld.ts:114`). |
| Hardcoded secrets | **None.** A scan of all tracked files for private-key, service-role, Resend, Razorpay-live and AWS/Google key patterns returned only variable *names*, never values. `app/.env` exists on disk and is correctly gitignored and untracked. |
| Secrets reaching the client | **Correct split.** `SUPABASE_SERVICE_ROLE_KEY` is read only in `/api/lead` (Node runtime) and in Deno functions. The SPA bundle contains only the anon key and no Razorpay key (verified by grep of the shipped bundle). |
| `delete-account` authorization | **Correct.** Token-derived `user.id` only; explicit confirmation string required. |
| Auth rate limiting | Client-side cooldown in `AuthPage.jsx:87-91` is cosmetic (resets on reload), but **Supabase Auth applies its own server-side rate limits**, so this is not a finding. |
| Webhooks | **None exist.** Nothing to verify signatures on — which is itself the problem, covered as FIN-P02 in `11-PAYMENTS.md`. |
| CORS on edge functions | **Correctly pinned** to `https://mybuddymaid.in` in all six functions. Note this restricts *browsers*, not `curl`. |

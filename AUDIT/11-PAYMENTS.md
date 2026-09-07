# 11 — Payments

## Current status

**Online checkout is switched off.** `app/src/pages/PricingPage.jsx:12` sets
`PURCHASES_PAUSED = true`, and `handleBuyPlan` returns a "contact us" modal before touching
Razorpay. `ASSUMPTIONS.md` #50 records why: the Razorpay account is on hold, and the SPA is
built without `VITE_RZP_KEY` (**confirmed** — no `rzp_live_`/`rzp_test_` key appears in the
shipped bundle).

**But both payment edge functions are deployed and live.** Verified 2026-09-08:
`create-razorpay-order` and `verify-razorpay-payment` both answer CORS preflight with 200 and
reject unauthenticated calls with the function's own 401. So every finding below is
**exploitable today by any authenticated user**, independently of the client-side pause. The
pause is a UI flag, not a control.

## The flow, traced end to end

```
PricingPage.handleBuyPlan(planKey)
  └─ supabase.functions.invoke('create-razorpay-order', { plan_name, email, phone })
       ├─ verify session JWT → auth.getUser(token)                     ✅
       ├─ PLAN_DETAILS[plan_name] → pricePaise                          ✅ server-side price
       ├─ reject if user already has an active plan                     ⚠️ racy, see FIN-DB02
       └─ POST api.razorpay.com/v1/orders { amount, currency, receipt, notes:{user_id, plan_name} }
  └─ new window.Razorpay({ key: orderData.key_id, amount, order_id, ... }).open()
       └─ handler(response)
            └─ supabase.functions.invoke('verify-razorpay-payment', { order_id, payment_id, signature, plan_name, ... })
                 ├─ verify session JWT                                   ✅
                 ├─ HMAC-SHA256(order_id|payment_id, secret) === signature ✅
                 ├─ GET api.razorpay.com/v1/payments/{id}
                 │    └─ amount === plan.pricePaise ?                    ❌ skipped if the fetch fails (FIN-S03)
                 │    └─ status captured|authorized ?                    ❌ same
                 │    └─ order_id matches ?                              ❌ NEVER CHECKED
                 │    └─ notes.user_id === user.id ?                     ❌ NEVER CHECKED
                 ├─ UPDATE user_plans SET is_active=false WHERE user_id=… ⚠️ unconditional
                 ├─ INSERT user_plans (…, expires_at = now + months)     ❌ no idempotency (FIN-S02)
                 └─ return plan
  └─ refreshUserPlan()
  └─ supabase.functions.invoke('send-package-email', {...})   fire-and-forget, .catch(() => {})
```

## What is done correctly

Stated first, because the foundation is sound and should not be rewritten.

| Control | Status | Evidence |
|---|---|---|
| Price never comes from the client | **Correct** | The client sends only `plan_name`; the amount is resolved from `PLAN_DETAILS` inside the function (`create-razorpay-order:23-27,59,89`). This is the single most important payment control and it is right. |
| Order created server-side | **Correct** | Razorpay's Orders API is called from the function with Basic auth over the secret. |
| Caller authenticated | **Correct** | `auth.getUser(token)` in both functions; the public anon key is rejected (verified live). |
| Signature verified server-side | **Correct** | Web Crypto HMAC-SHA256 over `order_id\|payment_id`, `verify-razorpay-payment:30-53`. |
| Amount cross-checked against Razorpay | **Present** but fails open — FIN-S03 |
| Payment status checked | **Present** but fails open — FIN-S03 |
| Direct client INSERT to `user_plans` | **Blocked** by RLS (`security-migration.sql:11-12`). The function is genuinely the only path. |
| Razorpay secret exposure | **None.** `RAZORPAY_KEY_SECRET` is read only via `Deno.env.get` inside functions; only `key_id` is returned to the client, which is correct. |
| Currency | Hard-coded `INR` server-side; never taken from the client. Correct. |

## Findings

The three critical payment findings are documented in full in `04-SECURITY.md` and summarised
here with their payment-specific consequences.

### [FIN-S02] No idempotency — one payment, unlimited plan renewals
`verify-razorpay-payment:146-173` deactivates and re-inserts unconditionally; there is no
`UNIQUE` on `razorpay_payment_id` (`supabase-schema.sql:103`). A customer who paid once in
January can replay the same handler payload every 11 months forever. **HIGH.**

### [FIN-S03] Amount and status verification fail open
`verify-razorpay-payment:127` wraps the entire verification in `if (paymentCheckResponse.ok)`.
A Razorpay API error, timeout or rate-limit skips the amount check, the status check and the
`captured|authorized` gate, and the plan activates anyway. **HIGH.**

### [FIN-P01] The signature does not bind the plan, the order or the user

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Payments / Authorization

**Location:** `supabase/functions/verify-razorpay-payment/index.ts:36,79-95,118-144`

Razorpay's signature covers `order_id|payment_id` only. It proves *this payment belongs to
this order*; it proves nothing about which plan, which user, or which price. The function then
takes `plan_name` **from the request body** and uses it to set `amount_paid`,
`replacements_total` and `expires_at`.

Three checks are available and none is performed:
1. `paymentData.order_id === razorpay_order_id` — never compared, though `paymentData` is
   already in hand at line 128.
2. `notes.user_id === user.id` — `create-razorpay-order:92-96` writes `notes: { user_id,
   plan_name, user_email }` into the order, and **nothing ever reads it back**. The binding
   data was created and then ignored.
3. `notes.plan_name === plan_name` — same.

The only thing standing between "paid for Silver" and "granted Diamond" is the amount
comparison at line 132 — which is the one that fails open (FIN-S03).

**Fix:** fetch the order (not just the payment) and assert all three:
```ts
const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, { headers: { Authorization: basic } });
if (!orderRes.ok) return jsonResponse({ error: 'Could not verify order' }, 503);
const order = await orderRes.json();
if (order.notes?.user_id !== user.id)        return jsonResponse({ error: 'Order does not belong to this account' }, 403);
if (order.notes?.plan_name !== plan_name)    return jsonResponse({ error: 'Plan mismatch' }, 403);
if (order.amount !== plan.pricePaise)        return jsonResponse({ error: 'Amount mismatch' }, 403);
```
Better still: stop taking `plan_name` from the body entirely and read it from
`order.notes.plan_name`. Then the client cannot influence the plan at all, which matches how
the amount is already handled.

**Tests required:** submit a valid Silver signature with `plan_name: 'diamond'` → 403; submit
another user's order id → 403.

### [FIN-P02] No webhook — a payment that succeeds while the browser closes is lost

**Severity:** HIGH · **Confidence:** CONFIRMED · **Category:** Payments / Reliability

**Location:** the whole `supabase/functions/` directory — there is no webhook handler at all

Plan activation depends entirely on the browser calling `verify-razorpay-payment` from
Razorpay's client-side `handler` callback (`PricingPage.jsx:100-142`). If between "payment
captured" and that call the user closes the tab, loses signal on a train, the phone rings, or
the browser is backgrounded and killed — **the money is taken and no plan is ever created.**
There is no reconciliation job, no retry, no webhook, and nothing that scans Razorpay for
captured payments with no matching `user_plans` row.

The only recovery is the customer noticing and emailing support, prompted by
`PricingPage.jsx:117`: *"Payment verification failed. Contact support if amount was deducted."*
That message is honest, and it is also an admission that the system has no other answer.

This gets **worse** once FIN-S03 is fixed: failing closed on a Razorpay API error means
transient outages will strand paying customers rather than silently over-granting. The webhook
is the thing that makes failing closed safe, so ship them together.

**Fix — add `supabase/functions/razorpay-webhook/index.ts`:**
```ts
// Deploy with --no-verify-jwt (Razorpay cannot send a Supabase JWT),
// then authenticate with Razorpay's own signature instead.
const raw = await req.text();                                   // raw body, before JSON.parse
const expected = hmacSha256Hex(raw, Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!);
if (!timingSafeEqual(expected, req.headers.get('x-razorpay-signature') ?? '')) return new Response('bad signature', { status: 401 });

const event = JSON.parse(raw);
if (event.event !== 'payment.captured') return new Response('ignored', { status: 200 });

const p = event.payload.payment.entity;
// idempotent: the UNIQUE index from FIN-DB01 makes a duplicate insert a no-op
await activatePlan({ userId: p.notes.user_id, planName: p.notes.plan_name, paymentId: p.id, amountPaise: p.amount });
return new Response('ok', { status: 200 });
```
Requirements this must satisfy, all of which the current design lacks:
- **Signature over the raw body** — parse *after* verifying, never before.
- **Replay protection** — the `UNIQUE (razorpay_payment_id)` index from FIN-DB01 provides it;
  treat a unique-violation as success, not error.
- **Idempotent handler** — Razorpay retries; the same event must be safe to process N times.
- **Return 2xx quickly**, do slow work after, or Razorpay will retry unnecessarily.
- Handle `payment.failed` and `refund.processed` too — see FIN-P03.

Note the deployment nuance: this is the one function that must be deployed with
`--no-verify-jwt`, because Razorpay's servers cannot present a Supabase token. Its
authentication is the Razorpay signature. Getting that backwards (leaving the gateway check
on) means the webhook silently 401s every event.

### [FIN-P03] Refunds, failures and cancellations have no handling at all

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Payments / Business logic

There is no code path anywhere that:
- deactivates a plan when a payment is **refunded** — and `/replacement-policy` publishes a
  60-day refund commitment, so refunds are an expected part of the business;
- records a **failed** payment. `rzp.on('payment.failed')` sets a UI string and nothing else
  (`PricingPage.jsx:147`); nothing is persisted, so failed-payment rate is invisible;
- handles a **partially captured** or **authorised-but-not-captured** payment beyond letting
  it through (`verify-razorpay-payment:140` accepts `authorized`, which is money not yet
  captured);
- records an **abandoned** checkout. `modal.ondismiss` only clears a spinner
  (`PricingPage.jsx:143`), so the created Razorpay order is orphaned with no record.

**Consequence:** a refunded customer keeps an active plan with full replacement cover
indefinitely. There is no mechanism to take it back.

**Fix:** the webhook from FIN-P02 is the natural home for all of this —
`refund.processed` → `is_active = false`; `payment.failed` → write a `payment_attempts` row;
`order.paid` → confirm. Add a lightweight `payment_events` table so the funnel
(order created → attempted → captured → activated) becomes measurable at all. Today none of
those four numbers exists.

### [FIN-P04] Non-constant-time signature comparison

**Severity:** LOW · **Confidence:** CONFIRMED · **Category:** Payments / Cryptography

**Location:** `supabase/functions/verify-razorpay-payment/index.ts:52`

```ts
return expectedSignature === signature;
```
String `===` short-circuits on the first differing character. Practical exploitability over a
network against an edge function with variable latency is very low, and forging the HMAC is
the real barrier — but constant-time comparison is one line and is what every payment SDK
does.

**Fix:**
```ts
const a = new TextEncoder().encode(expectedSignature);
const b = new TextEncoder().encode(signature);
if (a.length !== b.length) return false;
let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
return diff === 0;
```

### [FIN-P05] Plan prices are hand-mirrored into two Deno files

**Severity:** MEDIUM · **Confidence:** CONFIRMED · **Category:** Payments / Architecture

**Location:** `create-razorpay-order/index.ts:23-27` and `verify-razorpay-payment/index.ts:23-27`,
duplicating `next-app/data/seo/plans.ts:21-53`

The repository's stated principle is one source of truth for money, and it holds everywhere
except here: the edge functions cannot import from `next-app/`, so `PLAN_DETAILS` is copied
into both Deno files by hand. `ASSUMPTIONS.md` #50 documents the copy being made during the
last price change.

Today all four copies agree (verified: 499900 / 599900 / 699900 in both functions,
`plans.ts`, and `serviceability.json`). The risk is entirely about the next change:

- If `create-razorpay-order` is updated and `verify-razorpay-payment` is not, every payment
  fails the amount check and no customer can buy — a total outage that only appears in
  production.
- If the reverse, customers are charged the old price and granted the new plan.
- If the site is updated and neither function is, customers see one price and are charged
  another.

**Fix — pick one:**
1. **Generate** both function files' `PLAN_DETAILS` from `plans.ts` in the same script that
   already writes `serviceability.json` (`scripts/seo/export-serviceability.ts`). Cheapest,
   and it reuses machinery that exists.
2. **Store plans in Postgres** and have both functions read them. Most correct, since prices
   then have history and can change without a deploy.
3. **At minimum, add a startup assertion** so a mismatch fails loudly instead of quietly:
   both functions already have identical literals, so a shared `_shared/plans.ts` imported by
   both removes half the risk today for ten minutes of work.

## Verification checklist before re-enabling checkout

Do not flip `PURCHASES_PAUSED` to `false` until all of these are true:

- [ ] `UNIQUE` index on `user_plans.razorpay_payment_id` deployed (FIN-DB01)
- [ ] Partial unique index on one active plan per user (FIN-DB02)
- [ ] `verify-razorpay-payment` fails closed on a Razorpay lookup error (FIN-S03)
- [ ] `order_id`, `notes.user_id` and `notes.plan_name` asserted (FIN-P01)
- [ ] Idempotency check returns the existing plan on replay (FIN-S02)
- [ ] `razorpay-webhook` deployed with signature verification (FIN-P02)
- [ ] Refund handling deactivates the plan (FIN-P03)
- [ ] `send-package-email` authenticates its caller (FIN-S01)
- [ ] `plan_duration` label says "months" (FIN-B04)
- [ ] `PLAN_DETAILS` generated rather than copied, or at least shared (FIN-P05)
- [ ] One end-to-end test in Razorpay **test mode**, including: successful purchase, replayed
      verification, tampered `plan_name`, closed browser before verification, and refund.

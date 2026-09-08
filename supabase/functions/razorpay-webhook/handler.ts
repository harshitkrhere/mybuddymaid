// supabase/functions/razorpay-webhook/handler.ts
// Razorpay's server-to-server event receiver — the activation path that does not depend on the
// customer's browser staying open.
//   FIN-P02 — a payment captured after the tab closes still activates the plan, here. Before
//     this function existed, activation happened only in Razorpay's client-side handler
//     callback: close the tab, lose signal on a train, take a phone call, and the money was
//     taken with no plan, no record and no way back except the customer emailing support.
//   FIN-P03 — refund.processed revokes the plan; payment.failed leaves a record.
//
// This is also what makes verify-razorpay-payment's new fail-closed behaviour safe. Refusing to
// activate on an unverifiable payment would otherwise strand whoever was paying during a
// Razorpay blip; now Razorpay retries the event to this endpoint for 24 hours instead.
//
// The request handler lives here rather than in index.ts so the test suite can drive it without
// Deno.serve binding a port on import. index.ts is the deployed entry point.
//
// ── DEPLOYMENT: THIS FUNCTION IS THE ONE EXCEPTION ───────────────────────────────────────────
// Its only authentication is the Razorpay signature. Razorpay's servers cannot present a
// Supabase JWT, so the gateway's JWT check must be off for this function and no other:
//
//   supabase functions deploy razorpay-webhook --no-verify-jwt
//
// Deploy it without that flag and every event is rejected by the gateway with a 401 before a
// line below ever runs — no log, no error, no symptom except plans quietly not activating.
//
// ── THE SECRET IS NOT THE KEY SECRET ─────────────────────────────────────────────────────────
// RAZORPAY_WEBHOOK_SECRET is the string typed into the Razorpay dashboard when the webhook
// endpoint was registered. It is a different value from RAZORPAY_KEY_SECRET, which signs the
// checkout callback that verify-razorpay-payment checks. Using the wrong one fails every
// signature with no other symptom.
//
// ── WHY THE WRITE HAPPENS BEFORE THE 2xx ─────────────────────────────────────────────────────
// "Return 2xx fast" here means: bail out immediately on events we do not handle, make at most
// one outbound call, and give it a hard timeout. It does not mean acknowledging first and
// writing afterwards. Razorpay's retry is the entire safety net this function exists to
// provide; a 200 sent before the row is written throws that net away. So the write is inline,
// and a transient failure deliberately returns 5xx so the event comes back.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = 'https://mybuddymaid.in';

// Kept in the same shape as the other functions. Razorpay is a server: it sends no Origin and
// never preflights, so these are inert here. x-razorpay-signature is listed so the set stays
// honest about what this endpoint reads.
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Server-side plan definitions (same as create-razorpay-order and verify-razorpay-payment).
// FIN-P05: this is now the third hand-maintained copy. A webhook running a stale price grants
// the wrong duration silently, so this file must be one of the importers when FIN-P05 replaces
// the copies with a generated definition.
const PLAN_DETAILS: Record<string, { name: string; pricePaise: number; durationMonths: number; replacementsTotal: number }> = {
  silver:   { name: 'Silver',   pricePaise: 499900,  durationMonths: 10,  replacementsTotal: 3 },
  gold:     { name: 'Gold',     pricePaise: 599900,  durationMonths: 12,  replacementsTotal: 5 },
  diamond:  { name: 'Diamond',  pricePaise: 699900,  durationMonths: 18,  replacementsTotal: 10 },
};

// Razorpay expects an answer within seconds. One outbound call, capped well inside that.
const ORDER_FETCH_TIMEOUT_MS = 3000;

// Shape of a Razorpay identifier (`pay_…`, `order_…`).
const RAZORPAY_ID = /^[A-Za-z0-9_]{1,64}$/;

// ─── Signature verification ──────────────────────────────────────────────────────────────────

// HMAC-SHA256 over the RAW request bytes. Razorpay signs exactly the bytes it sent, so this
// must never be handed a re-serialised object: JSON.parse followed by JSON.stringify changes
// whitespace and unicode escaping, and the signature would never match again.
async function hmacSha256Hex(rawBody: ArrayBuffer, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, rawBody);
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ─── Plan activation ─────────────────────────────────────────────────────────────────────────

type ActivationResult =
  | { status: 'activated'; planId: string }
  | { status: 'already'; planId: string }
  | { status: 'conflict'; reason: string }   // a human must fix it; retrying cannot
  | { status: 'retry'; reason: string };     // transient; Razorpay should send it again

interface ActivationArgs {
  userId: string;
  planName: string;
  paymentId: string;
  amountPaise: number;
  capturedAtSec: number | null;
  email: string;
  phone: string;
}

/**
 * Idempotent activation. Safe to run N times for the same payment id, which is the point:
 * Razorpay retries a non-2xx for up to 24 hours, and verify-razorpay-payment may be racing
 * this from the customer's browser for the same payment.
 *
 * The two unique indexes from migration 20260908051500 do the real enforcing:
 *   uq_user_plans_rzp_payment  UNIQUE (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL
 *   uq_user_plans_one_active   UNIQUE (user_id)             WHERE is_active
 */
async function activatePlan(
  supabaseAdmin: SupabaseClient,
  args: ActivationArgs,
): Promise<ActivationResult> {
  const plan = PLAN_DETAILS[args.planName];
  if (!plan) return { status: 'conflict', reason: `unknown plan "${args.planName}"` };

  // ── 1. Already redeemed? ──
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from('user_plans')
    .select('id, is_active')
    .eq('razorpay_payment_id', args.paymentId)
    .maybeSingle();

  if (lookupError) return { status: 'retry', reason: `lookup failed: ${lookupError.message}` };

  if (existing) {
    // If the row is inactive, LEAVE IT INACTIVE. A refund.processed can legitimately arrive
    // before a retried payment.captured, and reactivating here would hand a refunded customer
    // their plan back.
    return { status: 'already', planId: String(existing.id) };
  }

  // ── 2. Deactivate any OTHER active plan for this user ──
  // Same order verify-razorpay-payment uses, so whichever path wins the race behaves the same.
  // Required by uq_user_plans_one_active.
  //
  // The `.or()` is load-bearing, not tidiness. Without it, this update matches the row for THIS
  // payment if the other activation path inserted it between step 1 and here — we would switch
  // off the plan we are about to conclude already exists, and the caller would report success
  // over a deactivated plan. Excluding it also means we can never need to "repair" a row we
  // turned off, which is what makes the 23505 branch below safe: it has no reactivation logic,
  // so it cannot resurrect a plan that a refund legitimately deactivated.
  //
  // `neq` alone would not do: in SQL, NULL <> 'x' is NULL, so a legacy row with no payment id
  // would be excluded from the deactivate and left active.
  const { error: deactivateError } = await supabaseAdmin
    .from('user_plans')
    .update({ is_active: false })
    .eq('user_id', args.userId)
    .eq('is_active', true)
    .or(`razorpay_payment_id.is.null,razorpay_payment_id.neq.${args.paymentId}`);

  if (deactivateError) return { status: 'retry', reason: `deactivate failed: ${deactivateError.message}` };

  // ── 3. Insert ──
  // expires_at is anchored to the payment's own capture time, not to now(): a retry that lands
  // six hours later must produce the same expiry the first attempt would have.
  const expiresAt = new Date(args.capturedAtSec ? args.capturedAtSec * 1000 : Date.now());
  expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('user_plans')
    .insert({
      user_id: args.userId,
      plan_name: args.planName,
      amount_paid: args.amountPaise,
      razorpay_payment_id: args.paymentId,
      replacements_total: plan.replacementsTotal,
      replacements_used: 0,
      expires_at: expiresAt.toISOString(),
      is_active: true,
      email: args.email,
      phone: args.phone,
    })
    .select('id')
    .single();

  if (!insertError) return { status: 'activated', planId: String(inserted?.id) };

  // ── 4. A unique violation is SUCCESS, not an error ──
  // PostgREST returns the Postgres SQLSTATE as error.code; nothing is thrown.
  if (insertError.code === '23505') {
    // Two indexes can raise 23505 here and the code alone cannot say which, so re-read by
    // payment id and let the data answer.
    const { data: winner } = await supabaseAdmin
      .from('user_plans')
      .select('id, is_active')
      .eq('razorpay_payment_id', args.paymentId)
      .maybeSingle();

    if (winner) {
      // uq_user_plans_rzp_payment: verify-razorpay-payment, or a concurrent retry of this
      // webhook, wrote the row between step 1 and step 3. That is the desired outcome, and step
      // 2 excluded this payment id, so we did not touch it. Whatever is_active says now is
      // somebody else's correct decision — a refund, or a later purchase superseding it — and
      // this handler must not overrule it.
      return { status: 'already', planId: String(winner.id) };
    }

    // uq_user_plans_one_active: another active plan appeared for this user between step 2 and
    // step 3. That is a race, not a permanent state — the other writer's row may itself be
    // superseded — so ask Razorpay to redeliver rather than acknowledging and losing the event.
    return {
      status: 'retry',
      reason: `one-active-plan contention: ${insertError.details ?? insertError.message}`,
    };
  }

  // 23503 = foreign key violation: user_plans.user_id references auth.users and the account is
  // gone (delete-account ran). Permanent, so do not make Razorpay retry it for a day.
  if (insertError.code === '23503') {
    return { status: 'conflict', reason: `user no longer exists: ${insertError.message}` };
  }

  return { status: 'retry', reason: `insert failed [${insertError.code}]: ${insertError.message}` };
}

// ─── Order notes lookup ──────────────────────────────────────────────────────────────────────

interface PlanBinding {
  userId: string;
  planName: string;
  userEmail: string;
  source: string;
}

type BindingResult =
  | { ok: true; binding: PlanBinding }
  | { ok: false; retryable: boolean; reason: string };

/**
 * Find which user and plan a payment belongs to.
 *
 * ALWAYS from the ORDER's notes, which create-razorpay-order writes server-side. Never from
 * `payment.notes`.
 *
 * That distinction is the whole security of this function. Razorpay Checkout accepts a `notes`
 * option in its options object, and those notes are attached to the PAYMENT entity — and that
 * object is browser JavaScript. A buyer holding the key_id and order_id this system hands them
 * can pay a ₹4,999 Silver order while passing `notes: {user_id: <own>, plan_name: 'diamond'}`,
 * or somebody else's user_id. verify-razorpay-payment refuses that because it reads the order;
 * this function must too, or FIN-P01 is closed on one activation path and open on the other.
 *
 * The two failure modes are kept apart deliberately. A payment whose order genuinely has no
 * plan notes is not ours — a payment link, a manual charge — and must be acknowledged, or
 * Razorpay retries it for a day. A lookup that fails or times out is transient and must retry.
 */
async function resolvePlanBinding(payment: Record<string, unknown>): Promise<BindingResult> {
  const fromNotes = (notes: unknown, source: string): PlanBinding | null => {
    const n = (notes ?? {}) as Record<string, unknown>;
    if (typeof n.user_id === 'string' && n.user_id && typeof n.plan_name === 'string' && n.plan_name) {
      return {
        userId: n.user_id,
        planName: n.plan_name,
        userEmail: typeof n.user_email === 'string' ? n.user_email : '',
        source,
      };
    }
    return null;
  };

  const orderId = typeof payment.order_id === 'string' ? payment.order_id : '';
  if (!orderId) {
    // No order means nothing server-side ever recorded who this payment is for. There is no
    // safe fallback: payment.notes is caller-controlled.
    return { ok: false, retryable: false, reason: 'payment has no order_id' };
  }

  const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID');
  const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!rzpKeyId || !rzpKeySecret) {
    console.error('[razorpay-webhook] Missing Razorpay API credentials; cannot read order notes');
    return { ok: false, retryable: true, reason: 'Razorpay credentials not configured' };
  }

  let orderRes: Response;
  try {
    orderRes = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: 'Basic ' + btoa(`${rzpKeyId}:${rzpKeySecret}`) },
      signal: AbortSignal.timeout(ORDER_FETCH_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    return { ok: false, retryable: true, reason: `order fetch threw: ${String(err)}` };
  }

  if (!orderRes.ok) {
    // Only 400 and 404 mean "this order is not ours". Everything else is our problem, not a
    // verdict about the payment, and must be retried.
    //
    // 401/403 in particular are a configuration fault, not an answer: a webhook registered in
    // live mode while RAZORPAY_KEY_ID/_SECRET are test-mode credentials, or a rotated key.
    // Treating those as "not ours" would answer 200 and discard a real capture permanently —
    // and since the payment.notes shortcut is gone, this lookup is the only way to bind a
    // payment to a plan, so a misclassification here loses the payment outright.
    const notOurs = orderRes.status === 400 || orderRes.status === 404;
    if (!notOurs) {
      console.error(
        `[razorpay-webhook] Order lookup for ${orderId} returned ${orderRes.status} — treating as transient. If this is 401/403, the webhook and the API keys are in different Razorpay modes.`,
      );
    }
    return { ok: false, retryable: !notOurs, reason: `order lookup returned ${orderRes.status}` };
  }

  const order = await orderRes.json();
  const fromOrder = fromNotes(order?.notes, 'order.notes');
  if (fromOrder) return { ok: true, binding: fromOrder };

  return { ok: false, retryable: false, reason: `order ${orderId} carries no plan notes` };
}

// ─── Event handlers ──────────────────────────────────────────────────────────────────────────

async function handlePaymentCaptured(
  supabaseAdmin: SupabaseClient,
  event: Record<string, unknown>,
): Promise<Response> {
  const payment = (event?.payload as Record<string, Record<string, Record<string, unknown>>>)?.payment?.entity;
  if (!payment?.id) {
    console.error('[razorpay-webhook] payment.captured with no payload.payment.entity.id');
    return jsonResponse({ received: true, handled: false, reason: 'malformed payload' });
  }

  const paymentId = String(payment.id);

  // Razorpay ids are `pay_` plus alphanumerics. Asserting that keeps the id safe to interpolate
  // into the PostgREST `.or()` filter in activatePlan, where a comma or dot would otherwise be
  // read as filter syntax rather than as a value. The body is signature-verified by this point,
  // so this is belt-and-braces rather than a trust boundary.
  if (!RAZORPAY_ID.test(paymentId)) {
    console.error(`[razorpay-webhook] payment.captured with a malformed payment id: ${paymentId}`);
    return jsonResponse({ received: true, handled: false, reason: 'malformed payment id' });
  }

  const resolved = await resolvePlanBinding(payment);

  if (!resolved.ok) {
    if (resolved.retryable) {
      console.error(
        `[razorpay-webhook] Could not resolve plan binding for payment ${paymentId} — asking Razorpay to retry: ${resolved.reason}`,
      );
      return jsonResponse({ error: 'Could not resolve order binding' }, 503);
    }
    console.log(
      `[razorpay-webhook] payment.captured ${paymentId} is not one of our plan orders (${resolved.reason}) — ignoring`,
    );
    return jsonResponse({ received: true, handled: false, reason: 'not a plan order' });
  }

  const binding = resolved.binding;
  const plan = PLAN_DETAILS[binding.planName];

  if (!plan) {
    console.error(
      `[razorpay-webhook] Unknown plan "${binding.planName}" in ${binding.source} for payment ${paymentId} — ignoring`,
    );
    return jsonResponse({ received: true, handled: false, reason: 'unknown plan' });
  }

  // Refuse on an amount mismatch rather than warn and activate. The captured amount is the one
  // number that cannot be forged, so if it disagrees with PLAN_DETAILS either a price changed
  // between order creation and capture (FIN-P05 — the prices are hand-mirrored across three
  // files) or something is wrong. Granting a plan the customer did not pay for, or a smaller one
  // than they did, both need a human. 200 so Razorpay stops retrying; the log is the record.
  if (typeof payment.amount === 'number' && payment.amount !== plan.pricePaise) {
    console.error(
      `[razorpay-webhook] MANUAL RECONCILE REQUIRED — amount mismatch on payment ${paymentId}: captured ${payment.amount}, ${binding.planName} costs ${plan.pricePaise}. NOT activated. Check whether a price changed mid-flight (FIN-P05).`,
    );
    return jsonResponse({ received: true, handled: false, reason: 'amount mismatch' });
  }

  // A payment refunded before this event was delivered must not grant a plan. Razorpay still
  // reports status "captured" on a refunded payment; only amount_refunded moves. This is the
  // ordering handleRefundProcessed cannot cover: a refund that arrives before the plan row
  // exists finds nothing to revoke, and without this check a retried capture then grants it.
  const amountRefunded = typeof payment.amount_refunded === 'number' ? payment.amount_refunded : 0;
  if (amountRefunded > 0) {
    console.log(
      `[razorpay-webhook] payment ${paymentId} has been refunded (${amountRefunded} paise) — not activating`,
    );
    return jsonResponse({ received: true, handled: false, reason: 'already refunded' });
  }

  const result = await activatePlan(supabaseAdmin, {
    userId: binding.userId,
    planName: binding.planName,
    paymentId,
    amountPaise: typeof payment.amount === 'number' ? payment.amount : plan.pricePaise,
    capturedAtSec: typeof payment.created_at === 'number' ? payment.created_at : null,
    email: (typeof payment.email === 'string' && payment.email) || binding.userEmail || '',
    phone: (typeof payment.contact === 'string' && payment.contact) || '',
  });

  if (result.status === 'activated') {
    console.log(
      `[razorpay-webhook] Plan ${binding.planName} activated for user ${binding.userId} (payment: ${paymentId}, via ${binding.source})`,
    );
    return jsonResponse({ received: true, handled: true, plan_id: result.planId });
  }

  if (result.status === 'already') {
    console.log(`[razorpay-webhook] Payment ${paymentId} already redeemed as plan ${result.planId} — no-op`);
    return jsonResponse({ received: true, handled: true, plan_id: result.planId, idempotent: true });
  }

  if (result.status === 'conflict') {
    console.error(
      `[razorpay-webhook] MANUAL RECONCILE REQUIRED — payment ${paymentId} captured for user ${binding.userId} but not activated: ${result.reason}`,
    );
    // 200 on purpose: a retry cannot resolve a data conflict, and the log line is the record.
    return jsonResponse({ received: true, handled: false, reason: 'conflict' });
  }

  console.error(`[razorpay-webhook] Transient failure on payment ${paymentId}: ${result.reason}`);
  return jsonResponse({ error: 'Temporary failure, please retry' }, 503);
}

async function handleRefundProcessed(
  supabaseAdmin: SupabaseClient,
  event: Record<string, unknown>,
): Promise<Response> {
  const payload = event?.payload as Record<string, Record<string, Record<string, unknown>>> | undefined;
  const refund = payload?.refund?.entity;
  const payment = payload?.payment?.entity;

  // The original payment id is on the REFUND entity as `payment_id`. payload.payment is
  // normally present too — the event's `contains` array lists both — and its `id` is the same
  // value, used as a fallback so a payload shaped either way still works.
  const paymentId =
    (typeof refund?.payment_id === 'string' && refund.payment_id) ||
    (typeof payment?.id === 'string' && payment.id) ||
    '';

  if (!paymentId) {
    console.error('[razorpay-webhook] refund.processed with neither refund.payment_id nor payment.entity.id');
    return jsonResponse({ received: true, handled: false, reason: 'malformed payload' });
  }

  const { data: planRow, error: lookupError } = await supabaseAdmin
    .from('user_plans')
    .select('id, user_id, amount_paid, is_active')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (lookupError) {
    console.error(`[razorpay-webhook] Refund lookup failed for payment ${paymentId}: ${lookupError.message}`);
    return jsonResponse({ error: 'Temporary failure, please retry' }, 503);
  }

  if (!planRow) {
    // Refunding a payment that never produced a plan is exactly what happens when a stranded
    // FIN-P02 payment is refunded by hand. Nothing to revoke.
    console.log(`[razorpay-webhook] refund.processed for payment ${paymentId} with no user_plans row — nothing to revoke`);
    return jsonResponse({ received: true, handled: true, revoked: false });
  }

  // A partial refund must not revoke a whole plan. Prefer the payment's cumulative
  // amount_refunded, which stays correct across several partial refunds; fall back to this
  // refund's own amount when the payment entity is absent from the event.
  const refundedPaise =
    (typeof payment?.amount_refunded === 'number' ? payment.amount_refunded : undefined) ??
    (typeof refund?.amount === 'number' ? refund.amount : 0);
  const amountPaid = Number(planRow.amount_paid ?? 0);
  const isFullRefund = payment?.refund_status === 'full' || (amountPaid > 0 && refundedPaise >= amountPaid);

  if (!isFullRefund) {
    console.log(
      `[razorpay-webhook] PARTIAL refund on payment ${paymentId} (${refundedPaise} of ${amountPaid} paise) — plan ${planRow.id} left ACTIVE, review by hand`,
    );
    return jsonResponse({ received: true, handled: true, revoked: false, partial: true });
  }

  if (planRow.is_active === false) {
    console.log(`[razorpay-webhook] Plan ${planRow.id} already inactive for refunded payment ${paymentId} — no-op`);
    return jsonResponse({ received: true, handled: true, revoked: true, idempotent: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_plans')
    .update({ is_active: false })
    .eq('id', planRow.id);

  if (updateError) {
    console.error(`[razorpay-webhook] Failed to deactivate plan ${planRow.id}: ${updateError.message}`);
    return jsonResponse({ error: 'Temporary failure, please retry' }, 503);
  }

  console.log(
    `[razorpay-webhook] Plan ${planRow.id} DEACTIVATED for user ${planRow.user_id} after full refund of payment ${paymentId} (${refundedPaise} paise)`,
  );
  return jsonResponse({ received: true, handled: true, revoked: true });
}

function handlePaymentFailed(event: Record<string, unknown>): Response {
  const payment = (event?.payload as Record<string, Record<string, Record<string, unknown>>>)?.payment?.entity;

  // There is no payment_events table and Phase 0 does not add one: FIN-P03 proposes it as its
  // own piece of work, and a new table plus RLS plus a migration is product scope this task does
  // not carry. "Record" here is therefore one structured, greppable line in the function logs,
  // and it is honest about what that is — a breadcrumb for incident work, NOT a funnel metric.
  // When the failed-payment RATE becomes a number somebody needs, that is the table, not this.
  //
  // Deliberately not logged: payment.email and payment.contact. Customer PII does not belong in
  // a log stream that cannot be purged on an erasure request (see delete-account/index.ts).
  console.warn('[razorpay-webhook] payment.failed ' + JSON.stringify({
    payment_id: payment?.id ?? null,
    order_id: payment?.order_id ?? null,
    amount: payment?.amount ?? null,
    method: payment?.method ?? null,
    error_code: payment?.error_code ?? null,
    error_source: payment?.error_source ?? null,
    error_step: payment?.error_step ?? null,
    error_reason: payment?.error_reason ?? null,
    error_description: payment?.error_description ?? null,
    created_at: payment?.created_at ?? null,
  }));

  return jsonResponse({ received: true, handled: true });
}

// ─── Handler ─────────────────────────────────────────────────────────────────────────────────

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[razorpay-webhook] Missing RAZORPAY_WEBHOOK_SECRET');
      return jsonResponse({ error: 'Webhook not configured' }, 500);
    }

    // ── Verify the signature over the RAW body, BEFORE parsing ──
    // Read bytes, not text: the HMAC covers the exact bytes Razorpay sent, with no decode and
    // re-encode round trip in between. Nothing below may run on unverified input.
    const rawBody = await req.arrayBuffer();
    const receivedSignature = req.headers.get('x-razorpay-signature') ?? '';
    const expectedSignature = await hmacSha256Hex(rawBody, webhookSecret);

    if (!timingSafeEqual(expectedSignature, receivedSignature)) {
      // Log the event id — unauthenticated and therefore untrusted — but never the body and
      // never either signature.
      console.error(
        `[razorpay-webhook] INVALID signature, rejected (event-id header: ${req.headers.get('x-razorpay-event-id') ?? 'none'})`,
      );
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }

    // ── Signature is valid from here on. Now, and only now, parse. ──
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      console.error('[razorpay-webhook] Correctly signed body was not valid JSON');
      return jsonResponse({ error: 'Malformed payload' }, 400);
    }

    const eventName = typeof event?.event === 'string' ? event.event : '';
    const eventId = req.headers.get('x-razorpay-event-id') ?? 'unknown';
    console.log(`[razorpay-webhook] ${eventName || '(no event name)'} received (event-id: ${eventId})`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (eventName === 'payment.captured') return await handlePaymentCaptured(supabaseAdmin, event);
    if (eventName === 'refund.processed') return await handleRefundProcessed(supabaseAdmin, event);
    if (eventName === 'payment.failed') return handlePaymentFailed(event);

    // Subscribe to only those three in the Razorpay dashboard. Anything else is acknowledged so
    // Razorpay does not retry an event we will never act on.
    return jsonResponse({ received: true, handled: false, reason: 'unsubscribed event' });

  } catch (err: unknown) {
    // 503, not 500: an unexpected failure here is most likely transient, and Razorpay's retry
    // is the recovery mechanism.
    console.error('[razorpay-webhook] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 503);
  }
}

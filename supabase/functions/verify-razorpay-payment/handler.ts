// supabase/functions/verify-razorpay-payment/handler.ts
// Verifies Razorpay payment signature server-side and activates the plan.
// This is the ONLY way to create a user_plan from the browser — client INSERT is blocked by
// RLS. razorpay-webhook is the other, browser-independent way in.
//
// The request handler lives here rather than in index.ts so the test suite can drive it
// without Deno.serve binding a port on import. index.ts is the deployed entry point.
//
// What this function used to do, and why each step below exists:
//   FIN-S02 — it deactivated the caller's plans and inserted a new row unconditionally, with
//     no record of a payment being consumed. One genuine receipt could be replayed every
//     eleven months, forever. The redemption check is now the FIRST thing that happens, before
//     anything is deactivated: with uq_user_plans_rzp_payment in place, doing it any later
//     turns a replay into a 23505 that has already switched off the customer's real plan.
//   FIN-S03 — the amount and status checks lived inside `if (paymentCheckResponse.ok)`, so a
//     Razorpay 429, 5xx or timeout skipped every check and activated the plan anyway. It now
//     fails closed with 503, which is only safe because razorpay-webhook exists to activate
//     the payment that this call refused.
//   FIN-P01 — the HMAC covers order_id|payment_id and binds neither the plan, the user nor the
//     price. create-razorpay-order writes notes.user_id and notes.plan_name into the order and
//     nothing ever read them back, so `plan_name` came from the request body: a Silver payment
//     with plan_name "diamond" was stopped only by the amount check that FIN-S03 made optional.
//     plan_name is now READ FROM THE ORDER, so the client cannot influence it at all — the same
//     way the price already worked.
//   FIN-P03 — a payment refunded before the browser called back still reported
//     status: 'captured' and still granted a plan. amount_refunded is now checked.
//   FIN-P04 — the signature was compared with ===, which short-circuits on the first differing
//     character.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateCaller } from '../_shared/auth.ts';

const ALLOWED_ORIGIN = 'https://mybuddymaid.in';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Server-side plan definitions (same as create-razorpay-order)
const PLAN_DETAILS: Record<string, { name: string; pricePaise: number; durationMonths: number; replacementsTotal: number }> = {
  silver:   { name: 'Silver',   pricePaise: 499900,  durationMonths: 10,  replacementsTotal: 3 },
  gold:     { name: 'Gold',     pricePaise: 599900,  durationMonths: 12,  replacementsTotal: 5 },
  diamond:  { name: 'Diamond',  pricePaise: 699900,  durationMonths: 18,  replacementsTotal: 10 },
};

// Razorpay is in the customer's checkout path, so give up rather than hang. One retry, because
// a single blip should not strand somebody who has already been charged.
const RAZORPAY_TIMEOUT_MS = 8000;

// HMAC SHA256 verification using Web Crypto API (Deno-native)
async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const payload = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqual(expectedSignature, signature);
}

// Constant-time comparison (FIN-P04). Forging the HMAC is the real barrier and a timing attack
// against an edge function is not practical — but this is one line and it is what every
// payment SDK does.
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * GET from the Razorpay API with a timeout and one retry.
 *
 * Returns the parsed body, or null if it could not be read. Null means "we do not know", and
 * every caller treats not knowing as a refusal (FIN-S03) — never as permission.
 */
async function razorpayGet(
  path: string,
  keyId: string,
  keySecret: string,
): Promise<Record<string, unknown> | null> {
  const authorization = 'Basic ' + btoa(`${keyId}:${keySecret}`);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(RAZORPAY_TIMEOUT_MS),
      });

      if (response.ok) return await response.json();

      // 4xx is a real answer: the resource is not ours or does not exist. Retrying will not
      // change it, so stop. 429 and 5xx are worth one more try.
      if (response.status < 500 && response.status !== 429) {
        console.error(`[verify-razorpay-payment] Razorpay ${path} returned ${response.status}`);
        return null;
      }

      console.error(`[verify-razorpay-payment] Razorpay ${path} returned ${response.status}, attempt ${attempt + 1}`);
    } catch (err: unknown) {
      console.error(`[verify-razorpay-payment] Razorpay ${path} threw on attempt ${attempt + 1}:`, err);
    }
  }

  return null;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // ── Verify the caller is authenticated ──
    const auth = await authenticateCaller(req, supabaseAdmin);
    if (!auth.user) {
      return jsonResponse(auth.failure.body, auth.failure.status);
    }
    const user = auth.user;

    // ── Parse request ──
    // plan_name is deliberately NOT read here any more (FIN-P01). The SPA still sends it; it is
    // ignored, and the plan comes from the order's own notes below.
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
      phone,
    } = await req.json();

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return jsonResponse({ error: 'Missing required payment fields' }, 400);
    }

    // ── Has this payment already been redeemed? (FIN-S02) ──
    // FIRST, before any write. uq_user_plans_rzp_payment makes a second insert impossible; the
    // point of checking here is that a replay returns the customer's existing plan calmly
    // instead of deactivating it and then failing on the constraint.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('user_plans')
      .select('*')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingError) {
      console.error('[verify-razorpay-payment] Redemption lookup failed:', existingError);
      return jsonResponse({ error: 'Could not check payment status' }, 500);
    }

    if (existing) {
      if (existing.user_id !== user.id) {
        console.error(
          `[verify-razorpay-payment] User ${user.id} presented payment ${razorpay_payment_id}, already redeemed by ${existing.user_id}`,
        );
        return jsonResponse({ error: 'Payment already redeemed' }, 409);
      }
      return jsonResponse({
        success: true,
        plan: existing,
        message: 'Plan already active',
      });
    }

    // ── Verify Razorpay signature ──
    const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    if (!rzpKeySecret || !rzpKeyId) {
      console.error('[verify-razorpay-payment] Missing Razorpay credentials');
      return jsonResponse({ error: 'Payment verification not configured' }, 500);
    }

    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      rzpKeySecret,
    );

    if (!isValid) {
      console.error(`[verify-razorpay-payment] INVALID signature for payment ${razorpay_payment_id}`);
      return jsonResponse({ error: 'Payment signature verification failed. This may indicate a tampered payment.' }, 403);
    }

    // ── Read the order, which is where the plan and the buyer are actually recorded ──
    // The signature proves this payment belongs to this order. It says nothing about which
    // plan, which user or what price — that binding lives in notes, written by
    // create-razorpay-order and, until now, never read back (FIN-P01).
    const order = await razorpayGet(`/orders/${razorpay_order_id}`, rzpKeyId, rzpKeySecret);
    if (!order) {
      return jsonResponse(
        { error: 'Could not verify your order with the gateway. No amount has been lost — contact support.' },
        503,
      );
    }

    const notes = (order.notes ?? {}) as Record<string, unknown>;

    if (notes.user_id !== user.id) {
      console.error(
        `[verify-razorpay-payment] Order ${razorpay_order_id} belongs to ${String(notes.user_id)}, not ${user.id}`,
      );
      return jsonResponse({ error: 'Order does not belong to this account' }, 403);
    }

    const planName = typeof notes.plan_name === 'string' ? notes.plan_name : '';
    const plan = PLAN_DETAILS[planName];
    if (!plan) {
      console.error(`[verify-razorpay-payment] Order ${razorpay_order_id} names unknown plan "${planName}"`);
      return jsonResponse({ error: 'Order does not name a valid plan' }, 403);
    }

    if (order.amount !== plan.pricePaise) {
      console.error(
        `[verify-razorpay-payment] Order amount mismatch: order says ${order.amount}, ${planName} costs ${plan.pricePaise}`,
      );
      return jsonResponse({ error: 'Order amount mismatch' }, 403);
    }

    // ── Read the payment itself ──
    // FIN-S03: this whole block used to be conditional on the fetch succeeding. It is not any
    // more. A gateway we cannot reach is a payment we cannot verify, and an unverified payment
    // does not activate a plan — razorpay-webhook picks it up when Razorpay recovers.
    const paymentData = await razorpayGet(`/payments/${razorpay_payment_id}`, rzpKeyId, rzpKeySecret);
    if (!paymentData) {
      return jsonResponse(
        { error: 'Could not verify payment with the gateway. No amount has been lost — contact support.' },
        503,
      );
    }

    if (paymentData.order_id !== razorpay_order_id) {
      console.error(
        `[verify-razorpay-payment] Payment ${razorpay_payment_id} belongs to order ${String(paymentData.order_id)}, not ${razorpay_order_id}`,
      );
      return jsonResponse({ error: 'Order mismatch' }, 403);
    }

    if (paymentData.amount !== plan.pricePaise) {
      console.error(
        `[verify-razorpay-payment] Amount mismatch: expected ${plan.pricePaise}, got ${paymentData.amount}`,
      );
      return jsonResponse({ error: 'Payment amount mismatch' }, 403);
    }

    if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
      console.error(`[verify-razorpay-payment] Payment status: ${paymentData.status}`);
      return jsonResponse({ error: `Payment not completed. Status: ${paymentData.status}` }, 402);
    }

    // FIN-P03: a payment refunded before the browser called back still reads as captured.
    // Without this, a refund-then-verify sequence grants a plan the customer has been paid for.
    const amountRefunded = typeof paymentData.amount_refunded === 'number' ? paymentData.amount_refunded : 0;
    if (amountRefunded > 0) {
      console.error(`[verify-razorpay-payment] Payment ${razorpay_payment_id} has been refunded (${amountRefunded} paise)`);
      return jsonResponse({ error: 'This payment has been refunded' }, 403);
    }

    // ── Everything is verified. Only now does anything get written. ──
    // Deactivate first: uq_user_plans_one_active will not admit a second active row. Every
    // check that can fail has already run, so the only remaining failure is the insert itself,
    // which is handled below. There is no transaction across two PostgREST calls, so the
    // window is real but as narrow as it can be made without a SECURITY DEFINER rpc.
    const { error: deactivateError } = await supabaseAdmin
      .from('user_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (deactivateError) {
      // Previously this error was discarded entirely — no binding, no check (FIN-DB02).
      console.error('[verify-razorpay-payment] Could not deactivate existing plans:', deactivateError);
      return jsonResponse({ error: 'Failed to activate plan' }, 500);
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

    const { data: newPlan, error: insertError } = await supabaseAdmin
      .from('user_plans')
      .insert({
        user_id: user.id,
        plan_name: planName,
        amount_paid: plan.pricePaise,
        razorpay_payment_id: razorpay_payment_id,
        replacements_total: plan.replacementsTotal,
        replacements_used: 0,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        email: email || user.email || '',
        phone: phone || '',
      })
      .select()
      .single();

    if (insertError) {
      // 23505 means razorpay-webhook (or a concurrent retry of this call) got there first,
      // which is the desired outcome, not a failure. PostgREST returns the SQLSTATE as
      // error.code; nothing is thrown.
      if (insertError.code === '23505') {
        const { data: winner } = await supabaseAdmin
          .from('user_plans')
          .select('*')
          .eq('razorpay_payment_id', razorpay_payment_id)
          .maybeSingle();

        if (winner) {
          return jsonResponse({ success: true, plan: winner, message: 'Plan already active' });
        }
      }

      console.error('[verify-razorpay-payment] Insert error:', insertError);
      return jsonResponse({ error: 'Failed to activate plan' }, 500);
    }

    console.log(
      `[verify-razorpay-payment] Plan ${planName} activated for user ${user.id} (payment: ${razorpay_payment_id})`,
    );

    return jsonResponse({
      success: true,
      plan: newPlan,
      message: `${plan.name} plan activated successfully`,
    });

  } catch (err: unknown) {
    console.error('[verify-razorpay-payment] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

// supabase/functions/verify-razorpay-payment/index.ts
// Verifies Razorpay payment signature server-side and activates the plan.
// This is the ONLY way to create a user_plan — client INSERT is blocked by RLS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  silver:   { name: 'Silver',   pricePaise: 399900,  durationMonths: 10,  replacementsTotal: 3 },
  gold:     { name: 'Gold',     pricePaise: 499900,  durationMonths: 12,  replacementsTotal: 5 },
  diamond:  { name: 'Diamond',  pricePaise: 699900,  durationMonths: 18,  replacementsTotal: 10 },
};

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

  return expectedSignature === signature;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // ── Verify the caller is authenticated ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired auth token' }, 401);
    }

    // ── Parse request ──
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_name,
      email,
      phone,
    } = await req.json();

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_name) {
      return jsonResponse({ error: 'Missing required payment fields' }, 400);
    }

    if (!PLAN_DETAILS[plan_name]) {
      return jsonResponse({ error: `Invalid plan: ${plan_name}` }, 400);
    }

    // ── Verify Razorpay signature ──
    const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!rzpKeySecret) {
      console.error('[verify-razorpay-payment] Missing RAZORPAY_KEY_SECRET');
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

    // ── Double-check payment with Razorpay API ──
    const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const paymentCheckResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        headers: {
          'Authorization': 'Basic ' + btoa(`${rzpKeyId}:${rzpKeySecret}`),
        },
      },
    );

    if (paymentCheckResponse.ok) {
      const paymentData = await paymentCheckResponse.json();
      const plan = PLAN_DETAILS[plan_name];

      // Verify amount matches
      if (paymentData.amount !== plan.pricePaise) {
        console.error(
          `[verify-razorpay-payment] Amount mismatch: expected ${plan.pricePaise}, got ${paymentData.amount}`,
        );
        return jsonResponse({ error: 'Payment amount mismatch' }, 403);
      }

      // Verify payment is captured/authorized
      if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
        console.error(`[verify-razorpay-payment] Payment status: ${paymentData.status}`);
        return jsonResponse({ error: `Payment not completed. Status: ${paymentData.status}` }, 402);
      }
    }

    // ── Deactivate any existing plans ──
    await supabaseAdmin
      .from('user_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    // ── Create the plan (using service_role, bypasses RLS) ──
    const plan = PLAN_DETAILS[plan_name];
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

    const { data: newPlan, error: insertError } = await supabaseAdmin
      .from('user_plans')
      .insert({
        user_id: user.id,
        plan_name: plan_name,
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
      console.error('[verify-razorpay-payment] Insert error:', insertError);
      return jsonResponse({ error: 'Failed to activate plan' }, 500);
    }

    console.log(
      `[verify-razorpay-payment] Plan ${plan_name} activated for user ${user.id} (payment: ${razorpay_payment_id})`,
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
});

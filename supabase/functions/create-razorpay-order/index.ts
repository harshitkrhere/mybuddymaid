// supabase/functions/create-razorpay-order/index.ts
// Creates a Razorpay order server-side so the client never handles pricing.
// This prevents amount manipulation attacks.

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

// Server-side plan definitions — client cannot override these
const PLAN_DETAILS: Record<string, { name: string; pricePaise: number; durationMonths: number; replacementsTotal: number }> = {
  silver:   { name: 'Silver',   pricePaise: 499900,  durationMonths: 10,  replacementsTotal: 3 },
  gold:     { name: 'Gold',     pricePaise: 599900,  durationMonths: 12,  replacementsTotal: 5 },
  diamond:  { name: 'Diamond',  pricePaise: 699900,  durationMonths: 18,  replacementsTotal: 10 },
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Verify the caller is authenticated ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired auth token' }, 401);
    }

    // ── Parse request ──
    const { plan_name, email, phone } = await req.json();

    if (!plan_name || !PLAN_DETAILS[plan_name]) {
      return jsonResponse({ error: `Invalid plan: ${plan_name}` }, 400);
    }

    const plan = PLAN_DETAILS[plan_name];

    // ── Check if user already has an active plan ──
    // FIN-DB02: this used to be .maybeSingle() with the error discarded. maybeSingle() errors
    // when more than one row matches, so the moment a user ended up with two active plans the
    // query started failing, the unbound error was thrown away, `existingPlan` came back
    // undefined and the guard waved them through — the guard's failure mode was to disable
    // itself. .limit(1) cannot error that way, and the error is now handled.
    //
    // This is still check-then-act and two concurrent calls can both pass it. The real
    // enforcement is uq_user_plans_one_active (migration 20260908051500); this check exists to
    // give an honest 409 instead of a constraint violation at the end of a payment.
    const { data: existingPlans, error: existingPlanError } = await supabaseAdmin
      .from('user_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (existingPlanError) {
      console.error('[create-razorpay-order] Could not check plan status:', existingPlanError);
      return jsonResponse({ error: 'Could not check plan status' }, 500);
    }

    if (existingPlans?.length) {
      return jsonResponse({ error: 'You already have an active plan' }, 409);
    }

    // ── Create Razorpay order ──
    const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!rzpKeyId || !rzpKeySecret) {
      console.error('[create-razorpay-order] Missing Razorpay credentials');
      return jsonResponse({ error: 'Payment service not configured' }, 500);
    }

    const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${rzpKeyId}:${rzpKeySecret}`),
      },
      body: JSON.stringify({
        amount: plan.pricePaise,
        currency: 'INR',
        receipt: `mbm_${user.id.substring(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan_name: plan_name,
          user_email: email || user.email || '',
        },
      }),
    });

    if (!rzpResponse.ok) {
      const rzpError = await rzpResponse.text();
      console.error('[create-razorpay-order] Razorpay API error:', rzpError);
      return jsonResponse({ error: 'Failed to create payment order' }, 502);
    }

    const rzpOrder = await rzpResponse.json();

    return jsonResponse({
      order_id: rzpOrder.id,
      amount: plan.pricePaise,
      currency: 'INR',
      key_id: rzpKeyId,
      plan_name: plan_name,
      plan_display_name: plan.name,
      plan_duration: plan.durationMonths,
    });

  } catch (err: unknown) {
    console.error('[create-razorpay-order] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

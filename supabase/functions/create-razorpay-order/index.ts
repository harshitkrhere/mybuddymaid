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
const PLAN_DETAILS: Record<string, { name: string; pricePaise: number; duration: number; replacementsTotal: number }> = {
  silver:   { name: 'Silver',   pricePaise: 249900,  duration: 90,  replacementsTotal: 1 },
  gold:     { name: 'Gold',     pricePaise: 399900,  duration: 180, replacementsTotal: 3 },
  diamond:  { name: 'Diamond',  pricePaise: 599900,  duration: 365, replacementsTotal: 5 },
  platinum: { name: 'Platinum', pricePaise: 899900,  duration: 456, replacementsTotal: 15 },
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
    const { data: existingPlan } = await supabaseAdmin
      .from('user_plans')
      .select('id, plan_name, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingPlan) {
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
      plan_duration: plan.duration,
    });

  } catch (err: unknown) {
    console.error('[create-razorpay-order] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

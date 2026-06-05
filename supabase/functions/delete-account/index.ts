// supabase/functions/delete-account/index.ts
// Deletes all user data and the auth account (DPDP Act compliance).
// Only the authenticated user can delete their own account.

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
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

    const userId = user.id;
    const userEmail = user.email || 'unknown';

    // ── Parse confirmation ──
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }

    // Require explicit confirmation
    if (body.confirm !== 'DELETE_MY_ACCOUNT') {
      return jsonResponse({
        error: 'Please confirm deletion by sending { "confirm": "DELETE_MY_ACCOUNT" }',
      }, 400);
    }

    console.log(`[delete-account] Starting deletion for user ${userId} (${userEmail})`);

    // ── Delete all user data in order (respecting foreign key constraints) ──
    const deletionResults: Record<string, string> = {};

    // 1. Delete email_logs
    const { error: emailLogsErr } = await supabaseAdmin
      .from('email_logs')
      .delete()
      .eq('user_id', userId);
    deletionResults.email_logs = emailLogsErr ? `error: ${emailLogsErr.message}` : 'deleted';

    // 2. Delete user_plans
    const { error: plansErr } = await supabaseAdmin
      .from('user_plans')
      .delete()
      .eq('user_id', userId);
    deletionResults.user_plans = plansErr ? `error: ${plansErr.message}` : 'deleted';

    // 3. Delete bookings
    const { error: bookingsErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('user_id', userId);
    deletionResults.bookings = bookingsErr ? `error: ${bookingsErr.message}` : 'deleted';

    // 4. Delete profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);
    deletionResults.profiles = profileErr ? `error: ${profileErr.message}` : 'deleted';

    // 5. Delete auth user (this signs them out everywhere)
    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    deletionResults.auth_user = authDeleteErr ? `error: ${authDeleteErr.message}` : 'deleted';

    const allSucceeded = !emailLogsErr && !plansErr && !bookingsErr && !profileErr && !authDeleteErr;

    console.log(
      `[delete-account] ${allSucceeded ? 'SUCCESS' : 'PARTIAL'} deletion for user ${userId}:`,
      JSON.stringify(deletionResults),
    );

    if (allSucceeded) {
      return jsonResponse({
        success: true,
        message: 'Your account and all associated data have been permanently deleted.',
      });
    } else {
      return jsonResponse({
        success: false,
        message: 'Some data could not be deleted. Please contact support.',
      }, 500);
    }

  } catch (err: unknown) {
    console.error('[delete-account] Error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

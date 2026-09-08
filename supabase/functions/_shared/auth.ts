// supabase/functions/_shared/auth.ts
// The caller-identity check, in one place — FIN-S01.
//
// send-package-email and send-booking-email were deployed with no caller check at all: both
// would send a fully attacker-controlled, DKIM-signed email from noreply@mybuddymaid.in to any
// address on earth. There was no shared middleware, so the check had to be remembered per file,
// and it was not.
//
// Used by send-package-email, send-booking-email and verify-razorpay-payment.
// create-razorpay-order and delete-account still carry their own inline copies — both correct,
// just duplicated. Converting them is safe but was out of scope for the phase that added this.
//
// WHY THE GATEWAY IS NOT ENOUGH. Supabase's Edge Function gateway rejects a request with no
// Authorization header, which looks like protection. It also accepts the project ANON KEY —
// which is served to every visitor inside /_spa/assets/index-*.js. Only a function that calls
// auth.getUser() itself is actually authenticated. See AUDIT/01-ARCHITECTURE.md §7.
//
// DEPLOYMENT. A function importing this file must be deployed with `supabase functions deploy
// <name>`, which bundles relative imports. Pasting a single index.ts into the dashboard SQL/
// function editor will not carry _shared/ with it.

import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

/** A refusal, in the shape every function's own jsonResponse() already takes. */
export interface AuthFailure {
  status: number;
  body: { error: string };
}

export type AuthOutcome =
  | { user: User; failure: null }
  | { user: null; failure: AuthFailure };

/**
 * Resolve the caller from their bearer token, or explain why not.
 *
 * Callers must use the returned `user` for identity — never a user_id, email or name from the
 * request body. Binding the payload to the token is the whole point; authenticating and then
 * trusting the body again would close nothing.
 */
export async function authenticateCaller(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AuthOutcome> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { user: null, failure: { status: 401, body: { error: 'Missing authorization header' } } };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { user: null, failure: { status: 401, body: { error: 'Invalid or expired auth token' } } };
  }

  return { user, failure: null };
}

// supabase/__tests__/rls.test.ts
// Tier 2 of AUDIT/13-TESTING.md — Row Level Security.
//
// The booking app talks to Supabase directly from the browser with the public anon key
// (AUDIT/01-ARCHITECTURE.md §7), so RLS is the ENTIRE authorisation layer for profiles,
// bookings and user_plans. These assertions are the only automated thing standing between
// one customer and another's data.
//
// This suite runs against a REAL Supabase project. It creates two throwaway users with the
// service-role key, drives them through the public anon key exactly as a browser would, and
// deletes them again in a finally block. Point it at a scratch project if you have one; the
// repo has no staging environment, so assume any credential you hold is production.
//
// Run:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     npx deno@2 test --allow-env --allow-net supabase/__tests__/rls.test.ts
//
// The "cannot change their own booking's status" step is the FIN-S04 assertion. It FAILS
// against the schema as shipped in 20260605055353_security_hardening, where the column
// restriction is a comment rather than a grant, and passes once
// 20260908052000_restrict_booking_update_columns is applied.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must all be set. The anon ' +
      'key drives the two user sessions; the service-role key only creates and removes the ' +
      'throwaway users.',
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// A distinct run id keeps concurrent runs from colliding and makes stray rows identifiable.
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = `rls-test-${RUN}-Aa1!`;
const DAY_MS = 86_400_000;

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

async function createUser(tag: string): Promise<TestUser> {
  const email = `rls-${tag}-${RUN}@mybuddymaid-test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`could not create user ${tag}: ${error?.message}`);

  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`could not sign in user ${tag}: ${signIn.error.message}`);

  return { id: data.user.id, email, client };
}

function assertEmpty(rows: unknown[] | null, what: string): void {
  if (rows && rows.length > 0) throw new Error(`${what} — got ${rows.length} row(s), expected 0`);
}

function assertRefused(error: { message: string } | null, what: string): void {
  if (!error) throw new Error(`${what} — the write succeeded and should have been refused`);
}

Deno.test('Row Level Security', async (t) => {
  const a = await createUser('a');
  const b = await createUser('b');

  // Seed one row of each kind for B, so A has something to fail to reach. user_plans is
  // seeded through the service role because the client INSERT policy is (correctly) gone.
  const { data: bBooking, error: bBookingError } = await admin
    .from('bookings')
    .insert({ user_id: b.id, service: 'cook', city: 'Gurgaon', notes: 'rls fixture', status: 'pending' })
    .select()
    .single();
  if (bBookingError) throw new Error(`fixture booking failed: ${bBookingError.message}`);

  const { data: bPlan, error: bPlanError } = await admin
    .from('user_plans')
    .insert({
      user_id: b.id,
      plan_name: 'silver',
      amount_paid: 499900,
      razorpay_payment_id: `rls_fixture_${RUN}`,
      replacements_total: 3,
      expires_at: new Date(Date.now() + DAY_MS).toISOString(),
      is_active: true,
    })
    .select()
    .single();
  if (bPlanError) throw new Error(`fixture plan failed: ${bPlanError.message}`);

  // A's own booking, created through A's own session, so the UPDATE steps below act on a row
  // A genuinely owns — the point of FIN-S04 is that ownership is not the same as authority.
  const { data: aBooking, error: aBookingError } = await a.client
    .from('bookings')
    .insert({ user_id: a.id, service: 'cook', city: 'Delhi', notes: 'rls fixture', status: 'pending' })
    .select()
    .single();
  if (aBookingError) throw new Error(`A could not create their own booking: ${aBookingError.message}`);

  try {
    await t.step("A cannot SELECT B's bookings", async () => {
      const { data, error } = await a.client.from('bookings').select('id').eq('user_id', b.id);
      if (error) throw new Error(`expected 0 rows, got error: ${error.message}`);
      assertEmpty(data, "A read B's bookings");
    });

    await t.step("A cannot SELECT B's profile", async () => {
      const { data, error } = await a.client.from('profiles').select('id').eq('id', b.id);
      if (error) throw new Error(`expected 0 rows, got error: ${error.message}`);
      assertEmpty(data, "A read B's profile");
    });

    await t.step("A cannot SELECT B's user_plans", async () => {
      const { data, error } = await a.client.from('user_plans').select('id').eq('user_id', b.id);
      if (error) throw new Error(`expected 0 rows, got error: ${error.message}`);
      assertEmpty(data, "A read B's plans");
    });

    await t.step('A cannot INSERT a booking owned by B', async () => {
      const { error } = await a.client
        .from('bookings')
        .insert({ user_id: b.id, service: 'cook', city: 'Delhi', status: 'pending' });
      assertRefused(error, 'A inserted a booking owned by B');
    });

    await t.step('A cannot INSERT into user_plans at all', async () => {
      const { error } = await a.client.from('user_plans').insert({
        user_id: a.id,
        plan_name: 'diamond',
        amount_paid: 0,
        replacements_total: 10,
        expires_at: new Date(Date.now() + DAY_MS).toISOString(),
        is_active: true,
      });
      assertRefused(error, 'A granted themselves a plan');
    });

    await t.step('authenticated cannot SELECT email_logs', async () => {
      const { data, error } = await a.client.from('email_logs').select('id');
      // RLS on with no policies reads as zero rows rather than an error.
      if (error) return;
      assertEmpty(data, 'an authenticated user read email_logs');
    });

    // ─── FIN-S04 ──────────────────────────────────────────────────────────────────
    await t.step('A can UPDATE their own booking notes', async () => {
      const { error } = await a.client
        .from('bookings')
        .update({ notes: 'changed by the owner, which is allowed' })
        .eq('id', aBooking.id);
      if (error) throw new Error(`the allowed update was refused: ${error.message}`);
    });

    await t.step("A cannot UPDATE their own booking's status (FIN-S04)", async () => {
      const { error } = await a.client
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', aBooking.id);
      assertRefused(error, "A rewrote their own booking's status");

      // Belt and braces: prove the value on disk did not move, in case a future policy
      // silently drops the write instead of refusing it.
      const { data: after } = await admin
        .from('bookings')
        .select('status')
        .eq('id', aBooking.id)
        .single();
      if (after?.status !== 'pending') {
        throw new Error(`booking status became "${after?.status}" — expected it to stay "pending"`);
      }
    });

    await t.step('A cannot UPDATE their own booking amount or payment_id (FIN-S04)', async () => {
      const { error } = await a.client
        .from('bookings')
        .update({ amount: 1, payment_id: 'forged' })
        .eq('id', aBooking.id);
      assertRefused(error, "A rewrote their own booking's amount and payment_id");
    });
  } finally {
    // user_plans.user_id has no ON DELETE CASCADE (AUDIT/09-DATABASE.md), so the fixture plan
    // has to go explicitly. bookings and profiles cascade off auth.users.
    await admin.from('user_plans').delete().eq('id', bPlan.id);
    await admin.auth.admin.deleteUser(a.id);
    await admin.auth.admin.deleteUser(b.id);
    void bBooking;
  }
});

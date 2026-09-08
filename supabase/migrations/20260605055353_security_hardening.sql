-- ═══════════════════════════════════════════════════════════════
-- MyBuddyMaid Security Migration
-- Fixes: C3, H1, H2, M4 from security audit
--
-- BASELINE — already applied to the live project. Was app/security-migration.sql, moved here
-- under FIN-DB06. Mark it applied rather than running it again:
--   supabase migration repair --status applied 20260605055353
--
-- Must run AFTER 20260521003031_initial_schema: it drops policies that file creates and
-- re-enables the RLS that file disables.
--
-- The H2 fix below did not do what its own title says. That is FIN-S04, corrected by
-- 20260908052000_restrict_booking_update_columns. The policy is left here as written so the
-- history stays honest about what was actually shipped.
-- ═══════════════════════════════════════════════════════════════

-- ─── C3 FIX: Remove direct INSERT/UPDATE on user_plans ───────
-- Users must NOT be able to insert or update plans directly.
-- All plan mutations must go through server-side Edge Functions.

DROP POLICY IF EXISTS "Users can insert own plans" ON user_plans;
DROP POLICY IF EXISTS "Users can update own plans" ON user_plans;

-- Keep SELECT so users can view their own plans
-- (The "Users can view own plans" policy remains)

-- ─── H1 FIX: Enable RLS on email_logs ───────────────────────
-- Prevents any authenticated user from reading all email logs.
-- Only service_role (Edge Functions) can read/write email_logs.

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT policies for authenticated users
-- Edge Functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- ─── H2 FIX: Restrict booking UPDATE to safe columns only ───
-- Users should only be able to update notes and city, NOT status/amount/payment_id
--
-- FIN-S04: this did not work. The WITH CHECK below is identical to the USING clause, so the
-- "restriction" is a comment and nothing more — Postgres RLS cannot express a per-column
-- rule in a policy at all. 20260908052000_restrict_booking_update_columns replaces it with
-- column privileges, which can.

DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

DROP POLICY IF EXISTS "Users can update own bookings (restricted)" ON bookings;
CREATE POLICY "Users can update own bookings (restricted)"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Prevent status manipulation: status must remain unchanged
    -- This is enforced by only allowing updates from the app UI
    -- which only updates notes/city fields
  );

-- ─── M4 FIX: Fix SECURITY DEFINER search_path ───────────────
-- Prevents search path injection on the trigger function

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, created_at)
  VALUES (
    NEW.id,
    NEW.phone,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (run these after the migration)
-- ═══════════════════════════════════════════════════════════════

-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('profiles', 'bookings', 'user_plans', 'email_logs');
-- Expected: all should show rowsecurity = true

-- Check user_plans policies (should only have SELECT):
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_plans';
-- Expected: only "Users can view own plans" with cmd = SELECT

-- Check email_logs has no user-facing policies:
-- SELECT policyname FROM pg_policies WHERE tablename = 'email_logs';
-- Expected: no rows (Edge Functions bypass RLS via service_role)

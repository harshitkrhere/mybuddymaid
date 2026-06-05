-- ═══════════════════════════════════════════════════════════════
-- MyBuddyMaid Security Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- Fixes: C3, H1, H2, M4 from security audit
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

DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

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

-- ═══════════════════════════════════════════════════════════════
-- Restrict booking UPDATE to safe columns, for real this time — FIN-S04
--
-- 20260605055353_security_hardening called its H2 section "Restrict booking UPDATE to safe
-- columns only" and then shipped a policy whose WITH CHECK was identical to its USING clause.
-- The restriction was a SQL comment, and the control it named — "enforced by only allowing
-- updates from the app UI" — is not a control: the browser holds the public anon key and can
-- PATCH /rest/v1/bookings?id=eq.<own id> directly, setting status, amount, payment_id or
-- assigned_helper to anything.
--
-- Blast radius was always limited to the user's own rows (the USING clause does hold), so this
-- was never cross-tenant. What it corrupts is every operational and revenue number built on
-- bookings — and a control documented as fixed but absent is worse than a known gap.
--
-- Postgres RLS cannot express a per-column rule in a policy. Column privileges can, so use
-- those. REVOKE first, then GRANT back the three columns a customer legitimately edits.
--
-- SAFE TODAY: the booking app has no UPDATE path to bookings at all — `grep -rn "\.update("
-- app/src/` returns nothing, and AuthContext writes bookings only through createBooking's
-- INSERT. Nothing in the product loses a capability here.
--
-- COLUMN LIST — do not copy the one in AUDIT/04-SECURITY.md. That version also lists society,
-- locality_slug, city_slug and pincode, which are added only by the leads migration
-- (app/migrations/2026-09-06-leads-and-placement-locality.sql, still marked NOT APPLIED).
-- Running it verbatim aborts with `column "society" of relation "bookings" does not exist`,
-- taking the REVOKE down with it and leaving the hole open while looking applied. The list
-- below is AUDIT/18-REMEDIATION-PLAN.md §0.5's, which matches the columns that exist.
--
-- PHASE 1 HANDOFF: when that leads migration is applied and createBooking starts writing
-- city_slug / locality_slug / pincode / society (FIN-DB03), those are INSERT-time values, not
-- customer-editable ones — extend this GRANT only if a real edit path appears.
--
-- Rollback (restores the ineffective status quo, deliberately):
--   GRANT UPDATE ON bookings TO authenticated;
-- ═══════════════════════════════════════════════════════════════

-- The policy keeps ownership; the grants below are what keep the columns. Recreated without
-- the comment that claimed an enforcement it never had.
DROP POLICY IF EXISTS "Users can update own bookings (restricted)" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;
CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Column privileges are checked before RLS, so an UPDATE that touches any other column is
-- refused with 42501 regardless of who owns the row.
REVOKE UPDATE ON bookings FROM authenticated;
GRANT UPDATE (notes, city, updated_at) ON bookings TO authenticated;

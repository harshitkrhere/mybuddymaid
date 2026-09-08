-- ═══════════════════════════════════════════════════════════════
-- Payment integrity constraints — FIN-DB01, FIN-DB02
--
-- user_plans is the only table where money lands, and it had no uniqueness of any kind.
-- Two consequences, both live before this migration:
--
--   FIN-DB01 / FIN-S02 — razorpay_payment_id was a plain nullable TEXT. verify-razorpay-payment
--   inserts a fresh row on every call with no check that the payment was already redeemed, so
--   one genuine payment could be replayed every eleven months, forever, from a single receipt.
--
--   FIN-DB02 — the "you already have an active plan" rule lived only in create-razorpay-order,
--   as a check-then-act with a discarded error. Two concurrent orders both saw "no active
--   plan"; and once two active rows existed, its maybeSingle() started erroring, the error was
--   thrown away, and the guard silently disabled itself.
--
-- Both are partial indexes, so they cost nothing on the rows they do not cover: historical
-- plans with a NULL payment id, and every deactivated plan.
--
-- Checked before writing this file (2026-09-08, production): both duplicate-detection queries
-- below returned zero rows, so neither index can fail to build.
--
--   SELECT razorpay_payment_id, count(*) FROM user_plans
--    WHERE razorpay_payment_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
--   SELECT user_id, count(*) FROM user_plans WHERE is_active GROUP BY 1 HAVING count(*) > 1;
--
-- ORDERING — READ THIS BEFORE APPLYING.
-- Apply this migration in the same window as the hardened verify-razorpay-payment, not before
-- it. With the index live and the old function still deployed, a replayed or double-submitted
-- verification runs the unconditional `UPDATE user_plans SET is_active = false` first, THEN
-- fails the insert on 23505, and returns 500 — deactivating the caller's real plan and never
-- restoring it. The hardened function returns the existing plan before it deactivates anything,
-- which is what makes the index safe. (Online checkout is paused, so the practical window is
-- small, but the deployed function is directly invocable by any authenticated user.)
--
-- Rollback:
--   DROP INDEX IF EXISTS uq_user_plans_rzp_payment;
--   DROP INDEX IF EXISTS uq_user_plans_one_active;
-- ═══════════════════════════════════════════════════════════════

-- One plan row per Razorpay payment. This is the authoritative half of the idempotency fix;
-- the function-side early return is the half that makes a replay pleasant instead of a 500.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_rzp_payment
  ON user_plans (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- At most one active plan per user, enforced where it cannot be raced.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_plans_one_active
  ON user_plans (user_id)
  WHERE is_active;

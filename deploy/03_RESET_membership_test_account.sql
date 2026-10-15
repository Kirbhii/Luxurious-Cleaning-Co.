-- ============================================================================
--  RESET MEMBERSHIP — single test account
--  Account: TEST_CUSTOMER_EMAIL   ← palitan ng account na tinetest mo
--
--  Purpose: return this one profile to a "brand new" membership state so the
--           membership flow can be tested again from scratch.
--
--  What it changes (ONLY on this one row):
--     membership_tier   -> NULL
--     membership_status -> 'none'
--
--  It does NOT touch: role, company, PIN, bookings, applications, any other row.
--  Safe to re-run (idempotent).
-- ============================================================================

-- ── STEP 1: see the BEFORE state ────────────────────────────────────────────
SELECT
  id,
  email,
  name,
  role,
  membership_tier,
  membership_status
FROM public.profiles
WHERE email = 'TEST_CUSTOMER_EMAIL';

-- ── STEP 2: reset the membership ────────────────────────────────────────────
UPDATE public.profiles
SET
  membership_tier   = NULL,
  membership_status = 'none'
WHERE email = 'TEST_CUSTOMER_EMAIL';

-- ── STEP 3: verify the AFTER state ──────────────────────────────────────────
--  Expected: membership_tier = (empty), membership_status = none
SELECT
  id,
  email,
  name,
  role,
  membership_tier,
  membership_status
FROM public.profiles
WHERE email = 'TEST_CUSTOMER_EMAIL';

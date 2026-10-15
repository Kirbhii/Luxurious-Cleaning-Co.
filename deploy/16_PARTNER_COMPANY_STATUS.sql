-- ============================================================
-- 16_PARTNER_COMPANY_STATUS.sql
-- ============================================================
-- Gives every partner company an explicit lifecycle the admin can set:
--
--   active      -> in good standing; may submit new projects
--   inactive    -> temporarily stood down; may be reinstated later
--   terminated  -> the partnership has ended
--
-- Why a new column instead of the existing boolean:
--   `partner_companies.is_active` already existed (001) but could only express
--   two states, and nothing in the app ever read it. "Inactive" and "no longer
--   a partner" are different things — one is reversible — so a boolean cannot
--   carry the decision. The old column is kept and DERIVED from the new one by
--   trigger, so the two can never disagree.
--
-- Safe to re-run.
-- ============================================================

BEGIN;

ALTER TABLE public.partner_companies
  ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason     TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Guard the value set. Separate DO block so a re-run does not error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.partner_companies'::regclass
      AND conname  = 'partner_companies_status_check'
  ) THEN
    ALTER TABLE public.partner_companies
      ADD CONSTRAINT partner_companies_status_check
      CHECK (status IN ('active', 'inactive', 'terminated'));
  END IF;
END $$;

-- Backfill: anything already switched off becomes 'inactive'.
UPDATE public.partner_companies
   SET status = 'inactive'
 WHERE is_active = FALSE
   AND status = 'active';

-- Keep is_active derived, so no reader can ever see the two diverge.
CREATE OR REPLACE FUNCTION public.sync_partner_company_is_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END $$;

-- A new function is PUBLIC-executable by default, and PUBLIC includes `anon`.
-- This schema has been bitten by exactly that twice — 007/010 revoked PUBLIC but
-- not the direct anon grant, 011 revoked the roles but not PUBLIC — so both
-- directions are closed here, per rule 11.
--
-- NOT AN EMERGENCY. A trigger function is not reachable through PostgREST today
-- (`handle_new_user` returns 404 PGRST202, per the 13 audit), and a direct call
-- could not write anything: NEW is unassigned outside a trigger. This is defence
-- in depth. It is here rather than left to `13_HARDEN_...` because 13 runs BEFORE
-- this file, so a fresh deploy would otherwise carry the grant until someone
-- re-ran the sweep. Trigger invocation does not check EXECUTE, so the trigger
-- keeps firing regardless of these grants.
REVOKE ALL ON FUNCTION public.sync_partner_company_is_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_partner_company_is_active() FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_partner_company_is_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_partner_company_is_active() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_partner_company_is_active ON public.partner_companies;
CREATE TRIGGER trg_sync_partner_company_is_active
  BEFORE INSERT OR UPDATE ON public.partner_companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_company_is_active();

-- Normalise whatever the backfill left behind.
UPDATE public.partner_companies SET is_active = (status = 'active');

COMMIT;

-- ============================================================
-- Diagnostics (informational)
-- ============================================================

SELECT status, count(*) AS companies
  FROM public.partner_companies
 GROUP BY status
 ORDER BY status;

-- ============================================================
-- THE ONE ROW TO READ
-- ============================================================

SELECT CASE
  WHEN count(*) FILTER (WHERE is_active <> (status = 'active')) = 0
   AND count(*) FILTER (WHERE status NOT IN ('active', 'inactive', 'terminated')) = 0
  THEN 'PASS'
  ELSE 'FAIL'
END AS verdict
FROM public.partner_companies;

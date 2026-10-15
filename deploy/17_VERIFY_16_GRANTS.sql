-- ============================================================
-- 17_VERIFY_16_GRANTS.sql
-- ============================================================
-- `16_PARTNER_COMPANY_STATUS.sql` creates a trigger function, and a new function
-- is PUBLIC-executable by default — and PUBLIC includes `anon`. 16 now revokes
-- that itself, but its own `verdict` only checks is_active/status consistency; it
-- cannot see a grant. This file is what answers the grant question.
--
-- WHY THE OUTSIDE PROBE IS NOT ENOUGH
--   Probing `/rest/v1/rpc/sync_partner_company_is_active` with the public anon key
--   returns 404 PGRST202 both before and after the revoke, because PostgREST does
--   not expose `RETURNS TRIGGER` at all (same shape as `handle_new_user`). So the
--   probe proves the function is NOT REACHABLE, which is the important thing, but
--   it cannot prove the GRANT changed. Only the catalogue can.
--
-- Read-only. Changes nothing.
-- ============================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The grants on the function 16 creates, read per grantee
-- ─────────────────────────────────────────────────────────────────────────────
-- Expected after 16: anon_can_execute = false, carries_public_grant = false,
-- authenticated and service_role = true.
SELECT
  p.proname                                                              AS function_name,
  has_function_privilege('anon',          p.oid, 'EXECUTE')              AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')              AS authenticated_can_execute,
  has_function_privilege('service_role',  p.oid, 'EXECUTE')              AS service_role_can_execute,
  (p.proacl IS NULL
     OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)) AS carries_public_grant
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname = 'sync_partner_company_is_active';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The whole surface — nothing else became anon-reachable either
-- ─────────────────────────────────────────────────────────────────────────────
-- `anon_reachable` must be 0, the same reading `13_HARDEN_...` §3 demands.
SELECT count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_reachable,
       count(*)                                                                 AS total_public_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';


-- ─────────────────────────────────────────────────────────────────────────────
-- THE ONE ROW TO READ
-- ─────────────────────────────────────────────────────────────────────────────
SELECT CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  ) THEN 'PASS' ELSE 'FAIL'
END AS verdict;

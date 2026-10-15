-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT — every public function anon can execute.
--
-- WHY: migration 011 leaked because it revoked EXECUTE from anon/authenticated/
-- service_role BY NAME and never from PUBLIC — and PostgreSQL grants EXECUTE to
-- PUBLIC by default. The header of 011 says the same pattern was used in
-- "007 §2 and 010 §7". If it was used there the same way, those functions leak
-- too. This finds out, once, for the whole schema.
--
-- READ-ONLY. Selects only. Changes nothing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE FLAGGED LIST — anything here needs a decision
-- ─────────────────────────────────────────────────────────────────────────────
-- `security_definer = true` is what makes an anon-callable function serious: the
-- body runs as the OWNER, so RLS and column grants do not apply to it. A
-- SECURITY INVOKER function still runs as anon and is still bound by RLS.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  (p.proacl IS NULL
    OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)) AS public_may_execute,
  CASE
    WHEN p.prosecdef THEN '*** HIGH — anon can run a SECURITY DEFINER function ***'
    ELSE 'check — anon can call it; still bound by RLS'
  END AS risk
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY p.prosecdef DESC, p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. THE FULL INVENTORY — every public function and who can reach it
-- ─────────────────────────────────────────────────────────────────────────────
-- `acl` reading guide:
--   NULL                       -> no explicit ACL; PostgreSQL's default applies,
--                                 which INCLUDES EXECUTE to PUBLIC
--   an entry with an EMPTY
--   grantee, e.g. `=X/postgres` -> that IS the PUBLIC grant
--   `anon=X/postgres`           -> a direct grant to anon
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can,
  has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_role_can,
  (p.proacl IS NULL
    OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)) AS public_may_execute,
  coalesce(p.proacl::text, '(NULL — default ACL: EXECUTE to PUBLIC)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY has_function_privilege('anon', p.oid, 'EXECUTE') DESC,
         p.prosecdef DESC,
         p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. THE ONE-LINE VERDICT
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))                    AS anon_reachable,
  count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE') AND p.prosecdef)    AS anon_reachable_definer,
  count(*) FILTER (WHERE p.proacl IS NULL
                     OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0))    AS carrying_a_public_grant,
  count(*)                                                                                    AS total_public_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';
-- `anon_reachable_definer` must be 0. Anything else is a P0 of the same class as
-- the 011 leak. `carrying_a_public_grant` tells you how widespread the pattern is.

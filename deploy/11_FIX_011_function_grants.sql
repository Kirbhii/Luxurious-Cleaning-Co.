-- ═══════════════════════════════════════════════════════════════════════════
-- FIX 011 — the recovery functions are callable by anon. Run this now.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHAT WENT WRONG
--   Migration 011 revoked EXECUTE from anon, authenticated and service_role BY
--   NAME — but never from PUBLIC. PostgreSQL grants EXECUTE to PUBLIC by
--   DEFAULT on every new function, and a REVOKE naming a role does NOT remove a
--   privilege that role holds through PUBLIC. Effective privilege is the UNION
--   of direct grants and PUBLIC.
--
--   The header comment in 011 warned about the OPPOSITE direction ("REVOKE FROM
--   PUBLIC does not remove a DIRECT role grant"). True — and the converse is
--   equally true, which is what bit us: naming the roles does not remove the
--   PUBLIC grant.
--
-- WHY ONLY THE FUNCTIONS LEAKED
--   The two tables were protected by RLS: enabled with ZERO policies, which
--   denies every non-owner role no matter what the grants say. Functions have no
--   RLS equivalent — for a SECURITY DEFINER function the grant IS the control.
--   So the tables held and the functions did not.
--
-- PROVEN, NOT INFERRED (public anon key, which ships in the frontend bundle):
--   POST /rest/v1/rpc/consume_mfa_recovery_codes  {"p_user_id":"000…000"}
--     -> 200 "0"                       the function RAN
--   POST /rest/v1/rpc/verify_mfa_recovery_code    {"p_user_id":"000…000",…}
--     -> 409 FK violation on mfa_recovery_attempts
--                                      it reached the INSERT, so it passed the
--                                      rate-limit, length and EXISTS checks —
--                                      a permission denial would be 401/403
--                                      with code 42501
--   POST /rest/v1/rpc/mfa_recovery_status         {}
--     -> 200 [{"total":0,"remaining":0}]
--
-- IMPACT
--   consume_mfa_recovery_codes(p_user_id) RETURNS INT, has NO internal auth
--   check, and burns every unused recovery code for the id you hand it. Anyone
--   with the public anon key can therefore DESTROY the recovery codes of any
--   user whose UUID they can obtain — including the sole admin — which removes
--   the exact safety net this feature was built to provide. It also clears the
--   rate-limit rows. Destructive, unauthenticated: this is why it is P0.
--
--   verify_mfa_recovery_code is rate-limited inside (10 per 15 min per user), so
--   50 bits is still not brute-forceable through it. But an attacker can spend a
--   target's attempt budget at will, locking that user out of recovery for 15
--   minutes at a time.
--
-- Read-only against your data: this only changes grants. It burns nothing and
-- deletes nothing.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. THE FIX — revoke from PUBLIC, then re-assert the intended matrix
-- ─────────────────────────────────────────────────────────────────────────────
-- PUBLIC is the one grantee that was never named. This is the whole fix.
REVOKE ALL ON FUNCTION public.replace_mfa_recovery_codes(TEXT[])  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_recovery_status()               FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_mfa_recovery_codes(UUID)     FROM PUBLIC;

-- Re-assert the named revokes too, so this file is correct no matter what state
-- the database is in (idempotent).
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOR role_name IN SELECT unnest(ARRAY['anon', 'authenticated', 'service_role'])
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.replace_mfa_recovery_codes(TEXT[])  FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.mfa_recovery_status()               FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) FROM %I', role_name);
    EXECUTE format('REVOKE ALL ON FUNCTION public.consume_mfa_recovery_codes(UUID)     FROM %I', role_name);
  END LOOP;
END $$;

-- Now hand back exactly what each role is supposed to have.
--   mint + count  -> the signed-in user's own data (auth.uid(), aal2 for mint)
--   verify + consume -> service_role ONLY, reached through the edge function
GRANT EXECUTE ON FUNCTION public.replace_mfa_recovery_codes(TEXT[])  TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_status()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_codes(UUID)     TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SHOW THE SOURCE — where did the privilege come from?
-- ─────────────────────────────────────────────────────────────────────────────
-- proacl NULL means "no explicit ACL was ever set", so PostgreSQL's built-in
-- default applies — and that default is EXECUTE to PUBLIC. An ACL entry with an
-- EMPTY grantee (`=X/…`) is the PUBLIC grant. Read this BEFORE and AFTER §1:
-- before, you should see `=X/…`; after, it must be gone.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer,
       coalesce(p.proacl::text, '(NULL — default ACL applies: EXECUTE to PUBLIC)') AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('replace_mfa_recovery_codes', 'mfa_recovery_status',
                    'verify_mfa_recovery_code', 'consume_mfa_recovery_codes')
ORDER BY p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFY — every row must read OK
-- ─────────────────────────────────────────────────────────────────────────────
WITH checks(check_name, result, expected) AS (
  VALUES
  ('authenticated: CAN mint (aal2-gated inside)',
    has_function_privilege('authenticated', 'public.replace_mfa_recovery_codes(text[])', 'EXECUTE')::text, 'true'),
  ('authenticated: CAN count',
    has_function_privilege('authenticated', 'public.mfa_recovery_status()', 'EXECUTE')::text, 'true'),
  ('authenticated: CANNOT verify',
    has_function_privilege('authenticated', 'public.verify_mfa_recovery_code(uuid,text)', 'EXECUTE')::text, 'false'),
  ('authenticated: CANNOT consume',
    has_function_privilege('authenticated', 'public.consume_mfa_recovery_codes(uuid)', 'EXECUTE')::text, 'false'),
  ('anon: CANNOT mint',
    has_function_privilege('anon', 'public.replace_mfa_recovery_codes(text[])', 'EXECUTE')::text, 'false'),
  ('anon: CANNOT count',
    has_function_privilege('anon', 'public.mfa_recovery_status()', 'EXECUTE')::text, 'false'),
  ('anon: CANNOT verify',
    has_function_privilege('anon', 'public.verify_mfa_recovery_code(uuid,text)', 'EXECUTE')::text, 'false'),
  ('anon: CANNOT consume',
    has_function_privilege('anon', 'public.consume_mfa_recovery_codes(uuid)', 'EXECUTE')::text, 'false'),
  ('service_role: CAN verify',
    has_function_privilege('service_role', 'public.verify_mfa_recovery_code(uuid,text)', 'EXECUTE')::text, 'true'),
  ('service_role: CAN consume',
    has_function_privilege('service_role', 'public.consume_mfa_recovery_codes(uuid)', 'EXECUTE')::text, 'true'),
  ('no function carries a PUBLIC (empty-grantee) EXECUTE entry',
    (SELECT count(*)::text FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('replace_mfa_recovery_codes', 'mfa_recovery_status',
                          'verify_mfa_recovery_code', 'consume_mfa_recovery_codes')
        AND p.proacl IS NOT NULL
        AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                     WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')), '0')
)
SELECT check_name, result, expected,
       CASE WHEN result = expected THEN 'OK' ELSE '*** MISMATCH ***' END AS verdict
FROM checks
ORDER BY (result = expected), check_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFY migration 011 — ONE result set, one `verdict` column.
--
-- Why this exists: the SQL Editor shows only the LAST result, so the six
-- checks at the end of 09_MIGRATION_011_mfa_recovery.sql were never all visible
-- at once. This collapses them into a single table: scan the `verdict` column
-- and every row must read OK. Anything reading `*** MISMATCH ***` is a finding.
--
-- Read-only. Creates nothing, changes nothing, deletes nothing.
-- Safe to run as many times as you like.
-- ═══════════════════════════════════════════════════════════════════════════

WITH checks(check_name, result, expected) AS (
  VALUES
  -- ── The tables: locked down, and locked by DEFAULT ──────────────────────
  ('tables: RLS enabled (want 2)',
    (SELECT count(*)::text FROM pg_class
      WHERE relname IN ('mfa_recovery_codes', 'mfa_recovery_attempts')
        AND relrowsecurity), '2'),

  ('tables: policy count (want 0 = deny by default)',
    (SELECT count(*)::text FROM pg_policies
      WHERE tablename IN ('mfa_recovery_codes', 'mfa_recovery_attempts')), '0'),

  -- ── The hashes must be unreachable from any client role ─────────────────
  ('authenticated: SELECT codes',
    has_table_privilege('authenticated', 'public.mfa_recovery_codes', 'SELECT')::text, 'false'),
  ('authenticated: INSERT codes',
    has_table_privilege('authenticated', 'public.mfa_recovery_codes', 'INSERT')::text, 'false'),
  ('authenticated: UPDATE codes',
    has_table_privilege('authenticated', 'public.mfa_recovery_codes', 'UPDATE')::text, 'false'),
  ('authenticated: DELETE codes',
    has_table_privilege('authenticated', 'public.mfa_recovery_codes', 'DELETE')::text, 'false'),
  ('authenticated: SELECT attempts',
    has_table_privilege('authenticated', 'public.mfa_recovery_attempts', 'SELECT')::text, 'false'),
  ('anon: SELECT codes',
    has_table_privilege('anon', 'public.mfa_recovery_codes', 'SELECT')::text, 'false'),
  ('anon: SELECT attempts',
    has_table_privilege('anon', 'public.mfa_recovery_attempts', 'SELECT')::text, 'false'),

  -- ── Function grants. Mint/count are for the signed-in user; verify/consume
  --    are service_role ONLY, because the redemption endpoint is unauthenticated
  --    and must not be reachable with a client key. ─────────────────────────
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

  -- ── Exactly one signature each. A CREATE OR REPLACE with a DIFFERENT
  --    signature makes an OVERLOAD rather than replacing (010 Hole C). ─────
  ('exactly 4 functions, no overloads (want 4)',
    (SELECT count(*)::text FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('replace_mfa_recovery_codes', 'mfa_recovery_status',
                          'verify_mfa_recovery_code', 'consume_mfa_recovery_codes')), '4'),

  -- ── pgcrypto must be reachable from the functions' search_path, or every
  --    crypt() call fails at RUNTIME while creation looked fine. ───────────
  ('pgcrypto callable (crypt + gen_salt)',
    (SELECT (crypt('ABCDEFGHJK', gen_salt('bf', 10)) IS NOT NULL)::text), 'true')
)
SELECT check_name, result, expected,
       CASE WHEN result = expected THEN 'OK' ELSE '*** MISMATCH ***' END AS verdict
FROM checks
ORDER BY (result = expected), check_name;

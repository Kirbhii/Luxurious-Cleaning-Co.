-- ═══════════════════════════════════════════════════════════════════════════
-- HARDENING — no public function should be reachable by `anon`.
--
-- NOT AN EMERGENCY. Read this before deciding when to run it.
--
-- The audit (`12_AUDIT_...`) reported `anon_reachable = 12` and
-- `anon_reachable_definer = 10`, which looks like ten live holes. I probed every
-- sensitive one with the public anon key (nil UUID, so a write is a no-op) and
-- NONE of them is exploitable, because each guards itself in its own body:
--
--   admin_set_user_role        -> 42501 'not authenticated'   (body checks auth.uid()
--   admin_set_profile_company  -> 42501 'not authenticated'    AND that the caller's
--                                                              role IS 'admin')
--   activate_own_membership    -> 42501 'not authenticated'   (body checks auth.uid())
--   cancel_own_membership      -> 42501 'not authenticated'
--   verify_user_pin            -> 42501 permission denied      (grant already closed)
--   has_user_pin               -> 42501 permission denied
--   pin_lock_status            -> 42501 permission denied
--   current_user_role          -> 200 null                     (returns the CALLER's
--   current_company_id         -> 200 null                      role/company; null for anon)
--   handle_new_user            -> 404 PGRST202                 (trigger fn, not callable
--   enforce_profile_column_... -> 404 PGRST202                  through PostgREST)
--
-- So this file is DEFENCE IN DEPTH, not a fix for a live exploit. The real P0 was
-- `consume_mfa_recovery_codes`, which had NO internal guard — the grant was the
-- only control — and that is already fixed and verified.
--
-- WHY IT IS STILL WORTH RUNNING
--   Right now the internal `auth.uid()` / role check is the ONLY thing between
--   `anon` and these functions. A future edit that drops a guard, or an overload
--   created with a different signature (010 Hole C), silently re-opens them. The
--   grant should say what is true, not rely on every body staying correct forever.
--
-- WHY BOTH DIRECTIONS APPEAR IN THIS SCHEMA — this is the interesting part.
--   Rule 11 says function EXECUTE is a union of PUBLIC + direct role grants, so
--   you must revoke from both. This codebase got bitten from BOTH sides:
--     * 011  revoked from anon/authenticated/service_role BY NAME and not from
--            PUBLIC  -> every recovery function stayed anon-callable.  [direction 2]
--     * 007/010  did `REVOKE ... FROM PUBLIC` and did not name anon
--            -> the Supabase default DIRECT grant to anon survived, so
--               admin_set_user_role and friends are still anon-reachable.
--                                                                     [direction 1]
--   One rule, two ways to violate it, both present here. Hence the loop below
--   handles both rather than naming functions.
--
-- Read-only against your data. Changes grants only. Nothing is deleted.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- STATUS: APPLIED against inyqjfgeecairaxbkxuo. §2 has since been widened.
--
-- WHAT §2 ORIGINALLY MISSED
--   §2's cursor was "functions `anon` can still reach". That is the right set
--   for closing the anon surface, but it is the WRONG set for protecting
--   `authenticated`: a function that is referenced inside an RLS policy is a
--   dependency, and §2 only re-granted `authenticated` where it happened to be
--   iterating. A function whose access for `authenticated` came only through
--   PUBLIC, and which `anon` could not reach, would have been skipped — and
--   `authenticated` would have silently lost it.
--
--   With Supabase's ALTER DEFAULT PRIVILEGES every function also carries a
--   direct grant to `authenticated`, so that combination does not occur in this
--   schema and nothing was actually broken by the run above. The widened §2
--   below removes the need to rely on that.
--
--   `14_VERIFY_AND_FIX_policy_helper_grants.sql` is the file that VERIFIES the
--   end state (it reads pg_policy and reports any helper `authenticated` cannot
--   execute). Run that one to confirm; this file is now safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Revoke anon from EVERY public function (direction 1: the direct grant)
-- ─────────────────────────────────────────────────────────────────────────────
-- Data-driven on purpose: an explicit list would go stale the next time someone
-- adds a function. Revoking EXECUTE from `anon` cannot break a trigger (trigger
-- invocation does not check EXECUTE) and cannot affect `authenticated`.
DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    RAISE NOTICE 'revoked anon on %', r.sig;
    n := n + 1;
  END LOOP;
  RAISE NOTICE '--- direction 1: revoked anon on % function(s)', n;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Anything still anon-reachable is reachable through PUBLIC (direction 2)
--    — plus every policy helper, whether or not anon can reach it
-- ─────────────────────────────────────────────────────────────────────────────
-- Revoking PUBLIC would also drop `authenticated` if its only access came that
-- way, so each function is re-granted to `authenticated` (and `service_role`)
-- immediately, in the same iteration. `anon` is never granted here.
--
-- The cursor deliberately includes BOTH:
--   (a) functions `anon` can still reach  -> the PUBLIC grant must go, and
--   (b) functions referenced in an RLS policy -> `authenticated` must keep them
-- Case (b) is the one the first version of this file missed. A policy helper is
-- a hidden dependency: revoking EXECUTE does not just close a door, it makes the
-- POLICY unevaluable, so an anon read of the table turns from `200 []` into
-- `401 42501 permission denied for function <helper>`. That is intended for
-- `anon`; it would be an outage for `authenticated`.
--
-- The two functions that must stay service_role-only (verify/consume_mfa_
-- recovery_code) are neither anon-reachable nor policy helpers, so they are not
-- touched here.
DO $$
DECLARE
  r       RECORD;
  n_anon  INT := 0;
  n_pol   INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
           EXISTS (
             SELECT 1
             FROM pg_policy pol
             JOIN pg_class c     ON c.oid  = pol.polrelid
             JOIN pg_namespace cn ON cn.oid = c.relnamespace
             WHERE cn.nspname = 'public'
               AND (
                 coalesce(pg_get_expr(pol.polqual,      pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
                 OR
                 coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
               )
           ) AS used_in_policy
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR EXISTS (
          SELECT 1
          FROM pg_policy pol
          JOIN pg_class c     ON c.oid  = pol.polrelid
          JOIN pg_namespace cn ON cn.oid = c.relnamespace
          WHERE cn.nspname = 'public'
            AND (
              coalesce(pg_get_expr(pol.polqual,      pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
              OR
              coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
            )
        )
      )
  LOOP
    IF r.anon_can THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
      n_anon := n_anon + 1;
    END IF;

    -- Always re-granted: idempotent, and the whole point of case (b).
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',  r.sig);

    IF r.used_in_policy THEN
      n_pol := n_pol + 1;
      RAISE NOTICE 'policy helper, authenticated kept: %', r.sig;
    ELSE
      RAISE NOTICE 'revoked PUBLIC, re-granted authenticated: %', r.sig;
    END IF;
  END LOOP;

  RAISE NOTICE '--- section 2: % anon-reachable cleared, % policy helper(s) protected', n_anon, n_pol;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERIFY — `anon_reachable` must now be 0
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))                 AS anon_reachable,
  count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE') AND p.prosecdef) AS anon_reachable_definer,
  count(*) FILTER (WHERE p.proacl IS NULL
                     OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)) AS carrying_a_public_grant,
  count(*)                                                                                 AS total_public_functions
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f';
-- anon_reachable and anon_reachable_definer MUST both be 0.
-- carrying_a_public_grant should be 0 too; if it is not, the remaining ones are
-- functions `authenticated` reaches through PUBLIC, which is untidy but not an
-- anon exposure — §2 only clears PUBLIC where anon could still reach it.
--
-- This query counts REACHABILITY. It cannot tell you whether a POLICY helper is
-- still executable by `authenticated`, because that is a different question and
-- needs pg_policy to answer. That check lives in
-- `14_VERIFY_AND_FIX_policy_helper_grants.sql` §3, and its verdict must read
-- `PASS`. Run it after this file.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RE-CHECK FROM OUTSIDE — the catalogue is not the API
-- ─────────────────────────────────────────────────────────────────────────────
-- After running §1-§2, this must return 401 + `42501 permission denied` for
-- every function. (The key is public — it ships in the frontend bundle.)
--
--   curl -s -w '\nhttp:%{http_code}\n' -X POST \
--     "https://inyqjfgeecairaxbkxuo.supabase.co/rest/v1/rpc/current_user_role" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     -H 'Content-Type: application/json' -d '{}'
--
-- Read the SQLSTATE: `42501` is a denial. A 200 with `null`, or a 400/409 from
-- the function body, means it is STILL reachable.

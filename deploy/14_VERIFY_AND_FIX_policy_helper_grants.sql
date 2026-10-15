-- ═══════════════════════════════════════════════════════════════════════════
-- 14 — VERIFY + REPAIR: the helper functions that RLS POLICIES call
--
-- RUN THIS AFTER 13_HARDEN_.... Read §1's output; §2 is idempotent.
--
-- WHY THIS FILE EXISTS
--   `13_HARDEN_...` revoked EXECUTE from `anon` on every public function. That
--   is the right end state. But a function used INSIDE an RLS policy is a hidden
--   dependency, and revoking EXECUTE does not merely "close a door" — it changes
--   how a TABLE behaves for that role.
--
--   Proof, measured against the live project with the public anon key:
--
--     GET /rest/v1/training_programs   ->  200  [ ...real rows... ]
--     GET /rest/v1/bookings            ->  401  42501 permission denied for
--                                                 function current_company_id
--     GET /rest/v1/profiles            ->  401  42501 permission denied for
--                                                 function current_user_role
--
--   Before the hardening those tables returned `200 []` to anon, because anon
--   held EXECUTE through PUBLIC and the policy simply filtered every row out.
--   Now the policy itself cannot be evaluated, so the query errors instead.
--
--   FOR `anon` THAT IS THE INTENDED OUTCOME. Nothing a logged-out visitor does
--   touches those tables: every read in the client funnels through
--   src/lib/supabase.ts, and the only call that runs for a guest is
--   `fetchTrainingPrograms()` (store.tsx:838) — which still returns 200, because
--   its `USING (TRUE)` policy lets the planner short-circuit the sibling
--   admin policy before it ever calls current_user_role().
--
--   THE QUESTION THAT ACTUALLY MATTERS is the one this file answers:
--   did `authenticated` keep EXECUTE on the helpers every signed-in screen
--   depends on? If it did not, the entire portal is down, not just anon reads.
--
--   §2 makes it true either way. `GRANT EXECUTE` is idempotent, so running this
--   when nothing is broken changes nothing and prints "already fine".
--
-- Read-only apart from GRANTs. No row is inserted, updated or deleted.
-- The LAST result grid is the single verdict row in §3 — that is the one to read.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DETAIL — which public functions do policies call, and who can execute them
-- ─────────────────────────────────────────────────────────────────────────────
-- `in_policy` is derived from pg_policy, so it stays correct when someone adds
-- a policy tomorrow. `\m` / `\M` are word boundaries: without them, a function
-- named `user_role` would falsely match `current_user_role`.
SELECT
  p.proname                                                        AS function_name,
  used_in_policy                                                   AS in_policy,
  has_function_privilege('anon',          p.oid, 'EXECUTE')        AS anon_can,
  has_function_privilege('authenticated', p.oid, 'EXECUTE')        AS auth_can,
  has_function_privilege('service_role',  p.oid, 'EXECUTE')        AS svc_can,
  CASE
    WHEN used_in_policy AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
      THEN '*** BROKEN — a policy calls this but authenticated cannot execute it ***'
    WHEN used_in_policy
      THEN 'ok — policy helper, authenticated can execute'
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE')
      THEN 'review — anon can still execute this'
    ELSE 'ok'
  END                                                              AS verdict,
  coalesce(p.proacl::text, '(no explicit acl)')                    AS acl
FROM pg_proc p
JOIN pg_namespace ns ON ns.oid = p.pronamespace
CROSS JOIN LATERAL (
  SELECT EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c     ON c.oid  = pol.polrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    WHERE cn.nspname = 'public'
      AND (
        coalesce(pg_get_expr(pol.polqual,       pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
        OR
        coalesce(pg_get_expr(pol.polwithcheck,  pol.polrelid), '') ~ ('\m' || p.proname || '\M\s*\(')
      )
  ) AS used_in_policy
) d
WHERE ns.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY used_in_policy DESC, p.proname;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REPAIR — every policy helper must be executable by `authenticated`
-- ─────────────────────────────────────────────────────────────────────────────
-- Deliberately unconditional on the current ACL: it re-grants whether or not the
-- privilege is already there. That is what makes this safe to run twice, and
-- safe to run when you are not sure. `anon` is never granted here.
DO $$
DECLARE
  r       RECORD;
  n_total INT := 0;
  n_fixed INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prokind = 'f'
      AND EXISTS (
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
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',  r.sig);
    n_total := n_total + 1;

    IF r.auth_can THEN
      RAISE NOTICE 'already fine : %', r.sig;
    ELSE
      RAISE NOTICE 'REPAIRED     : %  (authenticated had NO execute — this was a live outage)', r.sig;
      n_fixed := n_fixed + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '--- section 2: % policy helper(s) checked, % actually repaired', n_total, n_fixed;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERDICT — the LAST result grid. This is the one to read.
-- ─────────────────────────────────────────────────────────────────────────────
-- broken_policy_helpers MUST be 0. anon_reachable_helpers MUST be 0.
-- total_public_functions is informational.
SELECT
  count(*) FILTER (
    WHERE used_in_policy
      AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )                                                              AS broken_policy_helpers,
  count(*) FILTER (
    WHERE used_in_policy
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  )                                                              AS anon_reachable_helpers,
  count(*)                                                       AS total_public_functions,
  CASE
    WHEN count(*) FILTER (
           WHERE used_in_policy
             AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
         ) = 0
     AND count(*) FILTER (
           WHERE used_in_policy
             AND has_function_privilege('anon', p.oid, 'EXECUTE')
         ) = 0
      THEN 'PASS — every policy helper is executable by authenticated, and by nobody else'
    ELSE 'FAIL — see the two counts; re-read section 1'
  END                                                            AS verdict
FROM pg_proc p
JOIN pg_namespace ns ON ns.oid = p.pronamespace
CROSS JOIN LATERAL (
  SELECT EXISTS (
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
) d
WHERE ns.nspname = 'public'
  AND p.prokind = 'f';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RE-CHECK FROM OUTSIDE — the catalogue is not the API
-- ─────────────────────────────────────────────────────────────────────────────
-- anon must still be refused (401 + 42501) on both helpers:
--
--   curl -s -w '\nhttp:%{http_code}\n' -X POST \
--     "https://inyqjfgeecairaxbkxuo.supabase.co/rest/v1/rpc/current_user_role" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--     -H 'Content-Type: application/json' -d '{}'
--
-- The guest-facing read must still work:
--
--   curl -s -o /dev/null -w '%{http_code}\n' \
--     "https://inyqjfgeecairaxbkxuo.supabase.co/rest/v1/training_programs?select=id&limit=1" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
-- And the one that proves the portals are alive — sign in to the live site and
-- confirm the dashboard lists bookings. That is an `authenticated` read, and it
-- is the only test that exercises the grant this file repairs.


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. OPTIONAL FOLLOW-UP — do not run yet, read first
-- ─────────────────────────────────────────────────────────────────────────────
-- The reason `training_programs` survives today is that PostgreSQL folds
-- `USING (TRUE)` to a constant and skips the sibling policy:
--
--   CREATE POLICY "training_programs: public read"  ... USING (TRUE);
--   CREATE POLICY "training_programs: admin write"  ... FOR ALL
--                                                       USING (current_user_role() = 'admin');
--
-- Permissive policies are OR'd, so `TRUE OR <anything>` is `TRUE`. Correct, but
-- it means a guest read depends on the planner noticing that, not on the grant.
-- If anyone edits the `public read` policy into something non-constant, guests
-- break with a 42501 that points at a function they have never heard of.
--
-- The durable fix is to scope staff-only policies to the role that needs them:
--
--   ALTER POLICY "training_programs: admin write" ON public.training_programs
--     TO authenticated;
--
-- Then anon never evaluates that expression at all, and the short-circuit stops
-- being load-bearing. The same pattern applies to every `FOR ALL` policy in
-- 001_initial_schema.sql. That is a separate change with its own verification —
-- do it on its own, not in the same sitting as this one.

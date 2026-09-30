-- ═════════════════════════════════════════════════════════════════════════════
--  008 — ADMIN ROLE MANAGEMENT
-- ═════════════════════════════════════════════════════════════════════════════
--
--  WHY THIS EXISTS
--
--  profiles.role is frozen against client writes (007 §2 column grants plus the
--  enforce_profile_column_privileges trigger). That is deliberate: it stops a
--  customer from promoting themselves to admin, or a cleaner from self-assigning
--  a company.
--
--  But it also means the admin dashboard has NO way to promote anyone. The
--  partnership approval flow in particular marks an application approved and
--  provisions a company record, yet the applicant stays role='customer'. They are
--  then bounced by <ProtectedRoute role="partner"> when they follow the
--  "you're approved" notification link. Approving a partner was a dead end.
--
--  This migration adds the missing server-verified path: an admin-only function
--  that changes a role.
--
--  DESIGN NOTES
--    • Granting 'admin' is refused. Minting another admin should be a deliberate
--      act in the Supabase dashboard — not a UI action that a mis-click, a stale
--      session, or a compromised admin account could trigger.
--    • An admin cannot change their own role, so they cannot accidentally lock
--      themselves out of the dashboard they are standing in.
--    • SECURITY DEFINER + an explicit caller-role check, matching the pattern of
--      admin_set_profile_company() in 007 §2b.
--
--  APPLIES TO
--    • Partner application approved  → role 'partner'
--    • Admin manually absorbing a trainee, or promoting any user → 'cleaner'
--
--  NOTE: training completion does NOT change a role. The training programme is
--  industry-wide skilling, not a hiring pipeline; the company decides separately
--  whether to absorb a trainee.
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role    public.user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  -- ── 1. Must be authenticated ───────────────────────────────────────────────
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  -- ── 2. Caller must be an admin ─────────────────────────────────────────────
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  -- ── 3. Validate input ──────────────────────────────────────────────────────
  IF p_user_id IS NULL OR p_role IS NULL THEN
    RAISE EXCEPTION 'user id and role are required' USING ERRCODE = '22023';
  END IF;

  -- ── 4. Never grant admin through this path ─────────────────────────────────
  IF p_role = 'admin' THEN
    RAISE EXCEPTION 'cannot grant the admin role through this function'
      USING ERRCODE = '42501';
  END IF;

  -- ── 5. Never let an admin change their own role ────────────────────────────
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot change your own role' USING ERRCODE = '42501';
  END IF;

  -- ── 6. Apply ───────────────────────────────────────────────────────────────
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for the given user id' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- ── Lock down execute: authenticated callers only, no PUBLIC ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, public.user_role) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, public.user_role) TO authenticated;
  END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
--  VERIFICATION — run these after applying
-- ═════════════════════════════════════════════════════════════════════════════
--
--  1. The function exists and is SECURITY DEFINER (prosecdef must be true):
--
--     SELECT proname, prosecdef
--     FROM pg_proc
--     WHERE proname = 'admin_set_user_role';
--
--  2. PUBLIC has no execute privilege on it:
--
--     SELECT has_function_privilege(
--       'public', 'public.admin_set_user_role(uuid, public.user_role)', 'EXECUTE'
--     ) AS public_can_execute;   -- expect: false
--
--  3. The authenticated role CAN execute it:
--
--     SELECT has_function_privilege(
--       'authenticated', 'public.admin_set_user_role(uuid, public.user_role)', 'EXECUTE'
--     ) AS auth_can_execute;     -- expect: true
-- ═════════════════════════════════════════════════════════════════════════════

-- ═════════════════════════════════════════════════════════════════════════════
-- FIX: 007 section 2 — pin_hash was still readable
--
-- WHY THE FIRST ATTEMPT FAILED
-- ────────────────────────────
-- The original 007 used:
--     REVOKE SELECT (pin_hash) ON public.profiles FROM authenticated;
--
-- This is silently a NO-OP. Supabase grants TABLE-level SELECT on every new
-- table in `public` to both `anon` and `authenticated`. In PostgreSQL a
-- table-level privilege takes precedence over a column-level REVOKE, so the
-- table-level SELECT kept covering pin_hash.
--
-- THE FIX
-- ───────
-- Drop the table-level privileges, then grant back only the client-safe columns
-- explicitly. pin_hash is deliberately absent from the read list and is not in
-- the writable list either.
--
-- Safe to run on its own — idempotent, and it does not touch anything else
-- from 007.
-- ═════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- Every profiles column the client may read. Explicit on purpose: a new
  -- sensitive column added later will NOT be exposed by accident.
  client_readable CONSTANT TEXT[] := ARRAY[
    'id', 'email', 'name', 'phone', 'role',
    'employee_id', 'assigned_zone_id',
    'company_id', 'company_code', 'permissions',
    'pin_created_at',
    'membership_tier', 'membership_status',
    'partner_application_id', 'avatar_url',
    'created_at', 'updated_at'
  ];
  -- Self-service write set. The section-3 trigger is the real enforcement.
  -- company_id is deliberately NOT here: it is admin-only, handled below.
  client_writable CONSTANT TEXT[] := ARRAY['name', 'phone', 'avatar_url'];
  col  TEXT;
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['authenticated', 'anon'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);

    -- 1. Remove the table-level grants that mask column rules.
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM %I', role_name);

    -- 2. Grant back only the safe columns, individually.
    FOREACH col IN ARRAY client_readable LOOP
      EXECUTE format('GRANT SELECT (%I) ON public.profiles TO %I', col, role_name);
    END LOOP;

    -- 3. anon gets no write access at all.
    IF role_name = 'authenticated' THEN
      FOREACH col IN ARRAY client_writable LOOP
        EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO %I', col, role_name);
      END LOOP;
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.profiles.pin_hash IS
  'Server-side only. Never expose to clients — table-level grants dropped and only safe columns re-granted in 007.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ADMIN-ONLY: tag a partner profile with its company
-- ─────────────────────────────────────────────────────────────────────────────
-- The client previously did this with a direct UPDATE on profiles.company_id
-- (see setProfileCompany in src/lib/supabase.ts). Once the column is frozen,
-- that write must move to a server-verified path.
--
-- This function keeps the admin dashboard working without re-opening the
-- column to self-service: it checks the caller's role before writing.
-- The table-level UPDATE grant is NOT restored — this is the only client
-- route into company_id.

CREATE OR REPLACE FUNCTION public.admin_set_profile_company(p_user_id UUID, p_company_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_company_id IS NULL THEN
    RAISE EXCEPTION 'user id and company id are required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET company_id = p_company_id
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for the given user id' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.admin_set_profile_company(UUID, TEXT) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.admin_set_profile_company(UUID, TEXT) TO authenticated;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — run this right after. Expect exactly these four values:
--   auth_pin = false    (customer CANNOT read the hash)
--   anon_pin = false    (logged-out visitor CANNOT read the hash)
--   auth_name = true    (normal profile reads still work)
--   auth_table = false  (no table-wide SELECT anymore)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  has_column_privilege('authenticated','public.profiles','pin_hash','SELECT') AS auth_pin,
  has_column_privilege('anon',         'public.profiles','pin_hash','SELECT') AS anon_pin,
  has_column_privilege('authenticated','public.profiles','name',    'SELECT') AS auth_name,
  has_table_privilege ('authenticated','public.profiles','SELECT')            AS auth_table;

-- ═════════════════════════════════════════════════════════════════════════════
-- IF auth_name COMES BACK false
-- ─────────────────────────────────────────────────────────────────────────────
-- That means a column name in the list above is misspelled or missing from the
-- table. Repair it with:
--
--   ALTER TABLE public.profiles ALTER COLUMN <the_column> SET DEFAULT '';
--
-- (or simply re-run this file after fixing the name). To see the real columns:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='profiles' ORDER BY ordinal_position;
--
-- To re-grant everything EXCEPT pin_hash in one statement instead:
--
--   GRANT SELECT (id, email, name, phone, role, employee_id, assigned_zone_id,
--                 company_id, company_code, permissions, pin_created_at,
--                 membership_tier, membership_status, partner_application_id,
--                 avatar_url, created_at, updated_at)
--      ON public.profiles TO authenticated, anon;
--
-- ROLLBACK (restores the insecure original — do not use in production):
--
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, anon;
-- ═════════════════════════════════════════════════════════════════════════════

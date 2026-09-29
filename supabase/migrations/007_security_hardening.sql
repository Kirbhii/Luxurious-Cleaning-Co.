-- ═════════════════════════════════════════════════════════════════════════════
-- 007_security_hardening.sql
--
-- Closes the privilege-escalation and PII-exposure gaps found in the security
-- review. Every section is idempotent and re-runnable.
--
--  1. profiles.pin_hash  — removed from the client-readable surface; privileged
--                          columns frozen against client UPDATE (stops a customer
--                          self-upgrading to Gold, or self-assigning a company)
--  2. PIN storage        — server-side bcrypt instead of client-side bare SHA-256
--  3. resumes bucket     — was public with unrestricted SELECT, exposing applicant
--                          PII; now private with owner+admin access only
--  4. membership         — activation goes through a server-authoritative function
--                          instead of trusting the client
--
-- Run with:  supabase db push     (CLI)  — or paste into the Supabase SQL Editor.
-- For the SQL Editor path, use 007_sql_editor.sql (self-contained, no CLI).
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensions & preflight
-- ─────────────────────────────────────────────────────────────────────────────

-- gen_random_bytes / digest / crypt come from pgcrypto (already required by the
-- gen_random_uuid() defaults in 001). Supabase installs it in the `extensions`
-- schema, so all calls below are schema-qualified.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Repair: make the existing RLS helper functions explicitly grantable
-- ─────────────────────────────────────────────────────────────────────────────
-- 001 created current_user_role() / current_company_id() but never granted
-- EXECUTE. They currently work only because PostgreSQL's default grants EXECUTE
-- on new functions to PUBLIC. If that default is ever tightened (or the
-- functions are recreated), EVERY RLS policy in the schema silently starts
-- failing closed — all users lose access to their own data. Pin it explicitly.

GRANT EXECUTE ON FUNCTION public.current_user_role()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id()    TO authenticated;

-- These read the caller's own row only; anon has no meaningful use for them.
REVOKE EXECUTE ON FUNCTION public.current_user_role()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_company_id()   FROM anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles — stop leaking pin_hash
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS is row-level, not column-level: a `FOR UPDATE USING (id = auth.uid())`
-- policy grants every column on that row. So the sensitive column has to be
-- closed at the SQL privilege layer.
--
-- ⚠ IMPORTANT — column REVOKE alone does NOT work here.
-- Supabase grants table-level SELECT/INSERT/UPDATE/DELETE on every new table in
-- `public` to BOTH `anon` and `authenticated`. In PostgreSQL a table-level
-- privilege wins over a column-level REVOKE, so
--     REVOKE SELECT (pin_hash) ON public.profiles FROM authenticated;
-- is silently a no-op: the table-level SELECT still covers every column.
--
-- The working pattern is to drop the table-level privilege first, then grant
-- back only the client-safe columns explicitly.
--
-- Client-safe columns (read): everything EXCEPT pin_hash.
-- Client-safe columns (write): name, phone, avatar_url only — the rest are also
--   frozen by the trigger in section 3, which is what actually enforces it.
-- INSERT is not granted at all: profiles rows are created by the
--   handle_new_user() trigger as SECURITY DEFINER, never by a client.
-- `service_role` keeps full access (edge functions / admin API).

DO $$
DECLARE
  -- Every profiles column the client is allowed to read. Kept explicit so that
  -- adding a new sensitive column later does NOT silently expose it.
  client_readable CONSTANT TEXT[] := ARRAY[
    'id', 'email', 'name', 'phone', 'role',
    'employee_id', 'assigned_zone_id',
    'company_id', 'company_code', 'permissions',
    'pin_created_at',
    'membership_tier', 'membership_status',
    'partner_application_id', 'avatar_url',
    'created_at', 'updated_at'
  ];
  client_writable CONSTANT TEXT[] := ARRAY['name', 'phone', 'avatar_url'];
  -- NOTE: company_id is deliberately NOT in client_writable. It is admin-only,
  -- and is written through admin_set_profile_company() defined below.
  col  TEXT;
  role_name TEXT;
BEGIN
  FOR role_name IN
    SELECT unnest(ARRAY['authenticated', 'anon'])
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);

    -- 1. Drop the table-level privileges that would otherwise mask column rules.
    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM %I', role_name);

    -- 2. Grant back only the safe columns, one at a time.
    FOREACH col IN ARRAY client_readable LOOP
      EXECUTE format('GRANT SELECT (%I) ON public.profiles TO %I', col, role_name);
    END LOOP;

    -- 3. anon should never be able to write a profile; authenticated gets the
    --    narrow self-service set. The section-3 trigger is the real guard.
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
-- 2b. ADMIN-ONLY: tag a partner profile with its company
-- ─────────────────────────────────────────────────────────────────────────────
-- The admin dashboard previously wrote profiles.company_id with a direct client
-- UPDATE (see setProfileCompany in src/lib/supabase.ts). Once company_id is
-- frozen, that write must move to a server-verified path. This keeps the
-- dashboard working WITHOUT leaving company_id writable by every user — which
-- is what previously let a partner self-assign an arbitrary company.

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

  UPDATE public.profiles SET company_id = p_company_id WHERE id = p_user_id;

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
-- 3. profiles — freeze privilege-bearing columns
-- ─────────────────────────────────────────────────────────────────────────────
-- A customer can otherwise UPDATE their own row's membership_tier /
-- membership_status and self-upgrade to Gold (losing real revenue). A cleaner
-- could self-assign a company. RLS cannot express this, so use a trigger.
--
-- Allowed for self-service (authenticated, non-admin): name, phone, avatar_url.
-- Everything else must come from a server path (service_role / admin).

CREATE OR REPLACE FUNCTION public.enforce_profile_column_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Detect a trusted server call. service_role connections do NOT carry JWT
  -- claims, so checking request.jwt.claims alone always returns false — use
  -- the effective Postgres role, which PostgREST/supabase-js do set correctly.
  is_trusted_role BOOLEAN := (current_user IN ('service_role', 'supabase_admin', 'postgres'));
  is_admin BOOLEAN;
BEGIN
  IF is_trusted_role THEN
    RETURN NEW;
  END IF;

  -- current_user_role() is SECURITY DEFINER and reads auth.uid(); guard against
  -- a NULL uid (e.g. an anon connection) so the comparison can't error.
  BEGIN
    is_admin := (public.current_user_role() = 'admin');
  EXCEPTION WHEN OTHERS THEN
    is_admin := FALSE;
  END;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Silently restore privileged columns rather than raising: several callers
  -- echo the whole row back on a legitimate update, and an exception would
  -- break those flows. A crafted request simply has no effect on these fields.
  NEW.role                   := OLD.role;
  NEW.membership_tier        := OLD.membership_tier;
  NEW.membership_status      := OLD.membership_status;
  NEW.permissions            := OLD.permissions;
  NEW.employee_id            := OLD.employee_id;
  NEW.assigned_zone_id       := OLD.assigned_zone_id;
  NEW.company_id             := OLD.company_id;
  NEW.company_code           := OLD.company_code;
  NEW.pin_hash               := OLD.pin_hash;
  NEW.pin_created_at         := OLD.pin_created_at;
  NEW.partner_application_id := OLD.partner_application_id;
  NEW.email                  := OLD.email;
  NEW.created_at             := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_column_privileges ON public.profiles;
CREATE TRIGGER profiles_enforce_column_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_column_privileges();

-- Keep updated_at honest regardless of which columns changed.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PIN storage — server-side bcrypt
-- ─────────────────────────────────────────────────────────────────────────────
-- The previous implementation hashed a 4-6 digit PIN with bare SHA-256 in the
-- BROWSER. A 4-6 digit PIN is a 10k-1M candidate space and SHA-256 runs at
-- millions/sec, so a stolen hash is inverted in well under a second. It also
-- meant the hash had to be shipped to the client to compare.
--
-- Now: bcrypt (per-row salt, deliberately slow) computed in the database, and
-- pin_hash is not readable by clients at all (section 2).

CREATE OR REPLACE FUNCTION public.set_user_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10)),
         pin_created_at = NOW()
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for this user' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_user_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT pin_hash INTO stored FROM public.profiles WHERE id = auth.uid();

  IF stored IS NULL OR stored = '' THEN
    RETURN FALSE;
  END IF;

  -- bcrypt format ($2a/$2b/$2y) for PINs set after this migration; legacy bare
  -- sha256 hex for PINs set before it, so existing users keep working.
  IF stored LIKE '$2%' THEN
    RETURN stored = extensions.crypt(p_pin, stored);
  ELSE
    RETURN stored = encode(extensions.digest(p_pin, 'sha256'), 'hex');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_user_pin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pin_hash IS NOT NULL AND pin_hash <> ''
       FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.set_user_pin(TEXT)    FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.verify_user_pin(TEXT) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.has_user_pin()        FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION public.set_user_pin(TEXT)    TO authenticated;
    GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_user_pin()        TO authenticated;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. resumes bucket — was public; make it private
-- ─────────────────────────────────────────────────────────────────────────────
-- Applicant resumes are PII (name, address, phone, work history). A public
-- bucket means anyone with the URL gets the file, and URLs leak via browser
-- history, logs and chat. Under the Philippine Data Privacy Act (RA 10173)
-- this is a reportable exposure.

UPDATE storage.buckets SET public = FALSE WHERE id = 'resumes';

-- Blanket public read → uploader or admin only.
DROP POLICY IF EXISTS "resumes: public read" ON storage.objects;

DROP POLICY IF EXISTS "resumes: owner or admin read" ON storage.objects;
CREATE POLICY "resumes: owner or admin read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (
      -- Path layout is <userId>/<file>, so the first folder segment is the owner.
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.current_user_role() = 'admin'
    )
  );

-- Previously ANY authenticated user could write to ANY path in the bucket.
DROP POLICY IF EXISTS "resumes: authenticated upload" ON storage.objects;
CREATE POLICY "resumes: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Membership — server-authoritative activation
-- ─────────────────────────────────────────────────────────────────────────────
-- With section 3 in place, clients can no longer write membership_* directly,
-- so self-service activation moves behind a SECURITY DEFINER function.
--
-- IMPORTANT — this is still self-service, NOT payment-verified. Anyone who can
-- click "Gold" gets Gold. When a payment processor is wired in (Stripe /
-- PayMongo), replace the body of activate_own_membership with a real
-- entitlement check, or drive it from the provider webhook via service_role
-- (which bypasses the trigger).

CREATE OR REPLACE FUNCTION public.activate_own_membership(p_tier public.membership_tier)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_tier IS NULL THEN
    RAISE EXCEPTION 'tier is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
     SET membership_tier = p_tier,
         membership_status = 'active'
   WHERE id = auth.uid()
     AND role = 'customer';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no customer profile for this user' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_own_membership()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET membership_tier = NULL,
         membership_status = 'none'
   WHERE id = auth.uid();
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.activate_own_membership(public.membership_tier) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.cancel_own_membership() FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION public.activate_own_membership(public.membership_tier) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.cancel_own_membership() TO authenticated;
  END IF;
END $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Verification (run these after applying; each returns the expected value)
--
--   -- 1. pin_hash must NOT be readable by the client roles.
--   --    NOTE: use has_column_privilege(), NOT information_schema.column_privileges.
--   --    The information_schema view legitimately reports a column privilege when
--   --    the role holds a TABLE-level grant, so it returns a false positive here.
--   SELECT
--     has_column_privilege('authenticated','public.profiles','pin_hash','SELECT') AS auth_pin,
--     has_column_privilege('anon',         'public.profiles','pin_hash','SELECT') AS anon_pin,
--     has_column_privilege('authenticated','public.profiles','name',    'SELECT') AS auth_name,
--     has_table_privilege ('authenticated','public.profiles','SELECT')            AS auth_table;
--   -- expect: auth_pin=false, anon_pin=false, auth_name=true, auth_table=false
--
--   -- 2. resumes bucket must be private:
--   SELECT public FROM storage.buckets WHERE id = 'resumes';
--   -- expect f
--
--   -- 3. both triggers exist:
--   SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
--   -- expect profiles_enforce_column_privileges, profiles_touch_updated_at
--
--   -- 4. the six RPCs exist and are executable:
--   SELECT proname, proacl IS NOT NULL AS has_acl
--     FROM pg_proc
--    WHERE proname IN ('set_user_pin','verify_user_pin','has_user_pin',
--                      'activate_own_membership','cancel_own_membership',
--                      'admin_set_profile_company');
--   -- expect 6 rows
-- ═════════════════════════════════════════════════════════════════════════════

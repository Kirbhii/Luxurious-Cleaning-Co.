-- ─── Migration 010 — PIN lockout + PIN-change verification ──────────────────
--
-- Closes three holes that would otherwise make the PIN decorative, plus a
-- fourth introduced by the fix itself.
--
--   Hole A — a locked-out user could clear their own lockout by writing
--            pin_locked_until = NULL. Closed by keeping the two lockout columns
--            out of the client-granted column set (migration 007 §2 pattern).
--
--   Hole B — set_user_pin() was `WHERE id = auth.uid()` only, so anyone holding
--            an open session could install a fresh PIN and walk through the gate
--            it was meant to enforce. Closed by requiring the current PIN
--            whenever one already exists.
--
--   Hole D — and if no PIN existed yet, Hole B's fix proved nothing, because
--            there was no old PIN to ask for. An attacker holding an unattended
--            session could simply create the first PIN and then use it. Closed
--            by requiring the account PASSWORD for first-time setup, checked
--            server-side against auth.users.encrypted_password — inlined into
--            set_user_pin() rather than exposed as its own function, see §6.
--
--   Hole C — CREATE OR REPLACE with a changed signature does NOT replace: it
--            creates an OVERLOAD and leaves the old function callable, which
--            would silently bypass B and D. The older signatures are DROPPED
--            below, and the verification asserts only one remains.
--
-- So the rule is: setting a PIN always requires proving something the session
-- alone does not carry — the current PIN if one exists, the account password
-- if none does.
--
-- Also adds pin_lock_status() so the UI can show a countdown WITHOUT submitting
-- a PIN (submitting one just to discover the lock would burn an attempt).
--
-- ⚠ GRANT/REVOKE note that bit us once already (see §7): Supabase ships
--   ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated,
--   service_role, so EVERY newly created function in `public` carries a DIRECT
--   grant to those roles. A `REVOKE ... FROM PUBLIC` does NOT remove a direct
--   role grant — the roles have to be named explicitly. This is the same shape
--   as migration 007 §2, where a table-level GRANT beat a column-level REVOKE.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Lockout state columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_pin_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until    TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.failed_pin_attempts IS
  'Consecutive wrong-PIN attempts. Server-side only — never granted to clients.';
COMMENT ON COLUMN public.profiles.pin_locked_until IS
  'PIN rejected (even when correct) until this timestamp. Server-side only — never granted to clients.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Re-assert the client column privileges (Hole A)
-- ─────────────────────────────────────────────────────────────────────────────
-- Same list as 007 §2. The two new columns are deliberately ABSENT from both
-- arrays, so they are not readable and not writable by the client.
--
-- The table-level privileges are dropped first because in PostgreSQL a
-- table-level GRANT beats a column-level REVOKE (007 §2 explains this at
-- length). Re-running the whole block is idempotent and guarantees the state
-- even if something re-granted table access in the meantime.

DO $$
DECLARE
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
  col  TEXT;
  role_name TEXT;
BEGIN
  FOR role_name IN
    SELECT unnest(ARRAY['authenticated', 'anon'])
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);

    EXECUTE format('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM %I', role_name);

    FOREACH col IN ARRAY client_readable LOOP
      EXECUTE format('GRANT SELECT (%I) ON public.profiles TO %I', col, role_name);
    END LOOP;

    IF role_name = 'authenticated' THEN
      FOREACH col IN ARRAY client_writable LOOP
        EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO %I', col, role_name);
      END LOOP;
    END IF;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Extend the freeze trigger to cover the new columns (defence in depth)
-- ─────────────────────────────────────────────────────────────────────────────
-- The column privileges above are the real guard. This trigger is the second
-- layer: it silently restores privileged columns on a client UPDATE. Note the
-- trusted-role early return — SECURITY DEFINER functions run as `postgres`, so
-- verify_user_pin() and set_user_pin() are NOT affected by this.

CREATE OR REPLACE FUNCTION public.enforce_profile_column_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_trusted_role BOOLEAN := (current_user IN ('service_role', 'supabase_admin', 'postgres'));
  is_admin BOOLEAN;
BEGIN
  IF is_trusted_role THEN
    RETURN NEW;
  END IF;

  BEGIN
    is_admin := (public.current_user_role() = 'admin');
  EXCEPTION WHEN OTHERS THEN
    is_admin := FALSE;
  END;

  IF is_admin THEN
    RETURN NEW;
  END IF;

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
  -- added by 010
  NEW.failed_pin_attempts    := OLD.failed_pin_attempts;
  NEW.pin_locked_until       := OLD.pin_locked_until;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. verify_user_pin() — with lockout
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  stored       TEXT;
  locked_until TIMESTAMPTZ;
  attempts     INT;
  ok           BOOLEAN;
  max_attempts CONSTANT INT := 5;
  lock_minutes CONSTANT INT := 15;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT pin_hash, pin_locked_until, failed_pin_attempts
    INTO stored, locked_until, attempts
  FROM public.profiles WHERE id = auth.uid();

  -- While locked, even the CORRECT PIN is rejected. That is the point.
  IF locked_until IS NOT NULL AND locked_until > NOW() THEN
    RETURN FALSE;
  END IF;

  IF stored IS NULL OR stored = '' THEN
    RETURN FALSE;
  END IF;

  -- bcrypt for PINs set after 007; legacy bare sha256 hex for older ones.
  IF stored LIKE '$2%' THEN
    ok := (stored = extensions.crypt(p_pin, stored));
  ELSE
    ok := (stored = encode(extensions.digest(p_pin, 'sha256'), 'hex'));
  END IF;

  IF ok THEN
    UPDATE public.profiles
       SET failed_pin_attempts = 0,
           pin_locked_until    = NULL
     WHERE id = auth.uid();
    RETURN TRUE;
  END IF;

  -- Wrong PIN: count it, lock at the threshold.
  attempts := COALESCE(attempts, 0) + 1;

  IF attempts >= max_attempts THEN
    UPDATE public.profiles
       SET failed_pin_attempts = attempts,
           pin_locked_until    = NOW() + make_interval(mins => lock_minutes)
     WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles
       SET failed_pin_attempts = attempts
     WHERE id = auth.uid();
  END IF;

  RETURN FALSE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pin_lock_status() — let the UI explain the lock without burning an attempt
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pin_lock_status()
RETURNS TABLE (
  has_pin           BOOLEAN,
  is_locked         BOOLEAN,
  seconds_remaining INT,
  attempts_left     INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_attempts CONSTANT INT := 5;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (p.pin_hash IS NOT NULL AND p.pin_hash <> ''),
    (p.pin_locked_until IS NOT NULL AND p.pin_locked_until > NOW()),
    GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (p.pin_locked_until - NOW()))::INT, 0)),
    GREATEST(0, max_attempts - COALESCE(p.failed_pin_attempts, 0))
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. set_user_pin() — prove something beyond the session, always
-- ─────────────────────────────────────────────────────────────────────────────
-- Hole D: a staff member who had never set a PIN could have one installed by
-- anyone holding their open session — no proof required, because there was no
-- existing PIN to prove. That attacker then holds the key to every gated
-- action, which is precisely the threat the PIN exists to stop.
--
-- The fix is to require the account PASSWORD for first-time setup, checked
-- server-side against auth.users.encrypted_password, never in the browser.
--
-- ⚠ This was first written as a separate public.verify_own_password() helper.
--   That helper was verifiably callable by `authenticated` even after a
--   REVOKE ... FROM PUBLIC, because Supabase's default privileges grant EXECUTE
--   DIRECTLY to the role (see §7). That made it a free, unthrottled password
--   oracle for the caller's own account. The comparison is inlined here instead:
--   the most reliable way to make something uncallable is to not have it.
--
-- ⚠ Hole C: DROP the older signatures FIRST. CREATE OR REPLACE with a different
-- argument list creates an OVERLOAD rather than replacing, so leaving either
-- older version in place would keep a working bypass of Hole B or Hole D.
DROP FUNCTION IF EXISTS public.set_user_pin(TEXT);
DROP FUNCTION IF EXISTS public.set_user_pin(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.verify_own_password(TEXT);

CREATE OR REPLACE FUNCTION public.set_user_pin(
  p_new_pin     TEXT,
  p_current_pin TEXT DEFAULT NULL,   -- required when a PIN already exists
  p_password    TEXT DEFAULT NULL    -- required when setting the FIRST PIN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  existing     TEXT;
  locked_until TIMESTAMPTZ;
  mins_left    INT;
  enc          TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_new_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits' USING ERRCODE = '22023';
  END IF;

  SELECT pin_hash, pin_locked_until
    INTO existing, locked_until
  FROM public.profiles WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no profile for this user' USING ERRCODE = '42501';
  END IF;

  IF locked_until IS NOT NULL AND locked_until > NOW() THEN
    mins_left := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - NOW())) / 60)::INT);
    RAISE EXCEPTION 'PIN is locked. Try again in % minute(s).', mins_left
      USING ERRCODE = '42501';
  END IF;

  IF existing IS NOT NULL AND existing <> '' THEN
    -- Hole B: an existing PIN may only be replaced by someone who knows it.
    -- Without this, any open session could install a fresh PIN and walk
    -- through the gate it was meant to enforce.
    IF p_current_pin IS NULL OR p_current_pin = '' THEN
      RAISE EXCEPTION 'current PIN is required to change the PIN' USING ERRCODE = '42501';
    END IF;
    IF NOT public.verify_user_pin(p_current_pin) THEN
      RAISE EXCEPTION 'current PIN is incorrect' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Hole D: first-time setup still has to prove identity beyond the session,
    -- or an attacker holding an open session simply installs their own PIN.
    IF p_password IS NULL OR p_password = '' THEN
      RAISE EXCEPTION 'your account password is required to create a PIN' USING ERRCODE = '42501';
    END IF;

    SELECT u.encrypted_password INTO enc
    FROM auth.users u
    WHERE u.id = auth.uid();

    IF enc IS NULL OR enc = '' OR enc <> extensions.crypt(p_password, enc) THEN
      RAISE EXCEPTION 'account password is incorrect' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Setting a new PIN clears the lockout: the caller has just proven the old
  -- PIN, or their password.
  UPDATE public.profiles
     SET pin_hash            = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 10)),
         pin_created_at      = NOW(),
         failed_pin_attempts = 0,
         pin_locked_until    = NULL
   WHERE id = auth.uid();
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Grants
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ TWO separate things go wrong here, and both did.
--
-- (1) The argument list must match the CURRENT signature exactly. §6 just
--     dropped set_user_pin(TEXT) and set_user_pin(TEXT, TEXT), so naming either
--     of those would abort with 42883 "function does not exist" — and a REVOKE
--     that never ran leaves the privilege in place.
--
-- (2) REVOKE ... FROM PUBLIC IS NOT ENOUGH. Supabase ships
--     ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon,
--     authenticated, service_role, so every newly created function in `public`
--     carries a DIRECT grant to those roles. Revoking from PUBLIC does not
--     touch a direct role grant — the roles must be named explicitly. Same
--     shape as migration 007 §2, where a table-level GRANT beat a column-level
--     REVOKE.
--
--     This is not theoretical. The first version of this migration shipped
--     verify_own_password() with only a REVOKE FROM PUBLIC, and the V4 check
--     below caught that `authenticated` could still call it directly — a free,
--     unthrottled password oracle for the caller's own account. Hole D is now
--     inlined into set_user_pin() (§6) and that function is dropped, so there is
--     nothing left to mis-grant. V4 asserts it stays gone.
--
-- service_role is deliberately left alone — it is the trusted server role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.set_user_pin(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.verify_user_pin(TEXT)          FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.has_user_pin()                 FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON FUNCTION public.pin_lock_status()              FROM PUBLIC, anon, authenticated;

    GRANT EXECUTE ON FUNCTION public.set_user_pin(TEXT, TEXT, TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.verify_user_pin(TEXT)          TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_user_pin()                 TO authenticated;
    GRANT EXECUTE ON FUNCTION public.pin_lock_status()              TO authenticated;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Verification
-- ─────────────────────────────────────────────────────────────────────────────

-- V1 — one row. Expect: cols_ok = 2, trigger_ok = true, lock_columns_locked = true,
--      and set_user_pin_overloads = 1 (NOT 2 — see Hole C).
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND column_name IN ('failed_pin_attempts','pin_locked_until'))      AS cols_ok,
  (SELECT position('failed_pin_attempts' IN pg_get_functiondef(oid)) > 0
     FROM pg_proc WHERE proname = 'enforce_profile_column_privileges')    AS trigger_ok,
  (NOT has_column_privilege('authenticated','public.profiles','failed_pin_attempts','UPDATE')
   AND NOT has_column_privilege('authenticated','public.profiles','pin_locked_until','UPDATE')
   AND NOT has_column_privilege('authenticated','public.profiles','failed_pin_attempts','SELECT')
   AND NOT has_column_privilege('authenticated','public.profiles','pin_locked_until','SELECT')) AS lock_columns_locked,
  (SELECT count(*) FROM pg_proc WHERE proname = 'set_user_pin')          AS set_user_pin_overloads;

-- V2 — every PIN function, its signature and security posture.
--   Expect exactly FOUR rows: set_user_pin has THREE args, and all four are
--   SECURITY DEFINER. verify_own_password must NOT appear — it is inlined (§6).
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef                               AS security_definer
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('set_user_pin','verify_user_pin','has_user_pin','pin_lock_status')
ORDER BY p.proname;

-- V3 — the client-safe read set is intact (nothing accidentally lost).
--   Expect: pin_hash = false, name/phone/email = true.
SELECT
  has_column_privilege('authenticated','public.profiles','pin_hash','SELECT') AS can_read_pin_hash,
  has_column_privilege('authenticated','public.profiles','name','SELECT')     AS can_read_name,
  has_column_privilege('authenticated','public.profiles','phone','SELECT')    AS can_read_phone,
  has_column_privilege('authenticated','public.profiles','name','UPDATE')     AS can_write_name;

-- V4 — the full client-facing posture: every function, BOTH client roles.
--   Expect: auth_* = true  (the signed-in client needs all four)
--           anon_* = false (a logged-out caller has no business here)
--           verify_own_password_exists = 0
--
--   This is the check that caught the original defect: the first version had
--   auth_check_password = true, because a REVOKE FROM PUBLIC does not remove
--   Supabase's direct default grant to `authenticated`.
SELECT
  has_function_privilege('authenticated','public.set_user_pin(text,text,text)','EXECUTE') AS auth_set_pin,
  has_function_privilege('authenticated','public.verify_user_pin(text)','EXECUTE')        AS auth_verify_pin,
  has_function_privilege('authenticated','public.has_user_pin()','EXECUTE')               AS auth_has_pin,
  has_function_privilege('authenticated','public.pin_lock_status()','EXECUTE')            AS auth_lock_status,
  has_function_privilege('anon','public.set_user_pin(text,text,text)','EXECUTE')          AS anon_set_pin,
  has_function_privilege('anon','public.verify_user_pin(text)','EXECUTE')                 AS anon_verify_pin,
  has_function_privilege('anon','public.has_user_pin()','EXECUTE')                        AS anon_has_pin,
  has_function_privilege('anon','public.pin_lock_status()','EXECUTE')                     AS anon_lock_status,
  (SELECT count(*) FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'verify_own_password')                                               AS verify_own_password_exists;

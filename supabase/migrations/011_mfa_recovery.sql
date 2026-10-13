-- ─── Migration 011 — MFA recovery codes ─────────────────────────────────────
--
-- Closes P0 #1 of the Oct 6 audit: nothing in src/ handles a lost authenticator.
--
-- THE HOLE
--   A staff member enrolls TOTP, then loses their phone. They can never reach
--   aal2, so the login guard holds them at /login — and the Security tab, where
--   they could turn the factor off, is behind that same guard. The lockout is
--   complete and self-sustaining. Today recovery is service-role SQL, run by
--   hand, by the one person who may be the one locked out.
--
-- THE INVARIANT WE REUSE (do not "improve" this away)
--   verifiedTotpFactor() counts ONLY status === 'verified', and
--   mfaStepUpRequired() returns required: factorId !== null. So a factor that is
--   no longer verified stops being owed, and beginEnrollment() already deletes
--   leftover unverified factors before a fresh enroll. The re-enrollment path
--   therefore already exists. A recovery code does not need a new flow — it needs
--   to make the old factor stop counting, once, for the person holding the code.
--
-- THE SECURITY MODEL
--   A recovery code is NOT a login credential. Redeeming one creates no session
--   and returns no token; it only REMOVES the second factor.
--       password alone            -> denied (factor owed)
--       recovery code alone       -> nothing at all
--       password + recovery code  -> account access
--   That is why the redemption endpoint may be UNAUTHENTICATED: by definition
--   the caller cannot log in, which is why they are calling.
--
-- WHY BCRYPT AND NOT sha256
--   ~50 bits of entropy. A plain sha256 is brute-forceable offline in hours on
--   one GPU if the hash leaks. crypt(..., gen_salt('bf', 10)) costs ~60-100ms
--   per guess instead of ~1us — a factor of ~10^5. Hashes are therefore not
--   comparable across rows, so there is deliberately no UNIQUE on code_hash.
--
-- WHY TWO FUNCTIONS AND NOT ONE
--   The factor is deleted by the edge function through the GoTrue Admin API,
--   AFTER the database has spoken. A single "verify + consume + burn the rest"
--   function would burn every code before that deletion was known to have
--   worked — so a failure in between would leave the user locked out with zero
--   codes left, which is precisely the state this migration exists to remove.
--   Splitting it makes the invariant crisp:
--
--       codes are burned only after the factor is confirmed gone.
--
--   verify_mfa_recovery_code() answers "is this code valid?" and never consumes.
--   consume_mfa_recovery_codes() burns everything, and is called only once the
--   factor has been confirmed absent.
--
-- ⚠ GRANT/REVOKE note — the trap cuts BOTH ways, and the second direction is the
--   one that actually bit this migration:
--     (1) Supabase ships ALTER DEFAULT PRIVILEGES ... GRANT ALL ON
--         TABLES/FUNCTIONS TO anon, authenticated, service_role. So
--         REVOKE ... FROM PUBLIC does NOT remove a DIRECT role grant — the roles
--         must be named explicitly.
--     (2) ...and conversely, naming the roles does NOT remove the grant to
--         PUBLIC. PostgreSQL grants EXECUTE to PUBLIC by default on every new
--         function. Both a named revoke AND `FROM PUBLIC` are required. §9 had
--         only the first, so every function stayed anon-callable.
--   Tables survive (1) and (2) because RLS with zero policies denies everything
--   regardless of grants. Functions have no such backstop.
--
-- ⚠ auth.jwt() and the SQL Editor: the editor runs as `postgres` with no request
--   claims, so replace_mfa_recovery_codes() raises "must be verified" there.
--   That is correct behaviour, not a bug.


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Recovery codes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- crypt(code, gen_salt('bf', 10)) — the salt is embedded in the string.
  code_hash  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = unused. Set when consumed. A used code can never be used again.
  used_at    TIMESTAMPTZ
);

COMMENT ON TABLE  public.mfa_recovery_codes IS
  'One-time MFA recovery codes, bcrypt-hashed. Never readable by any client role — see mfa_recovery_status() for the only exposed view.';
COMMENT ON COLUMN public.mfa_recovery_codes.code_hash IS
  'crypt(code, gen_salt(''bf'', 10)). The plaintext code is shown once and never stored.';
COMMENT ON COLUMN public.mfa_recovery_codes.used_at IS
  'NULL while unused. Single-use: set on consumption, never cleared.';

CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_unused_idx
  ON public.mfa_recovery_codes (user_id)
  WHERE used_at IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Redemption attempts — the rate limit
-- ─────────────────────────────────────────────────────────────────────────────
-- The redemption endpoint is unauthenticated, so this is the only place an
-- anonymous caller can spend guesses against a secret. ~50 bits makes an online
-- brute force hopeless, but "hopeless" is not "not attempted", and an
-- unthrottled endpoint is a free way to hammer the auth server.
--
-- We store the resolved user_id and NEVER the raw submitted code.
CREATE TABLE IF NOT EXISTS public.mfa_recovery_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  -- NULL is reserved for "the email matched no account". We deliberately do not
  -- insert those: there is no code to guess against, and the only cost to the
  -- caller is the single dummy bcrypt that equalises response timing.
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  succeeded    BOOLEAN     NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_recovery_attempts IS
  'Failed/successful redemption attempts, for rate limiting an unauthenticated endpoint. Never stores a submitted code.';

CREATE INDEX IF NOT EXISTS mfa_recovery_attempts_user_time_idx
  ON public.mfa_recovery_attempts (user_id, attempted_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Lock both tables to clients
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS on with NO policies = deny by default. The SECURITY DEFINER functions run
-- as the table owner and the edge function uses service_role; both bypass RLS.
ALTER TABLE public.mfa_recovery_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recovery_attempts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOR role_name IN SELECT unnest(ARRAY['anon', 'authenticated'])
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);
    EXECUTE format(
      'REVOKE ALL ON public.mfa_recovery_codes, public.mfa_recovery_attempts FROM %I',
      role_name
    );
  END LOOP;
END $$;

-- No policies are created, deliberately. If a future migration adds one, it must
-- be a deliberate, reviewed act — not an accident.


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Mint / rotate codes — replace_mfa_recovery_codes(text[])
-- ─────────────────────────────────────────────────────────────────────────────
-- Called by the client from the Security tab, right after enrollment is
-- confirmed and whenever the user regenerates.
--
-- The client generates the plaintext (CSPRNG) and displays it once. The
-- plaintext travels here over TLS and is hashed here; it is never stored and
-- never returned.
--
-- Requires aal2: you may only mint recovery while you are holding the second
-- factor you are minting recovery FOR, or a stolen aal1 session could quietly
-- install its own way back in. This is also the first place in this codebase
-- where the DATABASE enforces an assurance level rather than trusting a
-- frontend gate (cf. audit item P3 #11).
CREATE OR REPLACE FUNCTION public.replace_mfa_recovery_codes(p_codes TEXT[])
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_aal      TEXT := coalesce(auth.jwt() ->> 'aal', '');
  v_code     TEXT;
  v_inserted INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  IF v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'two-factor authentication must be verified before recovery codes can be created'
      USING ERRCODE = '28000';
  END IF;

  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL THEN
    RAISE EXCEPTION 'no recovery codes supplied' USING ERRCODE = '22023';
  END IF;

  IF array_length(p_codes, 1) > 20 THEN
    RAISE EXCEPTION 'at most 20 recovery codes may be created at once' USING ERRCODE = '22023';
  END IF;

  -- Replacing is atomic: a failed rotation must never leave the account with
  -- zero codes, which would silently return us to the locked-out state this
  -- migration exists to remove. plpgsql runs in a transaction, so a RAISE below
  -- rolls this DELETE back.
  DELETE FROM public.mfa_recovery_codes WHERE user_id = v_uid;

  FOREACH v_code IN ARRAY p_codes LOOP
    v_code := upper(regexp_replace(coalesce(v_code, ''), '[^A-Za-z0-9]', '', 'g'));
    CONTINUE WHEN length(v_code) < 8;  -- ignore anything too short to be one of ours
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
    VALUES (v_uid, crypt(v_code, gen_salt('bf', 10)));
    v_inserted := v_inserted + 1;
  END LOOP;

  IF v_inserted = 0 THEN
    RAISE EXCEPTION 'no usable recovery codes supplied' USING ERRCODE = '22023';
  END IF;

  -- A fresh set supersedes the old one, so a stale lockout must not survive it.
  DELETE FROM public.mfa_recovery_attempts WHERE user_id = v_uid;

  RETURN v_inserted;
END $$;

COMMENT ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) IS
  'Replaces the caller''s recovery codes with freshly hashed ones. Requires aal2. Plaintext is never stored.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. How many are left — mfa_recovery_status()
-- ─────────────────────────────────────────────────────────────────────────────
-- The client needs "3 of 10 left" and must NOT be given the hashes. A count is
-- the whole exposed surface.
CREATE OR REPLACE FUNCTION public.mfa_recovery_status()
RETURNS TABLE (total INT, remaining INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT
    count(*)::INT                                        AS total,
    count(*) FILTER (WHERE used_at IS NULL)::INT          AS remaining
  FROM public.mfa_recovery_codes
  WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.mfa_recovery_status() IS
  'Counts the caller''s recovery codes. The only view of that table exposed to clients.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Verify — verify_mfa_recovery_code(uuid, text)   [service_role only]
-- ─────────────────────────────────────────────────────────────────────────────
-- Answers "is this code valid for this user?" and NEVER consumes it. Called by
-- the edge function with the service role, on behalf of an anonymous caller.
--
-- It is revoked from anon and authenticated BY NAME: if it were client-callable,
-- anyone could pass another user's id and guess against their codes without
-- touching the edge function's own limits.
--
-- p_user_id IS NULL means the email matched no account. We still spend one
-- bcrypt so the response time cannot distinguish "no such account" from "wrong
-- code" — the design promises identical behaviour for both, and timing is part
-- of behaviour.
CREATE OR REPLACE FUNCTION public.verify_mfa_recovery_code(p_user_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_code   TEXT;
  v_recent INT;
BEGIN
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  IF p_user_id IS NULL THEN
    PERFORM crypt(v_code, gen_salt('bf', 10));
    RETURN false;
  END IF;

  -- Rate limit, counted before the comparison so a flood cannot outrun the
  -- window, and so the cost of a lockout is paid by the attacker.
  SELECT count(*) INTO v_recent
  FROM public.mfa_recovery_attempts
  WHERE user_id = p_user_id
    AND succeeded = false
    AND attempted_at > now() - interval '15 minutes';

  IF v_recent >= 10 THEN
    INSERT INTO public.mfa_recovery_attempts (user_id, succeeded) VALUES (p_user_id, false);
    RETURN false;
  END IF;

  IF length(v_code) < 8 THEN
    INSERT INTO public.mfa_recovery_attempts (user_id, succeeded) VALUES (p_user_id, false);
    RETURN false;
  END IF;

  -- crypt() re-derives the bcrypt hash using the salt embedded in each stored
  -- value, so this is a per-row comparison. One code, one match.
  IF EXISTS (
    SELECT 1
    FROM public.mfa_recovery_codes
    WHERE user_id = p_user_id
      AND used_at IS NULL
      AND code_hash = crypt(v_code, code_hash)
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.mfa_recovery_attempts (user_id, succeeded) VALUES (p_user_id, false);
  RETURN false;
END $$;

COMMENT ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) IS
  'Validates one recovery code without consuming it. SERVICE ROLE ONLY. Returns true only on a real match.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Consume — consume_mfa_recovery_codes(uuid)      [service_role only]
-- ─────────────────────────────────────────────────────────────────────────────
-- Called by the edge function ONLY after the TOTP factor has been confirmed
-- deleted. Burns every unused code for the user and clears the rate limit.
--
-- Burning the rest is right at this point and only at this point: the factor is
-- gone and the user will re-enroll and mint a fresh set, so a surviving code is
-- pure liability. Doing it any earlier would mean a mid-way failure left them
-- locked out with no codes — see the header note.
--
-- GET DIAGNOSTICS ... ROW_COUNT is how we learn the affected-row count that
-- PostgREST refuses to give us.
CREATE OR REPLACE FUNCTION public.consume_mfa_recovery_codes(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_burned INT := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.mfa_recovery_codes
     SET used_at = now()
   WHERE user_id = p_user_id AND used_at IS NULL;

  GET DIAGNOSTICS v_burned = ROW_COUNT;

  DELETE FROM public.mfa_recovery_attempts WHERE user_id = p_user_id;

  RETURN v_burned;
END $$;

COMMENT ON FUNCTION public.consume_mfa_recovery_codes(UUID) IS
  'Burns every unused recovery code for a user. SERVICE ROLE ONLY — call only after the factor is confirmed deleted.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Function grants — name the roles, AND revoke from PUBLIC
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ THE BUG THIS SECTION USED TO HAVE, and why PUBLIC is revoked separately.
--   The first version revoked from anon/authenticated/service_role by name and
--   stopped there. PostgreSQL grants EXECUTE to PUBLIC by DEFAULT on every new
--   function, and a REVOKE naming a role does NOT remove a privilege that role
--   holds THROUGH PUBLIC — effective privilege is the union of direct grants and
--   PUBLIC. So all four functions stayed anon-callable, and
--   consume_mfa_recovery_codes() — which has no internal auth check, because the
--   grant was supposed to be the control — could be invoked by anyone holding
--   the public anon key (it ships in the frontend bundle) to burn any user's
--   recovery codes.
--
--   The tables did NOT leak because RLS (enabled, zero policies) denies every
--   non-owner role regardless of grants. Functions have no RLS equivalent: for a
--   SECURITY DEFINER function the grant IS the control. That asymmetry is why
--   this slipped past a review that was looking at the tables.
--
--   PUBLIC cannot be named with format('%I') — that would emit "PUBLIC" and look
--   for a role of that name. The revokes below are therefore literal.
REVOKE ALL ON FUNCTION public.replace_mfa_recovery_codes(TEXT[])   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mfa_recovery_status()                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_mfa_recovery_codes(UUID)     FROM PUBLIC;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOR role_name IN SELECT unnest(ARRAY['anon', 'authenticated', 'service_role'])
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) FROM %I', role_name);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.mfa_recovery_status() FROM %I', role_name);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) FROM %I', role_name);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.consume_mfa_recovery_codes(UUID) FROM %I', role_name);
  END LOOP;
END $$;

-- The signed-in user's own data, gated by auth.uid() (and aal2 for replace).
GRANT EXECUTE ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_status()               TO authenticated;

-- The unauthenticated redemption path, reachable only through the edge function.
GRANT EXECUTE ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_codes(UUID)     TO service_role;

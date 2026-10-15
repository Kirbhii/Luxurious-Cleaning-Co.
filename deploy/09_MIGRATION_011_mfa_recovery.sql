-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION 011 — MFA RECOVERY CODES
--  Luxurious Cleaning Co.  ·  Supabase ref: inyqjfgeecairaxbkxuo
--  Isinasara ang P0 #1 — ang huling P0 ng Oct 6 audit.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  ANG BUTAS
--   May staff na nag-enroll ng TOTP, tapos nawala ang telepono. Hindi na siya
--   makakarating ng aal2, kaya hinahawakan siya ng login guard sa /login —
--   at ang Security tab, kung saan niya pwedeng patayin ang factor, ay nasa
--   likod ng parehong guard. Kumpleto at self-sustaining ang lockout.
--   Ngayon, ang recovery ay service-role SQL na tinatakbo nang manwal, ng
--   taong maaaring siya mismo ang naka-lock out.
--
--  ANG INVARIANT NA GINAGAMIT NATIN (huwag "pagandahin" ito)
--   Ang verifiedTotpFactor() ay `status === 'verified'` LANG ang binibilang, at
--   ang mfaStepUpRequired() ay `required: factorId !== null`. Kaya ang factor na
--   hindi na verified ay hindi na utang — at ang beginEnrollment() ay
--   naglilinis na ng natirang unverified factors bago mag-fresh enroll.
--   Nasa codebase na ang buong re-enrollment path. Ang kailangan lang ng
--   recovery code: pahintuin ang lumang factor sa pagbilang, ISANG BESES,
--   para sa taong may hawak ng code.
--
--  ANG SECURITY MODEL — basahin bago baguhin ang kahit ano sa ibaba
--   Ang recovery code ay HINDI login credential. Ang pag-redeem ay hindi
--   gumagawa ng session at hindi nagbabalik ng token — inaalis lang nito ang
--   pangalawang factor.
--
--       password lang            -> denied (may utang na factor)
--       recovery code lang       -> WALA
--       password + recovery code -> access
--
--   Ito ang dahilan kung bakit katanggap-tanggap na UNAUTHENTICATED ang
--   redemption endpoint: sa depinisyon, hindi makakalogin ang tumatawag —
--   kaya nga siya tumatawag. At ang `password + code` ay mas malakas pa kaysa
--   sa kalagayan bago mag-enroll (password lang).
--
--  BAKIT BCRYPT AT HINDI sha256
--   ~50 bits ang entropy. Ang plain sha256 ay kayang i-brute force offline sa
--   loob ng ilang oras sa isang GPU kung ma-leak ang hash. Ang
--   crypt(..., gen_salt('bf', 10)) ay ~60-100ms kada hula sa halip na ~1us —
--   mga 10^5 na pagkakaiba. Kaya HINDI maihahambing ang mga hash sa isa't isa,
--   at sadyang walang UNIQUE sa code_hash.
--
--  ⚠ BAKIT DALAWANG FUNCTION AT HINDI ISA — ANG MAHALAGANG PAGBABAGO
--   Ang factor ay tinatanggal ng edge function sa pamamagitan ng GoTrue Admin
--   API, PAGKATAPOS magsalita ng database. Ang isang "verify + consume + burn
--   the rest" function ay magsusunog ng lahat ng code BAGO pa malaman kung
--   tumalab ang pagtanggal — kaya ang failure sa gitna ay mag-iiwan sa user na
--   naka-lock out at WALANG natitirang code. Eksaktong kalagayang isinasara ng
--   migration na ito. Kaya hinati:
--
--       ANG MGA CODE AY SINUSUNOG LAMANG PAGKATAPOS MAKILALANG WALA NA ANG FACTOR.
--
--   verify_mfa_recovery_code()  — "valid ba ang code?"  HINDI kumakain.
--   consume_mfa_recovery_codes()— sinusunog lahat; tinatawag lamang kapag
--                                 kumpirmadong wala na ang factor.
--
--  ⚠ GRANT/REVOKE na bitag (kapareho ng 007 §2 at 010 §7): ang Supabase ay may
--   ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES/FUNCTIONS TO anon,
--   authenticated, service_role. Ang `REVOKE ... FROM PUBLIC` ay HINDI
--   nag-aalis ng DIRECT role grant — kailangang pangalanan ang mga role.
--
--  ⚠ auth.jwt() at ang SQL Editor: ang editor ay tumatakbo bilang `postgres`
--   na walang request claims, kaya ang replace_mfa_recovery_codes() ay
--   mag-e-error doon ("must be verified"). Tama iyon, hindi bug — tingnan §11.
--
--  WALANG IE-EXECUTE NA BINABAGO NITO. Puro CREATE. Safe i-paste.
-- ═══════════════════════════════════════════════════════════════════════════


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
  code_hash  TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
-- 3. Redemption attempts — ang rate limit
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mfa_recovery_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  succeeded    BOOLEAN     NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mfa_recovery_attempts IS
  'Failed/successful redemption attempts, for rate limiting an unauthenticated endpoint. Never stores a submitted code.';

CREATE INDEX IF NOT EXISTS mfa_recovery_attempts_user_time_idx
  ON public.mfa_recovery_attempts (user_id, attempted_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. I-lock ang dalawang table sa clients
-- ─────────────────────────────────────────────────────────────────────────────
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

-- Sadyang WALANG policy. Ang pagdagdag ng isa sa hinaharap ay dapat
-- sinadyang gawa at nirepaso — hindi aksidente.


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Mint / rotate — replace_mfa_recovery_codes(text[])
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- Ang unang lugar sa codebase na ito kung saan ang DATABASE mismo ang
  -- nagpapatupad ng assurance level, sa halip na magtiwala sa frontend gate
  -- (tingnan ang audit item P3 #11).
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

  -- Atomic ang pagpapalit: ang bigong rotation ay hindi dapat mag-iwan ng
  -- account na WALANG code. Ang plpgsql ay tumatakbo sa isang transaction,
  -- kaya ang RAISE sa ibaba ay nagro-rollback ng DELETE na ito.
  DELETE FROM public.mfa_recovery_codes WHERE user_id = v_uid;

  FOREACH v_code IN ARRAY p_codes LOOP
    v_code := upper(regexp_replace(coalesce(v_code, ''), '[^A-Za-z0-9]', '', 'g'));
    CONTINUE WHEN length(v_code) < 8;
    INSERT INTO public.mfa_recovery_codes (user_id, code_hash)
    VALUES (v_uid, crypt(v_code, gen_salt('bf', 10)));
    v_inserted := v_inserted + 1;
  END LOOP;

  IF v_inserted = 0 THEN
    RAISE EXCEPTION 'no usable recovery codes supplied' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.mfa_recovery_attempts WHERE user_id = v_uid;

  RETURN v_inserted;
END $$;

COMMENT ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) IS
  'Replaces the caller''s recovery codes with freshly hashed ones. Requires aal2. Plaintext is never stored.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Ilan ang natitira — mfa_recovery_status()
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- NULL = walang account na tumugma sa email. Gumagastos pa rin tayo ng ISANG
  -- bcrypt para hindi maihambing ang oras ng tugon sa pagitan ng "walang
  -- account" at "maling code".
  IF p_user_id IS NULL THEN
    PERFORM crypt(v_code, gen_salt('bf', 10));
    RETURN false;
  END IF;

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

  -- Ang crypt() ay nagre-derive ng bcrypt hash gamit ang salt na nakabaon sa
  -- bawat naka-imbak na value, kaya per-row ang paghahambing. Isang code,
  -- isang tugma.
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

  -- Ito ang affected-row count na ayaw ibigay ng PostgREST.
  GET DIAGNOSTICS v_burned = ROW_COUNT;

  DELETE FROM public.mfa_recovery_attempts WHERE user_id = p_user_id;

  RETURN v_burned;
END $$;

COMMENT ON FUNCTION public.consume_mfa_recovery_codes(UUID) IS
  'Burns every unused recovery code for a user. SERVICE ROLE ONLY — call only after the factor is confirmed deleted.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Grants — pangalanan ang mga role, AT mag-revoke mula sa PUBLIC
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ Ang unang bersyon nito ay nag-revoke LAMANG sa mga pinangalanang role, at
--   doon ito nasira. Ang PostgreSQL ay default na nagbibigay ng EXECUTE sa
--   PUBLIC sa bawat bagong function, at ang REVOKE na may pangalan ng role ay
--   HINDI nag-aalis ng privilege na hawak ng role na iyon SA PAMAMAGITAN ng
--   PUBLIC — ang effective privilege ay pinagsama. Kaya nanatiling kayang
--   tawagin ng anon ang lahat ng apat na function.
--
--   Hindi ito naabot ng mga TABLE dahil may RLS silang backstop (naka-enable,
--   ZERO policy = deny sa lahat maliban sa owner). Ang mga FUNCTION ay walang
--   katumbas na RLS — sa SECURITY DEFINER function, ANG GRANT ANG CONTROL.
--
--   Hindi maaaring pangalanan ang PUBLIC gamit ang format('%I') — magiging
--   "PUBLIC" iyon at hahanapin ang role na may ganoong pangalan. Literal dapat.
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

GRANT EXECUTE ON FUNCTION public.replace_mfa_recovery_codes(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_recovery_status()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_mfa_recovery_code(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_mfa_recovery_codes(UUID)     TO service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. VERIFICATION — patakbuhin ang mga ito at basahin ang output
-- ═══════════════════════════════════════════════════════════════════════════
-- (a) Saan napunta ang pgcrypto? Ang mga function ay nagpi-pin ng search_path
--     sa `extensions`, kaya `extensions` ang dapat sabihin nito.
SELECT n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto';

-- (b) Umiiral ang dalawang table at NAKA-ON ang RLS.
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('mfa_recovery_codes', 'mfa_recovery_attempts')
ORDER BY relname;
-- inaasahan: relrowsecurity = true sa dalawa

-- (c) WALANG policy. Sinadya ito — deny by default.
SELECT count(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('mfa_recovery_codes', 'mfa_recovery_attempts');
-- inaasahan: 0

-- (d) Effective privileges. false dapat ang lahat ng anon/authenticated;
--     service_role ay true LAMANG sa verify at consume.
SELECT
  has_table_privilege('authenticated', 'public.mfa_recovery_codes',    'SELECT') AS auth_can_read_codes,
  has_table_privilege('authenticated', 'public.mfa_recovery_attempts', 'SELECT') AS auth_can_read_attempts,
  has_function_privilege('authenticated', 'public.replace_mfa_recovery_codes(text[])', 'EXECUTE')  AS auth_can_mint,
  has_function_privilege('authenticated', 'public.mfa_recovery_status()', 'EXECUTE')               AS auth_can_count,
  has_function_privilege('authenticated', 'public.verify_mfa_recovery_code(uuid, text)', 'EXECUTE') AS auth_can_verify,
  has_function_privilege('authenticated', 'public.consume_mfa_recovery_codes(uuid)', 'EXECUTE')     AS auth_can_consume,
  has_function_privilege('service_role',  'public.verify_mfa_recovery_code(uuid, text)', 'EXECUTE') AS service_can_verify,
  has_function_privilege('service_role',  'public.consume_mfa_recovery_codes(uuid)', 'EXECUTE')     AS service_can_consume;
-- inaasahan: false, false, true, true, false, false, true, true

-- (e) ISA lang ang signature kada function — ang CREATE OR REPLACE na may
--     ibang signature ay gumagawa ng OVERLOAD, hindi nagpapalit (010 Hole C).
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'replace_mfa_recovery_codes',
    'mfa_recovery_status',
    'verify_mfa_recovery_code',
    'consume_mfa_recovery_codes'
  )
ORDER BY p.proname;
-- inaasahan: EKSAKTONG 4 na row

-- (f) Gumagana ba talaga ang bcrypt, at hindi ba tumutugma ang maling code?
--     Temporary rows lang; walang naiiwang data.
DO $$
DECLARE
  v_hash TEXT := crypt('ABCDEFGHJK', gen_salt('bf', 10));
BEGIN
  IF v_hash = crypt('ABCDEFGHJK', v_hash) THEN
    RAISE NOTICE 'ok: bcrypt round-trip verifies';
  ELSE
    RAISE EXCEPTION 'FAILED: bcrypt round-trip did not verify';
  END IF;
  IF v_hash = crypt('ABCDEFGHJL', v_hash) THEN
    RAISE EXCEPTION 'FAILED: a wrong code matched';
  ELSE
    RAISE NOTICE 'ok: a wrong code does not match';
  END IF;
END $$;
-- inaasahan: dalawang NOTICE


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. KUNG GUSTO MONG SUBUKAN ANG VERIFY NANG MANWAL (opsyonal)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ang SQL Editor ay tumatakbo bilang postgres, kaya MAAARI mong tawagin ang
-- verify_mfa_recovery_code nang direkta dito — hindi ito umaasa sa auth.jwt().
-- Palitan ang <UUID> ng totoong user id. Ang maling code ay dapat FALSE.
--
--   SELECT public.verify_mfa_recovery_code('<UUID>', 'ABCDE-FGHJK');
--
-- HUWAG patakbuhin ang consume_mfa_recovery_codes() nang manwal maliban kung
-- talagang susunugin mo ang lahat ng code ng taong iyon.
--
-- Ang replace_mfa_recovery_codes() ay MAG-E-ERROR dito (postgres, walang
-- claims). Tama iyon — tanging ang client na may aal2 session ang pwedeng
-- mag-mint, at iyon ang punto.
-- ═══════════════════════════════════════════════════════════════════════════

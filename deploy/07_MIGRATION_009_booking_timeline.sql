-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION 009 — BOOKING TIMELINE PERSISTENCE (DB trigger)
--  Luxurious Cleaning Co.  ·  Supabase ref: inyqjfgeecairaxbkxuo
-- ═══════════════════════════════════════════════════════════════════════════
--
--  BUG NA INAAYOS (Test 5.6, kumpirmado)
--  Ang `booking_timeline` ay WALANG ni isang row — `count(*)` = 0 kahit
--  nagawa na ang booking at napalitan na ang status. Ang app ay gumagawa ng
--  timeline events sa React state lamang, kaya:
--    · habang nasa page ka → lumalabas ang history ✅
--    · pagkatapos ng reload → NAWAWALA ang buong history section ❌
--      (naka-guard sa `booking.timeline.length > 0` sa CustomerPortal.tsx:131)
--
--  BAKIT TRIGGER, HINDI FRONTEND INSERT
--  Ang existing na `timeline: insert` policy ay:
--      WITH CHECK (b.cleaner_id = auth.uid() OR current_user_role() = 'admin')
--  HINDI kasama ang customer, at NULL ang `cleaner_id` sa bagong booking —
--  kaya tatanggihan ang client-side insert ng "Booking Submitted".
--  Ang trigger na pag-aari ng migration role ay lumalampas sa gap na iyon.
--
--  SAFE: ang buong body ay nasa loob ng exception handler — kung mabigo man
--  ito, hindi masisira ang booking write. Magiging "walang timeline row" lang
--  at isang server warning, hindi isang failed booking.
--
--  HINDI KAILANGANG I-REDEPLOY ANG FRONTEND.
--
--  PAANO: Supabase Dashboard → SQL Editor → New query → i-paste lahat → Run.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 0 · BEFORE — baseline
-- ───────────────────────────────────────────────────────────────────────────
SELECT count(*) AS timeline_rows_before FROM public.booking_timeline;
-- EXPECTED: 0 (iyan ang bug)


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 1 · Ang trigger function
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_booking_timeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT := 'System';
BEGIN
  -- Resolve a human-readable actor. Isolated in its own block so that a failure
  -- to read profiles cannot prevent the timeline row from being written.
  BEGIN
    SELECT COALESCE(NULLIF(p.name, ''), p.role::text)
      INTO v_actor
    FROM public.profiles p
    WHERE p.id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := 'System';
  END;
  v_actor := COALESCE(v_actor, 'System');

  -- ── INSERT: the booking was created ──────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_timeline (booking_id, event, note, actor)
    VALUES (NEW.id, 'Booking Submitted',
            'Booking received and is pending review.', v_actor);
    RETURN NEW;
  END IF;

  -- ── UPDATE: log only meaningful transitions ──────────────────────────────
  -- `IS DISTINCT FROM` keeps repeat writes of the same value from spamming the
  -- timeline (the client re-sends the current status on several code paths).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_timeline (booking_id, event, note, actor)
    VALUES (NEW.id, 'Status Updated',
            format('Status changed from %s to %s.', OLD.status, NEW.status),
            v_actor);
  END IF;

  IF NEW.cleaner_id IS DISTINCT FROM OLD.cleaner_id THEN
    INSERT INTO public.booking_timeline (booking_id, event, note, actor)
    VALUES (NEW.id,
            CASE WHEN NEW.cleaner_id IS NULL
                 THEN 'Cleaner Unassigned' ELSE 'Cleaner Assigned' END,
            CASE WHEN NEW.cleaner_id IS NULL
                 THEN 'The assigned cleaner was removed from this booking.'
                 ELSE 'A cleaner has been assigned to this booking.' END,
            v_actor);
  END IF;

  IF COALESCE(NEW.cleaner_notes, '') IS DISTINCT FROM COALESCE(OLD.cleaner_notes, '')
     AND COALESCE(NEW.cleaner_notes, '') <> '' THEN
    INSERT INTO public.booking_timeline (booking_id, event, note, actor)
    VALUES (NEW.id, 'Cleaner Notes Updated', NEW.cleaner_notes, v_actor);
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never let timeline logging break the booking write.
  RAISE WARNING 'log_booking_timeline failed for booking %: %',
    COALESCE(NEW.id, '?'), SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_booking_timeline() IS
  'Mirrors booking lifecycle changes into public.booking_timeline. Fail-safe: swallows its own errors so it can never block a booking write.';


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 2 · Ikabit ang triggers
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_bookings_timeline_insert ON public.bookings;
CREATE TRIGGER trg_bookings_timeline_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_timeline();

DROP TRIGGER IF EXISTS trg_bookings_timeline_update ON public.bookings;
CREATE TRIGGER trg_bookings_timeline_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_timeline();


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 3 · AFTER — verification
-- ───────────────────────────────────────────────────────────────────────────

-- 3a — Nakakabit ba ang dalawang triggers?
--   EXPECTED: 2 rows — `AFTER INSERT` (tgtype 5) at `AFTER UPDATE` (tgtype 17),
--             function = log_booking_timeline, is_security_definer = true
SELECT
  t.tgname                AS trigger_name,
  CASE
    WHEN t.tgtype = 5  THEN 'AFTER INSERT'
    WHEN t.tgtype = 17 THEN 'AFTER UPDATE'
    ELSE t.tgtype::text
  END                     AS fires,
  p.proname               AS function_name,
  p.prosecdef             AS is_security_definer
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'public.bookings'::regclass
  AND NOT t.tgisinternal
  AND t.tgname LIKE 'trg_bookings_timeline%'
ORDER BY t.tgname;

-- 3b — Baseline pa rin (wala pang bagong booking)
SELECT count(*) AS timeline_rows_after_install FROM public.booking_timeline;


-- ═══════════════════════════════════════════════════════════════════════════
--  STEP 4 · LIVE TEST — patunayan na gumagana
-- ═══════════════════════════════════════════════════════════════════════════
--
--  A) Sa UI: gumawa ng BAGONG booking (customer portal → Book a Service).
--  B) Sa UI: palitan ang status nito sa admin dashboard.
--  C) Patakbuhin ito:
--
--     SELECT t.booking_id, t.event, t.note, t.actor, t.created_at
--     FROM public.booking_timeline t
--     ORDER BY t.created_at DESC
--     LIMIT 10;
--
--  EXPECTED: hindi na 0. Dapat may:
--     · 'Booking Submitted'  → sa paggawa ng booking
--     · 'Status Updated'     → sa pagpalit ng status
--     · 'Cleaner Assigned'   → kung nag-assign ka ng cleaner
--
--  KUNG 0 PA RIN: tingnan ang Postgres logs sa Supabase (Logs → Postgres) at
--  hanapin ang `WARNING: log_booking_timeline failed`. Iyon ang magsasabi kung
--  bakit — malamang RLS o privilege. I-report agad.
--
--  D) Huling hakbang — i-reload ang customer portal at buksan ang booking.
--     EXPECTED: nandiyan pa rin ang history section. Hindi na nawawala. ✅
--
-- ═══════════════════════════════════════════════════════════════════════════
--  ALAM NA TRADE-OFF
-- ═══════════════════════════════════════════════════════════════════════════
--  Ang app ay gumagawa pa rin ng mayamang local text ("Cleaner Assigned —
--  Maria has been assigned to your booking on 2026-10-02"). Ang DB trigger ay
--  nagsusulat ng generic na text ("A cleaner has been assigned to this
--  booking.").
--
--  Kaya: habang bagong action → mayamang text (local state).
--        pagkatapos ng reload → generic na text (galing sa DB).
--
--  Hindi bug ito — ang DB row ang durable record. Kung gusto mong magkatugma
--  sila sa hinaharap, puwede nating gawin ang frontend helper (Option B) at
--  alisin ang trigger, pero HINDI silang dalawa nang sabay — magdodoble ang
--  rows.
-- ═══════════════════════════════════════════════════════════════════════════

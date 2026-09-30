-- ─── Migration 009 — Booking timeline persistence ───────────────────────────
--
-- BUG: `booking_timeline` has never received a single row (verified: count = 0
-- after creating a booking AND changing its status). The app builds timeline
-- events in React state only, so `CustomerPortal.tsx` renders a history while
-- the user is on the page, and the whole section silently disappears after any
-- reload (it is guarded by `booking.timeline.length > 0`).
--
-- WHY A TRIGGER RATHER THAN A FRONTEND INSERT:
-- the existing `timeline: insert` policy is
--     WITH CHECK (b.cleaner_id = auth.uid() OR public.current_user_role() = 'admin')
-- The customer is NOT covered, and on booking creation `cleaner_id` is NULL —
-- so a client-side insert of the "Booking Submitted" event would be rejected.
-- A trigger owned by the migration role bypasses that gap entirely.
--
-- SAFETY: the body is wrapped in an exception handler, so a failure here can
-- never break the booking write itself. It degrades to "no timeline row" plus a
-- server warning, never to a failed booking.

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

-- ─── Triggers ───────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_bookings_timeline_insert ON public.bookings;
CREATE TRIGGER trg_bookings_timeline_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_timeline();

DROP TRIGGER IF EXISTS trg_bookings_timeline_update ON public.bookings;
CREATE TRIGGER trg_bookings_timeline_update
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_timeline();

-- ─── Verification ───────────────────────────────────────────────────────────

-- V1 — both triggers attached, pointing at the right function?
--   EXPECTED: 2 rows, tgtype 5 (AFTER INSERT) and 17 (AFTER UPDATE),
--             function = log_booking_timeline
SELECT
  t.tgname                AS trigger_name,
  t.tgtype,
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

-- V2 — current timeline row count (baseline before testing)
SELECT count(*) AS timeline_rows_now FROM public.booking_timeline;

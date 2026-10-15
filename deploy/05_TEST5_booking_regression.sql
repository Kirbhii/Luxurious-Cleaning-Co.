-- ═══════════════════════════════════════════════════════════════════════════
--  TEST 5 — BOOKING REGRESSION
--  Luxurious Cleaning Co.  ·  Supabase ref: inyqjfgeecairaxbkxuo
-- ═══════════════════════════════════════════════════════════════════════════
--
--  LAYUNIN
--  Siguraduhing hindi nasira ang booking flow (create → admin view → status
--  update → delete) ng lahat ng binago natin: migration 007 (privilege
--  hardening), 008 (role management), at yung PROFILE_COLUMNS / explicit
--  .select() fixes.
--
--  BAKIT ITO MAHALAGA
--  Ang `fetchBookings()` ay gumagamit ng `select('*')`. Kapag may KAHIT ISANG
--  column ng `bookings` na na-revoke ang SELECT, mababagsak ang BUONG listahan
--  — eksaktong nangyari sa `profiles.pin_hash`. Test 5.0 ang magbabantay dito.
--
--  PAANO PATAKBUHIN
--  Sa Supabase Dashboard → SQL Editor → New query → i-paste → Run.
--  Patakbuhin ang bawat section SA ORDER. Ihambing sa "EXPECTED".
--
--  ACCOUNT NA GINAGAMIT
--  TEST_CUSTOMER_EMAIL   ← palitan lang sa bawat section kung iba
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  T5.0 · BASELINE — column privileges + RLS policies
--  Patakbuhin ito BAGO ang kahit anong UI test.
-- ───────────────────────────────────────────────────────────────────────────

-- T5.0a — Lahat ba ng columns ng bookings ay SELECTable ng authenticated?
--   EXPECTED: lahat TRUE. Walang FALSE sa kahit isang row.
SELECT
  a.attname                                        AS column_name,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'SELECT') AS can_select,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'INSERT') AS can_insert,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'UPDATE') AS can_update
FROM pg_attribute a
WHERE a.attrelid = 'public.bookings'::regclass
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY a.attnum;
-- KUNG MAY FALSE: `fetchBookings()` (select '*') ay babagsak → walang booking
-- lalabas sa admin/customer/cleaner. Huwag ituloy ang UI test; i-report muna.


-- T5.0b — Anong RLS policies ang aktibo sa bookings?
--   EXPECTED: 5 policies — customer SELECT, customer insert, update,
--             admin delete, customer delete own.
SELECT
  p.polname                                   AS policy_name,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    ELSE 'ALL'
  END                                         AS command,
  pg_get_expr(p.polqual, p.polrelid)          AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid)     AS with_check_expression
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'bookings'
ORDER BY command, policy_name;
-- PAALALA: ang DELETE policy ng customer ay LIMITADO lang sa
--   status IN ('pending','cancelled','awaiting_review','rejected').
--   Ito ang root cause ng T5.5.


-- ───────────────────────────────────────────────────────────────────────────
--  T5.0c · ⚠ MIGRATION STATUS — alin ba talaga ang na-apply sa live DB?
--  Patakbuhin ito kung may "column ... does not exist" error kahit saan.
-- ───────────────────────────────────────────────────────────────────────────
--  Bakit kailangan: ang T5.0a ay nagli-listahan lang ng mga column na MERON.
--  Hindi nito masasabi kung may KULANG. Halimbawa: kung hindi na-apply ang
--  migration 006, ang `bookings.priority` ay wala — at ang T5.0a ay tahimik
--  lang na mas kaunti ang rows nito, mukhang "pass" pa rin.
-- ───────────────────────────────────────────────────────────────────────────

SELECT * FROM (VALUES
  ('002  profiles.pin_hash',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='pin_hash')),
  ('003  storage bucket resumes',
    EXISTS(SELECT 1 FROM storage.buckets WHERE id='resumes')),
  ('004a enum awaiting_review',
    EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='booking_status' AND e.enumlabel='awaiting_review')),
  ('004a enum rejected',
    EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='booking_status' AND e.enumlabel='rejected')),
  ('004b training_applications.resume_url',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='training_applications' AND column_name='resume_url')),
  ('004b partner_applications.resume_url',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='resume_url')),
  ('004b policy bookings: customer delete own',
    EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings: customer delete own')),
  ('005  partner_applications.company_id',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='partner_applications' AND column_name='company_id')),
  ('005  policy profiles: admin update',
    EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles: admin update')),
  ('006  bookings.priority',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='priority')),
  ('006  bookings.member_tier',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='member_tier')),
  ('006  bookings.discount_percent',
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings' AND column_name='discount_percent')),
  ('007  fn activate_own_membership',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='activate_own_membership')),
  ('007  fn verify_user_pin',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='verify_user_pin')),
  ('007  fn enforce_profile_column_privileges',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='enforce_profile_column_privileges')),
  ('007  policy resumes: owner or admin read',
    EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='resumes: owner or admin read')),
  ('008  fn admin_set_user_role',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='admin_set_user_role'))
) AS t(migration, applied)
ORDER BY migration;

-- T5.0c-2 — pin_hash ba ay talagang naka-revoke mula sa authenticated?
--   EXPECTED: pin_hash_revoked = true
SELECT
  NOT has_column_privilege('authenticated', 'public.profiles', 'pin_hash', 'SELECT') AS pin_hash_revoked,
  has_column_privilege('authenticated', 'public.profiles', 'name', 'UPDATE')        AS name_updatable;

-- T5.0c-3 — Anong mga column MERON ang bookings? (baseline para sa T5.1b)
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) AS bookings_columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name='bookings';


-- T5.0c — Ilang booking na ang nasa test account?
--   Ito ang "before" number. Tandaan ito.
SELECT
  b.id,
  b.status,
  b.service,
  b.date,
  b.created_at
FROM public.bookings b
JOIN public.profiles p ON p.id = b.customer_id
WHERE p.email = 'TEST_CUSTOMER_EMAIL'
ORDER BY b.created_at DESC;



-- ───────────────────────────────────────────────────────────────────────────
--  T5.1 · CREATE — gumawa ng booking sa UI
--  UI: Customer portal → Book a Service → kumpletuhin → Submit.
--      Tandaan ang reference (hal. "LC-10293").
--  Pagkatapos, patakbuhin ito:
-- ───────────────────────────────────────────────────────────────────────────

-- EXPECTED: 1 row, status = 'pending', customer_matches = true,
--           tama ang service/date/address.
-- NOTE: ang priority / member_tier / discount_percent ay galing sa migration
--       006 — na-apply na ito (T5.0c all true), kaya kasama na sila dito.
SELECT
  b.id, b.status, b.service, b.date, b.time,
  b.address, b.city, b.frequency,
  b.priority, b.member_tier, b.discount_percent,
  b.customer_id = p.id AS customer_matches
FROM public.bookings b
JOIN public.profiles p ON p.id = b.customer_id
WHERE p.email = 'TEST_CUSTOMER_EMAIL'
ORDER BY b.created_at DESC
LIMIT 1;

-- KUNG WALANG ROW:
--   Ang insert ay nag-fail. Hanapin sa browser console ang
--   "[Booking] Database insert failed" → nandiyan ang exact error message.
--   Mga malamang na dahilan:
--     · invalid input syntax for type time   → mali ang time format
--     · invalid input syntax for type date   → mali ang date format
--     · violates foreign key constraint      → sira ang customer_id
--     · new row violates row-level security  → sira ang INSERT policy


-- T5.1b — Kumpletong row check (lahat ng column readable ba?)
--   EXPECTED: walang error. Kung may "permission denied for column", balik sa T5.0a.
SELECT * FROM public.bookings
WHERE customer_id = (SELECT id FROM public.profiles
                     WHERE email = 'TEST_CUSTOMER_EMAIL')
ORDER BY created_at DESC
LIMIT 1;



-- ───────────────────────────────────────────────────────────────────────────
--  T5.2 · ADMIN VIEW — lumabas ba sa admin dashboard?
--  UI: Admin → Bookings tab. Hanapin ang reference. Dapat nandoon,
--      may tamang pangalan ng customer at status badge.
--  EXPECTED: nandiyan ang booking at buo ang columns (hindi putol).
-- ───────────────────────────────────────────────────────────────────────────

-- Ito ang GINAGAYA ng `fetchBookings()` sa DB level — parehong query shape.
-- EXPECTED: walang error, kasama ang timeline sub-object.
SELECT
  b.*,
  (SELECT count(*) FROM public.booking_timeline t WHERE t.booking_id = b.id) AS timeline_rows
FROM public.bookings b
WHERE b.customer_id = (SELECT id FROM public.profiles
                       WHERE email = 'TEST_CUSTOMER_EMAIL')
ORDER BY b.created_at DESC
LIMIT 3;
-- ⚠ NOTE: malamang 0 ang `timeline_rows`. Hindi ito bug sa query —
--   tingnan ang T5.6.



-- ───────────────────────────────────────────────────────────────────────────
--  T5.3 · ADMIN STATUS UPDATE — i-approve o i-assign ang booking
--  UI: Admin → Bookings → palitan ang status (Approve / Assign cleaner).
--      Pagkatapos, patakbuhin ito.
-- ───────────────────────────────────────────────────────────────────────────

-- Palitan ang 'LC-XXXXX' ng totoong reference.
-- EXPECTED: status = ang pinili mo sa UI (hal. 'approved' / 'cleaner_assigned').
SELECT id, status, cleaner_id, updated_at
FROM public.bookings
WHERE id = 'LC-XXXXX';
-- KUNG HINDI NAGBAGO: ang update ay na-block ng RLS at TAHIMIK na nag-fail.
--   Ang `updateBookingRow()` ay walang `.select()`, kaya walang error na
--   ibinabalik kahit 0 rows ang na-update. Tingnan ang T5.3b.

-- T5.3b — May nakikitang error ba sa console?
--   UI: buksan ang DevTools → Console. Hanapin ang
--   "[Admin] Booking status DB sync failed".
--   EXPECTED: wala.



-- ───────────────────────────────────────────────────────────────────────────
--  T5.4 · DELETE habang PENDING — dapat GUMANA
--  UI: Customer portal → hanapin ang booking (status: Pending) → Delete.
--      Pagkatapos, patakbuhin ito.
-- ───────────────────────────────────────────────────────────────────────────

-- EXPECTED: 0 rows. Dapat tuluyang nawala sa DB.
SELECT id, status FROM public.bookings WHERE id = 'LC-XXXXX';
-- KUNG MAY ROW PA RIN: hindi umubra ang delete. Tingnan ang T5.0b policies.


-- ───────────────────────────────────────────────────────────────────────────
--  T5.5 · DELETE habang APPROVED — ❌ HINDI MAABOT SA UI (na-verify sa code)
-- ───────────────────────────────────────────────────────────────────────────
--  AKALA KO DATI: ghost-booking bug ito. MALI. Na-verify sa `CustomerPortal.tsx`
--  linya ~385:
--
--      onDelete={['pending','awaiting_review','cancelled'].includes(b.status)
--        ? () => requestDeleteBooking(b.id) : undefined}
--
--  HINDI NILA-LARGA ANG DELETE BUTTON kapag approved/confirmed ang booking.
--  Ihambing sa RLS DELETE policy (004b §2b):
--      customer_id = auth.uid()
--      AND status IN ('pending','cancelled','awaiting_review','rejected')
--
--  Ang UI guard ay SUBSET ng RLS — kaya lahat ng ma-delete sa UI ay pinapayagan
--  ng RLS. Walang silent no-op, walang ghost booking.
--
--  KAYA: LATENT RISK LANG ITO, HINDI AKTIBONG BUG.
--  Lalabas lang kung:
--    · may mag-edit ng UI guard sa hinaharap, o
--    · may mag-call ng `deleteBookingRow()` nang direkta (script, admin tool)
--
--  HARDENING (opsyonal, mababa ang priority): idagdag ang `.select('id')` sa
--  `deleteBookingRow()` at `updateBookingRow()` para hindi na kailanman
--  magsinungaling ang UI kapag 0 rows ang na-match.
--
--  TEST NA DAPAT GAWIN SA HALIP: patunayan na HINDI lumalabas ang Delete button
--  kapag approved ang booking. Kung lumalabas — doon lang totoong bug.
-- ───────────────────────────────────────────────────────────────────────────

-- HAKBANG 1 — i-approve/confirm ang booking sa admin (status = 'approved' o
--             'confirmed' o 'cleaner_assigned').
-- HAKBANG 2 — sa customer portal, tingnan ang booking card.
--   EXPECTED: WALANG Delete button. ✅
--   KUNG MAY DELETE BUTTON: ⚠ totoong bug — sabihin agad.

-- HAKBANG 3 — kung sakaling may button, i-delete at patakbuhin ito:
SELECT id, status FROM public.bookings WHERE id = 'LC-XXXXX';
-- EXPECTED: 0 rows kung umubra, 1 row kung silent no-op.


-- ───────────────────────────────────────────────────────────────────────────
--  T5.6 · ⚠ TIMELINE PERSISTENCE — pangalawang bug na hinala
-- ───────────────────────────────────────────────────────────────────────────
--  Bakit: `bookingToRow()` ay hindi kasama ang `timeline` array. Ang app ay
--  gumagawa ng "Booking Submitted" / "Cleaner Assigned" events sa LOCAL state
--  lang — walang INSERT sa `booking_timeline`.
--
--  Kaya pagkatapos ng reload, ang booking ay may 0 timeline events kahit
--  nagpakita ito ng history kanina.
-- ───────────────────────────────────────────────────────────────────────────

-- EXPECTED (kung tama ang design): 1+ rows — may naka-record na history.
-- NOTE: ang column ay `created_at`, HINDI `timestamp` (madalas itong ipagkamali
--       dahil ang app-side na `Booking['timeline'][].timestamp` ay galing sa
--       `created_at` sa `bookingFromRow`).
SELECT t.id, t.booking_id, t.event, t.note, t.actor, t.created_at
FROM public.booking_timeline t
ORDER BY t.created_at DESC
LIMIT 10;
-- KUNG 0 ROWS: ⚠ KINUMPIRMA ANG BUG — hindi napi-persist ang timeline.
--   Sa UI: buksan ang booking detail pagkatapos mag-reload.
--   Nawala ba ang timeline events?   (oo / hindi)
--   FIX: magdagdag ng `insertBookingTimeline()` na tinatawag pagkatapos ng
--   bawat status change (o isang DB trigger sa `bookings` UPDATE).



-- ───────────────────────────────────────────────────────────────────────────
--  T5.7 · CLEANER ASSIGNMENT — gumagana pa ba ang FK?
--  UI: Admin → Bookings → Assign cleaner → pumili ng cleaner.
-- ───────────────────────────────────────────────────────────────────────────

-- EXPECTED: cleaner_id ay isang valid UUID, at tumutugma sa isang profile
--           na may role = 'cleaner'.
SELECT
  b.id              AS booking_id,
  b.status,
  b.cleaner_id,
  p.name            AS cleaner_name,
  p.role            AS cleaner_role
FROM public.bookings b
LEFT JOIN public.profiles p ON p.id = b.cleaner_id
WHERE b.id = 'LC-XXXXX';
-- KUNG NULL ANG cleaner_id PERO MAY PINILI KA SA UI:
--   Ang `assignCleaner()` ay may `isUuid(cleanerId) ? cleanerId : null` guard.
--   Kung ang cleaner row ay seed data (hal. id = 'u3'), ito ay NULL — tama ang
--   behavior, hindi bug. Pero dapat gumawa ka ng TOTOONG cleaner account
--   (signup → role dropdown → cleaner) para makapag-test ng tunay na assign.



-- ───────────────────────────────────────────────────────────────────────────
--  T5.8 · FINAL SNAPSHOT — ilista lahat ng booking ng test account
--  Patakbuhin pagkatapos ng lahat ng test.
-- ───────────────────────────────────────────────────────────────────────────

SELECT
  b.id, b.status, b.service, b.date,
  b.cleaner_id IS NOT NULL            AS has_cleaner,
  (SELECT count(*) FROM public.booking_timeline t WHERE t.booking_id = b.id)
                                      AS timeline_events,
  b.created_at
FROM public.bookings b
JOIN public.profiles p ON p.id = b.customer_id
WHERE p.email = 'TEST_CUSTOMER_EMAIL'
ORDER BY b.created_at DESC;


-- ═══════════════════════════════════════════════════════════════════════════
--  RESULT TEMPLATE — sagutan pagkatapos ng lahat
-- ═══════════════════════════════════════════════════════════════════════════
--
--  T5.0a  all columns SELECTable .......... PASS / FAIL
--  T5.0b  5 policies present .............. PASS / FAIL
--  T5.1   booking created in DB ........... PASS / FAIL
--  T5.2   visible in admin dashboard ...... PASS / FAIL
--  T5.3   status update persisted ......... PASS / FAIL
--  T5.4   delete while pending works ...... PASS / FAIL
--  T5.5   delete while approved ........... PASS / FAIL  ← inaasahang FAIL
--  T5.6   timeline persisted .............. PASS / FAIL  ← inaasahang FAIL
--  T5.7   cleaner assignment FK ........... PASS / FAIL
--
-- ═══════════════════════════════════════════════════════════════════════════

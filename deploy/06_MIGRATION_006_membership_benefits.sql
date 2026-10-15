-- ═══════════════════════════════════════════════════════════════════════════
--  MIGRATION 006 — MEMBERSHIP BENEFITS ON BOOKINGS
--  Luxurious Cleaning Co.  ·  Supabase ref: inyqjfgeecairaxbkxuo
-- ═══════════════════════════════════════════════════════════════════════════
--
--  BAKIT: ang migration 006 ay hindi na-apply sa live DB. Kumpirmado ng T5.0c:
--     006  bookings.discount_percent  → false
--     006  bookings.member_tier      → false
--     006  bookings.priority         → false
--
--  EPEKTO NGAYON: gumagana pa rin ang app (may fallback ang `insertBookingRow()`
--  na nagtatanggal ng 3 columns kapag wala sila), PERO hindi nase-save sa DB
--  ang membership priority, tier snapshot, at discount ng bawat booking.
--  Tahimik na nawawalang feature — walang error sa UI.
--
--  SAFE ITO: puro ADD COLUMN IF NOT EXISTS, may default lahat, walang data loss.
--  Idempotent — pwede ulit-ulitin nang walang error.
--  HINDI kailangang i-redeploy ang frontend. Automatic gagana ang columns.
--
--  PAANO: Supabase Dashboard → SQL Editor → New query → i-paste lahat → Run.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 0 · BEFORE — patunayan na wala pa ang columns
-- ───────────────────────────────────────────────────────────────────────────
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'bookings'
  AND column_name IN ('priority', 'member_tier', 'discount_percent');
-- EXPECTED NGAYON: 0 rows. Kung may 1-3 rows na, bahagyang applied na —
-- ituloy pa rin, idempotent naman ang mga susunod na hakbang.


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 1 · Idagdag ang tatlong columns
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS priority         TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS member_tier      public.membership_tier,
  ADD COLUMN IF NOT EXISTS discount_percent INT  NOT NULL DEFAULT 0;


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 2 · Priority constraint
--  (Idempotent — ang orihinal na migration ay nag-error kapag naulit.)
--  normal = guest / standard     high = member     urgent = gold urgent request
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname  = 'bookings_priority_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_priority_check
      CHECK (priority IN ('normal', 'high', 'urgent')) NOT VALID;
  END IF;
END $$;

-- I-validate para tunay na ma-enforce (lahat ng existing rows ay 'normal'
-- dahil sa DEFAULT, kaya walang masasabing violation).
ALTER TABLE public.bookings VALIDATE CONSTRAINT bookings_priority_check;


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 3 · Index para sa priority-based sorting
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_priority ON public.bookings(priority);


-- ───────────────────────────────────────────────────────────────────────────
--  STEP 4 · AFTER — verification
-- ───────────────────────────────────────────────────────────────────────────

-- 4a — Nandiyan na ba ang tatlong columns?
--   EXPECTED: 3 rows, priority at discount_percent ay NOT NULL
--             (is_nullable = 'NO'), member_tier ay nullable ('YES').
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'bookings'
  AND column_name IN ('priority', 'member_tier', 'discount_percent')
ORDER BY column_name;

-- 4b — Constraint at index
--   EXPECTED: 1 constraint row (bookings_priority_check, validated = true)
--             + 1 index row (idx_bookings_priority)
SELECT 'constraint' AS kind, conname AS name, convalidated::text AS detail
FROM pg_constraint
WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_priority_check'
UNION ALL
SELECT 'index', indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'bookings' AND indexname = 'idx_bookings_priority';

-- 4c — Existing rows: lahat ba naka-backfill nang tama?
--   EXPECTED: 1 row — total = bilang ng bookings, lahat naka-'normal' at 0.
SELECT
  count(*)                                            AS total_bookings,
  count(*) FILTER (WHERE priority = 'normal')         AS priority_normal,
  count(*) FILTER (WHERE discount_percent = 0)        AS discount_zero,
  count(*) FILTER (WHERE member_tier IS NULL)         AS member_tier_null
FROM public.bookings;

-- 4d — Privileges: kailangang SELECT/INSERT/UPDATE-able ng authenticated,
--      kung hindi ay mababagsak ang `fetchBookings()` (select '*').
--   EXPECTED: lahat true.
SELECT
  a.attname AS column_name,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'SELECT') AS can_select,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'INSERT') AS can_insert,
  has_column_privilege('authenticated', 'public.bookings', a.attname, 'UPDATE') AS can_update
FROM pg_attribute a
WHERE a.attrelid = 'public.bookings'::regclass
  AND a.attname IN ('priority', 'member_tier', 'discount_percent')
  AND a.attnum > 0
ORDER BY a.attnum;


-- ═══════════════════════════════════════════════════════════════════════════
--  PAGKATAPOS
-- ═══════════════════════════════════════════════════════════════════════════
--  1. Patakbuhin muli ang T5.0c — dapat lahat ng 006 rows ay `true` na.
--  2. Gumawa ng bagong booking sa UI (T5.1) at i-verify:
--
--     SELECT id, status, priority, member_tier, discount_percent
--     FROM public.bookings
--     ORDER BY created_at DESC LIMIT 1;
--
--     EXPECTED:
--       · Non-member na booking  → priority = 'normal', member_tier = NULL,
--                                  discount_percent = 0
--       · Active member booking  → priority = 'high', member_tier = 'silver'
--                                  / 'gold' / 'platinum', discount_percent > 0
--       · Gold + urgent toggle   → priority = 'urgent'
--
--  3. Kung member ka at naka-0 pa rin ang discount_percent, hindi ito DB
--     problem — check kung `membership_status = 'active'` sa `profiles`.
-- ═══════════════════════════════════════════════════════════════════════════

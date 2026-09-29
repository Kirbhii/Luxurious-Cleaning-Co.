-- ─── App ↔ DB alignment ─────────────────────────────────────────────────────
-- RUN 004a FIRST (enum values must be committed before the policy below
-- that references them). Then run this file.

-- 1. Resume / supporting-document attachments on applications
ALTER TABLE public.training_applications
  ADD COLUMN IF NOT EXISTS resume_name TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT;

ALTER TABLE public.partner_applications
  ADD COLUMN IF NOT EXISTS resume_name TEXT,
  ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- 2. Admins can remove training records (e.g. finished trainees)
DROP POLICY IF EXISTS "training_apps: delete admin" ON public.training_applications;
CREATE POLICY "training_apps: delete admin"
  ON public.training_applications FOR DELETE
  USING (public.current_user_role() = 'admin');

-- 2b. Customers can delete their own inactive bookings (pending/cancelled/etc.)
DROP POLICY IF EXISTS "bookings: customer delete own" ON public.bookings;
CREATE POLICY "bookings: customer delete own"
  ON public.bookings FOR DELETE
  USING (
    customer_id = auth.uid()
    AND status IN ('pending', 'cancelled', 'awaiting_review', 'rejected')
  );

-- 3. Seed the four training programs shown on the Training page
-- (skipped if programs already exist)
INSERT INTO public.training_programs
  (name, description, requirements, duration, objectives, schedule, slots, slots_available, price, is_active)
SELECT * FROM (VALUES
  (
    'Professional Cleaning Fundamentals',
    'The essential foundation for all cleaning professionals. Covers techniques, products, and professional standards expected by Luxurious Cleaning Co.',
    'No prior experience required. Must be 18+ and able to lift 11 kg.',
    '30 days (120 hours)',
    ARRAY['Master residential cleaning techniques', 'Understand product safety and usage', 'Build professional client interaction skills', 'Learn quality inspection standards'],
    'Monthly — first Monday & Tuesday',
    12, 4, NULL, TRUE
  ),
  (
    'Deep Cleaning Techniques',
    'Advanced deep-cleaning methods for tackling the most demanding residential and commercial environments.',
    'Completion of Fundamentals or 6 months cleaning experience.',
    '15 days (60 hours)',
    ARRAY['Advanced degreasing and disinfection', 'Appliance and oven deep cleaning', 'Grout and tile restoration', 'Odour elimination methods'],
    'Bi-monthly — third Saturday',
    10, 7, 4500, TRUE
  ),
  (
    'Post-Construction Cleaning',
    'Specialized training for post-construction environments including debris handling, surface care, and site safety.',
    'Deep Cleaning Techniques certification required.',
    '45 days (180 hours)',
    ARRAY['Construction debris and hazardous material awareness', 'Protecting high-end surfaces and finishes', 'Window and glass cleaning techniques', 'Final inspection protocols for developers'],
    'Quarterly',
    8, 3, 8500, TRUE
  ),
  (
    'Commercial & Office Cleaning',
    'Professional training for commercial environments, with a focus on minimal disruption and security protocols.',
    'Fundamentals certification.',
    '30 days (120 hours)',
    ARRAY['After-hours cleaning protocols', 'Office equipment safety', 'High-traffic area maintenance', 'Client confidentiality and access controls'],
    'Monthly — second Wednesday',
    15, 9, 3500, TRUE
  )
) AS seed(name, description, requirements, duration, objectives, schedule, slots, slots_available, price, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.training_programs);

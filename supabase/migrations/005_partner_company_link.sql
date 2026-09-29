-- ─── Partner companies linkage ──────────────────────────────────────────────
-- Lets approved partners own a company record so their projects satisfy the
-- partner_projects.partner_id foreign key and pass RLS.

-- 1. Link applications to their company record
ALTER TABLE public.partner_applications
  ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES public.partner_companies(id);

-- 2. Admins can update any profile (used to tag the applicant's company)
DROP POLICY IF EXISTS "profiles: admin update" ON public.profiles;
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (public.current_user_role() = 'admin')
  WITH CHECK (TRUE);

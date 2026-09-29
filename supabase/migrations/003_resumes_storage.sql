-- ─── Resumes storage bucket ───────────────────────────────────────────────────
-- Public bucket for applicant resumes / company profiles uploaded from the
-- Training and Partnerships application forms. Paths are unguessable
-- (<userId>/<timestamp>_<random>_<filename>).

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

-- Public read (URLs are unguessable; staff open them from the admin dashboard)
DROP POLICY IF EXISTS "resumes: public read" ON storage.objects;
CREATE POLICY "resumes: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes');

-- Logged-in applicants can upload their own resume
DROP POLICY IF EXISTS "resumes: authenticated upload" ON storage.objects;
CREATE POLICY "resumes: authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'resumes');

-- Applicants can replace/delete their own uploads if needed
DROP POLICY IF EXISTS "resumes: owner update" ON storage.objects;
CREATE POLICY "resumes: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "resumes: owner delete" ON storage.objects;
CREATE POLICY "resumes: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

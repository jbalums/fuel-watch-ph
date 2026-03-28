ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_filename text;

INSERT INTO storage.buckets (id, name, public)
SELECT 'fuel-report-photos', 'fuel-report-photos', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'fuel-report-photos'
);

CREATE POLICY "Users can upload own fuel report photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fuel-report-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own fuel report photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'fuel-report-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own fuel report photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'fuel-report-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Uploaders and admins can view fuel report photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fuel-report-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

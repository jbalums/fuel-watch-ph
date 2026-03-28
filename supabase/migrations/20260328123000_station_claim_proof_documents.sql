ALTER TABLE public.station_claim_requests
  ADD COLUMN IF NOT EXISTS proof_document_path text,
  ADD COLUMN IF NOT EXISTS proof_document_filename text;

INSERT INTO storage.buckets (id, name, public)
SELECT 'station-claim-documents', 'station-claim-documents', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'station-claim-documents'
);

CREATE POLICY "Users can upload own station claim documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'station-claim-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own station claim documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'station-claim-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own station claim documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'station-claim-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users and admins can view station claim documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'station-claim-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);

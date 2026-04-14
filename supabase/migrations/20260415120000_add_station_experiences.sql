CREATE TABLE IF NOT EXISTS public.station_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.gas_stations(id) ON DELETE SET NULL,
  source text,
  external_id text,
  station_name text NOT NULL,
  station_address text NOT NULL,
  lat double precision,
  lng double precision,
  province_code text,
  city_municipality_code text,
  sentiment text NOT NULL CHECK (sentiment IN ('good', 'bad')),
  experience_text text NOT NULL,
  photo_paths text[] NOT NULL DEFAULT '{}'::text[],
  photo_filenames text[] NOT NULL DEFAULT '{}'::text[],
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_experiences_identity_check CHECK (
    station_id IS NOT NULL
    OR (
      source IS NOT NULL
      AND external_id IS NOT NULL
    )
  ),
  CONSTRAINT station_experiences_photo_arrays_same_length CHECK (
    cardinality(photo_paths) = cardinality(photo_filenames)
  )
);

CREATE INDEX IF NOT EXISTS station_experiences_review_status_created_at_idx
ON public.station_experiences (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS station_experiences_station_id_created_at_idx
ON public.station_experiences (station_id, created_at DESC);

CREATE INDEX IF NOT EXISTS station_experiences_discovered_identity_created_at_idx
ON public.station_experiences (source, external_id, created_at DESC);

CREATE INDEX IF NOT EXISTS station_experiences_scope_created_at_idx
ON public.station_experiences (province_code, city_municipality_code, created_at DESC);

ALTER TABLE public.station_experiences
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved station experiences are viewable by everyone" ON public.station_experiences;
CREATE POLICY "Approved station experiences are viewable by everyone"
ON public.station_experiences
FOR SELECT
USING (review_status = 'approved');

DROP POLICY IF EXISTS "Users can view own station experiences" ON public.station_experiences;
CREATE POLICY "Users can view own station experiences"
ON public.station_experiences
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Scoped reviewers can view station experiences" ON public.station_experiences;
CREATE POLICY "Scoped reviewers can view station experiences"
ON public.station_experiences
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

DROP POLICY IF EXISTS "Users can submit own station experiences" ON public.station_experiences;
CREATE POLICY "Users can submit own station experiences"
ON public.station_experiences
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own pending station experiences" ON public.station_experiences;
CREATE POLICY "Users can update own pending station experiences"
ON public.station_experiences
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND review_status = 'pending'
)
WITH CHECK (
  auth.uid() = user_id
  AND review_status = 'pending'
);

DROP POLICY IF EXISTS "Users can delete own pending station experiences" ON public.station_experiences;
CREATE POLICY "Users can delete own pending station experiences"
ON public.station_experiences
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND review_status = 'pending'
);

DROP POLICY IF EXISTS "Scoped reviewers can moderate station experiences" ON public.station_experiences;
CREATE POLICY "Scoped reviewers can moderate station experiences"
ON public.station_experiences
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

DROP TRIGGER IF EXISTS update_station_experiences_updated_at
ON public.station_experiences;
CREATE TRIGGER update_station_experiences_updated_at
BEFORE UPDATE ON public.station_experiences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
SELECT 'station-experience-photos', 'station-experience-photos', false
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'station-experience-photos'
);

DROP POLICY IF EXISTS "Users can upload own station experience photos" ON storage.objects;
CREATE POLICY "Users can upload own station experience photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'station-experience-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update own station experience photos" ON storage.objects;
CREATE POLICY "Users can update own station experience photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'station-experience-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'station-experience-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can delete own station experience photos" ON storage.objects;
CREATE POLICY "Users can delete own station experience photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'station-experience-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Approved station experience photos are viewable by everyone" ON storage.objects;
CREATE POLICY "Approved station experience photos are viewable by everyone"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'station-experience-photos'
  AND EXISTS (
    SELECT 1
    FROM public.station_experiences AS se
    WHERE se.review_status = 'approved'
      AND name = ANY(se.photo_paths)
  )
);

DROP POLICY IF EXISTS "Uploaders and scoped reviewers can view station experience photos" ON storage.objects;
CREATE POLICY "Uploaders and scoped reviewers can view station experience photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'station-experience-photos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.station_experiences AS se
      WHERE name = ANY(se.photo_paths)
        AND public.can_manage_geo_scope(
          auth.uid(),
          se.province_code,
          se.city_municipality_code
        )
    )
  )
);

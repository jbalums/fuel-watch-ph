CREATE TABLE IF NOT EXISTS public.station_brand_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name text NOT NULL,
  match_keywords text[] NOT NULL DEFAULT '{}',
  logo_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.station_brand_logos
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand logos are viewable by everyone" ON public.station_brand_logos;
CREATE POLICY "Brand logos are viewable by everyone"
ON public.station_brand_logos
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert brand logos" ON public.station_brand_logos;
CREATE POLICY "Admins can insert brand logos"
ON public.station_brand_logos
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update brand logos" ON public.station_brand_logos;
CREATE POLICY "Admins can update brand logos"
ON public.station_brand_logos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete brand logos" ON public.station_brand_logos;
CREATE POLICY "Admins can delete brand logos"
ON public.station_brand_logos
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_station_brand_logos_updated_at
ON public.station_brand_logos;
CREATE TRIGGER update_station_brand_logos_updated_at
BEFORE UPDATE ON public.station_brand_logos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS station_brand_logo_id uuid REFERENCES public.station_brand_logos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gas_stations_station_brand_logo_id_idx
  ON public.gas_stations (station_brand_logo_id);

INSERT INTO storage.buckets (id, name, public)
SELECT 'station-brand-logos', 'station-brand-logos', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'station-brand-logos'
);

DROP POLICY IF EXISTS "Brand logos are publicly viewable" ON storage.objects;
CREATE POLICY "Brand logos are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'station-brand-logos');

DROP POLICY IF EXISTS "Admins can upload brand logos" ON storage.objects;
CREATE POLICY "Admins can upload brand logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'station-brand-logos'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can update brand logos in storage" ON storage.objects;
CREATE POLICY "Admins can update brand logos in storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'station-brand-logos'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'station-brand-logos'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can delete brand logos in storage" ON storage.objects;
CREATE POLICY "Admins can delete brand logos in storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'station-brand-logos'
  AND public.has_role(auth.uid(), 'admin')
);

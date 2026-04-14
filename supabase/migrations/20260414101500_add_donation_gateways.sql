CREATE TABLE IF NOT EXISTS public.donation_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text NOT NULL,
  account_name text,
  account_number text,
  wallet_details text,
  qr_image_path text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donation_gateways
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Donation gateways are viewable by everyone" ON public.donation_gateways;
CREATE POLICY "Donation gateways are viewable by everyone"
ON public.donation_gateways
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can insert donation gateways" ON public.donation_gateways;
CREATE POLICY "Admins can insert donation gateways"
ON public.donation_gateways
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update donation gateways" ON public.donation_gateways;
CREATE POLICY "Admins can update donation gateways"
ON public.donation_gateways
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete donation gateways" ON public.donation_gateways;
CREATE POLICY "Admins can delete donation gateways"
ON public.donation_gateways
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_donation_gateways_updated_at
ON public.donation_gateways;
CREATE TRIGGER update_donation_gateways_updated_at
BEFORE UPDATE ON public.donation_gateways
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
SELECT 'donation-gateways', 'donation-gateways', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'donation-gateways'
);

DROP POLICY IF EXISTS "Donation gateway qr images are publicly viewable" ON storage.objects;
CREATE POLICY "Donation gateway qr images are publicly viewable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'donation-gateways');

DROP POLICY IF EXISTS "Admins can upload donation gateway qr images" ON storage.objects;
CREATE POLICY "Admins can upload donation gateway qr images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'donation-gateways'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can update donation gateway qr images" ON storage.objects;
CREATE POLICY "Admins can update donation gateway qr images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'donation-gateways'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'donation-gateways'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins can delete donation gateway qr images" ON storage.objects;
CREATE POLICY "Admins can delete donation gateway qr images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'donation-gateways'
  AND public.has_role(auth.uid(), 'admin')
);

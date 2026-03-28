ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gas_stations_manager_user_id_idx
  ON public.gas_stations (manager_user_id);

CREATE TABLE IF NOT EXISTS public.station_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES public.gas_stations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  notes text,
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_claim_requests_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected'))
);

ALTER TABLE public.station_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_station_claim_requests_updated_at
BEFORE UPDATE ON public.station_claim_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS station_claim_requests_station_idx
  ON public.station_claim_requests (station_id, created_at DESC);

CREATE INDEX IF NOT EXISTS station_claim_requests_user_idx
  ON public.station_claim_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS station_claim_requests_review_status_idx
  ON public.station_claim_requests (review_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS station_claim_requests_pending_per_user_station_idx
  ON public.station_claim_requests (station_id, user_id)
  WHERE review_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS station_claim_requests_approved_per_station_idx
  ON public.station_claim_requests (station_id)
  WHERE review_status = 'approved';

CREATE POLICY "Users can view own station claims"
ON public.station_claim_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can insert own station claims"
ON public.station_claim_requests
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND review_status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM public.gas_stations station
    WHERE station.id = station_id
      AND COALESCE(station.is_verified, false) = false
      AND station.manager_user_id IS NULL
  )
);

CREATE POLICY "Admins can update station claims"
ON public.station_claim_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.approve_station_claim(_claim_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_user_id uuid := auth.uid();
  _claim public.station_claim_requests%ROWTYPE;
  _station public.gas_stations%ROWTYPE;
BEGIN
  IF _admin_user_id IS NULL OR NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve station claims';
  END IF;

  SELECT *
  INTO _claim
  FROM public.station_claim_requests
  WHERE id = _claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station claim request not found';
  END IF;

  IF _claim.review_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending station claims can be approved';
  END IF;

  SELECT *
  INTO _station
  FROM public.gas_stations
  WHERE id = _claim.station_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station not found';
  END IF;

  IF COALESCE(_station.is_verified, false) OR _station.manager_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'This station has already been claimed';
  END IF;

  UPDATE public.gas_stations
  SET is_verified = true,
      verified_at = now(),
      manager_user_id = _claim.user_id
  WHERE id = _station.id;

  UPDATE public.station_claim_requests
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_user_id
  WHERE id = _claim.id;

  UPDATE public.station_claim_requests
  SET review_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = _admin_user_id
  WHERE station_id = _claim.station_id
    AND id <> _claim.id
    AND review_status = 'pending';

  RETURN _station.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_station_claim(_claim_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_user_id uuid := auth.uid();
  _claim public.station_claim_requests%ROWTYPE;
BEGIN
  IF _admin_user_id IS NULL OR NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject station claims';
  END IF;

  SELECT *
  INTO _claim
  FROM public.station_claim_requests
  WHERE id = _claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station claim request not found';
  END IF;

  IF _claim.review_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending station claims can be rejected';
  END IF;

  UPDATE public.station_claim_requests
  SET review_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = _admin_user_id
  WHERE id = _claim.id;

  RETURN _claim.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_managed_station(
  _station_id uuid,
  _address text,
  _status text,
  _fuel_type text,
  _prices jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _station public.gas_stations%ROWTYPE;
  _selected_price_text text;
  _selected_price numeric;
BEGIN
  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _fuel_type NOT IN ('Unleaded', 'Premium', 'Diesel') THEN
    RAISE EXCEPTION 'Invalid fuel type';
  END IF;

  IF _status NOT IN ('Available', 'Low', 'Out') THEN
    RAISE EXCEPTION 'Invalid station status';
  END IF;

  IF btrim(COALESCE(_address, '')) = '' THEN
    RAISE EXCEPTION 'Station address is required';
  END IF;

  SELECT *
  INTO _station
  FROM public.gas_stations
  WHERE id = _station_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station not found';
  END IF;

  IF _station.manager_user_id <> _current_user_id OR COALESCE(_station.is_verified, false) = false THEN
    RAISE EXCEPTION 'You are not allowed to manage this station';
  END IF;

  _selected_price_text := NULLIF(btrim(COALESCE(_prices ->> _fuel_type, '')), '');

  IF _selected_price_text IS NULL THEN
    RAISE EXCEPTION 'Selected fuel type must include a valid price';
  END IF;

  BEGIN
    _selected_price := _selected_price_text::numeric;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Selected fuel type must include a valid price';
  END;

  IF _selected_price <= 0 THEN
    RAISE EXCEPTION 'Selected fuel type must include a valid price';
  END IF;

  UPDATE public.gas_stations
  SET address = btrim(_address),
      status = _status,
      fuel_type = _fuel_type,
      prices = _prices,
      price_per_liter = _selected_price
  WHERE id = _station.id;

  RETURN _station.id;
END;
$$;

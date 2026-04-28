CREATE OR REPLACE FUNCTION public.release_managed_station(_station_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid := auth.uid();
  _station public.gas_stations%ROWTYPE;
BEGIN
  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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
    RAISE EXCEPTION 'You are not allowed to release this station';
  END IF;

  UPDATE public.gas_stations
  SET manager_user_id = NULL,
      is_verified = false,
      verified_at = NULL
  WHERE id = _station.id;

  DELETE FROM public.station_claim_requests
  WHERE station_id = _station.id
    AND user_id = _current_user_id
    AND review_status = 'approved';

  RETURN _station.id;
END;
$$;

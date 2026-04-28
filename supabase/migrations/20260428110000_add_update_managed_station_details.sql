CREATE OR REPLACE FUNCTION public.update_managed_station_details(
  _station_id uuid,
  _address text
)
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

  UPDATE public.gas_stations
  SET address = btrim(_address)
  WHERE id = _station.id;

  RETURN _station.id;
END;
$$;

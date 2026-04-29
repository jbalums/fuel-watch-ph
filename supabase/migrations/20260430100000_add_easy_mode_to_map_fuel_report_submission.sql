DROP FUNCTION IF EXISTS public.submit_map_fuel_report(
  uuid,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text
);

CREATE OR REPLACE FUNCTION public.submit_map_fuel_report(
  _station_id uuid DEFAULT NULL,
  _station_name text DEFAULT NULL,
  _reported_address text DEFAULT NULL,
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _province_code text DEFAULT NULL,
  _city_municipality_code text DEFAULT NULL,
  _prices jsonb DEFAULT NULL,
  _fuel_availability jsonb DEFAULT NULL,
  _photo_path text DEFAULT NULL,
  _photo_filename text DEFAULT NULL,
  _submission_mode text DEFAULT 'standard'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _station public.gas_stations%ROWTYPE;
  _fuel_types text[] := ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'];
  _fuel_type text;
  _raw_price text;
  _candidate_price numeric(10,2);
  _candidate_status text;
  _has_reported_fuel boolean := false;
  _selected_fuel_type text := NULL;
  _selected_price numeric(10,2) := NULL;
  _selected_status text := NULL;
  _resolved_station_id uuid := _station_id;
  _resolved_station_name text := NULLIF(btrim(COALESCE(_station_name, '')), '');
  _resolved_address text := NULLIF(btrim(COALESCE(_reported_address, '')), '');
  _resolved_lat double precision := _lat;
  _resolved_lng double precision := _lng;
  _resolved_province_code text := NULLIF(btrim(COALESCE(_province_code, '')), '');
  _resolved_city_municipality_code text := NULLIF(btrim(COALESCE(_city_municipality_code, '')), '');
  _normalized_prices jsonb := public.empty_fuel_price_map() || COALESCE(_prices, '{}'::jsonb);
  _normalized_fuel_availability jsonb := public.empty_fuel_availability_map() || COALESCE(_fuel_availability, '{}'::jsonb);
  _resolved_photo_path text := NULLIF(btrim(COALESCE(_photo_path, '')), '');
  _resolved_photo_filename text := NULLIF(btrim(COALESCE(_photo_filename, '')), '');
  _normalized_submission_mode text := lower(NULLIF(btrim(COALESCE(_submission_mode, '')), ''));
  _report_id uuid;
BEGIN
  _normalized_submission_mode := COALESCE(_normalized_submission_mode, 'standard');

  IF _normalized_submission_mode NOT IN ('standard', 'easy') THEN
    RAISE EXCEPTION 'Submission mode is invalid';
  END IF;

  IF _station_id IS NOT NULL THEN
    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE id = _station_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected station was not found';
    END IF;

    _resolved_station_name := _station.name;
    _resolved_address := _station.address;
    _resolved_lat := _station.lat;
    _resolved_lng := _station.lng;
    _resolved_province_code := COALESCE(_station.province_code, _resolved_province_code);
    _resolved_city_municipality_code := COALESCE(
      _station.city_municipality_code,
      _resolved_city_municipality_code
    );
  END IF;

  IF _resolved_station_name IS NULL THEN
    RAISE EXCEPTION 'Station name is required';
  END IF;

  IF _resolved_lat IS NULL OR _resolved_lng IS NULL THEN
    RAISE EXCEPTION 'Station coordinates are required';
  END IF;

  IF _resolved_lat < -90 OR _resolved_lat > 90 OR _resolved_lng < -180 OR _resolved_lng > 180 THEN
    RAISE EXCEPTION 'Station coordinates are invalid';
  END IF;

  IF _resolved_address IS NULL THEN
    _resolved_address := format(
      'Pinned location (%s, %s)',
      round(_resolved_lat::numeric, 6),
      round(_resolved_lng::numeric, 6)
    );
  END IF;

  IF _resolved_province_code IS NULL OR _resolved_city_municipality_code IS NULL THEN
    RAISE EXCEPTION 'Province and city/municipality are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.geo_cities_municipalities
    WHERE code = _resolved_city_municipality_code
      AND province_code = _resolved_province_code
  ) THEN
    RAISE EXCEPTION 'Selected city/municipality does not belong to the selected province';
  END IF;

  IF _resolved_photo_path IS NOT NULL THEN
    IF _actor_id IS NULL AND split_part(_resolved_photo_path, '/', 1) <> 'anonymous' THEN
      RAISE EXCEPTION 'Anonymous photo uploads must use the anonymous folder';
    END IF;

    IF _actor_id IS NOT NULL AND split_part(_resolved_photo_path, '/', 1) <> _actor_id::text THEN
      RAISE EXCEPTION 'Photo upload path does not match the signed-in user';
    END IF;
  END IF;

  IF _normalized_submission_mode = 'easy' THEN
    IF _resolved_photo_path IS NULL THEN
      RAISE EXCEPTION 'Upload a fuel price photo for Easy Report';
    END IF;

    _normalized_prices := public.empty_fuel_price_map();
    _normalized_fuel_availability := public.empty_fuel_availability_map();
  ELSE
    FOREACH _fuel_type IN ARRAY _fuel_types LOOP
      _raw_price := NULLIF(btrim(COALESCE(_normalized_prices ->> _fuel_type, '')), '');
      _candidate_price := NULL;
      _candidate_status := NULLIF(btrim(COALESCE(_normalized_fuel_availability ->> _fuel_type, '')), '');

      IF _raw_price IS NOT NULL THEN
        BEGIN
          _candidate_price := _raw_price::numeric(10,2);
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION '% price must be a valid number', _fuel_type;
        END;

        IF _candidate_price <= 0 THEN
          RAISE EXCEPTION '% price must be greater than 0', _fuel_type;
        END IF;
      END IF;

      IF _candidate_status IS NOT NULL
        AND _candidate_status NOT IN ('Available', 'Low', 'Out') THEN
        RAISE EXCEPTION '% availability is invalid', _fuel_type;
      END IF;

      IF _candidate_status IS NULL AND _candidate_price IS NULL THEN
        CONTINUE;
      END IF;

      _has_reported_fuel := true;

      IF _candidate_status IS NULL AND _candidate_price IS NOT NULL THEN
        _candidate_status := 'Available';
        _normalized_fuel_availability :=
          _normalized_fuel_availability || jsonb_build_object(_fuel_type, _candidate_status);
      END IF;

      IF _candidate_status = 'Out' AND _candidate_price IS NOT NULL THEN
        RAISE EXCEPTION '% must not have a price when marked Out', _fuel_type;
      END IF;

      IF _candidate_status IN ('Available', 'Low') AND _candidate_price IS NULL THEN
        RAISE EXCEPTION '% must have a valid price when marked %', _fuel_type, _candidate_status;
      END IF;

      IF _candidate_status IN ('Available', 'Low')
        AND (
          _selected_price IS NULL
          OR _candidate_price < _selected_price
        ) THEN
        _selected_fuel_type := _fuel_type;
        _selected_price := _candidate_price;
        _selected_status := _candidate_status;
      END IF;
    END LOOP;

    IF NOT _has_reported_fuel THEN
      RAISE EXCEPTION 'Add at least one fuel price or availability status';
    END IF;

    IF _selected_fuel_type IS NULL THEN
      FOREACH _fuel_type IN ARRAY _fuel_types LOOP
        _candidate_status := NULLIF(
          btrim(COALESCE(_normalized_fuel_availability ->> _fuel_type, '')),
          ''
        );

        IF _candidate_status IS NOT NULL THEN
          _selected_fuel_type := _fuel_type;
          _selected_price := 0;
          _selected_status := _candidate_status;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF _selected_fuel_type IS NULL OR _selected_status IS NULL OR _selected_price IS NULL THEN
      RAISE EXCEPTION 'Fuel report summary could not be resolved';
    END IF;
  END IF;

  INSERT INTO public.fuel_reports (
    user_id,
    submission_mode,
    station_id,
    station_name,
    reported_address,
    lat,
    lng,
    province_code,
    city_municipality_code,
    prices,
    fuel_availability,
    fuel_type,
    price,
    status,
    photo_path,
    photo_filename,
    review_status
  )
  VALUES (
    _actor_id,
    _normalized_submission_mode,
    _resolved_station_id,
    _resolved_station_name,
    _resolved_address,
    _resolved_lat,
    _resolved_lng,
    _resolved_province_code,
    _resolved_city_municipality_code,
    _normalized_prices,
    _normalized_fuel_availability,
    _selected_fuel_type,
    _selected_price,
    _selected_status,
    _resolved_photo_path,
    _resolved_photo_filename,
    'pending'
  )
  RETURNING id INTO _report_id;

  RETURN _report_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_map_fuel_report(
  uuid,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_map_fuel_report(
  uuid,
  text,
  text,
  double precision,
  double precision,
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  text
) TO anon, authenticated;

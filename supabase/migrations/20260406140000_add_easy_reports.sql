ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS submission_mode text NOT NULL DEFAULT 'standard';

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_submission_mode_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_submission_mode_check
  CHECK (submission_mode IN ('standard', 'easy'));

ALTER TABLE public.fuel_reports
  ALTER COLUMN station_name DROP NOT NULL,
  ALTER COLUMN price DROP NOT NULL,
  ALTER COLUMN fuel_type DROP NOT NULL,
  ALTER COLUMN status DROP NOT NULL;

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_standard_payload_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_standard_payload_check
  CHECK (
    submission_mode <> 'standard'
    OR (
      station_name IS NOT NULL
      AND btrim(station_name) <> ''
      AND price IS NOT NULL
      AND fuel_type IS NOT NULL
      AND status IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION public.approve_easy_fuel_report(
  _report_id uuid,
  _station_name text,
  _station_id uuid DEFAULT NULL,
  _reported_address text DEFAULT NULL,
  _province_code text DEFAULT NULL,
  _city_municipality_code text DEFAULT NULL,
  _prices jsonb DEFAULT NULL,
  _fuel_availability jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _report public.fuel_reports%ROWTYPE;
  _linked_station public.gas_stations%ROWTYPE;
  _scope_province text;
  _scope_city text;
  _normalized_station_name text := NULLIF(btrim(COALESCE(_station_name, '')), '');
  _normalized_address text := NULLIF(btrim(COALESCE(_reported_address, '')), '');
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO _report
  FROM public.fuel_reports
  WHERE id = _report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fuel report not found';
  END IF;

  IF COALESCE(_report.submission_mode, 'standard') <> 'easy' THEN
    RAISE EXCEPTION 'Only easy reports can be completed with this action';
  END IF;

  IF _report.review_status = 'approved' THEN
    RAISE EXCEPTION 'This report has already been approved';
  END IF;

  IF _report.review_status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected reports cannot be approved';
  END IF;

  IF _station_id IS NOT NULL THEN
    SELECT *
    INTO _linked_station
    FROM public.gas_stations
    WHERE id = _station_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected station no longer exists';
    END IF;

    _normalized_station_name := btrim(_linked_station.name);
    _normalized_address := COALESCE(
      _normalized_address,
      NULLIF(btrim(_linked_station.address), '')
    );
  END IF;

  IF _normalized_station_name IS NULL THEN
    RAISE EXCEPTION 'Station name is required';
  END IF;

  _scope_province := COALESCE(
    NULLIF(btrim(COALESCE(_province_code, '')), ''),
    _linked_station.province_code,
    _report.province_code
  );
  _scope_city := COALESCE(
    NULLIF(btrim(COALESCE(_city_municipality_code, '')), ''),
    _linked_station.city_municipality_code,
    _report.city_municipality_code
  );

  IF _scope_province IS NULL OR _scope_city IS NULL THEN
    RAISE EXCEPTION 'Province and city or municipality are required';
  END IF;

  IF NOT public.can_manage_geo_scope(_actor_id, _scope_province, _scope_city) THEN
    RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
  END IF;

  IF _normalized_address IS NULL THEN
    _normalized_address := NULLIF(btrim(COALESCE(_report.reported_address, '')), '');
  END IF;

  UPDATE public.fuel_reports
  SET station_id = _station_id,
      station_name = _normalized_station_name,
      reported_address = _normalized_address,
      province_code = _scope_province,
      city_municipality_code = _scope_city,
      prices = public.empty_fuel_price_map() || COALESCE(_prices, '{}'::jsonb),
      fuel_availability = public.empty_fuel_availability_map() || COALESCE(_fuel_availability, '{}'::jsonb)
  WHERE id = _report.id;

  RETURN public.approve_fuel_report(_report.id);
END;
$$;

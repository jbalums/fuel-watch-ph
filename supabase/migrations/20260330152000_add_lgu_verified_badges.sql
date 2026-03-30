ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS is_lgu_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgu_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgu_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lgu_verified_role public.app_role;

ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS is_lgu_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lgu_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgu_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lgu_verified_role public.app_role;

ALTER TABLE public.gas_stations
  DROP CONSTRAINT IF EXISTS gas_stations_lgu_verified_role_check;

ALTER TABLE public.gas_stations
  ADD CONSTRAINT gas_stations_lgu_verified_role_check
  CHECK (
    lgu_verified_role IS NULL
    OR lgu_verified_role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  );

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_lgu_verified_role_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_lgu_verified_role_check
  CHECK (
    lgu_verified_role IS NULL
    OR lgu_verified_role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.get_lgu_verifier_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'city_admin'::public.app_role
  ) THEN
    RETURN 'city_admin'::public.app_role;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'province_admin'::public.app_role
  ) THEN
    RETURN 'province_admin'::public.app_role;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_fuel_report(_report_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_user_id uuid := auth.uid();
  _match_count integer;
  _report public.fuel_reports%ROWTYPE;
  _station public.gas_stations%ROWTYPE;
  _report_prices jsonb := jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL
  );
  _candidate_fuel_type text;
  _candidate_price_text text;
  _candidate_price numeric;
  _selected_fuel_type text;
  _selected_price numeric;
  _resolved_address text;
  _scope_province text;
  _scope_city text;
  _lgu_verified_role public.app_role := public.get_lgu_verifier_role(_admin_user_id);
  _is_lgu_verified boolean := _lgu_verified_role IS NOT NULL;
BEGIN
  IF _admin_user_id IS NULL THEN
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

  IF _report.review_status = 'approved' THEN
    RAISE EXCEPTION 'This report has already been approved';
  END IF;

  IF _report.review_status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected reports cannot be approved';
  END IF;

  _report_prices := COALESCE(_report.prices, _report_prices);

  IF _report.price > 0
    AND NULLIF(btrim(COALESCE(_report_prices ->> _report.fuel_type, '')), '') IS NULL THEN
    _report_prices := _report_prices || jsonb_build_object(_report.fuel_type, to_jsonb(_report.price));
  END IF;

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel'] LOOP
    _candidate_price_text := NULLIF(
      btrim(COALESCE(_report_prices ->> _candidate_fuel_type, '')),
      ''
    );

    IF _candidate_price_text IS NULL THEN
      CONTINUE;
    END IF;

    _candidate_price := _candidate_price_text::numeric;

    IF _candidate_price <= 0 THEN
      CONTINUE;
    END IF;

    IF _selected_price IS NULL OR _candidate_price < _selected_price THEN
      _selected_price := _candidate_price;
      _selected_fuel_type := _candidate_fuel_type;
    END IF;
  END LOOP;

  IF _selected_price IS NULL OR _selected_fuel_type IS NULL THEN
    RAISE EXCEPTION 'Report must include at least one valid fuel price';
  END IF;

  IF _report.station_id IS NOT NULL THEN
    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE id = _report.station_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected station no longer exists';
    END IF;

    _scope_province := COALESCE(_report.province_code, _station.province_code);
    _scope_city := COALESCE(_report.city_municipality_code, _station.city_municipality_code);

    IF NOT public.can_manage_geo_scope(_admin_user_id, _scope_province, _scope_city) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = COALESCE(
          prices,
          jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
        ) || jsonb_strip_nulls(_report_prices),
        status = _report.status,
        report_count = COALESCE(report_count, 0) + 1,
        province_code = COALESCE(gas_stations.province_code, _report.province_code),
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code),
        is_lgu_verified = _is_lgu_verified,
        lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
        lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
        lgu_verified_role = _lgu_verified_role
    WHERE id = _station.id
    RETURNING * INTO _station;

  ELSIF _report.reported_address IS NULL THEN
    SELECT COUNT(*)
    INTO _match_count
    FROM public.gas_stations
    WHERE lower(btrim(name)) = lower(btrim(_report.station_name));

    IF _match_count = 0 THEN
      RAISE EXCEPTION 'No station matched this report name';
    END IF;

    IF _match_count > 1 THEN
      RAISE EXCEPTION 'Multiple stations matched this report name';
    END IF;

    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE lower(btrim(name)) = lower(btrim(_report.station_name))
    LIMIT 1
    FOR UPDATE;

    _scope_province := COALESCE(_report.province_code, _station.province_code);
    _scope_city := COALESCE(_report.city_municipality_code, _station.city_municipality_code);

    IF NOT public.can_manage_geo_scope(_admin_user_id, _scope_province, _scope_city) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = COALESCE(
          prices,
          jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
        ) || jsonb_strip_nulls(_report_prices),
        status = _report.status,
        report_count = COALESCE(report_count, 0) + 1,
        province_code = COALESCE(gas_stations.province_code, _report.province_code),
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code),
        is_lgu_verified = _is_lgu_verified,
        lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
        lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
        lgu_verified_role = _lgu_verified_role
    WHERE id = _station.id
    RETURNING * INTO _station;

  ELSE
    IF _report.lat IS NULL OR _report.lng IS NULL THEN
      RAISE EXCEPTION 'Location is required to create a new station';
    END IF;

    IF _report.province_code IS NULL OR _report.city_municipality_code IS NULL THEN
      RAISE EXCEPTION 'Report geographic scope must be assigned before approval';
    END IF;

    IF NOT public.can_manage_geo_scope(
      _admin_user_id,
      _report.province_code,
      _report.city_municipality_code
    ) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    _resolved_address := NULLIF(btrim(_report.reported_address), '');

    IF _resolved_address IS NULL THEN
      _resolved_address := 'Pinned location (' ||
        round(_report.lat::numeric, 6) || ', ' ||
        round(_report.lng::numeric, 6) || ')';
    END IF;

    INSERT INTO public.gas_stations (
      name,
      address,
      lat,
      lng,
      status,
      fuel_type,
      price_per_liter,
      prices,
      report_count,
      province_code,
      city_municipality_code,
      is_lgu_verified,
      lgu_verified_at,
      lgu_verified_by,
      lgu_verified_role
    )
    VALUES (
      btrim(_report.station_name),
      _resolved_address,
      _report.lat,
      _report.lng,
      _report.status,
      _selected_fuel_type,
      _selected_price,
      jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL) ||
        jsonb_strip_nulls(_report_prices),
      1,
      _report.province_code,
      _report.city_municipality_code,
      _is_lgu_verified,
      CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
      CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
      _lgu_verified_role
    )
    RETURNING * INTO _station;
  END IF;

  UPDATE public.fuel_reports
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_user_id,
      applied_station_id = _station.id,
      province_code = COALESCE(province_code, _station.province_code),
      city_municipality_code = COALESCE(city_municipality_code, _station.city_municipality_code),
      is_lgu_verified = _is_lgu_verified,
      lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
      lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
      lgu_verified_role = _lgu_verified_role
  WHERE id = _report.id;

  RETURN _station.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.empty_fuel_price_map()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL,
    'Premium Diesel', NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.calculate_station_price_trends(
  _current_prices jsonb,
  _current_fuel_type text,
  _current_price numeric,
  _previous_prices jsonb,
  _previous_fuel_type text,
  _previous_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result jsonb := public.empty_fuel_price_map();
  _candidate_fuel_type text;
  _current_value double precision;
  _previous_value double precision;
BEGIN
  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel'] LOOP
    _current_value := public.resolve_station_fuel_price(
      _current_prices,
      _current_fuel_type,
      _current_price,
      _candidate_fuel_type
    );

    _previous_value := public.resolve_station_fuel_price(
      _previous_prices,
      _previous_fuel_type,
      _previous_price,
      _candidate_fuel_type
    );

    IF _current_value IS NULL OR _previous_value IS NULL THEN
      CONTINUE;
    END IF;

    _result := _result || jsonb_build_object(
      _candidate_fuel_type,
      to_jsonb(round((_current_value - _previous_value)::numeric, 2))
    );
  END LOOP;

  RETURN _result;
END;
$$;

ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS price_trends jsonb;

ALTER TABLE public.gas_stations
  ALTER COLUMN price_trends SET DEFAULT public.empty_fuel_price_map();

UPDATE public.gas_stations
SET price_trends = public.empty_fuel_price_map() || COALESCE(price_trends, '{}'::jsonb)
WHERE price_trends IS NULL
   OR NOT (price_trends ? 'Premium Diesel');

ALTER TABLE public.gas_stations
  ALTER COLUMN price_trends SET NOT NULL;

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

  IF _fuel_type NOT IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel') THEN
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
      price_per_liter = _selected_price,
      price_trends = public.empty_fuel_price_map()
  WHERE id = _station.id;

  RETURN _station.id;
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
  _previous_report public.fuel_reports%ROWTYPE;
  _report_prices jsonb := public.empty_fuel_price_map();
  _station_next_prices jsonb := public.empty_fuel_price_map();
  _price_trends jsonb := public.empty_fuel_price_map();
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

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel'] LOOP
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

    _station_next_prices := COALESCE(
      _station.prices,
      public.empty_fuel_price_map()
    ) || jsonb_strip_nulls(_report_prices);

    _previous_report := NULL;

    SELECT *
    INTO _previous_report
    FROM public.fuel_reports
    WHERE review_status = 'approved'
      AND COALESCE(applied_station_id, station_id) = _station.id
    ORDER BY COALESCE(reviewed_at, created_at) DESC, created_at DESC
    LIMIT 1;

    _price_trends := public.calculate_station_price_trends(
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _previous_report.prices,
      _previous_report.fuel_type,
      _previous_report.price
    );

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = _station_next_prices,
        price_trends = _price_trends,
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

    _station_next_prices := COALESCE(
      _station.prices,
      public.empty_fuel_price_map()
    ) || jsonb_strip_nulls(_report_prices);

    _previous_report := NULL;

    SELECT *
    INTO _previous_report
    FROM public.fuel_reports
    WHERE review_status = 'approved'
      AND COALESCE(applied_station_id, station_id) = _station.id
    ORDER BY COALESCE(reviewed_at, created_at) DESC, created_at DESC
    LIMIT 1;

    _price_trends := public.calculate_station_price_trends(
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _previous_report.prices,
      _previous_report.fuel_type,
      _previous_report.price
    );

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = _station_next_prices,
        price_trends = _price_trends,
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
      price_trends,
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
      public.empty_fuel_price_map() || jsonb_strip_nulls(_report_prices),
      public.empty_fuel_price_map(),
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

DROP FUNCTION IF EXISTS public.list_public_gas_stations(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  double precision,
  double precision
);

CREATE FUNCTION public.list_public_gas_stations(
  _search text DEFAULT NULL,
  _fuel_filter text DEFAULT 'All',
  _status_filter text DEFAULT 'All',
  _sort_by text DEFAULT 'price_asc',
  _province_code text DEFAULT NULL,
  _city_municipality_code text DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20,
  _user_lat double precision DEFAULT NULL,
  _user_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  province_code text,
  city_municipality_code text,
  prices jsonb,
  price_trends jsonb,
  is_verified boolean,
  is_lgu_verified boolean,
  lgu_verified_at timestamp with time zone,
  lgu_verified_by uuid,
  lgu_verified_role public.app_role,
  verified_at timestamp with time zone,
  manager_user_id uuid,
  status text,
  fuel_type text,
  price_per_liter double precision,
  updated_at timestamp with time zone,
  report_count integer,
  created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(btrim(_search), '');
  v_fuel_filter text := CASE
    WHEN _fuel_filter IN ('All', 'Unleaded', 'Premium', 'Diesel', 'Premium Diesel') THEN _fuel_filter
    ELSE 'All'
  END;
  v_status_filter text := CASE
    WHEN _status_filter IN ('All', 'Available', 'Low', 'Out') THEN _status_filter
    ELSE 'All'
  END;
  v_sort_by text := CASE
    WHEN _sort_by IN ('price_asc', 'price_desc') THEN _sort_by
    ELSE 'price_asc'
  END;
  v_province_code text := NULLIF(btrim(_province_code), '');
  v_city_municipality_code text := NULLIF(btrim(_city_municipality_code), '');
  v_page integer := GREATEST(COALESCE(_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(_page_size, 20), 1), 100);
  v_offset integer := (v_page - 1) * v_page_size;
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT
      gs.*,
      CASE
        WHEN v_fuel_filter = 'All' THEN NULL
        ELSE public.resolve_station_fuel_price(
          gs.prices,
          gs.fuel_type,
          gs.price_per_liter,
          v_fuel_filter
        )
      END AS selected_price,
      CASE
        WHEN v_fuel_filter = 'All' AND _user_lat IS NOT NULL AND _user_lng IS NOT NULL
          THEN public.calculate_station_distance_km(
            _user_lat,
            _user_lng,
            gs.lat,
            gs.lng
          )
        ELSE NULL
      END AS distance_km
    FROM public.gas_stations AS gs
    WHERE (
      v_search IS NULL
      OR gs.name ILIKE '%' || v_search || '%'
      OR gs.address ILIKE '%' || v_search || '%'
    )
      AND (
        v_status_filter = 'All'
        OR gs.status = v_status_filter
      )
      AND (
        v_province_code IS NULL
        OR gs.province_code = v_province_code
      )
      AND (
        v_city_municipality_code IS NULL
        OR gs.city_municipality_code = v_city_municipality_code
      )
      AND (
        v_fuel_filter = 'All'
        OR public.resolve_station_fuel_price(
          gs.prices,
          gs.fuel_type,
          gs.price_per_liter,
          v_fuel_filter
        ) IS NOT NULL
      )
  ),
  counts AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE
        WHEN v_fuel_filter <> 'All' AND filtered.status = 'Out' THEN 1
        ELSE 0
      END ASC,
      CASE
        WHEN v_fuel_filter = 'All' AND _user_lat IS NOT NULL AND _user_lng IS NOT NULL
          THEN filtered.distance_km
        ELSE NULL
      END ASC NULLS LAST,
      CASE
        WHEN v_fuel_filter = 'All' AND (_user_lat IS NULL OR _user_lng IS NULL)
          THEN filtered.updated_at
        ELSE NULL
      END DESC NULLS LAST,
      CASE
        WHEN v_fuel_filter <> 'All' AND v_sort_by = 'price_asc'
          THEN filtered.selected_price
        ELSE NULL
      END ASC NULLS LAST,
      CASE
        WHEN v_fuel_filter <> 'All' AND v_sort_by = 'price_desc'
          THEN filtered.selected_price
        ELSE NULL
      END DESC NULLS LAST,
      filtered.updated_at DESC
    LIMIT v_page_size
    OFFSET v_offset
  )
  SELECT
    page_rows.id,
    page_rows.name,
    page_rows.address,
    page_rows.lat,
    page_rows.lng,
    page_rows.province_code,
    page_rows.city_municipality_code,
    page_rows.prices,
    page_rows.price_trends,
    page_rows.is_verified,
    page_rows.is_lgu_verified,
    page_rows.lgu_verified_at,
    page_rows.lgu_verified_by,
    page_rows.lgu_verified_role,
    page_rows.verified_at,
    page_rows.manager_user_id,
    page_rows.status,
    page_rows.fuel_type,
    page_rows.price_per_liter::double precision,
    page_rows.updated_at,
    page_rows.report_count,
    page_rows.created_at,
    counts.total_count
  FROM counts
  LEFT JOIN page_rows ON TRUE;
END;
$$;

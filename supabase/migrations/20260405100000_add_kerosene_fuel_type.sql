ALTER TABLE public.gas_stations
  DROP CONSTRAINT IF EXISTS gas_stations_fuel_type_check;

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_fuel_type_check;

ALTER TABLE public.gas_stations
  ADD CONSTRAINT gas_stations_fuel_type_check
  CHECK (
    fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene')
  );

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_fuel_type_check
  CHECK (
    fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene')
  );

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
    'Premium Diesel', NULL,
    'Kerosene', NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.empty_fuel_availability_map()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL,
    'Premium Diesel', NULL,
    'Kerosene', NULL
  );
$$;

ALTER TABLE public.gas_stations
  ALTER COLUMN prices SET DEFAULT public.empty_fuel_price_map();

ALTER TABLE public.fuel_reports
  ALTER COLUMN prices SET DEFAULT public.empty_fuel_price_map();

ALTER TABLE public.gas_stations
  ALTER COLUMN previous_prices SET DEFAULT public.empty_fuel_price_map();

ALTER TABLE public.gas_stations
  ALTER COLUMN price_trends SET DEFAULT public.empty_fuel_price_map();

ALTER TABLE public.gas_stations
  ALTER COLUMN fuel_availability SET DEFAULT public.empty_fuel_availability_map();

ALTER TABLE public.fuel_reports
  ALTER COLUMN fuel_availability SET DEFAULT public.empty_fuel_availability_map();

UPDATE public.gas_stations
SET prices = public.empty_fuel_price_map() || COALESCE(prices, '{}'::jsonb)
WHERE prices IS NULL
   OR NOT (prices ? 'Kerosene');

UPDATE public.fuel_reports
SET prices = public.empty_fuel_price_map() || COALESCE(prices, '{}'::jsonb)
WHERE prices IS NULL
   OR NOT (prices ? 'Kerosene');

UPDATE public.gas_stations
SET previous_prices = public.empty_fuel_price_map() || COALESCE(previous_prices, '{}'::jsonb)
WHERE previous_prices IS NULL
   OR NOT (previous_prices ? 'Kerosene');

UPDATE public.gas_stations
SET price_trends = public.empty_fuel_price_map() || COALESCE(price_trends, '{}'::jsonb)
WHERE price_trends IS NULL
   OR NOT (price_trends ? 'Kerosene');

UPDATE public.gas_stations
SET fuel_availability = public.empty_fuel_availability_map() || COALESCE(
      fuel_availability,
      public.build_legacy_fuel_availability_map(
        prices,
        fuel_type,
        price_per_liter,
        status
      )
    ),
    status = public.derive_legacy_station_status(
      public.empty_fuel_availability_map() || COALESCE(
        fuel_availability,
        public.build_legacy_fuel_availability_map(
          prices,
          fuel_type,
          price_per_liter,
          status
        )
      ),
      fuel_type,
      status
    )
WHERE fuel_availability IS NULL
   OR NOT (fuel_availability ? 'Kerosene');

UPDATE public.fuel_reports
SET fuel_availability = public.empty_fuel_availability_map() || COALESCE(
      fuel_availability,
      public.build_legacy_fuel_availability_map(
        prices,
        fuel_type,
        price,
        status
      )
    ),
    status = public.derive_legacy_station_status(
      public.empty_fuel_availability_map() || COALESCE(
        fuel_availability,
        public.build_legacy_fuel_availability_map(
          prices,
          fuel_type,
          price,
          status
        )
      ),
      fuel_type,
      status
    )
WHERE fuel_availability IS NULL
   OR NOT (fuel_availability ? 'Kerosene');

CREATE OR REPLACE FUNCTION public.calculate_station_price_trends_from_previous_prices(
  _current_prices jsonb,
  _current_fuel_type text,
  _current_price numeric,
  _previous_prices jsonb
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
  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _current_value := public.resolve_station_fuel_price(
      _current_prices,
      _current_fuel_type,
      _current_price,
      _candidate_fuel_type
    );

    _previous_value := public.safe_text_to_double(
      COALESCE(_previous_prices, public.empty_fuel_price_map()) ->> _candidate_fuel_type
    );

    IF _current_value IS NULL OR _previous_value IS NULL OR _current_value <= 0 OR _previous_value <= 0 THEN
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

CREATE OR REPLACE FUNCTION public.derive_station_previous_prices(
  _existing_prices jsonb,
  _existing_fuel_type text,
  _existing_price numeric,
  _next_prices jsonb,
  _next_fuel_type text,
  _next_price numeric,
  _existing_previous_prices jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result jsonb := public.empty_fuel_price_map() || COALESCE(_existing_previous_prices, '{}'::jsonb);
  _candidate_fuel_type text;
  _existing_value double precision;
  _next_value double precision;
BEGIN
  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _existing_value := public.resolve_station_fuel_price(
      COALESCE(_existing_prices, public.empty_fuel_price_map()),
      _existing_fuel_type,
      _existing_price,
      _candidate_fuel_type
    );

    _next_value := public.resolve_station_fuel_price(
      COALESCE(_next_prices, public.empty_fuel_price_map()),
      _next_fuel_type,
      _next_price,
      _candidate_fuel_type
    );

    IF _existing_value IS NULL OR _existing_value <= 0 THEN
      CONTINUE;
    END IF;

    IF _next_value IS DISTINCT FROM _existing_value THEN
      _result := _result || jsonb_build_object(
        _candidate_fuel_type,
        to_jsonb(round(_existing_value::numeric, 2))
      );
    END IF;
  END LOOP;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_station_fuel_availability(
  _fuel_availability jsonb,
  _fuel_type text,
  _fallback_status text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _resolved_status text;
BEGIN
  IF _fuel_type NOT IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN
    RETURN NULL;
  END IF;

  _resolved_status := NULLIF(
    btrim(
      COALESCE(
        (COALESCE(_fuel_availability, public.empty_fuel_availability_map()) ->> _fuel_type),
        ''
      )
    ),
    ''
  );

  IF _resolved_status IN ('Available', 'Low', 'Out') THEN
    RETURN _resolved_status;
  END IF;

  IF _fallback_status IN ('Available', 'Low', 'Out') THEN
    RETURN _fallback_status;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.build_legacy_fuel_availability_map(
  _prices jsonb,
  _fuel_type text,
  _price numeric,
  _status text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result jsonb := public.empty_fuel_availability_map();
  _candidate_fuel_type text;
  _candidate_price double precision;
BEGIN
  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _candidate_price := public.resolve_station_fuel_price(
      COALESCE(_prices, public.empty_fuel_price_map()),
      _fuel_type,
      _price,
      _candidate_fuel_type
    );

    IF _candidate_price IS NOT NULL AND _candidate_price > 0 AND _status IN ('Available', 'Low', 'Out') THEN
      _result := _result || jsonb_build_object(_candidate_fuel_type, _status);
    END IF;
  END LOOP;

  IF _status = 'Out' AND _fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN
    _result := _result || jsonb_build_object(_fuel_type, 'Out');
  END IF;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_managed_station(
  _station_id uuid,
  _address text,
  _fuel_type text,
  _prices jsonb,
  _fuel_availability jsonb
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
  _selected_status text;
  _candidate_fuel_type text;
  _candidate_price_text text;
  _candidate_price numeric;
  _candidate_status text;
  _next_previous_prices jsonb := public.empty_fuel_price_map();
  _next_prices jsonb := public.empty_fuel_price_map() || COALESCE(_prices, '{}'::jsonb);
  _next_fuel_availability jsonb := public.empty_fuel_availability_map() || COALESCE(_fuel_availability, '{}'::jsonb);
BEGIN
  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _fuel_type NOT IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN
    RAISE EXCEPTION 'Invalid fuel type';
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

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _candidate_status := public.resolve_station_fuel_availability(
      _next_fuel_availability,
      _candidate_fuel_type,
      NULL
    );
    _candidate_price_text := NULLIF(
      btrim(COALESCE(_next_prices ->> _candidate_fuel_type, '')),
      ''
    );
    _candidate_price := NULL;

    IF _candidate_price_text IS NOT NULL THEN
      BEGIN
        _candidate_price := _candidate_price_text::numeric;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION '% price must be a valid number', _candidate_fuel_type;
      END;

      IF _candidate_price <= 0 THEN
        RAISE EXCEPTION '% price must be greater than 0', _candidate_fuel_type;
      END IF;
    END IF;

    IF _candidate_status IS NULL AND _candidate_price IS NULL THEN
      CONTINUE;
    END IF;

    IF _candidate_status = 'Out' THEN
      IF _candidate_price IS NOT NULL THEN
        RAISE EXCEPTION '% must not have a price when marked Out', _candidate_fuel_type;
      END IF;

      CONTINUE;
    END IF;

    IF NOT public.is_sellable_station_status(_candidate_status) THEN
      IF _candidate_price IS NOT NULL THEN
        RAISE EXCEPTION 'Select a valid availability for % when a price is provided', _candidate_fuel_type;
      END IF;

      CONTINUE;
    END IF;

    IF _candidate_price IS NULL THEN
      RAISE EXCEPTION '% must have a valid price when marked %', _candidate_fuel_type, _candidate_status;
    END IF;
  END LOOP;

  _selected_status := public.resolve_station_fuel_availability(
    _next_fuel_availability,
    _fuel_type,
    NULL
  );

  IF NOT public.is_sellable_station_status(_selected_status) THEN
    RAISE EXCEPTION 'Selected fuel type must be marked Available or Low';
  END IF;

  _selected_price_text := NULLIF(btrim(COALESCE(_next_prices ->> _fuel_type, '')), '');

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

  _next_previous_prices := public.derive_station_previous_prices(
    _station.prices,
    _station.fuel_type,
    _station.price_per_liter,
    _next_prices,
    _fuel_type,
    _selected_price,
    _station.previous_prices
  );

  UPDATE public.gas_stations
  SET address = btrim(_address),
      status = _selected_status,
      fuel_type = _fuel_type,
      prices = _next_prices,
      fuel_availability = _next_fuel_availability,
      previous_prices = _next_previous_prices,
      price_trends = public.calculate_station_price_trends_from_previous_prices(
        _next_prices,
        _fuel_type,
        _selected_price,
        _next_previous_prices
      ),
      price_per_liter = _selected_price
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
  _report_prices jsonb := public.empty_fuel_price_map();
  _report_fuel_availability jsonb := public.empty_fuel_availability_map();
  _station_next_prices jsonb := public.empty_fuel_price_map();
  _station_next_fuel_availability jsonb := public.empty_fuel_availability_map();
  _next_previous_prices jsonb := public.empty_fuel_price_map();
  _price_trends jsonb := public.empty_fuel_price_map();
  _candidate_fuel_type text;
  _candidate_price_text text;
  _candidate_price numeric;
  _candidate_status text;
  _selected_fuel_type text;
  _selected_status text;
  _selected_price numeric;
  _report_selected_fuel_type text;
  _report_selected_status text;
  _report_selected_price numeric;
  _report_has_data boolean := false;
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

  _report_prices := public.empty_fuel_price_map() || COALESCE(_report.prices, '{}'::jsonb);

  IF _report.price > 0
    AND NULLIF(btrim(COALESCE(_report_prices ->> _report.fuel_type, '')), '') IS NULL THEN
    _report_prices := _report_prices || jsonb_build_object(_report.fuel_type, to_jsonb(_report.price));
  END IF;

  _report_fuel_availability := public.empty_fuel_availability_map() || COALESCE(
    _report.fuel_availability,
    public.build_legacy_fuel_availability_map(
      _report.prices,
      _report.fuel_type,
      _report.price,
      _report.status
    )
  );

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _candidate_status := public.resolve_station_fuel_availability(
      _report_fuel_availability,
      _candidate_fuel_type,
      NULL
    );
    _candidate_price_text := NULLIF(
      btrim(COALESCE(_report_prices ->> _candidate_fuel_type, '')),
      ''
    );
    _candidate_price := NULL;

    IF _candidate_price_text IS NOT NULL THEN
      BEGIN
        _candidate_price := _candidate_price_text::numeric;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Report has an invalid % price', _candidate_fuel_type;
      END;

      IF _candidate_price <= 0 THEN
        RAISE EXCEPTION 'Report has an invalid % price', _candidate_fuel_type;
      END IF;
    END IF;

    IF _candidate_status IS NULL AND _candidate_price IS NULL THEN
      CONTINUE;
    END IF;

    _report_has_data := true;

    IF _candidate_status = 'Out' THEN
      IF _candidate_price IS NOT NULL THEN
        RAISE EXCEPTION 'Report marks % as Out but still includes a price', _candidate_fuel_type;
      END IF;

      CONTINUE;
    END IF;

    IF NOT public.is_sellable_station_status(_candidate_status) THEN
      IF _candidate_price IS NOT NULL THEN
        RAISE EXCEPTION 'Report includes a % price without a valid availability', _candidate_fuel_type;
      END IF;

      CONTINUE;
    END IF;

    IF _candidate_price IS NULL THEN
      RAISE EXCEPTION 'Report must include a valid % price when marked %', _candidate_fuel_type, _candidate_status;
    END IF;

    IF _report_selected_price IS NULL OR _candidate_price < _report_selected_price THEN
      _report_selected_price := _candidate_price;
      _report_selected_fuel_type := _candidate_fuel_type;
      _report_selected_status := _candidate_status;
    END IF;
  END LOOP;

  IF NOT _report_has_data THEN
    RAISE EXCEPTION 'Report must include at least one fuel availability or price';
  END IF;

  IF _report_selected_fuel_type IS NULL THEN
    _report_selected_fuel_type := CASE
      WHEN _report.fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN _report.fuel_type
      ELSE 'Diesel'
    END;
    _report_selected_status := COALESCE(
      public.resolve_station_fuel_availability(
        _report_fuel_availability,
        _report_selected_fuel_type,
        NULL
      ),
      'Out'
    );
    _report_selected_price := CASE
      WHEN public.is_sellable_station_status(_report_selected_status)
        THEN COALESCE(
          public.resolve_station_fuel_price(
            _report_prices,
            _report.fuel_type,
            _report.price,
            _report_selected_fuel_type
          ),
          0
        )
      ELSE 0
    END;
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

    _station_next_prices := public.empty_fuel_price_map() || COALESCE(_station.prices, '{}'::jsonb);
    _station_next_fuel_availability := public.empty_fuel_availability_map() || COALESCE(
      _station.fuel_availability,
      public.build_legacy_fuel_availability_map(
        _station.prices,
        _station.fuel_type,
        _station.price_per_liter,
        _station.status
      )
    );

    FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
      _candidate_status := public.resolve_station_fuel_availability(
        _report_fuel_availability,
        _candidate_fuel_type,
        NULL
      );

      IF _candidate_status IS NULL THEN
        CONTINUE;
      END IF;

      IF _candidate_status = 'Out' THEN
        _station_next_prices := _station_next_prices || jsonb_build_object(_candidate_fuel_type, NULL);
        _station_next_fuel_availability := _station_next_fuel_availability || jsonb_build_object(_candidate_fuel_type, 'Out');
        CONTINUE;
      END IF;

      _candidate_price := (_report_prices ->> _candidate_fuel_type)::numeric;
      _station_next_prices := _station_next_prices || jsonb_build_object(
        _candidate_fuel_type,
        to_jsonb(round(_candidate_price::numeric, 2))
      );
      _station_next_fuel_availability := _station_next_fuel_availability || jsonb_build_object(
        _candidate_fuel_type,
        _candidate_status
      );
    END LOOP;

    _selected_fuel_type := NULL;
    _selected_status := NULL;
    _selected_price := NULL;

    FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
      _candidate_status := public.resolve_station_fuel_availability(
        _station_next_fuel_availability,
        _candidate_fuel_type,
        NULL
      );

      IF NOT public.is_sellable_station_status(_candidate_status) THEN
        CONTINUE;
      END IF;

      _candidate_price := public.resolve_station_fuel_price(
        _station_next_prices,
        _station.fuel_type,
        _station.price_per_liter,
        _candidate_fuel_type
      );

      IF _candidate_price IS NULL OR _candidate_price <= 0 THEN
        CONTINUE;
      END IF;

      IF _selected_price IS NULL OR _candidate_price < _selected_price THEN
        _selected_price := _candidate_price;
        _selected_fuel_type := _candidate_fuel_type;
        _selected_status := _candidate_status;
      END IF;
    END LOOP;

    IF _selected_fuel_type IS NULL THEN
      _selected_fuel_type := CASE
        WHEN _station.fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN _station.fuel_type
        ELSE _report_selected_fuel_type
      END;
      _selected_status := COALESCE(
        public.resolve_station_fuel_availability(
          _station_next_fuel_availability,
          _selected_fuel_type,
          NULL
        ),
        'Out'
      );
      _selected_price := CASE
        WHEN public.is_sellable_station_status(_selected_status)
          THEN COALESCE(
            public.resolve_station_fuel_price(
              _station_next_prices,
              _station.fuel_type,
              _station.price_per_liter,
              _selected_fuel_type
            ),
            0
          )
        ELSE 0
      END;
    END IF;

    _next_previous_prices := public.derive_station_previous_prices(
      _station.prices,
      _station.fuel_type,
      _station.price_per_liter,
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _station.previous_prices
    );

    _price_trends := public.calculate_station_price_trends_from_previous_prices(
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _next_previous_prices
    );

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = _station_next_prices,
        fuel_availability = _station_next_fuel_availability,
        previous_prices = _next_previous_prices,
        price_trends = _price_trends,
        status = _selected_status,
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

    _station_next_prices := public.empty_fuel_price_map() || COALESCE(_station.prices, '{}'::jsonb);
    _station_next_fuel_availability := public.empty_fuel_availability_map() || COALESCE(
      _station.fuel_availability,
      public.build_legacy_fuel_availability_map(
        _station.prices,
        _station.fuel_type,
        _station.price_per_liter,
        _station.status
      )
    );

    FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
      _candidate_status := public.resolve_station_fuel_availability(
        _report_fuel_availability,
        _candidate_fuel_type,
        NULL
      );

      IF _candidate_status IS NULL THEN
        CONTINUE;
      END IF;

      IF _candidate_status = 'Out' THEN
        _station_next_prices := _station_next_prices || jsonb_build_object(_candidate_fuel_type, NULL);
        _station_next_fuel_availability := _station_next_fuel_availability || jsonb_build_object(_candidate_fuel_type, 'Out');
        CONTINUE;
      END IF;

      _candidate_price := (_report_prices ->> _candidate_fuel_type)::numeric;
      _station_next_prices := _station_next_prices || jsonb_build_object(
        _candidate_fuel_type,
        to_jsonb(round(_candidate_price::numeric, 2))
      );
      _station_next_fuel_availability := _station_next_fuel_availability || jsonb_build_object(
        _candidate_fuel_type,
        _candidate_status
      );
    END LOOP;

    _selected_fuel_type := NULL;
    _selected_status := NULL;
    _selected_price := NULL;

    FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
      _candidate_status := public.resolve_station_fuel_availability(
        _station_next_fuel_availability,
        _candidate_fuel_type,
        NULL
      );

      IF NOT public.is_sellable_station_status(_candidate_status) THEN
        CONTINUE;
      END IF;

      _candidate_price := public.resolve_station_fuel_price(
        _station_next_prices,
        _station.fuel_type,
        _station.price_per_liter,
        _candidate_fuel_type
      );

      IF _candidate_price IS NULL OR _candidate_price <= 0 THEN
        CONTINUE;
      END IF;

      IF _selected_price IS NULL OR _candidate_price < _selected_price THEN
        _selected_price := _candidate_price;
        _selected_fuel_type := _candidate_fuel_type;
        _selected_status := _candidate_status;
      END IF;
    END LOOP;

    IF _selected_fuel_type IS NULL THEN
      _selected_fuel_type := CASE
        WHEN _station.fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN _station.fuel_type
        ELSE _report_selected_fuel_type
      END;
      _selected_status := COALESCE(
        public.resolve_station_fuel_availability(
          _station_next_fuel_availability,
          _selected_fuel_type,
          NULL
        ),
        'Out'
      );
      _selected_price := CASE
        WHEN public.is_sellable_station_status(_selected_status)
          THEN COALESCE(
            public.resolve_station_fuel_price(
              _station_next_prices,
              _station.fuel_type,
              _station.price_per_liter,
              _selected_fuel_type
            ),
            0
          )
        ELSE 0
      END;
    END IF;

    _next_previous_prices := public.derive_station_previous_prices(
      _station.prices,
      _station.fuel_type,
      _station.price_per_liter,
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _station.previous_prices
    );

    _price_trends := public.calculate_station_price_trends_from_previous_prices(
      _station_next_prices,
      _selected_fuel_type,
      _selected_price,
      _next_previous_prices
    );

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = _station_next_prices,
        fuel_availability = _station_next_fuel_availability,
        previous_prices = _next_previous_prices,
        price_trends = _price_trends,
        status = _selected_status,
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

    _selected_fuel_type := COALESCE(
      _report_selected_fuel_type,
      CASE
        WHEN _report.fuel_type IN ('Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN _report.fuel_type
        ELSE 'Diesel'
      END
    );
    _selected_status := COALESCE(
      public.resolve_station_fuel_availability(
        _report_fuel_availability,
        _selected_fuel_type,
        NULL
      ),
      'Out'
    );
    _selected_price := CASE
      WHEN public.is_sellable_station_status(_selected_status)
        THEN COALESCE(
          public.resolve_station_fuel_price(
            _report_prices,
            _report.fuel_type,
            _report.price,
            _selected_fuel_type
          ),
          0
        )
      ELSE 0
    END;

    INSERT INTO public.gas_stations (
      name,
      address,
      lat,
      lng,
      status,
      fuel_type,
      price_per_liter,
      prices,
      fuel_availability,
      previous_prices,
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
      _selected_status,
      _selected_fuel_type,
      _selected_price,
      _report_prices,
      _report_fuel_availability,
      public.empty_fuel_price_map(),
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
      fuel_type = _report_selected_fuel_type,
      price = _report_selected_price,
      status = _report_selected_status,
      fuel_availability = _report_fuel_availability,
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
  google_place_id text,
  prices jsonb,
  fuel_availability jsonb,
  previous_prices jsonb,
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
    WHEN _fuel_filter IN ('All', 'Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene') THEN _fuel_filter
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
        WHEN v_fuel_filter = 'All' THEN NULL
        ELSE public.resolve_station_fuel_availability(
          gs.fuel_availability,
          v_fuel_filter,
          CASE
            WHEN gs.fuel_type = v_fuel_filter THEN gs.status
            ELSE NULL
          END
        )
      END AS selected_availability,
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
        v_province_code IS NULL
        OR gs.province_code = v_province_code
      )
      AND (
        v_city_municipality_code IS NULL
        OR gs.city_municipality_code = v_city_municipality_code
      )
      AND (
        v_fuel_filter = 'All'
        OR public.resolve_station_fuel_availability(
          gs.fuel_availability,
          v_fuel_filter,
          CASE
            WHEN gs.fuel_type = v_fuel_filter THEN gs.status
            ELSE NULL
          END
        ) = 'Out'
        OR public.resolve_station_fuel_price(
          gs.prices,
          gs.fuel_type,
          gs.price_per_liter,
          v_fuel_filter
        ) IS NOT NULL
      )
  ),
  scoped AS (
    SELECT *
    FROM filtered
    WHERE (
      v_fuel_filter = 'All'
      OR v_status_filter = 'All'
      OR filtered.selected_availability = v_status_filter
    )
  ),
  counts AS (
    SELECT COUNT(*)::bigint AS total_count
    FROM scoped
  ),
  page_rows AS (
    SELECT *
    FROM scoped
    ORDER BY
      CASE
        WHEN v_fuel_filter <> 'All' AND scoped.selected_availability = 'Out' THEN 1
        ELSE 0
      END ASC,
      CASE
        WHEN v_fuel_filter = 'All' AND _user_lat IS NOT NULL AND _user_lng IS NOT NULL
          THEN scoped.distance_km
        ELSE NULL
      END ASC NULLS LAST,
      CASE
        WHEN v_fuel_filter = 'All' AND (_user_lat IS NULL OR _user_lng IS NULL)
          THEN scoped.updated_at
        ELSE NULL
      END DESC NULLS LAST,
      CASE
        WHEN v_fuel_filter <> 'All' AND v_sort_by = 'price_asc'
          THEN scoped.selected_price
        ELSE NULL
      END ASC NULLS LAST,
      CASE
        WHEN v_fuel_filter <> 'All' AND v_sort_by = 'price_desc'
          THEN scoped.selected_price
        ELSE NULL
      END DESC NULLS LAST,
      scoped.updated_at DESC
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
    page_rows.google_place_id,
    page_rows.prices,
    page_rows.fuel_availability,
    page_rows.previous_prices,
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

CREATE OR REPLACE FUNCTION public.get_public_station_summary()
RETURNS TABLE (
  total_stations bigint,
  average_unleaded double precision,
  average_premium double precision,
  average_diesel double precision,
  average_premium_diesel double precision,
  average_kerosene double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_stations,
    AVG(
      public.resolve_station_fuel_price(
        gs.prices,
        gs.fuel_type,
        gs.price_per_liter,
        'Unleaded'
      )
    ) AS average_unleaded,
    AVG(
      public.resolve_station_fuel_price(
        gs.prices,
        gs.fuel_type,
        gs.price_per_liter,
        'Premium'
      )
    ) AS average_premium,
    AVG(
      public.resolve_station_fuel_price(
        gs.prices,
        gs.fuel_type,
        gs.price_per_liter,
        'Diesel'
      )
    ) AS average_diesel,
    AVG(
      public.resolve_station_fuel_price(
        gs.prices,
        gs.fuel_type,
        gs.price_per_liter,
        'Premium Diesel'
      )
    ) AS average_premium_diesel,
    AVG(
      public.resolve_station_fuel_price(
        gs.prices,
        gs.fuel_type,
        gs.price_per_liter,
        'Kerosene'
      )
    ) AS average_kerosene
  FROM public.gas_stations AS gs;
$$;

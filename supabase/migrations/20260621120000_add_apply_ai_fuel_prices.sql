-- apply_ai_fuel_prices: batch-apply admin-reviewed AI prices to stations.
--
-- The frontend resolves which stations belong to each brand/region (reusing the
-- client-side brand keyword matcher) and passes an explicit per-station payload:
--   _updates = [ { "station_id": uuid, "prices": { "Diesel": 55.1, ... } }, ... ]
--
-- Price-trend / previous-price bookkeeping mirrors approve_fuel_report so AI-applied
-- prices behave identically to community-reported ones. Super-admin only.

CREATE OR REPLACE FUNCTION public.apply_ai_fuel_prices(_updates jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _update jsonb;
  _station_id uuid;
  _input_prices jsonb;
  _station public.gas_stations%ROWTYPE;
  _next_prices jsonb;
  _next_fuel_availability jsonb;
  _next_previous_prices jsonb;
  _candidate_fuel_type text;
  _candidate_price_text text;
  _candidate_price numeric;
  _candidate_status text;
  _selected_fuel_type text;
  _selected_status text;
  _selected_price numeric;
  _updated_count integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'array' THEN
    RAISE EXCEPTION 'Updates payload must be a JSON array';
  END IF;

  FOR _update IN SELECT * FROM jsonb_array_elements(_updates) LOOP
    _station_id := NULLIF(_update ->> 'station_id', '')::uuid;
    _input_prices := COALESCE(_update -> 'prices', '{}'::jsonb);

    IF _station_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE id = _station_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Merge supplied prices over existing ones (only provided keys change).
    _next_prices := public.empty_fuel_price_map()
      || COALESCE(_station.prices, '{}'::jsonb)
      || jsonb_strip_nulls(_input_prices);

    _next_fuel_availability := public.empty_fuel_availability_map()
      || COALESCE(
        _station.fuel_availability,
        public.build_legacy_fuel_availability_map(
          _station.prices,
          _station.fuel_type,
          _station.price_per_liter,
          _station.status
        )
      );

    -- Mark each supplied, positive-priced fuel as Available; pick the cheapest
    -- valid fuel as the station's headline selection.
    _selected_fuel_type := NULL;
    _selected_status := NULL;
    _selected_price := NULL;

    FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
      _candidate_price_text := NULLIF(
        btrim(COALESCE(_input_prices ->> _candidate_fuel_type, '')),
        ''
      );

      IF _candidate_price_text IS NULL THEN
        CONTINUE;
      END IF;

      BEGIN
        _candidate_price := _candidate_price_text::numeric;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION 'Invalid % price for station %', _candidate_fuel_type, _station_id;
      END;

      IF _candidate_price <= 0 THEN
        CONTINUE;
      END IF;

      _next_fuel_availability := _next_fuel_availability
        || jsonb_build_object(_candidate_fuel_type, 'Available');

      IF _selected_price IS NULL OR _candidate_price < _selected_price THEN
        _selected_price := _candidate_price;
        _selected_fuel_type := _candidate_fuel_type;
        _selected_status := 'Available';
      END IF;
    END LOOP;

    -- Nothing valid supplied for this station — skip.
    IF _selected_fuel_type IS NULL THEN
      CONTINUE;
    END IF;

    _next_previous_prices := public.derive_station_previous_prices(
      _station.prices,
      _station.fuel_type,
      _station.price_per_liter,
      _next_prices,
      _selected_fuel_type,
      _selected_price,
      _station.previous_prices
    );

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = _next_prices,
        fuel_availability = _next_fuel_availability,
        previous_prices = _next_previous_prices,
        price_trends = public.calculate_station_price_trends_from_previous_prices(
          _next_prices,
          _selected_fuel_type,
          _selected_price,
          _next_previous_prices
        ),
        status = _selected_status,
        updated_at = now()
    WHERE id = _station.id;

    _updated_count := _updated_count + 1;
  END LOOP;

  RETURN _updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_fuel_prices(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_fuel_prices(jsonb) TO authenticated;

-- undo_approved_fuel_price: super-admin revert of an approved report's effect.
--
-- Restores the applied station to the per-fuel values in previous_prices:
--   * fuel had a prior value -> restored to it
--   * fuel had no prior value -> price removed (set null)
-- If the report originally CREATED the station (new-station candidate) and no
-- other approved report has since been applied to it, the station is deleted
-- and the report returns to the pending queue.
--
-- Super admin only. Returns the station id, or NULL when the station was removed.

CREATE OR REPLACE FUNCTION public.undo_approved_fuel_price(_report_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _report public.fuel_reports%ROWTYPE;
  _station public.gas_stations%ROWTYPE;
  _previous jsonb;
  _reverted_prices jsonb := public.empty_fuel_price_map();
  _reverted_availability jsonb := public.empty_fuel_availability_map();
  _candidate_fuel_type text;
  _previous_value double precision;
  _selected_fuel_type text;
  _selected_price numeric;
  _other_approved_count integer;
  _was_created boolean;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  SELECT *
  INTO _report
  FROM public.fuel_reports
  WHERE id = _report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fuel report not found';
  END IF;

  IF _report.review_status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved reports can be undone';
  END IF;

  SELECT *
  INTO _station
  FROM public.gas_stations
  WHERE id = COALESCE(_report.applied_station_id, _report.station_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Applied station no longer exists';
  END IF;

  -- The approval created a brand-new station when the report was a new-station
  -- candidate (no linked station, but a reported address to geocode).
  _was_created :=
    _report.station_id IS NULL
    AND NULLIF(btrim(COALESCE(_report.reported_address, '')), '') IS NOT NULL;

  SELECT COUNT(*)
  INTO _other_approved_count
  FROM public.fuel_reports
  WHERE review_status = 'approved'
    AND id <> _report.id
    AND COALESCE(applied_station_id, station_id) = _station.id;

  -- New station with no other approved contributions -> remove it entirely.
  IF _was_created AND _other_approved_count = 0 THEN
    UPDATE public.fuel_reports
    SET review_status = 'pending',
        reviewed_at = NULL,
        reviewed_by = NULL,
        applied_station_id = NULL
    WHERE id = _report.id;

    -- FKs to gas_stations are ON DELETE CASCADE / SET NULL, so dependent
    -- rows clean up automatically.
    DELETE FROM public.gas_stations WHERE id = _station.id;

    RETURN NULL;
  END IF;

  -- Otherwise: rebuild prices straight from previous_prices (fuels without a
  -- prior value are dropped).
  _previous := public.empty_fuel_price_map()
    || COALESCE(_station.previous_prices, '{}'::jsonb);

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    _previous_value := public.safe_text_to_double(_previous ->> _candidate_fuel_type);

    IF _previous_value IS NULL OR _previous_value <= 0 THEN
      -- No prior value: remove this fuel's price.
      _reverted_prices := _reverted_prices
        || jsonb_build_object(_candidate_fuel_type, NULL);
      _reverted_availability := _reverted_availability
        || jsonb_build_object(_candidate_fuel_type, 'Out');
      CONTINUE;
    END IF;

    _reverted_prices := _reverted_prices
      || jsonb_build_object(
        _candidate_fuel_type,
        to_jsonb(round(_previous_value::numeric, 2))
      );
    _reverted_availability := _reverted_availability
      || jsonb_build_object(_candidate_fuel_type, 'Available');

    IF _selected_price IS NULL OR _previous_value < _selected_price THEN
      _selected_price := _previous_value::numeric;
      _selected_fuel_type := _candidate_fuel_type;
    END IF;
  END LOOP;

  UPDATE public.gas_stations
  SET prices = _reverted_prices,
      fuel_availability = _reverted_availability,
      previous_prices = public.empty_fuel_price_map(),
      price_trends = public.empty_fuel_price_map(),
      fuel_type = COALESCE(_selected_fuel_type, fuel_type),
      price_per_liter = COALESCE(_selected_price, 0),
      status = CASE WHEN _selected_fuel_type IS NULL THEN 'Out' ELSE 'Available' END,
      updated_at = now()
  WHERE id = _station.id;

  RETURN _station.id;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_approved_fuel_price(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_approved_fuel_price(uuid) TO authenticated;

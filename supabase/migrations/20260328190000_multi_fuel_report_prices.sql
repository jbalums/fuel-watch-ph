ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL
  );

UPDATE public.fuel_reports
SET prices = jsonb_build_object(
  'Unleaded', NULL,
  'Premium', NULL,
  'Diesel', NULL
) || jsonb_build_object(fuel_type, to_jsonb(price))
WHERE prices IS NULL
   OR prices = '{}'::jsonb
   OR NULLIF(btrim(COALESCE(prices ->> fuel_type, '')), '') IS NULL;

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
BEGIN
  IF _admin_user_id IS NULL OR NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve reports';
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

  UPDATE public.gas_stations
  SET fuel_type = _selected_fuel_type,
      price_per_liter = _selected_price,
      prices = COALESCE(
        prices,
        jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
      ) || jsonb_strip_nulls(_report_prices),
      status = _report.status,
      report_count = COALESCE(report_count, 0) + 1
  WHERE id = _station.id;

  UPDATE public.fuel_reports
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_user_id,
      applied_station_id = _station.id
  WHERE id = _report.id;

  RETURN _station.id;
END;
$$;

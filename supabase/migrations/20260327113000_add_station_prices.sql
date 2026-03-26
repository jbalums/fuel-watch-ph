ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS prices jsonb NOT NULL DEFAULT jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL
  );

UPDATE public.gas_stations
SET prices = jsonb_build_object(
  'Unleaded', NULL,
  'Premium', NULL,
  'Diesel', NULL
) || jsonb_build_object(fuel_type, to_jsonb(price_per_liter))
WHERE prices IS NULL
   OR prices = '{}'::jsonb
   OR prices ->> fuel_type IS NULL;

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
  SET fuel_type = _report.fuel_type,
      price_per_liter = _report.price,
      prices = COALESCE(
        prices,
        jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
      ) || jsonb_build_object(_report.fuel_type, to_jsonb(_report.price)),
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

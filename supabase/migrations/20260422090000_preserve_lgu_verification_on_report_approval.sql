ALTER FUNCTION public.approve_fuel_report(uuid)
  RENAME TO approve_fuel_report_apply_price_update_v20260422;

REVOKE EXECUTE ON FUNCTION public.approve_fuel_report_apply_price_update_v20260422(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_fuel_report(_report_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report public.fuel_reports%ROWTYPE;
  _station_before public.gas_stations%ROWTYPE;
  _approved_station_id uuid;
  _match_count integer := 0;
  _has_existing_station boolean := false;
BEGIN
  SELECT *
  INTO _report
  FROM public.fuel_reports
  WHERE id = _report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fuel report not found';
  END IF;

  IF _report.station_id IS NOT NULL THEN
    SELECT *
    INTO _station_before
    FROM public.gas_stations
    WHERE id = _report.station_id
    FOR UPDATE;

    _has_existing_station := FOUND;
  ELSIF _report.reported_address IS NULL THEN
    SELECT COUNT(*)
    INTO _match_count
    FROM public.gas_stations
    WHERE lower(btrim(name)) = lower(btrim(_report.station_name));

    IF _match_count = 1 THEN
      SELECT *
      INTO _station_before
      FROM public.gas_stations
      WHERE lower(btrim(name)) = lower(btrim(_report.station_name))
      LIMIT 1
      FOR UPDATE;

      _has_existing_station := FOUND;
    END IF;
  END IF;

  _approved_station_id :=
    public.approve_fuel_report_apply_price_update_v20260422(_report_id);

  IF _has_existing_station THEN
    UPDATE public.gas_stations
    SET is_lgu_verified = _station_before.is_lgu_verified,
        lgu_verified_at = _station_before.lgu_verified_at,
        lgu_verified_by = _station_before.lgu_verified_by,
        lgu_verified_role = _station_before.lgu_verified_role
    WHERE id = _station_before.id;
  END IF;

  UPDATE public.fuel_reports
  SET is_lgu_verified = _report.is_lgu_verified,
      lgu_verified_at = _report.lgu_verified_at,
      lgu_verified_by = _report.lgu_verified_by,
      lgu_verified_role = _report.lgu_verified_role
  WHERE id = _report.id;

  RETURN _approved_station_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_fuel_report(uuid) TO authenticated;

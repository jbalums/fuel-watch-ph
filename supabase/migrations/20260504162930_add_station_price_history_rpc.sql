CREATE OR REPLACE FUNCTION public.list_station_price_history(
  _station_id uuid
)
RETURNS TABLE (
  report_id uuid,
  effective_at timestamptz,
  submission_mode text,
  reported_address text,
  prices jsonb,
  fuel_availability jsonb,
  reviewed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fr.id AS report_id,
    COALESCE(fr.reviewed_at, fr.created_at) AS effective_at,
    fr.submission_mode,
    fr.reported_address,
    public.empty_fuel_price_map() || COALESCE(fr.prices, '{}'::jsonb) AS prices,
    public.empty_fuel_availability_map() || COALESCE(fr.fuel_availability, '{}'::jsonb) AS fuel_availability,
    fr.reviewed_at,
    fr.created_at
  FROM public.fuel_reports AS fr
  WHERE fr.review_status = 'approved'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND COALESCE(fr.applied_station_id, fr.station_id) = _station_id
  ORDER BY
    COALESCE(fr.reviewed_at, fr.created_at) DESC,
    fr.created_at DESC,
    fr.id DESC;
$$;

CREATE OR REPLACE FUNCTION public.list_scoped_station_price_history(
  _station_id uuid
)
RETURNS TABLE (
  report_id uuid,
  effective_at timestamptz,
  submission_mode text,
  reported_address text,
  prices jsonb,
  fuel_availability jsonb,
  reviewed_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    fr.id AS report_id,
    COALESCE(fr.reviewed_at, fr.created_at) AS effective_at,
    fr.submission_mode,
    fr.reported_address,
    public.empty_fuel_price_map() || COALESCE(fr.prices, '{}'::jsonb) AS prices,
    public.empty_fuel_availability_map() || COALESCE(fr.fuel_availability, '{}'::jsonb) AS fuel_availability,
    fr.reviewed_at,
    fr.created_at
  FROM public.fuel_reports AS fr
  JOIN public.gas_stations AS gs
    ON gs.id = COALESCE(fr.applied_station_id, fr.station_id)
  WHERE fr.review_status = 'approved'
    AND gs.id = _station_id
    AND public.can_manage_geo_scope(
      auth.uid(),
      gs.province_code,
      gs.city_municipality_code
    )
  ORDER BY
    COALESCE(fr.reviewed_at, fr.created_at) DESC,
    fr.created_at DESC,
    fr.id DESC;
$$;

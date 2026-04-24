DROP FUNCTION IF EXISTS public.get_public_station_summary();

CREATE FUNCTION public.get_public_station_summary()
RETURNS TABLE (
  sample_report_count bigint,
  window_days integer,
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
  WITH recent_reports AS (
    SELECT
      fr.prices,
      fr.fuel_type,
      fr.price,
      fr.created_at
    FROM public.fuel_reports AS fr
    WHERE fr.review_status = 'approved'
      AND fr.created_at >= now() - interval '10 days'
    ORDER BY fr.created_at DESC
    LIMIT 20
  )
  SELECT
    COUNT(*)::bigint AS sample_report_count,
    10::integer AS window_days,
    AVG(
      public.resolve_station_fuel_price(
        recent_reports.prices,
        recent_reports.fuel_type,
        recent_reports.price,
        'Unleaded'
      )
    ) AS average_unleaded,
    AVG(
      public.resolve_station_fuel_price(
        recent_reports.prices,
        recent_reports.fuel_type,
        recent_reports.price,
        'Premium'
      )
    ) AS average_premium,
    AVG(
      public.resolve_station_fuel_price(
        recent_reports.prices,
        recent_reports.fuel_type,
        recent_reports.price,
        'Diesel'
      )
    ) AS average_diesel,
    AVG(
      public.resolve_station_fuel_price(
        recent_reports.prices,
        recent_reports.fuel_type,
        recent_reports.price,
        'Premium Diesel'
      )
    ) AS average_premium_diesel,
    AVG(
      public.resolve_station_fuel_price(
        recent_reports.prices,
        recent_reports.fuel_type,
        recent_reports.price,
        'Kerosene'
      )
    ) AS average_kerosene
  FROM recent_reports;
$$;

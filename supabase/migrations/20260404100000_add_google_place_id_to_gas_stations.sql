ALTER TABLE public.gas_stations
ADD COLUMN IF NOT EXISTS google_place_id text;

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
    page_rows.google_place_id,
    page_rows.prices,
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

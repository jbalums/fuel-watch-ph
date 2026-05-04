CREATE INDEX IF NOT EXISTS fuel_reports_station_effective_summary_idx
ON public.fuel_reports (
  review_status,
  (COALESCE(applied_station_id, station_id)),
  (COALESCE(reviewed_at, created_at)) DESC
);

CREATE OR REPLACE FUNCTION public.list_station_summary_prices_as_of(
  _as_of timestamptz,
  _province_code text DEFAULT NULL,
  _city_municipality_code text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  fuel_type text,
  price_per_liter numeric,
  prices jsonb,
  previous_prices jsonb,
  price_trends jsonb,
  report_count integer,
  province_code text,
  city_municipality_code text,
  google_place_id text,
  is_verified boolean,
  verified_at timestamptz,
  is_lgu_verified boolean,
  lgu_verified_at timestamptz,
  lgu_verified_by uuid,
  lgu_verified_role app_role,
  station_brand_logo_id uuid,
  manager_user_id uuid,
  fuel_availability jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH station_scope AS (
    SELECT *
    FROM public.gas_stations AS gs
    WHERE (_province_code IS NULL OR _province_code = '' OR gs.province_code = _province_code)
      AND (
        _city_municipality_code IS NULL
        OR _city_municipality_code = ''
        OR gs.city_municipality_code = _city_municipality_code
      )
  ),
  fuel_types(fuel_type) AS (
    VALUES
      ('Unleaded'),
      ('Premium'),
      ('Diesel'),
      ('Premium Diesel'),
      ('Kerosene')
  ),
  latest_fuel_reports AS (
    SELECT DISTINCT ON (linked_station_id, ft.fuel_type)
      linked_station_id,
      ft.fuel_type,
      public.safe_text_to_double(fr.prices ->> ft.fuel_type) AS price_value,
      NULLIF(btrim(COALESCE(fr.fuel_availability ->> ft.fuel_type, '')), '') AS fuel_status,
      COALESCE(fr.reviewed_at, fr.created_at) AS effective_at,
      fr.created_at
    FROM public.fuel_reports AS fr
    CROSS JOIN fuel_types AS ft
    JOIN station_scope AS ss
      ON ss.id = COALESCE(fr.applied_station_id, fr.station_id)
    CROSS JOIN LATERAL (
      SELECT COALESCE(fr.applied_station_id, fr.station_id) AS linked_station_id
    ) AS linked
    WHERE fr.review_status = 'approved'
      AND COALESCE(fr.reviewed_at, fr.created_at) <= _as_of
      AND (
        public.safe_text_to_double(fr.prices ->> ft.fuel_type) IS NOT NULL
        OR NULLIF(btrim(COALESCE(fr.fuel_availability ->> ft.fuel_type, '')), '') IS NOT NULL
      )
    ORDER BY
      linked_station_id,
      ft.fuel_type,
      effective_at DESC,
      fr.created_at DESC,
      fr.id DESC
  ),
  reconstructed_maps AS (
    SELECT
      latest_fuel_reports.linked_station_id,
      public.empty_fuel_price_map() ||
        jsonb_object_agg(
          latest_fuel_reports.fuel_type,
          CASE
            WHEN latest_fuel_reports.price_value IS NOT NULL
              AND latest_fuel_reports.price_value > 0
              THEN to_jsonb(round(latest_fuel_reports.price_value::numeric, 2))
            ELSE 'null'::jsonb
          END
        ) AS prices,
      public.empty_fuel_availability_map() ||
        jsonb_object_agg(
          latest_fuel_reports.fuel_type,
          to_jsonb(latest_fuel_reports.fuel_status)
        ) AS fuel_availability
    FROM latest_fuel_reports
    GROUP BY latest_fuel_reports.linked_station_id
  ),
  selected_prices AS (
    SELECT DISTINCT ON (latest_fuel_reports.linked_station_id)
      latest_fuel_reports.linked_station_id,
      latest_fuel_reports.fuel_type,
      latest_fuel_reports.price_value,
      COALESCE(latest_fuel_reports.fuel_status, 'Available') AS fuel_status
    FROM latest_fuel_reports
    WHERE latest_fuel_reports.price_value IS NOT NULL
      AND latest_fuel_reports.price_value > 0
    ORDER BY
      latest_fuel_reports.linked_station_id,
      latest_fuel_reports.price_value ASC,
      latest_fuel_reports.fuel_type ASC
  )
  SELECT
    ss.id,
    ss.name,
    ss.address,
    ss.lat,
    ss.lng,
    COALESCE(selected_prices.fuel_status, 'Out') AS status,
    ss.created_at,
    ss.updated_at,
    selected_prices.fuel_type,
    COALESCE(round(selected_prices.price_value::numeric, 2), 0::numeric) AS price_per_liter,
    COALESCE(reconstructed_maps.prices, public.empty_fuel_price_map()) AS prices,
    public.empty_fuel_price_map() AS previous_prices,
    public.empty_fuel_price_map() AS price_trends,
    ss.report_count,
    ss.province_code,
    ss.city_municipality_code,
    ss.google_place_id,
    ss.is_verified,
    ss.verified_at,
    ss.is_lgu_verified,
    ss.lgu_verified_at,
    ss.lgu_verified_by,
    ss.lgu_verified_role,
    ss.station_brand_logo_id,
    ss.manager_user_id,
    COALESCE(reconstructed_maps.fuel_availability, public.empty_fuel_availability_map()) AS fuel_availability
  FROM station_scope AS ss
  LEFT JOIN reconstructed_maps
    ON reconstructed_maps.linked_station_id = ss.id
  LEFT JOIN selected_prices
    ON selected_prices.linked_station_id = ss.id
  ORDER BY ss.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.list_scoped_station_summary_prices_as_of(
  _as_of timestamptz
)
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  fuel_type text,
  price_per_liter numeric,
  prices jsonb,
  previous_prices jsonb,
  price_trends jsonb,
  report_count integer,
  province_code text,
  city_municipality_code text,
  google_place_id text,
  is_verified boolean,
  verified_at timestamptz,
  is_lgu_verified boolean,
  lgu_verified_at timestamptz,
  lgu_verified_by uuid,
  lgu_verified_role app_role,
  station_brand_logo_id uuid,
  manager_user_id uuid,
  fuel_availability jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH station_scope AS (
    SELECT *
    FROM public.gas_stations AS gs
    WHERE public.can_manage_geo_scope(
      auth.uid(),
      gs.province_code,
      gs.city_municipality_code
    )
  ),
  fuel_types(fuel_type) AS (
    VALUES
      ('Unleaded'),
      ('Premium'),
      ('Diesel'),
      ('Premium Diesel'),
      ('Kerosene')
  ),
  latest_fuel_reports AS (
    SELECT DISTINCT ON (linked_station_id, ft.fuel_type)
      linked_station_id,
      ft.fuel_type,
      public.safe_text_to_double(fr.prices ->> ft.fuel_type) AS price_value,
      NULLIF(btrim(COALESCE(fr.fuel_availability ->> ft.fuel_type, '')), '') AS fuel_status,
      COALESCE(fr.reviewed_at, fr.created_at) AS effective_at,
      fr.created_at
    FROM public.fuel_reports AS fr
    CROSS JOIN fuel_types AS ft
    JOIN station_scope AS ss
      ON ss.id = COALESCE(fr.applied_station_id, fr.station_id)
    CROSS JOIN LATERAL (
      SELECT COALESCE(fr.applied_station_id, fr.station_id) AS linked_station_id
    ) AS linked
    WHERE fr.review_status = 'approved'
      AND COALESCE(fr.reviewed_at, fr.created_at) <= _as_of
      AND (
        public.safe_text_to_double(fr.prices ->> ft.fuel_type) IS NOT NULL
        OR NULLIF(btrim(COALESCE(fr.fuel_availability ->> ft.fuel_type, '')), '') IS NOT NULL
      )
    ORDER BY
      linked_station_id,
      ft.fuel_type,
      effective_at DESC,
      fr.created_at DESC,
      fr.id DESC
  ),
  reconstructed_maps AS (
    SELECT
      latest_fuel_reports.linked_station_id,
      public.empty_fuel_price_map() ||
        jsonb_object_agg(
          latest_fuel_reports.fuel_type,
          CASE
            WHEN latest_fuel_reports.price_value IS NOT NULL
              AND latest_fuel_reports.price_value > 0
              THEN to_jsonb(round(latest_fuel_reports.price_value::numeric, 2))
            ELSE 'null'::jsonb
          END
        ) AS prices,
      public.empty_fuel_availability_map() ||
        jsonb_object_agg(
          latest_fuel_reports.fuel_type,
          to_jsonb(latest_fuel_reports.fuel_status)
        ) AS fuel_availability
    FROM latest_fuel_reports
    GROUP BY latest_fuel_reports.linked_station_id
  ),
  selected_prices AS (
    SELECT DISTINCT ON (latest_fuel_reports.linked_station_id)
      latest_fuel_reports.linked_station_id,
      latest_fuel_reports.fuel_type,
      latest_fuel_reports.price_value,
      COALESCE(latest_fuel_reports.fuel_status, 'Available') AS fuel_status
    FROM latest_fuel_reports
    WHERE latest_fuel_reports.price_value IS NOT NULL
      AND latest_fuel_reports.price_value > 0
    ORDER BY
      latest_fuel_reports.linked_station_id,
      latest_fuel_reports.price_value ASC,
      latest_fuel_reports.fuel_type ASC
  )
  SELECT
    ss.id,
    ss.name,
    ss.address,
    ss.lat,
    ss.lng,
    COALESCE(selected_prices.fuel_status, 'Out') AS status,
    ss.created_at,
    ss.updated_at,
    selected_prices.fuel_type,
    COALESCE(round(selected_prices.price_value::numeric, 2), 0::numeric) AS price_per_liter,
    COALESCE(reconstructed_maps.prices, public.empty_fuel_price_map()) AS prices,
    public.empty_fuel_price_map() AS previous_prices,
    public.empty_fuel_price_map() AS price_trends,
    ss.report_count,
    ss.province_code,
    ss.city_municipality_code,
    ss.google_place_id,
    ss.is_verified,
    ss.verified_at,
    ss.is_lgu_verified,
    ss.lgu_verified_at,
    ss.lgu_verified_by,
    ss.lgu_verified_role,
    ss.station_brand_logo_id,
    ss.manager_user_id,
    COALESCE(reconstructed_maps.fuel_availability, public.empty_fuel_availability_map()) AS fuel_availability
  FROM station_scope AS ss
  LEFT JOIN reconstructed_maps
    ON reconstructed_maps.linked_station_id = ss.id
  LEFT JOIN selected_prices
    ON selected_prices.linked_station_id = ss.id
  ORDER BY ss.name ASC;
$$;

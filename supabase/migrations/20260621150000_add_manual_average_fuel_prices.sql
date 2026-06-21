-- manual_average_fuel_prices: admin-set average/min/max prices per fuel type
-- that override the crowd-sourced homepage averages.
--
-- One row per fuel type. When a row exists, get_public_station_summary returns
-- its avg/min/max instead of the computed AVG; otherwise the average falls back
-- to the recent approved-report average and min/max stay null. Setting a fuel
-- type to null in the payload clears its override.

CREATE TABLE IF NOT EXISTS public.manual_average_fuel_prices (
  fuel_type text PRIMARY KEY,
  avg_price numeric NOT NULL CHECK (avg_price > 0),
  min_price numeric CHECK (min_price > 0),
  max_price numeric CHECK (max_price > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

ALTER TABLE public.manual_average_fuel_prices ENABLE ROW LEVEL SECURITY;

-- All reads/writes go through the SECURITY DEFINER RPCs below; no direct policies.

-- Current overrides (super admin only).
CREATE OR REPLACE FUNCTION public.get_manual_average_fuel_prices()
RETURNS TABLE (
  fuel_type text,
  avg_price double precision,
  min_price double precision,
  max_price double precision,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.fuel_type,
    m.avg_price::double precision,
    m.min_price::double precision,
    m.max_price::double precision,
    m.updated_at
  FROM public.manual_average_fuel_prices AS m
  WHERE public.is_super_admin(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_manual_average_fuel_prices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_manual_average_fuel_prices() TO authenticated;

-- Upsert/clear overrides. Payload keyed by canonical fuel type label:
--   { "Unleaded": { "avg": 84.38, "min": 76, "max": 93 }, "Diesel": null, ... }
-- avg is required and must be > 0. min/max are optional; null/missing clears
-- them. A null value for a fuel type clears the whole override. Keys not present
-- in the payload are left untouched. Super admin only.
CREATE OR REPLACE FUNCTION public.set_manual_average_fuel_prices(_prices jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _fuel_type text;
  _entry jsonb;
  _avg numeric;
  _min numeric;
  _max numeric;
  _changed integer := 0;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Super admin access required';
  END IF;

  IF _prices IS NULL OR jsonb_typeof(_prices) <> 'object' THEN
    RAISE EXCEPTION 'Prices payload must be a JSON object';
  END IF;

  FOREACH _fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel', 'Premium Diesel', 'Kerosene'] LOOP
    -- Skip keys not provided so callers can update a subset.
    IF NOT (_prices ? _fuel_type) THEN
      CONTINUE;
    END IF;

    _entry := _prices -> _fuel_type;

    -- Null or non-object entry clears the override.
    IF _entry IS NULL OR jsonb_typeof(_entry) <> 'object' THEN
      DELETE FROM public.manual_average_fuel_prices WHERE fuel_type = _fuel_type;
      _changed := _changed + 1;
      CONTINUE;
    END IF;

    _avg := NULLIF(btrim(COALESCE(_entry ->> 'avg', '')), '')::numeric;
    _min := NULLIF(btrim(COALESCE(_entry ->> 'min', '')), '')::numeric;
    _max := NULLIF(btrim(COALESCE(_entry ->> 'max', '')), '')::numeric;

    -- No average means no override.
    IF _avg IS NULL OR _avg <= 0 THEN
      DELETE FROM public.manual_average_fuel_prices WHERE fuel_type = _fuel_type;
      _changed := _changed + 1;
      CONTINUE;
    END IF;

    IF _min IS NOT NULL AND _min <= 0 THEN _min := NULL; END IF;
    IF _max IS NOT NULL AND _max <= 0 THEN _max := NULL; END IF;

    IF _min IS NOT NULL AND _max IS NOT NULL AND _min > _max THEN
      RAISE EXCEPTION 'Min price exceeds max price for %', _fuel_type;
    END IF;

    INSERT INTO public.manual_average_fuel_prices (fuel_type, avg_price, min_price, max_price, updated_at, updated_by)
    VALUES (_fuel_type, _avg, _min, _max, now(), _actor_id)
    ON CONFLICT (fuel_type)
    DO UPDATE SET avg_price = EXCLUDED.avg_price,
                  min_price = EXCLUDED.min_price,
                  max_price = EXCLUDED.max_price,
                  updated_at = EXCLUDED.updated_at,
                  updated_by = EXCLUDED.updated_by;

    _changed := _changed + 1;
  END LOOP;

  RETURN _changed;
END;
$$;

REVOKE ALL ON FUNCTION public.set_manual_average_fuel_prices(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_manual_average_fuel_prices(jsonb) TO authenticated;

-- Homepage summary: prefer manual override per fuel type, else recent-report AVG.
-- min/max come only from manual overrides.
DROP FUNCTION IF EXISTS public.get_public_station_summary();

CREATE FUNCTION public.get_public_station_summary()
RETURNS TABLE (
  sample_report_count bigint,
  window_days integer,
  average_unleaded double precision,
  average_premium double precision,
  average_diesel double precision,
  average_premium_diesel double precision,
  average_kerosene double precision,
  min_unleaded double precision,
  min_premium double precision,
  min_diesel double precision,
  min_premium_diesel double precision,
  min_kerosene double precision,
  max_unleaded double precision,
  max_premium double precision,
  max_diesel double precision,
  max_premium_diesel double precision,
  max_kerosene double precision
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
  ),
  manual AS (
    SELECT
      MAX(avg_price) FILTER (WHERE fuel_type = 'Unleaded')::double precision AS avg_unleaded,
      MAX(avg_price) FILTER (WHERE fuel_type = 'Premium')::double precision AS avg_premium,
      MAX(avg_price) FILTER (WHERE fuel_type = 'Diesel')::double precision AS avg_diesel,
      MAX(avg_price) FILTER (WHERE fuel_type = 'Premium Diesel')::double precision AS avg_premium_diesel,
      MAX(avg_price) FILTER (WHERE fuel_type = 'Kerosene')::double precision AS avg_kerosene,
      MAX(min_price) FILTER (WHERE fuel_type = 'Unleaded')::double precision AS min_unleaded,
      MAX(min_price) FILTER (WHERE fuel_type = 'Premium')::double precision AS min_premium,
      MAX(min_price) FILTER (WHERE fuel_type = 'Diesel')::double precision AS min_diesel,
      MAX(min_price) FILTER (WHERE fuel_type = 'Premium Diesel')::double precision AS min_premium_diesel,
      MAX(min_price) FILTER (WHERE fuel_type = 'Kerosene')::double precision AS min_kerosene,
      MAX(max_price) FILTER (WHERE fuel_type = 'Unleaded')::double precision AS max_unleaded,
      MAX(max_price) FILTER (WHERE fuel_type = 'Premium')::double precision AS max_premium,
      MAX(max_price) FILTER (WHERE fuel_type = 'Diesel')::double precision AS max_diesel,
      MAX(max_price) FILTER (WHERE fuel_type = 'Premium Diesel')::double precision AS max_premium_diesel,
      MAX(max_price) FILTER (WHERE fuel_type = 'Kerosene')::double precision AS max_kerosene
    FROM public.manual_average_fuel_prices
  )
  SELECT
    COUNT(*)::bigint AS sample_report_count,
    10::integer AS window_days,
    COALESCE(
      (SELECT avg_unleaded FROM manual),
      AVG(public.resolve_station_fuel_price(recent_reports.prices, recent_reports.fuel_type, recent_reports.price, 'Unleaded'))
    ) AS average_unleaded,
    COALESCE(
      (SELECT avg_premium FROM manual),
      AVG(public.resolve_station_fuel_price(recent_reports.prices, recent_reports.fuel_type, recent_reports.price, 'Premium'))
    ) AS average_premium,
    COALESCE(
      (SELECT avg_diesel FROM manual),
      AVG(public.resolve_station_fuel_price(recent_reports.prices, recent_reports.fuel_type, recent_reports.price, 'Diesel'))
    ) AS average_diesel,
    COALESCE(
      (SELECT avg_premium_diesel FROM manual),
      AVG(public.resolve_station_fuel_price(recent_reports.prices, recent_reports.fuel_type, recent_reports.price, 'Premium Diesel'))
    ) AS average_premium_diesel,
    COALESCE(
      (SELECT avg_kerosene FROM manual),
      AVG(public.resolve_station_fuel_price(recent_reports.prices, recent_reports.fuel_type, recent_reports.price, 'Kerosene'))
    ) AS average_kerosene,
    (SELECT min_unleaded FROM manual) AS min_unleaded,
    (SELECT min_premium FROM manual) AS min_premium,
    (SELECT min_diesel FROM manual) AS min_diesel,
    (SELECT min_premium_diesel FROM manual) AS min_premium_diesel,
    (SELECT min_kerosene FROM manual) AS min_kerosene,
    (SELECT max_unleaded FROM manual) AS max_unleaded,
    (SELECT max_premium FROM manual) AS max_premium,
    (SELECT max_diesel FROM manual) AS max_diesel,
    (SELECT max_premium_diesel FROM manual) AS max_premium_diesel,
    (SELECT max_kerosene FROM manual) AS max_kerosene
  FROM recent_reports;
$$;

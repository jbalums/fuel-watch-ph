ALTER TABLE public.gas_stations
  ALTER COLUMN fuel_type DROP NOT NULL,
  ALTER COLUMN fuel_type DROP DEFAULT;

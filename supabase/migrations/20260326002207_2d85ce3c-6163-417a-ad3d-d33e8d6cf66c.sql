
-- Add columns to gas_stations for display purposes
ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS fuel_type text NOT NULL DEFAULT 'Diesel',
  ADD COLUMN IF NOT EXISTS price_per_liter numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

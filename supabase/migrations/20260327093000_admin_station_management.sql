ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS applied_station_id uuid REFERENCES public.gas_stations(id) ON DELETE SET NULL;

UPDATE public.fuel_reports
SET review_status = 'pending'
WHERE review_status IS NULL;

ALTER TABLE public.fuel_reports
  ALTER COLUMN review_status SET DEFAULT 'pending',
  ALTER COLUMN review_status SET NOT NULL;

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_review_status_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS fuel_reports_review_status_idx
  ON public.fuel_reports (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS gas_stations_name_normalized_idx
  ON public.gas_stations ((lower(btrim(name))));

DROP POLICY IF EXISTS "Authenticated users can insert stations" ON public.gas_stations;

CREATE POLICY "Admins can insert stations"
ON public.gas_stations
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update stations"
ON public.gas_stations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete stations"
ON public.gas_stations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any report"
ON public.fuel_reports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

CREATE OR REPLACE FUNCTION public.reject_fuel_report(_report_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_user_id uuid := auth.uid();
  _report public.fuel_reports%ROWTYPE;
BEGIN
  IF _admin_user_id IS NULL OR NOT public.has_role(_admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject reports';
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
    RAISE EXCEPTION 'Approved reports cannot be rejected';
  END IF;

  IF _report.review_status = 'rejected' THEN
    RAISE EXCEPTION 'This report has already been rejected';
  END IF;

  UPDATE public.fuel_reports
  SET review_status = 'rejected',
      reviewed_at = now(),
      reviewed_by = _admin_user_id,
      applied_station_id = NULL
  WHERE id = _report.id;

  RETURN _report.id;
END;
$$;

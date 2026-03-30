CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.geo_provinces (
  code text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geo_provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Geo provinces viewable by everyone" ON public.geo_provinces;
CREATE POLICY "Geo provinces viewable by everyone"
ON public.geo_provinces
FOR SELECT
USING (true);

CREATE TABLE IF NOT EXISTS public.geo_cities_municipalities (
  code text PRIMARY KEY,
  province_code text NOT NULL REFERENCES public.geo_provinces(code) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_code, name)
);

ALTER TABLE public.geo_cities_municipalities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Geo cities viewable by everyone" ON public.geo_cities_municipalities;
CREATE POLICY "Geo cities viewable by everyone"
ON public.geo_cities_municipalities
FOR SELECT
USING (true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

DROP INDEX IF EXISTS profiles_username_lower_idx;
CREATE UNIQUE INDEX profiles_username_lower_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format_check
  CHECK (
    username IS NULL
    OR username ~ '^[A-Za-z0-9_]{3,30}$'
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NULLIF(btrim(NEW.raw_user_meta_data->>'username'), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.gas_stations
  ADD COLUMN IF NOT EXISTS province_code text REFERENCES public.geo_provinces(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_municipality_code text REFERENCES public.geo_cities_municipalities(code) ON DELETE SET NULL;

ALTER TABLE public.gas_stations
  DROP CONSTRAINT IF EXISTS gas_stations_geo_pair_check;

ALTER TABLE public.gas_stations
  ADD CONSTRAINT gas_stations_geo_pair_check
  CHECK (
    (province_code IS NULL AND city_municipality_code IS NULL)
    OR (province_code IS NOT NULL AND city_municipality_code IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS gas_stations_province_code_idx
  ON public.gas_stations (province_code, city_municipality_code, updated_at DESC);

ALTER TABLE public.fuel_reports
  ADD COLUMN IF NOT EXISTS province_code text REFERENCES public.geo_provinces(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city_municipality_code text REFERENCES public.geo_cities_municipalities(code) ON DELETE SET NULL;

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_geo_pair_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_geo_pair_check
  CHECK (
    (province_code IS NULL AND city_municipality_code IS NULL)
    OR (province_code IS NOT NULL AND city_municipality_code IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS fuel_reports_geo_scope_idx
  ON public.fuel_reports (province_code, city_municipality_code, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('province', 'city')),
  province_code text NOT NULL REFERENCES public.geo_provinces(code) ON DELETE RESTRICT,
  city_municipality_code text REFERENCES public.geo_cities_municipalities(code) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_scopes
  DROP CONSTRAINT IF EXISTS user_scopes_scope_type_check;

ALTER TABLE public.user_scopes
  ADD CONSTRAINT user_scopes_scope_type_check
  CHECK (
    (scope_type = 'province' AND city_municipality_code IS NULL)
    OR (scope_type = 'city' AND city_municipality_code IS NOT NULL)
  );

ALTER TABLE public.user_scopes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_user_scopes_updated_at ON public.user_scopes;
CREATE TRIGGER update_user_scopes_updated_at
BEFORE UPDATE ON public.user_scopes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Users can view own user scope" ON public.user_scopes;
CREATE POLICY "Users can view own user scope"
ON public.user_scopes
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  mobile_number text NOT NULL,
  office_name text NOT NULL,
  position_title text NOT NULL,
  requested_role public.app_role NOT NULL,
  province_code text NOT NULL REFERENCES public.geo_provinces(code) ON DELETE RESTRICT,
  city_municipality_code text REFERENCES public.geo_cities_municipalities(code) ON DELETE RESTRICT,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_access_requests
  DROP CONSTRAINT IF EXISTS admin_access_requests_role_check;

ALTER TABLE public.admin_access_requests
  ADD CONSTRAINT admin_access_requests_role_check
  CHECK (requested_role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role));

ALTER TABLE public.admin_access_requests
  DROP CONSTRAINT IF EXISTS admin_access_requests_scope_check;

ALTER TABLE public.admin_access_requests
  ADD CONSTRAINT admin_access_requests_scope_check
  CHECK (
    (requested_role = 'province_admin'::public.app_role AND city_municipality_code IS NULL)
    OR (requested_role = 'city_admin'::public.app_role AND city_municipality_code IS NOT NULL)
  );

ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_admin_access_requests_updated_at ON public.admin_access_requests;
CREATE TRIGGER update_admin_access_requests_updated_at
BEFORE UPDATE ON public.admin_access_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS admin_access_requests_status_idx
  ON public.admin_access_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS admin_access_requests_pending_scope_email_idx
  ON public.admin_access_requests (
    lower(email),
    requested_role,
    province_code,
    COALESCE(city_municipality_code, '')
  )
  WHERE status = 'pending';

DROP POLICY IF EXISTS "Super admins can review access requests" ON public.admin_access_requests;
CREATE POLICY "Super admins can review access requests"
ON public.admin_access_requests
FOR SELECT
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can update access requests" ON public.admin_access_requests;
CREATE POLICY "Super admins can update access requests"
ON public.admin_access_requests
FOR UPDATE
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_id uuid REFERENCES public.admin_access_requests(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL,
  province_code text NOT NULL REFERENCES public.geo_provinces(code) ON DELETE RESTRICT,
  city_municipality_code text REFERENCES public.geo_cities_municipalities(code) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_invites
  DROP CONSTRAINT IF EXISTS admin_invites_role_check;

ALTER TABLE public.admin_invites
  ADD CONSTRAINT admin_invites_role_check
  CHECK (role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role));

ALTER TABLE public.admin_invites
  DROP CONSTRAINT IF EXISTS admin_invites_scope_check;

ALTER TABLE public.admin_invites
  ADD CONSTRAINT admin_invites_scope_check
  CHECK (
    (role = 'province_admin'::public.app_role AND city_municipality_code IS NULL)
    OR (role = 'city_admin'::public.app_role AND city_municipality_code IS NOT NULL)
  );

ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_admin_invites_updated_at ON public.admin_invites;
CREATE TRIGGER update_admin_invites_updated_at
BEFORE UPDATE ON public.admin_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS admin_invites_status_idx
  ON public.admin_invites (created_at DESC, expires_at DESC, used_at);

DROP POLICY IF EXISTS "Super admins can view admin invites" ON public.admin_invites;
CREATE POLICY "Super admins can view admin invites"
ON public.admin_invites
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_legacy_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_scope(_user_id uuid)
RETURNS TABLE (
  scope_type text,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_scopes.scope_type,
    user_scopes.province_code,
    geo_provinces.name,
    user_scopes.city_municipality_code,
    geo_cities_municipalities.name
  FROM public.user_scopes
  JOIN public.geo_provinces
    ON geo_provinces.code = user_scopes.province_code
  LEFT JOIN public.geo_cities_municipalities
    ON geo_cities_municipalities.code = user_scopes.city_municipality_code
  WHERE user_scopes.user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_scope()
RETURNS TABLE (
  scope_type text,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.get_user_scope(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.can_manage_geo_scope(
  _user_id uuid,
  _province_code text,
  _city_municipality_code text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scope public.user_scopes%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_legacy_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF _province_code IS NULL OR _city_municipality_code IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO _scope
  FROM public.user_scopes
  WHERE user_id = _user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'province_admin'::public.app_role
  ) THEN
    RETURN _scope.scope_type = 'province'
      AND _scope.province_code = _province_code;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'city_admin'::public.app_role
  ) THEN
    RETURN _scope.scope_type = 'city'
      AND _scope.province_code = _province_code
      AND _scope.city_municipality_code = _city_municipality_code;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_admin_access_request(
  _full_name text,
  _email text,
  _mobile_number text,
  _office_name text,
  _position_title text,
  _requested_role public.app_role,
  _province_code text,
  _city_municipality_code text,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id uuid;
  _normalized_email text := lower(btrim(COALESCE(_email, '')));
  _normalized_full_name text := btrim(COALESCE(_full_name, ''));
  _normalized_mobile text := btrim(COALESCE(_mobile_number, ''));
  _normalized_office text := btrim(COALESCE(_office_name, ''));
  _normalized_position text := btrim(COALESCE(_position_title, ''));
  _normalized_reason text := btrim(COALESCE(_reason, ''));
  _normalized_city_code text := NULLIF(btrim(COALESCE(_city_municipality_code, '')), '');
BEGIN
  IF _normalized_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF _normalized_email = '' OR position('@' IN _normalized_email) = 0 THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF _normalized_mobile = '' THEN
    RAISE EXCEPTION 'Mobile number is required';
  END IF;

  IF _normalized_office = '' THEN
    RAISE EXCEPTION 'Office name is required';
  END IF;

  IF _normalized_position = '' THEN
    RAISE EXCEPTION 'Position title is required';
  END IF;

  IF _normalized_reason = '' THEN
    RAISE EXCEPTION 'Reason for access is required';
  END IF;

  IF _requested_role NOT IN ('province_admin'::public.app_role, 'city_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only province or city admin requests are allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.geo_provinces
    WHERE code = _province_code
  ) THEN
    RAISE EXCEPTION 'Please select a valid province';
  END IF;

  IF _requested_role = 'city_admin'::public.app_role THEN
    IF _normalized_city_code IS NULL THEN
      RAISE EXCEPTION 'Please select a city or municipality';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.geo_cities_municipalities
      WHERE code = _normalized_city_code
        AND province_code = _province_code
    ) THEN
      RAISE EXCEPTION 'Selected city or municipality does not belong to the chosen province';
    END IF;
  ELSE
    _normalized_city_code := NULL;
  END IF;

  INSERT INTO public.admin_access_requests (
    full_name,
    email,
    mobile_number,
    office_name,
    position_title,
    requested_role,
    province_code,
    city_municipality_code,
    reason
  )
  VALUES (
    _normalized_full_name,
    _normalized_email,
    _normalized_mobile,
    _normalized_office,
    _normalized_position,
    _requested_role,
    _province_code,
    _normalized_city_code,
    _normalized_reason
  )
  RETURNING id INTO _request_id;

  RETURN _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_access_requests()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  mobile_number text,
  office_name text,
  position_title text,
  requested_role public.app_role,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  reason text,
  status text,
  review_notes text,
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can review access requests';
  END IF;

  RETURN QUERY
  SELECT
    requests.id,
    requests.full_name,
    requests.email,
    requests.mobile_number,
    requests.office_name,
    requests.position_title,
    requests.requested_role,
    requests.province_code,
    provinces.name,
    requests.city_municipality_code,
    cities.name,
    requests.reason,
    requests.status,
    requests.review_notes,
    requests.reviewed_by,
    reviewer_profiles.display_name,
    requests.reviewed_at,
    requests.created_at,
    requests.updated_at
  FROM public.admin_access_requests AS requests
  JOIN public.geo_provinces AS provinces
    ON provinces.code = requests.province_code
  LEFT JOIN public.geo_cities_municipalities AS cities
    ON cities.code = requests.city_municipality_code
  LEFT JOIN public.profiles AS reviewer_profiles
    ON reviewer_profiles.user_id = requests.reviewed_by
  ORDER BY requests.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_access_request(_request_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  mobile_number text,
  office_name text,
  position_title text,
  requested_role public.app_role,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  reason text,
  status text,
  review_notes text,
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can review access requests';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.list_admin_access_requests()
  WHERE list_admin_access_requests.id = _request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_admin_invite_for_request(
  _request_id uuid,
  _expires_in_days integer DEFAULT 7
)
RETURNS TABLE (
  invite_id uuid,
  invite_token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _request public.admin_access_requests%ROWTYPE;
  _raw_token text;
  _token_hash text;
  _invite_id uuid;
  _expires_at timestamptz;
BEGIN
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can issue admin invites';
  END IF;

  IF COALESCE(_expires_in_days, 0) < 1 OR _expires_in_days > 30 THEN
    RAISE EXCEPTION 'Invite expiry must be between 1 and 30 days';
  END IF;

  SELECT *
  INTO _request
  FROM public.admin_access_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;

  IF _request.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved requests can receive invites';
  END IF;

  UPDATE public.admin_invites AS invites
  SET expires_at = now(),
      updated_at = now()
  WHERE invites.access_request_id = _request.id
    AND invites.used_at IS NULL
    AND invites.expires_at > now();

  _raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  _token_hash := encode(extensions.digest(_raw_token, 'sha256'), 'hex');
  _expires_at := now() + make_interval(days => _expires_in_days);

  INSERT INTO public.admin_invites (
    access_request_id,
    token_hash,
    email,
    full_name,
    role,
    province_code,
    city_municipality_code,
    created_by,
    expires_at
  )
  VALUES (
    _request.id,
    _token_hash,
    _request.email,
    _request.full_name,
    _request.requested_role,
    _request.province_code,
    _request.city_municipality_code,
    _actor_id,
    _expires_at
  )
  RETURNING id INTO _invite_id;

  RETURN QUERY
  SELECT _invite_id, _raw_token, _expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_admin_access_request(
  _request_id uuid,
  _review_notes text,
  _approved_role public.app_role,
  _province_code text,
  _city_municipality_code text,
  _expires_in_days integer DEFAULT 7
)
RETURNS TABLE (
  request_id uuid,
  invite_id uuid,
  invite_token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _request public.admin_access_requests%ROWTYPE;
  _city_code text := NULLIF(btrim(COALESCE(_city_municipality_code, '')), '');
  _issued_record record;
BEGIN
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can approve access requests';
  END IF;

  SELECT *
  INTO _request
  FROM public.admin_access_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;

  IF _request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved';
  END IF;

  IF _approved_role NOT IN ('province_admin'::public.app_role, 'city_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Approved role must be city or province admin';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.geo_provinces
    WHERE code = _province_code
  ) THEN
    RAISE EXCEPTION 'Please select a valid province';
  END IF;

  IF _approved_role = 'city_admin'::public.app_role THEN
    IF _city_code IS NULL THEN
      RAISE EXCEPTION 'City or municipality is required for city admin access';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.geo_cities_municipalities
      WHERE code = _city_code
        AND province_code = _province_code
    ) THEN
      RAISE EXCEPTION 'Selected city or municipality does not belong to the chosen province';
    END IF;
  ELSE
    _city_code := NULL;
  END IF;

  UPDATE public.admin_access_requests
  SET requested_role = _approved_role,
      province_code = _province_code,
      city_municipality_code = _city_code,
      status = 'approved',
      review_notes = NULLIF(btrim(COALESCE(_review_notes, '')), ''),
      reviewed_by = _actor_id,
      reviewed_at = now()
  WHERE id = _request.id;

  SELECT *
  INTO _issued_record
  FROM public.issue_admin_invite_for_request(_request.id, _expires_in_days);

  RETURN QUERY
  SELECT _request.id, _issued_record.invite_id, _issued_record.invite_token, _issued_record.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_admin_access_request(
  _request_id uuid,
  _review_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _request public.admin_access_requests%ROWTYPE;
BEGIN
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can reject access requests';
  END IF;

  SELECT *
  INTO _request
  FROM public.admin_access_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access request not found';
  END IF;

  IF _request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be rejected';
  END IF;

  UPDATE public.admin_access_requests
  SET status = 'rejected',
      review_notes = NULLIF(btrim(COALESCE(_review_notes, '')), ''),
      reviewed_by = _actor_id,
      reviewed_at = now()
  WHERE id = _request.id;

  RETURN _request.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_admin_invites()
RETURNS TABLE (
  id uuid,
  access_request_id uuid,
  email text,
  full_name text,
  role public.app_role,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  created_by uuid,
  created_by_name text,
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  used_by_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can view admin invites';
  END IF;

  RETURN QUERY
  SELECT
    invites.id,
    invites.access_request_id,
    invites.email,
    invites.full_name,
    invites.role,
    invites.province_code,
    provinces.name,
    invites.city_municipality_code,
    cities.name,
    invites.created_by,
    created_by_profiles.display_name,
    invites.expires_at,
    invites.used_at,
    invites.used_by,
    used_by_profiles.display_name,
    invites.created_at
  FROM public.admin_invites AS invites
  JOIN public.geo_provinces AS provinces
    ON provinces.code = invites.province_code
  LEFT JOIN public.geo_cities_municipalities AS cities
    ON cities.code = invites.city_municipality_code
  LEFT JOIN public.profiles AS created_by_profiles
    ON created_by_profiles.user_id = invites.created_by
  LEFT JOIN public.profiles AS used_by_profiles
    ON used_by_profiles.user_id = invites.used_by
  ORDER BY invites.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_admin_invite(_token text)
RETURNS TABLE (
  invite_id uuid,
  email text,
  full_name text,
  role public.app_role,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token_hash text := encode(extensions.digest(btrim(COALESCE(_token, '')), 'sha256'), 'hex');
BEGIN
  IF btrim(COALESCE(_token, '')) = '' THEN
    RAISE EXCEPTION 'Invite token is required';
  END IF;

  RETURN QUERY
  SELECT
    invites.id,
    invites.email,
    invites.full_name,
    invites.role,
    invites.province_code,
    provinces.name,
    invites.city_municipality_code,
    cities.name,
    invites.expires_at
  FROM public.admin_invites AS invites
  JOIN public.geo_provinces AS provinces
    ON provinces.code = invites.province_code
  LEFT JOIN public.geo_cities_municipalities AS cities
    ON cities.code = invites.city_municipality_code
  WHERE invites.token_hash = _token_hash
    AND invites.used_at IS NULL
    AND invites.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite is invalid, expired, or already used';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_admin_invite(
  _token text,
  _full_name text,
  _username text
)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _invite public.admin_invites%ROWTYPE;
  _actor_email text;
  _normalized_username text := NULLIF(btrim(COALESCE(_username, '')), '');
  _normalized_full_name text := NULLIF(btrim(COALESCE(_full_name, '')), '');
  _scope_type text;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO _invite
  FROM public.admin_invites
  WHERE token_hash = encode(extensions.digest(btrim(COALESCE(_token, '')), 'sha256'), 'hex')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF _invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;

  IF _invite.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  SELECT email::text
  INTO _actor_email
  FROM auth.users
  WHERE id = _actor_id;

  IF _actor_email IS NULL OR lower(_actor_email) <> lower(_invite.email) THEN
    RAISE EXCEPTION 'This invite is only valid for %', _invite.email;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _actor_id
      AND role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'province_admin'::public.app_role,
        'city_admin'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION 'This account already has elevated access';
  END IF;

  IF _normalized_username IS NULL THEN
    RAISE EXCEPTION 'Username is required';
  END IF;

  IF _normalized_username !~ '^[A-Za-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'Username must be 3 to 30 characters and use only letters, numbers, or underscores';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(_normalized_username)
      AND user_id <> _actor_id
  ) THEN
    RAISE EXCEPTION 'That username is already in use';
  END IF;

  _normalized_full_name := COALESCE(_normalized_full_name, NULLIF(btrim(COALESCE(_invite.full_name, '')), ''));

  IF _normalized_full_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_actor_id, _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  _scope_type := CASE
    WHEN _invite.role = 'province_admin'::public.app_role THEN 'province'
    ELSE 'city'
  END;

  INSERT INTO public.user_scopes (
    user_id,
    scope_type,
    province_code,
    city_municipality_code
  )
  VALUES (
    _actor_id,
    _scope_type,
    _invite.province_code,
    CASE
      WHEN _scope_type = 'city' THEN _invite.city_municipality_code
      ELSE NULL
    END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET scope_type = EXCLUDED.scope_type,
      province_code = EXCLUDED.province_code,
      city_municipality_code = EXCLUDED.city_municipality_code,
      updated_at = now();

  INSERT INTO public.profiles (
    user_id,
    display_name,
    username
  )
  VALUES (
    _actor_id,
    _normalized_full_name,
    _normalized_username
  )
  ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      username = EXCLUDED.username,
      updated_at = now();

  UPDATE public.admin_invites
  SET used_at = now(),
      used_by = _actor_id
  WHERE id = _invite.id;

  RETURN _invite.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_scoped_dashboard_stats()
RETURNS TABLE (
  total_stations bigint,
  pending_reports bigint,
  reviewed_reports bigint,
  total_reports bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE public.can_manage_geo_scope(
        _actor_id,
        gas_stations.province_code,
        gas_stations.city_municipality_code
      )
    ) AS total_stations,
    (
      SELECT COUNT(*)
      FROM public.fuel_reports
      WHERE public.can_manage_geo_scope(
        _actor_id,
        fuel_reports.province_code,
        fuel_reports.city_municipality_code
      )
        AND fuel_reports.review_status = 'pending'
    ) AS pending_reports,
    (
      SELECT COUNT(*)
      FROM public.fuel_reports
      WHERE public.can_manage_geo_scope(
        _actor_id,
        fuel_reports.province_code,
        fuel_reports.city_municipality_code
      )
        AND fuel_reports.review_status <> 'pending'
    ) AS reviewed_reports,
    (
      SELECT COUNT(*)
      FROM public.fuel_reports
      WHERE public.can_manage_geo_scope(
        _actor_id,
        fuel_reports.province_code,
        fuel_reports.city_municipality_code
      )
    ) AS total_reports
  FROM public.gas_stations;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_scoped_gas_stations()
RETURNS SETOF public.gas_stations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.gas_stations
  WHERE public.can_manage_geo_scope(
    auth.uid(),
    gas_stations.province_code,
    gas_stations.city_municipality_code
  )
  ORDER BY updated_at DESC
$$;

CREATE OR REPLACE FUNCTION public.list_scoped_fuel_reports()
RETURNS SETOF public.fuel_reports
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.fuel_reports
  WHERE public.can_manage_geo_scope(
    auth.uid(),
    fuel_reports.province_code,
    fuel_reports.city_municipality_code
  )
  ORDER BY created_at DESC
$$;

DROP POLICY IF EXISTS "Admins can insert stations" ON public.gas_stations;
DROP POLICY IF EXISTS "Admins can update stations" ON public.gas_stations;
DROP POLICY IF EXISTS "Admins can delete stations" ON public.gas_stations;

CREATE POLICY "Privileged users can insert stations"
ON public.gas_stations
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

CREATE POLICY "Privileged users can update stations"
ON public.gas_stations
FOR UPDATE
TO authenticated
USING (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
)
WITH CHECK (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

CREATE POLICY "Privileged users can delete stations"
ON public.gas_stations
FOR DELETE
TO authenticated
USING (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

DROP POLICY IF EXISTS "Admins can update any report" ON public.fuel_reports;

CREATE POLICY "Privileged users can update scoped reports"
ON public.fuel_reports
FOR UPDATE
TO authenticated
USING (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
)
WITH CHECK (
  public.can_manage_geo_scope(
    auth.uid(),
    province_code,
    city_municipality_code
  )
);

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
  _report_prices jsonb := jsonb_build_object(
    'Unleaded', NULL,
    'Premium', NULL,
    'Diesel', NULL
  );
  _candidate_fuel_type text;
  _candidate_price_text text;
  _candidate_price numeric;
  _selected_fuel_type text;
  _selected_price numeric;
  _resolved_address text;
  _scope_province text;
  _scope_city text;
BEGIN
  IF _admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

  _report_prices := COALESCE(_report.prices, _report_prices);

  IF _report.price > 0
    AND NULLIF(btrim(COALESCE(_report_prices ->> _report.fuel_type, '')), '') IS NULL THEN
    _report_prices := _report_prices || jsonb_build_object(_report.fuel_type, to_jsonb(_report.price));
  END IF;

  FOREACH _candidate_fuel_type IN ARRAY ARRAY['Unleaded', 'Premium', 'Diesel'] LOOP
    _candidate_price_text := NULLIF(
      btrim(COALESCE(_report_prices ->> _candidate_fuel_type, '')),
      ''
    );

    IF _candidate_price_text IS NULL THEN
      CONTINUE;
    END IF;

    _candidate_price := _candidate_price_text::numeric;

    IF _candidate_price <= 0 THEN
      CONTINUE;
    END IF;

    IF _selected_price IS NULL OR _candidate_price < _selected_price THEN
      _selected_price := _candidate_price;
      _selected_fuel_type := _candidate_fuel_type;
    END IF;
  END LOOP;

  IF _selected_price IS NULL OR _selected_fuel_type IS NULL THEN
    RAISE EXCEPTION 'Report must include at least one valid fuel price';
  END IF;

  IF _report.station_id IS NOT NULL THEN
    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE id = _report.station_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected station no longer exists';
    END IF;

    _scope_province := COALESCE(_report.province_code, _station.province_code);
    _scope_city := COALESCE(_report.city_municipality_code, _station.city_municipality_code);

    IF NOT public.can_manage_geo_scope(_admin_user_id, _scope_province, _scope_city) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = COALESCE(
          prices,
          jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
        ) || jsonb_strip_nulls(_report_prices),
        status = _report.status,
        report_count = COALESCE(report_count, 0) + 1,
        province_code = COALESCE(gas_stations.province_code, _report.province_code),
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code)
    WHERE id = _station.id
    RETURNING * INTO _station;

  ELSIF _report.reported_address IS NULL THEN
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

    _scope_province := COALESCE(_report.province_code, _station.province_code);
    _scope_city := COALESCE(_report.city_municipality_code, _station.city_municipality_code);

    IF NOT public.can_manage_geo_scope(_admin_user_id, _scope_province, _scope_city) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    UPDATE public.gas_stations
    SET fuel_type = _selected_fuel_type,
        price_per_liter = _selected_price,
        prices = COALESCE(
          prices,
          jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL)
        ) || jsonb_strip_nulls(_report_prices),
        status = _report.status,
        report_count = COALESCE(report_count, 0) + 1,
        province_code = COALESCE(gas_stations.province_code, _report.province_code),
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code)
    WHERE id = _station.id
    RETURNING * INTO _station;

  ELSE
    IF _report.lat IS NULL OR _report.lng IS NULL THEN
      RAISE EXCEPTION 'Location is required to create a new station';
    END IF;

    IF _report.province_code IS NULL OR _report.city_municipality_code IS NULL THEN
      RAISE EXCEPTION 'Report geographic scope must be assigned before approval';
    END IF;

    IF NOT public.can_manage_geo_scope(
      _admin_user_id,
      _report.province_code,
      _report.city_municipality_code
    ) THEN
      RAISE EXCEPTION 'You are not allowed to approve reports for this geographic scope';
    END IF;

    _resolved_address := NULLIF(btrim(_report.reported_address), '');

    IF _resolved_address IS NULL THEN
      _resolved_address := 'Pinned location (' ||
        round(_report.lat::numeric, 6) || ', ' ||
        round(_report.lng::numeric, 6) || ')';
    END IF;

    INSERT INTO public.gas_stations (
      name,
      address,
      lat,
      lng,
      status,
      fuel_type,
      price_per_liter,
      prices,
      report_count,
      province_code,
      city_municipality_code
    )
    VALUES (
      btrim(_report.station_name),
      _resolved_address,
      _report.lat,
      _report.lng,
      _report.status,
      _selected_fuel_type,
      _selected_price,
      jsonb_build_object('Unleaded', NULL, 'Premium', NULL, 'Diesel', NULL) ||
        jsonb_strip_nulls(_report_prices),
      1,
      _report.province_code,
      _report.city_municipality_code
    )
    RETURNING * INTO _station;
  END IF;

  UPDATE public.fuel_reports
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_user_id,
      applied_station_id = _station.id,
      province_code = COALESCE(province_code, _station.province_code),
      city_municipality_code = COALESCE(city_municipality_code, _station.city_municipality_code)
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
  _station public.gas_stations%ROWTYPE;
  _scope_province text;
  _scope_city text;
BEGIN
  IF _admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

  IF _report.station_id IS NOT NULL THEN
    SELECT *
    INTO _station
    FROM public.gas_stations
    WHERE id = _report.station_id
    LIMIT 1;
  END IF;

  _scope_province := COALESCE(_report.province_code, _station.province_code);
  _scope_city := COALESCE(_report.city_municipality_code, _station.city_municipality_code);

  IF NOT public.can_manage_geo_scope(_admin_user_id, _scope_province, _scope_city) THEN
    RAISE EXCEPTION 'You are not allowed to reject reports for this geographic scope';
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

CREATE OR REPLACE FUNCTION public.list_manageable_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_level public.app_role
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can manage users';
  END IF;

  RETURN QUERY
  SELECT
    auth_users.id,
    auth_users.email::TEXT,
    profiles.display_name,
    profiles.avatar_url,
    CASE
      WHEN public.is_super_admin(auth_users.id) THEN 'super_admin'::public.app_role
      WHEN public.has_role(auth_users.id, 'admin'::public.app_role) THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END AS access_level
  FROM auth.users AS auth_users
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = auth_users.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS user_roles
    WHERE user_roles.user_id = auth_users.id
      AND user_roles.role IN (
        'province_admin'::public.app_role,
        'city_admin'::public.app_role
      )
  )
  ORDER BY LOWER(COALESCE(profiles.display_name, auth_users.email, auth_users.id::TEXT));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_access_level(
  _target_user_id UUID,
  _access_level public.app_role
)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _target_is_super_admin BOOLEAN;
  _super_admin_count INTEGER;
BEGIN
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can manage users';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _target_user_id
      AND role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Use the LGU onboarding modules to manage official LGU admin access';
  END IF;

  IF _access_level NOT IN (
    'user'::public.app_role,
    'admin'::public.app_role,
    'super_admin'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Unsupported access level';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  _target_is_super_admin := public.is_super_admin(_target_user_id);

  IF _target_is_super_admin AND _access_level <> 'super_admin'::public.app_role THEN
    SELECT COUNT(*)
    INTO _super_admin_count
    FROM public.user_roles
    WHERE role = 'super_admin'::public.app_role;

    IF _super_admin_count <= 1 THEN
      RAISE EXCEPTION 'You cannot remove the last remaining super admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND role IN (
      'user'::public.app_role,
      'moderator'::public.app_role,
      'admin'::public.app_role,
      'super_admin'::public.app_role
    );

  IF _access_level IN (
    'admin'::public.app_role,
    'super_admin'::public.app_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target_user_id, _access_level)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN _access_level;
END;
$$;

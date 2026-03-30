CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.admin_invites
  DROP CONSTRAINT IF EXISTS admin_invites_role_check;

ALTER TABLE public.admin_invites
  ADD CONSTRAINT admin_invites_role_check
  CHECK (
    role IN (
      'province_admin'::public.app_role,
      'city_admin'::public.app_role,
      'lgu_staff'::public.app_role
    )
  );

ALTER TABLE public.admin_invites
  DROP CONSTRAINT IF EXISTS admin_invites_scope_check;

ALTER TABLE public.admin_invites
  ADD CONSTRAINT admin_invites_scope_check
  CHECK (
    (role = 'province_admin'::public.app_role AND city_municipality_code IS NULL)
    OR (role = 'city_admin'::public.app_role AND city_municipality_code IS NOT NULL)
    OR role = 'lgu_staff'::public.app_role
  );

ALTER TABLE public.gas_stations
  DROP CONSTRAINT IF EXISTS gas_stations_lgu_verified_role_check;

ALTER TABLE public.gas_stations
  ADD CONSTRAINT gas_stations_lgu_verified_role_check
  CHECK (
    lgu_verified_role IS NULL
    OR lgu_verified_role IN (
      'province_admin'::public.app_role,
      'city_admin'::public.app_role,
      'lgu_staff'::public.app_role
    )
  );

ALTER TABLE public.fuel_reports
  DROP CONSTRAINT IF EXISTS fuel_reports_lgu_verified_role_check;

ALTER TABLE public.fuel_reports
  ADD CONSTRAINT fuel_reports_lgu_verified_role_check
  CHECK (
    lgu_verified_role IS NULL
    OR lgu_verified_role IN (
      'province_admin'::public.app_role,
      'city_admin'::public.app_role,
      'lgu_staff'::public.app_role
    )
  );

CREATE OR REPLACE FUNCTION public.get_lgu_verifier_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'city_admin'::public.app_role
  ) THEN
    RETURN 'city_admin'::public.app_role;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'province_admin'::public.app_role
  ) THEN
    RETURN 'province_admin'::public.app_role;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'lgu_staff'::public.app_role
  ) THEN
    RETURN 'lgu_staff'::public.app_role;
  END IF;

  RETURN NULL;
END;
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
  _has_province_admin boolean;
  _has_city_admin boolean;
  _has_lgu_staff boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_legacy_admin(_user_id) THEN
    RETURN true;
  END IF;

  IF _province_code IS NULL THEN
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

  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'province_admin'::public.app_role
    ),
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'city_admin'::public.app_role
    ),
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'lgu_staff'::public.app_role
    )
  INTO _has_province_admin, _has_city_admin, _has_lgu_staff;

  IF _has_province_admin THEN
    RETURN _scope.scope_type = 'province'
      AND _scope.province_code = _province_code;
  END IF;

  IF _has_city_admin THEN
    RETURN _scope.scope_type = 'city'
      AND _scope.province_code = _province_code
      AND _scope.city_municipality_code = _city_municipality_code;
  END IF;

  IF _has_lgu_staff THEN
    IF _scope.scope_type = 'province' THEN
      RETURN _scope.province_code = _province_code;
    END IF;

    RETURN _scope.scope_type = 'city'
      AND _scope.province_code = _province_code
      AND _scope.city_municipality_code = _city_municipality_code;
  END IF;

  RETURN false;
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
        'city_admin'::public.app_role,
        'lgu_staff'::public.app_role
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

  _normalized_full_name := COALESCE(
    _normalized_full_name,
    NULLIF(btrim(COALESCE(_invite.full_name, '')), '')
  );

  IF _normalized_full_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_actor_id, _invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  _scope_type := CASE
    WHEN _invite.role = 'province_admin'::public.app_role THEN 'province'
    WHEN _invite.role = 'city_admin'::public.app_role THEN 'city'
    WHEN _invite.city_municipality_code IS NOT NULL THEN 'city'
    ELSE 'province'
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

CREATE OR REPLACE FUNCTION public.list_manageable_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
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
    auth_users.email::text,
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
        'city_admin'::public.app_role,
        'lgu_staff'::public.app_role
      )
  )
  ORDER BY LOWER(COALESCE(profiles.display_name, auth_users.email, auth_users.id::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_access_level(
  _target_user_id uuid,
  _access_level public.app_role
)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _target_is_super_admin boolean;
  _super_admin_count integer;
BEGIN
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Only super admins can manage users';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _target_user_id
      AND role IN (
        'province_admin'::public.app_role,
        'city_admin'::public.app_role,
        'lgu_staff'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION 'Use the LGU onboarding modules to manage scoped LGU access';
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

CREATE OR REPLACE FUNCTION public.issue_lgu_staff_invite(
  _email text,
  _full_name text DEFAULT NULL,
  _expires_in_days integer DEFAULT 7
)
RETURNS TABLE (
  invite_id uuid,
  invite_token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_scope public.user_scopes%ROWTYPE;
  _normalized_email text := lower(btrim(COALESCE(_email, '')));
  _normalized_full_name text := NULLIF(btrim(COALESCE(_full_name, '')), '');
  _raw_token text;
  _token_hash text;
  _invite_id uuid;
  _expires_at timestamptz;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _actor_id
      AND role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only province and city admins can invite LGU staff';
  END IF;

  IF _normalized_email = '' OR position('@' IN _normalized_email) = 0 THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;

  IF COALESCE(_expires_in_days, 0) < 1 OR _expires_in_days > 30 THEN
    RAISE EXCEPTION 'Invite expiry must be between 1 and 30 days';
  END IF;

  SELECT *
  INTO _actor_scope
  FROM public.user_scopes
  WHERE user_id = _actor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your LGU scope is not configured';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth.users AS auth_users
    JOIN public.user_roles AS user_roles
      ON user_roles.user_id = auth_users.id
    WHERE lower(auth_users.email::text) = _normalized_email
      AND user_roles.role IN (
        'admin'::public.app_role,
        'super_admin'::public.app_role,
        'province_admin'::public.app_role,
        'city_admin'::public.app_role,
        'lgu_staff'::public.app_role
      )
  ) THEN
    RAISE EXCEPTION 'This email already belongs to an account with elevated access';
  END IF;

  UPDATE public.admin_invites AS invites
  SET expires_at = now(),
      updated_at = now()
  WHERE invites.role = 'lgu_staff'::public.app_role
    AND lower(invites.email) = _normalized_email
    AND invites.province_code = _actor_scope.province_code
    AND COALESCE(invites.city_municipality_code, '') = COALESCE(_actor_scope.city_municipality_code, '')
    AND invites.used_at IS NULL
    AND invites.expires_at > now();

  _raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  _token_hash := encode(extensions.digest(_raw_token, 'sha256'), 'hex');
  _expires_at := now() + make_interval(days => _expires_in_days);

  INSERT INTO public.admin_invites (
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
    _token_hash,
    _normalized_email,
    _normalized_full_name,
    'lgu_staff'::public.app_role,
    _actor_scope.province_code,
    CASE
      WHEN _actor_scope.scope_type = 'city' THEN _actor_scope.city_municipality_code
      ELSE NULL
    END,
    _actor_id,
    _expires_at
  )
  RETURNING id INTO _invite_id;

  RETURN QUERY
  SELECT _invite_id, _raw_token, _expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_lgu_staff_invites()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS actor_roles
    WHERE actor_roles.user_id = auth.uid()
      AND actor_roles.role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only province and city admins can view LGU team invites';
  END IF;

  RETURN QUERY
  SELECT
    invites.id,
    invites.email,
    invites.full_name,
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
  WHERE invites.role = 'lgu_staff'::public.app_role
    AND public.can_manage_geo_scope(
      auth.uid(),
      invites.province_code,
      invites.city_municipality_code
    )
  ORDER BY invites.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_lgu_scope_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  username text,
  role public.app_role,
  scope_type text,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  invited_by uuid,
  invited_by_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_roles AS actor_roles
    WHERE actor_roles.user_id = auth.uid()
      AND actor_roles.role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only province and city admins can view LGU team members';
  END IF;

  RETURN QUERY
  SELECT
    auth_users.id,
    auth_users.email::text,
    profiles.display_name,
    profiles.username,
    'lgu_staff'::public.app_role,
    scopes.scope_type,
    scopes.province_code,
    provinces.name,
    scopes.city_municipality_code,
    cities.name,
    latest_invite.created_by,
    inviter_profiles.display_name,
    COALESCE(latest_invite.created_at, auth_users.created_at)
  FROM public.user_roles AS roles
  JOIN public.user_scopes AS scopes
    ON scopes.user_id = roles.user_id
  JOIN auth.users AS auth_users
    ON auth_users.id = roles.user_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = roles.user_id
  JOIN public.geo_provinces AS provinces
    ON provinces.code = scopes.province_code
  LEFT JOIN public.geo_cities_municipalities AS cities
    ON cities.code = scopes.city_municipality_code
  LEFT JOIN LATERAL (
    SELECT
      invites.created_by,
      invites.created_at
    FROM public.admin_invites AS invites
    WHERE invites.role = 'lgu_staff'::public.app_role
      AND invites.used_by = roles.user_id
    ORDER BY invites.created_at DESC
    LIMIT 1
  ) AS latest_invite
    ON true
  LEFT JOIN public.profiles AS inviter_profiles
    ON inviter_profiles.user_id = latest_invite.created_by
  WHERE roles.role = 'lgu_staff'::public.app_role
    AND public.can_manage_geo_scope(
      auth.uid(),
      scopes.province_code,
      scopes.city_municipality_code
    )
  ORDER BY LOWER(COALESCE(profiles.display_name, auth_users.email::text, auth_users.id::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_lgu_staff_access(_target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _target_scope public.user_scopes%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _actor_id
      AND role IN ('province_admin'::public.app_role, 'city_admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only province and city admins can revoke LGU staff access';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _target_user_id
      AND role = 'lgu_staff'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Target user is not an LGU staff member';
  END IF;

  SELECT *
  INTO _target_scope
  FROM public.user_scopes
  WHERE user_id = _target_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user scope was not found';
  END IF;

  IF NOT public.can_manage_geo_scope(
    _actor_id,
    _target_scope.province_code,
    _target_scope.city_municipality_code
  ) THEN
    RAISE EXCEPTION 'You are not allowed to revoke access for this LGU scope';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _target_user_id
    AND role = 'lgu_staff'::public.app_role;

  DELETE FROM public.user_scopes
  WHERE user_id = _target_user_id;

  RETURN _target_user_id;
END;
$$;

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
  _lgu_verified_role public.app_role := public.get_lgu_verifier_role(_admin_user_id);
  _is_lgu_verified boolean := _lgu_verified_role IS NOT NULL;
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
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code),
        is_lgu_verified = _is_lgu_verified,
        lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
        lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
        lgu_verified_role = _lgu_verified_role
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
        city_municipality_code = COALESCE(gas_stations.city_municipality_code, _report.city_municipality_code),
        is_lgu_verified = _is_lgu_verified,
        lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
        lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
        lgu_verified_role = _lgu_verified_role
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
      city_municipality_code,
      is_lgu_verified,
      lgu_verified_at,
      lgu_verified_by,
      lgu_verified_role
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
      _report.city_municipality_code,
      _is_lgu_verified,
      CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
      CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
      _lgu_verified_role
    )
    RETURNING * INTO _station;
  END IF;

  UPDATE public.fuel_reports
  SET review_status = 'approved',
      reviewed_at = now(),
      reviewed_by = _admin_user_id,
      applied_station_id = _station.id,
      province_code = COALESCE(province_code, _station.province_code),
      city_municipality_code = COALESCE(city_municipality_code, _station.city_municipality_code),
      is_lgu_verified = _is_lgu_verified,
      lgu_verified_at = CASE WHEN _is_lgu_verified THEN now() ELSE NULL END,
      lgu_verified_by = CASE WHEN _is_lgu_verified THEN _admin_user_id ELSE NULL END,
      lgu_verified_role = _lgu_verified_role
  WHERE id = _report.id;

  RETURN _station.id;
END;
$$;

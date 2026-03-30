CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

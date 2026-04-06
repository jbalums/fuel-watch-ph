CREATE FUNCTION public.list_admin_lgu_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  avatar_url text,
  username text,
  role public.app_role,
  scope_type text,
  province_code text,
  province_name text,
  city_municipality_code text,
  city_municipality_name text,
  invited_by uuid,
  invited_by_name text,
  created_at timestamptz,
  last_login_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can view LGU users';
  END IF;

  RETURN QUERY
  SELECT
    auth_users.id,
    auth_users.email::text,
    COALESCE(
      NULLIF(btrim(profiles.display_name), ''),
      NULLIF(btrim(auth_users.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(auth_users.raw_user_meta_data->>'name'), ''),
      auth_users.email::text
    ) AS display_name,
    COALESCE(
      NULLIF(btrim(profiles.avatar_url), ''),
      NULLIF(btrim(auth_users.raw_user_meta_data->>'avatar_url'), '')
    ) AS avatar_url,
    profiles.username,
    roles.role,
    scopes.scope_type,
    scopes.province_code,
    provinces.name,
    scopes.city_municipality_code,
    cities.name,
    latest_invite.created_by,
    COALESCE(
      NULLIF(btrim(inviter_profiles.display_name), ''),
      NULLIF(btrim(inviter_auth_users.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(inviter_auth_users.raw_user_meta_data->>'name'), ''),
      inviter_auth_users.email::text
    ) AS invited_by_name,
    COALESCE(latest_invite.created_at, auth_users.created_at),
    auth_users.last_sign_in_at
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
    WHERE invites.used_by = roles.user_id
      AND invites.role = roles.role
    ORDER BY invites.created_at DESC
    LIMIT 1
  ) AS latest_invite
    ON true
  LEFT JOIN public.profiles AS inviter_profiles
    ON inviter_profiles.user_id = latest_invite.created_by
  LEFT JOIN auth.users AS inviter_auth_users
    ON inviter_auth_users.id = latest_invite.created_by
  WHERE roles.role IN (
    'province_admin'::public.app_role,
    'city_admin'::public.app_role,
    'lgu_staff'::public.app_role
  )
  ORDER BY LOWER(
    COALESCE(
      NULLIF(btrim(profiles.display_name), ''),
      NULLIF(btrim(auth_users.raw_user_meta_data->>'display_name'), ''),
      NULLIF(btrim(auth_users.raw_user_meta_data->>'name'), ''),
      auth_users.email::text,
      auth_users.id::text
    )
  );
END;
$$;

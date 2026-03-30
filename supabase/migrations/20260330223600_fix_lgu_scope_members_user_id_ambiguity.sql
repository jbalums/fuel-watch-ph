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

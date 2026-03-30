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

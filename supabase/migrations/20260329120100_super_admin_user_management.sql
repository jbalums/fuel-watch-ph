CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _role = 'admin'::public.app_role THEN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin'::public.app_role, 'super_admin'::public.app_role)
    )
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
  END
$$;

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

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

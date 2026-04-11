CREATE TABLE IF NOT EXISTS public.system_feature_flags (
  feature_key text PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_feature_flags
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System feature flags are viewable by everyone" ON public.system_feature_flags;
CREATE POLICY "System feature flags are viewable by everyone"
ON public.system_feature_flags
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Super admins can insert system feature flags" ON public.system_feature_flags;
CREATE POLICY "Super admins can insert system feature flags"
ON public.system_feature_flags
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can update system feature flags" ON public.system_feature_flags;
CREATE POLICY "Super admins can update system feature flags"
ON public.system_feature_flags
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Super admins can delete system feature flags" ON public.system_feature_flags;
CREATE POLICY "Super admins can delete system feature flags"
ON public.system_feature_flags
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS update_system_feature_flags_updated_at
ON public.system_feature_flags;
CREATE TRIGGER update_system_feature_flags_updated_at
BEFORE UPDATE ON public.system_feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_feature_flags (
  feature_key,
  is_enabled,
  description
)
VALUES (
  'map_get_directions_enabled',
  true,
  'Controls the inline Get Directions route renderer on /map.'
)
ON CONFLICT (feature_key) DO UPDATE
SET
  is_enabled = EXCLUDED.is_enabled,
  description = EXCLUDED.description;

INSERT INTO public.system_feature_flags (
  feature_key,
  is_enabled,
  description
)
VALUES (
  'maintenance_mode_enabled',
  false,
  'Shows the maintenance page on public routes while keeping admin and auth routes accessible.'
)
ON CONFLICT (feature_key) DO UPDATE
SET
  description = EXCLUDED.description;

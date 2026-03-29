ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- One-time bootstrap example. Run this manually in the Supabase SQL editor
-- after deploying migrations, replacing the email with your own auth email.
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'super_admin'::public.app_role
-- FROM auth.users
-- WHERE email = 'you@example.com'
-- ON CONFLICT (user_id, role) DO NOTHING;

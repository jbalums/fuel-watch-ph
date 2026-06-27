CREATE TABLE public.presence_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  email text NOT NULL DEFAULT 'Anonymous',
  role text NOT NULL DEFAULT 'user',
  page text NOT NULL DEFAULT '/',
  host text NOT NULL DEFAULT '',
  user_agent text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, start_time)
);

ALTER TABLE public.presence_history ENABLE ROW LEVEL SECURITY;

-- Only super_admin can read history
CREATE POLICY "super_admin_select_presence_history"
  ON public.presence_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'super_admin'
    )
  );

-- Any authenticated user can insert (leave events fire on all clients)
-- Unique constraint on (user_id, start_time) prevents duplicate rows
CREATE POLICY "authenticated_insert_presence_history"
  ON public.presence_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

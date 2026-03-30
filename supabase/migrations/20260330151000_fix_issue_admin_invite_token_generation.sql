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

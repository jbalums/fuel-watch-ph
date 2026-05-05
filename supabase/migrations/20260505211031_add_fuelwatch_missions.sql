CREATE TABLE IF NOT EXISTS public.mission_point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  reason text NOT NULL,
  points integer NOT NULL CHECK (points > 0),
  week_start date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);

CREATE INDEX IF NOT EXISTS mission_point_events_source_idx
ON public.mission_point_events (source_type, source_id);

CREATE INDEX IF NOT EXISTS mission_point_events_week_idx
ON public.mission_point_events (week_start, points DESC);

CREATE TABLE IF NOT EXISTS public.user_mission_stats (
  user_id uuid PRIMARY KEY,
  total_points integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  approved_report_count integer NOT NULL DEFAULT 0 CHECK (approved_report_count >= 0),
  current_streak_days integer NOT NULL DEFAULT 0 CHECK (current_streak_days >= 0),
  longest_streak_days integer NOT NULL DEFAULT 0 CHECK (longest_streak_days >= 0),
  last_rewarded_date date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_mission_badges (
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_key)
);

CREATE TABLE IF NOT EXISTS public.user_weekly_mission_progress (
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  approved_report_count integer NOT NULL DEFAULT 0 CHECK (approved_report_count >= 0),
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);

ALTER TABLE public.mission_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mission_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mission_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weekly_mission_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mission point events"
ON public.mission_point_events
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view mission point events"
ON public.mission_point_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own mission stats"
ON public.user_mission_stats
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view mission stats"
ON public.user_mission_stats
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own mission badges"
ON public.user_mission_badges
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view mission badges"
ON public.user_mission_badges
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view own weekly mission progress"
ON public.user_weekly_mission_progress
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view weekly mission progress"
ON public.user_weekly_mission_progress
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.get_mission_week_start(_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc('week', _at AT TIME ZONE 'Asia/Manila')::date
$$;

CREATE OR REPLACE FUNCTION public.get_mission_level(_points integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(1, FLOOR(GREATEST(COALESCE(_points, 0), 0) / 100.0)::integer + 1)
$$;

CREATE OR REPLACE FUNCTION public.award_mission_badge(
  _user_id uuid,
  _badge_key text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.user_mission_badges (user_id, badge_key)
  VALUES (_user_id, _badge_key)
  ON CONFLICT (user_id, badge_key) DO NOTHING
$$;

CREATE OR REPLACE FUNCTION public.award_mission_points_for_report(_report_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report public.fuel_reports%ROWTYPE;
  _week_start date;
  _reward_date date;
  _points_awarded integer := 0;
  _inserted_points integer := 0;
  _approved_count integer := 0;
  _weekly_count integer := 0;
  _weekly_completed boolean := false;
BEGIN
  SELECT *
  INTO _report
  FROM public.fuel_reports
  WHERE id = _report_id
    AND review_status = 'approved';

  IF NOT FOUND OR _report.user_id IS NULL THEN
    RETURN 0;
  END IF;

  _week_start := public.get_mission_week_start(COALESCE(_report.reviewed_at, _report.created_at, now()));
  _reward_date := (COALESCE(_report.reviewed_at, _report.created_at, now()) AT TIME ZONE 'Asia/Manila')::date;

  WITH inserted AS (
    INSERT INTO public.mission_point_events (
      user_id,
      event_key,
      source_type,
      source_id,
      reason,
      points,
      week_start,
      metadata
    )
    VALUES (
      _report.user_id,
      'report:' || _report.id::text || ':approved',
      'fuel_report',
      _report.id,
      'approved_report',
      25,
      _week_start,
      jsonb_build_object('submissionMode', _report.submission_mode)
    )
    ON CONFLICT (user_id, event_key) DO NOTHING
    RETURNING points
  )
  SELECT COALESCE(SUM(points), 0)
  INTO _inserted_points
  FROM inserted;

  _points_awarded := _points_awarded + _inserted_points;

  IF _inserted_points > 0 THEN
    INSERT INTO public.user_mission_stats (
      user_id,
      total_points,
      level,
      approved_report_count,
      current_streak_days,
      longest_streak_days,
      last_rewarded_date,
      updated_at
    )
    VALUES (
      _report.user_id,
      _inserted_points,
      public.get_mission_level(_inserted_points),
      1,
      1,
      1,
      _reward_date,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET total_points = public.user_mission_stats.total_points + EXCLUDED.total_points,
        level = public.get_mission_level(public.user_mission_stats.total_points + EXCLUDED.total_points),
        approved_report_count = public.user_mission_stats.approved_report_count + 1,
        current_streak_days = CASE
          WHEN public.user_mission_stats.last_rewarded_date IS NULL THEN 1
          WHEN public.user_mission_stats.last_rewarded_date = _reward_date THEN public.user_mission_stats.current_streak_days
          WHEN public.user_mission_stats.last_rewarded_date = _reward_date - 1 THEN public.user_mission_stats.current_streak_days + 1
          ELSE 1
        END,
        longest_streak_days = GREATEST(
          public.user_mission_stats.longest_streak_days,
          CASE
            WHEN public.user_mission_stats.last_rewarded_date IS NULL THEN 1
            WHEN public.user_mission_stats.last_rewarded_date = _reward_date THEN public.user_mission_stats.current_streak_days
            WHEN public.user_mission_stats.last_rewarded_date = _reward_date - 1 THEN public.user_mission_stats.current_streak_days + 1
            ELSE 1
          END
        ),
        last_rewarded_date = CASE
          WHEN public.user_mission_stats.last_rewarded_date IS NULL THEN EXCLUDED.last_rewarded_date
          ELSE GREATEST(public.user_mission_stats.last_rewarded_date, EXCLUDED.last_rewarded_date)
        END,
        updated_at = now();

    INSERT INTO public.user_weekly_mission_progress (
      user_id,
      week_start,
      approved_report_count,
      points,
      updated_at
    )
    VALUES (
      _report.user_id,
      _week_start,
      1,
      _inserted_points,
      now()
    )
    ON CONFLICT (user_id, week_start) DO UPDATE
    SET approved_report_count = public.user_weekly_mission_progress.approved_report_count + 1,
        points = public.user_weekly_mission_progress.points + EXCLUDED.points,
        updated_at = now();
  END IF;

  IF _report.photo_path IS NOT NULL THEN
    WITH inserted AS (
      INSERT INTO public.mission_point_events (
        user_id,
        event_key,
        source_type,
        source_id,
        reason,
        points,
        week_start,
        metadata
      )
      VALUES (
        _report.user_id,
        'report:' || _report.id::text || ':photo-proof',
        'fuel_report',
        _report.id,
        'photo_proof',
        10,
        _week_start,
        '{}'::jsonb
      )
      ON CONFLICT (user_id, event_key) DO NOTHING
      RETURNING points
    )
    SELECT COALESCE(SUM(points), 0)
    INTO _inserted_points
    FROM inserted;

    IF _inserted_points > 0 THEN
      _points_awarded := _points_awarded + _inserted_points;

      UPDATE public.user_mission_stats
      SET total_points = total_points + _inserted_points,
          level = public.get_mission_level(total_points + _inserted_points),
          updated_at = now()
      WHERE user_id = _report.user_id;

      UPDATE public.user_weekly_mission_progress
      SET points = points + _inserted_points,
          updated_at = now()
      WHERE user_id = _report.user_id
        AND week_start = _week_start;

      PERFORM public.award_mission_badge(_report.user_id, 'photo_proof_helper');
    END IF;
  END IF;

  SELECT approved_report_count, completed
  INTO _weekly_count, _weekly_completed
  FROM public.user_weekly_mission_progress
  WHERE user_id = _report.user_id
    AND week_start = _week_start;

  IF COALESCE(_weekly_count, 0) >= 3 AND NOT COALESCE(_weekly_completed, false) THEN
    WITH inserted AS (
      INSERT INTO public.mission_point_events (
        user_id,
        event_key,
        source_type,
        source_id,
        reason,
        points,
        week_start,
        metadata
      )
      VALUES (
        _report.user_id,
        'weekly:' || _week_start::text || ':three-approved-reports',
        'weekly_mission',
        _report.id,
        'weekly_three_reports',
        50,
        _week_start,
        jsonb_build_object('goal', 3)
      )
      ON CONFLICT (user_id, event_key) DO NOTHING
      RETURNING points
    )
    SELECT COALESCE(SUM(points), 0)
    INTO _inserted_points
    FROM inserted;

    IF _inserted_points > 0 THEN
      _points_awarded := _points_awarded + _inserted_points;

      UPDATE public.user_mission_stats
      SET total_points = total_points + _inserted_points,
          level = public.get_mission_level(total_points + _inserted_points),
          updated_at = now()
      WHERE user_id = _report.user_id;

      UPDATE public.user_weekly_mission_progress
      SET points = points + _inserted_points,
          completed = true,
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE user_id = _report.user_id
        AND week_start = _week_start;

      PERFORM public.award_mission_badge(_report.user_id, 'weekly_scout');
    END IF;
  END IF;

  SELECT approved_report_count
  INTO _approved_count
  FROM public.user_mission_stats
  WHERE user_id = _report.user_id;

  IF COALESCE(_approved_count, 0) >= 1 THEN
    PERFORM public.award_mission_badge(_report.user_id, 'first_approved_report');
  END IF;

  IF COALESCE(_approved_count, 0) >= 10 THEN
    PERFORM public.award_mission_badge(_report.user_id, 'fuelwatch_hero');
  END IF;

  RETURN _points_awarded;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_mission_summary()
RETURNS TABLE (
  total_points integer,
  level integer,
  approved_report_count integer,
  current_streak_days integer,
  longest_streak_days integer,
  weekly_points integer,
  weekly_approved_report_count integer,
  weekly_goal integer,
  weekly_completed boolean,
  badges text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_user_row AS (
    SELECT auth.uid() AS user_id
  ),
  current_week AS (
    SELECT public.get_mission_week_start(now()) AS week_start
  )
  SELECT
    COALESCE(stats.total_points, 0) AS total_points,
    COALESCE(stats.level, 1) AS level,
    COALESCE(stats.approved_report_count, 0) AS approved_report_count,
    COALESCE(stats.current_streak_days, 0) AS current_streak_days,
    COALESCE(stats.longest_streak_days, 0) AS longest_streak_days,
    COALESCE(weekly.points, 0) AS weekly_points,
    COALESCE(weekly.approved_report_count, 0) AS weekly_approved_report_count,
    3 AS weekly_goal,
    COALESCE(weekly.completed, false) AS weekly_completed,
    COALESCE(
      ARRAY_AGG(badges.badge_key ORDER BY badges.awarded_at ASC)
        FILTER (WHERE badges.badge_key IS NOT NULL),
      ARRAY[]::text[]
    ) AS badges
  FROM current_user_row
  CROSS JOIN current_week
  LEFT JOIN public.user_mission_stats AS stats
    ON stats.user_id = current_user_row.user_id
  LEFT JOIN public.user_weekly_mission_progress AS weekly
    ON weekly.user_id = current_user_row.user_id
   AND weekly.week_start = current_week.week_start
  LEFT JOIN public.user_mission_badges AS badges
    ON badges.user_id = current_user_row.user_id
  WHERE current_user_row.user_id IS NOT NULL
  GROUP BY
    stats.total_points,
    stats.level,
    stats.approved_report_count,
    stats.current_streak_days,
    stats.longest_streak_days,
    weekly.points,
    weekly.approved_report_count,
    weekly.completed;
$$;

CREATE OR REPLACE FUNCTION public.get_public_weekly_mission_leaderboard(_limit integer DEFAULT 10)
RETURNS TABLE (
  display_name text,
  level integer,
  weekly_points integer,
  weekly_approved_report_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(btrim(profiles.display_name), ''), 'Community Scout') AS display_name,
    COALESCE(stats.level, 1) AS level,
    weekly.points AS weekly_points,
    weekly.approved_report_count AS weekly_approved_report_count
  FROM public.user_weekly_mission_progress AS weekly
  LEFT JOIN public.user_mission_stats AS stats
    ON stats.user_id = weekly.user_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = weekly.user_id
  WHERE weekly.week_start = public.get_mission_week_start(now())
    AND weekly.points > 0
  ORDER BY weekly.points DESC, weekly.approved_report_count DESC, display_name ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 10), 1), 25);
$$;

CREATE OR REPLACE FUNCTION public.get_report_mission_reward_summary(_report_id uuid)
RETURNS TABLE (
  total_points integer,
  rewarded_user_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH report_scope AS (
    SELECT *
    FROM public.fuel_reports
    WHERE id = _report_id
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.can_manage_geo_scope(auth.uid(), province_code, city_municipality_code)
      )
  )
  SELECT
    COALESCE(SUM(events.points), 0)::integer AS total_points,
    COALESCE(NULLIF(btrim(profiles.display_name), ''), 'Community Scout') AS rewarded_user_label
  FROM report_scope
  LEFT JOIN public.mission_point_events AS events
    ON events.source_id = report_scope.id
   AND events.user_id = report_scope.user_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = report_scope.user_id
  GROUP BY profiles.display_name;
$$;

ALTER FUNCTION public.approve_fuel_report(uuid)
  RENAME TO approve_fuel_report_apply_mission_rewards_v20260505;

REVOKE EXECUTE ON FUNCTION public.approve_fuel_report_apply_mission_rewards_v20260505(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.approve_fuel_report(_report_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approved_station_id uuid;
BEGIN
  _approved_station_id := public.approve_fuel_report_apply_mission_rewards_v20260505(_report_id);
  PERFORM public.award_mission_points_for_report(_report_id);
  RETURN _approved_station_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_mission_badge(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_mission_points_for_report(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_fuel_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_mission_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_weekly_mission_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_report_mission_reward_summary(uuid) TO authenticated;

-- ============================================================
-- 028_admin_report.sql
-- Admin-only on-demand report snapshot + granular (per-item) reset.
--
--   * get_admin_report()         — one structured JSONB snapshot of every
--                                  store, for the in-app report view + CSV export.
--   * admin_delete_session(uuid) — delete a single session (+ its events).
--                                  This is the "individual reset" — never a bulk wipe.
--
-- Both are SECURITY DEFINER and manually gated on admin_users (same pattern
-- as 024_admin_analytics_rpc.sql), because SECURITY DEFINER bypasses RLS.
-- ============================================================

-- ── On-demand report snapshot ──
create or replace function public.get_admin_report(
  live_window_seconds int default 90,
  row_limit int default 1000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Admin gate (SECURITY DEFINER bypasses RLS, so check manually)
  if not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'generated_at', now(),

    -- Headline summary (mirrors get_admin_analytics)
    'summary', jsonb_build_object(
      'online_now', (
        select count(*) from public.app_sessions
        where session_end is null
          and last_seen_at > now() - (live_window_seconds || ' seconds')::interval
      ),
      'entries_today', (
        select count(*) from public.app_sessions
        where session_start > date_trunc('day', now())
      ),
      'entries_7d', (
        select count(*) from public.app_sessions
        where session_start > now() - interval '7 days'
      ),
      'entries_30d', (
        select count(*) from public.app_sessions
        where session_start > now() - interval '30 days'
      ),
      'total_sessions', (select count(*) from public.app_sessions),
      'anonymous', (select count(*) from public.app_sessions where is_anonymous = true),
      'registered', (select count(*) from public.app_sessions where is_anonymous = false),
      'avg_duration_seconds', (
        select avg(extract(epoch from (session_end - session_start)))
        from public.app_sessions where session_end is not null
      ),
      'total_players', (select count(*) from public.profiles),
      'total_feedback', (select count(*) from public.feedback_submissions),
      'by_platform', coalesce((
        select jsonb_object_agg(platform, cnt) from (
          select platform, count(*) as cnt from public.app_sessions group by platform
        ) t
      ), '{}'::jsonb),
      'by_activity', coalesce((
        select jsonb_object_agg(event_type, cnt) from (
          select event_type, count(*) as cnt from public.app_events group by event_type
        ) t
      ), '{}'::jsonb)
    ),

    -- Players (profiles)
    'players', coalesce((
      select jsonb_agg(p) from (
        select id, username, rating, wins, losses, abandons, total_coins, created_at
        from public.profiles
        order by rating desc
        limit row_limit
      ) p
    ), '[]'::jsonb),

    -- Recent sessions
    'sessions', coalesce((
      select jsonb_agg(s) from (
        select id, user_id, is_anonymous, platform, locale, app_version,
               session_start, session_end, last_seen_at, event_count
        from public.app_sessions
        order by session_start desc
        limit row_limit
      ) s
    ), '[]'::jsonb),

    -- Feedback submissions
    'feedback', coalesce((
      select jsonb_agg(f) from (
        select id, username_snapshot, email_snapshot, is_anonymous, locale,
               experience_kind, rating, comment, platform, app_version, status, created_at
        from public.feedback_submissions
        order by created_at desc
        limit row_limit
      ) f
    ), '[]'::jsonb),

    -- Invited-users gate
    'invites', coalesce((
      select jsonb_agg(i) from (
        select email, status, invited_by, invited_at, first_login_at, last_seen_at
        from public.invited_users
        order by invited_at desc nulls last
        limit row_limit
      ) i
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_report(int, int) to authenticated;

-- ── Individual reset: delete a single session + its events ──
create or replace function public.admin_delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  delete from public.app_events where session_id = p_session_id;
  delete from public.app_sessions where id = p_session_id;
end;
$$;

grant execute on function public.admin_delete_session(uuid) to authenticated;

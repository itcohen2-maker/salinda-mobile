-- 024_admin_analytics_rpc.sql
-- Admin-only RPC returning all analytics aggregates in a single round-trip.

create or replace function public.get_admin_analytics(
  live_window_seconds int default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Admin gate: security definer bypasses RLS so we must check manually
  if not exists (
    select 1 from public.admin_users where user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    -- Live users: sessions with no end and last_seen within window
    'online_now', (
      select count(*)
      from public.app_sessions
      where session_end is null
        and last_seen_at > now() - (live_window_seconds || ' seconds')::interval
    ),

    -- Live breakdown by platform
    'online_by_platform', coalesce((
      select jsonb_object_agg(platform, cnt)
      from (
        select platform, count(*) as cnt
        from public.app_sessions
        where session_end is null
          and last_seen_at > now() - (live_window_seconds || ' seconds')::interval
        group by platform
      ) t
    ), '{}'::jsonb),

    -- Entry counts by time window
    'entries_last_hour', (
      select count(*) from public.app_sessions
      where session_start > now() - interval '1 hour'
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

    -- Full-table totals (uncapped)
    'total', (select count(*) from public.app_sessions),
    'anonymous', (select count(*) from public.app_sessions where is_anonymous = true),
    'registered', (select count(*) from public.app_sessions where is_anonymous = false),

    -- Average session duration (completed sessions only)
    'avg_duration_seconds', (
      select avg(extract(epoch from (session_end - session_start)))
      from public.app_sessions
      where session_end is not null
    ),

    -- Breakdown by platform (all sessions)
    'by_platform', coalesce((
      select jsonb_object_agg(platform, cnt)
      from (
        select platform, count(*) as cnt
        from public.app_sessions
        group by platform
      ) t
    ), '{}'::jsonb),

    -- Breakdown by activity (event_type from app_events)
    'by_activity', coalesce((
      select jsonb_object_agg(event_type, cnt)
      from (
        select event_type, count(*) as cnt
        from public.app_events
        group by event_type
      ) t
    ), '{}'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_analytics(int) to authenticated;

-- Partial index to speed up the live-session query
create index if not exists idx_app_sessions_live
  on public.app_sessions (last_seen_at)
  where session_end is null;

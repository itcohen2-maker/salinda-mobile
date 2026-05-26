-- ============================================================
-- 023_app_events.sql
-- One row per tracked user action within a session.
-- ============================================================

create table if not exists public.app_events (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.app_sessions(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  event_type   text not null,
  event_data   jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

alter table public.app_events enable row level security;

create policy "Users insert own events"
  on public.app_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Admins read all events"
  on public.app_events
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select, insert on public.app_events to authenticated;

create index if not exists idx_app_events_session_id
  on public.app_events (session_id);
create index if not exists idx_app_events_user_id
  on public.app_events (user_id);
create index if not exists idx_app_events_created_at
  on public.app_events (created_at desc);
create index if not exists idx_app_events_type
  on public.app_events (event_type);

-- ============================================================
-- 022_app_sessions.sql
-- One row per app session (open → background/close).
-- ============================================================

create table if not exists public.app_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  is_anonymous  boolean not null,
  platform      text not null,
  locale        text not null,
  app_version   text,
  session_start timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  session_end   timestamptz,
  event_count   int not null default 0
);

alter table public.app_sessions enable row level security;

create policy "Users insert own sessions"
  on public.app_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on public.app_sessions
  for update
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read all sessions"
  on public.app_sessions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select, insert, update on public.app_sessions to authenticated;

create index if not exists idx_app_sessions_user_id
  on public.app_sessions (user_id);
create index if not exists idx_app_sessions_session_start
  on public.app_sessions (session_start desc);

-- ============================================================
-- 016_feedback_admin_access.sql
-- Shared admin allowlist + feedback inbox read access.
-- ============================================================

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create policy "Users read own admin row"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.admin_users to service_role;

create policy "Admins read feedback submissions"
  on public.feedback_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users admins
      where admins.user_id = auth.uid()
    )
  );

grant select on public.feedback_submissions to authenticated;

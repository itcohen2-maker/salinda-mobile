-- ============================================================
-- 015_feedback_submissions.sql
-- In-app feedback submissions stored directly in Supabase.
-- ============================================================

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username_snapshot text,
  email_snapshot text,
  is_anonymous boolean not null default false,
  locale text not null,
  experience_kind text not null check (experience_kind in ('game', 'tutorial', 'general')),
  rating int not null check (rating between 1 and 5),
  comment text not null default '',
  platform text not null,
  app_version text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions enable row level security;

create policy "Users insert own feedback submissions"
  on public.feedback_submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant insert on public.feedback_submissions to authenticated;
grant select, insert, update, delete on public.feedback_submissions to service_role;

create index if not exists idx_feedback_submissions_created_at
  on public.feedback_submissions (created_at desc);

create index if not exists idx_feedback_submissions_status_created_at
  on public.feedback_submissions (status, created_at desc);

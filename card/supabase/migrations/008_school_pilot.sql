-- ============================================================
-- 008_school_pilot.sql
-- Classroom pilot entities for the Salinda school product.
-- ============================================================

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  teacher_id uuid references public.teachers(id) on delete set null,
  name text not null,
  grade_band text not null check (grade_band in ('g3', 'g4', 'g5', 'g6')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  display_name text not null,
  external_student_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  code text not null,
  display_name text not null,
  default_difficulty_band text not null check (default_difficulty_band in ('support', 'core', 'bridge', 'challenge')),
  concept_focus text not null check (concept_focus in ('add_sub', 'mul_div', 'fractions', 'mixed')),
  allow_fractions boolean not null default false,
  created_at timestamptz not null default now(),
  unique (class_id, code)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  title text not null,
  session_mode text not null check (session_mode in ('class_live', 'practice_assignment')),
  task_template text not null check (task_template in ('warmup', 'remedial', 'fluency_race', 'mixed_review')),
  difficulty_band text not null check (difficulty_band in ('support', 'core', 'bridge', 'challenge')),
  concept_focus text not null check (concept_focus in ('add_sub', 'mul_div', 'fractions', 'mixed')),
  duration_minutes int not null check (duration_minutes between 10 and 20),
  allow_fractions boolean not null default false,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.session_runs (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  session_code text not null unique,
  title text not null,
  grade_band text not null check (grade_band in ('g3', 'g4', 'g5', 'g6')),
  difficulty_band text not null check (difficulty_band in ('support', 'core', 'bridge', 'challenge')),
  concept_focus text not null check (concept_focus in ('add_sub', 'mul_div', 'fractions', 'mixed')),
  task_template text not null check (task_template in ('warmup', 'remedial', 'fluency_race', 'mixed_review')),
  duration_minutes int not null check (duration_minutes between 10 and 20),
  group_size int not null check (group_size between 3 and 5),
  group_count int not null check (group_count between 1 and 8),
  allow_fractions boolean not null default false,
  status text not null check (status in ('lobby', 'live', 'completed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.session_group_results (
  id uuid primary key default gen_random_uuid(),
  session_run_id uuid not null references public.session_runs(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  group_code text not null,
  difficulty_band text not null check (difficulty_band in ('support', 'core', 'bridge', 'challenge')),
  concept_focus text not null check (concept_focus in ('add_sub', 'mul_div', 'fractions', 'mixed')),
  status text not null check (status in ('active', 'stuck', 'finished', 'inactive')),
  attempts int not null default 0,
  equation_successes int not null default 0,
  accuracy_percent numeric(5,2) not null default 0,
  completion_percent numeric(5,2) not null default 0,
  rounds_completed int not null default 0,
  time_on_task_seconds int not null default 0,
  hints_used int not null default 0,
  interventions_received int not null default 0,
  stuck_moments int not null default 0,
  recommendation text,
  created_at timestamptz not null default now()
);

create table if not exists public.student_skill_snapshots (
  id uuid primary key default gen_random_uuid(),
  class_student_id uuid not null references public.class_students(id) on delete cascade,
  session_run_id uuid references public.session_runs(id) on delete set null,
  concept_focus text not null check (concept_focus in ('add_sub', 'mul_div', 'fractions', 'mixed')),
  difficulty_band text not null check (difficulty_band in ('support', 'core', 'bridge', 'challenge')),
  attempts int not null default 0,
  equation_successes int not null default 0,
  accuracy_percent numeric(5,2) not null default 0,
  completion_percent numeric(5,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.intervention_events (
  id uuid primary key default gen_random_uuid(),
  session_run_id uuid not null references public.session_runs(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  group_code text not null,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  intervention_kind text not null check (intervention_kind in (
    'lower_difficulty',
    'raise_difficulty',
    'send_hint',
    'open_remedial_round',
    'open_challenge_round',
    'freeze_round',
    'regroup_next_session'
  )),
  note text,
  apply_on_next_round boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_classes_teacher on public.classes(teacher_id);
create index if not exists idx_assignments_class on public.assignments(class_id);
create index if not exists idx_session_runs_class on public.session_runs(class_id, started_at desc);
create index if not exists idx_group_results_session on public.session_group_results(session_run_id);
create index if not exists idx_skill_snapshots_student on public.student_skill_snapshots(class_student_id, updated_at desc);
create index if not exists idx_interventions_session on public.intervention_events(session_run_id, created_at desc);

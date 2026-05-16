-- ============================================================
-- 010_add_table_grants.sql
-- Explicit table-level GRANTs required from May 30 2026:
-- new Supabase projects no longer auto-expose public schema tables.
-- Existing projects are affected from October 30 2026.
-- ============================================================

-- ── profiles ──
-- Policies: anyone reads, authenticated updates own row
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- ── matches ──
-- Policies: anyone reads, server inserts via service-role
grant select on public.matches to anon, authenticated;
grant select, insert, update, delete on public.matches to service_role;

-- ── match_participants ──
-- Policies: anyone reads, server inserts via service-role
grant select on public.match_participants to anon, authenticated;
grant select, insert, update, delete on public.match_participants to service_role;

-- ── coin_events ──
-- Policies: authenticated reads own rows, inserts via award_coins function
grant select on public.coin_events to authenticated;
grant select, insert, update, delete on public.coin_events to service_role;

-- ── school pilot tables ──
-- NOTE: these tables have no RLS policies yet — add policies before going to production.
-- For now granting to authenticated (teacher dashboard) and service_role only.
-- anon gets no access intentionally.

grant select, insert, update, delete on public.schools to authenticated;
grant select, insert, update, delete on public.schools to service_role;

grant select, insert, update, delete on public.teachers to authenticated;
grant select, insert, update, delete on public.teachers to service_role;

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.classes to service_role;

grant select, insert, update, delete on public.class_students to authenticated;
grant select, insert, update, delete on public.class_students to service_role;

grant select, insert, update, delete on public.class_groups to authenticated;
grant select, insert, update, delete on public.class_groups to service_role;

grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.assignments to service_role;

grant select, insert, update, delete on public.session_runs to authenticated;
grant select, insert, update, delete on public.session_runs to service_role;

grant select, insert, update, delete on public.session_group_results to authenticated;
grant select, insert, update, delete on public.session_group_results to service_role;

grant select, insert, update, delete on public.student_skill_snapshots to authenticated;
grant select, insert, update, delete on public.student_skill_snapshots to service_role;

grant select, insert, update, delete on public.intervention_events to authenticated;
grant select, insert, update, delete on public.intervention_events to service_role;

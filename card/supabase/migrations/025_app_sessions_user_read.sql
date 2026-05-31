-- ============================================================
-- 025_app_sessions_user_read.sql
-- Allow authenticated users to read their OWN session rows.
--
-- Why: useSessionTracking creates a session with
--   .insert({...}).select('id').single()
-- which must read the inserted row back to obtain its id. Until now
-- app_sessions had only an admins-only SELECT policy (022), so for every
-- non-admin user the returning select was blocked by RLS -> data.id was
-- null -> the tracker bailed early and NEVER wrote any app_events
-- (app_open and all downstream events). Result: app_sessions filled up
-- (insert worked) but app_events stayed empty -> analytics "by_activity"
-- was all zeros.
--
-- This adds a self-read policy (RLS policies are OR'd, so the existing
-- admin-read policy still applies). No app code change or rebuild needed.
-- ============================================================

create policy "Users read own sessions"
  on public.app_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

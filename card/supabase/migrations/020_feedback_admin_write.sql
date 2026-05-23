-- ============================================================
-- 020_feedback_admin_write.sql
-- Allows admin users to update the status of any feedback
-- submission (soft-archive workflow — no physical deletes).
-- ============================================================

create policy "Admins update feedback submissions"
  on public.feedback_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant update (status) on public.feedback_submissions to authenticated;

-- ============================================================
-- 021_feedback_admin_delete.sql
-- Allows feedback admins to physically delete reviewed/archived
-- feedback submissions from the archive workflow.
-- ============================================================

create policy "Admins delete archived feedback submissions"
  on public.feedback_submissions
  for delete
  to authenticated
  using (
    status in ('reviewed', 'archived')
    and exists (
      select 1 from public.admin_users
      where user_id = auth.uid()
    )
  );

grant delete on public.feedback_submissions to authenticated;

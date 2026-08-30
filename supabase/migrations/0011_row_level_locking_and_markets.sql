-- Submitting a day used to freeze the whole day, so remembering something
-- afterwards meant it could never be logged. A day lock now protects the rows
-- that were submitted, not the day itself: new rows can be added to a day that
-- has already been submitted, and submitting that day again picks them up.
--
-- What still holds: a submitted row cannot be edited or deleted, and a
-- submitted week is closed entirely.
--
-- Also corrects Amana Foods, which Prism only recorded under "Non-UAE" and so
-- had been left visible to every market rather than guessed at.

update ts_clients set markets = '{UAE}', updated_at = now() where client_code = 'CLI-001';

-- The guard is the row's own status, not its day.
drop policy if exists ts_entries_insert on ts_entries;
create policy ts_entries_insert on ts_entries
  for insert to authenticated
  with check (
    employee_id = ts_current_employee_id()
    and status = 'draft'
    and exists (
      select 1 from ts_weekly_submissions s
      where s.id = submission_id
        and s.employee_id = ts_current_employee_id()
        and s.status = 'draft'
    )
  );

drop policy if exists ts_entries_update on ts_entries;
create policy ts_entries_update on ts_entries
  for update to authenticated
  using (employee_id = ts_current_employee_id() and status = 'draft')
  with check (employee_id = ts_current_employee_id() and status = 'draft');

drop policy if exists ts_entries_delete on ts_entries;
create policy ts_entries_delete on ts_entries
  for delete to authenticated
  using (employee_id = ts_current_employee_id() and status = 'draft');

-- ts_save_draft and ts_submit_day were reapplied with the same change: every
-- day-lock condition became a row-status condition. See the applied migration
-- 'allow_adding_to_submitted_days' for their full bodies.

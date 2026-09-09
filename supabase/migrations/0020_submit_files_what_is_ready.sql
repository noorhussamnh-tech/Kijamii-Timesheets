-- 0020: submitting stops being all-or-nothing, and stops being two buttons.
--
-- One unfinished row anywhere in the week refused the whole week, including
-- the rows that were complete and had been sitting there for days. The person
-- who had logged four days correctly was told to fix a fifth before any of it
-- counted -- a strange thing for a system to insist on when its purpose is to
-- collect what people did.
--
-- Submit now files every row that is ready and leaves the rest exactly where
-- they were: still drafts, still editable, still on the timesheet. It reports
-- how many it left and which days they are on. Pressing it again after
-- finishing them files those too.
--
-- ts_submit_day is left in place but is no longer called by anything. The
-- choice between "this day" and "this week" was one people had no reason to
-- care about, and picking the wrong one was punished.

-- One definition of "this row is finished", so the submit and the checks that
-- report on it cannot drift into disagreeing about which rows are ready.
create or replace function public.ts_entry_ready(e ts_entries)
returns boolean
language sql
immutable
as $$
  select e.hours is not null
     and (e.client_id is not null
          or nullif(btrim(coalesce(e.client_other, '')), '') is not null)
     and nullif(btrim(coalesce(e.project_type, '')), '') is not null
     and e.work_type is not null;
$$;

-- The empty row people leave at the bottom of a day. Not unfinished work, and
-- reporting it as such would be counting furniture.
create or replace function public.ts_entry_blank(e ts_entries)
returns boolean
language sql
immutable
as $$
  select e.client_id is null
     and nullif(btrim(coalesce(e.client_other, '')), '') is null
     and nullif(btrim(coalesce(e.project_type, '')), '') is null
     and nullif(btrim(coalesce(e.project_note, '')), '') is null
     and e.hours is null;
$$;

create or replace function public.ts_submit_week(p_week_start date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  emp       ts_employees;
  sub       ts_weekly_submissions;
  t_total   numeric := 0;
  t_bill    numeric := 0;
  n_filed   integer := 0;
  n_held    integer := 0;
  held_days jsonb;
  resent    boolean;
begin
  select * into emp from ts_employees
   where auth_user_id = auth.uid() and active and onboarded_at is not null;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  select * into sub from ts_weekly_submissions
   where employee_id = emp.id and week_start = p_week_start
   for update;
  if not found then raise exception 'no_draft' using errcode = '02000'; end if;

  resent := sub.status <> 'draft';

  select count(*) filter (where ts_entry_ready(e)),
         count(*) filter (where not ts_entry_ready(e) and not ts_entry_blank(e))
    into n_filed, n_held
    from ts_entries e
   where e.submission_id = sub.id and e.status = 'draft';

  select coalesce(jsonb_agg(distinct e.work_date order by e.work_date), '[]'::jsonb)
    into held_days
    from ts_entries e
   where e.submission_id = sub.id and e.status = 'draft'
     and not ts_entry_ready(e) and not ts_entry_blank(e);

  -- Nothing new to file and nothing waiting: say so rather than pretending
  -- something happened.
  if n_filed = 0 and n_held = 0 and resent then
    return jsonb_build_object(
      'ok', true, 'alreadySubmitted', true, 'filed', 0, 'held', 0, 'heldDays', '[]'::jsonb,
      'submissionId', sub.id, 'submittedAt', sub.submitted_at,
      'totalHours', sub.total_hours, 'billableHours', sub.billable_hours,
      'nonBillableHours', sub.non_billable_hours, 'missingHours', sub.missing_hours);
  end if;

  update ts_entries e
     set status = 'submitted',
         submitted_at = coalesce(e.submitted_at, now()),
         updated_at = now()
   where e.submission_id = sub.id and e.status = 'draft' and ts_entry_ready(e);

  -- A day is closed off only once nothing on it is still a draft. Locking a
  -- day that is still holding an unfinished row would badge it as done.
  insert into ts_day_locks (submission_id, work_date)
  select sub.id, d.work_date
    from (select distinct work_date from ts_entries where submission_id = sub.id) d
   where not exists (
     select 1 from ts_entries x
      where x.submission_id = sub.id and x.work_date = d.work_date and x.status = 'draft')
  on conflict (submission_id, work_date) do update set submitted_at = now();

  select coalesce(sum(hours), 0),
         coalesce(sum(hours) filter (where billable), 0)
    into t_total, t_bill
    from ts_entries where submission_id = sub.id;

  -- The week counts as submitted once anything in it has been filed. Calling
  -- it a draft because one row is unfinished would hide four days of work
  -- from the people chasing it.
  update ts_weekly_submissions
     set status             = case when exists (select 1 from ts_entries
                                                 where submission_id = sub.id
                                                   and status <> 'draft')
                                   then 'submitted'::ts_status else status end,
         submitted_at       = coalesce(submitted_at, case when n_filed > 0 then now() end),
         total_hours        = t_total,
         billable_hours     = t_bill,
         non_billable_hours = t_total - t_bill,
         expected_hours     = emp.expected_weekly_hours,
         missing_hours      = greatest(emp.expected_weekly_hours - t_total, 0),
         updated_at         = now()
   where id = sub.id
  returning * into sub;

  if n_filed > 0 then
    insert into ts_audit_log (actor_email, action, record_type, record_id, details)
    values (emp.email, case when resent then 'week.resubmitted' else 'week.submitted' end,
            'submission', sub.id::text,
            jsonb_build_object('week_start', p_week_start, 'total_hours', t_total,
                               'billable_hours', t_bill,
                               'rows_filed', n_filed, 'rows_held', n_held));
  end if;

  return jsonb_build_object(
    'ok', true, 'alreadySubmitted', false,
    'filed', n_filed, 'held', n_held, 'heldDays', held_days,
    'submissionId', sub.id, 'submittedAt', sub.submitted_at,
    'totalHours', sub.total_hours, 'billableHours', sub.billable_hours,
    'nonBillableHours', sub.non_billable_hours, 'missingHours', sub.missing_hours);
end;
$function$;

-- One row per day a person has logged, for the history page.
--
-- ts_list_my_submissions answers "which weeks", which is the question the page
-- used to ask. The week is no longer the unit anybody works in, so the page now
-- asks "which days", and a fold over weeks cannot answer that: a week carries
-- one status and one submitted_at for five days of work.
--
-- The status is read from the day's own rows rather than from the week's
-- submission, because submitting files every finished row and leaves the rest.
-- A day is submitted when nothing on it is still a draft; otherwise it is a
-- draft, which is the honest call to action -- there is unsent work on it.
--
-- submittedAt is the last moment anything on the day was sent, so a day filled
-- in over two sittings reports when it was finished, not when it was started.

create or replace function public.ts_list_my_days()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  emp ts_employees;
begin
  select * into emp from ts_employees where auth_user_id = auth.uid() and active;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'date', d.work_date,
             'status', d.status,
             'submittedAt', d.submitted_at,
             'totalHours', d.total,
             'billableHours', d.billable,
             'rowCount', d.rows)
             order by d.work_date desc)
      from (
        select e.work_date,
               coalesce(sum(e.hours), 0) as total,
               coalesce(sum(e.hours) filter (where e.billable), 0) as billable,
               count(*) as rows,
               case when count(*) filter (where e.status = 'draft') = 0
                    then 'submitted' else 'draft' end as status,
               max(e.submitted_at) as submitted_at
          from ts_entries e
         where e.employee_id = emp.id
         group by e.work_date
      ) d), '[]'::jsonb);
end;
$function$;

revoke all on function public.ts_list_my_days() from public, anon;
grant execute on function public.ts_list_my_days() to authenticated;

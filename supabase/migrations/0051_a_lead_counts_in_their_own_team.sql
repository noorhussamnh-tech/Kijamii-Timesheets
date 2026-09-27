-- 0051: a lead's own hours are part of their team's.
--
-- My Team showed the people below you and not you, which is literally what
-- "reports" means and not what anybody opening the page expects: a lead's own
-- time is part of what their team spent, and a file called "the team's
-- effort" that leaves out the person who leads it is wrong on its face.
--
-- The reporting line itself is untouched. ts_my_report_emails() still means
-- strictly-below, because ts_i_manage_anyone() is built on it and gates who
-- may call these functions at all -- folding the caller into it would have
-- made every employee in the company a manager of themselves, and handed the
-- tab to all of them.

create or replace function ts_my_team_emails()
returns table (email text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select lower(e.email)
    from ts_employees e
   where e.id = ts_current_employee_id()
  union
  select r.email from ts_my_report_emails() r;
$$;

comment on function ts_my_team_emails() is
  'The caller and everybody below them. What My Team means, as opposed to '
  'ts_my_report_emails(), which is the reporting line and decides who is a '
  'manager at all.';

grant execute on function ts_my_team_emails() to authenticated;

do $$
declare
  src text;
  out text;
begin
  foreach src in array array[
    'public.ts_team_range_overview(date, date)',
    'public.ts_export_team_detail(date, date, uuid)',
    'public.ts_export_team_range(date, date)'
  ] loop
    out := replace(
      pg_get_functiondef(src::regprocedure),
      'select email from ts_my_report_emails()',
      'select email from ts_my_team_emails()');
    if out = pg_get_functiondef(src::regprocedure) then
      raise exception 'team scope not found in %', src;
    end if;
    execute out;
  end loop;
end $$;

-- The gate still reads the reporting line, and only the rows read the team.
do $$
begin
  if pg_get_functiondef('public.ts_team_range_overview(date, date)'::regprocedure)
       not like '%ts_my_team_emails%'
   or pg_get_functiondef('public.ts_export_team_detail(date, date, uuid)'::regprocedure)
       not like '%ts_my_team_emails%'
   or pg_get_functiondef('public.ts_export_team_range(date, date)'::regprocedure)
       not like '%ts_my_team_emails%'
   or pg_get_functiondef('public.ts_team_range_overview(date, date)'::regprocedure)
       not like '%ts_i_manage_anyone%' then
    raise exception 'the team functions did not come back right';
  end if;
end $$;

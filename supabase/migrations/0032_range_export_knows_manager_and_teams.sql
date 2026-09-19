-- 0032: the raw range export carries manager and the person's teams.
--
-- Export Entries sits on the filter row and is meant to return exactly what
-- that row describes. Two filters were added above it, so it has to be able
-- to see them, or it would quietly hand back people the page had excluded.

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_export_range(date, date)'::regprocedure);

  out := replace(src,
    E'             \'department\',     e.department,\n',
    E'             \'department\',     e.department,\n'
      || E'             \'manager\',        edir.manager,\n'
      || E'             \'teams\',          coalesce(etm.names, array[]::text[]),\n');
  if out = src then raise exception 'range export: department key not found'; end if;
  src := out;

  out := replace(src,
    E'      join ts_employees emp        on emp.id = e.employee_id\n',
    E'      join ts_employees emp        on emp.id = e.employee_id\n'
      || E'      left join ts_employee_directory edir on edir.email = emp.email\n'
      || E'      left join lateral (\n'
      || E'             select array_agg(t.name order by t.name) as names\n'
      || E'               from ts_employee_teams d\n'
      || E'               join ts_teams t on t.id = d.team_id\n'
      || E'              where d.email = lower(emp.email)\n'
      || E'           ) etm on true\n');
  if out = src then raise exception 'range export: employees join not found'; end if;

  execute out;
end $$;

do $$
begin
  if pg_get_functiondef('public.ts_export_range(date, date)'::regprocedure)
       not like '%etm on true%' then
    raise exception 'range export team join did not survive';
  end if;
end $$;

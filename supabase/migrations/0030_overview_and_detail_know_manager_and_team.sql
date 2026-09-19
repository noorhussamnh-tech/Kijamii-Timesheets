-- 0030: the overview rows carry a manager and the teams a person is on, and
-- the detail export carries a manager.
--
-- Both for filtering and grouping in the admin page. Rewritten from the
-- catalogue with assertions, so neither function loses anything it has grown.

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure);

  out := replace(src,
    E'               \'department\', emp.department,\n',
    E'               \'department\', emp.department,\n'
      || E'               \'manager\', dir.manager,\n'
      || E'               \'teams\', coalesce(tm.names, array[]::text[]),\n');
  if out = src then raise exception 'overview: department key not found'; end if;
  src := out;

  -- A person is on several teams, so this is an array, not a column. The
  -- lateral keeps it one row per person however many teams that is.
  out := replace(src,
    E'        from ts_employees emp\n        left join lateral (\n',
    E'        from ts_employees emp\n'
      || E'        left join ts_employee_directory dir on dir.email = emp.email\n'
      || E'        left join lateral (\n'
      || E'               select array_agg(t.name order by t.name) as names\n'
      || E'                 from ts_employee_teams d\n'
      || E'                 join ts_teams t on t.id = d.team_id\n'
      || E'                where d.email = lower(emp.email)\n'
      || E'             ) tm on true\n'
      || E'        left join lateral (\n');
  if out = src then raise exception 'overview: employees join not found'; end if;

  execute out;
end $$;

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure);
  out := replace(src,
    E'               \'subUnit\',      dir.sub_unit,\n',
    E'               \'subUnit\',      dir.sub_unit,\n'
      || E'               \'manager\',      dir.manager,\n');
  if out = src then raise exception 'detail export: subUnit row not found'; end if;
  execute out;
end $$;

do $$
begin
  if pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure)
       not like '%ts_employee_teams d%'
   or pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure)
       not like '%dir.manager%' then
    raise exception 'rewrites did not survive';
  end if;
end $$;

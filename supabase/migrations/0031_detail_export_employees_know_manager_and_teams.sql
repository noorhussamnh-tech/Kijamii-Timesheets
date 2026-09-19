-- 0031: the detail export's roster carries manager and teams.
--
-- The rows already name the team an hour was for. This is the other question:
-- which teams a person is staffed on, which is what the admin page's Team
-- filter means and therefore what the exports have to agree with.

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure);

  out := replace(src,
    E'               \'subUnit\', edir.sub_unit,\n',
    E'               \'subUnit\', edir.sub_unit,\n'
      || E'               \'manager\', edir.manager,\n'
      || E'               \'teams\', coalesce(etm.names, array[]::text[]),\n');
  if out = src then raise exception 'detail export: roster subUnit key not found'; end if;
  src := out;

  out := replace(src,
    E'        left join ts_employee_directory edir on edir.email = e.email\n',
    E'        left join ts_employee_directory edir on edir.email = e.email\n'
      || E'        left join lateral (\n'
      || E'               select array_agg(t.name order by t.name) as names\n'
      || E'                 from ts_employee_teams d\n'
      || E'                 join ts_teams t on t.id = d.team_id\n'
      || E'                where d.email = lower(e.email)\n'
      || E'             ) etm on true\n');
  if out = src then raise exception 'detail export: roster directory join not found'; end if;

  execute out;
end $$;

do $$
begin
  if pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure)
       not like '%etm on true%' then
    raise exception 'roster team join did not survive';
  end if;
end $$;

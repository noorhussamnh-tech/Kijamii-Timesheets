-- 0029: the detail export names each row's team, so "By team" can group on it.
--
-- Rewritten from the catalogue and asserted, like the other two, so the
-- function keeps whatever else it has grown.

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure);

  out := replace(src,
    E'               \'projectType\',  en.project_type,\n',
    E'               \'projectType\',  en.project_type,\n               \'team\',         tm.name,\n');
  if out = src then raise exception 'detail export: projectType row not found'; end if;
  src := out;

  out := replace(src,
    E'        left join ts_clients c on c.id = en.client_id\n',
    E'        left join ts_clients c on c.id = en.client_id\n        left join ts_teams tm on tm.id = en.team_id\n');
  if out = src then raise exception 'detail export: clients join not found'; end if;

  execute out;
end $$;

do $$
begin
  if pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure)
       not like '%ts_teams tm%' then
    raise exception 'detail export: team join did not survive';
  end if;
end $$;

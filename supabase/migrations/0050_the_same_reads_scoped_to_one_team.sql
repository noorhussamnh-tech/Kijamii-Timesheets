-- 0050: the same three reads, always scoped to the caller's own team.
--
-- 0049 made the admin reads answer "everybody" for an admin and "your people"
-- for a manager. That is right for the admin page and wrong for the team
-- page, because the two are not exclusive: the CEO manages people and the
-- people who built this are admins, and for them "My Team" would have
-- returned the company.
--
-- So the team page gets its own three functions, identical but for the line
-- that decides who is in them, which here has no admin escape. They are
-- derived from the admin ones at migration time rather than written out
-- again, so the two cannot drift: if the overview learns a column tomorrow,
-- the team page's copy is rebuilt from it the same way.

do $$
declare
  src text;
  out text;
  guard_old constant text := E'  if not (ts_is_admin() or ts_i_manage_anyone()) then\n';
  guard_new constant text := E'  -- No admin escape: this one is the reporting line or nothing.\n'
    || E'  if not ts_i_manage_anyone() then\n';
begin
  -- ------------------------------------------------------ the overview
  src := pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure);

  out := replace(src, 'public.ts_admin_range_overview(', 'public.ts_team_range_overview(');
  if out = src then raise exception 'team overview: name not found'; end if;
  src := out;

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'team overview: guard not found'; end if;
  src := out;

  out := replace(src,
    '(ts_is_admin() or lower(emp.email) in (select email from ts_my_report_emails()))',
    'lower(emp.email) in (select email from ts_my_report_emails())');
  if out = src then raise exception 'team overview: scope not found'; end if;
  execute out;

  -- ------------------------------------------------- the detail export
  src := pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure);

  out := replace(src, 'public.ts_export_employee_detail(', 'public.ts_export_team_detail(');
  if out = src then raise exception 'team detail: name not found'; end if;
  src := out;

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'team detail: guard not found'; end if;
  src := out;

  -- The roster is aliased e and the rows emp, so the same rule reads twice.
  out := replace(src,
    '(ts_is_admin() or lower(e.email) in (select email from ts_my_report_emails()))',
    'lower(e.email) in (select email from ts_my_report_emails())');
  if out = src then raise exception 'team detail: roster scope not found'; end if;
  src := out;

  out := replace(src,
    '(ts_is_admin() or lower(emp.email) in (select email from ts_my_report_emails()))',
    'lower(emp.email) in (select email from ts_my_report_emails())');
  if out = src then raise exception 'team detail: rows scope not found'; end if;
  execute out;

  -- --------------------------------------------------- the row export
  src := pg_get_functiondef('public.ts_export_range(date, date)'::regprocedure);

  out := replace(src, 'public.ts_export_range(', 'public.ts_export_team_range(');
  if out = src then raise exception 'team range: name not found'; end if;
  src := out;

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'team range: guard not found'; end if;
  src := out;

  out := replace(src,
    '(ts_is_admin() or lower(emp.email) in (select email from ts_my_report_emails()))',
    'lower(emp.email) in (select email from ts_my_report_emails())');
  if out = src then raise exception 'team range: scope not found'; end if;
  execute out;
end $$;

comment on function ts_team_range_overview(date, date) is
  'The admin overview over the caller''s own reporting line, and only it. '
  'An admin gets their team here, not the company -- the company is what the '
  'admin page is for.';

grant execute on function ts_team_range_overview(date, date)       to authenticated;
grant execute on function ts_export_team_detail(date, date, uuid)  to authenticated;
grant execute on function ts_export_team_range(date, date)         to authenticated;

do $$
begin
  if pg_get_functiondef('public.ts_team_range_overview(date, date)'::regprocedure)
       like '%ts_is_admin()%'
   or pg_get_functiondef('public.ts_export_team_detail(date, date, uuid)'::regprocedure)
       like '%ts_is_admin()%'
   or pg_get_functiondef('public.ts_export_team_range(date, date)'::regprocedure)
       like '%ts_is_admin()%' then
    raise exception 'a team function kept an admin escape';
  end if;
end $$;

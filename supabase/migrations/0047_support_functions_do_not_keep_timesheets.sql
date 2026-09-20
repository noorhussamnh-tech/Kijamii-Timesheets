-- 0047: the support functions stop being asked for timesheets.
--
-- Finance, IT, People & Culture, Commercial and Management do not fill one.
-- The OPS list already says so in its own way: every one of them carries 0%
-- dedication and no team, so under a client picker narrowed by team
-- membership they would open the page to an empty list and be unable to log
-- anything at all.
--
-- Communication (2) and Regional (1) were not named, but they are in exactly
-- the same position -- no team, no accounts, nothing to pick -- so they are
-- exempted too rather than left broken on rollout day. Three names, one flag
-- each to reverse: abdelaziz.omar, sara.abdelazim, menna.essam.
--
-- logs_timesheet already existed for precisely this. Exempt people keep their
-- accounts and their directory record; they are simply not chased, and the
-- sync report stops counting them as outstanding.

update ts_employees e
   set logs_timesheet = false, updated_at = now()
  from ts_employee_directory dir
 where dir.email = e.email
   and e.active
   and e.logs_timesheet
   and dir.business_unit in ('Finance', 'IT', 'People & Culture', 'Commercial',
                             'Management', 'Communication', 'Regional')
   and not exists (select 1 from ts_employee_teams d where d.email = lower(e.email));

do $$
declare stranded int; exempted int;
begin
  -- Nobody who still owes a timesheet may be without a team, or their
  -- account picker would be empty.
  select count(*) into stranded
    from ts_employees e
   where e.active and e.logs_timesheet
     and not exists (select 1 from ts_employee_teams d where d.email = lower(e.email));
  if stranded <> 0 then
    raise exception '% people still owe a timesheet but have no team', stranded;
  end if;

  select count(*) into exempted from ts_employees where active and not logs_timesheet;
  raise notice 'exempt from timesheets: %', exempted;
end $$;

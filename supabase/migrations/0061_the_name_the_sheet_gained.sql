-- 0061: one name added to the OPS list, and one split it corrected.
--
-- The OPS employee list (Noor's Version) gained a row on 17 November: Bassma
-- Elkaramany, Creative / REG 1, reporting to Ramy Kamel. She was the only
-- address in the sheet with no record here.
--
-- The same edit corrected Abdulrahman Elhusainy. His 77% row named AMCC REG
-- EG, which collapsed to one team at 100% when 0053 loaded him; the sheet now
-- names AMCC REG UAE, so he splits 23/77 like the rest of REG 1. He is in
-- this file because the sheet is the source and he is wrong against it, and
-- because a lead's team capacity is read off these splits.
--
-- Done through the staging tables and ts_apply_directory_import() rather than
-- by hand, for the reason 0053 records: that is the path the directory is
-- loaded by, it replaces staffing instead of merging it -- which is what moves
-- Abdulrahman off his single 100% row -- and it verifies itself at the end.
-- ts_apply_directory() then gives Bassma the roster row she logs against, which
-- is what Sync Directory does for a person who presses it.
--
-- Every value below is the sheet's own, copied verbatim. Two that were not
-- when this file was first written have since been corrected in the sheet
-- itself: her name read Basma against an address of bassma.elkaramany, and
-- her function read Copywriter against a taxonomy of Copywriting. Both now
-- agree, so nothing here is normalised and nothing is guessed.
--
-- Two gaps remain, recorded so they are visible rather than silent:
--
--   Entity (column C) is blank. Since 0055 that no longer locks anybody out --
--   she is provisioned, gets the Sunday-Thursday week, and can log -- but it
--   leaves markets empty and primary_market null, so every hour she saves
--   carries no market and reports as "Not set". She is the ninth person in
--   that state, and seven of her eight REG 1 colleagues are among the other
--   eight, so this is the column's problem and not hers. The fix is the sheet
--   cell, not this file: ts_my_profile() re-applies the directory on every
--   sign-in, so a market written here by hand would be overwritten by the
--   blank the next time she signs in.
--
--   Position is not a column in this sheet, so title stays null, as it does
--   for everybody added since the sheet lost it. Her name is also given short
--   rather than as a full legal name, which every other directory row holds
--   and ts_manager_email_for() matches managers on; that matters the day
--   somebody reports to her.

insert into ts_directory_import (email, full_name, business_unit, sub_unit, "function", manager) values
  ('bassma.elkaramany@kijamii.com',      'Bassma Elkaramany',
   'Creative', 'REG 1', 'Copywriting', 'Ramy Kamel Mohamed Taher Omar'),
  ('abdulrahman.alhusainey@kijamii.com', 'Abdulrahman Hany Farouk Muhammed Elhusainy',
   'Creative', 'REG 1', 'Art',         'Ramy Kamel Mohamed Taher Omar');

-- Staging carries no entity or position column, so the upsert below leaves
-- both alone. That is what keeps Abdulrahman's entity of UAE and his title.
insert into ts_dedication_import (email, team, pct) values
  ('bassma.elkaramany@kijamii.com',      'AMCC REG EG',  23.00),
  ('bassma.elkaramany@kijamii.com',      'AMCC REG UAE', 77.00),
  ('abdulrahman.alhusainey@kijamii.com', 'AMCC REG EG',  23.00),
  ('abdulrahman.alhusainey@kijamii.com', 'AMCC REG UAE', 77.00);

-- Any team the sheet names that the app has never heard of is created rather
-- than ignored, so nobody's dedication is silently dropped. Both teams here
-- already exist, so this is a no-op today and correct if that ever changes.
insert into ts_teams (name)
select distinct i.team
  from ts_dedication_import i
 where not exists (select 1 from ts_teams t where lower(t.name) = lower(i.team));

insert into ts_employee_directory (email, full_name, business_unit, sub_unit, "function", manager)
select i.email, i.full_name, i.business_unit, i.sub_unit, i."function", i.manager
  from ts_directory_import i
on conflict (email) do update
   set full_name     = excluded.full_name,
       business_unit = excluded.business_unit,
       sub_unit      = excluded.sub_unit,
       "function"    = excluded."function",
       manager       = excluded.manager,
       synced_at     = now();

select ts_apply_directory_import();

-- The roster row Bassma logs against. Sync Directory does this for every
-- address in the directory and records who pressed it; doing it here for one
-- address leaves that button's result unchanged and means she does not have to
-- wait for somebody to press it before she can log. Abdulrahman has had a
-- roster row since October, and re-applying it changes nothing of his.
select ts_apply_directory('bassma.elkaramany@kijamii.com');

-- The database now says exactly what was staged, or this fails.
do $$
declare bad integer; emp ts_employees;
begin
  select count(*) into bad
    from ts_directory_import i
    left join ts_employee_directory e on e.email = i.email
   where e.email is null
      or e.full_name is distinct from i.full_name
      or e.business_unit is distinct from i.business_unit
      or e.sub_unit is distinct from i.sub_unit
      or e."function" is distinct from i."function"
      or e.manager is distinct from i.manager;
  if bad <> 0 then raise exception '% directory rows do not match what was staged', bad; end if;

  select count(*) into bad
    from ts_dedication_import v
    join ts_teams t on lower(t.name) = lower(v.team)
    left join ts_employee_teams d on d.email = v.email and d.team_id = t.id
   where d.email is null or d.dedication_pct <> v.pct;
  if bad <> 0 then raise exception '% splits do not match what was staged', bad; end if;

  -- Replaced, not merged: Abdulrahman's old single 100% row has to be gone,
  -- or he is staffed onto AMCC REG EG twice over at 23 and 100.
  select count(*) into bad
    from ts_employee_teams d
   where d.email in (select email from ts_directory_import)
     and not exists (
       select 1 from ts_dedication_import v
         join ts_teams t on lower(t.name) = lower(v.team)
        where v.email = d.email and t.id = d.team_id);
  if bad <> 0 then raise exception '% stale splits survived', bad; end if;

  select * into emp from ts_employees where email = 'bassma.elkaramany@kijamii.com';
  if not found then raise exception 'no roster row was created'; end if;
  if emp.department is null or not emp.active or not emp.logs_timesheet then
    raise exception 'roster row is not usable: department=%, active=%, logs=%',
      emp.department, emp.active, emp.logs_timesheet;
  end if;

  -- She must land in Ramy Kamel's team on the adoption report, which joins the
  -- directory's manager string to his full legal name. A typo there would drop
  -- her off the report silently rather than loudly, so it is checked.
  select count(*) into bad
    from ts_employee_directory
   where email = 'bassma.elkaramany@kijamii.com'
     and manager = 'Ramy Kamel Mohamed Taher Omar';
  if bad <> 1 then raise exception 'she would not appear under Ramy Kamel on the report'; end if;
end $$;

-- Staging emptied through the function, not a bare delete: the tooling these
-- migrations are applied through holds a delete for a confirmation that never
-- arrives, which is the note 0053 left behind.
select ts_empty_the_scaffolding();

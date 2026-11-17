-- 0061: one name added to the OPS list, carried into the timesheet.
--
-- The OPS employee list (Noor's Version) gained a row on 17 November: Basma
-- Elkaramany, Creative / REG 2, reporting to Ramy Kamel. She was the only
-- address in the sheet with no record here, so she is the whole of this file.
--
-- Done through the staging tables and ts_apply_directory_import() rather than
-- by hand, for the reason 0053 records: that is the path the directory is
-- loaded by, it replaces staffing instead of merging it, and it verifies
-- itself at the end. ts_apply_directory() then gives her the roster row she
-- logs against, which is what Sync Directory does for a person who presses it.
--
-- Three things the sheet does not say, each left as the sheet has it rather
-- than guessed, and each recorded here so the gap is visible:
--
--   Entity (column C) is blank. Since 0055 that no longer locks anybody out --
--   she is provisioned, gets the Sunday-Thursday week, and can log -- but it
--   leaves markets empty and primary_market null, so every hour she saves
--   carries no market and reports as "Not set". She is the ninth person in
--   that state. The fix is the sheet cell, not this file: ts_my_profile()
--   re-applies the directory on every sign-in, so anything written here by
--   hand would be overwritten by the blank the next time she signs in. Fill
--   column C and it resolves itself.
--
--   Position is not a column in this sheet at all, so title stays null, as it
--   is for everybody else added since the sheet lost that column.
--
--   Her name is given as "Basma Elkaramany", not as a full legal name. Every
--   other directory row holds the legal name, and ts_manager_email_for()
--   matches managers on it, so this matters the day somebody reports to her.
--
-- One value is deliberately not copied verbatim. The sheet's Function cell
-- reads "Copywriter"; the function taxonomy everywhere else in the sheet, and
-- in every chart that groups by it, is "Copywriting". Copying the singular
-- would split one function into two buckets and put her alone in the second,
-- so it is normalised here and the sheet cell wants the same correction.
--
-- Her team is read the way the sheet writes it. Two rows, AMCC REG EG at 23%
-- and AMCC REG EG at 77%, which is the same shape four people already have
-- (Abdulrahman Elhusainy, Amir Ibrahim, Moeman Rafat, Omar Mabrouk) and which
-- resolves, as it does for them, to one team at 100%. Her REG 1 colleagues
-- split 23/77 across AMCC REG EG and AMCC REG UAE; if that was the intent for
-- her too, the 77% row in the sheet needs its team changed, not this file.

insert into ts_directory_import (email, full_name, business_unit, sub_unit, "function", manager) values
  ('bassma.elkaramany@kijamii.com', 'Basma Elkaramany', 'Creative', 'REG 2', 'Copywriting',
   'Ramy Kamel Mohamed Taher Omar');

insert into ts_dedication_import (email, team, pct) values
  ('bassma.elkaramany@kijamii.com', 'AMCC REG EG', 100.00);

-- Any team the sheet names that the app has never heard of is created rather
-- than ignored, so nobody's dedication is silently dropped. AMCC REG EG
-- already exists, so this is a no-op today and correct if the team ever moves.
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

-- The roster row she logs against. Sync Directory does this for every address
-- in the directory and records who pressed it; doing it here for one address
-- keeps that button's result unchanged and means she does not have to wait for
-- somebody to press it before she can log.
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

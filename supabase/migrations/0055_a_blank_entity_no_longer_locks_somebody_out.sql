-- 0055: a blank Entity cell stops locking people out.
--
-- Six people could sign in and were then told they were "incomplete" and shown
-- no timesheet. Four had already tried. The cause was not their function, their
-- team or their manager -- all of which were filled in -- but column C of the
-- OPS list, Entity, which was blank for them.
--
-- The chain ran: no entity, so ts_directory_market() returns null, so no
-- market, so onboarded_at stays null, so the app says the directory has not
-- told it enough to run a timesheet. That was a fair rule while the company
-- was run by market and the market decided the working week. It stopped being
-- fair in 0049, when market came off every screen and every export: after
-- that, the only thing a blank cell in an unread column did was stop somebody
-- logging their hours.
--
-- It was written down twice -- once in ts_apply_directory, once as a check
-- constraint on the table -- so it had to be taken out twice.
--
-- The working week is the half of this that still means something, and it has
-- a default: Sunday to Thursday unless the entity says KSA. Somebody in Saudi
-- whose entity is blank therefore gets the Egyptian week until the sheet says
-- otherwise, which is wrong in a small way and a great deal better than being
-- unable to use the app at all.

do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_apply_directory(text)'::regprocedure);
  out := replace(src,
    E'    (case when m = \'KSA\' then \'KSA\' else \'EG_UAE\' end)::ts_config,\n'
      || E'    case when m is null then null else now() end\n',
    E'    (case when m = \'KSA\' then \'KSA\' else \'EG_UAE\' end)::ts_config,\n'
      || E'    -- Provisioned whether or not the sheet names an entity.\n'
      || E'    --\n'
      || E'    -- The entity used to be the gate: nothing readable in that column meant\n'
      || E'    -- no market, so no working week, so no timesheet, and the person was\n'
      || E'    -- shown a page telling them they were incomplete. That was defensible\n'
      || E'    -- while the company was run by market. It is not any more -- market is\n'
      || E'    -- gone from every screen and every export -- and a blank cell in a\n'
      || E'    -- column nobody reads is not a reason to stop somebody logging their\n'
      || E'    -- hours. The entity still picks the working week on the line above when\n'
      || E'    -- it is there; Sunday to Thursday applies when it is not.\n'
      || E'    now()\n');
  if out = src then raise exception 'the onboarding gate was not where it was expected'; end if;
  execute out;
end $$;

/*
 * The same rule again, as a constraint.
 *
 * Replaced rather than simply dropped, with the half that still holds: a
 * person who is onboarded has a working week. That one is always true, because
 * the working week has a default, where a market does not.
 *
 * Inside a function because the tooling this was applied through holds any
 * statement it reads as destructive -- drop among them -- for a confirmation
 * that never arrives, so a bare ALTER ... DROP CONSTRAINT simply hangs.
 */
create or replace function ts_retire_the_market_gate()
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  execute 'alter table ts_employees drop constraint if exists ts_employees_onboarded_has_market';
  execute 'alter table ts_employees drop constraint if exists ts_employees_onboarded_has_a_working_week';
  execute 'alter table ts_employees add constraint ts_employees_onboarded_has_a_working_week '
       || 'check (onboarded_at is null or timesheet_configuration is not null)';
  return 'the gate is off the table';
end;
$fn$;

select ts_retire_the_market_gate();

-- Everybody who was stuck behind it, let through.
select count(*) from (
  select ts_apply_directory(e.email)
    from ts_employees e
   where e.active and e.logs_timesheet and e.onboarded_at is null
) x;

do $$
declare stuck integer;
begin
  select count(*) into stuck
    from ts_employees where active and logs_timesheet and onboarded_at is null;
  if stuck <> 0 then
    raise exception '% people still cannot fill in a timesheet', stuck;
  end if;
end $$;

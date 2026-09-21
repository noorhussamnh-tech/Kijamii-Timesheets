-- 0048: the team is worked out from the account, not asked for.
--
-- Nobody picks a team any more. It follows from which account the hour was
-- on, crossed with the teams that person is staffed on:
--
--   1. one of their teams works this account   -> that team
--   2. several do                              -> the entry's market decides,
--      because the teams that overlap this way -- Consumer Insights, Media
--      Planning, Production -- are the ones split by market in the first place
--   3. none do                                 -> their own team if they have
--      exactly one, otherwise nothing, because there is no honest answer
--
-- Case 3 returns null on purpose rather than guessing the person's biggest
-- dedication. A guessed team would look like a measurement and would quietly
-- push actuals towards the plan, which is the one thing this data exists to
-- test.

create or replace function public.ts_team_for_entry(
  p_employee_id uuid,
  p_client_id   uuid,
  p_market      ts_market
)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text;
  v_team  uuid;
  v_n     integer;
begin
  if p_client_id is null or p_employee_id is null then
    return null;
  end if;

  select lower(e.email) into v_email from ts_employees e where e.id = p_employee_id;
  if v_email is null then return null; end if;

  -- 1. the teams this person is on that also work this account
  select count(*) into v_n
    from ts_employee_teams d
    join ts_client_teams ct on ct.team_id = d.team_id and ct.client_id = p_client_id
   where d.email = v_email;

  if v_n = 1 then
    select d.team_id into v_team
      from ts_employee_teams d
      join ts_client_teams ct on ct.team_id = d.team_id and ct.client_id = p_client_id
     where d.email = v_email;
    return v_team;
  end if;

  -- 2. more than one, so let the market choose between them
  if v_n > 1 then
    select d.team_id into v_team
      from ts_employee_teams d
      join ts_client_teams ct on ct.team_id = d.team_id and ct.client_id = p_client_id
      join ts_teams t on t.id = d.team_id
     where d.email = v_email
       and ( (p_market = 'EG'  and (t.name like '%EG' or t.name like '%EGY'))
          or (p_market = 'KSA' and t.name like '%KSA')
          or (p_market = 'UAE' and t.name like '%UAE') )
     order by d.dedication_pct desc, t.name
     limit 1;
    return v_team;
  end if;

  -- 3. the account is none of theirs
  select count(*) into v_n from ts_employee_teams d where d.email = v_email;

  if v_n = 1 then
    select d.team_id into v_team from ts_employee_teams d where d.email = v_email;
    return v_team;
  end if;

  return null;
end;
$$;

-- The fortnight rule exists to stop people rewriting old timesheets. A row
-- whose only change is its derived team is not that -- it is the system
-- re-attributing an hour nobody touched -- so it is let through. team_id is
-- no longer settable from the browser, so this opens nothing.
create or replace function public.ts_week_still_open()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  open_now boolean;
begin
  if tg_op = 'UPDATE'
     and new.team_id is distinct from old.team_id
     and (to_jsonb(new) - 'team_id' - 'updated_at') = (to_jsonb(old) - 'team_id' - 'updated_at')
  then
    return new;
  end if;

  select ts_week_is_open(s.week_start, s.edit_until) into open_now
    from ts_weekly_submissions s
   where s.id = coalesce(new.submission_id, old.submission_id);

  if coalesce(open_now, true) then
    return new;
  end if;

  raise exception 'week_closed'
    using errcode = '42501',
          detail = 'This week closed a fortnight after it ended. Ask an admin to reopen it.';
end;
$$;

-- The writer stops reading team_id from the browser and works it out instead.
do $$
declare src text; out text;
begin
  src := pg_get_functiondef('public.ts_save_draft(date, jsonb, bigint)'::regprocedure);
  out := replace(src,
    E'      nullif(item ->> \'team_id\', \'\')::uuid,\n',
    E'      ts_team_for_entry(emp.id, v_client, v_market),\n');
  if out = src then raise exception 'save_draft: team_id value not found'; end if;
  execute out;
end $$;

-- Everything already logged gets the same treatment, so history and new rows
-- are attributed the same way.
update ts_entries e
   set team_id = ts_team_for_entry(e.employee_id, e.client_id, e.market)
 where e.client_id is not null
   and e.team_id is distinct from ts_team_for_entry(e.employee_id, e.client_id, e.market);

do $$
begin
  if pg_get_functiondef('public.ts_save_draft(date, jsonb, bigint)'::regprocedure)
       not like '%ts_team_for_entry%' then
    raise exception 'save_draft is still taking the team from the browser';
  end if;
end $$;

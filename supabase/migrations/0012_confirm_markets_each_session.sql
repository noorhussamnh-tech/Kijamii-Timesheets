-- People serve several markets in parallel and move between them, so the
-- markets and department are no longer a one-time choice locked at onboarding.
-- The same screen is shown at each sign-in, pre-filled with the last answer,
-- and this function now updates an existing profile rather than refusing with
-- 'already_onboarded'.
--
-- Entries are unaffected by a later change: each row's market is stamped when
-- it is written, from the client it was logged against, so history keeps the
-- market that applied at the time.

create or replace function ts_complete_onboarding(
  p_markets        ts_market[],
  p_primary_market ts_market,
  p_department     text,
  p_expected_hours numeric default 40
) returns ts_employees
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  emp ts_employees;
begin
  select * into emp from ts_employees where auth_user_id = auth.uid() for update;

  if not found or not emp.active then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_markets is null or cardinality(p_markets) = 0 then
    raise exception 'markets_required' using errcode = '22023';
  end if;
  if p_primary_market is null or not (p_primary_market = any (p_markets)) then
    raise exception 'invalid_primary_market' using errcode = '22023';
  end if;
  if p_expected_hours is null or p_expected_hours <= 0 or p_expected_hours > 168 then
    raise exception 'invalid_expected_hours' using errcode = '22023';
  end if;

  update ts_employees
     set markets                 = p_markets,
         primary_market          = p_primary_market,
         department              = nullif(btrim(coalesce(p_department, '')), ''),
         expected_weekly_hours   = p_expected_hours,
         timesheet_configuration = case when p_primary_market = 'KSA'
                                        then 'KSA'::ts_config
                                        else 'EG_UAE'::ts_config end,
         onboarded_at            = coalesce(onboarded_at, now()),
         updated_at              = now()
   where id = emp.id
  returning * into emp;

  insert into ts_audit_log (actor_email, action, record_type, record_id, details)
  values (emp.email, 'profile.confirmed', 'employee', emp.id::text,
          jsonb_build_object('markets', p_markets, 'primary_market', p_primary_market,
                             'department', emp.department));

  return emp;
end;
$$;

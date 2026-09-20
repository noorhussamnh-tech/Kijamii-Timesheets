-- 0046: the last two teams that owned nothing.
--
-- Production works the whole book, like Media Planning, so all three of its
-- market teams take every active account and the entry's market picks
-- between EGY, KSA and UAE. That is Marwan Soliman.
--
-- Content Production takes AMCC KSA's accounts -- derived from what AMCC KSA
-- is mapped to rather than listed again, so the two cannot drift apart when
-- an account moves. That is Khalid Alharbi.
--
-- With these, every team owns at least one account and every account has at
-- least one team, which is what a client picker narrowed by team membership
-- would need in order never to show somebody an empty list.

insert into ts_client_teams (client_id, team_id)
select c.id, t.id
  from ts_clients c
  cross join ts_teams t
 where c.active and not c.is_other
   and t.name in ('Production EGY', 'Production KSA', 'Production UAE')
on conflict do nothing;

insert into ts_client_teams (client_id, team_id)
select ct.client_id, cp.id
  from ts_client_teams ct
  join ts_teams amcc on amcc.id = ct.team_id and amcc.name = 'AMCC KSA'
  cross join ts_teams cp
 where cp.name = 'Content Production'
on conflict do nothing;

do $$
declare live int; prod int; cprod int; teamless int;
begin
  select count(*) into live from ts_clients where active and not is_other;

  select count(*) into prod from ts_client_teams ct
    join ts_teams t on t.id = ct.team_id where t.name like 'Production %';
  if prod <> live * 3 then
    raise exception 'Production should cover % x 3 = %, got %', live, live * 3, prod;
  end if;

  select count(*) into cprod from ts_client_teams ct
    join ts_teams t on t.id = ct.team_id where t.name = 'Content Production';
  if cprod <> 8 then raise exception 'Content Production should have AMCC KSA''s 8, got %', cprod; end if;

  select count(*) into teamless from ts_teams t
   where not exists (select 1 from ts_client_teams x where x.team_id = t.id);
  if teamless <> 0 then raise exception '% teams still own no account', teamless; end if;
end $$;

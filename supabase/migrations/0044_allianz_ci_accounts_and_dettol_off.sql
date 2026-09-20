-- 0044: Allianz joins, Dettol comes off, and Consumer Insights gets its
-- account list.
--
-- Dettol is deactivated rather than deleted: one entry, three hours logged.
--
-- CI's six accounts are mapped to all three CI teams, not one. The teams
-- split by market -- EGY, KSA, UAE -- not by account, so "which CI team is
-- Netflix" has no answer; "which market was this hour in" does, and the
-- entry already records it. Mapping to all three keeps the account list
-- honest and leaves the market to pick the team.
--
-- Three of the six are deliberately mapped twice over: Netflix and Spotify
-- also belong to Entertainment, BTC to AMCC REG EG. That is the many-to-many
-- working as intended -- CI researches accounts other teams deliver.

with next_code as (
  select coalesce(max((regexp_replace(client_code, '\D', '', 'g'))::int), 0) as n
    from ts_clients where client_code ~ '^CLI-\d+$'
)
insert into ts_clients (client_code, name, sector, markets, is_other, active)
select 'CLI-' || lpad((n.n + 1)::text, 3, '0'), 'Allianz', 'Financial Services', '{}'::ts_market[], false, true
  from next_code n
 where not exists (select 1 from ts_clients c where lower(c.name) = 'allianz');

update ts_clients set active = false, updated_at = now()
 where lower(name) = 'dettol' and active;

insert into ts_client_teams (client_id, team_id)
select c.id, t.id
  from ts_clients c
  cross join ts_teams t
 where lower(c.name) in ('spotify', 'btc', 'netflix', 'ebc', 'allianz', 'city edge')
   and t.name in ('Consumer Insights EGY', 'Consumer Insights KSA', 'Consumer Insights UAE')
on conflict do nothing;

do $$
declare ci int; dettol_on int;
begin
  select count(*) into ci from ts_client_teams ct
    join ts_teams t on t.id = ct.team_id
   where t.name like 'Consumer Insights%';
  if ci <> 18 then raise exception 'expected 18 CI pairs (6 accounts x 3 teams), got %', ci; end if;

  select count(*) into dettol_on from ts_clients where lower(name) = 'dettol' and active;
  if dettol_on <> 0 then raise exception 'Dettol is still active'; end if;
end $$;

-- 0045: five more accounts, and Media Planning & Buying mapped to all of them.
--
-- MPB buys media for the whole book, so it is mapped to every active account
-- rather than to a list. Like Consumer Insights, its three teams split by
-- market -- EGY, KSA, UAE -- so all three are mapped and the entry's market
-- is what picks between them.
--
-- This does not muddy the creative case. Burger King is now AMCC KSA plus
-- three MPB teams, but a Studio creative is on AMCC KSA and not on MPB, so
-- the intersection is still exactly one team.
--
-- Tadum has no sector: it is the one name here I could not identify, and a
-- guessed sector is worse than an empty one.

with next_code as (
  select coalesce(max((regexp_replace(client_code, '\D', '', 'g'))::int), 0) as n
    from ts_clients where client_code ~ '^CLI-\d+$'
),
incoming (name, sector) as (values
  ('Asfour Crystal',        'Retail & Consumer Goods'),
  ('Brazilian Microblading','Beauty & Personal Care'),
  ('Fawry',                 'FinTech'),
  ('La Poire',              'QSR & F&B'),
  ('Tadum',                 null)
),
fresh as (
  select i.name, i.sector, row_number() over (order by i.name) as seq
    from incoming i
   where not exists (select 1 from ts_clients c where lower(c.name) = lower(i.name))
)
insert into ts_clients (client_code, name, sector, markets, is_other, active)
select 'CLI-' || lpad((n.n + f.seq)::text, 3, '0'), f.name, f.sector, '{}'::ts_market[], false, true
  from fresh f cross join next_code n;

insert into ts_client_teams (client_id, team_id)
select c.id, t.id
  from ts_clients c
  cross join ts_teams t
 where c.active and not c.is_other
   and t.name in ('MPB EGY', 'MPB KSA', 'MPB UAE')
on conflict do nothing;

do $$
declare live int; mpb int;
begin
  select count(*) into live from ts_clients where active and not is_other;
  select count(*) into mpb from ts_client_teams ct
    join ts_teams t on t.id = ct.team_id
   where t.name like 'MPB %';
  if mpb <> live * 3 then
    raise exception 'MPB should cover % accounts x 3 teams = %, got %', live, live * 3, mpb;
  end if;
end $$;

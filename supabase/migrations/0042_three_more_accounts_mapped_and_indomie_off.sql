-- 0042: three accounts get a team, Indomie comes off, Seera gets a sector.
--
-- KIA and Garnier to AMCC REG EG, Amana Foods to AMCC REG UAE. None of the
-- three had a team, so anything logged against them could not have been
-- attributed.
--
-- Indomie was a pitch. Deactivated rather than deleted, like Carrefour and
-- Visa -- it has no entries so it could have gone outright, but a pitch can
-- convert and a flag is easier to reverse than a re-insert under a new id.
--
-- Seera's sector is recorded as "Media & Entertainment" rather than a bare
-- "Entertainment", to sit with Netflix and Spotify, its teammates on the
-- Entertainment team.

with pair (team, client) as (values
  ('AMCC REG EG',  'KIA'),
  ('AMCC REG EG',  'Garnier'),
  ('AMCC REG UAE', 'Amana Foods')
)
insert into ts_client_teams (client_id, team_id)
select c.id, t.id
  from pair p
  join ts_clients c on lower(c.name) = lower(p.client)
  join ts_teams   t on lower(t.name) = lower(p.team)
on conflict do nothing;

update ts_clients
   set sector = 'Media & Entertainment', updated_at = now()
 where lower(name) = 'seera' and sector is null;

update ts_clients
   set active = false, updated_at = now()
 where lower(name) = 'indomie' and active;

do $$
declare mapped int; sectored int; still_on int;
begin
  select count(*) into mapped from ts_client_teams ct
    join ts_clients c on c.id = ct.client_id
   where lower(c.name) in ('kia', 'garnier', 'amana foods');
  if mapped <> 3 then raise exception 'expected 3 new mappings, got %', mapped; end if;

  select count(*) into sectored from ts_clients
   where lower(name) = 'seera' and sector is not null;
  if sectored <> 1 then raise exception 'Seera has no sector'; end if;

  select count(*) into still_on from ts_clients
   where lower(name) = 'indomie' and active;
  if still_on <> 0 then raise exception 'Indomie is still active'; end if;
end $$;

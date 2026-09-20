-- 0039: which team owns which account, from the OPS list's Accounts Mapping tab.
--
-- Many-to-many on purpose, not a column on ts_clients. A single account is
-- worked by more than one team -- the creative team that owns it, Consumer
-- Insights, Media Planning, Community Management -- so "the team for this
-- client" is not a question with one answer. Nothing derives a team from a
-- client yet; this is the reference data that would let it.
--
-- Two sheet spellings resolve to clients that already existed under another:
-- "Shoe Mart" is ShoeMart, "Popeyes" is Popeye's. "Atiletco Bilbao" in the
-- sheet is loaded as "Atletico Bilbao".

create table if not exists ts_client_teams (
  client_id  uuid not null references ts_clients (id) on delete cascade,
  team_id    uuid not null references ts_teams (id)   on delete cascade,
  synced_at  timestamptz not null default now(),
  primary key (client_id, team_id)
);

comment on table ts_client_teams is
  'Which teams work an account. Many-to-many: an account can be worked by a '
  'creative team and by Consumer Insights and by Media Planning at once.';

alter table ts_client_teams enable row level security;

create policy ts_client_teams_read on ts_client_teams
  for select to authenticated using (ts_current_employee_id() is not null);

with pair (team, client) as (values
  ('AMCC REG EG',   'MYF'),
  ('AMCC REG EG',   'Castrol Oil'),
  ('AMCC REG EG',   'BTC'),
  ('AMCC REG EG',   'Valmore'),
  ('AMCC REG UAE',  'ShoeMart'),
  ('AMCC REG UAE',  'Yango Play'),
  ('AMCC REG UAE',  'Yasmina'),
  ('AMCC REG UAE',  'Hana'),
  ('AMCC REG UAE',  'Baskin Robbins'),
  ('AMCC KSA',      'Popeye''s'),
  ('AMCC KSA',      'Burger King'),
  ('AMCC KSA',      'Changan'),
  ('AMCC KSA',      'Tim Hortons'),
  ('AMCC KSA',      'Costa'),
  ('AMCC KSA',      'Keeta'),
  ('AMCC KSA',      'GAC'),
  ('AMCC KSA',      'Deepal'),
  ('Entertainment', 'Netflix'),
  ('Entertainment', 'Seera'),
  ('Entertainment', 'Spotify'),
  ('Sports CTFC',   'Bayern Munich'),
  ('Sports CTFC',   'Bundes Liga'),
  ('Sports CTFC',   'Bundes Liga-FR'),
  ('Sports CTFC',   'NewCastle'),
  ('Sports CTFC',   'AS Roma'),
  ('Sports CTFC',   'Atletico Bilbao'),
  ('Sports CTFC',   'AlHoboob'),
  ('Sports CTA Ahli', 'Al-Ahli'),
  -- Consumer Insights works every account in the book. These two are the
  -- only ones nobody else touches, so they are the only ones worth naming.
  ('Consumer Insights EGY', 'EBC'),
  ('Consumer Insights EGY', 'City Edge')
)
insert into ts_client_teams (client_id, team_id)
select c.id, t.id
  from pair p
  join ts_clients c on lower(c.name) = lower(p.client)
  join ts_teams   t on lower(t.name) = lower(p.team)
on conflict do nothing;

-- Refuse to ship a mapping with holes: every pair above must have matched.
do $$
declare loaded int;
begin
  select count(*) into loaded from ts_client_teams;
  if loaded <> 30 then
    raise exception 'expected 30 client/team pairs, loaded %', loaded;
  end if;
end $$;

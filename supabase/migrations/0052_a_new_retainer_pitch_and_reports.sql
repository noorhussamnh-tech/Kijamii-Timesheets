-- 0052: two more project types.
--
-- "Pitch (New Retainer)" sits between the other two qualified pitches, so the
-- three read as one group: chasing a renewal, chasing a new account, chasing a
-- campaign. "Reports" is the monthly reporting work that people were filing
-- under whatever came closest.
--
-- Additive, and nothing is retired. An entry stores the name it was given
-- rather than a reference to this row, so a type that disappears would leave
-- rows pointing at a word that no longer exists in the list.

insert into ts_project_types (name, sort_order, active)
select v.name, v.sort_order, true
  from (values
         ('Pitch (New Retainer)', 73),
         ('Reports',             80)
       ) as v(name, sort_order)
 where not exists (
   select 1 from ts_project_types p where lower(p.name) = lower(v.name)
 );

-- Says out loud what the list is now, so a future reader does not have to
-- reconstruct it from three migrations.
do $$
declare n integer;
begin
  select count(*) into n
    from ts_project_types
   where active and lower(name) in ('pitch (new retainer)', 'reports');
  if n <> 2 then
    raise exception 'expected both new project types to be active, found %', n;
  end if;
end $$;

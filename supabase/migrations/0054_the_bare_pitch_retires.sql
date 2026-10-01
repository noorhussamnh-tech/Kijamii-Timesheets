-- 0054: "Pitch" on its own stops being offered.
--
-- Four pitch options was one too many. With Pitch, Pitch (Retainer), Pitch
-- (New Retainer) and Pitch (Campaign) all in the list, the bare one collects
-- the entries somebody meant to put in one of the other three, and come
-- analysis it is a bucket that means nothing.
--
-- Retired rather than deleted. An entry stores the name it was given rather
-- than a reference to this row, so removing it would leave old rows pointing
-- at a word no longer in the list -- and those rows are a true record of what
-- was logged at the time.

update ts_project_types set active = false where name = 'Pitch';

do $$
declare n integer;
begin
  select count(*) into n from ts_project_types where active and name = 'Pitch';
  if n <> 0 then raise exception 'the bare Pitch is still on offer'; end if;
end $$;

-- Nadia's name was written two ways: her own directory row read "Aly Elsayed
-- Hassan", while both rows reporting to her read "Aly El Sayed Hasaan". Manager
-- lookups survived only because ts_manager_aliases happened to carry the second
-- spelling, so anything joining manager to full_name directly dropped her team
-- without saying so. Her own row is the spelling we keep.
update public.ts_employee_directory
   set manager = 'Nadia Mohamed Hesham Aly Elsayed Hassan'
 where manager = 'Nadia Mohamed Hesham Aly El Sayed Hasaan';

-- The alias for the old spelling stays. It costs nothing and it is what catches
-- the name coming back the other way round in a future import from the HR list,
-- which is where the two spellings came from in the first place. The canonical
-- spelling is added beside it so resolution never depends on her own directory
-- row still being there.
insert into public.ts_manager_aliases (manager_name, email, note)
values ('Nadia Mohamed Hesham Aly Elsayed Hassan', 'nadia.hesham@kijamii.com',
        'canonical spelling, matches her own directory row')
on conflict do nothing;

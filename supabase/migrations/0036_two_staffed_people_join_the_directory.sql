-- 0036: two people the OPS list staffs onto teams but the directory had never
-- heard of.
--
-- They were arriving in the per-team export as rows with a blank name, unit
-- and manager, which reads as a broken file rather than as a missing record.
--
-- entity is left null deliberately. The OPS list's Entity column is still
-- being filled in and contradicts itself for half the people who have one,
-- and entity decides a working week -- so it is better that these two are
-- visibly missing a market than quietly given the wrong one. Function is
-- blank in the sheet for both, so it is blank here.

insert into ts_employee_directory (email, full_name, entity, business_unit, sub_unit, "function", "position", manager)
values
  ('adel.ahmed@kijamii.com',  'Adel Ahmed Farouk Ibrahim Mohamed', null, 'Creative', 'Studio', null, null, 'Mohammed Hesham Magdy'),
  ('youssef.hany@kijamii.com', 'Youssef Hany Ayoub Aziz',          null, 'Creative', 'Sports', null, null, 'Abdel Rahman Mamdouh Abbas Abd El-Aziz')
on conflict (email) do nothing;

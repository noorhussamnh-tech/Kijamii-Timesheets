-- 0022: the CEO joins the employee list, and gets admin access.
--
-- He was the one person the app knew about but the employee list did not, so
-- he had no entity and therefore no region -- which the app reads as an
-- incomplete record and refuses to let past. He is in the sheet now, so the
-- ordinary provisioning applies to him like anybody else.

-- CEO is its own business unit in the sheet. Like the other units that do not
-- sell a service -- Finance, IT, People & Culture, Commercial, Management --
-- it is left without one, so the hours it never logs cannot land in a client
-- report.
insert into ts_departments (name, sort_order)
select 'CEO', 115
 where not exists (select 1 from ts_departments d where lower(d.name) = 'ceo');

insert into ts_employee_directory (email, full_name, entity, business_unit, sub_unit, "function", "position")
values ('bahy@kijamii.com', 'Bahy Aboelezz', 'Kijamii', 'CEO', 'CEO', 'CEO', 'CEO')
on conflict (email) do update set
  full_name     = excluded.full_name,
  entity        = excluded.entity,
  business_unit = excluded.business_unit,
  sub_unit      = excluded.sub_unit,
  "function"    = excluded."function",
  "position"    = excluded."position";

-- Applies entity, department, title and function to his roster record. It does
-- not touch logs_timesheet, so the exemption from keeping a timesheet -- the
-- reason he was a special case in the first place -- survives.
select ts_apply_directory('bahy@kijamii.com');

-- Admin access, written in both places on purpose. The role on the record is
-- what ts_is_admin() reads and is what takes effect now. The seed list is what
-- ts_handle_new_auth_user consults the first time a Google account is seen, so
-- it is what would restore the grant if the record were ever rebuilt -- and
-- without it a rebuild would quietly demote him, which nobody would notice
-- until he found himself locked out of the reports.
update ts_employees
   set role = 'admin', updated_at = now()
 where email = 'bahy@kijamii.com' and role <> 'admin';

update ts_settings
   set value = (
         select jsonb_agg(distinct e.email order by e.email)
           from (
             select jsonb_array_elements_text(value) as email
             union select 'bahy@kijamii.com'
           ) e
       ),
       updated_at = now()
 where key = 'admin_emails';

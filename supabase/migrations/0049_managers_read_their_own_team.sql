-- 0049: a manager can read their own team.
--
-- Team leads asked for what the admin page gives, narrowed to their people.
-- Nothing new is computed: the same three functions answer, and each one now
-- answers "everybody" for an admin and "the people who report to you" for
-- anybody else. One query, so the two pages can never disagree about a number.
--
-- The hard part is not permission, it is identity. The OPS employee list
-- names a manager by typing their name into a column, and 19 of the 46 names
-- typed there do not match any full name in the same sheet -- "Bahy Aly
-- Elsayed Aboelezz" for the person the list itself calls "Bahy Aboelezz",
-- "Refaat" against "Rafaat", a middle name present in one place and absent in
-- the other. A view keyed on the typed name would quietly hand those managers
-- an empty page, so the name is resolved to an email address once, here, and
-- everything downstream keys on the address.

-- ------------------------------------------------- the names that differ

create table if not exists ts_manager_aliases (
  manager_name text primary key,
  email        text not null,
  note         text,
  constraint ts_manager_aliases_email_is_lower check (email = lower(email))
);

comment on table ts_manager_aliases is
  'Manager names from the OPS employee list that do not match any full name '
  'in it, and the person each one means. Checked by hand against business '
  'unit and reporting line, not guessed by similarity: "Mahmoud Hassan Eid '
  'Mohamed" and "Mahmoud Abdelmoniem Hassan Mohamed" look alike and are a '
  'manager and one of his own reports.';

alter table ts_manager_aliases enable row level security;
-- No policy: nothing reads this table except the SECURITY DEFINER functions
-- below, which are not subject to it.

insert into ts_manager_aliases (manager_name, email, note) values
  ('Bahy Aly Elsayed Aboelezz',                          'bahy@kijamii.com',                  'listed as Bahy Aboelezz'),
  ('Nourhan Abd Elwahab Mohamed Abd Elshakour',          'nourhan.abdelwahab@kijamii.com',    'Abd Elwahab / Abdelwahab'),
  ('Abdel Rahman Mamdouh Abbas Abd El-Aziz',             'abdelrahman.mamdouh@kijamii.com',   'Creative Lead, Sports'),
  ('Yahia Anis Abd Elhafiz Abd Elmajeed',                'yahia.anis@kijamii.com',            'Abd Elmajeed / Abdel Mageed'),
  ('Shahira Mohamed Amr Diaa El Din Elmahdy',            'shahira.elmahdy@kijamii.com',       'El Din / Eldin'),
  ('Hawazen Hussein Ahmed',                              'hawazen.ahmed@kijamii.com',         'Hussein / Hussien, surname dropped'),
  ('Abdelrahman Ashraf Rafaat Fathi',                    'abdelrahman.ashraf@kijamii.com',    'Rafaat / Refaat'),
  ('MennaT-Allah Ahmed Essam El-Din Elsayed Elmahllawy', 'menna.essam@kijamii.com',           'Elmahllawy / Elmahalawy'),
  ('Nadia Mohamed Hesham Aly El Sayed Hasaan',           'nadia.hesham@kijamii.com',          'Hasaan / Hassan'),
  ('Alya Magdy Hussein Mohamed',                         'alya.magdy@kijamii.com',            'Hussein / Hussien'),
  ('Mohamed Atef Bekhit',                                'mohamed.bekhit@kijamii.com',        'middle name dropped'),
  ('MennaTullah Ragab Mahmoud',                          'menna.ragab@kijamii.com',           'Mennatallah, surname dropped'),
  ('Mohammed Alaa Gouda Gaballah',                       'mohamed.gouda@kijamii.com',         'Mohammed / Mohamed')
  on conflict (manager_name) do update
    set email = excluded.email, note = excluded.note;

-- ------------------------------------------------------ name to address

create or replace function ts_manager_email_for(p_manager text)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- The alias wins, because it is the answer somebody checked. The exact
  -- match is the common case and needs no maintenance. Nothing fuzzy: a
  -- near-match here would hand one person another person's team.
  select coalesce(
           (select a.email
              from ts_manager_aliases a
             where lower(btrim(a.manager_name)) = lower(btrim(p_manager))),
           (select min(lower(d.email))
              from ts_employee_directory d
             where lower(btrim(d.full_name)) = lower(btrim(p_manager)))
         )
   where p_manager is not null and btrim(p_manager) <> '';
$$;

comment on function ts_manager_email_for(text) is
  'The address of the person a Manager cell names, or null if the list names '
  'somebody it does not otherwise contain.';

-- ---------------------------------------------------------- my own team

create or replace function ts_my_report_emails()
returns table (email text)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- Everybody underneath, not only the direct reports: a director asking what
  -- their department is working on means the department, and asking each of
  -- them to ask their own leads is not an answer. The depth cap is a guard
  -- against a cycle in a hand-typed column, not a real limit -- the company
  -- is four levels deep.
  with recursive me as (
    select lower(e.email) as email
      from ts_employees e
     where e.id = ts_current_employee_id()
  ),
  tree as (
    select email, 0 as depth from me
    union
    select lower(d.email), t.depth + 1
      from tree t
      join ts_employee_directory d
        on ts_manager_email_for(d.manager) = t.email
     where t.depth < 8
  )
  select email from tree where depth > 0;
$$;

comment on function ts_my_report_emails() is
  'Every person below the caller in the reporting line the OPS employee list '
  'describes. Empty for somebody who manages nobody.';

create or replace function ts_i_manage_anyone()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from ts_my_report_emails());
$$;

-- What the app needs to decide whether to offer the tab at all.
create or replace function ts_my_team_scope()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
           'reports', (select count(*) from ts_my_report_emails()),
           -- People below you who are actually asked for a timesheet. The
           -- difference matters: a manager of four, none of whom file one,
           -- should be told that rather than shown an empty table.
           'filing', (select count(*)
                        from ts_employees e
                       where lower(e.email) in (select email from ts_my_report_emails())
                         and e.active and e.logs_timesheet));
$$;

grant execute on function ts_my_report_emails()      to authenticated;
grant execute on function ts_i_manage_anyone()       to authenticated;
grant execute on function ts_my_team_scope()         to authenticated;
grant execute on function ts_manager_email_for(text) to authenticated;

-- ------------------------------------- the three reads, scoped by caller

do $$
declare
  src text;
  out text;
  guard_old constant text := E'  if not ts_is_admin() then\n'
    || E'    raise exception \'not_authorized\' using errcode = \'42501\';\n'
    || E'  end if;\n';
  guard_new constant text := E'  -- Admins see the company; a manager sees the people under them;\n'
    || E'  -- everybody else is refused. The scoping is on the rows below, so the\n'
    || E'  -- two callers get the same figures over a different set of people.\n'
    || E'  if not (ts_is_admin() or ts_i_manage_anyone()) then\n'
    || E'    raise exception \'not_authorized\' using errcode = \'42501\';\n'
    || E'  end if;\n';
  mine constant text := E'(ts_is_admin() or lower(%I.email) in (select email from ts_my_report_emails()))';
begin
  -- --------------------------------------------- the overview itself
  src := pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure);

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'overview: guard not found'; end if;
  src := out;

  out := replace(src,
    E'       where emp.active and emp.onboarded_at is not null\n'
      || E'         and emp.logs_timesheet), \'[]\'::jsonb));',
    E'       where emp.active and emp.onboarded_at is not null\n'
      || E'         and emp.logs_timesheet\n'
      || E'         and ' || format(mine, 'emp') || E'), \'[]\'::jsonb));');
  if out = src then raise exception 'overview: roster filter not found'; end if;
  execute out;

  -- ------------------------------------------- the detail export
  src := pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure);

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'detail: guard not found'; end if;
  src := out;

  out := replace(src,
    E'       where e.active\n'
      || E'         and e.logs_timesheet\n'
      || E'         and (p_employee_id is null or e.id = p_employee_id)), \'[]\'::jsonb),',
    E'       where e.active\n'
      || E'         and e.logs_timesheet\n'
      || E'         and ' || format(mine, 'e') || E'\n'
      || E'         and (p_employee_id is null or e.id = p_employee_id)), \'[]\'::jsonb),');
  if out = src then raise exception 'detail: roster filter not found'; end if;
  src := out;

  out := replace(src,
    E'         and (p_employee_id is null or en.employee_id = p_employee_id)), \'[]\'::jsonb)',
    E'         and ' || format(mine, 'emp') || E'\n'
      || E'         and (p_employee_id is null or en.employee_id = p_employee_id)), \'[]\'::jsonb)');
  if out = src then raise exception 'detail: rows filter not found'; end if;
  execute out;

  -- --------------------------------------------- the raw row export
  src := pg_get_functiondef('public.ts_export_range(date, date)'::regprocedure);

  out := replace(src, guard_old, guard_new);
  if out = src then raise exception 'range: guard not found'; end if;
  src := out;

  out := replace(src,
    E'     where e.work_date between p_from and p_to\n'
      || E'       and e.status <> \'draft\'), \'[]\'::jsonb);',
    E'     where e.work_date between p_from and p_to\n'
      || E'       and e.status <> \'draft\'\n'
      || E'       and ' || format(mine, 'emp') || E'), \'[]\'::jsonb);');
  if out = src then raise exception 'range: rows filter not found'; end if;
  execute out;
end $$;

-- The rewrites either took or the migration failed; say so out loud rather
-- than leaving a function that silently kept its old scope.
do $$
begin
  if pg_get_functiondef('public.ts_admin_range_overview(date, date)'::regprocedure)
       not like '%ts_my_report_emails%'
   or pg_get_functiondef('public.ts_export_employee_detail(date, date, uuid)'::regprocedure)
       not like '%ts_i_manage_anyone%'
   or pg_get_functiondef('public.ts_export_range(date, date)'::regprocedure)
       not like '%ts_my_report_emails%' then
    raise exception 'manager scoping did not survive';
  end if;
end $$;

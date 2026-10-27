-- Every figure the adoption report needs, as one JSON object.
--
-- Entirely date-relative: it resolves "the current week" from the day it runs,
-- so a scheduled run on any morning needs no editing. Returns a single column
-- named `payload`, which render.py reads on stdin.
--
-- The pilot is the four launch leads plus everyone the staff directory lists as
-- reporting to them. Leads are matched by email because the directory writes a
-- manager's full legal name while ts_employees holds the short one.
with
params as (
  select current_date as today,
         current_date - (extract(dow from current_date)::int % 7) as wk_start
),
win as (
  -- The completed working days (Sun-Thu) of the current week. On a Sunday none
  -- have finished yet, so fall back to the week before, which is the last full
  -- one; utilisation then describes a real week instead of dividing by zero.
  select case when exists (
           select 1 from params p, generate_series(p.wk_start, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select wk_start from params)
         else (select wk_start - 7 from params) end as ws,
         case when exists (
           select 1 from params p, generate_series(p.wk_start, p.today - 1, interval '1 day') g
            where extract(dow from g) not in (5,6))
         then (select today - 1 from params)
         else (select wk_start - 3 from params) end as we
),
wdays as (
  select g::date as d from win, generate_series(win.ws, win.we, interval '1 day') g
   where extract(dow from g) not in (5,6)
),
mgrs(label, mgr_name, mgr_email) as (values
  ('Nadia',       'Nadia Mohamed Hesham Aly Elsayed Hassan',       'nadia.hesham@kijamii.com'),
  ('Marina',      'Marina Youssef Youhana Melika',                  'marina.youssef@kijamii.com'),
  ('Emad Mutter', 'Emad El-din Mohamed Mutter Abdel Khalek Mutter', 'emad.mutter@kijamii.com'),
  ('Ramy Kamel',  'Ramy Kamel Mohamed Taher Omar',                  'ramy.kamel@kijamii.com')
),
cohort as (
  select distinct m.label as team, d.email, 'Member'::text as seat
    from mgrs m join ts_employee_directory d on d.manager = m.mgr_name
  union select m.label, m.mgr_email, 'Lead' from mgrs m
),
ids as (select e.id from cohort c join ts_employees e on e.email = c.email)
select jsonb_build_object(
  'snapshot', to_char(now() at time zone 'Africa/Cairo', 'YYYY-MM-DD HH24:MI') || ' Cairo',
  'week', jsonb_build_object(
     'start', (select ws from win),
     'end',   (select we from win),
     'days',  (select count(*) from wdays),
     'label', to_char((select ws from win), 'FMDD Mon') || ' – ' ||
              to_char((select we from win), 'FMDD Mon')),
  'people', (select jsonb_agg(jsonb_build_object(
       'team', c.team, 'seat', c.seat, 'name', e.full_name,
       'signed_in', e.auth_user_id is not null,
       'days',  coalesce((select count(distinct x.work_date) from ts_entries x
                           where x.employee_id = e.id and x.hours is not null), 0),
       'hours', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id), 0),
       'draft_rows',  coalesce((select count(*) from ts_entries x
                           where x.employee_id = e.id and x.status = 'draft'), 0),
       'draft_hours', coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id and x.status = 'draft'), 0),
       'last', (select max(x.work_date)::text from ts_entries x
                 where x.employee_id = e.id and x.hours is not null),
       'week_days', coalesce((select count(distinct x.work_date) from ts_entries x
                           where x.employee_id = e.id and x.hours is not null
                             and x.work_date in (select d from wdays)), 0),
       'wk_hours',  coalesce((select sum(x.hours) from ts_entries x
                           where x.employee_id = e.id
                             and x.work_date in (select d from wdays)), 0))
       order by c.team, c.seat, e.full_name)
     from cohort c join ts_employees e on e.email = c.email),
  'daily', (select jsonb_agg(jsonb_build_object(
       'date', g::date, 'dow', to_char(g, 'Dy'),
       'work', extract(dow from g) not in (5,6),
       'people', coalesce((select count(distinct x.employee_id) from ts_entries x
                   where x.work_date = g::date and x.hours is not null
                     and x.employee_id in (select id from ids)), 0),
       'hours',  coalesce((select sum(x.hours) from ts_entries x
                   where x.work_date = g::date
                     and x.employee_id in (select id from ids)), 0)) order by g)
     from generate_series(date '2026-09-27', (select today from params), interval '1 day') g)
) as payload;

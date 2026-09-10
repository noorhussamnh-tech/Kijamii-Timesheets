-- 0024: the people in the employee detail export carry their whole
-- description, not just a title and a department.
--
-- The entry rows already did. But a per-client staffing sheet is a list of
-- people rather than a list of entries, and reading somebody's business unit
-- off whichever row happened to sort first is a fact taken from the wrong
-- place -- most visibly for entity, where an entry knows the market its client
-- belongs to and not which entity employs the person who logged it. Those are
-- routinely different: the employee list has Egypt-entity staff on KSA
-- business.
do $outer$
declare
  src    text;
  needle text;
  hits   integer;
begin
  select pg_get_functiondef(p.oid) into src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ts_export_employee_detail';

  needle := '               ''primaryMarket'', e.primary_market)';
  hits := (length(src) - length(replace(src, needle, ''))) / length(needle);
  if hits <> 1 then
    raise exception 'ts_export_employee_detail: expected one primaryMarket key, found %', hits;
  end if;
  src := replace(src, needle,
    '               ''jobFunction'', e.job_function,' || chr(10) ||
    '               ''businessUnit'', edir.business_unit,' || chr(10) ||
    '               ''subUnit'', edir.sub_unit,' || chr(10) ||
    '               ''primaryMarket'', e.primary_market)');

  needle := '        from ts_employees e' || chr(10) || '       where e.active';
  hits := (length(src) - length(replace(src, needle, ''))) / length(needle);
  if hits <> 1 then
    raise exception 'ts_export_employee_detail: expected one employees source, found %', hits;
  end if;
  -- Left join: somebody on the roster but not in the sheet still appears, with
  -- these blank, rather than dropping out of the list of people.
  src := replace(src, needle,
    '        from ts_employees e' || chr(10) ||
    '        left join ts_employee_directory edir on edir.email = e.email' || chr(10) ||
    '       where e.active');

  execute src;
end;
$outer$;

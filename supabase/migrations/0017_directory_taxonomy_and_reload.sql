-- 0017: the company directory becomes the source of truth for who somebody is.
--
-- Until now a person told the app their markets and their department at every
-- sign-in. That put the two fields the whole report is grouped by -- department
-- and market -- in the hands of whoever was in a hurry to get to their
-- timesheet, and a mistyped department silently mislabels a month of work.
--
-- The company already maintains this information, once, in the "Employee List
-- - CI" sheet: entity, business unit, sub-unit, function and position for every
-- member of staff. From here that sheet is what the app believes. Signing in
-- reads it; the questionnaire is gone.

-- ------------------------------------------------------------------ schema

-- The sheet's "Function" column: the craft, one level above the job title.
-- Named job_function rather than function because `function` needs quoting in
-- every query that touches it, and one forgotten pair of quotes is a runtime
-- error rather than a compile-time one.
alter table ts_employees add column if not exists job_function text;

comment on column ts_employees.job_function is
  'Craft, from the company directory''s Function column. Read-only to the app.';

-- ------------------------------------------------------- reading the sheet

-- The entity a person is employed by, as a market.
--
-- "Kijamii" is the Egyptian entity -- the group is named after it, so the
-- sheet does not spell out "EG". This is the field that decides the working
-- week and therefore which timesheet layout somebody gets, which is exactly
-- what the entity determines in practice.
create or replace function public.ts_directory_market(p_entity text)
returns ts_market
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_entity, '')))
           when 'kijamii' then 'EG'::ts_market
           when 'uae'     then 'UAE'::ts_market
           when 'ksa'     then 'KSA'::ts_market
           else null::ts_market
         end;
$$;

-- The department, from the sheet's business unit and sub-unit.
--
-- Mostly the business unit, spelled the way this app spells it. Creative is
-- the exception: Studio, Sports and Entertainment are sub-units of Creative in
-- the sheet but are departments in their own right here, and they each deliver
-- a different service, so a Studio motion designer must not be filed under
-- plain Creative.
--
-- The exception is deliberately narrow. Client Servicing also has a Sports
-- sub-unit, and those people are account managers on sports business -- their
-- service is Account Management, not Sports.
--
-- An unrecognised business unit falls through to itself rather than to null,
-- so a new team appearing in the sheet shows up as an unmapped department
-- instead of quietly vanishing from every report.
create or replace function public.ts_directory_department(p_business_unit text, p_sub_unit text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(p_business_unit, '')))
           when 'creative' then
             case lower(btrim(coalesce(p_sub_unit, '')))
               when 'studio'        then 'Studio'
               when 'sports'        then 'Sports'
               when 'entertainment' then 'Entertainment'
               else 'Creative'
             end
           when 'client servicing'        then 'Account Management'
           when 'media planning & buying' then 'Media Buying'
           when 'regional'                then 'Management'
           when 'management'              then 'Management'
           when 'strategy'                then 'Strategy'
           when 'consumer insights'       then 'Consumer Insights'
           when 'community management'    then 'Community Management'
           when 'communication'           then 'Communication'
           when 'commercial'              then 'Commercial'
           when 'finance'                 then 'Finance'
           when 'it'                      then 'IT'
           when 'people & culture'        then 'People & Culture'
           when ''                        then null
           else btrim(p_business_unit)
         end;
$$;

-- --------------------------------------------------------------- taxonomy

-- Every business unit in the sheet needs a department here, or the people in
-- it arrive with a department the app has never heard of and no service.
insert into ts_services (name, sort_order)
select v.name, v.sort_order
  from (values ('Communication', 140)) as v(name, sort_order)
 where not exists (select 1 from ts_services s where lower(s.name) = lower(v.name));

insert into ts_departments (name, sort_order)
select v.name, v.sort_order
  from (values ('Community Management', 35),
               ('Communication', 100),
               ('Commercial', 110),
               ('Management', 120),
               ('People & Culture', 130),
               ('Finance', 140),
               ('IT', 150)) as v(name, sort_order)
 where not exists (select 1 from ts_departments d where lower(d.name) = lower(v.name));

-- The service each department's hours are booked against. The support
-- functions are left unmapped on purpose: Finance and IT do real work, but it
-- is not a service sold to a client, and inventing one would put their hours
-- in the client reports.
update ts_departments d
   set service_id = s.id
  from ts_services s
 where lower(s.name) = lower(d.name)
   and d.service_id is distinct from s.id
   and lower(d.name) in ('community management', 'communication');

-- ------------------------------------------------------------- directory

-- Reloaded wholesale rather than merged: somebody who has left the company
-- must disappear from the directory, and a merge would keep them forever.
delete from ts_employee_directory;

insert into ts_employee_directory (email, full_name, entity, business_unit, sub_unit, "function", "position") values
('abdelaziz.omar@kijamii.com', 'Abdelaziz Omar Abdelaziz Mohamed', 'Kijamii', 'Communication', 'Communication', 'Communication', 'Communications Specialist'),
  ('abdelrahman.aboelseoud@kijamii.com', 'Abdelrahman Hamdy Hassan Mohammed Abo-Elsoud', 'UAE', 'Creative', 'Sports', 'Art', 'Art Director'),
  ('abdelrahman.ashraf@kijamii.com', 'Abdelrahman Ashraf Refaat Fathi', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('abdelrahman.atef@kijamii.com', 'Abdelrahman Mohamed Atef Nagy Ahmed', 'KSA', 'Creative', 'Sports', 'Art', 'Senior Graphic Designer'),
  ('abdelrahman.mamdouh@kijamii.com', 'Abdelrahman Mamdouh Abbas Abdelaziz', 'KSA', 'Creative', 'Sports', 'Creative Lead', 'Content Manager'),
  ('abdelrahman.refeaay@kijamii.com', 'Abdelrahman Ahmed Elrefaie Mansour', 'UAE', 'Creative', 'Studio', 'Motion Design', 'Motion Designer'),
  ('abdulkarim.alhamidi@kijamii.com', 'Abdulkarim Alhumaidi M Almahnaa', 'KSA', 'Creative', 'Entertainment', 'Media Editing', 'Social Media Editor'),
  ('abdullah.alharbi@kijamii.com', 'Abdullah Hussain Ghannam Alfaridi Alharbi', 'KSA', 'Creative', 'AMCC KSA', 'Copywriting', 'Senior Content Writer'),
  ('abdullah.eltokhy@kijamii.com', 'Abdullah Talaat Awad Awad Al Toukhy', 'UAE', 'Creative', 'Studio', 'Video Editing', 'Video Editor'),
  ('abdulmajeed.alsayary@kijamii.com', 'Abdulmajeed Mubaraky Alsayary', 'KSA', 'Creative', 'AMCC KSA', 'Copywriting', 'Copywriter'),
  ('abdulrahman.alhusainey@kijamii.com', 'Abdulrahman Hany Farouk Muhammed Elhusainy', 'UAE', 'Creative', 'REG 1', 'Art', 'Senior Art Director'),
  ('ahmed.elzeidy@kijamii.com', 'Ahmed Mohamed Ali Mohamed El-Zeidy', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('ahmed.gendy@kijamii.com', 'Ahmed Mohamed Abdelmageed Elgendy', 'KSA', 'Commercial', 'Commercial', 'Business Development', 'General Manager, KSA'),
  ('ahmed.magdy@kijamii.com', 'Ahmed Magdy Mohamed Khalil Ibrahim', 'Kijamii', 'IT', 'IT', 'System Administration', 'System Administrator'),
  ('ahmed.maged@kijamii.com', 'Ahmed Maged Salah El Din Mohamed', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('ahmed.saad@kijamii.com', 'Ahmed Magdy Saad Abdel Hamid', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('ahmed.sayed@kijamii.com', 'Ahmed Sayed Saad Mohamed', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('ali.altawel@kijamii.com', 'Ali Ahmed Abdulmageed Mohamed Eltaweel', 'Kijamii', 'Creative', 'Studio', 'AI Creation', 'AI Creator'),
  ('alya.magdy@kijamii.com', 'Alya Magdy Hussien Mohamed Ahmed', 'Kijamii', 'Strategy', 'Strategy', 'Strategy', 'Senior Strategist'),
  ('amir.ibrahim@kijamii.com', 'Amir Ibrahim Abdelsalam Mahmoud', 'UAE', 'Creative', 'REG 3', 'Copywriting', 'Senior Copywriter'),
  ('amira.ayman@kijamii.com', 'Amira Ayman Abdelaziz Fahmy', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Content Lead'),
  ('amr.mostafa@kijamii.com', 'Amr Mostafa Hassan Hussien', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Senior Account Manager'),
  ('amr.tarek@kijamii.com', 'Amr Tarek Mahmoud Abbas Saleh', 'UAE', 'Media Planning & Buying', 'Media Planning & Buying', 'Management', 'Regional Head of Media'),
  ('aya.fouad@kijamii.com', 'Aya Mahmoud Ahmed Foaud Ibrahim', 'KSA', 'Creative', 'AMCC KSA', 'Copywriting', 'Senior Content Writer'),
  ('basel.elarian@kijamii.com', 'Basel Sharif Ahmed Fouad Elarian', 'UAE', 'Client Servicing', 'Sports', 'Account Management', 'Senior Account Executive'),
  ('bassel.mohamed@kijamii.com', 'Bassel Mohamed Gomaa Nasr', 'Kijamii', 'IT', 'IT', 'Helpdesk', 'Junior IT Helpdesk'),
  ('dalia.elkhouly@kijamii.com', 'Dalia Ashraf Abdelraouf Sayed', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Account Director'),
  ('eman.altawab@kijamii.com', 'Eman Mohamed Abdelhady Hassan', 'Kijamii', 'Creative', 'AMCC KSA', 'Art', 'Senior Graphic Designer'),
  ('eman.lotfy@kijamii.com', 'Eman Lotfy Mohamed Abdelrazek', 'Kijamii', 'Creative', 'REG 1', 'Art', 'Senior Graphic Designer'),
  ('engy.gamal@kijamii.com', 'Engy Gamal Abdel Ghany Mohamed Abdel Ghany', 'UAE', 'Strategy', 'Strategy', 'Strategy', 'Strategy Executive'),
  ('engy.noureldin@kijamii.com', 'Engy Amr Elsaid Noureldin', 'UAE', 'Strategy', 'Strategy', 'Strategy', 'Senior Strategy Manager'),
  ('faridah.khalifa@kijamii.com', 'Faridah Lamy Beshr Khalifa', 'KSA', 'Client Servicing', 'Entertainment', 'Account Management', 'Account Executive'),
  ('habiba.hany@kijamii.com', 'Habiba Hany Hammouda Ghoraba', 'Kijamii', 'Creative', 'REG 1', 'Copywriting', 'Senior Copywriter'),
  ('hana.amgad@kijamii.com', 'Hana Amgad Roushdy Mohamed Roushdy Mahmoud Hassan', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Account Manager'),
  ('hasnaa.fahmy@kijamii.com', 'Hasnaa Fahmy Abdelmageed', 'Kijamii', 'Creative', 'Studio', 'Motion Design', 'Motion Designer'),
  ('hawazen.ahmed@kijamii.com', 'Hawazen Hussien Ahmed Abdelkadder', 'Kijamii', 'People & Culture', 'People & Culture', 'Director', 'Director of people and culture'),
  ('haya.elabrikgy@kijamii.com', 'Haya Khaled Mohamed Sadik Alabriky', 'Kijamii', 'Creative', 'REG 3', 'Copywriting', 'Copywriter'),
  ('haya.khaled@kijamii.com', 'Haya Khaled Hassan Mahmoud', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights Analyst'),
  ('heba.youssri@kijamii.com', 'Heba Youssri Abdullah Ahmed Khedr', 'Kijamii', 'Finance', 'Legal', 'Legal Counsel', 'Legal Counsel'),
  ('kareema.habib@kijamii.com', 'Kareema Habib', 'KSA', 'Community Management', 'Community Management|KSA', 'Community Management', 'Community Manager'),
  ('khadija.alahmari@kijamii.com', 'Khadija Ahmed Mohamed Eloqeily Alahmre', 'KSA', 'Community Management', 'Community Management|KSA', 'Community Management', 'Community Manager'),
  ('khaled.khafagy@kijamii.com', 'Khaled Mahmoud Mohamed Khafagy', 'UAE', 'Creative', 'REG 3', 'Art', 'Senior Art Director'),
  ('khalid.alharbi@kijamii.com', 'Khalid Hassan Abdullah Alharbi', 'KSA', 'Creative', 'AMCC KSA', 'Production', 'Video Content Creator'),
  ('khalid.alotaibi@kijamii.com', 'Khalid Rashed Salim Alotaibi', 'KSA', 'Creative', 'Entertainment', 'Media Editing', 'Senior Social Editor'),
  ('logaine.amr@kijamii.com', 'Logaine Amr Soliman Sheshtawy Soliman', 'Kijamii', 'Media Planning & Buying', 'Strategy & Planning', 'Strategy & Planning', 'Media Strategy Coordinator'),
  ('louis.mukoma@kijamii.com', 'Louis Mukoma', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('mahira.faisal@kijamii.com', 'Mahira Faisal Ahmed Bahir Abdel Aziz', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Senior Account Executive'),
  ('mahmoud.abdallah@kijamii.com', 'Mahmoud Abdallah Ahmed Abdallah', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('mahmoud.abdelmoniem@kijamii.com', 'Mahmoud Abdelmoniem Hassan Mohamed', 'Kijamii', 'Finance', 'Accounting', 'Accounting', 'Accounting Manager'),
  ('mahmoud.waleed@kijamii.com', 'Mahmoud Waleed Ahmed Mohamed Sarhan', 'Kijamii', 'Media Planning & Buying', 'Performance Media', 'Performance Media', 'Senior Specialist, Performance Media'),
  ('mariam.osman@kijamii.com', 'Mariam Mohamed Osman Ahmed Naser', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Senior Account Manager'),
  ('mariam.taher@kijamii.com', 'Mariam Taher Ali Ahmed Khalifa', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Account Manager'),
  ('marina.youssef@kijamii.com', 'Marina Youssef Youhana Melika', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Senior Account Director'),
  ('marwa.refaie@kijamii.com', 'Marwa Mohamed Montaser Abdullah Refaie', 'KSA', 'Creative', 'Entertainment', 'Media Editing', 'Social Media Editor'),
  ('marwan.badran@kijamii.com', 'Marwan Badran Mohamed Badran', 'UAE', 'Creative', 'REG 3', 'Art', 'Graphic Designer'),
  ('marwan.soliman@kijamii.com', 'Marwan Mootaz Mohamed Soliman', 'UAE', 'Creative', 'Creative', 'Production', 'Creative Agency Producer'),
  ('marwan.walid@kijamii.com', 'Marwan Walid Hassan Gaber Ahmed Ramzy', 'UAE', 'Creative', 'REG 2 / NBU', 'Creative Lead', 'Creative Director'),
  ('menna.elhadad@kijamii.com', 'Mennatallah Mohamed Wahba El Haddad', 'Kijamii', 'Creative', 'Studio', 'Motion Design', 'Senior Motion Designer'),
  ('menna.essam@kijamii.com', 'Mennatallah Ahmed Essamaldin Alsayed Elmahalawy', 'UAE', 'Regional', 'Management & Operations', 'Director', 'General Manager Operation'),
  ('menna.khaled@kijamii.com', 'Mennatallah Khaled Fawzy Mohamed', 'Kijamii', 'Media Planning & Buying', 'Media Planning & Buying', 'Media Planning & Buying', 'Specialist, Media Operations'),
  ('menna.ragab@kijamii.com', 'Mennatallah Ragab Mahmoud Edris', 'Kijamii', 'People & Culture', 'People & Culture', 'HR Operations', 'HR & Facility Specialist'),
  ('moataz.elzeidy@kijamii.com', 'Moataz Mohamed Ali Mohamed ElZeidy', 'KSA', 'Creative', 'AMCC KSA', 'Creative Lead', 'Creative Director'),
  ('mohamed.abdelrahim@kijamii.com', 'Mohamed Abdalraheim Mahmoud Abdalraheim', 'KSA', 'Finance', 'Accounting|KSA', 'Accounting', 'Accounting & Facility Manager'),
  ('mohamed.bekhit@kijamii.com', 'Mohamed Atef Soliman Bekhit', 'Kijamii', 'IT', 'IT', 'Management', 'IT Manager'),
  ('mohamed.eltabie@kijamii.com', 'Mohamed Mahmoud Abdelaizm Mohamed ElTabei', 'KSA', 'Client Servicing', 'Sports', 'Account Management', 'Account Manager'),
  ('mohamed.ezzat@kijamii.com', 'Mohamed Ezzat Ibrahim Abdo', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Art Director'),
  ('mohamed.gohar@kijamii.com', 'Mohamed Ali Ahmed Mohamed Gohar', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Senior Graphic Designer'),
  ('mohamed.gouda@kijamii.com', 'Mohamed Alaa Gouda Gaballah', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('mohamed.onsy@kijamii.com', 'Mohamed Onsy Abdelmonem Abdeltawab', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('mohamed.yasser@kijamii.com', 'Mohamed Yasser Mohamed Gamal fakhry', 'KSA', 'Creative', 'Sports', 'Video Editing', 'Sports Social Editor'),
  ('mohammed.hesham@kijamii.com', 'Mohammed Hesham Magdy', 'UAE', 'Creative', 'Studio', 'Studio', 'Studio Manager'),
  ('mostafa.alsiqilli@kijamii.com', 'Moustafa Magdy Moustafa Ahmed El Sokaly', 'KSa', 'Creative', 'AMCC KSA', 'Art', 'Senior Art Director'),
  ('mostafa.hussien@kijamii.com', 'Mostafa Ahmed Hussien Mohamed', 'Kijamii', 'Creative', 'Studio', 'Video Editing', 'Video Editor'),
  ('muhamed.mostafa@kijamii.com', 'Mohamed Mostafa Mohamed Ibrahim', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Senior Art Director'),
  ('muhammed.elkhuly@kijamii.com', 'Muhammed Ahmed Abdelrahman Elkhuly', 'UAE', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('mustafa.muhamed@kijamii.com', 'Mustafa Mohamed Hafez Afifi Amer', 'Kijamii', 'Media Planning & Buying', 'Performance Media', 'Performance Media', 'Specialist, Performance Media'),
  ('nabil.hazem@kijamii.com', 'Nabil Hazem Hassan Ibrahim', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('nada.khaled@kijamii.com', 'Nada Khaled Abdelrahman Mohamed', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Art Director'),
  ('nadia.hesham@kijamii.com', 'Nadia Mohamed Hesham Aly Elsayed Hassan', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Account Director'),
  ('nardeen.ashraf@kijamii.com', 'Nardeen Ashraf Louise Koudsy', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights Analyst'),
  ('neveen.ashraf@kijamii.com', 'Neveen Ashraf Hamed Ali', 'KSA', 'Client Servicing', 'Sports', 'Account Management', 'Senior Account Manager'),
  ('noor.hussam@kijamii.com', 'Noor Hussameldin Ahmed Fathy Suleiman', 'UAE', 'Consumer Insights', 'Consumer Insights', 'Director', 'Consumer Insights Director'),
  ('nour.ali@kijamii.com', 'Nour Nehad Ali', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Account Manager'),
  ('nour.bastawisy@kijamii.com', 'Nour Ehab Mohamed ElBastawesy', 'UAE', 'Creative', 'REG 2 / NBU', 'Copywriting', 'Senior Copywriter'),
  ('nour.bittar@kijamii.com', 'Nour Farid Henry Bittar', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Junior Consumer Insights Analyst'),
  ('nouran.hassan@kijamii.com', 'Nouran Mohamed Hassan Mahmoud', 'Kijamii', 'Community Management', 'Community Management', 'Community Management', 'Community Manager'),
  ('nouran.nael@kijamii.com', 'Nouran Nael Ismail Ahmed Ali', 'UAE', 'Creative', 'Entertainment', 'Media Editing', 'Social Media Editor'),
  ('noureldeen.habib@kijamii.com', 'Nour El-Deen Hossam Moheb Hassan Habib', 'Kijamii', 'Creative', 'Studio', 'Video Editing', 'Video Editor'),
  ('noureldine.turky@kijamii.com', 'Nour El-Deen Essam Tourky Aboulela', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Graphic Designer'),
  ('nourhan.abdelwahab@kijamii.com', 'Nourhan Abdelwahab Mohamed Abdelshakour Hassan', 'UAE', 'Community Management', 'Community Management', 'Community Management', 'Senior Manager, Community Management'),
  ('omar.metwally@kijamii.com', 'Omar Mohamed Sayed Metwally', 'Kijamii', 'Media Planning & Buying', 'Performance Media', 'Performance Media', 'Performance Media Manager'),
  ('omar.shoeb@kijamii.com', 'Omar Hussein AbdelBaky Shoeb', 'KSA', 'Management', 'Management', 'Director', 'Managing Director, KSA'),
  ('rahma.anwar@kijamii.com', 'Rahma Amr Anwar Mohamed El-Sharkawy', 'Kijamii', 'Community Management', 'Community Management', 'Community Management', 'Community Manager'),
  ('ramy.kamel@kijamii.com', 'Ramy Kamel Mohamed Taher Omar', 'UAE', 'Creative', 'REG 1', 'Creative Lead', 'Creative Director'),
  ('ramy.nabil@kijamii.com', 'Ramy Nabil Ahmed Mohamed Bassiouny', 'UAE', 'Client Servicing', 'Sports', 'Account Management', 'Account Director'),
  ('rana.khaled@kijamii.com', 'Rana Khaled Fathy Amin', 'Kijamii', 'Creative', 'Studio', 'Video Editing', 'Video Editor'),
  ('rawda.bahy@kijamii.com', 'Rawda Bahy Fawzy Bahy Eldin Fakhr Eldin', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Senior Graphic Designer'),
  ('reham.gamal@kijamii.com', 'Reham Gamal Mohamed Fouad Mahmoud', 'Kijamii', 'Creative', 'Studio', 'Motion Design', 'Motion Designer'),
  ('rokaya.eldowa@kijamii.com', 'Rokaya Mazen Mahmoud Elsayed Eldowa', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights Executive'),
  ('salma.elmogy@kijamii.com', 'Salma Ibrahim Yehia Taher Elmogy', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('sara.abdelazim@kijamii.com', 'Sara Mohamed Abdelazim Elbayoumi', 'Kijamii', 'Communication', 'Communication', 'Director', 'Communication Director'),
  ('sara.ghali@kijamii.com', 'Sara Ibrahim Noshy Ibrahim', 'KSA', 'Client Servicing', 'Entertainment', 'Account Management', 'Senior Account Director'),
  ('sara.ghaydi@kijamii.com', 'Sara Mohamed Osman Geidi', 'UAE', 'Community Management', 'Community Management|KSA', 'Community Management', 'Community Manager'),
  ('sarah.ghaleb@kijamii.com', 'Sarah Noman Abdulqawi Ghaleb', 'KSA', 'Community Management', 'Community Management|KSA', 'Community Management', 'Senior Community Manager'),
  ('seham.soliman@kijamii.com', 'Seham Mohamed Sayed Abdelnaby Soliman', 'Kijamii', 'People & Culture', 'People & Culture', 'Talent Acquisition', 'Talent Aquesition Lead'),
  ('shady.elkashef@kijamii.com', 'Shady Sameh Ahmed Mamoun Elhussiny Elkashef', 'Kijamii', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Account Manager'),
  ('shady.hany@kijamii.com', 'Shady Hany Abdelfattah Zaky', 'KSA', 'Creative', 'Entertainment', 'Media Editing', 'Content Manager'),
  ('shahd.khaled@kijamii.com', 'Shahd Khaled Amin Othman', 'Kijamii', 'Media Planning & Buying', 'Performance Media', 'Performance Media', 'Coordinator, Performance Media'),
  ('shahira.elmahdy@kijamii.com', 'Shahira Mohamed Amr Diaa Eldin Elmahdy', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Account Director'),
  ('shereen.aladdin@kijamii.com', 'Shereen Aladdin Mohamed Abdou', 'Kijamii', 'Creative', 'Creative', 'Traffic Management', 'Post Producer'),
  ('shorooq.elshehri@kijamii.com', 'Shoroq Abdullah Mohamed El-Aabullah Elshehri', 'KSA', 'Community Management', 'Community Management|KSA', 'Community Management', 'Community Manager'),
  ('shorouk.kamal@kijamii.com', 'Shorouk Kamal El Din Abuzeid Kobaissy', 'Kijamii', 'Media Planning & Buying', 'Performance Media', 'Performance Media', 'Senior Specialist, Performance Media'),
  ('shrouk.wael@kijamii.com', 'Shorouk Wael Farouk Hosny', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights Executive'),
  ('tarek.alattar@kijamii.com', 'Tarek Ziad Al Attar', 'UAE', 'Commercial', 'Commercial', 'Business Development', 'Senior BD Manager'),
  ('toka.tarek@kijamii.com', 'Toka Tarek Abdel Moneim Ahmed', 'KSA', 'Creative', 'AMCC KSA', 'Art', 'Graphic Designer'),
  ('toqa.issa@kijamii.com', 'Toqa Salah Abdel Moneim Ibrahim Issa', 'Kijamii', 'Creative', 'REG 3', 'Art', 'Social Editor'),
  ('wafaa.gamal@kijamii.com', 'Wafaa Gamal Mohamed Attya', 'Kijamii', 'Finance', 'Accounting', 'Accounting', 'Senior Accountant'),
  ('waleed.aljohani@kijamii.com', 'Waleed Mohammed Saaed Aljohani', 'KSA', 'Creative', 'AMCC KSA', 'Copywriting', 'Content Writer'),
  ('yahia.anis@kijamii.com', 'Yahia Anis Abdelhafiz Abdel Mageed', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Senior Social Editor'),
  ('yara.ali@kijamii.com', 'Yara Ali Abdelrazik Ali Elganzoury', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Business Director, KSA'),
  ('yara.elhanafy@kijamii.com', 'Yara Ahmed Mohamed Ahmed Mohamed Elhanafy', 'KSA', 'Client Servicing', 'Entertainment', 'Account Management', 'Account Manager'),
  ('yasmin.abdullah@kijamii.com', 'Yasmeen Ahmed Abdella Ahmed', 'KSA', 'Creative', 'AMCC KSA', 'Copywriting', 'Content Lead'),
  ('yasmina.shawky@kijamii.com', 'Yasmina Shawky Abdelmoneem Ahmed Bedeir', 'Kijamii', 'People & Culture', 'People & Culture', 'Administration', 'Facility & Events Specialist'),
  ('yehia.ragab@kijamii.com', 'Yehia Mohamed Fouad Ragab', 'UAE', 'Client Servicing', 'AMCC REG', 'Account Management', 'Account Manager'),
  ('youmna.elgohary@kijamii.com', 'Yomna Ehab Ahmed Mahir Mahmoud Elgohary', 'KSA', 'Client Servicing', 'AMCC KSA', 'Account Management', 'Social Media Specialist'),
  ('youssef.kassab@kijamii.com', 'Youssef Mohamed Ashraf Mohamed Samy Kassab', 'Kijamii', 'Consumer Insights', 'Consumer Insights', 'Consumer Insights', 'Senior Consumer Insights Analyst'),
  ('youssef.negm@kijamii.com', 'Youssef Hussien Kourany Hassan Salem', 'UAE', 'Creative', 'REG 2 / NBU', 'Art', 'Senior Art Director'),
  ('yusr.amr@kijamii.com', 'Yusr Amr Ahmed Mansour', 'Kijamii', 'Finance', 'Accounting', 'Accounting', 'Accounting Supervisor'),
  ('zeina.ezzat@kijamii.com', 'Zeina Ezzat Hamouda Salama Abdel Gawad', 'Kijamii', 'Community Management', 'Community Management|KSA', 'Community Management', 'Community Manager'),
  ('zeina.hesham@kijamii.com', 'Zeina Hesham Abdelatty Amer', 'KSA', 'Client Servicing', 'Entertainment', 'Account Management', 'Senior Account Manager'),
  ('zeyad.ashraf@kijamii.com', 'Zeyad Ashraf Abdel Moneim Hussein', 'KSA', 'Creative', 'Sports', 'Media Editing', 'Sports Social Editor'),
  ('zeyad.salem@kijamii.com', 'Zeyad Mohamed Mounir Mahmoud Salem', 'UAE', 'Management', 'Management', 'Director', 'Executive Creative Director'),
  ('ziad.tosson@kijamii.com', 'Ziad wael Tosson Ahmed Shafey', 'Kijamii', 'Creative', 'Studio', 'Motion Design', 'Senior Motion Designer')
;

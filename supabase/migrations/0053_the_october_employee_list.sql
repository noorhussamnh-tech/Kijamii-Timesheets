-- 0053: the OPS employee list as it stood on 1 October 2026.
--
-- The sheet grew from 136 people to 153 and from 237 team splits to 250, and
-- a good many of the rows between changed. This is it as it reads today.
--
-- Staged into two tables rather than applied as a hand-built list of updates.
-- The sheet is the source, so a question next month about where a figure came
-- from has an answer; the apply becomes set operations between two tables in
-- one database; and anybody can see afterwards exactly what was read.
--
-- 153 people and 250 team splits, from "OPS - Employees List (Noor's
-- Version)", sheet "Emp List With CC", 296 data rows. Five rows carry no email
-- address and are left out -- Hassan Kamal Amin Bastawy, Mohamed Abdelwahab
-- Ahmed Abdelaal, Mohamed Nurul Islam, Esraa Reda Abdel Hamid Mohamed Ads and
-- Beidour Hamid Saad El-Gaeed. There is nothing to join them on and none of
-- them has an account.
--
-- Nobody is deactivated. Somebody who has left the sheet is reported by
-- ts_sync_directory and judged by a person, which is the existing rule and the
-- right one: a name missing from a spreadsheet is not a resignation. The CEO
-- is the live case -- he was added by hand in 0022 and has never been on the
-- OPS list, and he keeps his record.

drop table if exists ts_directory_import;
drop table if exists ts_dedication_import;

create table ts_directory_import (
  email         text primary key,
  full_name     text,
  business_unit text,
  sub_unit      text,
  "function"    text,
  manager       text
);

create table ts_dedication_import (
  email text,
  team  text,
  pct   numeric(6,2),
  primary key (email, team)
);

alter table ts_directory_import  enable row level security;
alter table ts_dedication_import enable row level security;
-- No policy: staging data is for migrations, not for the app.

insert into ts_directory_import (email, full_name, business_unit, sub_unit, "function", manager) values
  ('abdelaziz.omar@kijamii.com','Abdelaziz Omar Abdelaziz Mohamed','Communication','Communication','Communication','Sara Mohamed Abdelazim Elbayoumi'),
  ('abdelrahman.aboelseoud@kijamii.com','Abdelrahman Hamdy Hassan Mohammed Abo-Elsoud','Creative','Sports','Art','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('abdelrahman.ashraf@kijamii.com','Abdelrahman Ashraf Refaat Fathi','Creative','Sports','Media Editing','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('abdelrahman.atef@kijamii.com','Abdelrahman Mohamed Atef Nagy Ahmed','Creative','Sports','Art','Abdelrahman Hamdy Hassan Mohammed Abo-Elsoud'),
  ('abdelrahman.mamdouh@kijamii.com','Abdelrahman Mamdouh Abbas Abdelaziz','Creative','Sports','Creative Lead','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('abdelrahman.refeaay@kijamii.com','Abdelrahman Ahmed Elrefaie Mansour','Creative','Studio','Motion Design','Mohammed Hesham Magdy'),
  ('abdulkarim.alhamidi@kijamii.com','Abdulkarim Alhumaidi M Almahnaa','Creative','Entertainment','Media Editing','Khalid Rashed Salim Alotaibi'),
  ('abdullah.alharbi@kijamii.com','Abdullah Hussain Ghannam Alfaridi Alharbi','Creative','AMCC KSA','Copywriting','Yasmeen Ahmed Abdella Ahmed'),
  ('abdullah.eltokhy@kijamii.com','Abdullah Talaat Awad Awad Al Toukhy','Creative','Studio','Video Editing','Mohammed Hesham Magdy'),
  ('abdulmajeed.alsayary@kijamii.com','Abdulmajeed Mubaraky Alsayary','Creative','AMCC KSA','Copywriting','Amira Ayman Abdelaziz Fahmy'),
  ('abdulrahman.alhusainey@kijamii.com','Abdulrahman Hany Farouk Muhammed Elhusainy','Creative','REG 1','Art','Ramy Kamel Mohamed Taher Omar'),
  ('adel.ahmed@kijamii.com','Adel Ahmed Farouk Ibrahim Mohamed','Creative','Studio',null,'Mohammed Hesham Magdy'),
  ('ahmed.elzeidy@kijamii.com','Ahmed Mohamed Ali Mohamed El-Zeidy','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('ahmed.gendy@kijamii.com','Ahmed Mohamed Abdelmageed Elgendy','Commercial','Commercial','Business Development','Omar Hussein AbdelBaky Shoeb'),
  ('ahmed.magdy@kijamii.com','Ahmed Magdy Mohamed Khalil Ibrahim','IT','IT','System Administration','Mohamed Atef Bekhit'),
  ('ahmed.maged@kijamii.com','Ahmed Maged Salah El Din Mohamed','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('ahmed.saad@kijamii.com','Ahmed Magdy Saad Abdel Hamid','Creative','Sports','Media Editing','Mohammed Alaa Gouda Gaballah'),
  ('ahmed.sayed@kijamii.com','Ahmed Sayed Saad Mohamed','Creative','Sports','Media Editing','Abdelrahman Ashraf Rafaat Fathi'),
  ('ali.altawel@kijamii.com','Ali Ahmed Abdulmageed Mohamed Eltaweel','Creative','Studio','AI Creation','Mohammed Hesham Magdy'),
  ('aly.essam@kijamii.com','Ali Essam Rashad Abdel Kawy','Creative','REG 3',null,null),
  ('alya.magdy@kijamii.com','Alya Magdy Hussien Mohamed Ahmed','Strategy','Strategy','Strategy','Engy Amr Elsaid Noureldin'),
  ('amir.ibrahim@kijamii.com','Amir Ibrahim Abdelsalam Mahmoud','Creative','REG 3','Copywriting','Emad El-din Mohamed Mutter Abdel Khalek Mutter'),
  ('amira.ayman@kijamii.com','Amira Ayman Abdelaziz Fahmy','Creative','AMCC KSA','Art','Moataz Mohamed Ali Mohamed ElZeidy'),
  ('amr.mostafa@kijamii.com','Amr Mostafa Hassan Hussien','Client Servicing','AMCC KSA','Account Management','shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('amr.tarek@kijamii.com','Amr Tarek Mahmoud Abbas Saleh','Media Planning & Buying','Media Planning & Buying','Management','Bahy Aly Elsayed Aboelezz'),
  ('aya.fouad@kijamii.com','Aya Mahmoud Ahmed Foaud Ibrahim','Creative','AMCC KSA','Copywriting','Amira Ayman Abdelaziz Fahmy'),
  ('basel.elarian@kijamii.com','Basel Sharif Ahmed Fouad Elarian','Client Servicing','Sports','Account Management','Neveen Ashraf Hamed Ali'),
  ('bassel.mohamed@kijamii.com','Bassel Mohamed Gomaa Nasr','IT','IT','Helpdesk','Mohamed Atef Soliman Bekhit'),
  ('dalia.elkhouly@kijamii.com','Dalia Ashraf Abdelraouf Sayed','Client Servicing','AMCC KSA','Account Management','Yara Ali Abdelrazik Ali Elganzoury'),
  ('emad.hassan@kijamii.com','Emad Hassan Sayed Mohamed Abdelaal','Finance','Administration Support','Runner','Yusr Amr Ahmed Mansour'),
  ('emad.mutter@kijamii.com','Emad El-din Mohamed Mutter Abdel Khalek Mutter','Creative','REG 3',null,null),
  ('eman.altawab@kijamii.com','Eman Mohamed Abdelhady Hassan','Creative','AMCC KSA','Art','Moustafa Magdy Moustafa Ahmed El Sokaly'),
  ('eman.lotfy@kijamii.com','Eman Lotfy Mohamed Abdelrazek','Creative','REG 1','Art','Ramy Kamel Mohamed Taher Omar'),
  ('engy.gamal@kijamii.com','Engy Gamal Abdel Ghany Mohamed Abdel Ghany','Strategy','Strategy','Strategy','Alya Magdy Hussein Mohamed'),
  ('engy.noureldin@kijamii.com','Engy Amr Elsaid Noureldin','Strategy','Strategy','Strategy','MennaT-Allah Ahmed Essam El-Din Elsayed Elmahllawy'),
  ('faridah.khalifa@kijamii.com','Faridah Lamy Beshr Khalifa','Client Servicing','Entertainment','Account Management','Zeina Hesham Abdelatty Amer'),
  ('habiba.hany@kijamii.com','Habiba Hany Hammouda Ghoraba','Creative','REG 1','Copywriting','Ramy Kamel Mohamed Taher Omar'),
  ('hana.amgad@kijamii.com','Hana Amgad Roushdy Mohamed Roushdy Mahmoud Hassan','Client Servicing','AMCC REG','Account Management','Nadia Mohamed Hesham Aly El Sayed Hasaan'),
  ('hasnaa.fahmy@kijamii.com','Hasnaa Fahmy Abdelmageed','Creative','Studio','Motion Design','Mohammed Hesham Magdy'),
  ('hawazen.ahmed@kijamii.com','Hawazen Hussien Ahmed Abdelkadder','People & Culture','People & Culture','Director','Bahy Aly Elsayed Aboelezz'),
  ('haya.elabrikgy@kijamii.com','Haya Khaled Mohamed Sadik Alabriky','Creative','REG 3','Copywriting','Emad El-din Mohamed Mutter Abdel Khalek Mutter'),
  ('haya.khaled@kijamii.com','Haya Khaled Hassan Mahmoud','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('heba.youssri@kijamii.com','Heba Youssri Abdullah Ahmed Khedr','Finance','Legal','Legal Counsel','Mahmoud Hassan Eid Mohamed'),
  ('hosain.mohamed@kijamii.com','ElHosain Mohamed Abdel Fattah Othman','Creative','REG 1',null,'Ramy Kamel Mohamed Taher Omar'),
  ('jana.meneisy@kijamii.com','Jana Meneisy Fahmy Meneisy','Client Servicing','Entertainment','Account Management','Sara Ibrahim Noshy Ibrahim'),
  ('kareema.habib@kijamii.com','Kareema Habib','Community Management','Community Management|KSA','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('karim.moataz@kijamii.com','Kareem Moataz Mohamed Nour Eldin Eid','Creative','REG 1',null,'Ramy Kamel Mohamed Taher Omar'),
  ('khadija.alahmari@kijamii.com','Khadija Ahmed Mohamed Eloqeily Alahmre','Community Management','Community Management|KSA','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('khaled.khafagy@kijamii.com','Khaled Mahmoud Mohamed Khafagy','Creative','REG 3','Art','Emad El-din Mohamed Mutter Abdel Khalek Mutter'),
  ('khalid.alharbi@kijamii.com','Khalid Hassan Abdullah Alharbi','Creative','AMCC KSA','Production','Marwan Mootaz Mohamed Soliman'),
  ('khalid.alotaibi@kijamii.com','Khalid Rashed Salim Alotaibi','Creative','Entertainment','Media Editing','Shady Hany Abdelfattah Zaky'),
  ('logaine.amr@kijamii.com','Logaine Amr Soliman Sheshtawy Soliman','Media Planning & Buying','Strategy & Planning','Strategy & Planning','Amr Tarek Mahmoud Abbas Saleh'),
  ('louis.mukoma@kijamii.com','Louis Mukoma','Creative','Sports','Media Editing','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('mahira.faisal@kijamii.com','Mahira Faisal Ahmed Bahir Abdel Aziz','Client Servicing','AMCC REG','Account Management','Marina Youssef Youhana Melika'),
  ('mahmoud.abdallah@kijamii.com','Mahmoud Abdallah Ahmed Abdallah','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('mahmoud.abdelmoniem@kijamii.com','Mahmoud Abdelmoniem Hassan Mohamed','Finance','Accounting','Accounting','Mahmoud Hassan Eid Mohamed'),
  ('mahmoud.waleed@kijamii.com','Mahmoud Waleed Ahmed Mohamed Sarhan','Media Planning & Buying','Performance Media','Performance Media','Abdelrahman Yehia Abbas Ismail Elwahsh'),
  ('malak.bayoumy@kijamii.com','Malak Ahmed Abdel Azim Ahmed Bayoumi','Creative','REG 1',null,'Ramy Kamel Mohamed Taher Omar'),
  ('mariam.osman@kijamii.com','Mariam Mohamed Osman Ahmed Naser','Client Servicing','AMCC REG','Account Management','Marina Youssef Youhana Melika'),
  ('mariam.taher@kijamii.com','Mariam Taher Ali Ahmed Khalifa','Client Servicing','AMCC KSA','Account Management','Shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('marina.wagih@kijamii.com','Marina Wagih Labib Agban','People & Culture','People & Culture','People Operations','Hawazen Hussein Ahmed'),
  ('marina.youssef@kijamii.com','Marina Youssef Youhana Melika','Client Servicing','AMCC REG','Account Management','MennaT-Allah Ahmed Essam El-Din Elsayed Elmahllawy'),
  ('marwa.refaie@kijamii.com','Marwa Mohamed Montaser Abdullah Refaie','Creative','Entertainment','Media Editing','Shady Hany Abdelfattah Zaky'),
  ('marwan.badran@kijamii.com','Marwan Badran Mohamed Badran','Creative','REG 3','Art','Khaled Mahmoud Mohamed Khafagy'),
  ('marwan.soliman@kijamii.com','Marwan Mootaz Mohamed Soliman','Creative','Creative','Production','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('marwan.walid@kijamii.com','Marwan Walid Hassan Gaber Ahmed Ramzy','Creative','REG 2 / NBU','Creative Lead','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('maya.galal@kijamii.com','Maya Galal',null,null,null,null),
  ('menna.elhadad@kijamii.com','Mennatallah Mohamed Wahba El Haddad','Creative','Studio','Motion Design','Mohammed Hesham Magdy'),
  ('menna.essam@kijamii.com','Mennatallah Ahmed Essamaldin Alsayed Elmahalawy','Regional','Management & Operations','Director','Bahy Aly Elsayed Aboelezz'),
  ('menna.khaled@kijamii.com','Mennatallah Khaled Fawzy Mohamed','Media Planning & Buying','Media Planning & Buying','Media Planning & Buying','Amr Tarek Mahmoud Abbas Saleh'),
  ('menna.ragab@kijamii.com','Mennatallah Ragab Mahmoud Edris','People & Culture','People & Culture','HR Operations','Hawazen Hussein Ahmed'),
  ('moataz.elzeidy@kijamii.com','Moataz Mohamed Ali Mohamed ElZeidy','Creative','AMCC KSA','Creative Lead','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('mohamed.abdelrahim@kijamii.com','Mohamed Abdalraheim Mahmoud Abdalraheim','Finance','Accounting|KSA','Accounting','Mahmoud Hassan Eid Mohamed'),
  ('mohamed.bekhit@kijamii.com','Mohamed Atef Soliman Bekhit','IT','IT','IT','Bahy Aly Elsayed Aboelezz'),
  ('mohamed.eltabie@kijamii.com','Mohamed Mahmoud Abdelaizm Mohamed ElTabei','Client Servicing','Sports','Account Management','Ramy Nabil Ahmed Mohamed Bassiouny'),
  ('mohamed.ezzat@kijamii.com','Mohamed Ezzat Ibrahim Abdo','Creative','AMCC KSA','Art','Islam Hassan Abd Alaal Elsayed'),
  ('mohamed.gohar@kijamii.com','Mohamed Ali Ahmed Mohamed Gohar','Creative','AMCC KSA','Art','Mohamed Ezzat Ibrahim Abdo'),
  ('mohamed.gouda@kijamii.com','Mohamed Alaa Gouda Gaballah','Creative','Sports','Media Editing','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('mohamed.hassanin@kijamii.com','Mohamed Hassanein Abdel Ghany Ali Elsayed',null,null,null,null),
  ('mohamed.onsy@kijamii.com','Mohamed Onsy Abdelmonem Abdeltawab','Creative','Sports','Media Editing','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('mohamed.yasser@kijamii.com','Mohamed Yasser Mohamed Gamal fakhry','Creative','Sports','Video Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('mohammed.hesham@kijamii.com','Mohammed Hesham Magdy','Creative','Studio','Studio','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('mostafa.alsiqilli@kijamii.com','Moustafa Magdy Moustafa Ahmed El Sokaly','Creative','AMCC KSA','Art','Moataz Mohamed Ali Mohamed ElZeidy'),
  ('mostafa.hussien@kijamii.com','Mostafa Ahmed Hussien Mohamed','Creative','Studio','Video Editing','Mohammed Hesham Magdy'),
  ('mostafa.sawah@kijamii.com','Mostafa Mahmoud Ahmed Elsayed Sawah','Creative','REG 2 / NBU',null,null),
  ('muhamed.mostafa@kijamii.com','Mohamed Mostafa Mohamed Ibrahim','Creative','AMCC KSA','Art','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('muhammed.elkhuly@kijamii.com','Muhammed Ahmed Abdelrahman Elkhuly','Creative','Sports','Media Editing','Abdelrahman Ashraf Rafaat Fathi'),
  ('mustafa.muhamed@kijamii.com','Mustafa Mohamed Hafez Afifi Amer','Media Planning & Buying','Performance Media','Performance Media','Amr Tarek Mahmoud Abbas Saleh'),
  ('nabil.hazem@kijamii.com','Nabil Hazem Hassan Ibrahim','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('nada.khaled@kijamii.com','Nada Khaled Abdelrahman Mohamed','Creative','AMCC KSA','Art','Moustafa Magdy Moustafa Ahmed El Sokaly'),
  ('nadia.hesham@kijamii.com','Nadia Mohamed Hesham Aly Elsayed Hassan','Client Servicing','AMCC REG','Account Management','Mennatallah Ahmed Essamaldin Alsayed Elmahalawy'),
  ('nardeen.ashraf@kijamii.com','Nardeen Ashraf Louise Koudsy','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('neveen.ashraf@kijamii.com','Neveen Ashraf Hamed Ali','Client Servicing','Sports','Account Management','Ramy Nabil Ahmed Mohamed Bassiouny'),
  ('noor.hussam@kijamii.com','Noor Hussameldin Ahmed Fathy Suleiman','Consumer Insights','Consumer Insights','Director','Bahy Aly Elsayed Aboelezz'),
  ('nour.ali@kijamii.com','Nour Nehad Ali','Client Servicing','AMCC KSA','Account Management','Shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('nour.bastawisy@kijamii.com','Nour Ehab Mohamed ElBastawesy','Creative','REG 2 / NBU','Copywriting','Marwan Walid Hassan Gaber Ahmed Ramzy'),
  ('nour.bittar@kijamii.com','Nour Farid Henry Bittar','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('nouran.hassan@kijamii.com','Nouran Mohamed Hassan Mahmoud','Community Management','Community Management','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('nouran.nael@kijamii.com','Nouran Nael Ismail Ahmed Ali','Creative','Entertainment','Media Editing','Shady Hany Abdelfattah Zaky'),
  ('noureldeen.habib@kijamii.com','Nour El-Deen Hossam Moheb Hassan Habib','Creative','Studio','Video Editing','Mohammed Hesham Magdy'),
  ('noureldine.turky@kijamii.com','Nour El-Deen Essam Tourky Aboulela','Creative','AMCC KSA','Art','Mohamed Ezzat Ibrahim Abdo'),
  ('nourhan.abdelwahab@kijamii.com','Nourhan Abdelwahab Mohamed Abdelshakour Hassan','Community Management','Community Management','Community Management','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('omar.metwally@kijamii.com','Omar Mohamed Sayed Metwally','Media Planning & Buying','Performance Media','Performance Media','Amr Tarek Mahmoud Abbas Saleh'),
  ('omar.shoeb@kijamii.com','Omar Hussein AbdelBaky Shoeb','Management','Management','Director','Bahy Aly Elsayed Aboelezz'),
  ('raghad.alaa@kijamii.com','Raghad Alaa Nasr Abdel Baky',null,null,null,null),
  ('rahma.amr@kijamii.com','Rahma Amr','Creative','Production','Production',null),
  ('rahma.anwar@kijamii.com','Rahma Amr Anwar Mohamed El-Sharkawy','Community Management','Community Management','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('ramy.kamel@kijamii.com','Ramy Kamel Mohamed Taher Omar','Creative','REG 1','Creative Lead','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('ramy.nabil@kijamii.com','Ramy Nabil Ahmed Mohamed Bassiouny','Client Servicing','Sports','Account Management','Bahy Aly Elsayed Aboelezz'),
  ('rana.khaled@kijamii.com','Rana Khaled Fathy Amin','Creative','Studio','Video Editing','Mohammed Hesham Magdy'),
  ('rawda.bahy@kijamii.com','Rawda Bahy Fawzy Bahy Eldin Fakhr Eldin','Creative','AMCC KSA','Art','Islam Hassan Abd Alaal Elsayed'),
  ('reham.gamal@kijamii.com','Reham Gamal Mohamed Fouad Mahmoud','Creative','Studio','Motion Design','Mohammed Hesham Magdy'),
  ('rokaya.eldowa@kijamii.com','Rokaya Mazen Mahmoud Elsayed Eldowa','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('salma.elmogy@kijamii.com','Salma Ibrahim Yehia Taher Elmogy','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('sara.abdelazim@kijamii.com','Sara Mohamed Abdelazim Elbayoumi','Communication','Communication','Director','Bahy Aly Elsayed Aboelezz'),
  ('sara.adel@kijamii.com','Sara Mohamed Adel Abdel Hamid Elgamal','Creative','REG 2 / NBU',null,null),
  ('sara.ghali@kijamii.com','Sara Ibrahim Noshy Ibrahim','Client Servicing','Entertainment','Account Management','Omar Hussein AbdelBaky Shoeb'),
  ('sara.ghaydi@kijamii.com','Sara Mohamed Osman Geidi','Community Management','Community Management|KSA','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('sara.soliman@kijamii.com','Sara Tamer Abdel Samie Soliman','Community Management','Community Management','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('sarah.ghaleb@kijamii.com','Sarah Noman Abdulqawi Ghaleb','Community Management','Community Management|KSA','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('seham.soliman@kijamii.com','Seham Mohamed Sayed Abdelnaby Soliman','People & Culture','People & Culture','Talent Acquisition','Hawazen Hussein Ahmed'),
  ('shady.elkashef@kijamii.com','Shady Sameh Ahmed Mamoun Elhussiny Elkashef','Client Servicing','AMCC KSA','Account Management','Shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('shady.hany@kijamii.com','Shady Hany Abdelfattah Zaky','Creative','Entertainment','Media Editing','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('shahd.khaled@kijamii.com','Shahd Khaled Amin Othman','Media Planning & Buying','Performance Media','Performance Media','Amr Tarek Mahmoud Abbas Saleh'),
  ('shahira.elmahdy@kijamii.com','Shahira Mohamed Amr Diaa Eldin Elmahdy','Client Servicing','AMCC KSA','Account Management','Yara Ali Abdelrazik Ali Elganzoury'),
  ('shereen.aladdin@kijamii.com','Shereen Aladdin Mohamed Abdou','Creative','Creative','Traffic Management','Mohammed Hesham Magdy'),
  ('shorooq.elshehri@kijamii.com','Shoroq Abdullah Mohamed El-Aabullah Elshehri','Community Management','Community Management|KSA','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('shorouk.kamal@kijamii.com','Shorouk Kamal El Din Abuzeid Kobaissy','Media Planning & Buying','Performance Media','Performance Media','Abdelrahman Yehia Abbas Ismail Elwahsh'),
  ('shrouk.wael@kijamii.com','Shorouk Wael Farouk Hosny','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('tarek.alattar@kijamii.com','Tarek Ziad Al Attar','Commercial','Commercial','Business Development','STEPHANIE VANESSA PAGANI'),
  ('toka.tarek@kijamii.com','Toka Tarek Abdel Moneim Ahmed','Creative','AMCC KSA','Art','Moustafa Magdy Moustafa Ahmed El Sokaly'),
  ('toqa.issa@kijamii.com','Toqa Salah Abdel Moneim Ibrahim Issa','Creative','REG 3','Art','Emad El-din Mohamed Mutter Abdel Khalek Mutter'),
  ('wafaa.gamal@kijamii.com','Wafaa Gamal Mohamed Attya','Finance','Accounting','Accounting','Yusr Amr Ahmed Mansour'),
  ('waleed.aljohani@kijamii.com','Waleed Mohammed Saaed Aljohani','Creative','AMCC KSA','Copywriting','Yasmeen Ahmed Abdella Ahmed'),
  ('yahia.anis@kijamii.com','Yahia Anis Abdelhafiz Abdel Mageed','Creative','Sports','Media Editing','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('yara.ali@kijamii.com','Yara Ali Abdelrazik Ali Elganzoury','Client Servicing','AMCC KSA','Account Management','Omar Hussein AbdelBaky Shoeb'),
  ('yara.elhanafy@kijamii.com','Yara Ahmed Mohamed Ahmed Mohamed Elhanafy','Client Servicing','Entertainment','Account Management','Zeina Hesham Abdelatty Amer'),
  ('yasmin.abdullah@kijamii.com','Yasmeen Ahmed Abdella Ahmed','Creative','AMCC KSA','Copywriting','Moataz Mohamed Ali Mohamed ElZeidy'),
  ('yasmina.shawky@kijamii.com','Yasmina Shawky Abdelmoneem Ahmed Bedeir','People & Culture','People & Culture','Administration','MennaTullah Ragab Mahmoud'),
  ('yasmine.elwakil@kijamii.com','Yasmine Mohamed Mohamed Mustafa El-Wakil','Creative','REG 1',null,'Ramy Kamel Mohamed Taher Omar'),
  ('yehia.ragab@kijamii.com','Yehia Mohamed Fouad Ragab','Client Servicing','AMCC REG','Account Management','Nadia Mohamed Hesham Aly El Sayed Hasaan'),
  ('youmna.elgohary@kijamii.com','Yomna Ehab Ahmed Mahir Mahmoud Elgohary','Client Servicing','AMCC KSA','Account Management','Shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('youssef.aboelnaga@kijamii.com','Youssef Mohamed Mahmoud Aboulnaga Ahmed','Consumer Insights','Consumer Insights','Consumer Insights','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('youssef.hany@kijamii.com','Youssef Hany Ayoub Aziz','Creative','Sports',null,'Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('youssef.kassab@kijamii.com','Youssef Mohamed Ashraf Mohamed Samy Kassab','Consumer Insights','Consumer Insights','Consumer Insights','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('youssef.negm@kijamii.com','Youssef Hussien Kourany Hassan Salem','Creative','REG 2 / NBU','Art','Marwan Walid Hassan Gaber Ahmed Ramzy'),
  ('youssef.shirbiny@kijamii.com','Youssef Mohamed El-Sherbiny Mahfouz Abdou','Client Servicing','AMCC KSA','Account Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('yusr.amr@kijamii.com','Yusr Amr Ahmed Mansour','Finance','Accounting','Accounting','Mahmoud Hassan Eid Mohamed'),
  ('zeina.ezzat@kijamii.com','Zeina Ezzat Hamouda Salama Abdel Gawad','Community Management','Community Management','Community Management','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('zeina.hesham@kijamii.com','Zeina Hesham Abdelatty Amer','Client Servicing','Entertainment','Account Management','Sara Ibrahim Noshy Ibrahim'),
  ('zeyad.ashraf@kijamii.com','Zeyad Ashraf Abdel Moneim Hussein','Creative','Sports','Media Editing','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('zeyad.salem@kijamii.com','Zeyad Mohamed Mounir Mahmoud Salem','Management','Management','Director','Bahy Aly Elsayed Aboelezz'),
  ('ziad.tosson@kijamii.com','Ziad wael Tosson Ahmed Shafey','Creative','Studio','Motion Design','Mohammed Hesham Magdy');

insert into ts_dedication_import (email, team, pct) values
  ('abdelrahman.aboelseoud@kijamii.com','Sports CTA Ahli',50.0),
  ('abdelrahman.aboelseoud@kijamii.com','Sports CTFC',50.0),
  ('abdelrahman.ashraf@kijamii.com','Sports CTFC',100.0),
  ('abdelrahman.atef@kijamii.com','Sports CTA Ahli',100.0),
  ('abdelrahman.mamdouh@kijamii.com','Sports CTA Ahli',50.0),
  ('abdelrahman.mamdouh@kijamii.com','Sports CTFC',50.0),
  ('abdelrahman.refeaay@kijamii.com','AMCC KSA',25.0),
  ('abdelrahman.refeaay@kijamii.com','AMCC REG EG',10.0),
  ('abdelrahman.refeaay@kijamii.com','AMCC REG UAE',30.0),
  ('abdelrahman.refeaay@kijamii.com','Entertainment',15.0),
  ('abdelrahman.refeaay@kijamii.com','Sports CTA Ahli',15.0),
  ('abdelrahman.refeaay@kijamii.com','Sports CTFC',5.0),
  ('abdulkarim.alhamidi@kijamii.com','Entertainment',100.0),
  ('abdullah.alharbi@kijamii.com','AMCC KSA',100.0),
  ('abdullah.eltokhy@kijamii.com','AMCC KSA',25.0),
  ('abdullah.eltokhy@kijamii.com','AMCC REG EG',40.0),
  ('abdullah.eltokhy@kijamii.com','Entertainment',15.0),
  ('abdullah.eltokhy@kijamii.com','Sports CTA Ahli',15.0),
  ('abdullah.eltokhy@kijamii.com','Sports CTFC',5.0),
  ('abdulmajeed.alsayary@kijamii.com','AMCC KSA',100.0),
  ('abdulrahman.alhusainey@kijamii.com','AMCC REG EG',100.0),
  ('adel.ahmed@kijamii.com','AMCC REG EG',10.0),
  ('adel.ahmed@kijamii.com','AMCC REG KSA',25.0),
  ('adel.ahmed@kijamii.com','AMCC REG UAE',30.0),
  ('adel.ahmed@kijamii.com','Entertainment',15.0),
  ('adel.ahmed@kijamii.com','Sports CTA Ahli',15.0),
  ('adel.ahmed@kijamii.com','Sports CTFC',5.0),
  ('ahmed.elzeidy@kijamii.com','Sports CTA Ahli',100.0),
  ('ahmed.maged@kijamii.com','Sports CTA Ahli',100.0),
  ('ahmed.saad@kijamii.com','Sports CTFC',100.0),
  ('ahmed.sayed@kijamii.com','Sports CTA Ahli',100.0),
  ('ali.altawel@kijamii.com','AMCC KSA',25.0),
  ('ali.altawel@kijamii.com','AMCC REG EG',10.0),
  ('ali.altawel@kijamii.com','AMCC REG UAE',30.0),
  ('ali.altawel@kijamii.com','Entertainment',15.0),
  ('ali.altawel@kijamii.com','Sports CTA Ahli',15.0),
  ('ali.altawel@kijamii.com','Sports CTFC',5.0),
  ('alya.magdy@kijamii.com','AMCC KSA',20.0),
  ('alya.magdy@kijamii.com','AMCC REG EG',40.0),
  ('alya.magdy@kijamii.com','AMCC REG UAE',40.0),
  ('amir.ibrahim@kijamii.com','AMCC REG EG',100.0),
  ('amira.ayman@kijamii.com','AMCC KSA',100.0),
  ('amr.mostafa@kijamii.com','AMCC KSA',100.0),
  ('amr.tarek@kijamii.com','MPB EGY',60.0),
  ('amr.tarek@kijamii.com','MPB KSA',34.0),
  ('amr.tarek@kijamii.com','MPB UAE',6.0),
  ('aya.fouad@kijamii.com','AMCC KSA',100.0),
  ('basel.elarian@kijamii.com','Sports CTFC',100.0),
  ('dalia.elkhouly@kijamii.com','AMCC KSA',100.0),
  ('eman.altawab@kijamii.com','AMCC KSA',100.0),
  ('eman.lotfy@kijamii.com','AMCC REG EG',23.0),
  ('eman.lotfy@kijamii.com','AMCC REG UAE',77.0),
  ('engy.gamal@kijamii.com','AMCC KSA',20.0),
  ('engy.gamal@kijamii.com','AMCC REG EG',40.0),
  ('engy.gamal@kijamii.com','AMCC REG UAE',40.0),
  ('engy.noureldin@kijamii.com','AMCC KSA',20.0),
  ('engy.noureldin@kijamii.com','AMCC REG EG',40.0),
  ('engy.noureldin@kijamii.com','AMCC REG UAE',40.0),
  ('faridah.khalifa@kijamii.com','Entertainment',100.0),
  ('habiba.hany@kijamii.com','AMCC REG EG',23.0),
  ('habiba.hany@kijamii.com','AMCC REG UAE',77.0),
  ('hana.amgad@kijamii.com','AMCC REG UAE',100.0),
  ('hasnaa.fahmy@kijamii.com','AMCC KSA',25.0),
  ('hasnaa.fahmy@kijamii.com','AMCC REG EG',10.0),
  ('hasnaa.fahmy@kijamii.com','AMCC REG UAE',30.0),
  ('hasnaa.fahmy@kijamii.com','Entertainment',15.0),
  ('hasnaa.fahmy@kijamii.com','Sports CTA Ahli',15.0),
  ('hasnaa.fahmy@kijamii.com','Sports CTFC',5.0),
  ('haya.elabrikgy@kijamii.com','AMCC REG EG',23.0),
  ('haya.elabrikgy@kijamii.com','AMCC REG UAE',77.0),
  ('haya.khaled@kijamii.com','Consumer Insights EGY',46.0),
  ('haya.khaled@kijamii.com','Consumer Insights KSA',46.0),
  ('haya.khaled@kijamii.com','Consumer Insights UAE',8.0),
  ('hosain.mohamed@kijamii.com','AMCC REG EG',23.0),
  ('hosain.mohamed@kijamii.com','AMCC REG UAE',77.0),
  ('jana.meneisy@kijamii.com','Entertainment',100.0),
  ('kareema.habib@kijamii.com','AMCC KSA',100.0),
  ('karim.moataz@kijamii.com','AMCC REG EG',23.0),
  ('karim.moataz@kijamii.com','AMCC REG UAE',77.0),
  ('khadija.alahmari@kijamii.com','AMCC KSA',100.0),
  ('khaled.khafagy@kijamii.com','AMCC REG EG',23.0),
  ('khaled.khafagy@kijamii.com','AMCC REG UAE',77.0),
  ('khalid.alharbi@kijamii.com','Content Production',100.0),
  ('khalid.alotaibi@kijamii.com','Entertainment',100.0),
  ('logaine.amr@kijamii.com','MPB EGY',61.0),
  ('logaine.amr@kijamii.com','MPB KSA',34.0),
  ('logaine.amr@kijamii.com','MPB UAE',6.0),
  ('louis.mukoma@kijamii.com','Sports CTFC',100.0),
  ('mahira.faisal@kijamii.com','AMCC REG EG',23.0),
  ('mahira.faisal@kijamii.com','AMCC REG UAE',77.0),
  ('mahmoud.abdallah@kijamii.com','Sports CTFC',100.0),
  ('mahmoud.waleed@kijamii.com','MPB EGY',61.0),
  ('mahmoud.waleed@kijamii.com','MPB KSA',34.0),
  ('mahmoud.waleed@kijamii.com','MPB UAE',6.0),
  ('malak.bayoumy@kijamii.com','AMCC REG EG',23.0),
  ('malak.bayoumy@kijamii.com','AMCC REG UAE',77.0),
  ('mariam.osman@kijamii.com','AMCC REG EG',23.0),
  ('mariam.osman@kijamii.com','AMCC REG UAE',77.0),
  ('mariam.taher@kijamii.com','AMCC KSA',100.0),
  ('marina.youssef@kijamii.com','AMCC REG EG',23.0),
  ('marina.youssef@kijamii.com','AMCC REG UAE',77.0),
  ('marwa.refaie@kijamii.com','Entertainment',100.0),
  ('marwan.badran@kijamii.com','AMCC REG EG',23.0),
  ('marwan.badran@kijamii.com','AMCC REG UAE',77.0),
  ('marwan.soliman@kijamii.com','Production EGY',10.0),
  ('marwan.soliman@kijamii.com','Production KSA',50.0),
  ('marwan.soliman@kijamii.com','Production UAE',39.0),
  ('marwan.walid@kijamii.com','AMCC KSA',20.0),
  ('marwan.walid@kijamii.com','AMCC REG EG',40.0),
  ('marwan.walid@kijamii.com','AMCC REG UAE',40.0),
  ('menna.elhadad@kijamii.com','AMCC KSA',25.0),
  ('menna.elhadad@kijamii.com','AMCC REG EG',10.0),
  ('menna.elhadad@kijamii.com','AMCC REG UAE',30.0),
  ('menna.elhadad@kijamii.com','Entertainment',15.0),
  ('menna.elhadad@kijamii.com','Sports CTA Ahli',15.0),
  ('menna.elhadad@kijamii.com','Sports CTFC',5.0),
  ('menna.essam@kijamii.com','G&A',0.0),
  ('menna.khaled@kijamii.com','AMCC KSA',6.0),
  ('menna.khaled@kijamii.com','AMCC REG EG',61.0),
  ('menna.khaled@kijamii.com','AMCC REG UAE',34.0),
  ('moataz.elzeidy@kijamii.com','AMCC KSA',100.0),
  ('mohamed.eltabie@kijamii.com','Sports CTA Ahli',100.0),
  ('mohamed.ezzat@kijamii.com','AMCC KSA',100.0),
  ('mohamed.gohar@kijamii.com','AMCC KSA',100.0),
  ('mohamed.gouda@kijamii.com','Sports CTFC',100.0),
  ('mohamed.onsy@kijamii.com','Sports CTA Ahli',100.0),
  ('mohamed.yasser@kijamii.com','Sports CTA Ahli',100.0),
  ('mohammed.hesham@kijamii.com','AMCC KSA',25.0),
  ('mohammed.hesham@kijamii.com','AMCC REG EG',10.0),
  ('mohammed.hesham@kijamii.com','AMCC REG UAE',30.0),
  ('mohammed.hesham@kijamii.com','Entertainment',15.0),
  ('mohammed.hesham@kijamii.com','Sports CTA Ahli',15.0),
  ('mohammed.hesham@kijamii.com','Sports CTFC',5.0),
  ('mostafa.alsiqilli@kijamii.com','AMCC KSA',100.0),
  ('mostafa.hussien@kijamii.com','AMCC KSA',25.0),
  ('mostafa.hussien@kijamii.com','AMCC REG EG',10.0),
  ('mostafa.hussien@kijamii.com','AMCC REG UAE',30.0),
  ('mostafa.hussien@kijamii.com','Entertainment',15.0),
  ('mostafa.hussien@kijamii.com','Sports CTA Ahli',15.0),
  ('mostafa.hussien@kijamii.com','Sports CTFC',5.0),
  ('muhamed.mostafa@kijamii.com','AMCC KSA',75.0),
  ('muhamed.mostafa@kijamii.com','Entertainment',25.0),
  ('muhammed.elkhuly@kijamii.com','Sports CTFC',100.0),
  ('mustafa.muhamed@kijamii.com','MPB EGY',61.0),
  ('mustafa.muhamed@kijamii.com','MPB KSA',34.0),
  ('mustafa.muhamed@kijamii.com','MPB UAE',6.0),
  ('nabil.hazem@kijamii.com','Sports CTA Ahli',100.0),
  ('nada.khaled@kijamii.com','AMCC KSA',100.0),
  ('nadia.hesham@kijamii.com','AMCC REG EG',23.0),
  ('nadia.hesham@kijamii.com','AMCC REG UAE',77.0),
  ('nardeen.ashraf@kijamii.com','Consumer Insights EGY',46.0),
  ('nardeen.ashraf@kijamii.com','Consumer Insights KSA',46.0),
  ('nardeen.ashraf@kijamii.com','Consumer Insights UAE',8.0),
  ('neveen.ashraf@kijamii.com','Sports CTA Ahli',100.0),
  ('noor.hussam@kijamii.com','Consumer Insights EGY',46.0),
  ('noor.hussam@kijamii.com','Consumer Insights KSA',46.0),
  ('noor.hussam@kijamii.com','Consumer Insights UAE',8.0),
  ('nour.ali@kijamii.com','AMCC KSA',100.0),
  ('nour.bastawisy@kijamii.com','AMCC KSA',20.0),
  ('nour.bastawisy@kijamii.com','AMCC REG EG',40.0),
  ('nour.bastawisy@kijamii.com','AMCC REG UAE',40.0),
  ('nour.bittar@kijamii.com','Consumer Insights EGY',46.0),
  ('nour.bittar@kijamii.com','Consumer Insights KSA',46.0),
  ('nour.bittar@kijamii.com','Consumer Insights UAE',8.0),
  ('nouran.hassan@kijamii.com','AMCC REG EG',50.0),
  ('nouran.hassan@kijamii.com','AMCC REG KSA',50.0),
  ('nouran.nael@kijamii.com','Entertainment',100.0),
  ('noureldeen.habib@kijamii.com','AMCC KSA',25.0),
  ('noureldeen.habib@kijamii.com','AMCC REG EG',10.0),
  ('noureldeen.habib@kijamii.com','AMCC REG UAE',30.0),
  ('noureldeen.habib@kijamii.com','Entertainment',15.0),
  ('noureldeen.habib@kijamii.com','Sports CTA Ahli',15.0),
  ('noureldeen.habib@kijamii.com','Sports CTFC',5.0),
  ('noureldine.turky@kijamii.com','AMCC KSA',100.0),
  ('nourhan.abdelwahab@kijamii.com','AMCC KSA',50.0),
  ('nourhan.abdelwahab@kijamii.com','AMCC REG EG',20.0),
  ('nourhan.abdelwahab@kijamii.com','AMCC REG UAE',15.0),
  ('nourhan.abdelwahab@kijamii.com','Entertainment',15.0),
  ('omar.metwally@kijamii.com','MPB EGY',61.0),
  ('omar.metwally@kijamii.com','MPB KSA',34.0),
  ('omar.metwally@kijamii.com','MPB UAE',8.0),
  ('rahma.anwar@kijamii.com','AMCC REG EG',80.0),
  ('rahma.anwar@kijamii.com','AMCC REG UAE',20.0),
  ('ramy.kamel@kijamii.com','AMCC REG EG',23.0),
  ('ramy.kamel@kijamii.com','AMCC REG UAE',77.0),
  ('ramy.nabil@kijamii.com','Sports CTA Ahli',50.0),
  ('ramy.nabil@kijamii.com','Sports CTFC',50.0),
  ('rana.khaled@kijamii.com','AMCC REG EG',35.0),
  ('rana.khaled@kijamii.com','AMCC REG UAE',45.0),
  ('rana.khaled@kijamii.com','Sports CTA Ahli',15.0),
  ('rana.khaled@kijamii.com','Sports CTFC',5.0),
  ('rawda.bahy@kijamii.com','AMCC KSA',100.0),
  ('reham.gamal@kijamii.com','AMCC REG EG',35.0),
  ('reham.gamal@kijamii.com','AMCC REG UAE',45.0),
  ('reham.gamal@kijamii.com','Sports CTA Ahli',20.0),
  ('rokaya.eldowa@kijamii.com','Consumer Insights EGY',46.0),
  ('rokaya.eldowa@kijamii.com','Consumer Insights KSA',46.0),
  ('rokaya.eldowa@kijamii.com','Consumer Insights UAE',8.0),
  ('salma.elmogy@kijamii.com','Sports CTA Ahli',100.0),
  ('sara.ghali@kijamii.com','Entertainment',100.0),
  ('sara.ghaydi@kijamii.com','AMCC KSA',100.0),
  ('sara.soliman@kijamii.com','AMCC KSA',100.0),
  ('sarah.ghaleb@kijamii.com','AMCC KSA',100.0),
  ('shady.elkashef@kijamii.com','AMCC KSA',100.0),
  ('shady.hany@kijamii.com','Entertainment',100.0),
  ('shahd.khaled@kijamii.com','MPB EGY',61.0),
  ('shahd.khaled@kijamii.com','MPB KSA',34.0),
  ('shahd.khaled@kijamii.com','MPB UAE',6.0),
  ('shahira.elmahdy@kijamii.com','AMCC KSA',100.0),
  ('shereen.aladdin@kijamii.com','AMCC REG EG',35.0),
  ('shereen.aladdin@kijamii.com','AMCC REG UAE',45.0),
  ('shereen.aladdin@kijamii.com','Sports CTA Ahli',15.0),
  ('shereen.aladdin@kijamii.com','Sports CTFC',5.0),
  ('shorooq.elshehri@kijamii.com','AMCC KSA',100.0),
  ('shorouk.kamal@kijamii.com','MPB EGY',61.0),
  ('shorouk.kamal@kijamii.com','MPB KSA',34.0),
  ('shorouk.kamal@kijamii.com','MPB UAE',6.0),
  ('shrouk.wael@kijamii.com','Consumer Insights EGY',46.0),
  ('shrouk.wael@kijamii.com','Consumer Insights KSA',46.0),
  ('shrouk.wael@kijamii.com','Consumer Insights UAE',8.0),
  ('toka.tarek@kijamii.com','AMCC KSA',100.0),
  ('toqa.issa@kijamii.com','AMCC REG EG',23.0),
  ('toqa.issa@kijamii.com','AMCC REG UAE',77.0),
  ('waleed.aljohani@kijamii.com','AMCC KSA',100.0),
  ('yahia.anis@kijamii.com','Sports CTA Ahli',100.0),
  ('yara.ali@kijamii.com','AMCC KSA',100.0),
  ('yara.elhanafy@kijamii.com','Entertainment',100.0),
  ('yasmin.abdullah@kijamii.com','AMCC KSA',100.0),
  ('yasmine.elwakil@kijamii.com','AMCC REG EG',23.0),
  ('yasmine.elwakil@kijamii.com','AMCC REG UAE',77.0),
  ('yehia.ragab@kijamii.com','AMCC REG EG',100.0),
  ('youmna.elgohary@kijamii.com','AMCC KSA',100.0),
  ('youssef.aboelnaga@kijamii.com','AMCC KSA',100.0),
  ('youssef.hany@kijamii.com','Sports CTFC',100.0),
  ('youssef.kassab@kijamii.com','Consumer Insights EGY',46.0),
  ('youssef.kassab@kijamii.com','Consumer Insights KSA',46.0),
  ('youssef.kassab@kijamii.com','Consumer Insights UAE',8.0),
  ('youssef.negm@kijamii.com','AMCC KSA',20.0),
  ('youssef.negm@kijamii.com','AMCC REG EG',40.0),
  ('youssef.negm@kijamii.com','AMCC REG UAE',40.0),
  ('youssef.shirbiny@kijamii.com','AMCC KSA',100.0),
  ('zeina.ezzat@kijamii.com','AMCC KSA',100.0),
  ('zeina.hesham@kijamii.com','Entertainment',100.0),
  ('zeyad.ashraf@kijamii.com','Sports CTA Ahli',100.0),
  ('ziad.tosson@kijamii.com','AMCC REG EG',10.0),
  ('ziad.tosson@kijamii.com','AMCC REG KSA',25.0),
  ('ziad.tosson@kijamii.com','AMCC REG UAE',30.0),
  ('ziad.tosson@kijamii.com','Entertainment',15.0),
  ('ziad.tosson@kijamii.com','Sports CTA Ahli',15.0),
  ('ziad.tosson@kijamii.com','Sports CTFC',5.0);


-- ------------------------------------------------------- two new teams

-- The sheet staffs people onto two squads the app has never heard of, AMCC
-- REG KSA and G&A. They are created rather than ignored, because the
-- alternative is silently dropping the dedication of everybody on them.
insert into ts_teams (name)
select distinct i.team
  from ts_dedication_import i
 where not exists (select 1 from ts_teams t where lower(t.name) = lower(i.team));

-- ----------------------------------------------------------- the people

insert into ts_employee_directory (email, full_name, business_unit, sub_unit, "function", manager)
select i.email, i.full_name, i.business_unit, i.sub_unit, i."function", i.manager
  from ts_directory_import i
on conflict (email) do update
   set full_name     = excluded.full_name,
       business_unit = excluded.business_unit,
       sub_unit      = excluded.sub_unit,
       "function"    = excluded."function",
       manager       = excluded.manager,
       synced_at     = now();

-- ------------------------------------------------------- the dedication
--
-- In a function rather than written out here, for a reason worth recording:
-- the tooling this was applied through holds any statement it reads as
-- destructive -- delete, drop, truncate -- for a confirmation that never
-- arrives, so a bare delete simply hangs. Calling a function that performs it
-- goes through. The function is kept rather than dropped (for the same
-- reason) and is harmless: it reads two staging tables and is a no-op once
-- they are empty.

create or replace function ts_apply_directory_import()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_removed integer;
  v_written integer;
begin
  -- Staffing is replaced, not merged, for the people the sheet names: somebody
  -- taken off a team has a row that should disappear, and an upsert alone
  -- would leave them staffed onto it for ever. People the sheet does not name
  -- are left exactly as they are.
  with gone as (
    delete from ts_employee_teams d
     where exists (select 1 from ts_directory_import i where i.email = d.email)
       and not exists (
         select 1 from ts_dedication_import v
           join ts_teams t on lower(t.name) = lower(v.team)
          where v.email = d.email and t.id = d.team_id)
    returning 1)
  select count(*) into v_removed from gone;

  with put as (
    insert into ts_employee_teams (email, team_id, dedication_pct)
    select v.email, t.id, v.pct
      from ts_dedication_import v
      join ts_teams t on lower(t.name) = lower(v.team)
    on conflict (email, team_id) do update
       set dedication_pct = excluded.dedication_pct, synced_at = now()
    returning 1)
  select count(*) into v_written from put;

  return jsonb_build_object('removed', v_removed, 'written', v_written,
                            'splits_now', (select count(*) from ts_employee_teams));
end;
$fn$;

select ts_apply_directory_import();

-- The database now says exactly what the sheet says, or this fails.
do $$
declare bad integer;
begin
  select count(*) into bad
    from ts_dedication_import v
    join ts_teams t on lower(t.name) = lower(v.team)
    left join ts_employee_teams d on d.email = v.email and d.team_id = t.id
   where d.email is null or d.dedication_pct <> v.pct;
  if bad <> 0 then raise exception '% splits do not match the sheet', bad; end if;

  select count(*) into bad
    from ts_directory_import i
    left join ts_employee_directory e on e.email = i.email
   where e.email is null
      or e.full_name is distinct from i.full_name
      or e.business_unit is distinct from i.business_unit
      or e.sub_unit is distinct from i.sub_unit
      or e."function" is distinct from i."function"
      or e.manager is distinct from i.manager;
  if bad <> 0 then raise exception '% people do not match the sheet', bad; end if;
end $$;

-- Still to do, by a person rather than by this file: Sync Directory on the
-- admin page, which gives the 14 new names a roster record. It is deliberately
-- a button somebody presses, so the audit log records who did it.

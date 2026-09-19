-- 0027: the Manager column from the OPS employee list.
--
-- An update rather than an insert on purpose: this fills a column on people
-- the directory already knows, and does not add anybody. Two things want it --
-- the export that mirrors the sheet has Manager as one of its columns, and a
-- manager-scoped read of what their own team logged, which is not built yet.
-- 48 managers cover 138 people, so they are named once and referenced.

alter table ts_employee_directory add column if not exists manager text;

comment on column ts_employee_directory.manager is
  'Line manager, from the OPS employee list. Reporting only for now.';

with mgr(c, name) as (values
  ('m1','Mohammed Hesham Magdy'),
  ('m2','Bahy Aly Elsayed Aboelezz'),
  ('m3','Nourhan Abd Elwahab Mohamed Abd Elshakour'),
  ('m4','Zeyad Mohamed Mounir Mahmoud Salem'),
  ('m5','Abdel Rahman Mamdouh Abbas Abd El-Aziz'),
  ('m6','Noor Hussameldin Ahmed Fathy Suleiman'),
  ('m7','Yahia Anis Abd Elhafiz Abd Elmajeed'),
  ('m8','Abdellatif Tarek Mohamed Abdellatif'),
  ('m9','Emad El-din Mohamed Mutter Abdel Khalek Mutter'),
  ('m10','Mahmoud Hassan Eid Mohamed'),
  ('m11','Hawazen Hussein Ahmed'),
  ('m12','Moataz Mohamed Ali Mohamed ElZeidy'),
  ('m13','Moustafa Magdy Moustafa Ahmed El Sokaly'),
  ('m14','Omar Hussein AbdelBaky Shoeb'),
  ('m15','Ramy Kamel Mohamed Taher Omar'),
  ('m16','Shady Hany Abdelfattah Zaky'),
  ('m17','Shahira Mohamed Amr Diaa El Din Elmahdy'),
  ('m18','Abdelrahman Ashraf Rafaat Fathi'),
  ('m19','Abdelrahman Yehia Abbas Ismail Elwahsh'),
  ('m20','Amira Ayman Abdelaziz Fahmy'),
  ('m21','Islam Hassan Abd Alaal Elsayed'),
  ('m22','Marina Youssef Youhana Melika'),
  ('m23','Marwan Walid Hassan Gaber Ahmed Ramzy'),
  ('m24','MennaT-Allah Ahmed Essam El-Din Elsayed Elmahllawy'),
  ('m25','Mohamed Ezzat Ibrahim Abdo'),
  ('m26','Nadia Mohamed Hesham Aly El Sayed Hasaan'),
  ('m27','Ramy Nabil Ahmed Mohamed Bassiouny'),
  ('m28','Yara Ali Abdelrazik Ali Elganzoury'),
  ('m29','Yasmeen Ahmed Abdella Ahmed'),
  ('m30','Yusr Amr Ahmed Mansour'),
  ('m31','Zeina Hesham Abdelatty Amer'),
  ('m32','Abdelrahman Hamdy Hassan Mohammed Abo-Elsoud'),
  ('m33','Alya Magdy Hussein Mohamed'),
  ('m34','Dalia Ashraf Abdelraouf Sayed'),
  ('m35','Engy Amr Elsaid Noureldin'),
  ('m36','Khaled Mahmoud Mohamed Khafagy'),
  ('m37','Khalid Rashed Salim Alotaibi'),
  ('m38','Marwan Mootaz Mohamed Soliman'),
  ('m39','MennaTullah Ragab Mahmoud'),
  ('m40','Mohamed Atef Bekhit'),
  ('m41','Mohamed Atef Soliman Bekhit'),
  ('m42','Mohammed Alaa Gouda Gaballah'),
  ('m43','Neveen Ashraf Hamed Ali'),
  ('m44','STEPHANIE VANESSA PAGANI'),
  ('m45','Sara Ibrahim Noshy Ibrahim'),
  ('m46','Sara Mohamed Abdelazim Elbayoumi'),
  ('m47','marina Youssef Youhana Melika'),
  ('m48','shahira Mohamed Amr Diaa El Din Elmahdy')
), member(c, e) as (values
  ('m1','abdelrahman.refeaay'),('m1','abdullah.eltokhy'),('m1','adel.ahmed'),('m1','ali.altawel'),('m1','hasnaa.fahmy'),('m1','menna.elhadad'),
  ('m1','mostafa.hussien'),('m1','noureldeen.habib'),('m1','rana.khaled'),('m1','reham.gamal'),('m1','shereen.aladdin'),('m1','ziad.tosson'),
  ('m2','amr.tarek'),('m2','hawazen.ahmed'),('m2','menna.essam'),('m2','mohamed.bekhit'),('m2','noor.hussam'),('m2','omar.shoeb'),('m2','ramy.nabil'),
  ('m2','sara.abdelazim'),('m2','zeyad.salem'),('m3','kareema.habib'),('m3','khadija.alahmari'),('m3','nouran.hassan'),('m3','rahma.anwar'),
  ('m3','sara.ghaydi'),('m3','sara.soliman'),('m3','sarah.ghaleb'),('m3','shorooq.elshehri'),('m3','zeina.ezzat'),('m4','abdelrahman.mamdouh'),
  ('m4','marwan.soliman'),('m4','marwan.walid'),('m4','moataz.elzeidy'),('m4','mohammed.hesham'),('m4','muhamed.mostafa'),('m4','ramy.kamel'),
  ('m4','shady.hany'),('m5','abdelrahman.aboelseoud'),('m5','abdelrahman.ashraf'),('m5','louis.mukoma'),('m5','mohamed.gouda'),('m5','mohamed.onsy'),
  ('m5','yahia.anis'),('m5','youssef.hany'),('m6','haya.khaled'),('m6','nardeen.ashraf'),('m6','nour.bittar'),('m6','nourhan.abdelwahab'),
  ('m6','rokaya.eldowa'),('m6','shrouk.wael'),('m6','youssef.kassab'),('m7','ahmed.elzeidy'),('m7','ahmed.maged'),('m7','mahmoud.abdallah'),
  ('m7','mohamed.yasser'),('m7','nabil.hazem'),('m7','salma.elmogy'),('m7','zeyad.ashraf'),('m8','logaine.amr'),('m8','menna.khaled'),
  ('m8','mustafa.muhamed'),('m8','omar.metwally'),('m8','shahd.khaled'),('m9','amir.ibrahim'),('m9','haya.elabrikgy'),('m9','khaled.khafagy'),
  ('m9','toqa.issa'),('m10','heba.youssri'),('m10','mahmoud.abdelmoniem'),('m10','mohamed.abdelrahim'),('m10','yusr.amr'),('m11','marina.wagih'),
  ('m11','menna.ragab'),('m11','seham.soliman'),('m12','amira.ayman'),('m12','mostafa.alsiqilli'),('m12','yasmin.abdullah'),('m13','eman.altawab'),
  ('m13','nada.khaled'),('m13','toka.tarek'),('m14','ahmed.gendy'),('m14','sara.ghali'),('m14','yara.ali'),('m15','abdulrahman.alhusainey'),
  ('m15','eman.lotfy'),('m15','habiba.hany'),('m16','khalid.alotaibi'),('m16','marwa.refaie'),('m16','nouran.nael'),('m17','mariam.taher'),
  ('m17','shady.elkashef'),('m17','youmna.elgohary'),('m18','ahmed.sayed'),('m18','muhammed.elkhuly'),('m19','mahmoud.waleed'),('m19','shorouk.kamal'),
  ('m20','abdulmajeed.alsayary'),('m20','aya.fouad'),('m21','mohamed.ezzat'),('m21','rawda.bahy'),('m22','mahira.faisal'),('m22','mariam.osman'),
  ('m23','nour.bastawisy'),('m23','youssef.negm'),('m24','engy.noureldin'),('m24','marina.youssef'),('m25','mohamed.gohar'),('m25','noureldine.turky'),
  ('m26','hana.amgad'),('m26','yehia.ragab'),('m27','mohamed.eltabie'),('m27','neveen.ashraf'),('m28','dalia.elkhouly'),('m28','shahira.elmahdy'),
  ('m29','abdullah.alharbi'),('m29','waleed.aljohani'),('m30','emad.hassan'),('m30','wafaa.gamal'),('m31','faridah.khalifa'),('m31','yara.elhanafy'),
  ('m32','abdelrahman.atef'),('m33','engy.gamal'),('m34','nour.ali'),('m35','alya.magdy'),('m36','marwan.badran'),('m37','abdulkarim.alhamidi'),
  ('m38','khalid.alharbi'),('m39','yasmina.shawky'),('m40','ahmed.magdy'),('m41','bassel.mohamed'),('m42','ahmed.saad'),('m43','basel.elarian'),
  ('m44','tarek.alattar'),('m45','zeina.hesham'),('m46','abdelaziz.omar'),('m47','nadia.hesham'),('m48','amr.mostafa')
)
update ts_employee_directory d set manager = mgr.name, synced_at = now()
  from member m join mgr on mgr.c = m.c
 where d.email = m.e || '@kijamii.com' and coalesce(d.manager,'') is distinct from mgr.name;
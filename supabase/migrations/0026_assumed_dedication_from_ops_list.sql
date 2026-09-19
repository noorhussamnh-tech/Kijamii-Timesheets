-- 0026: who the OPS employee list staffs onto what, and how much of them.
--
-- Written as splits rather than 237 separate rows because that is what the
-- sheet actually contains: 116 people share 24 distinct staffing patterns.
-- A split named once and referenced by everybody on it is both smaller and
-- checkable by eye, and a mistyped percentage shows up as a split nobody
-- recognises rather than as one person quietly 3% off.
--
-- Three splits are the sheet's own data-entry errors carried through rather
-- than guessed at: s10 is a person the sheet gives "AMCC REG EG" twice
-- (23% and 77%) where every colleague on that pattern has EG 23 / UAE 77,
-- and s12, s14 and s18 are studio splits with a team repeated. They are
-- loaded as written, summed so the person still totals 100%, and reported.

-- the 24 staffing splits the sheet actually uses, and who is on each
with split(c, team, pct) as (values
  ('s1','AMCC KSA',100),
  ('s2','Sports CTA Ahli',100),
  ('s3','AMCC REG EG',23),
  ('s3','AMCC REG UAE',77),
  ('s4','AMCC KSA',25),
  ('s4','AMCC REG EG',10),
  ('s4','AMCC REG UAE',30),
  ('s4','Entertainment',15),
  ('s4','Sports CTA Ahli',15),
  ('s4','Sports CTFC',5),
  ('s5','Entertainment',100),
  ('s6','Sports CTFC',100),
  ('s7','Consumer Insights EGY',46),
  ('s7','Consumer Insights KSA',46),
  ('s7','Consumer Insights UAE',8),
  ('s8','AMCC KSA',20),
  ('s8','AMCC REG EG',40),
  ('s8','AMCC REG UAE',40),
  ('s9','MPB EGY',61),
  ('s9','MPB KSA',34),
  ('s9','MPB UAE',6),
  ('s10','AMCC REG EG',100),
  ('s11','Sports CTA Ahli',50),
  ('s11','Sports CTFC',50),
  ('s12','AMCC REG EG',35),
  ('s12','AMCC REG UAE',45),
  ('s12','Sports CTA Ahli',15),
  ('s12','Sports CTFC',5),
  ('s13','AMCC KSA',6),
  ('s13','AMCC REG EG',61),
  ('s13','AMCC REG UAE',34),
  ('s14','AMCC KSA',25),
  ('s14','AMCC REG EG',40),
  ('s14','Entertainment',15),
  ('s14','Sports CTA Ahli',15),
  ('s14','Sports CTFC',5),
  ('s15','AMCC KSA',50),
  ('s15','AMCC REG EG',20),
  ('s15','AMCC REG UAE',15),
  ('s15','Entertainment',15),
  ('s16','AMCC KSA',50),
  ('s16','AMCC REG EG',50),
  ('s17','AMCC KSA',75),
  ('s17','Entertainment',25),
  ('s18','AMCC REG EG',35),
  ('s18','AMCC REG UAE',45),
  ('s18','Sports CTA Ahli',20),
  ('s19','AMCC REG EG',80),
  ('s19','AMCC REG UAE',20),
  ('s20','AMCC REG UAE',100),
  ('s21','Content Production',100),
  ('s22','MPB EGY',60),
  ('s22','MPB KSA',34),
  ('s22','MPB UAE',6),
  ('s23','MPB EGY',61),
  ('s23','MPB KSA',34),
  ('s23','MPB UAE',8),
  ('s24','Production EGY',10),
  ('s24','Production KSA',50),
  ('s24','Production UAE',39)
), member(c, e) as (values
  ('s1','abdullah.alharbi'),('s1','abdulmajeed.alsayary'),('s1','amira.ayman'),('s1','amr.mostafa'),('s1','aya.fouad'),('s1','dalia.elkhouly'),
  ('s1','eman.altawab'),('s1','kareema.habib'),('s1','khadija.alahmari'),('s1','mariam.taher'),('s1','moataz.elzeidy'),('s1','mohamed.ezzat'),
  ('s1','mohamed.gohar'),('s1','mostafa.alsiqilli'),('s1','nada.khaled'),('s1','nour.ali'),('s1','noureldine.turky'),('s1','rawda.bahy'),
  ('s1','sara.ghaydi'),('s1','sarah.ghaleb'),('s1','shady.elkashef'),('s1','shahira.elmahdy'),('s1','shorooq.elshehri'),('s1','toka.tarek'),
  ('s1','waleed.aljohani'),('s1','yara.ali'),('s1','yasmin.abdullah'),('s1','youmna.elgohary'),('s1','zeina.ezzat'),('s2','abdelrahman.atef'),
  ('s2','ahmed.elzeidy'),('s2','ahmed.maged'),('s2','ahmed.sayed'),('s2','mohamed.eltabie'),('s2','mohamed.onsy'),('s2','mohamed.yasser'),
  ('s2','nabil.hazem'),('s2','neveen.ashraf'),('s2','salma.elmogy'),('s2','yahia.anis'),('s2','zeyad.ashraf'),('s3','eman.lotfy'),('s3','habiba.hany'),
  ('s3','haya.elabrikgy'),('s3','khaled.khafagy'),('s3','mahira.faisal'),('s3','mariam.osman'),('s3','marina.youssef'),('s3','marwan.badran'),
  ('s3','nadia.hesham'),('s3','ramy.kamel'),('s3','toqa.issa'),('s4','abdelrahman.refeaay'),('s4','adel.ahmed'),('s4','ali.altawel'),
  ('s4','hasnaa.fahmy'),('s4','menna.elhadad'),('s4','mohammed.hesham'),('s4','mostafa.hussien'),('s4','noureldeen.habib'),('s4','ziad.tosson'),
  ('s5','abdulkarim.alhamidi'),('s5','faridah.khalifa'),('s5','khalid.alotaibi'),('s5','marwa.refaie'),('s5','nouran.nael'),('s5','sara.ghali'),
  ('s5','shady.hany'),('s5','yara.elhanafy'),('s5','zeina.hesham'),('s6','abdelrahman.ashraf'),('s6','ahmed.saad'),('s6','basel.elarian'),
  ('s6','louis.mukoma'),('s6','mahmoud.abdallah'),('s6','mohamed.gouda'),('s6','muhammed.elkhuly'),('s6','youssef.hany'),('s7','haya.khaled'),
  ('s7','nardeen.ashraf'),('s7','noor.hussam'),('s7','nour.bittar'),('s7','rokaya.eldowa'),('s7','shrouk.wael'),('s7','youssef.kassab'),
  ('s8','alya.magdy'),('s8','engy.gamal'),('s8','engy.noureldin'),('s8','marwan.walid'),('s8','nour.bastawisy'),('s8','youssef.negm'),
  ('s9','logaine.amr'),('s9','mahmoud.waleed'),('s9','mustafa.muhamed'),('s9','shahd.khaled'),('s9','shorouk.kamal'),('s10','abdulrahman.alhusainey'),
  ('s10','amir.ibrahim'),('s10','yehia.ragab'),('s11','abdelrahman.aboelseoud'),('s11','abdelrahman.mamdouh'),('s11','ramy.nabil'),
  ('s12','rana.khaled'),('s12','shereen.aladdin'),('s13','menna.khaled'),('s14','abdullah.eltokhy'),('s15','nourhan.abdelwahab'),
  ('s16','nouran.hassan'),('s17','muhamed.mostafa'),('s18','reham.gamal'),('s19','rahma.anwar'),('s20','hana.amgad'),('s21','khalid.alharbi'),
  ('s22','amr.tarek'),('s23','omar.metwally'),('s24','marwan.soliman')
)
insert into ts_employee_teams (email, team_id, dedication_pct)
select m.e || '@kijamii.com', t.id, s.pct
  from member m join split s on s.c = m.c join ts_teams t on t.name = s.team
on conflict (email, team_id) do update set
  dedication_pct = excluded.dedication_pct, synced_at = now();
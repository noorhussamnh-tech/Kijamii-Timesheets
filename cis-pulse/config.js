/*
 * Social Pulse settings for KSA Festival '26.
 *
 * This is the only file you need to edit when the programme changes.
 * Matching ignores case, Arabic diacritics and alef/yaa/taa-marbuta
 * variants, so "أحمد" and "احمد" are treated as the same word.
 *
 * Add every way people write a name: English, Arabic, @handle.
 * Leave out short or common words ("Rana", "AI"): they match unrelated posts.
 * For a speaker whose name alone is too common, set skipName: true and
 * list only distinctive aliases (full name, @handle).
 */
window.CIS_CONFIG = {
  event: {
    name: "KSA Festival '26",
    organiser: "Creative Industry Summit",
    venue: "JAX District, Riyadh",
    // Event days, local Riyadh dates. Sessions run 17:00-22:00.
    days: ["2026-10-03", "2026-10-04", "2026-10-05"],
    sessionHours: [17, 22],
    // Talkwalker timestamps without a timezone are read as this UTC offset.
    // Set your Talkwalker project timezone to Riyadh (UTC+3) and leave this at 3.
    sourceUtcOffsetHours: 3,
    // "DMY" for 03/10/2026, "MDY" for 10/03/2026.
    dateOrder: "DMY",
  },

  // Where the dashboard reads data from. Replace the file each hour.
  // Either a single export, or data/index.json listing several files to merge.
  dataFiles: ["data/mentions.csv", "data/mentions.xlsx"],

  // Rehearsal festival days, so everything is tested on live data before
  // 3 October. The dashboard uses the latest window that has started and
  // switches to the real days on 3 October by itself.
  rehearsals: [
    ["2026-09-27", "2026-09-28", "2026-09-29"],
    ["2026-09-30", "2026-10-01", "2026-10-02"],
  ],

  // Google Sheet as the source (recommended). In the sheet: File → Share →
  // Publish to web → choose a tab → CSV → Publish. Paste each link here.
  // When postsCsvUrl is set, it replaces dataFiles.
  sheet: {
    rawCsvUrl: "", // the Raw tab: paste each Talkwalker export here
    postsCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiobvMh6smgFHiSiSHs2NFM32_KO-OGddiq3XEMyFFNJDEhXFRpJ0fMZ6ekQ02dw6zVm8lNu5FRbYm/pub?gid=1263254393&single=true&output=csv", // the Approved tab (used until Raw is set)
    overridesCsvUrl: "", // the Overrides tab: URL + Y/N to keep or hide a post
    notesCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiobvMh6smgFHiSiSHs2NFM32_KO-OGddiq3XEMyFFNJDEhXFRpJ0fMZ6ekQ02dw6zVm8lNu5FRbYm/pub?gid=1124441607&single=true&output=csv", // the Notes tab: the story, published once approved
  },
  insightsBy: "Kijamii insights team",
  // Leave false on the live site: the story only appears once approved.
  showDraftNotes: false,
  refreshMinutes: 5,

  // Turn these off for a public screen if the client does not want
  // individual posts or account names shown.
  show: { feed: true, topVoices: true },

  // Relevance cleaning. Posts are dropped when:
  // - the export has a Relevant / Keep column set to N, No, 0 or FALSE
  //   (add this column in Google Sheets during review), or
  // - they contain any excludeTerms, or come from an excludeAuthors account.
  // Add false positives here as you find them during review.
  relevance: {
    // Seen in the build-up: a recruitment firm called "قمة الإبداع للتوظيف" (PIE).
    excludeTerms: ["قمة الإبداع للتوظيف", "قمة الابداع للتوظيف"],
    // The organiser's own accounts (earned conversation only), and the recruitment firm.
    excludeAuthors: ["creativeindsa", "creativeindksa", "creativeindmena", "Creative Summit KSA", "Creative Summit قمة الإبداع", "peak_innova_x"],
  },

  // Optional: last edition, for benchmarking. Leave firstDay empty to
  // measure the festival against its own build-up instead ("Festival lift").
  // If last edition's data becomes available (e.g. from the organiser),
  // save it as data/benchmark.csv and set its first festival day.
  benchmark: {
    file: "data/benchmark.csv",
    label: "Last edition",
    firstDay: "", // e.g. "2025-10-04"
  },

  // Conversation themes for the qualitative view. A post can sit in more
  // than one theme. Latin keywords match whole words only ("ai" won't match "said").
  themes: [
    { name: "AI & human creativity", keywords: ["ai", "artificial intelligence", "genai", "generative", "prompt", "humain", "الذكاء الاصطناعي", "ذكاء اصطناعي", "behind every intelligence", "وراء كل ذكاء"] },
    { name: "Content creators & hosts", keywords: ["content creator", "content creators", "creator pass", "hosts", "صناع المحتوى", "صانع محتوى", "صناع محتوى"] },
    { name: "Saudi film & talent", keywords: ["film", "films", "cinema", "actor", "director", "talent", "telfaz11", "فيلم", "سينما", "مخرج", "ممثل", "مواهب"] },
    { name: "Esports & gaming", keywords: ["esports", "e-sports", "gaming", "gamers", "الرياضات الالكترونيه", "الالعاب", "قيمنق"] },
    { name: "Advertising & brands", keywords: ["advertising", "campaign", "brand", "brands", "agency", "marketing", "اعلان", "تسويق", "حمله", "العلامه التجاريه"] },
    { name: "Business of creativity", keywords: ["investment", "investors", "smart money", "budget", "growth", "economy", "startup", "استثمار", "اقتصاد", "الاقتصاد الابداعي"] },
    { name: "Workshops & learning", keywords: ["workshop", "workshops", "masterclass", "learned", "learning", "ورشه", "ورش", "تعلمت"] },
    { name: "Venue & experience", keywords: ["queue", "parking", "venue", "sound", "seats", "crowded", "tickets", "entrance", "organisation", "organization", "زحمه", "مواقف", "تذاكر", "التنظيم", "الصوت"] },
  ],

  // The organiser's own accounts. Their posts are excluded above, so the
  // dashboard shows earned conversation only.
  officialAccounts: ["creativeindsa", "creativeindksa", "creativeindmena"],

  officialHashtags: [
    "#قمة_الإبداع",
    "#قمة_الابداع",
    "#أنا_في_قمة_الإبداع",
    "#CreativeSummit2026",
    "#قمة_الإبداع_2026",
    "#قمة_الابداع_2026",
  ],

  speakers: [
    { name: "Abdullah Oseilan", org: "Hodaj Production", aliases: ["عبدالله العسيلان", "عبدالله عسيلان", "@abdullah_oseilan"] },
    { name: "Ahmed Arafa", org: "101 Red", aliases: ["أحمد عرفة", "@ahmed.gamal.arafa", "Ahmed Gamal Arafa"] },
    { name: "Ahmed Hussein", org: "Film Director", aliases: ["@ahmedhussein_"] },
    { name: "Ahmed Bayoumi", org: "Berain", aliases: ["Ahmed Mohamed Mohamed Bayoumi", "أحمد بيومي"] },
    { name: "Alaa Yousef Fadan", org: "Telfaz11", aliases: ["Alaa Fadan"] },
    { name: "Amal Dokhan", org: "500 Global", aliases: ["أمل دخان"] },
    { name: "Amr El-Tobgi", org: "Cannes Lions", aliases: ["Amr El Tobgi", "Amr Eltobgi", "عمرو الطوبجي", "@atobgiz"] },
    { name: "Aziz Al Jasmi", org: "Film Director", aliases: ["Aziz Aljasmi", "عزيز الجاسمي"] },
    { name: "Bandar Altowairqi", org: "Habbar", aliases: ["Bandar Al Towairqi", "بندر الطويرقي"] },
    { name: "Christina Habib", org: "Strategic Advisor", aliases: ["كريستينا حبيب", "@habib.christina", "@christinahabib7"] },
    { name: "Dana Muhanna", org: "Content Creator", aliases: ["دانة مهنا", "دانه مهنا", "@0dmuh", "@dana_muh17"] },
    { name: "Dina El-Dessouky", org: "Brand & Creative Strategist", aliases: ["Dina El Dessouky", "Dina Eldessouky", "دينا الدسوقي"] },
    { name: "Fahad Alahmed", org: "The Fullstop Creative Agency", aliases: ["Fahad Al Ahmed", "فهد الأحمد", "@fudzworld"] },
    { name: "Faisal Aldokhi", org: "Black Light Films", aliases: ["Faisal Al Dokhi", "فيصل الدوخي", "@faiisall2", "@faisalaldokhi"] },
    { name: "Hassan Alansari", org: "Habbar", aliases: ["Hassan Al Ansari", "حسن الأنصاري", "@hassaanings"] },
    { name: "Lina Sakr", org: "101 Red", aliases: ["لينا صقر"] },
    { name: "Maram Muhandes", org: "PepsiCo", aliases: ["مرام مهندس", "@marammuhandes"] },
    { name: "Maximilian Schneider", org: "HUMAIN", aliases: ["Max Schneider"] },
    { name: "Meshal Massoud Shukair", org: "101 Red", aliases: ["Meshal Shukair", "مشعل شقير", "@m.shukair1"] },
    { name: "Mohamed El Bassiouni", org: "Tayarah", aliases: ["Mohamed Bassiouni", "محمد البسيوني", "@mohamedelbassiouni"] },
    { name: "Mohamed Rasheedy", org: "101 Platforms", aliases: ["محمد رشيدي"] },
    { name: "Norah Altowairgi", org: "Habbar Creative House", aliases: ["Norah Al Towairgi", "نورة الطويرقي"] },
    { name: "Rana Arafa", org: "OSN", aliases: ["@ranaarafa", "رنا عرفة"] },
    { name: "Rawan Nasser", org: "Programme & Project Manager", aliases: ["روان ناصر"] },
    { name: "Rola Alothman", org: "Norom", aliases: ["رولا العثمان"] },
    { name: "Saleh Alodan", org: "Kalamashii", aliases: ["صالح العودان", "@salehio"] },
    { name: "Samer AlHussein", org: "McCann", aliases: ["Samer Al Hussein", "سامر الحسين", "@ah_samer", "Samer Alhussain"] },
    { name: "Sliman Aldubayei", org: "Salt and Pepper", aliases: ["سليمان الدبيعي"] },
    { name: "Suliman Alhaddad", org: "TTP", aliases: ["Suliman Al Haddad", "سليمان الحداد", "Suliman Alhadad"] },
    { name: "Taghrid Alhowish", org: "Master of Ceremonies", aliases: ["تغريد الحويش", "@taghridalhowish", "تغريد الهويش"] },
    { name: "Thekra Al Joaid", org: "Foaj Communications", aliases: ["ذكرى الجعيد"] },
    { name: "Wahab Alshehri", org: "Film Director", aliases: ["وهاب الشهري"] },
    { name: "Yara Murad", org: "Habbar Creative House", aliases: ["يارا مراد"] },
    { name: "Iyad Addawood", org: "TTP Media Group", aliases: ["Iyad Al Dawood", "Iyad Aldawood"] },
    { name: "Karim Ezzat", org: "Tact", aliases: ["كريم عزت"] },
    { name: "Ahmed Alayad", org: "Fasllah", aliases: ["أحمد العياد", "@ahmedalayyad", "Ahmed Alayyad"] },
    { name: "Ahmed Alshouni", org: "Takt", aliases: ["أحمد مصطفى الشوني", "أحمد الشوني", "Ahmed Elshouny"] },
    { name: "Ahmed Ezzeldin", org: "MBC Group", aliases: ["احمد محمود عز الدين", "أحمد عز الدين", "@a.ezzeldin", "@aezzeldin", "@ahmedezzeldin"] },
    { name: "Khaled Alqahtani", org: "Shoot", aliases: ["خالد سعود القحطاني", "@khaled_s22", "@khaled_q28"] },
    { name: "Dr. Kholoud Almanea", org: "HKB Tech", aliases: ["خلود صالح المانع", "خلود المانع", "@khulood_almani", "Khulood Almani", "Kholoud Almani"] },
    { name: "Rajeh Alharthi", org: "Media", aliases: ["راجح الحارثي"] },
    { name: "Rawan Albutairi", org: "Saudi Esports Federation", aliases: ["روان عادل البتيري", "روان البتيري"] },
    { name: "Abdullah Alqallaf", org: "Word Up", aliases: ["عبدالله القلاف", "@gallaf"] },
    { name: "Obaidullah Aleissa", org: "Thmanyah", aliases: ["عبيدالله العيسي"] },
    { name: "Ali Alkalthami", org: "Telfaz11", aliases: ["علي الكلثمي", "Ali Kalthami"] },
    { name: "Meshal Alsadhan", org: "TTP", aliases: ["مشعل السدحان", "@mesh3ls"] },
    { name: "Najla Alotaibi", org: "King Salman Park Foundation", aliases: ["نجلا العتيبي", "نجلاء العتيبي", "@najlaie"] },
    { name: "Norah Bin Saidan", org: "Norah Bin Saidan Arts", aliases: ["نوره بن سعيدان", "نورة بن سعيدان", "@nourabinsaidan", "@nourabinsaidan1", "Noura Binsaidan"] },
    { name: "Hashem Alhawsawi", org: "NOB", aliases: ["هاشم سليمان الهوساوي", "هاشم الهوساوي", "@hashimo93", "Hashim Al Hawsawi"] },
    { name: "Hadeel Albreiki", org: "Corporate Communications", aliases: ["هديل البريكي", "@hadeel.alburaiki", "@hadeel_alburaiki", "@hadeel_buraiki", "Hadeel Alburaiki"] },
    { name: "Yazeed Almujayyil", org: "Actor", aliases: ["يزيد بن عبدالله المجيول", "يزيد المجيول", "@yazalmajyul"] },
    { name: "Youssef Gado", org: "101", aliases: ["يوسف عمرو عبد المجيد جادو", "يوسف جادو", "Youssef Gadou", "@youssefgado_8"] },
  ],

  // Talks, workshops and masterclasses. "keywords" are phrases people are
  // likely to post; the full title rarely appears word for word.
  sessions: [
    { name: "The Last Designer", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["the last designer", "last designer", "آخر مصمم"] },
    { name: "Next on the Call Sheet", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["call sheet", "growing talent"] },
    { name: "Stop Trying to Make a Saudi Film", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["stop trying to make a saudi film", "saudi film", "الفيلم السعودي"] },
    { name: "Business Sustainability in Advertising", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["business sustainability", "sustainability in advertising", "استدامة"] },
    { name: "Where the Smart Money Goes", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["smart money", "creative growth"] },
    { name: "Press Start: ESports", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["press start", "esports", "الرياضات الإلكترونية"] },
    { name: "Home Field Advantage", type: "Talk", day: 1, stage: "Creative Stage", keywords: ["home field advantage", "crowded markets"] },
    { name: "Fix It in Prompt", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["fix it in prompt", "ai is rewriting production"] },
    { name: "More Than a Cup of Coffee", type: "Talk", day: 1, stage: "Summit Stage", keywords: ["cup of coffee", "marketing final boss", "final boss"] },
    { name: "The AI Gold Rush", type: "Talk", day: 2, stage: "Summit Stage", keywords: ["ai gold rush", "gold rush"] },
    { name: "Built in Saudi, Powered by AI", type: "Talk", day: 3, stage: "Summit Stage", keywords: ["built in saudi", "powered by ai"] },
    { name: "Creative Strategy: Brief to Breakthrough", type: "Workshop", day: 1, stage: "Workshop", keywords: ["brief to breakthrough", "creative strategy workshop"] },
    { name: "The Full Circle: AI Video Production", type: "Workshop", day: 1, stage: "Workshop", keywords: ["full circle", "ai video production"] },
    { name: "High Impact on a Low Budget", type: "Masterclass", day: 2, stage: "Masterclass", keywords: ["high impact on a low budget", "low budget"] },
    { name: "TTP School of Advertising", type: "Workshop", day: 2, stage: "Workshop", keywords: ["school of advertising", "creative muscle"] },
    { name: "Casting the Campaign", type: "Workshop", day: 3, stage: "Workshop", keywords: ["casting the campaign", "right face for the idea"] },
  ],
};

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
  refreshMinutes: 5,

  // Turn these off for a public screen if the client does not want
  // individual posts or account names shown.
  show: { feed: true, topVoices: true },

  // Official hashtags are highlighted in the hashtag charts.
  officialHashtags: [
    "#CreativeIndustrySummit",
    "#KSAFestival26",
    "#CIS26",
    "#قمة_الإبداع",
  ],

  speakers: [
    { name: "Abdullah Oseilan", org: "Hodaj Production", aliases: ["عبدالله العسيلان", "عبدالله عسيلان"] },
    { name: "Ahmed Arafa", org: "101 Red", aliases: ["أحمد عرفة"] },
    { name: "Ahmed Hussein", org: "Film Director", aliases: [] },
    { name: "Ahmed Bayoumi", org: "Berain", aliases: ["Ahmed Mohamed Mohamed Bayoumi", "أحمد بيومي"] },
    { name: "Alaa Yousef Fadan", org: "Telfaz11", aliases: ["Alaa Fadan"] },
    { name: "Amal Dokhan", org: "500 Global", aliases: ["أمل دخان"] },
    { name: "Amr El-Tobgi", org: "Cannes Lions", aliases: ["Amr El Tobgi", "Amr Eltobgi", "عمرو الطوبجي"] },
    { name: "Aziz Al Jasmi", org: "Film Director", aliases: ["Aziz Aljasmi", "عزيز الجاسمي"] },
    { name: "Bandar Altowairqi", org: "Habbar", aliases: ["Bandar Al Towairqi", "بندر الطويرقي"] },
    { name: "Christina Habib", org: "Strategic Advisor", aliases: ["كريستينا حبيب"] },
    { name: "Dana Muhanna", org: "Content Creator", aliases: ["دانة مهنا", "دانه مهنا"] },
    { name: "Dina El-Dessouky", org: "Brand & Creative Strategist", aliases: ["Dina El Dessouky", "Dina Eldessouky", "دينا الدسوقي"] },
    { name: "Fahad Alahmed", org: "The Fullstop Creative Agency", aliases: ["Fahad Al Ahmed", "فهد الأحمد"] },
    { name: "Faisal Aldokhi", org: "Black Light Films", aliases: ["Faisal Al Dokhi", "فيصل الدوخي"] },
    { name: "Hassan Alansari", org: "Habbar", aliases: ["Hassan Al Ansari", "حسن الأنصاري"] },
    { name: "Lina Sakr", org: "101 Red", aliases: ["لينا صقر"] },
    { name: "Maram Muhandes", org: "PepsiCo", aliases: ["مرام مهندس"] },
    { name: "Maximilian Schneider", org: "HUMAIN", aliases: ["Max Schneider"] },
    { name: "Meshal Massoud Shukair", org: "101 Red", aliases: ["Meshal Shukair", "مشعل شقير"] },
    { name: "Mohamed El Bassiouni", org: "Tayarah", aliases: ["Mohamed Bassiouni", "محمد البسيوني"] },
    { name: "Mohamed Rasheedy", org: "101 Platforms", aliases: ["محمد رشيدي"] },
    { name: "Norah Altowairgi", org: "Habbar Creative House", aliases: ["Norah Al Towairgi", "نورة الطويرقي"] },
    { name: "Rana", org: "OSN", aliases: ["Rana OSN"], skipName: true },
    { name: "Rawan Nasser", org: "Programme & Project Manager", aliases: ["روان ناصر"] },
    { name: "Rola Alothman", org: "Norom", aliases: ["رولا العثمان"] },
    { name: "Saleh Alodan", org: "Kalamashii", aliases: ["صالح العودان"] },
    { name: "Samer AlHussein", org: "McCann", aliases: ["Samer Al Hussein", "سامر الحسين"] },
    { name: "Sliman Aldubayei", org: "Salt and Pepper", aliases: ["سليمان الدبيعي"] },
    { name: "Suliman Alhaddad", org: "TTP", aliases: ["Suliman Al Haddad", "سليمان الحداد"] },
    { name: "Taghrid Alhowish", org: "Master of Ceremonies", aliases: ["تغريد الحويش"] },
    { name: "Thekra Al Joaid", org: "Foaj Communications", aliases: ["ذكرى الجعيد"] },
    { name: "Wahab Alshehri", org: "Film Director", aliases: ["وهاب الشهري"] },
    { name: "Yara Murad", org: "Habbar Creative House", aliases: ["يارا مراد"] },
    { name: "Ahmed Alayad", org: "Fasllah", aliases: ["أحمد العياد"] },
    { name: "Ahmed Alshouni", org: "Takt", aliases: ["أحمد مصطفى الشوني", "أحمد الشوني"] },
    { name: "Ahmed Ezzeldin", org: "MBC Group", aliases: ["احمد محمود عز الدين", "أحمد عز الدين"] },
    { name: "Khaled Alqahtani", org: "Shoot", aliases: ["خالد سعود القحطاني"] },
    { name: "Dr. Kholoud Almanea", org: "HKB Tech", aliases: ["خلود صالح المانع", "خلود المانع"] },
    { name: "Rajeh Alharthi", org: "Media", aliases: ["راجح الحارثي"] },
    { name: "Rawan Albutairi", org: "Saudi Esports Federation", aliases: ["روان عادل البتيري", "روان البتيري"] },
    { name: "Abdullah Alqallaf", org: "Word Up", aliases: ["عبدالله القلاف"] },
    { name: "Obaidullah Aleissa", org: "Thmanyah", aliases: ["عبيدالله العيسي"] },
    { name: "Ali Alkalthami", org: "Telfaz11", aliases: ["علي الكلثمي", "Ali Kalthami"] },
    { name: "Meshal Alsadhan", org: "TTP", aliases: ["مشعل السدحان"] },
    { name: "Najla Alotaibi", org: "King Salman Park Foundation", aliases: ["نجلا العتيبي", "نجلاء العتيبي"] },
    { name: "Norah Bin Saidan", org: "Norah Bin Saidan Arts", aliases: ["نوره بن سعيدان", "نورة بن سعيدان"] },
    { name: "Hashem Alhawsawi", org: "NOB", aliases: ["هاشم سليمان الهوساوي", "هاشم الهوساوي"] },
    { name: "Hadeel Albreiki", org: "Corporate Communications", aliases: ["هديل البريكي"] },
    { name: "Yazeed Almujayyil", org: "Actor", aliases: ["يزيد بن عبدالله المجيول", "يزيد المجيول"] },
    { name: "Youssef Gado", org: "101", aliases: ["يوسف عمرو عبد المجيد جادو", "يوسف جادو", "Youssef Gadou"] },
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

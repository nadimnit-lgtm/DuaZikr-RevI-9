/* ==========================================================================
   Dua & Zikr — Rev I-8 TV Visual Polish
   Reading engine: categories (Azkar / Dua / Kalima), mixed flow, navigation,
   dynamic Arabic fit, settings, prayer ribbon. TV (D-pad) + touch + tablet.
   Offline-first. All assets served from the bundled appassets origin.
   ========================================================================== */
(function () {
  "use strict";

  var LS = "azkartv.v02.settings";
  var LS_POS = "azkartv.v02.pos";
  var LS_LOC = "azkartv.v02.loc";
  var LS_PRAYER = "azkartv.v02.prayer";
  var CATS = ["Azkar", "Dua", "Kalima", "Hajj & Umrah"];

  // Repeat may be null, undefined, a number, or a numeric string.
  function parseRepeat(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
    var n = parseInt(String(v).trim(), 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  // Round-robin interleave Azkar -> Dua -> Kalima -> repeat. Exhausted lists
  // are skipped so the cycle keeps producing items until everything is used.
  function buildMixed(buckets) {
    var out = [], i = 0, remaining = CATS.reduce(function (n, c) { return n + buckets[c].length; }, 0);
    while (out.length < remaining) {
      for (var c = 0; c < CATS.length; c++) {
        var list = buckets[CATS[c]];
        if (i < list.length) out.push(list[i]);
      }
      i++;
      if (i > 5000) break; // hard safety
    }
    return out;
  }

  // Section browsing uses explicit content order when available. This keeps
  // Salah sections in prayer-flow order even after future content edits.
  function byDisplayOrder(a, b) {
    var ao = (typeof a.order === "number") ? a.order : ((typeof a.priority === "number") ? a.priority : 999999);
    var bo = (typeof b.order === "number") ? b.order : ((typeof b.priority === "number") ? b.priority : 999999);
    return ao - bo;
  }

  var THEMES = [
    { id: "dark-ambient",  name: "Aurora",       a: "#070d18", b: "#62c8ff" },
    { id: "elder-light",   name: "Calm Light",   a: "#f7fbf4", b: "#174f37" },
    { id: "sepia",         name: "Sepia",        a: "#f1e4ca", b: "#9b7a31" },
    { id: "high-contrast", name: "High Contrast",a: "#000000", b: "#ffe14d" }
  ];

  var CITY_LABEL = { auto: "Auto", riyadh: "Riyadh", jeddah: "Jeddah", makkah: "Makkah", madinah: "Madinah", dammam: "Dammam" };
  var CITY_LABEL_UR = { auto: "خودکار", riyadh: "ریاض", jeddah: "جدہ", makkah: "مکہ", madinah: "مدینہ", dammam: "دمام" };
  function cityLabel(id) { return state && state.settings && state.settings.lang === "ur" ? (CITY_LABEL_UR[id] || CITY_LABEL[id] || id) : (CITY_LABEL[id] || id); }
  var APPROX = {
    riyadh:  { Fajr:"04:30", Dhuhr:"11:55", Asr:"15:20", Maghrib:"18:35", Isha:"20:05" },
    jeddah:  { Fajr:"04:45", Dhuhr:"12:10", Asr:"15:35", Maghrib:"18:50", Isha:"20:20" },
    makkah:  { Fajr:"04:42", Dhuhr:"12:08", Asr:"15:33", Maghrib:"18:48", Isha:"20:18" },
    madinah: { Fajr:"04:38", Dhuhr:"12:05", Asr:"15:28", Maghrib:"18:45", Isha:"20:15" },
    dammam:  { Fajr:"04:18", Dhuhr:"11:45", Asr:"15:10", Maghrib:"18:25", Isha:"19:55" }
  };

  var DEFAULTS = {
    theme: "dark-ambient",
    arabicScript: "uthmani",          // uthmani | indopak
    arabicFont: "scheherazade",       // scheherazade | amiri | reemkufi | nastaliq
    arScale: 0.7, tlScale: 1.0, trScale: 1.0,   // Arabic starts ~70%; other text 100%
    tvFit: true,                      // automatic per-device fit (no user toggle)
    easyView: false,                  // Simple mode OFF by default (full professional view)
    showArabic: true,
    showTranslit: true,
    showEnglish: true,
    showUrdu: true,
    showTranslation: true,             // legacy alias, kept for old saved settings
    showSource: false,                 // reference hidden by default
    showPauseMarks: true,
    showWaqfLegend: false,
    showRibbon: true, tajweed: false,
    showCopy: true,
    showShare: true,                   // Share restored on phone/tablet (hidden on TV)
    arabicWeight: "regular",           // regular weight by default (not bold)
    flowMode: "mixed",                // mixed (default) | category
    autoRotate: false, interval: 25,  // auto-advance off by default
    city: "auto",
    lang: "en",                       // en | ar | ur
    bismillahSize: "large",
    bismillahColor: "olive",
    smartSentenceFlow: true,
    highContrast: false,
    showProgress: true,
    swipeNav: true,
    showTags: false,
    themeAccent: "olive",                 // TV only: olive | gold | green
    deviceProfile: "auto"                 // auto | mobile | tablet | tv
  };

  var AR_FONTS = {
    scheherazade: '"Scheherazade", "Amiri", serif',
    amiri: '"Amiri", "Scheherazade", serif',
    reemkufi: '"ReemKufi", "Scheherazade", sans-serif',
    nastaliq: '"NastaliqUrdu", "Scheherazade", serif'
  };

  function normalizeSettings(input) {
    var raw = (input && typeof input === "object" && !Array.isArray(input)) ? input : {};
    var s = Object.assign({}, DEFAULTS);
    Object.keys(DEFAULTS).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== null && raw[k] !== undefined) s[k] = raw[k];
    });

    function num(key, min, max, fallback) {
      var n = Number(s[key]);
      if (!isFinite(n)) n = fallback;
      s[key] = Math.min(max, Math.max(min, Math.round(n * 100) / 100));
    }
    num("arScale", 0.7, 2.0, DEFAULTS.arScale);
    num("tlScale", 0.75, 1.8, DEFAULTS.tlScale);
    num("trScale", 0.75, 1.8, DEFAULTS.trScale);
    num("interval", 5, 300, DEFAULTS.interval);

    ["showArabic", "showTranslit", "showEnglish", "showUrdu", "showTranslation", "showSource", "showPauseMarks", "showWaqfLegend", "showRibbon", "tajweed", "showCopy", "showShare", "tvFit", "easyView", "autoRotate", "smartSentenceFlow", "highContrast", "showProgress", "swipeNav", "showTags"].forEach(function (k) { s[k] = !!s[k]; });

    if (!["en", "ar", "ur"].includes(s.lang)) s.lang = DEFAULTS.lang;
    if (!["uthmani", "indopak", "naskh"].includes(s.arabicScript)) s.arabicScript = DEFAULTS.arabicScript;
    if (!["scheherazade", "amiri", "reemkufi", "nastaliq"].includes(s.arabicFont)) s.arabicFont = DEFAULTS.arabicFont;
    if (!["regular", "thick"].includes(s.arabicWeight)) s.arabicWeight = DEFAULTS.arabicWeight;
    if (!["mixed", "category"].includes(s.flowMode)) s.flowMode = DEFAULTS.flowMode;
    if (!["auto", "riyadh", "jeddah", "makkah", "madinah", "dammam"].includes(s.city)) s.city = DEFAULTS.city;
    if (!["normal", "small", "medium", "large", "xl"].includes(s.bismillahSize)) s.bismillahSize = DEFAULTS.bismillahSize;
    if (!["olive", "gold", "dark"].includes(s.bismillahColor)) s.bismillahColor = DEFAULTS.bismillahColor;
    if (!["olive", "gold", "green"].includes(s.themeAccent)) s.themeAccent = DEFAULTS.themeAccent;
    if (!["auto", "mobile", "tablet", "tv"].includes(s.deviceProfile)) s.deviceProfile = DEFAULTS.deviceProfile;
    if (!THEMES.some(function (th) { return th.id === s.theme; })) s.theme = DEFAULTS.theme;

    // Legacy single translation switch remains mapped to English visibility.
    s.showTranslation = !!s.showEnglish;
    return s;
  }

  function ensureSettings() {
    state.settings = normalizeSettings(state.settings);
    return state.settings;
  }

  function ensureDraft() {
    state.draft = normalizeSettings(state.draft || state.settings);
    return state.draft;
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var IS_TV = (function () {
    if (/[?&]tv=1\b/.test(location.search)) return true;
    var ua = navigator.userAgent || "";
    if (/Google TV|Android TV|Leanback|AFT[A-Z]|BRAVIA|SmartTV|Smart-TV|HbbTV|NetCast|Web0S|webOS|Tizen|CrKey|Chromecast|DTV|\bTV\b/i.test(ua)) return true;
    try {
      var noFine = !matchMedia("(any-pointer:fine)").matches;
      var noTouch = !("ontouchstart" in window) && (navigator.maxTouchPoints || 0) === 0;
      var big = Math.min(screen.width || 0, screen.height || 0) >= 600;
      if (noFine && noTouch && big) return true;   // remote-only large display
    } catch (e) {}
    return false;
  })();

  /* ---- i18n: English / Urdu UI -------------------------------------------- */
  var I18N = {
    en: {
      nowReading:"", mixedFlow:"Mixed Flow", mixedSub:"Azkar → Dua → Kalima, cycling",
      whatToRead:"What to read", singleCategory:"Single category", browseSection:"Browse by section",
      category:"Category", section:"Section", settings:"Settings", saveApply:"Save & Apply",
      close:"Close", share:"Share", copied:"Copied", shareTextCopied:"Share text copied",
      shareUnavailable:"Share not available", settingsSaved:"Settings saved", noMatchingDuas:"No matching du’as",
      noSectionContent:"No content is available in this section.", noViewContent:"No content is available for this view.",
      approx:"approx", unavailable:"Unavailable", lastSaved:"Last saved", online:"Online", approximate:"Approximate", autoLocation:"Auto location", locating:"Locating…", myLocation:"My location", selectedCity:"Selected city", prayerUnavailable:"Prayer time unavailable",
      scroll:"scroll ⌄", prev:"Previous", next:"Next", menu:"Menu", auto:"AUTO", reference:"Reference",
      grpDisplay:"Display", grpContent:"Content visibility", grpNavigation:"Navigation", grpPrayer:"Prayer", grpAbout:"About", openAbout:"Open About page",
      language:"Language", languageDesc:"App language for the interface and translation.",
      theme:"Theme", themeDesc:"Calm palettes. High Contrast aids low vision. Live preview on tap.",
      simpleMode:"Simple mode (large text & buttons)", simpleModeDesc:"Bigger Arabic, buttons and spacing — easiest to read and operate.",
      fitTv:"Fit full content on screen (TV)", fitTvDesc:"On: shrink text so the whole dua fits one TV screen with no scrolling. Off: larger fixed text that scrolls.",
      arabicTypeface:"Arabic typeface", arabicTypefaceDesc:"Font style for the hero Arabic text. Live preview on change.",
      arabicWeight:"Arabic Font Weight", arabicWeightDesc:"Regular is calmer; Thick is easier from distance. Live preview on change.",
      arabicTextSize:"Arabic text size", arabicTextSizeDesc:"Hero Arabic text size.",
      translationFont:"Translation font", translationFontDesc:"English and Urdu translation size.",
      transliterationFont:"Transliteration font", transliterationFontDesc:"Latin transliteration size.",
      showArabic:"Show Arabic", showArabicDesc:"Arabic text remains the main reading layer.",
      showTranslit:"Show transliteration", showTranslitDesc:"Latin reading aid below Arabic.",
      showEnglish:"Show English translation", showEnglishDesc:"English meaning block.",
      showUrdu:"Show Urdu translation", showUrduDesc:"Urdu meaning block when available.",
      showSource:"Show reference", showSourceDesc:"Surah, ayah or hadith reference at the bottom.",
      showPauseMarks:"Show Qur’an Pause Marks", showPauseMarksDesc:"Display Waqf signs exactly as preserved in Qur’anic Arabic.",
      showWaqfLegend:"Show Waqf Legend", showWaqfLegendDesc:"Show a compact pause-mark guide here in Settings only.",
      waqfLegend:"Waqf legend", waqfLegendDesc:"Qur’anic pause signs used for reading.",
      tajweed:"Tajweed colouring", tajweedDesc:"Applies only to Qur’anic items when enabled.",
      defaultFlow:"Default flow", defaultFlowDesc:"Mixed cycles Azkar → Dua → Kalima. Single category stays in one group.",
      autoRotation:"Auto-rotation", autoRotationDesc:"Advance items automatically. Long-press the card, or press OK on TV, to pause.",
      rotationInterval:"Rotation interval", rotationIntervalDesc:"Seconds per item when auto-rotation is on.",
      copyButton:"Copy button", copyButtonDesc:"Show a copy control on each card. Hidden on TV.",
      shareButton:"Share button", shareButtonDesc:"Share the current card as a PNG through Android share sheet on phone/tablet. Hidden on TV.",
      prayerRibbon:"Compact prayer ribbon", prayerRibbonDesc:"Slim next-prayer strip under the top bar.",
      location:"Location", locationDesc:"Prayer times follow wherever you are; no need to pick a city.",
      liveLocationNote:"Automatic — based on your live GPS / network location.",
      aboutHtml:'<strong>Dua & Zikr — Rev I-8 TV Visual Polish Theme.</strong> A calm, offline Islamic reading app for phones, tablets and Android TV. Content shows one remembrance at a time with Arabic as the focus, optional transliteration, English and Urdu translation, Qur’an pause-mark support, and a source reference.<br><br>Content is organised into three categories — Azkar, Dua and Kalima — and can be read as a mixed flow or one category at a time. Every entry carries a source and a verification flag. Sources have not yet been confirmed by a qualified scholar, so treat the content as provisional until reviewed. Tajweed colouring is available for Qur’anic items as a conservative visual foundation pending final review.<br><br>Prayer times use online calculation when connected. If accurate auto-location data is unavailable, the ribbon shows unavailable or last saved instead of silently using a wrong city.',
      contentVersion:"Content version", lastUpdated:"Last updated", canonicalItems:"Canonical items", sectionReferences:"Section references", fontNote:"Arabic uses Scheherazade New; Urdu uses Noto Nastaliq Urdu (both SIL OFL).", reviewBadge:"Content review status: pending scholarly review",
      optEnglish:"English", optUrdu:"Urdu", optRegular:"Regular", optThick:"Thick", optMixed:"Mixed flow", optByCategory:"By category", optOn:"On", optOff:"Off",
      fontScheherazade:"Scheherazade (Naskh)", fontAmiri:"Amiri (Madinah-style)", fontReem:"Reem Kufi (modern)", fontNastaliq:"Noto Nastaliq (Indo-Pak)",
      theme_elder_dark:"Elder Ease Dark", theme_elder_light:"Elder Ease Light", theme_dark_ambient:"Dark Ambient", theme_gold_navy:"Gold & Navy", theme_haram_light:"Haram Light", theme_green_classic:"Green Classic", theme_high_contrast:"High Contrast", theme_sepia:"Sepia",
      grpReadingDisplay:"1. Reading & Display", grpAppearance:"2. Appearance", grpContentCategories:"3. Content & Categories", grpPrayerBar:"4. Prayer Bar", grpLanguage:"5. Language", grpNavigationExperience:"6. Navigation & Experience",
      bismillahSize:"Bismillah size", bismillahSizeDesc:"Larger display for Bismillah.", bismillahColor:"Bismillah color", bismillahColorDesc:"Darker olive / gold tone.", smartSentenceFlow:"Smart sentence flow", smartSentenceFlowDesc:"Better Arabic line wrapping.", waqfPauseSigns:"Waqf & pause signs", waqfPauseSignsDesc:"Show waqf and pause helpers where appropriate.", showTranslitShort:"Transliteration", showTranslationShort:"Translation", showUrduShort:"Urdu translation", contentCatsDesc:"Hajj & Umrah is added as a section and tag without duplicate duas.", manageTags:"Manage Tags", cityLocation:"City / Location", connectionStatus:"Connection status", highContrastMode:"High contrast mode", highContrastModeDesc:"Improve readability.", scriptUthmani:"Uthmani", scriptIndopak:"Indo-Pak", optLight:"Light", optDarkAmbient:"Aurora", optSepia:"Sepia", swipeNavigation:"Swipe navigation", swipeNavigationDesc:"Left / Right to navigate.", showTagsOnDisplay:"Show Tags on Display", showTagsOnDisplayDesc:"Show category tags on the reading card.", pageProgressIndicator:"Page progress indicator", pageProgressIndicatorDesc:"Show reading progress.", optArabic:"Arabic",
      vQuran:"Qur’an", vHadith:"Hadith — source cited", vCompilation:"Traditional — unverified", searchDuas:"Search du’as by name…",
      prayer_Fajr:"Fajr", prayer_Dhuhr:"Dhuhr", prayer_Asr:"Asr", prayer_Maghrib:"Maghrib", prayer_Isha:"Isha"
    },
    ur: {
      nowReading:"", mixedFlow:"مخلوط مطالعہ", mixedSub:"اذکار ← دعا ← کلمہ، باری باری",
      whatToRead:"کیا پڑھیں", singleCategory:"ایک زمرہ", browseSection:"حصوں کے مطابق دیکھیں",
      category:"زمرہ", section:"حصہ", settings:"ترتیبات", saveApply:"محفوظ کریں",
      close:"بند کریں", share:"شیئر", copied:"کاپی ہو گیا", shareTextCopied:"شیئر متن کاپی ہو گیا",
      shareUnavailable:"شیئر دستیاب نہیں", settingsSaved:"ترتیبات محفوظ ہو گئیں", noMatchingDuas:"کوئی دعا نہیں ملی",
      noSectionContent:"اس حصے میں مواد دستیاب نہیں۔", noViewContent:"اس منظر کے لیے مواد دستیاب نہیں۔",
      approx:"تقریباً", unavailable:"دستیاب نہیں", lastSaved:"آخری محفوظ", online:"آن لائن", approximate:"تقریبی", autoLocation:"خودکار مقام", locating:"مقام تلاش ہو رہا ہے…", myLocation:"میرا مقام", selectedCity:"منتخب شہر", prayerUnavailable:"نماز کا وقت دستیاب نہیں",
      scroll:"سکرول ⌄", prev:"پچھلا", next:"اگلا", menu:"مینو", auto:"خودکار", reference:"حوالہ",
      grpDisplay:"ڈسپلے", grpContent:"مواد کی نمائش", grpNavigation:"نیویگیشن", grpPrayer:"نماز", grpAbout:"تعارف", openAbout:"تعارف کھولیں",
      language:"زبان", languageDesc:"ایپ کے انٹرفیس اور ترجمے کی زبان۔",
      theme:"تھیم", themeDesc:"پرسکون رنگ۔ ہائی کنٹراسٹ کمزور نظر کے لیے بہتر ہے۔",
      simpleMode:"آسان موڈ (بڑا متن اور بٹن)", simpleModeDesc:"بڑی عربی، بڑے بٹن اور زیادہ جگہ — پڑھنا اور چلانا آسان۔",
      fitTv:"ٹی وی پر مکمل مواد فٹ کریں", fitTvDesc:"آن: دعا کو ایک ٹی وی اسکرین میں فٹ کرنے کے لیے متن کم کیا جائے۔ آف: بڑا متن سکرول کے ساتھ۔",
      arabicTypeface:"عربی خط", arabicTypefaceDesc:"مرکزی عربی متن کا فونٹ۔ تبدیلی پر فوری پیش منظر۔",
      arabicWeight:"عربی فونٹ وزن", arabicWeightDesc:"Regular پرسکون؛ Thick دور سے آسان۔ تبدیلی پر فوری پیش منظر۔",
      arabicTextSize:"عربی متن کا سائز", arabicTextSizeDesc:"مرکزی عربی متن کا سائز۔",
      translationFont:"ترجمہ فونٹ", translationFontDesc:"انگریزی اور اردو ترجمے کا سائز۔",
      transliterationFont:"تلفظ فونٹ", transliterationFontDesc:"لاطینی تلفظ کا سائز۔",
      showArabic:"عربی دکھائیں", showArabicDesc:"عربی متن مرکزی پڑھنے والی تہہ رہے گا۔",
      showTranslit:"تلفظ دکھائیں", showTranslitDesc:"عربی کے نیچے لاطینی تلفظ۔",
      showEnglish:"انگریزی ترجمہ دکھائیں", showEnglishDesc:"انگریزی معنی کا حصہ۔",
      showUrdu:"اردو ترجمہ دکھائیں", showUrduDesc:"دستیاب ہونے پر اردو معنی کا حصہ۔",
      showSource:"حوالہ دکھائیں", showSourceDesc:"سورہ، آیت یا حدیث کا حوالہ نیچے دکھائیں۔",
      showPauseMarks:"قرآنی وقف علامات دکھائیں", showPauseMarksDesc:"قرآنی عربی میں محفوظ وقف علامات دکھائیں۔",
      showWaqfLegend:"وقف رہنما دکھائیں", showWaqfLegendDesc:"ترتیبات میں مختصر وقف علامات کی رہنمائی دکھائیں۔",
      waqfLegend:"وقف رہنما", waqfLegendDesc:"قرآنی پڑھائی میں استعمال ہونے والی وقف علامات۔",
      tajweed:"تجوید رنگ", tajweedDesc:"فعال ہونے پر صرف قرآنی items پر لاگو ہوتا ہے۔",
      defaultFlow:"ابتدائی ترتیب", defaultFlowDesc:"مخلوط ترتیب: اذکار ← دعا ← کلمہ۔ ایک زمرہ اسی گروپ میں رہتا ہے۔",
      autoRotation:"خودکار تبدیلی", autoRotationDesc:"آئٹمز خود آگے بڑھیں۔ کارڈ کو دیر تک دبائیں، یا ٹی وی پر OK دبائیں۔",
      rotationInterval:"تبدیلی کا وقفہ", rotationIntervalDesc:"خودکار تبدیلی میں ہر آئٹم کے سیکنڈ۔",
      copyButton:"کاپی بٹن", copyButtonDesc:"ہر کارڈ پر کاپی کنٹرول دکھائیں۔ ٹی وی پر پوشیدہ۔",
      shareButton:"شیئر بٹن", shareButtonDesc:"فون/ٹیبلٹ پر موجودہ کارڈ PNG کے طور پر Android share sheet سے شیئر کریں۔ ٹی وی پر پوشیدہ۔",
      prayerRibbon:"مختصر نماز پٹی", prayerRibbonDesc:"اوپر والی بار کے نیچے اگلی نماز کی مختصر پٹی۔",
      location:"مقام", locationDesc:"نماز کے اوقات مقام کے مطابق رہیں گے؛ شہر منتخب کرنے کی ضرورت نہیں۔",
      liveLocationNote:"خودکار — آپ کے GPS / نیٹ ورک مقام کے مطابق۔",
      aboutHtml:'<strong>Dua & Zikr — Rev I-8 TV Visual Polish Theme.</strong> فون، ٹیبلٹ اور Android TV کے لیے ایک پرسکون، آف لائن اسلامی مطالعہ ایپ۔ ہر کارڈ میں عربی متن مرکزی حیثیت رکھتا ہے، ساتھ میں اختیاری تلفظ، انگریزی اور اردو ترجمہ، قرآنی وقف علامات اور حوالہ شامل ہے۔<br><br>مواد تین بڑے زمروں — اذکار، دعا اور کلمہ — میں منظم ہے، اور اسے مخلوط ترتیب یا ایک زمرے کے طور پر پڑھا جا سکتا ہے۔ ہر اندراج میں حوالہ اور تصدیقی نشان موجود ہے۔ حتمی علمی تصدیق ابھی باقی ہے، اس لیے مواد کو حتمی عالم دین کے جائزے تک عارضی سمجھا جائے۔ قرآنی items کے لیے تجوید رنگ بطور محتاط بنیاد موجود ہے۔<br><br>انٹرنیٹ دستیاب ہو تو نماز کے اوقات آن لائن حساب سے آتے ہیں۔ اگر درست خودکار مقام دستیاب نہ ہو تو ایپ غلط شہر خاموشی سے استعمال نہیں کرتی بلکہ unavailable یا last saved دکھاتی ہے۔',
      contentVersion:"مواد ورژن", lastUpdated:"آخری اپ ڈیٹ", canonicalItems:"اصل آئٹمز", sectionReferences:"حصہ حوالہ جات", fontNote:"عربی کے لیے Scheherazade New؛ اردو کے لیے Noto Nastaliq Urdu استعمال ہوتا ہے۔", reviewBadge:"مواد جائزہ: علمی تصدیق باقی ہے",
      optEnglish:"English", optUrdu:"اردو", optRegular:"Regular", optThick:"Thick", optMixed:"مخلوط مطالعہ", optByCategory:"زمرہ کے مطابق", optOn:"آن", optOff:"آف",
      fontScheherazade:"Scheherazade (نسخ)", fontAmiri:"Amiri (مدنی انداز)", fontReem:"Reem Kufi (جدید)", fontNastaliq:"Noto Nastaliq (ہند و پاک)",
      theme_elder_dark:"بزرگ آسانی — ڈارک", theme_elder_light:"بزرگ آسانی — لائٹ", theme_dark_ambient:"ڈارک ایمبیئنٹ", theme_gold_navy:"سنہرا اور نیوی", theme_haram_light:"حرم لائٹ", theme_green_classic:"سبز کلاسک", theme_high_contrast:"ہائی کنٹراسٹ", theme_sepia:"سیپیا",
      grpReadingDisplay:"1. پڑھائی اور ڈسپلے", grpAppearance:"2. ظاہری شکل", grpContentCategories:"3. مواد اور زمرے", grpPrayerBar:"4. نماز پٹی", grpLanguage:"5. زبان", grpNavigationExperience:"6. نیویگیشن",
      bismillahSize:"بسم اللہ سائز", bismillahSizeDesc:"بسم اللہ کو بڑا دکھائیں۔", bismillahColor:"بسم اللہ رنگ", bismillahColorDesc:"گہرا زیتونی / سنہری رنگ۔", smartSentenceFlow:"سمارٹ جملہ بہاؤ", smartSentenceFlowDesc:"عربی لائن بریک بہتر بنائیں۔", waqfPauseSigns:"وقف اور توقف علامات", waqfPauseSignsDesc:"مناسب وقف اور توقف دکھائیں۔", showTranslitShort:"تلفظ", showTranslationShort:"ترجمہ", showUrduShort:"اردو ترجمہ", contentCatsDesc:"حج اور عمرہ کو نقل کے بغیر سیکشن اور ٹیگ کے طور پر شامل کیا گیا۔", manageTags:"ٹیگز سنبھالیں", cityLocation:"شہر / مقام", connectionStatus:"کنیکشن حالت", highContrastMode:"ہائی کنٹراسٹ", highContrastModeDesc:"مطالعہ آسان بنائیں۔", scriptUthmani:"عثمانی", scriptIndopak:"ہند و پاک", optLight:"لائٹ", optDarkAmbient:"آورا", optSepia:"سیپیا", swipeNavigation:"سوائپ نیویگیشن", swipeNavigationDesc:"بائیں / دائیں چلائیں۔", showTagsOnDisplay:"ٹیگز دکھائیں", showTagsOnDisplayDesc:"پڑھائی کارڈ پر زمرہ ٹیگز دکھائیں۔", pageProgressIndicator:"صفحہ پیشرفت", pageProgressIndicatorDesc:"مطالعہ پیشرفت دکھائیں۔", optArabic:"عربی",
      vQuran:"قرآن", vHadith:"حدیث — حوالہ درج", vCompilation:"روایتی — غیر مصدقہ", searchDuas:"نام سے دعا تلاش کریں…",
      prayer_Fajr:"فجر", prayer_Dhuhr:"ظہر", prayer_Asr:"عصر", prayer_Maghrib:"مغرب", prayer_Isha:"عشاء"
    }
  };

  I18N.ar = Object.assign({}, I18N.en, {
    mixedFlow:"تدفق مختلط", whatToRead:"ماذا تقرأ", singleCategory:"قسم واحد", browseSection:"التصفح حسب القسم",
    category:"القسم", section:"القسم", settings:"الإعدادات", saveApply:"حفظ وتطبيق", close:"إغلاق",
    prev:"السابق", next:"التالي", menu:"القائمة", auto:"تلقائي", reference:"المرجع", online:"متصل", approximate:"تقريبي", unavailable:"غير متاح",
    grpReadingDisplay:"1. القراءة والعرض", grpAppearance:"2. المظهر", grpContentCategories:"3. المحتوى والأقسام", grpPrayerBar:"4. شريط الصلاة", grpLanguage:"5. اللغة", grpNavigationExperience:"6. التنقل والتجربة",
    arabicTextSize:"حجم النص العربي", bismillahSize:"حجم البسملة", bismillahColor:"لون البسملة", smartSentenceFlow:"تدفق الجمل الذكي", waqfPauseSigns:"علامات الوقف والتوقف", showTranslitShort:"النطق اللاتيني", showTranslationShort:"الترجمة",
    theme:"النمط", optLight:"فاتح", optDarkAmbient:"داكن هادئ", optSepia:"سيبيا", scriptUthmani:"عثماني", scriptIndopak:"هند باك", highContrastMode:"تباين عالٍ",
    language:"اللغة", optEnglish:"English", optUrdu:"اردو", optArabic:"العربية", prayerRibbon:"شريط الصلاة", cityLocation:"المدينة / الموقع", connectionStatus:"حالة الاتصال",
    autoRotation:"التدوير التلقائي", swipeNavigation:"التنقل بالسحب", showTagsOnDisplay:"إظهار الوسوم", showTagsOnDisplayDesc:"إظهار وسوم القسم على البطاقة.", pageProgressIndicator:"مؤشر التقدم", manageTags:"إدارة الوسوم", contentCatsDesc:"تمت إضافة الحج والعمرة كقسم ووسم دون تكرار الأدعية.",
    prayer_Fajr:"الفجر", prayer_Dhuhr:"الظهر", prayer_Asr:"العصر", prayer_Maghrib:"المغرب", prayer_Isha:"العشاء"
  });

  var CATEGORY_UR = {
    "Azkar":"اذکار", "Dua":"دعا", "Kalima":"کلمہ", "Quranic Duas":"قرآنی دعائیں", "Daily Life Duas":"روزمرہ دعائیں",
    "Morning Azkar":"صبح کے اذکار", "Evening Azkar":"شام کے اذکار", "Before Salah":"نماز سے پہلے", "Inside Salah":"نماز کے اندر",
    "After Salah Azkar":"نماز کے بعد اذکار", "Before Sleep Azkar":"سونے سے پہلے اذکار", "Protection and Ruqyah":"حفاظت اور رقیہ",
    "Istighfar":"استغفار", "Salawat":"درود و سلام", "Hajj & Umrah":"حج اور عمرہ"
  };
  var TYPE_UR = { "Dua":"دعا", "Azkar":"ذکر", "Kalima":"کلمہ", "Istighfar":"استغفار", "Salawat":"درود", "Guidance":"رہنمائی" };
  var CATEGORY_AR = { "Azkar":"الأذكار", "Dua":"الدعاء", "Kalima":"الكلمات", "Quranic Duas":"أدعية قرآنية", "Daily Life Duas":"أدعية يومية", "Morning Azkar":"أذكار الصباح", "Evening Azkar":"أذكار المساء", "After Salah Azkar":"أذكار بعد الصلاة", "Before Sleep Azkar":"أذكار النوم", "Protection and Ruqyah":"الوقاية والرقية", "Istighfar":"الاستغفار", "Salawat":"الصلاة على النبي", "Hajj & Umrah":"الحج والعمرة", "Guidance":"إرشاد" };
  var TYPE_AR = { "Dua":"دعاء", "Azkar":"ذكر", "Kalima":"كلمة", "Istighfar":"استغفار", "Salawat":"صلاة", "Guidance":"إرشاد" };
  var TITLE_UR = {};
  function localizeCategory(v) { return state.settings.lang === "ur" ? (CATEGORY_UR[v] || TYPE_UR[v] || v || "") : (state.settings.lang === "ar" ? (CATEGORY_AR[v] || TYPE_AR[v] || v || "") : (v || "")); }
  function localizeType(v) { return state.settings.lang === "ur" ? (TYPE_UR[v] || CATEGORY_UR[v] || v || "") : (state.settings.lang === "ar" ? (TYPE_AR[v] || CATEGORY_AR[v] || v || "") : (v || "")); }
  function localizeSectionMeta(meta) {
    if (!meta) return "";
    if (state.settings.lang === "ur") return meta.label_ur || CATEGORY_UR[meta.label] || meta.label || meta.key || "";
    return meta.label || meta.key || "";
  }
  function localizeTitle(it) { return state.settings.lang === "ur" ? (it.title_ur || TITLE_UR[it.title] || it.title || "") : (it.title || ""); }
  function localizePrayerName(name) { return t("prayer_" + name) || name; }

  function t(k) {
    var L = I18N[state.settings.lang] || I18N.en;
    return (k in L) ? L[k] : (k in I18N.en ? I18N.en[k] : k);
  }
  function applyLang() {
    var rtl = state.settings.lang === "ur" || state.settings.lang === "ar";
    document.documentElement.setAttribute("lang", state.settings.lang || "en");
    document.body.setAttribute("data-lang", state.settings.lang);
    document.body.dir = rtl ? "rtl" : "ltr";
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    $$("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))); });
  }

  var state = {
    content: null, sections: null,
    canonicalItems: [],          // one unique dua/zikr record only
    sectionItems: [],            // virtual display records created from sectionRefs
    allItems: [],
    buckets: { Azkar: [], Dua: [], Kalima: [], "Hajj & Umrah": [] },
    playlist: [], index: 0,
    view: { mode: "mixed", category: "Azkar", section: null }, // mode: mixed|category|section
    settings: load(), draft: null, autoTimer: null,
    pendingScrollTop: 0, scrollTimer: null,
    tvSettingsNav: null
  };

  function load() {
    var repaired = false;
    try {
      var stored = localStorage.getItem(LS);
      var raw = stored ? JSON.parse(stored) : {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) { raw = {}; repaired = true; }
      var s = normalizeSettings(raw);
      if (IS_TV) {
        var rawAr = Number(raw.arScale);
        if (!isFinite(rawAr) || rawAr < 1.30) { s.arScale = 1.35; repaired = true; }
        if (!raw.bismillahSize || raw.bismillahSize === "large" || raw.bismillahSize === "xl") { s.bismillahSize = "small"; repaired = true; }
      }
      // Backward compatibility with older versions that used one translation switch.
      if (!("showEnglish" in raw) && ("showTranslation" in raw)) { s.showEnglish = !!raw.showTranslation; repaired = true; }
      if (!("showUrdu" in raw)) { s.showUrdu = DEFAULTS.showUrdu; repaired = true; }
      if (!("showArabic" in raw)) { s.showArabic = true; repaired = true; }
      if (!("showPauseMarks" in raw)) { s.showPauseMarks = true; repaired = true; }
      s.showTranslation = !!s.showEnglish;
      s = normalizeSettings(s);
      if (repaired) localStorage.setItem(LS, JSON.stringify(s));
      return s;
    } catch (e) {
      var safe = normalizeSettings(DEFAULTS);
      try { localStorage.setItem(LS, JSON.stringify(safe)); } catch (e2) {}
      return safe;
    }
  }
  function save() { try { state.settings = normalizeSettings(state.settings); localStorage.setItem(LS, JSON.stringify(state.settings)); } catch (e) {} }
  function savePos() {
    try {
      var sc = $("#readerScroll");
      var cur = state.playlist[state.index] || null;
      localStorage.setItem(LS_POS, JSON.stringify({
        view: state.view,
        index: state.index,
        itemId: cur ? (cur.display_id || cur.id) : null,
        scrollTop: sc ? sc.scrollTop : 0
      }));
    } catch (e) {}
  }

  /* ---- boot -------------------------------------------------------------- */
  function boot() {
    ensureSettings();
    if (IS_TV) {
      document.body.classList.add("tv");
      if (!state.settings.deviceProfile || state.settings.deviceProfile === "auto") state.settings.deviceProfile = "tv";
      mountTvPrayerRibbon();
    }
    Promise.all([
      fetch("content/content.json").then(function (r) { return r.json(); }),
      fetch("content/sections.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
      state.content = res[0];
      state.sections = res[1];
      indexContent();
      applyBodyFlags();
      applyTheme(state.settings.theme);
      applyLang();
      buildViewList();
      buildSettings();
      bindGlobal();
      restorePosition();
      rebuildPlaylist(true);
      setupPrayer();
      refreshConnDot();
      setTimeout(function () { var s = $("#splash"); s.classList.add("gone"); setTimeout(function () { s.remove(); }, 500); }, 1700);
    }).catch(function (err) {
      var s = $("#splash"); if (s) s.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:24px;text-align:center">Unable to load content.<br>' + (err && err.message || "") + '</div>';
    });
  }

  function getSectionRefs(it) {
    if (Array.isArray(it.sectionRefs) && it.sectionRefs.length) return it.sectionRefs;
    return [{
      section: it.section,
      category: it.category,
      type: it.type,
      main_category: it.main_category,
      title: it.title,
      source: it.source,
      repeat: it.repeat,
      order: it.order,
      priority: it.priority
    }];
  }

  function displayRecord(it, ref) {
    var out = Object.assign({}, it);
    out.canonical_id = it.id;
    out.display_id = it.id + "@" + (ref.section || it.section);
    out.section = ref.section || it.section;
    out.category = ref.category || it.category;
    out.type = ref.type || it.type;
    out.main_category = ref.main_category || it.main_category;
    out.title = ref.title || it.title;
    out.source = ref.source || it.source;
    out.repeat = ("repeat" in ref) ? ref.repeat : it.repeat;
    out.order = (typeof ref.order === "number") ? ref.order : it.order;
    out.priority = (typeof ref.priority === "number") ? ref.priority : it.priority;
    return out;
  }

  function indexContent() {
    var secOrder = {};
    (state.sections.sections || []).forEach(function (s, i) { secOrder[s.key] = i; });

    state.canonicalItems = (state.content.items || []).slice().sort(function (a, b) {
      var ar = getSectionRefs(a)[0] || {}, br = getSectionRefs(b)[0] || {};
      var as = (typeof secOrder[ar.section || a.section] === "number") ? secOrder[ar.section || a.section] : 999999;
      var bs = (typeof secOrder[br.section || b.section] === "number") ? secOrder[br.section || b.section] : 999999;
      if (as !== bs) return as - bs;
      return byDisplayOrder(displayRecord(a, ar), displayRecord(b, br));
    });

    state.sectionItems = [];
    state.canonicalItems.forEach(function (it) {
      getSectionRefs(it).forEach(function (ref) { state.sectionItems.push(displayRecord(it, ref)); });
    });
    state.sectionItems.sort(function (a, b) {
      var as = (typeof secOrder[a.section] === "number") ? secOrder[a.section] : 999999;
      var bs = (typeof secOrder[b.section] === "number") ? secOrder[b.section] : 999999;
      if (as !== bs) return as - bs;
      return byDisplayOrder(a, b);
    });

    state.allItems = state.canonicalItems;
    state.buckets = {}; CATS.forEach(function (c) { state.buckets[c] = []; });
    state.canonicalItems.forEach(function (it) {
      var c = it.main_category;
      if (CATS.indexOf(c) < 0) c = (it.type === "Kalima") ? "Kalima" : (it.type === "Dua" ? "Dua" : (hasTagOrRef(it, "Hajj & Umrah") ? "Hajj & Umrah" : "Azkar"));
      if (!state.buckets[c]) state.buckets[c] = [];
      state.buckets[c].push(it);
    });
  }

  /* ---- body flags (theme-independent classes) ---------------------------- */
  function applyBodyFlags() {
    ensureSettings();
    document.body.classList.toggle("easy", !!state.settings.easyView);
    document.body.classList.toggle("no-copy", !state.settings.showCopy || IS_TV);
    document.body.classList.toggle("no-share", !state.settings.showShare || IS_TV);
    document.body.classList.toggle("hide-progress", state.settings.showProgress === false);
    document.body.classList.toggle("show-tags", !!state.settings.showTags);
    document.body.classList.toggle("tv-accent-gold", state.settings.themeAccent === "gold");
    document.body.classList.toggle("tv-accent-green", state.settings.themeAccent === "green");
    document.body.classList.toggle("tv-accent-olive", state.settings.themeAccent !== "gold" && state.settings.themeAccent !== "green");
    document.body.classList.toggle("tv-prayer-hidden", state.settings.showRibbon === false);
    document.body.classList.toggle("profile-tv", (state.settings.deviceProfile || (IS_TV ? "tv" : "auto")) === "tv");
    document.body.classList.toggle("profile-tablet", state.settings.deviceProfile === "tablet");
    document.body.classList.toggle("profile-mobile", state.settings.deviceProfile === "mobile");
  }

  function applyTheme(id) { document.body.setAttribute("data-theme", id); }

  // Rev I-6: TV only. Move the prayer ribbon into the header flex row so it
  // cannot overlap A-/A+/theme/settings controls on real Android TV panels.
  function mountTvPrayerRibbon() {
    if (!IS_TV) return;
    var top = $(".topbar"), ribbon = $("#prayerRibbon"), arSize = $("#arSize");
    if (top && ribbon && ribbon.parentElement !== top) {
      top.insertBefore(ribbon, arSize || $("#contrastBtn") || $("#openSettings") || null);
    }
  }

  function normToken(v) { return String(v || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9؀-ۿ]+/g, "_").replace(/^_+|_+$/g, ""); }
  function hasTagOrRef(it, cat) {
    var want = normToken(cat), tags = it && it.tags || [], refs = it && it.sectionRefs || [];
    if (normToken(it.category) === want || normToken(it.main_category) === want || normToken(it.section) === want || (cat === "Hajj & Umrah" && it.section === "hajj_umrah")) return true;
    for (var i = 0; i < tags.length; i++) if (normToken(tags[i]) === want || (cat === "Hajj & Umrah" && normToken(tags[i]) === "hajj_umrah")) return true;
    for (var r = 0; r < refs.length; r++) {
      if (normToken(refs[r].category) === want || normToken(refs[r].main_category) === want || (cat === "Hajj & Umrah" && refs[r].section === "hajj_umrah")) return true;
    }
    return false;
  }
  function categoryPlaylist(cat) {
    if (cat === "Hajj & Umrah") return state.sectionItems.filter(function (it) { return it.section === "hajj_umrah" || hasTagOrRef(it, cat); }).sort(byDisplayOrder);
    var base = (state.buckets[cat] || []).slice();
    var seen = {}; base.forEach(function (it) { seen[it.id] = true; });
    state.canonicalItems.forEach(function (it) { if (!seen[it.id] && hasTagOrRef(it, cat)) { base.push(it); seen[it.id] = true; } });
    return base.sort(byDisplayOrder);
  }

  /* ---- playlist (mixed / category / section) ----------------------------- */
  function rebuildPlaylist(keepIndex) {
    var v = state.view, pl;
    if (v.mode === "mixed") pl = buildMixed(state.buckets);
    else if (v.mode === "category") pl = categoryPlaylist(v.category);
    else pl = state.sectionItems.filter(function (it) { return it.section === v.section; }).sort(byDisplayOrder);
    state.emptyMessage = "";
    if (!pl.length) {
      state.emptyMessage = v.mode === "section" ? t("noSectionContent") : t("noViewContent");
      state.playlist = []; state.index = 0;
      updateViewLabel(); markViewList(); render(); savePos();
      return;
    }
    state.playlist = pl;
    if (!keepIndex || state.index >= pl.length || state.index < 0) state.index = 0;
    updateViewLabel();
    markViewList();
    render();
    savePos();
  }

  function viewLabel() {
    var v = state.view;
    if (v.mode === "mixed") return t("mixedFlow");
    if (v.mode === "category") return localizeCategory(v.category);
    var meta = (state.sections.sections || []).filter(function (s) { return s.key === v.section; })[0];
    return meta ? localizeSectionMeta(meta) : v.section;
  }
  function updateViewLabel() {
    $("#curView").textContent = viewLabel();
    var eb = $("#viewEyebrow");
    if (eb) eb.textContent = state.view.mode === "category" ? t("category") : t("section");
  }

  /* ---- view picker list -------------------------------------------------- */
  function buildViewList() {
    var wrap = $("#secList"); wrap.innerHTML = "";

    // Mixed flow (primary, default)
    var mix = document.createElement("button");
    mix.className = "sec-item primary"; mix.setAttribute("data-view", "mixed");
    mix.innerHTML = '<span class="sec-name">' + esc(t("mixedFlow")) + '<div class="sec-sub">' + esc(t("mixedSub")) + '</div></span><span class="sec-count">' + state.canonicalItems.length + '</span>';
    mix.addEventListener("click", function () { setView({ mode: "mixed" }); closeSheets(); });
    wrap.appendChild(mix);

    // Categories
    var ch = document.createElement("div"); ch.className = "sec-head"; ch.textContent = t("singleCategory"); wrap.appendChild(ch);
    CATS.forEach(function (c) {
      var n = categoryPlaylist(c).length; if (!n) return;
      var b = document.createElement("button");
      b.className = "sec-item"; b.setAttribute("data-view", "category:" + c);
      b.innerHTML = '<span class="sec-name">' + esc(localizeCategory(c)) + '</span><span class="sec-count">' + n + '</span>';
      b.addEventListener("click", function () { setView({ mode: "category", category: c }); closeSheets(); });
      wrap.appendChild(b);
    });

    // Sections (fine-grained browse)
    var sh = document.createElement("div"); sh.className = "sec-head"; sh.textContent = t("browseSection"); wrap.appendChild(sh);
    (state.sections.sections || []).forEach(function (s) {
      if (!s.count) return;
      var b = document.createElement("button");
      b.className = "sec-item"; b.setAttribute("data-view", "section:" + s.key);
      b.innerHTML = '<span class="sec-name">' + esc(localizeSectionMeta(s)) + '</span><span class="sec-count">' + s.count + '</span>';
      b.addEventListener("click", function () { setView({ mode: "section", section: s.key }); closeSheets(); });
      wrap.appendChild(b);
    });
  }
  function markViewList() {
    var v = state.view;
    var token = v.mode === "mixed" ? "mixed" : v.mode === "category" ? ("category:" + v.category) : ("section:" + v.section);
    $$(".sec-item").forEach(function (el) { el.classList.toggle("active", el.getAttribute("data-view") === token); });
  }
  function setView(v) {
    state.view = { mode: v.mode, category: v.category || state.view.category, section: v.section || state.view.section };
    state.settings.flowMode = (v.mode === "mixed") ? "mixed" : state.settings.flowMode;
    rebuildPlaylist(false);
  }

  /* ---- Qur'an Waqf / Rumuz al-Waqf rendering ----------------------------- */
  var WAQF_SIGNS = ["۝", "۩", "۞", "؞"];
  var WAQF_TOKEN_RE = /(^|[\s\u00a0،؛:؛\(\[\{])((?:قلى)|(?:صلى)|(?:لا)|[مجطزصقسع])(?=$|[\s\u00a0،؛:؛\.\)\]\}])/g;
  function hasWaqfSigns(text) {
    text = String(text || "");
    return /[۝۩۞؞]/.test(text) || WAQF_TOKEN_RE.test(text);
  }
  function isQuranicItem(it) {
    var src = String((it && it.source) || "").toLowerCase();
    var ver = String((it && it.verification) || "").toLowerCase();
    var tags = (it && it.tags || []).join(" ").toLowerCase();
    return ver === "quran" || src.indexOf("quran") >= 0 || tags.indexOf("quran") >= 0;
  }
  // Priority 6: suppress the card Bismillah row only when the item authentically
  // opens with the Basmalah, or is explicitly flagged, so it is never duplicated.
  var BASMALAH_NORM = "بسماللهالرحمنالرحيم";
  function normalizeArabic(s) {
    return String(s || "")
      .replace(/[\u064B-\u0652\u0670\u0653-\u065F\u06D6-\u06ED\u200C\u200D\u00A0]/g, "")
      .replace(/[\u0671\u0623\u0625\u0622]/g, "\u0627")
      .replace(/\s+/g, "");
  }
  function suppressCardBismillah(it) {
    return !!(it && it.hide_card_bismillah === true);
  }
  function escHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function cleanArabicParagraph(text) {
    text = String(text || "");
    if (state.settings.smartSentenceFlow === false) return text.trim();
    return text.replace(/\s*[\r\n]+\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
  }
  function renderArabicWithWaqf(text, showMarks) {
    text = cleanArabicParagraph(text);
    if (!showMarks) return escHtml(stripWaqfForDisplay(text));
    var html = escHtml(text);
    html = html.replace(WAQF_TOKEN_RE, function (m, pre, sign) {
      return pre + '<span class="waqf-mark" title="Qur’an pause mark">\u2060' + sign + '</span>';
    });
    html = html.replace(/([۝۩۞؞])/g, '<span class="waqf-mark ayah" title="Qur’an pause mark">\u2060$1</span>');
    return html;
  }
  function renderArabicReading(text) {
    text = cleanArabicParagraph(text);
    var html = escHtml(text);
    if (state.settings.showPauseMarks === false) return html;
    return html.replace(/([،؛۔])/g, '<span class="pause-symbol" aria-hidden="true">$1</span>');
  }
  function renderTajweedFallback(text) {
    text = String(text || "");
    var q = "قطبجد";
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i), nx = text.charAt(i + 1), nx2 = text.charAt(i + 2);
      var safe = escHtml(ch);
      if ("ۚۖۗۙۛۜۘ۞۩۝؞".indexOf(ch) >= 0) out += '<span class="waqf-mark ayah">' + safe + '</span>';
      else if (ch === "ٓ" || ch === "ٰ" || ("اوىي".indexOf(ch) >= 0 && i > 0)) out += '<span class="tw-madd">' + safe + '</span>';
      else if ((ch === "ن" || ch === "م") && (nx === "ّ" || nx2 === "ّ")) out += '<span class="tw-ghunnah">' + safe + '</span>';
      else if (q.indexOf(ch) >= 0 && nx === "ْ") out += '<span class="tw-qalqalah">' + safe + '</span>';
      else out += safe;
    }
    return out;
  }

  function stripWaqfForDisplay(text) {
    // Display-only hiding. The source database string remains unchanged.
    var out = String(text || "").replace(/[۝۩۞؞]/g, "");
    out = out.replace(WAQF_TOKEN_RE, function (m, pre) { return pre; });
    return out.replace(/\s{2,}/g, " ").trim();
  }
  function waqfLegendHtml() {
    return '<div class="waqf-legend" dir="ltr">' +
      '<div><b>۝</b><span>End of Ayah</span></div>' +
      '<div><b>م</b><span>Must stop</span></div>' +
      '<div><b>لا</b><span>Do not stop</span></div>' +
      '<div><b>ج</b><span>Stop or continue allowed</span></div>' +
      '<div><b>قلى</b><span>Better to stop</span></div>' +
      '<div><b>صلى</b><span>Better to continue</span></div>' +
      '<div><b>س</b><span>Brief pause without breath</span></div>' +
      '<div><b>؞ ؞</b><span>Stop at one of the paired places</span></div>' +
      '<div><b>۩</b><span>Sajdah Tilawah</span></div>' +
      '</div>';
  }

  /* ---- rendering --------------------------------------------------------- */
function autoSize(mode, scale) {
  ensureSettings();
  scale = Number(scale); if (!isFinite(scale)) scale = DEFAULTS.arScale;
  var base;
  if (IS_TV) {
    // Rev I-9: Arabic is the clear TV hero. Preserve strong presence and
    // allow respectful scrolling instead of shrinking the main Arabic down.
    base = { short: 92, normal: 82, long: 70, very_long: 60 }[mode] || 78;
  } else {
    base = { short: 46, normal: 36, long: 30, very_long: 25 }[mode] || 34;
  }
  var w = window.innerWidth, h = window.innerHeight, minDim = Math.min(w, h);
  if (!IS_TV) {
    if (minDim >= 820) base += 8;
    else if (minDim >= 680) base += 4;
  }
  if (h < 460) base = Math.round(base * 0.72);
  else if (h < 560) base = Math.round(base * 0.85);
  if (state.settings.easyView) base = Math.round(base * 1.12);
  if (state.settings.arabicScript === "indopak") base = Math.round(base * 1.06);
  return Math.round(base * scale);
}

  function render() {
    ensureSettings();
    var it = state.playlist[state.index];
    if (!it) { renderEmptyState(); return; }
    var s = state.settings, reader = $("#reader");
    reader.setAttribute("data-size", it.size_mode);

    var ar = autoSize(it.size_mode, s.arScale);
    reader.style.setProperty("--ar-size", ar + "px");
    // Nastaliq needs a much taller line box than Naskh.
    reader.style.setProperty("--ar-lh", s.arabicScript === "indopak" ? "1.92" : "1.46");
    var tvAdd = IS_TV ? 4 : 0;
    var tl0 = Math.round(((it.size_mode === "short" ? 18 : 16) + tvAdd) * s.tlScale);
    var tr0 = Math.round(((it.size_mode === "short" ? 19 : 17) + tvAdd) * s.trScale);
    reader.style.setProperty("--tl-size", tl0 + "px");
    reader.style.setProperty("--tr-size", tr0 + "px");

    var arEl = $("#mArabic");
    var bism = $("#mBismillah");
    if (bism) bism.classList.toggle("hidden", suppressCardBismillah(it));
    arEl.setAttribute("data-script", s.arabicScript);
    arEl.setAttribute("data-weight", s.arabicWeight || "thick");
    arEl.style.fontFamily = (s.arabicScript === "indopak") ? AR_FONTS.nastaliq : (AR_FONTS[s.arabicFont] || AR_FONTS.scheherazade);
    var bis = $("#mBismillah"); if (bis) { bis.setAttribute("data-bismillah-size", s.bismillahSize || "large"); bis.setAttribute("data-bismillah-color", s.bismillahColor || "olive"); }
    // Tajweed colouring. Qur'anic items use bundled, reviewed markup; all other
    // content uses the rule-based fallback highlighter. Source Arabic is never altered.
    if (s.showArabic === false) { arEl.innerHTML = ""; arEl.classList.add("hidden"); arEl.classList.remove("tajweed-active"); }
    else {
      arEl.classList.remove("hidden");
      var useTajweed = !!s.tajweed;
      arEl.classList.toggle("tajweed-active", useTajweed);
      if (useTajweed && it.tajweed_html) arEl.innerHTML = it.tajweed_html;
      else if (useTajweed) arEl.innerHTML = renderTajweedFallback(it.arabic);
      else if (isQuranicItem(it)) arEl.innerHTML = renderArabicWithWaqf(it.arabic, s.showPauseMarks !== false);
      else arEl.innerHTML = renderArabicReading(it.arabic);
    }

    $("#mCategory").textContent = localizeCategory(it.category);
    $("#mType").textContent = localizeType(it.type);
    var titleTxt = localizeTitle(it);
    $("#mTitle").textContent = titleTxt;
    $("#mTitle").classList.toggle("hidden", !titleTxt);
    $("#mFlowTag").textContent = (state.view.mode === "mixed") ? localizeCategory(it.main_category || "") : "";

    // Visibility is independent: Arabic, transliteration, English, Urdu and reference.
    setLine("#mTranslit", it.transliteration, s.showTranslit);
    var trEl = $("#mTranslit"); if (trEl) trEl.setAttribute("dir", "ltr");
    setLine("#mTranslation", it.translation, s.showEnglish !== false);
    var tnEl = $("#mTranslation"); if (tnEl) { tnEl.setAttribute("dir", "ltr"); tnEl.classList.remove("ur-text"); }
    setLine("#mUrdu", it.translation_ur, s.showUrdu !== false);
    var urEl = $("#mUrdu"); if (urEl) { urEl.setAttribute("dir", "rtl"); urEl.classList.add("ur-text"); }
    $("#mSource").textContent = it.source || "";
    $("#mSource").setAttribute("dir", "ltr");
    $("#mSource").parentElement.classList.toggle("hidden", !s.showSource || !it.source);

    var rep = $("#mRepeat"), r = parseRepeat(it.repeat);
    if (r && r > 1) { rep.textContent = "\u00d7" + r; rep.classList.remove("hidden"); }
    else rep.classList.add("hidden");

    var v = $("#mVerify");
    v.className = "verify " + it.verification;
    $("#mVerifyText").textContent = ({ quran: t("vQuran"), hadith: t("vHadith"), compilation: t("vCompilation") })[it.verification] || t("vHadith");
    var pct = state.playlist.length > 1 ? (state.index / (state.playlist.length - 1)) * 100 : 100;
    $("#progressFill").style.width = pct + "%";
    $("#counterText").textContent = (state.index + 1) + " / " + state.playlist.length;

    requestAnimationFrame(function () { fitContent(arEl, ar, tl0, tr0); });
    savePos();
  }


  function renderEmptyState() {
    var reader = $("#reader");
    if (reader) reader.setAttribute("data-size", "normal");
    var arEl = $("#mArabic");
    if (arEl) {
      arEl.classList.remove("hidden", "tajweed-active");
      arEl.textContent = state.emptyMessage || "No content available.";
      arEl.style.fontSize = "32px";
    }
    setLine("#mTranslit", "", false);
    setLine("#mTranslation", "", false);
    setLine("#mUrdu", "", false);
    setLine("#mSource", "", false);
    $("#mCategory").textContent = "Content";
    $("#mType").textContent = "Unavailable";
    $("#mTitle").textContent = "Section content unavailable";
    $("#mVerifyText").textContent = "Review data";
    $("#progressFill").style.width = "0%";
    $("#counterText").textContent = "No items available";
  }

  // Dynamic fit. Always: shrink Arabic so it never overflows the card width
  // (no clipping / one-word-per-line). On TV with "Fit full content" (default,
  // and always in Easy View): also shrink the whole card — Arabic first, then
  // transliteration + translation — until the entire dua fits one screen with
  // no vertical scrolling, down to a sensible minimum readable size.
function fitContent(arEl, arStart, tlStart, trStart) {
  var reader = $("#reader"), sc = $("#readerScroll");
  if (!reader || !sc || !arEl) return;
  var mode = reader.getAttribute("data-size") || "normal";
  var size = arStart;
  var wmin = IS_TV ? Math.max(36, Math.round(arStart * 0.62)) : Math.max(16, Math.round(arStart * 0.5));
  var guard = 0;
  while (arEl.scrollWidth > arEl.clientWidth + 1 && size > wmin && guard < 44) {
    size -= 1; arEl.style.fontSize = size + "px"; guard++;
  }

  // Rev I-8: full-height fitting is useful for short duas only. For long and
  // very-long Arabic, preserve presence and allow respectful vertical scroll.
  var allowFullFit = IS_TV ? (mode === "short") : !(mode === "long" || mode === "very_long");
  var autoFit = allowFullFit && IS_TV && (state.settings.tvFit !== false || state.settings.easyView);
  if (autoFit) {
    var AR_MIN = Math.max(70, Math.round(arStart * 0.80)), TL_MIN = 18, TR_MIN = 18, tl = tlStart, tr = trStart, g = 0;
    var FILL = 0.985;
    var over = function () { return sc.scrollHeight > (sc.clientHeight * FILL) + 1; };
    while (over() && size > AR_MIN && g < 70) { size -= 1; arEl.style.fontSize = size + "px"; g++; }
    while (over() && (tl > TL_MIN || tr > TR_MIN) && g < 150) {
      if (tl > TL_MIN) tl -= 1;
      if (tr > TR_MIN) tr -= 1;
      reader.style.setProperty("--tl-size", tl + "px");
      reader.style.setProperty("--tr-size", tr + "px");
      g++;
    }
  }
  reader.classList.toggle("can-scroll", sc.scrollHeight - sc.clientHeight > 24);
  sc.scrollTop = Math.max(0, state.pendingScrollTop || 0);
  state.pendingScrollTop = 0;
}

  function setLine(sel, text, show) {
    var el = $(sel);
    if (!el) return;
    if (show && text) { el.textContent = text; el.classList.remove("hidden"); }
    else el.classList.add("hidden");
  }

  function go(delta) {
    if (!state.playlist.length) return;
    var ni = (state.index + delta + state.playlist.length) % state.playlist.length;
    if (ni === state.index) return;
    savePos();
    state.index = ni;
    state.pendingScrollTop = 0;
    render();
    savePos();
  }

  /* ---- auto rotation ----------------------------------------------------- */
  function setAuto(on) {
    state.settings.autoRotate = on;
    $("#autoFlag").classList.toggle("on", on);
    clearInterval(state.autoTimer);
    if (on) state.autoTimer = setInterval(function () { go(1); }, Math.max(5, state.settings.interval) * 1000);
  }
  function pokeAuto() { if (state.settings.autoRotate) setAuto(true); }

  // Scroll the reader by dy. Uses smooth scrollTo where supported and falls
  // back to a plain scrollTop assignment on older WebView builds (where the
  // options-dictionary form of scrollBy/scrollTo is unavailable and throws).
  function scrollReader(dy) {
    var sc = $("#readerScroll");
    var target = Math.max(0, sc.scrollTop + dy);
    try {
      if (typeof sc.scrollTo === "function") { sc.scrollTo({ top: target, behavior: "smooth" }); return; }
    } catch (e) { /* fall through */ }
    sc.scrollTop = target;
  }

  /* ---- copy + share (phone/tablet share; hidden on TV) -------------------- */
  function buildShareText(it) {
    var parts = [];
    var title = localizeTitle(it); if (title) parts.push(title);
    if (it.arabic) parts.push(it.arabic);
    if (it.transliteration) parts.push(it.transliteration);
    if (it.translation) parts.push(it.translation);
    if (state.settings.showUrdu !== false && it.translation_ur) parts.push(it.translation_ur);
    if (it.source) parts.push(t("reference") + ": " + it.source);
    parts.push("Dua & Zikr");
    return parts.join("\n\n");
  }
  function copyCurrent() {
    var it = state.playlist[state.index]; if (!it) return;
    var text = buildShareText(it);
    var done = function () { toast(t("copied")); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacyCopy(text, done); });
    } else legacyCopy(text, done);
  }
  function shareCurrent() {
    if (IS_TV) return;
    var it = state.playlist[state.index]; if (!it) return;
    var text = buildShareText(it);
    shareCardPng(it, function (file, dataUrl) {
      // Share the image only. The card PNG already contains every required line
      // (Bismillah, title, Arabic, transliteration, English, Urdu, source, app name),
      // so no separate text is attached. `text` is kept solely as a fallback for
      // the rare case where no image can be produced.
      try {
        if (dataUrl && window.AzkarShare && typeof window.AzkarShare.sharePng === "function") {
          window.AzkarShare.sharePng(dataUrl, text);
          return;
        }
      } catch (e) {}
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        navigator.share({ files: [file] }).catch(function () { shareTextFallback(text); });
      } else shareTextFallback(text);
    });
  }
  function shareTextFallback(text) {
    try {
      if (window.AzkarShare && typeof window.AzkarShare.shareText === "function") { window.AzkarShare.shareText(text); return; }
    } catch (e) {}
    legacyCopy(text, function () { toast(t("shareTextCopied")); });
  }
  function shareCardPng(it, cb) {
    try {
      var ratio = Math.min(2, window.devicePixelRatio || 1);
      var css = getComputedStyle(document.body);
      var bg = css.getPropertyValue("--surface").trim() || "#ffffff";
      var bg2 = css.getPropertyValue("--surface-2").trim() || bg;
      var fg = css.getPropertyValue("--arabic").trim() || "#111111";
      var muted = css.getPropertyValue("--translation").trim() || "#333333";
      var accent = css.getPropertyValue("--accent").trim() || "#b18431";
      var w = 1080, pad = 76, maxW = w - pad * 2;
      var probe = document.createElement("canvas").getContext("2d");
      var blocks = [];
      function addBlock(text, font, lh, color, align, rtl, topGap, maxLines) {
        text = String(text || "").replace(/\s+/g, " ").trim();
        if (!text) return;
        probe.font = font;
        blocks.push({ text:text, font:font, lh:lh, color:color, align:align || "center", rtl:!!rtl, topGap:topGap || 0, lines:wrapLines(probe, text, maxW, maxLines || 999) });
      }
      addBlock("Dua & Zikr", "700 44px sans-serif", 58, accent, "center", false, 0, 1);
      addBlock("بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ", "600 44px serif", 64, accent, "center", true, 16, 1);
      addBlock(localizeTitle(it), "700 34px sans-serif", 48, fg, "center", state.settings.lang === "ur", 20, 3);
      addBlock(stripWaqfForDisplay(it.arabic || ""), "700 56px serif", 82, fg, "center", true, 40, 999);
      addBlock(it.transliteration || "", "500 32px serif", 46, muted, "center", false, 34, 999);
      addBlock(it.translation || "", "500 32px sans-serif", 46, muted, "center", false, 26, 999);
      if (state.settings.showUrdu !== false && it.translation_ur) addBlock(it.translation_ur, "500 34px serif", 58, muted, "center", true, 28, 999);
      addBlock((it.source ? t("reference") + ": " + it.source : ""), "700 25px sans-serif", 36, accent, "center", false, 34, 3);
      var h = pad + 28;
      blocks.forEach(function (b) { h += b.topGap + Math.max(b.lh, b.lines.length * b.lh); });
      h += pad;
      h = Math.max(1440, Math.min(3400, Math.ceil(h)));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      var ctx = canvas.getContext("2d"); ctx.scale(ratio, ratio);
      ctx.fillStyle = bg; roundRect(ctx, 0, 0, w, h, 34); ctx.fill();
      ctx.fillStyle = bg2; roundRect(ctx, 30, 30, w - 60, h - 60, 30); ctx.fill();
      var y = pad;
      blocks.forEach(function (b) {
        y += b.topGap;
        ctx.font = b.font; ctx.fillStyle = b.color; ctx.textAlign = b.align; ctx.direction = b.rtl ? "rtl" : "ltr";
        b.lines.forEach(function (line) { ctx.fillText(line, w / 2, y); y += b.lh; });
      });
      ctx.direction = "ltr";
      var dataUrl = "";
      try { dataUrl = canvas.toDataURL("image/png"); } catch (e) { dataUrl = ""; }
      canvas.toBlob(function (blob) {
        var file = null;
        if (blob) { try { file = new File([blob], "dua-zikr-card.png", { type: "image/png" }); } catch (e) {} }
        cb(file, dataUrl);
      }, "image/png", 0.95);
    } catch (e) { cb(null, ""); }
  }
  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
    var line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = words[i];
        if (lines.length >= maxLines) break;
      } else line = test;
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function legacyCopy(text, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta); cb();
    } catch (e) { toast(t("shareUnavailable")); }
  }

  /* ---- gestures + keys (touch + D-pad) ----------------------------------- */
  function bindGlobal() {
    $("#prevBtn").addEventListener("click", function () { go(-1); pokeAuto(); });
    $("#nextBtn").addEventListener("click", function () { go(1); pokeAuto(); });
    $("#copyBtn").addEventListener("click", copyCurrent);
    var sh = $("#shareBtn"); if (sh) sh.addEventListener("click", shareCurrent);
    function stepArabic(d) {
      ensureSettings();
      var v = Math.min(2.0, Math.max(0.7, Math.round((state.settings.arScale + d) * 100) / 100));
      state.settings.arScale = v;
      if (state.draft) state.draft.arScale = v;
      save();
      applyBodyFlags();
      if (IS_TV) applyTvLivePreviewValues(state.settings);
      else render();
      if (IS_TV && $("#settingsSheet.open")) syncSettingsUI();
      toast((state.settings.lang === "ur" ? "عربی سائز " : "Arabic size ") + Math.round(v * 100) + "%");
    }
    var aDec = $("#arDec"); if (aDec) aDec.addEventListener("click", function () { stepArabic(-0.1); });
    var aInc = $("#arInc"); if (aInc) aInc.addEventListener("click", function () { stepArabic(0.1); });
    $("#contrastBtn").addEventListener("click", function () {
      ensureSettings();
      if (IS_TV) {
        var cycle = ["dark-ambient", "elder-light", "high-contrast"];
        var idx = cycle.indexOf(state.settings.theme);
        state.settings.theme = cycle[(idx + 1 + cycle.length) % cycle.length];
        state.settings.highContrast = state.settings.theme === "high-contrast";
        if (state.draft) { state.draft.theme = state.settings.theme; state.draft.highContrast = state.settings.highContrast; }
        applyTheme(state.settings.theme); applyBodyFlags(); render(); save();
        if ($("#settingsSheet.open")) syncSettingsUI();
        toast(state.settings.theme === "elder-light" ? "Calm light theme" : (state.settings.theme === "high-contrast" ? "High contrast" : "Dark theme"));
        return;
      }
      if (state.settings.theme !== "high-contrast") {
        state.prevTheme = state.settings.theme;
        state.settings.theme = "high-contrast";
      } else {
        state.settings.theme = state.prevTheme || "dark-ambient";
      }
      applyTheme(state.settings.theme); save();
      toast(state.settings.theme === "high-contrast" ? (state.settings.lang === "ur" ? "ہائی کنٹراسٹ آن" : "High contrast on") : (state.settings.lang === "ur" ? "ہائی کنٹراسٹ آف" : "High contrast off"));
    });

    document.addEventListener("keydown", onKey);

    // horizontal swipe on the main reading stage; vertical reserved for scrolling
    var sx = 0, sy = 0, t0 = 0, longTimer = null, moved = false, touchActive = false;
    var reader = $("#reader");
    var gestureTarget = $(".stage") || reader;
    gestureTarget.addEventListener("touchstart", function (e) {
      touchActive = false;
      if (e.target.closest && e.target.closest("button, input, select, textarea, .sheet")) return;
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = Date.now(); moved = false; touchActive = true;
      longTimer = setTimeout(function () {
        if (touchActive && !moved) { setAuto(!state.settings.autoRotate); toast(state.settings.autoRotate ? (state.settings.lang === "ur" ? "خودکار تبدیلی آن" : "Auto-rotation on") : (state.settings.lang === "ur" ? "خودکار تبدیلی بند" : "Auto-rotation paused")); save(); }
      }, 620);
    }, { passive: true });
    gestureTarget.addEventListener("touchmove", function (e) {
      if (!touchActive) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - sx) > 8 || Math.abs(t.clientY - sy) > 8) { moved = true; clearTimeout(longTimer); }
    }, { passive: true });
    gestureTarget.addEventListener("touchend", function (e) {
      if (!touchActive) return;
      touchActive = false;
      clearTimeout(longTimer);
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - t0;
      if (state.settings.swipeNav !== false && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && dt < 700) {
        if (dx < 0) go(1); else go(-1); pokeAuto();
      }
    }, { passive: true });

    $("#viewPick").addEventListener("click", function () {
      var sb = $("#secSearch"); if (sb) { sb.value = ""; renderSearch(""); }
      openSheet("#sectionSheet");
    });
    var secSearch = $("#secSearch");
    if (secSearch) secSearch.addEventListener("input", function () { renderSearch(this.value); });

    $("#openSettings").addEventListener("click", openSettings);
    var mb = $("#menuBtn"); if (mb) mb.addEventListener("click", openSettings);
    $("#scrim").addEventListener("click", closeSheets);
    $$("[data-close]").forEach(function (b) { b.addEventListener("click", closeSheets); });
    $("#applyBtn").addEventListener("click", applySettings);

    window.addEventListener("resize", function () { render(); });
    window.addEventListener("orientationchange", function () { setTimeout(render, 120); });
    window.addEventListener("online", refreshConnDot);
    window.addEventListener("offline", refreshConnDot);
    var scroller = $("#readerScroll");
    if (scroller) scroller.addEventListener("scroll", function () {
      clearTimeout(state.scrollTimer);
      state.scrollTimer = setTimeout(savePos, 120);
    }, { passive: true });

    if (IS_TV) $("#reader").focus();
  }

  // ----- TV / D-pad focus model -----------------------------------------
  // Zones, top to bottom: 0 top bar | 1 prayer ribbon | 2 reader | 3 footer.
  var READER_ZONE = 2;
  function elVisible(el) { return el && el.offsetParent !== null && !el.classList.contains("hidden"); }
  function zoneEls(z) {
    var list;
    if (z === 0) list = [$("#viewPick"), $("#arDec"), $("#arInc"), $("#contrastBtn"), $("#openSettings")].filter(function (el) { return el && el.offsetParent !== null; });
    else if (z === 1) list = [$("#prayerRibbon")];
    else if (z === 3) list = [$("#menuBtn"), $("#prevBtn"), $("#nextBtn")];
    else list = [];
    return list.filter(elVisible);
  }
  function validZones() {
    var z = [];
    if (zoneEls(0).length) z.push(0);
    if (zoneEls(1).length) z.push(1);
    z.push(READER_ZONE);
    if (zoneEls(3).length) z.push(3);
    return z;
  }
  function clearChromeFocus() { $$(".tv-focus").forEach(function (el) { el.classList.remove("tv-focus"); }); }
  function focusZone(z, col) {
    if (!state.nav) state.nav = { zone: READER_ZONE, col: 0 };
    clearChromeFocus();
    if (z === READER_ZONE) { state.nav.zone = READER_ZONE; var r = $("#reader"); if (r) r.focus(); return; }
    var list = zoneEls(z);
    if (!list.length) { focusZone(READER_ZONE, 0); return; }
    col = Math.max(0, Math.min(col == null ? state.nav.col : col, list.length - 1));
    state.nav.zone = z; state.nav.col = col;
    var el = list[col]; el.classList.add("tv-focus");
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
  }

  // Rev I-6: when Android TV WebView gives native focus to a button, align the
  // internal remote model to that focused element before handling Enter/OK.
  function syncNavFromActiveElement() {
    if (!IS_TV) return;
    var ae = document.activeElement;
    if (!ae || ae === document.body) return;
    var zones = [0, 1, 3];
    for (var zi = 0; zi < zones.length; zi++) {
      var z = zones[zi], list = zoneEls(z), idx = list.indexOf(ae);
      if (idx >= 0) { state.nav = { zone: z, col: idx }; clearChromeFocus(); ae.classList.add("tv-focus"); return; }
    }
  }
  function stepZone(dir) {
    var zs = validZones(), i = zs.indexOf(state.nav ? state.nav.zone : READER_ZONE);
    if (i < 0) i = zs.indexOf(READER_ZONE);
    var ni = Math.max(0, Math.min(i + dir, zs.length - 1));
    if (ni !== i) focusZone(zs[ni], state.nav ? state.nav.col : 0);
  }
  function readerCanScroll(dir) {
    var sc = $("#readerScroll"); if (!sc) return false;
    return dir < 0 ? sc.scrollTop > 4 : sc.scrollTop < (sc.scrollHeight - sc.clientHeight - 4);
  }

  /* ---- TV Settings deterministic focus walker ------------------------------ */
  function normalizeTvKey(key) {
    var k = String(key || "");
    if (k === "DPAD_UP") return "ArrowUp";
    if (k === "DPAD_DOWN") return "ArrowDown";
    if (k === "DPAD_LEFT") return "ArrowLeft";
    if (k === "DPAD_RIGHT") return "ArrowRight";
    if (k === "DPAD_CENTER" || k === "OK" || k === "NumpadEnter") return "Enter";
    if (k === "Back" || k === "GoBack" || k === "BrowserBack") return "Escape";
    if (k === "Spacebar") return " ";
    return k;
  }

  function clearTvSettingsFocus() {
    $$(".tv-row-focus, .tv-control-focus").forEach(function (el) {
      el.classList.remove("tv-row-focus", "tv-control-focus");
      if (el.hasAttribute("data-tv-tab-managed")) el.setAttribute("tabindex", "-1");
    });
  }

  function tvVisible(el) {
    if (!el || el.disabled || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    return el.offsetParent !== null;
  }

  function tvSettingEntryFromRow(row) {
    var controls = [];
    var kind = "info";
    var stepper = row.querySelector(".tv-stepper");
    var seg = row.querySelector(".tv-seg");
    var cycle = row.querySelector(".tv-cycle");
    var toggle = row.querySelector(".tv-toggle");
    var action = row.querySelector("button.tv-info-action");

    if (stepper) {
      kind = "stepper";
      controls = Array.prototype.slice.call(stepper.querySelectorAll("button")).filter(tvVisible);
    } else if (seg) {
      kind = "seg";
      controls = Array.prototype.slice.call(seg.querySelectorAll("button")).filter(tvVisible);
    } else if (cycle) {
      kind = "cycle";
      controls = [cycle].filter(tvVisible);
    } else if (toggle) {
      kind = "toggle";
      controls = [toggle].filter(tvVisible);
    } else if (action) {
      kind = "action";
      controls = [action].filter(tvVisible);
    }

    return { row: row, controls: controls, kind: kind };
  }

  function tvSettingsRows() {
    if (!IS_TV) return [];
    var sh = $("#settingsSheet.open");
    if (!sh) return [];
    var out = [];
    var back = $("#settingsSheet .sheet-head [data-close]");
    if (tvVisible(back)) out.push({ row: back, controls: [back], kind: "back" });

    $$("#settingsBody .tv-set-row").forEach(function (row) {
      if (!tvVisible(row)) return;
      out.push(tvSettingEntryFromRow(row));
    });

    var apply = $("#settingsSheet .btn-apply");
    if (tvVisible(apply)) out.push({ row: apply, controls: [apply], kind: "apply" });

    out.forEach(function (entry, idx) {
      entry.index = idx;
      if (entry.row) {
        entry.row.setAttribute("tabindex", "-1");
        entry.row.setAttribute("data-tv-tab-managed", "1");
        entry.row.setAttribute("data-tv-focus-kind", entry.kind);
      }
      (entry.controls || []).forEach(function (c) {
        c.setAttribute("tabindex", "-1");
        c.setAttribute("data-tv-tab-managed", "1");
      });
    });
    return out;
  }

  function activeControlIndex(entry) {
    if (!entry || !entry.controls || !entry.controls.length) return 0;
    if (entry.kind === "stepper") return Math.min(state.tvSettingsNav && state.tvSettingsNav.option != null ? state.tvSettingsNav.option : 1, entry.controls.length - 1);
    var active = -1;
    entry.controls.forEach(function (c, i) {
      if (c.classList.contains("active") || c.classList.contains("on") || c.getAttribute("aria-pressed") === "true") active = i;
    });
    return active >= 0 ? active : 0;
  }

  function setTvSettingsFocus(rowIndex, optionIndex, scroll) {
    var rows = tvSettingsRows();
    if (!rows.length) return false;
    rowIndex = Math.max(0, Math.min(rowIndex == null ? 0 : rowIndex, rows.length - 1));
    var entry = rows[rowIndex];
    var controls = entry.controls || [];
    if (optionIndex == null) optionIndex = activeControlIndex(entry);
    optionIndex = controls.length ? Math.max(0, Math.min(optionIndex, controls.length - 1)) : 0;
    state.tvSettingsNav = { row: rowIndex, option: optionIndex };

    clearChromeFocus();
    clearTvSettingsFocus();
    if (entry.row) entry.row.classList.add("tv-row-focus");

    var target = controls[optionIndex] || entry.row;
    if (target) {
      target.classList.add("tv-control-focus");
      target.setAttribute("data-tv-focus-kind", entry.kind || "control");
      try { target.focus({ preventScroll: true }); } catch (e) { try { target.focus(); } catch (e2) {} }
    }
    if (scroll !== false && entry.row) {
      try { entry.row.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      catch (e3) { try { entry.row.scrollIntoView(false); } catch (e4) {} }
    }
    return true;
  }

  function initTvSettingsFocus(preferDefault) {
    var rows = tvSettingsRows();
    if (!rows.length) return false;
    var row = 0, option = 0;
    if (preferDefault) {
      for (var i = 0; i < rows.length; i++) {
        var j = rows[i].controls.indexOf($("#settingsSheet .tv-default-focus"));
        if (j >= 0) { row = i; option = j; break; }
      }
    } else if (state.tvSettingsNav) {
      row = state.tvSettingsNav.row;
      option = state.tvSettingsNav.option;
    }
    return setTvSettingsFocus(row, option, true);
  }

  function refreshTvSettingsFocus() {
    if (!IS_TV || !$("#settingsSheet.open")) return;
    var row = state.tvSettingsNav ? state.tvSettingsNav.row : 0;
    var option = state.tvSettingsNav ? state.tvSettingsNav.option : null;
    setTvSettingsFocus(row, option, false);
  }

  function tvClick(el) {
    if (el && typeof el.click === "function") { el.click(); return true; }
    return false;
  }

  function tvSettingsChangeSeg(entry, dir) {
    var controls = entry.controls || [];
    if (!controls.length) return false;
    var cur = activeControlIndex(entry);
    var next = Math.max(0, Math.min(cur + dir, controls.length - 1));
    if (next === cur && controls.length > 1) next = dir > 0 ? controls.length - 1 : 0;
    setTvSettingsFocus(state.tvSettingsNav.row, next, true);
    return tvClick(controls[next]);
  }

  function tvSettingsActivate(entry, dir) {
    if (!entry) return false;
    var controls = entry.controls || [];
    var option = state.tvSettingsNav ? state.tvSettingsNav.option : activeControlIndex(entry);

    if (entry.kind === "back") { closeSheets(); return true; }
    if (entry.kind === "apply") return tvClick(controls[0]);
    if (entry.kind === "info") { toast("Information only"); return true; }

    if (entry.kind === "stepper") {
      var stepTarget = dir < 0 ? controls[0] : (dir > 0 ? controls[Math.min(1, controls.length - 1)] : controls[option] || controls[Math.min(1, controls.length - 1)]);
      if (dir < 0) setTvSettingsFocus(state.tvSettingsNav.row, 0, true);
      if (dir > 0) setTvSettingsFocus(state.tvSettingsNav.row, Math.min(1, controls.length - 1), true);
      return tvClick(stepTarget || controls[option]);
    }

    if (entry.kind === "cycle") {
      tvCycleChoice(controls[0], dir || 1);
      return true;
    }

    if (entry.kind === "toggle") {
      var control = controls[0];
      if (!control) return false;
      if (dir < 0 || dir > 0) {
        var key = control.getAttribute("data-tv-toggle");
        var draft = ensureDraft();
        if (key) {
          draft[key] = dir > 0;
          if (key === "showEnglish") draft.showTranslation = !!draft.showEnglish;
          commitTvDraftLive(false);
          syncSettingsUI();
          refreshTvSettingsFocus();
          return true;
        }
      }
      return tvClick(control);
    }

    if (entry.kind === "seg") {
      if (dir < 0 || dir > 0) return tvSettingsChangeSeg(entry, dir);
      return tvClick(controls[option] || controls[activeControlIndex(entry)]);
    }

    return tvClick(controls[option]);
  }

  function tvSettingsKey(keyOrEvent) {
    var key = normalizeTvKey(keyOrEvent && keyOrEvent.key ? keyOrEvent.key : keyOrEvent);
    var evt = keyOrEvent && keyOrEvent.preventDefault ? keyOrEvent : null;
    var rows = tvSettingsRows();
    if (!rows.length) { if (evt) evt.preventDefault(); return true; }
    if (!state.tvSettingsNav) initTvSettingsFocus(true);
    var nav = state.tvSettingsNav || { row: 0, option: 0 };
    var entry = rows[Math.max(0, Math.min(nav.row, rows.length - 1))];
    var handled = true;

    switch (key) {
      case "ArrowDown":
        setTvSettingsFocus(nav.row + 1, null, true);
        break;
      case "ArrowUp":
        setTvSettingsFocus(nav.row - 1, null, true);
        break;
      case "ArrowRight":
        tvSettingsActivate(entry, 1);
        break;
      case "ArrowLeft":
        tvSettingsActivate(entry, -1);
        break;
      case "Enter": case " ":
        tvSettingsActivate(entry, 0);
        break;
      case "Escape":
        closeSheets();
        break;
      default:
        handled = false;
        break;
    }
    if (handled && evt) evt.preventDefault();
    return handled;
  }

  /* ---- in-sheet D-pad focus (so every settings control is remote-reachable) */
  function sheetFocusables() {
    var sh = $(".sheet.open"); if (!sh) return [];
    return Array.prototype.slice.call(sh.querySelectorAll("button, select, input[type=checkbox], input[type=radio]"))
      .filter(function (el) {
        if (el.disabled || el.hidden || el.getAttribute("aria-hidden") === "true") return false;
        var host = el.closest(".tv-set-row, .tv-seg, .tv-stepper, .set-row, .theme-card, .settings-cat-chip, .sec-item, .seg, .sheet-foot, .sheet-head, .set-group") || el;
        return host.offsetParent !== null;   // visible by layout (switch inputs are 0-size)
      });
  }
  function sheetRing(el) {
    $$(".tv-focus").forEach(function (x) { x.classList.remove("tv-focus"); });
    var row = el.closest(".tv-set-row, .tv-seg button, .tv-stepper button, .set-row, .theme-card, .settings-cat-chip, .sec-item, .seg button, .sheet-foot button, .sheet-head button");
    (row || el).classList.add("tv-focus");
  }
  function sheetMove(dir) {
    var els = sheetFocusables(); if (!els.length) return;
    var cur = els.indexOf(document.activeElement);
    cur = cur < 0 ? 0 : Math.max(0, Math.min(els.length - 1, cur + dir));
    var el = els[cur];
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) {} }
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { try { el.scrollIntoView(false); } catch (e2) {} }
    sheetRing(el);
  }
  function sheetKey(e) {
    switch (e.key) {
      case "ArrowDown": case "ArrowRight": sheetMove(1); e.preventDefault(); break;
      case "ArrowUp": case "ArrowLeft": sheetMove(-1); e.preventDefault(); break;
      case "Enter": case " ": case "Spacebar":
        if (document.activeElement && typeof document.activeElement.click === "function") document.activeElement.click();
        e.preventDefault(); break;
      default: break;
    }
  }

  function onKey(e) {
    // While a sheet is open, TV Settings uses a deterministic row walker.
    // This avoids Android TV/WebView native focus traps and skipped rows.
    if (anySheetOpen()) {
      if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack") { closeSheets(); e.preventDefault(); return; }
      if (IS_TV && $("#settingsSheet.open")) { tvSettingsKey(e); return; }
      sheetKey(e);
      return;
    }
    if (IS_TV) syncNavFromActiveElement();
    if (!state.nav) state.nav = { zone: READER_ZONE, col: 0 };
    var zone = state.nav.zone, sc = $("#readerScroll");
    switch (e.key) {
      case "ArrowUp":
        if (zone === READER_ZONE && readerCanScroll(-1)) scrollReader(-Math.round(sc.clientHeight * 0.5));
        else stepZone(-1);
        e.preventDefault(); break;
      case "ArrowDown":
        if (zone === READER_ZONE && readerCanScroll(1)) scrollReader(Math.round(sc.clientHeight * 0.5));
        else stepZone(1);
        e.preventDefault(); break;
      case "ArrowLeft":
        if (zone === READER_ZONE) { go(-1); pokeAuto(); } else focusZone(zone, state.nav.col - 1);
        e.preventDefault(); break;
      case "ArrowRight":
        if (zone === READER_ZONE) { go(1); pokeAuto(); } else focusZone(zone, state.nav.col + 1);
        e.preventDefault(); break;
      case "Enter": case " ": case "Spacebar":
        if (zone === READER_ZONE) {
          setAuto(!state.settings.autoRotate);
          toast(state.settings.autoRotate ? (state.settings.lang === "ur" ? "خودکار تبدیلی آن" : "Auto-rotation on") : (state.settings.lang === "ur" ? "خودکار تبدیلی بند" : "Auto-rotation paused")); save();
        } else if (zone === 1) { /* ribbon is informational; OK does nothing */ }
        else {
          var list = zoneEls(zone), el = list[state.nav.col];
          if (!el && document.activeElement && typeof document.activeElement.click === "function") el = document.activeElement;
          if (el && typeof el.click === "function") el.click();
        }
        e.preventDefault(); break;
      case "Escape": case "GoBack": case "BrowserBack":
        if (zone !== READER_ZONE) { focusZone(READER_ZONE, 0); e.preventDefault(); }
        break;
      default: break;
    }
  }

  /* ---- sheets ------------------------------------------------------------ */
  function openSheet(sel) {
    $("#scrim").classList.add("open"); $(sel).classList.add("open");
    if (IS_TV) {
      requestAnimationFrame(function () {
        if (sel === "#settingsSheet") { initTvSettingsFocus(true); return; }
        var els = sheetFocusables();
        var f = $(sel + " .sec-item.active") || $(sel + " .tv-default-focus") || els[0];
        if (f) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } sheetRing(f); }
      });
    }
  }
  function anySheetOpen() { return $(".sheet.open") != null; }
  function closeSheets() {
    $("#scrim").classList.remove("open");
    $$(".sheet").forEach(function (s) { s.classList.remove("open"); });
    state.nav = { zone: READER_ZONE, col: 0 };
    state.tvSettingsNav = null;
    if (typeof clearChromeFocus === "function") clearChromeFocus();
    clearTvSettingsFocus();
    if (IS_TV) $("#reader").focus();
  }
  function openSettings() { ensureSettings(); state.draft = normalizeSettings(state.settings); buildSettings(); syncSettingsUI(); openSheet("#settingsSheet"); }

  /* ---- search any du'a by name and jump straight to it ------------------- */
  function goToItem(id) {
    var i, it = null;
    for (i = 0; i < state.sectionItems.length; i++) {
      if (state.sectionItems[i].id === id || state.sectionItems[i].canonical_id === id || state.sectionItems[i].display_id === id) { it = state.sectionItems[i]; break; }
    }
    if (!it) return;
    state.view = { mode: "section", section: it.section, category: state.view.category };
    state.playlist = state.sectionItems.filter(function (x) { return x.section === it.section; }).sort(byDisplayOrder);
    state.index = 0;
    for (i = 0; i < state.playlist.length; i++) { if (state.playlist[i].display_id === it.display_id) { state.index = i; break; } }
    state.pendingScrollTop = 0;
    updateViewLabel(); markViewList(); render(); savePos();
    closeSheets();
  }

  function renderSearch(q) {
    q = (q || "").trim().toLowerCase();
    var res = $("#secResults"), list = $("#secList");
    if (!res || !list) return;
    if (!q) { res.hidden = true; res.innerHTML = ""; list.hidden = false; return; }
    list.hidden = true; res.hidden = false; res.innerHTML = "";
    var matches = [], i;
    for (i = 0; i < state.canonicalItems.length; i++) {
      var it = state.canonicalItems[i];
      var hay = ((it.title || "") + " " + (it.title_ur || "") + " " + (it.category || "") +
                 " " + (it.transliteration || "")).toLowerCase();
      if (hay.indexOf(q) >= 0) matches.push(it);
      if (matches.length >= 50) break;
    }
    if (!matches.length) {
      res.innerHTML = '<div class="sec-empty">' + esc(t("noMatchingDuas")) + '</div>'; return;
    }
    matches.forEach(function (it) {
      var b = document.createElement("button");
      b.className = "sec-item";
      b.innerHTML = '<span class="sec-name">' + esc(localizeTitle(it)) +
        '<div class="sec-sub">' + esc(localizeCategory(it.category)) + '</div></span>';
      b.addEventListener("click", function () { goToItem(it.id); });
      res.appendChild(b);
    });
  }


  /* ---- settings UI: Display / Content / Navigation / Prayer / About ------ */
  function buildSettings() {
    ensureSettings();
    if (IS_TV) { buildTvSettings(); return; }
    var body = $("#settingsBody"); body.innerHTML = "";

    // 1. READING & DISPLAY
    var read = group(t("grpReadingDisplay"));
    read.appendChild(toggleRow(t("showTagsOnDisplay"), t("showTagsOnDisplayDesc"), "showTags"));
    read.appendChild(stepperRow(t("arabicTextSize"), t("arabicTextSizeDesc"), "arScale"));
    read.appendChild(segRow(t("bismillahSize"), t("bismillahSizeDesc"), "bismillahSize", [["Normal", "normal"], ["Large", "large"], ["XL", "xl"]]));
    read.appendChild(segRow(t("bismillahColor"), t("bismillahColorDesc"), "bismillahColor", [["Olive", "olive"], ["Gold", "gold"], ["Dark", "dark"]]));
    read.appendChild(toggleRow(t("smartSentenceFlow"), t("smartSentenceFlowDesc"), "smartSentenceFlow"));
    read.appendChild(toggleRow(t("waqfPauseSigns"), t("waqfPauseSignsDesc"), "showPauseMarks"));
    read.appendChild(toggleRow(t("tajweed"), t("tajweedDesc"), "tajweed"));
    read.appendChild(toggleRow(t("showWaqfLegend"), t("showWaqfLegendDesc"), "showWaqfLegend"));
    if ((state.draft || state.settings).showWaqfLegend) {
      var legRow = document.createElement("div");
      legRow.className = "set-row waqf-legend-row";
      legRow.style.flexDirection = "column"; legRow.style.alignItems = "stretch";
      legRow.innerHTML = waqfLegendHtml();
      read.appendChild(legRow);
    }
    read.appendChild(toggleRow(t("showTranslitShort"), t("showTranslitDesc"), "showTranslit"));
    read.appendChild(toggleRow(t("showTranslationShort"), t("showEnglishDesc"), "showEnglish"));
    read.appendChild(toggleRow(t("showUrduShort"), t("showUrduDesc"), "showUrdu"));
    body.appendChild(read);

    // 2. APPEARANCE
    var app = group(t("grpAppearance"));
    var tg = document.createElement("div"); tg.className = "theme-grid premium-themes";
    THEMES.filter(function (th) { return th.id !== "high-contrast"; }).forEach(function (theme) {
      var c = document.createElement("button"); c.className = "theme-card"; c.type = "button"; c.setAttribute("data-theme-id", theme.id);
      var tk = "theme_" + theme.id.replace(/-/g, "_");
      c.innerHTML = '<div class="swatch"><div class="a" style="background:' + theme.a + '"></div><div class="b" style="background:' + theme.b + '"></div></div><div class="tname">' + esc(t(tk) || theme.name) + '</div>';
      c.addEventListener("click", function () { var draft = ensureDraft(); draft.theme = theme.id; draft.highContrast = false; applyTheme(theme.id); markThemes(); syncSettingsUI(); });
      tg.appendChild(c);
    });
    app.appendChild(rowCustom(t("theme"), t("themeDesc"), tg, true));
    app.appendChild(segRow(t("arabicTypeface"), t("arabicTypefaceDesc"), "arabicScript", [[t("scriptUthmani"), "uthmani"], [t("scriptIndopak"), "indopak"]]));
    app.appendChild(toggleRow(t("highContrastMode"), t("highContrastModeDesc"), "highContrast"));
    body.appendChild(app);

    // 4. PRAYER BAR
    var pr = group(t("grpPrayerBar"));
    pr.appendChild(toggleRow(t("prayerRibbon"), t("prayerRibbonDesc"), "showRibbon"));
    var locNote = document.createElement("div"); locNote.className = "loc-note"; locNote.textContent = cityLabel((state.draft && state.draft.city) || state.settings.city || "auto");
    pr.appendChild(rowCustom(t("cityLocation"), t("locationDesc"), locNote, false));
    var isOnline = navigator.onLine;
    var conn = document.createElement("div"); conn.className = "loc-note conn-note";
    conn.innerHTML = '<span class="conn-dot2 ' + (isOnline ? "is-online" : "is-offline") + '"></span>' + esc(isOnline ? t("online") : t("lastSaved"));
    pr.appendChild(rowCustom(t("connectionStatus"), "", conn, false));
    body.appendChild(pr);

    // 5. LANGUAGE
    var lang = group(t("grpLanguage"));
    lang.appendChild(segRow(t("language"), t("languageDesc"), "lang", [[t("optEnglish"), "en"], [t("optArabic"), "ar"], [t("optUrdu"), "ur"]]));
    body.appendChild(lang);

    // 6. NAVIGATION & EXPERIENCE
    var nav = group(t("grpNavigationExperience"));
    nav.appendChild(toggleRow(t("autoRotation"), t("autoRotationDesc"), "autoRotate"));
    nav.appendChild(toggleRow(t("swipeNavigation"), t("swipeNavigationDesc"), "swipeNav"));
    nav.appendChild(toggleRow(t("pageProgressIndicator"), t("pageProgressIndicatorDesc"), "showProgress"));
    nav.appendChild(segRow(t("rotationInterval"), t("rotationIntervalDesc"), "interval", [["15s", 15], ["25s", 25], ["40s", 40], ["60s", 60]]));
    body.appendChild(nav);

    // 7. ABOUT (always last)
    var about = group(t("grpAbout"));
    var aboutBtn = document.createElement("button"); aboutBtn.type = "button"; aboutBtn.className = "btn-about"; aboutBtn.textContent = t("openAbout");
    aboutBtn.addEventListener("click", function () { window.location.href = "about.html"; });
    about.appendChild(aboutBtn);
    body.appendChild(about);
  }


  function buildTvSettings() {
    ensureSettings();
    var body = $("#settingsBody"); body.innerHTML = ""; body.classList.add("tv-settings-list");
    var d = state.draft || state.settings;
    tvSetHeader("Reading, prayer ribbon, display, and device preferences");

    body.appendChild(tvStepperRow("Hero Arabic text size", "A− / A+ changes the live Arabic card size immediately.", "arScale", 0.1, 0.9, 2.4, true));
    body.appendChild(tvStepperRow("Transliteration text size", "Adjust the Latin transliteration line for TV distance.", "tlScale", 0.1, 0.75, 1.8, false));
    body.appendChild(tvStepperRow("Translation text size", "Adjust English and Urdu translation size.", "trScale", 0.1, 0.75, 1.8, false));
    body.appendChild(tvSectionHeader("Reading"));
    body.appendChild(tvSegRow("Bismillah size", "Choose the display size for Bismillah.", "bismillahSize", [["Small", "small"], ["Medium", "medium"], ["Large", "large"], ["XL", "xl"]], "بسم"));
    body.appendChild(tvSegRow("Arabic script", "Choose Uthmani or Indo-Pak Arabic style for TV reading.", "arabicScript", [["Uthmani", "uthmani"], ["Indo-Pak", "indopak"]], "ش"));
    body.appendChild(tvToggleRow("Show transliteration", "Show or hide Latin transliteration.", "showTranslit", "Aa"));
    body.appendChild(tvToggleRow("Show English translation", "Show or hide English translation.", "showEnglish", "EN"));
    body.appendChild(tvToggleRow("Show Urdu translation", "Show or hide Urdu translation.", "showUrdu", "Ur"));

    body.appendChild(tvSectionHeader("Appearance"));
    body.appendChild(tvSegRow("Theme mode", "Dark, calm white, sepia, or high contrast display.", "theme", [["Dark", "dark-ambient"], ["Calm Light", "elder-light"], ["Sepia", "sepia"], ["High", "high-contrast"]], "☼"));
    body.appendChild(tvSegRow("Theme accent", "Choose Olive, Gold, or Dark Green accent.", "themeAccent", [["Olive", "olive"], ["Gold", "gold"], ["Dark Green", "green"]], "◐"));
    body.appendChild(tvToggleRow("Show tags on card", "Show or hide category tags on the reading card.", "showTags", "⌑"));
    body.appendChild(tvToggleRow("Show reference", "Show or hide source/reference at the bottom.", "showSource", "▤"));
    body.appendChild(tvToggleRow("Show waqf legend", "Show or hide compact Waqf guide in Settings.", "showWaqfLegend", "؟"));
    body.appendChild(tvToggleRow("Page progress indicator", "Show or hide the bottom progress bar and counter.", "showProgress", "#"));

    body.appendChild(tvSectionHeader("Prayer"));
    body.appendChild(tvToggleRow("Prayer ribbon", "Show or hide the merged next-prayer header immediately.", "showRibbon", "▰"));
    body.appendChild(tvCycleRow("Manual city override", "Use Left / Right to select a reliable city for prayer times.", "city", [["Auto", "auto"], ["Riyadh", "riyadh"], ["Jeddah", "jeddah"], ["Makkah", "makkah"], ["Madinah", "madinah"], ["Dammam", "dammam"]], "⌖"));
    body.appendChild(tvInfoRow("Connection & prayer time source", (navigator.onLine ? "Connected" : "Offline") + " · Aladhan / local fallback", navigator.onLine ? "● Connected" : "● Last saved", "⌁"));

    body.appendChild(tvSectionHeader("Reading behaviour"));
    body.appendChild(tvToggleRow("Fit full content on one screen", "On keeps short duas fully visible; Off allows larger scrollable text.", "tvFit", "▣"));
    body.appendChild(tvToggleRow("Arabic line wrapping enhancement", "Keep Arabic as natural RTL lines instead of scattered words.", "smartSentenceFlow", "≋"));
    body.appendChild(tvToggleRow("Show waqf and pause helpers", "Display waqf and pause indicators where appropriate.", "showPauseMarks", "Ⅱ"));
    body.appendChild(tvToggleRow("Auto rotation", "Automatically move to the next card.", "autoRotate", "▶"));
    if (!d.deviceProfile || d.deviceProfile === "auto") d.deviceProfile = "tv";
    syncSettingsUI();
    if (IS_TV && $("#settingsSheet.open")) initTvSettingsFocus(false);
  }

  function tvSetHeader(subtitle) {
    var h = $("#settingsSheet .sheet-head h2");
    if (h) h.setAttribute("data-tv-subtitle", subtitle);
  }

  function tvSectionHeader(title) {
    var h = document.createElement("div");
    h.className = "tv-settings-section";
    h.textContent = title || "";
    return h;
  }

  function tvRowShell(name, desc, iconText) {
    var r = document.createElement("div"); r.className = "tv-set-row";
    var ic = document.createElement("div"); ic.className = "tv-set-icon"; ic.textContent = iconText || "•";
    var lab = document.createElement("div"); lab.className = "tv-set-label";
    lab.innerHTML = '<div class="tv-set-name">' + esc(name) + '</div>' + (desc ? '<div class="tv-set-desc">' + esc(desc) + '</div>' : "");
    var ctrl = document.createElement("div"); ctrl.className = "tv-set-control";
    r.appendChild(ic); r.appendChild(lab); r.appendChild(ctrl);
    return { row:r, control:ctrl };
  }

function applyTvLivePreviewValues(model) {
  if (!IS_TV || !model) return;
  model = normalizeSettings(model);
  var reader = $("#reader");
  var it = state.playlist[state.index];
  if (reader && it) {
    var ar = autoSize(it.size_mode, model.arScale);
    var tl = Math.round(((it.size_mode === "short" ? 18 : 16) + 4) * model.tlScale);
    var tr = Math.round(((it.size_mode === "short" ? 19 : 17) + 4) * model.trScale);
    reader.style.setProperty("--ar-size", ar + "px");
    reader.style.setProperty("--tl-size", tl + "px");
    reader.style.setProperty("--tr-size", tr + "px");
    reader.style.setProperty("--ar-lh", model.arabicScript === "indopak" ? "1.92" : "1.46");
    var arEl = $("#mArabic");
    if (arEl) {
      arEl.style.fontSize = ar + "px";
      arEl.style.lineHeight = model.arabicScript === "indopak" ? "1.92" : "1.46";
      arEl.style.fontFamily = (model.arabicScript === "indopak") ? AR_FONTS.nastaliq : (AR_FONTS[model.arabicFont] || AR_FONTS.scheherazade);
    }
  }
  var bism = $("#mBismillah");
  if (bism) {
    bism.setAttribute("data-bismillah-size", model.bismillahSize || "medium");
    bism.setAttribute("data-bismillah-color", model.bismillahColor || model.themeAccent || "olive");
  }
  var ribbon = $("#prayerRibbon");
  if (ribbon) ribbon.classList.toggle("hide", model.showRibbon === false);
  document.body.classList.toggle("tv-prayer-hidden", model.showRibbon === false);
  document.body.classList.toggle("hide-progress", model.showProgress === false);
  document.body.classList.toggle("show-tags", !!model.showTags);
  document.body.classList.toggle("tv-accent-gold", model.themeAccent === "gold");
  document.body.classList.toggle("tv-accent-green", model.themeAccent === "green");
  document.body.classList.toggle("tv-accent-olive", model.themeAccent !== "gold" && model.themeAccent !== "green");
  applyTheme(model.theme);
}

function commitTvDraftLive(rebuildView, renderView) {
  if (!IS_TV || !state.draft) return;
  var keepNav = state.tvSettingsNav ? { row: state.tvSettingsNav.row, option: state.tvSettingsNav.option } : null;
  state.draft = normalizeSettings(state.draft);
  state.draft.showTranslation = !!state.draft.showEnglish;
  if (!state.draft.deviceProfile || state.draft.deviceProfile === "auto") state.draft.deviceProfile = "tv";
  if (state.draft.highContrast) state.draft.theme = "high-contrast";

  state.settings = Object.assign({}, state.draft);
  save();
  applyBodyFlags();
  applyTheme(state.settings.theme);
  applyTvLivePreviewValues(state.settings);

  if (rebuildView) buildViewList();
  updateViewLabel();
  setAuto(!!state.settings.autoRotate);
  setupPrayer();
  if (renderView !== false) render();
  if (keepNav) state.tvSettingsNav = keepNav;
  requestAnimationFrame(function () {
    applyTvLivePreviewValues(state.settings);
    syncSettingsUI();
    if (keepNav) setTvSettingsFocus(keepNav.row, keepNav.option, false);
  });
}

  function tvToggleRow(name, desc, key, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var b = document.createElement("button"); b.type = "button"; b.className = "tv-toggle"; b.setAttribute("data-tv-toggle", key);
    b.addEventListener("click", function () {
      var draft = ensureDraft();
      draft[key] = !draft[key];
      if (key === "showEnglish") draft.showTranslation = !!draft.showEnglish;
      var liveOnly = key === "showRibbon" || key === "showProgress" || key === "showTags" || key === "autoRotate";
      commitTvDraftLive(key === "showProgress", !liveOnly);
      if (key === "showWaqfLegend") { buildTvSettings(); }
      syncSettingsUI();
    });
    sh.control.appendChild(b); return sh.row;
  }

  function tvInfoRow(name, desc, value, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var v = document.createElement("span"); v.className = "tv-info-value"; v.textContent = value || "";
    sh.control.appendChild(v); return sh.row;
  }

  function tvSegRow(name, desc, key, opts, iconText) {
  var sh = tvRowShell(name, desc, iconText);
  var seg = document.createElement("div"); seg.className = "tv-seg"; seg.setAttribute("data-seg", key);
  opts.forEach(function (o) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = o[0];
    b.setAttribute("data-val", JSON.stringify(o[1]));
    b.setAttribute("data-tv-option-label", o[0]);
    if (key === "themeAccent") b.setAttribute("data-accent", o[1]);
    b.addEventListener("click", function () {
      var draft = ensureDraft();
      draft[key] = o[1];
      if (key === "theme") draft.highContrast = o[1] === "high-contrast";
      // Rev I-8: visual segments apply instantly without re-render flicker.
      var liveOnly = key === "theme" || key === "themeAccent" || key === "bismillahSize";
      commitTvDraftLive(key === "deviceProfile" || key === "arabicScript", !liveOnly);
      syncSettingsUI();
      refreshTvSettingsFocus();
    });
    seg.appendChild(b);
  });
  sh.control.appendChild(seg); return sh.row;
}

  function tvCycleRow(name, desc, key, opts, iconText) {
    var sh = tvRowShell(name, desc, iconText);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "tv-cycle";
    b.setAttribute("data-tv-cycle", key);
    b.setAttribute("aria-label", name);
    b._tvOptions = opts.slice();
    b.innerHTML = '<span class="tv-cycle-arrow">‹</span><span class="tv-cycle-value" data-cycle-val="' + esc(key) + '"></span><span class="tv-cycle-arrow">›</span>';
    b.addEventListener("click", function () { tvCycleChoice(b, 1); });
    sh.control.appendChild(b);
    return sh.row;
  }

  function tvCycleChoice(btn, dir) {
    if (!btn) return;
    var draft = ensureDraft();
    var key = btn.getAttribute("data-tv-cycle");
    var opts = btn._tvOptions || [];
    if (!key || !opts.length) return;
    var cur = draft[key], idx = 0;
    for (var i = 0; i < opts.length; i++) { if (opts[i][1] === cur) { idx = i; break; } }
    idx = (idx + dir + opts.length) % opts.length;
    draft[key] = opts[idx][1];
    commitTvDraftLive(false);
    syncSettingsUI();
    refreshTvSettingsFocus();
  }

  function setupPrayerPreviewCity(city) {
    if (!city || city === "auto") return;
    var saved = state.settings;
    state.settings = Object.assign({}, state.settings, { city: city });
    setupPrayer();
    state.settings = saved;
  }

  function tvStepperRow(name, desc, key, step, min, max, defaultFocus) {
  var sh = tvRowShell(name, desc, "Aَ");
  var st = document.createElement("div"); st.className = "tv-stepper"; st.setAttribute("data-stepper", key);
  var minus = document.createElement("button"); minus.type = "button"; minus.textContent = "A−"; minus.setAttribute("aria-label", name + " smaller"); minus.setAttribute("data-step-dir", "-1");
  var val = document.createElement("span"); val.className = "tv-step-val val"; val.setAttribute("data-val", key);
  var plus = document.createElement("button"); plus.type = "button"; plus.textContent = "A+"; plus.setAttribute("aria-label", name + " larger"); plus.setAttribute("data-step-dir", "1");
  if (defaultFocus) plus.classList.add("tv-default-focus");
  function clamp(v) { return Math.min(max, Math.max(min, Math.round(v * 100) / 100)); }
  function applyStep(dir) {
    var draft = ensureDraft();
    var current = Number(draft[key]);
    if (!isFinite(current)) current = DEFAULTS[key];
    draft[key] = clamp(current + (dir * step));
    applyTvLivePreviewValues(normalizeSettings(draft));
    commitTvDraftLive(false, false);
    syncSettingsUI();
    refreshTvSettingsFocus();
  }
  minus.addEventListener("click", function () { applyStep(-1); });
  plus.addEventListener("click", function () { applyStep(1); });
  st.appendChild(minus); st.appendChild(val); st.appendChild(plus); sh.control.appendChild(st);
  return sh.row;
}

  function group(title) {
    var g = document.createElement("div"); g.className = "set-group";
    var h = document.createElement("div"); h.className = "grp-title"; h.textContent = title;
    g.appendChild(h); return g;
  }
  function rowCustom(name, desc, control, stacked) {
    var r = document.createElement("div"); r.className = "set-row";
    if (stacked) { r.style.flexDirection = "column"; r.style.alignItems = "stretch"; }
    var lab = document.createElement("div"); lab.className = "label";
    lab.innerHTML = '<div class="name">' + esc(name) + '</div>' + (desc ? '<div class="desc">' + esc(desc) + '</div>' : "");
    r.appendChild(lab);
    if (stacked) control.style.marginTop = "12px";
    r.appendChild(control); return r;
  }
  function toggleRow(name, desc, key) {
    var sw = document.createElement("label"); sw.className = "switch";
    var inp = document.createElement("input"); inp.type = "checkbox"; inp.setAttribute("data-key", key);
    var tr = document.createElement("span"); tr.className = "track";
    inp.addEventListener("change", function () {
      var draft = ensureDraft();
      draft[key] = inp.checked;
      if (key === "showEnglish") draft.showTranslation = inp.checked;
      if (key === "showWaqfLegend") { buildSettings(); syncSettingsUI(); return; }
      if (key === "easyView") { document.body.classList.toggle("easy", inp.checked); previewFonts(); }
      if (key === "showArabic" || key === "showTranslit" || key === "showEnglish" || key === "showUrdu" || key === "showSource" || key === "showPauseMarks" || key === "tajweed" || key === "smartSentenceFlow" || key === "showProgress") previewFonts();
      if (key === "highContrast") { applyTheme(inp.checked ? "high-contrast" : (draft.theme || "elder-light")); }
    });
    sw.appendChild(inp); sw.appendChild(tr);
    return rowCustom(name, desc, sw, false);
  }
  function segRow(name, desc, key, opts) {
    var seg = document.createElement("div"); seg.className = "seg"; seg.setAttribute("data-seg", key);
    opts.forEach(function (o) {
      var b = document.createElement("button"); b.textContent = o[0]; b.setAttribute("data-val", JSON.stringify(o[1]));
      b.addEventListener("click", function () {
        var draft = ensureDraft();
        draft[key] = o[1];
        $$("button", seg).forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        if (key === "arabicScript" || key === "arabicWeight" || key === "lang" || key === "bismillahSize" || key === "bismillahColor") { if (key === "lang") { var savedLang = state.settings.lang; state.settings.lang = draft.lang; applyLang(); state.settings.lang = savedLang; } previewFonts(); }
      });
      seg.appendChild(b);
    });
    return rowCustom(name, desc, seg, false);
  }
  function stepperRow(name, desc, key) {
    var st = document.createElement("div"); st.className = "stepper";
    var minus = document.createElement("button"); minus.textContent = "−"; minus.setAttribute("aria-label", name + " smaller");
    var val = document.createElement("span"); val.className = "val"; val.setAttribute("data-val", key);
    var plus = document.createElement("button"); plus.textContent = "+"; plus.setAttribute("aria-label", name + " larger");
    function clamp(v) { return Math.min(2.0, Math.max(0.7, Math.round(v * 100) / 100)); }
    minus.addEventListener("click", function () { var draft = ensureDraft(); draft[key] = clamp(draft[key] - 0.1); val.textContent = pct(draft[key]); previewFonts(); });
    plus.addEventListener("click", function () { var draft = ensureDraft(); draft[key] = clamp(draft[key] + 0.1); val.textContent = pct(draft[key]); previewFonts(); });
    st.appendChild(minus); st.appendChild(val); st.appendChild(plus);
    return rowCustom(name, desc, st, false);
  }
  function pct(v) { return Math.round(v * 100) + "%"; }
  function selectRow(name, desc, key, opts) {
    var sel = document.createElement("select"); sel.className = "set-select"; sel.setAttribute("data-key", key);
    opts.forEach(function (o) {
      var op = document.createElement("option"); op.value = o[1]; op.textContent = o[0]; sel.appendChild(op);
    });
    sel.value = (state.draft && state.draft[key]) || (state.settings && state.settings[key]) || (opts[0] && opts[0][1]);
    sel.addEventListener("change", function () { var draft = ensureDraft(); draft[key] = sel.value; previewFonts(); });
    return rowCustom(name, desc, sel, false);
  }
  function settingsModel() {
    return state.draft ? normalizeSettings(state.draft) : ensureSettings();
  }
  function previewFonts() {
    if (!state.draft) return;
    state.draft = normalizeSettings(state.draft);
    var saved = state.settings;
    state.settings = state.draft;
    render();
    state.settings = saved;
  }

  function syncSettingsUI() {
    ensureSettings();
    var model = settingsModel();
    markThemes();
    $$("input[type=checkbox][data-key]").forEach(function (i) { i.checked = !!model[i.getAttribute("data-key")]; });
    $$("select[data-key]").forEach(function (s) { s.value = model[s.getAttribute("data-key")]; });
    $$(".seg[data-seg]").forEach(function (seg) {
      var key = seg.getAttribute("data-seg");
      $$("button", seg).forEach(function (b) {
        var active = JSON.stringify(model[key]) === b.getAttribute("data-val");
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    });
    $$(".val[data-val]").forEach(function (v) {
      var key = v.getAttribute("data-val");
      v.textContent = pct(model[key]);
      v.setAttribute("aria-label", key + " " + pct(model[key]));
    });
    $$(".tv-toggle[data-tv-toggle]").forEach(function (b) {
      var key = b.getAttribute("data-tv-toggle"), on = !!model[key];
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      b.textContent = on ? "On" : "Off";
    });
    $$(".tv-seg[data-seg]").forEach(function (seg) {
      var key = seg.getAttribute("data-seg");
      $$("button", seg).forEach(function (b) {
        var active = JSON.stringify(model[key]) === b.getAttribute("data-val");
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    });
    $$(".tv-cycle[data-tv-cycle]").forEach(function (btn) {
      var key = btn.getAttribute("data-tv-cycle"), opts = btn._tvOptions || [], val = model[key], label = "";
      for (var i = 0; i < opts.length; i++) { if (opts[i][1] === val) { label = opts[i][0]; break; } }
      if (key === "city") label = cityLabel(val || "auto");
      var v = btn.querySelector(".tv-cycle-value"); if (v) v.textContent = label || val || "—";
      btn.setAttribute("aria-label", key + ": " + (label || val || ""));
    });
    refreshTvSettingsFocus();
  }
  function markThemes() {
    var model = settingsModel();
    $$(".theme-card").forEach(function (c) { c.classList.toggle("active", c.getAttribute("data-theme-id") === model.theme); });
  }

  function applySettings() {
    ensureSettings();
    ensureDraft();
    var prevFlow = state.settings.flowMode;
    state.draft.showTranslation = !!state.draft.showEnglish;
    if (IS_TV && (!state.draft.deviceProfile || state.draft.deviceProfile === "auto")) state.draft.deviceProfile = "tv";
    state.settings = Object.assign({}, state.draft);
    if (state.settings.highContrast) state.settings.theme = "high-contrast";
    save();
    applyBodyFlags();
    applyTheme(state.settings.theme);
    applyLang();
    buildViewList();
    buildSettings();
    updateViewLabel();
    $("#prayerRibbon").classList.toggle("hide", !state.settings.showRibbon);
    setAuto(state.settings.autoRotate);
    setupPrayer();
    // If default flow preference changed and we are in mixed/category, honour it.
    if (state.settings.flowMode !== prevFlow && state.view.mode !== "section") {
      state.view.mode = state.settings.flowMode === "mixed" ? "mixed" : "category";
    }
    rebuildPlaylist(true);
    closeSheets();
    toast(t("settingsSaved"));
  }

  /* ---- prayer ribbon (global, location-aware) ---------------------------- */
  // Calculation method per country (Aladhan IDs). Falls back to MWL (3).
  function methodForCountry(cc) {
    var M = { SA:4, AE:16, KW:9, QA:10, BH:8, OM:8, EG:5, TR:13, PK:1, IN:1, BD:1,
              ID:20, MY:17, SG:11, RU:14, FR:12, US:2, CA:2, GB:3, IR:7 };
    return M[(cc || "").toUpperCase()] || 3;
  }
  function loadLoc() { try { return JSON.parse(localStorage.getItem(LS_LOC) || "null"); } catch (e) { return null; } }
  function saveLoc(l) { try { localStorage.setItem(LS_LOC, JSON.stringify(l)); } catch (e) {} }
  function loadPrayerCache() { try { return JSON.parse(localStorage.getItem(LS_PRAYER) || "null"); } catch (e) { return null; } }
  function savePrayerCache(city, timings, status) {
    try { localStorage.setItem(LS_PRAYER, JSON.stringify({ date: new Date().toISOString().slice(0,10), city: city || t("myLocation"), timings: timings, status: status || t("online") })); } catch (e) {}
  }

  // Resolve a {lat,lng,city,country} globally: GPS first, then network/IP.
  // The native host requests OS permission only when WebView geolocation asks.
  function resolveLocation(cb) {
    var cached = loadLoc(), done = false;
    function finish(loc) { if (done) return; done = true; if (loc) saveLoc(loc); cb(loc || cached || null); }
    if (navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(
          function (pos) { finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, city: (cached && cached.city) || "", country: (cached && cached.country) || "", src: "gps" }); },
          function () { ipLookup(finish, cached); },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
        );
      } catch (e) { ipLookup(finish, cached); }
    } else ipLookup(finish, cached);
    setTimeout(function () { if (!done) finish(cached); }, 9000);
  }

  function ipLookup(finish, cached) {
    if (!navigator.onLine) { finish(cached); return; }
    fetch("https://ipapi.co/json/").then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.latitude && j.longitude) finish({ lat: j.latitude, lng: j.longitude, city: j.city || j.region || "", country: j.country_code || j.country || "", src: "ip" });
      else finish(cached);
    }).catch(function () {
      fetch("https://ipwho.is/").then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.success && j.latitude) finish({ lat: j.latitude, lng: j.longitude, city: j.city || "", country: (j.country_code || ""), src: "ip" });
        else finish(cached);
      }).catch(function () { finish(cached); });
    });
  }

  function setupPrayer() {
    ensureSettings();
    var s = state.settings;
    $("#prayerRibbon").classList.toggle("hide", !s.showRibbon);
    if (IS_TV) $("#prayerRibbon").classList.toggle("manual-city", !!(s.city && s.city !== "auto"));
    if (!s.showRibbon) return;

    if (s.city && s.city !== "auto") {
      var cityName = cityLabel(s.city) || t("selectedCity");
      $("#prayerCity").textContent = cityName;
      if (navigator.onLine) {
        var u = "https://api.aladhan.com/v1/timingsByCity?city=" + encodeURIComponent(cityName) + "&country=Saudi%20Arabia&method=4";
        fetch(u).then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.data && j.data.timings) { var tt = trim5(j.data.timings); savePrayerCache(cityName, tt, t("online")); showPrayer(tt, false, t("online")); }
          else showPrayer(APPROX[s.city], true, t("approximate"));
        }).catch(function () { showPrayer(APPROX[s.city], true, t("approximate")); });
      } else showPrayer(APPROX[s.city], true, t("approximate"));
      return;
    }

    $("#prayerCity").textContent = t("locating");
    resolveLocation(function (loc) {
      var cache = loadPrayerCache();
      if (!loc) { showPrayerUnavailable(cache); return; }
      var city = loc.city || t("myLocation");
      $("#prayerCity").textContent = city;
      if (!navigator.onLine) { showPrayerUnavailable(cache, city); return; }
      var url = "https://api.aladhan.com/v1/timings?latitude=" + encodeURIComponent(loc.lat) + "&longitude=" + encodeURIComponent(loc.lng) + "&method=" + methodForCountry(loc.country);
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.data && j.data.timings) { var tt = trim5(j.data.timings); savePrayerCache(city, tt, t("online")); showPrayer(tt, false, t("online")); }
        else showPrayerUnavailable(cache, city);
      }).catch(function () { showPrayerUnavailable(cache, city); });
    });
  }
  function trim5(t) { return { Fajr: t.Fajr, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha }; }
  function showPrayerUnavailable(cache, city) {
    if (cache && cache.timings) { $("#prayerCity").textContent = cache.city || city || t("lastSaved"); showPrayer(cache.timings, true, t("lastSaved")); return; }
    $("#prayerNext").textContent = t("prayerUnavailable");
    $("#prayerCity").textContent = city || t("autoLocation");
    $("#prayerTime").textContent = "--:--";
    setConnDot("offline");
  }
  function showPrayer(timings, approx, statusText) {
    if (!timings) { showPrayerUnavailable(null); return; }
    var order = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    var now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), next = null;
    for (var i = 0; i < order.length; i++) {
      var p = timings[order[i]]; if (!p) continue;
      var hm = p.split(":"), m = parseInt(hm[0], 10) * 60 + parseInt(hm[1], 10);
      if (m >= nowMin) { next = { name: order[i], time: p }; break; }
    }
    if (!next) next = { name: "Fajr", time: timings.Fajr || "--:--" };
    $("#prayerNext").textContent = localizePrayerName(next.name);
    $("#prayerTime").textContent = next.time;
    setConnDot(approx ? "approx" : (navigator.onLine ? "online" : "offline"));
  }
  function setConnDot(stateName) {
    var el = $("#prayerApprox"); if (!el) return;
    var label = stateName === "online" ? t("online") : (stateName === "approx" ? t("approximate") : t("lastSaved"));
    var tvLabel = stateName === "online" ? "Online" : (stateName === "approx" ? "Approx" : "Saved");
    el.textContent = IS_TV ? tvLabel : "";
    el.classList.add("conn-dot");
    el.classList.toggle("is-online", stateName === "online");
    el.classList.toggle("is-offline", stateName === "offline");
    el.classList.toggle("is-approx", stateName === "approx");
    el.setAttribute("aria-label", label); el.setAttribute("title", label);
    el.style.display = IS_TV ? "inline-flex" : "inline-block";
  }
  // Live connection state: flip online/offline immediately, never overriding an
  // explicit "approximate location" state set by the prayer logic.
  function refreshConnDot() {
    var el = $("#prayerApprox"); if (!el) return;
    if (el.classList.contains("is-approx")) return;
    setConnDot(navigator.onLine ? "online" : "offline");
  }

  /* ---- restore position -------------------------------------------------- */
  function restorePosition() {
    ensureSettings();
    try {
      var p = JSON.parse(localStorage.getItem(LS_POS) || "null");
      if (p && p.view && p.view.mode) {
        state.view = p.view;
        state.index = p.index || 0;
        state.pendingScrollTop = Math.max(0, p.scrollTop || 0);
      } else {
        state.view.mode = state.settings.flowMode === "category" ? "category" : "mixed";
      }
    } catch (e) { state.view.mode = "mixed"; state.pendingScrollTop = 0; }
    $("#prayerRibbon").classList.toggle("hide", !state.settings.showRibbon);
    setAuto(state.settings.autoRotate);
  }

  /* ---- utils ------------------------------------------------------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }

  // Native TV key bridge used by Android WebView on real remote hardware.
  // It bypasses flaky Android TV WebView browser focus and drives the TV
  // row walker directly. Mobile/tablet do not enter this path.
  window.__azkarTvKey = function (key) {
    if (!IS_TV) return false;
    key = normalizeTvKey(key);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Escape"].indexOf(key) < 0) return false;
    if ($("#settingsSheet.open")) return tvSettingsKey(key);
    var handled = false;
    onKey({ key: key, preventDefault: function () { handled = true; }, stopPropagation: function () {} });
    return handled || true;
  };

  // Native back button hook (closes an open sheet before exiting)
  window.onTvBack = function () { if (anySheetOpen()) { closeSheets(); return true; } return false; };

  // Exposed for lightweight logic tests (see tools/test_logic.py rationale).
  window.__azkar = { parseRepeat: parseRepeat, buildMixed: buildMixed, CATS: CATS, getSectionRefs: getSectionRefs, stripWaqfForDisplay: stripWaqfForDisplay, renderArabicWithWaqf: renderArabicWithWaqf, renderTajweedFallback: renderTajweedFallback, buildShareText: buildShareText };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

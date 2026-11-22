/* DTAhub Assistant: original on-device engine. No server, no AI service, no tracking.
   It understands English, Hindi and Hinglish with a hand-built concept dictionary, ranks your tools with BM25,
   answers from the site's own FAQ and guides, and does exact maths with its own parser. */
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var D = root.DTA || (isNode ? require("./tools-data.js") : null);
  var KB = root.DTAKB || (isNode ? require("./kb-blog.js") : { blog: [] });
  if (!D) return;

  /* ---------- text helpers ---------- */
  var DEV = "०१२३४५६७८९";
  function norm(s) {
    s = String(s || "").toLowerCase().replace(/[०-९]/g, function (c) { return DEV.indexOf(c); });
    return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  }
  var HINGLISH = /\b(kaise|kaisa|kya|kyu|kyun|kyon|mujhe|mera|meri|mere|chahiye|chahie|karo|karna|karni|kare|kijiye|hai|hain|nikalo|nikalna|banao|banana|bana|bata|batao|bataiye|dikhao|kholo|kitna|kitni|kitne|nahi|nhi|wala|wali|sakta|sakte|sakti|krna|kro|krdo|kardo|bnao|jodo|todo|chhota|chota|ghatao|badhao|samjhao|kaun|kab|kahan|kidhar|abhi|mein|hota|hoti|honge|lagana|lagao|bharna|bharo)\b/;
  function isHindiInput(s) { return /[ऀ-ॿ]/.test(s) || HINGLISH.test(s); }
  var STOP = {};
  ("the a an to of for in on and or is are am was be i me my we you your want need wants how can could would should do does did please pls tell show give get it this that with from at by as if then so into about what which who when where there some any just like help ko ka ki ke hai hain ho hu hun karo karna kare kar karun kaise kya mujhe mera meri mere chahiye chaiye aur se me mein par pe wala wali bhi toh ye yeh wo woh ek ab abhi liye lie sakte sakta sakti raha rahi rahe diya do de dena ji hi na nahi koi kuch tha thi the hota hoti kisi apna apne apni use usse iska iski uska uski ise isse wahan yahan " +
    "को का की के है हैं हो में से और या पर मुझे मेरा मेरी मेरे चाहिए कैसे क्या करो करना करें कर एक यह वह भी तो लिए ही न नहीं कोई कुछ था थी").split(" ").forEach(function (w) { if (w) STOP[w] = 1; });
  function stem(w) {
    if (/[^\x00-\x7f]/.test(w) || w.length < 4) return w;
    if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  /* concept dictionary: every alias (English, Hinglish, Hindi) maps to one canonical word */
  var CONCEPTS = {
    compress: "chhota chota chhoti choti kam ghatao ghata ghatana reduce shrink smaller small lighter optimize optimise compression छोटा छोटी कम घटाओ घटाएं घटाना",
    resize: "dimension dimensions pixel pixels px width height badi bada बड़ा बड़ी",
    image: "photo photos foto fotos pic pics picture pictures tasveer tasvir jpg jpeg png webp heic फोटो तस्वीर इमेज",
    merge: "jodo jodna jodni jodne jodiye joddo jod joro milao milana combine join जोड़ो जोड़ना जोड़नी जोड़ने मिलाओ मिलाना",
    split: "todo todna todni todne tukde alag baanto separate अलग तोड़ो तोड़ना टुकड़े",
    resume: "cv biodata bio-data naukri बायोडाटा रिज़्यूमे रिज्यूमे",
    emi: "kist kisht किस्त",
    loan: "karz कर्ज लोन",
    interest: "byaj ब्याज",
    sip: "mutual निवेश invest investment",
    gst: "जीएसटी",
    age: "umar umr उम्र janmdin birthday dob",
    password: "passwd paswrd pass पासवर्ड",
    scan: "scanner स्कैन स्कैनर",
    signature: "sign hastakshar dastakhat हस्ताक्षर साइन",
    fill: "bharna bharo भरना भरो",
    form: "फॉर्म",
    edit: "editor sudhar sudharna एडिट",
    convert: "badlo badal badalna बदलो बदलना change conversion",
    count: "gin ginti gino गिनती गिनो",
    word: "shabd शब्द",
    compare: "tulna तुलना antar अंतर difference diff",
    color: "colour rang रंग",
    hindi: "हिंदी devanagari",
    typing: "type likhna लिखना टाइप टाइपिंग",
    background: "bg",
    rotate: "ghumao घुमाओ",
    delete: "hatao hata हटाओ remove",
    crop: "kaato kaatna काटो",
    unit: "units mapna naap",
    percent: "percentage pratishat प्रतिशत",
    create: "bana banao banana banani banane banaye generate make बनाओ बनाना",
    invoice: "bill bil receipt raseed बिल",
    letter: "patra पत्र application"
  };
  var CANON = {};
  Object.keys(CONCEPTS).forEach(function (c) { CONCEPTS[c].split(" ").forEach(function (a) { if (a) CANON[a] = c; }); });
  function tokens(s, keepStop) {
    var m = norm(s).match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'-]*/gu) || [], out = [];
    m.forEach(function (w) {
      w = w.replace(/^['-]+|['-]+$/g, ""); if (!w || (!keepStop && STOP[w])) return;
      var c = CANON[w] || stem(w); out.push(CANON[c] || c);
    });
    return out;
  }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var p = [], q = [], i, j, c, r;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      q = [i]; r = i;
      for (j = 1; j <= b.length; j++) { c = a[i - 1] === b[j - 1] ? 0 : 1; q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + c); if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) q[j] = Math.min(q[j], p[j - 2] + 1); r = Math.min(r, q[j]); }
      if (r > max) return max + 1; p = q;
    }
    return p[b.length];
  }

  /* ---------- BM25 index ---------- */
  function Index(docs) {
    this.docs = docs; this.df = {}; var tot = 0, self = this;
    docs.forEach(function (d) { d.tf = {}; d.len = d.toks.length; tot += d.len; d.toks.forEach(function (t) { d.tf[t] = (d.tf[t] || 0) + 1; }); Object.keys(d.tf).forEach(function (t) { self.df[t] = (self.df[t] || 0) + 1; }); });
    this.avg = tot / Math.max(1, docs.length); this.N = docs.length;
  }
  Index.prototype.idf = function (t) { var n = this.df[t] || 0; return Math.log(1 + (this.N - n + .5) / (n + .5)); };
  Index.prototype.fix = function (t) {
    if (this.df[t] || t.length < 4 || /[^\x00-\x7f]/.test(t) || /^\d/.test(t)) return t;
    var best = t, bd = t.length >= 8 ? 2 : 1, k;
    for (k in this.df) { if (/[^\x00-\x7f]/.test(k)) continue; var d = lev(t, k, bd); if (d < bd || (d === bd && best === t)) { bd = d; best = k; } }
    return best;
  };
  Index.prototype.search = function (qt) {
    var self = this, q = qt.map(function (t) { return self.fix(t); }), seen = {}, uq = q.filter(function (t) { return seen[t] ? 0 : (seen[t] = 1); }), k1 = 1.4, b = .75, maxIdf = 0, res = [];
    uq.forEach(function (t) { maxIdf += self.idf(t); });
    this.docs.forEach(function (d) {
      var s = 0, cov = 0;
      uq.forEach(function (t) { var f = d.tf[t]; if (!f) return; var i = self.idf(t); s += i * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / self.avg)); cov += i; });
      if (s > 0) res.push({ d: d, score: s, cov: maxIdf ? cov / maxIdf : 0 });
    });
    return res.sort(function (a, b) { return b.score - a.score; });
  };

  var KW = {
    "pdf-merge": "pdf merge combine join multiple files one document",
    "pdf-split": "pdf split extract pages separate range cut",
    "pdf-organize": "pdf organize rearrange reorder rotate delete pages page numbers watermark arrange",
    "pdf-fill": "pdf edit editor fill form signature highlight redact whiteout stamp annotate text write type on pdf",
    "image-to-pdf": "image jpg png convert to pdf make pdf from photos",
    "doc-scanner": "scan scanner document camera paper to pdf cleanup enhance",
    "image-compress": "image compress reduce size kb mb smaller shrink",
    "image-resize": "image resize dimensions pixels cm inch width height passport size form",
    "image-convert": "image convert format jpg png webp watermark",
    "image-editor": "image edit crop rotate flip filter brightness contrast curves retouch blur background delete draw text sticker frame hide",
    "qr-code": "qr code generate barcode link wifi upi",
    "word-counter": "word count characters sentences reading time text",
    "case-converter": "case upper lower title capital sentence text convert",
    "typing-helper": "hindi typing english letters devanagari hinglish transliterate",
    "json-formatter": "json format beautify validate minify developer",
    "base64": "base64 encode decode text developer",
    "regex-tester": "regex regular expression test pattern match developer",
    "text-diff": "text compare difference diff changes two versions",
    "hash-generator": "hash sha md5 hmac uuid token checksum crc random",
    "lorem-ipsum": "lorem ipsum dummy placeholder text",
    "color-palette": "color palette hex rgb contrast scheme design",
    "meta-tags": "meta tags seo open graph twitter card website",
    "password": "password generate strong random secure",
    "resume-maker": "resume job template pdf career",
    "cover-letter": "cover letter job application letter",
    "invoice-maker": "invoice gst receipt pdf upi qr",
    "number-to-words": "number amount words rupees rupaye cheque likho shabdon hindi english lakh crore paise",
    "csv-json": "csv json convert excel spreadsheet comma separated table data export import",
    "timestamp-converter": "unix timestamp epoch time date convert seconds milliseconds timezone ist utc",
    "jwt-decoder": "jwt json web token decode bearer header payload expiry exp",
    "url-encoder": "url encode decode percent encoding link query parameter encodeuricomponent",
    "pdf-to-image": "pdf to image jpg png webp page picture convert photo whatsapp pdf ko photo",
    "exam-photo": "exam photo signature form upload kb size passport pixels jpg application sarkari naukri 20kb 50kb photo signature resize",
    "unit-converter": "unit convert length weight area temperature volume speed data km miles kg pounds",
    "sip": "sip investment returns calculator monthly",
    "fd-calculator": "fd rd fixed deposit recurring deposit maturity interest bank",
    "emi": "emi loan calculator interest monthly installment home car personal",
    "age": "age calculator birthday date of birth years months days",
    "gst": "gst calculator tax add delete cgst sgst inclusive exclusive",
    "percentage": "percent calculator increase decrease discount marks"
  };
  var toolIdx = new Index(D.TOOLS.map(function (t) {
    var r = function (s, n) { var o = ""; while (n-- > 0) o += " " + s; return o; };
    var txt = r(t.en + " " + t.hi + " " + t.id.replace(/-/g, " "), 3) + r(KW[t.id] || "", 3) + r(t.den + " " + t.dhi, 2) + " " + (t.about ? t.about.en + " " + t.about.hi : "") + " " + (t.tip ? t.tip.en : "");
    return { id: t.id, toks: tokens(txt), tool: t };
  }));

  /* ---------- knowledge ---------- */
  var FAQX = [
    { q: { en: "What is DTAhub?", hi: "DTAhub क्या है?" }, k: "what is dtahub about site website this platform purpose",
      a: { en: "DTAhub is a free toolkit of " + D.TOOLS.length + " tools in your browser: PDF and image tools, text and developer tools, calculators, and resume, cover letter and invoice makers. No sign-up, in English and Hindi, and your files never leave your device.", hi: "DTAhub आपके ब्राउज़र में 33 फ्री टूल्स का सेट है: PDF और इमेज टूल्स, टेक्स्ट और डेवलपर टूल्स, कैलकुलेटर, और रिज़्यूमे, कवर लेटर और इनवॉइस मेकर। न साइन-अप, अंग्रेज़ी और हिंदी में, और आपकी फाइलें आपके डिवाइस से बाहर नहीं जातीं।" } },
    { q: { en: "What file types and sizes are supported?", hi: "कौन सी फाइल और कितना साइज़ चलता है?" }, k: "file type format size limit mb supported maximum big large",
      a: { en: "Images: JPG, PNG, WebP and most photos from your phone, up to 30 MB each. PDFs: up to 50 MB. Very large files can be slow on older phones.", hi: "इमेज: JPG, PNG, WebP और फोन की ज़्यादातर फोटो, हर एक 30 MB तक। PDF: 50 MB तक। बहुत बड़ी फाइलें पुराने फोन पर धीमी हो सकती हैं।" } },
    { q: { en: "Is it safe? Do you see my files?", hi: "क्या यह सुरक्षित है? क्या आप मेरी फाइलें देखते हैं?" }, k: "safe secure privacy private see data stored server upload trust security",
      a: { en: "No one sees your files. Everything runs inside your browser on your device and nothing is uploaded. The site also uses a strict security policy, so no outside scripts can run on it.", hi: "आपकी फाइलें कोई नहीं देखता। सब कुछ आपके डिवाइस के ब्राउज़र में चलता है और कुछ भी अपलोड नहीं होता। साइट पर सख्त सिक्योरिटी पॉलिसी भी है, इसलिए बाहरी स्क्रिप्ट नहीं चल सकती।" } },
    { q: { en: "How do I install DTAhub on my phone?", hi: "फोन में DTAhub कैसे इंस्टॉल करूं?" }, k: "install app home screen phone android iphone pwa add icon shortcut",
      a: { en: "In Chrome tap the menu (three dots) and choose Install app or Add to Home screen. On iPhone use Share, then Add to Home Screen. If you see an old icon, remove the app, clear this site's data in browser settings and add it again.", hi: "Chrome में मेन्यू (तीन बिंदु) दबाएं और Install app या Add to Home screen चुनें। iPhone में Share फिर Add to Home Screen। पुराना आइकन दिखे तो ऐप हटाएं, ब्राउज़र सेटिंग में इस साइट का डेटा साफ करें और दोबारा जोड़ें।" } },
    { q: { en: "How do I change the language or dark mode?", hi: "भाषा या डार्क मोड कैसे बदलूं?" }, k: "language hindi english dark light mode theme change switch settings",
      a: { en: "Use the हि button at the top for Hindi and English, and the moon or sun button for dark and light mode. You can also tell me: dark mode, or Hindi.", hi: "ऊपर के हि बटन से हिंदी और अंग्रेज़ी, और चांद या सूरज बटन से डार्क और लाइट मोड बदलें। आप मुझे भी बोल सकते हैं: डार्क मोड, या English।" } },
    { q: { en: "My changes or old design do not show. What to do?", hi: "बदलाव या नया डिज़ाइन नहीं दिख रहा, क्या करूं?" }, k: "old cache clear refresh update not showing stuck slow reload data site",
      a: { en: "Your browser may be holding an old copy. Reload once, and if it still looks old, open browser settings, find Site settings for this site and clear its data. The site then fetches the newest version.", hi: "शायद ब्राउज़र पुरानी कॉपी रखे हुए है। एक बार रीलोड करें, फिर भी पुराना दिखे तो ब्राउज़र सेटिंग में इस साइट का डेटा साफ करें। फिर साइट नया वर्ज़न ले लेगी।" } },
    { q: { en: "Where is my saved data (resume, signature, favourites)?", hi: "मेरा सेव डेटा (रिज़्यूमे, हस्ताक्षर, पसंदीदा) कहां है?" }, k: "saved data resume signature favourites storage delete clear remove forget history local",
      a: { en: "Only on your own device, in your browser's storage. Nothing is sent to us. You can erase it from the Settings page, or clear this chat with the bin icon above.", hi: "सिर्फ आपके अपने डिवाइस पर, ब्राउज़र की स्टोरेज में। हमें कुछ नहीं भेजा जाता। इसे Settings पेज से मिटा सकते हैं, या ऊपर के डिब्बे वाले आइकन से यह चैट साफ करें।" } },
    { q: { en: "Who built DTAhub and is the code original?", hi: "DTAhub किसने बनाया और क्या कोड ओरिजिनल है?" }, k: "who built made created owner developer original code copyright open source",
      a: { en: "DTAhub is built with original code and design, using only free and open-source parts. Every tool is written for this site, and this assistant also runs fully on your device with no outside AI service.", hi: "DTAhub ओरिजिनल कोड और डिज़ाइन से बना है, सिर्फ फ्री और ओपन-सोर्स हिस्सों के साथ। हर टूल इसी साइट के लिए लिखा गया है, और यह असिस्टेंट भी पूरी तरह आपके डिवाइस पर चलता है, बिना किसी बाहरी AI सर्विस के।" } },
    { q: { en: "Can you write essays or chat like ChatGPT?", hi: "क्या आप ChatGPT की तरह निबंध लिख या चैट कर सकते हैं?" }, k: "chatgpt gpt ai artificial intelligence essay write generate chat llm gemini",
      a: { en: "No. I am a built-in assistant, not a generative AI. I find the right tool, answer questions about DTAhub, and do exact calculations such as EMI, GST, SIP, percentages and unit conversion. I run on your device, so nothing you type leaves it.", hi: "नहीं। मैं बिल्ट-इन असिस्टेंट हूं, जनरेटिव AI नहीं। मैं सही टूल ढूंढता हूं, DTAhub के बारे में सवालों के जवाब देता हूं, और EMI, GST, SIP, प्रतिशत और यूनिट कन्वर्ज़न जैसे सटीक हिसाब करता हूं। मैं आपके डिवाइस पर चलता हूं, इसलिए आप जो लिखते हैं वह बाहर नहीं जाता।" } },
    { q: { en: "How do I fill a PDF form or sign a PDF?", hi: "PDF फॉर्म कैसे भरूं या साइन कैसे करूं?" }, k: "fill pdf form sign signature type text tick date",
      a: { en: "Open PDF Editor, choose your PDF, tap the blue boxes to fill real form fields, or pick Text, Tick, Date or Sign and tap on the page. Then download the edited PDF.", hi: "PDF Editor खोलें, अपनी PDF चुनें, असली फॉर्म फील्ड भरने के लिए नीले बॉक्स पर टैप करें, या Text, Tick, Date या Sign चुनकर पन्ने पर टैप करें। फिर एडिट की हुई PDF डाउनलोड करें।" }, tool: "pdf-fill" },
    { q: { en: "How do I make a photo 50 KB or 100 KB for a form?", hi: "फॉर्म के लिए फोटो 50 KB या 100 KB कैसे करूं?" }, k: "photo size kb 50 100 20 form upload exam passport signature reduce",
      a: { en: "Open Exam Photo & Signature Resizer, choose your photo or signature, type the exact pixels and the minimum and maximum KB from your form, and tap Make it fit. It finds the right quality for you and shows a clear tick when the size matches. Check the guide below for more.", hi: "Exam Photo & Signature Resizer खोलें, अपनी फोटो या सिग्नेचर चुनें, फॉर्म के सटीक पिक्सेल और न्यूनतम-अधिकतम KB डालें, और Make it fit दबाएं। टूल सही क्वालिटी खुद ढूंढता है और साइज़ मिलने पर साफ टिक दिखाता है। ज़्यादा जानकारी के लिए नीचे की गाइड देखें।" }, tool: "exam-photo", guide: "photo-size-for-forms-guide" }
  ];
  var faqDocs = D.FAQ.map(function (f) { return { q: f.q, a: f.a, k: "" }; }).concat(FAQX).map(function (f) {
    return { toks: tokens(f.q.en + " " + f.q.en + " " + f.q.hi + " " + (f.k || "") + " " + (f.k || "") + " " + f.a.en), f: f };
  });
  var faqIdx = new Index(faqDocs);
  var blogIdx = new Index((KB.blog || []).map(function (b) { return { toks: tokens(b.en + " " + b.en + " " + b.hi + " " + b.desc), b: b }; }));

  var GAPS = [
    { re: /(pdf).{0,24}(compress|reduce|shrink|smaller)|(compress|reduce|shrink).{0,16}(pdf)/, near: ["image-compress", "image-to-pdf", "doc-scanner"],
      en: "There is no dedicated PDF compressor yet. A workable way: compress the page photos with Image Compressor, then rebuild the PDF with Image to PDF. You can also request this tool.", hi: "अभी अलग से PDF कंप्रेसर नहीं है। एक तरीका: Image Compressor से पन्नों की फोटो छोटी करें, फिर Image to PDF से PDF दोबारा बनाएं। आप यह टूल मांग भी सकते हैं।" },
    { re: /(pdf).{0,12}(to|into).{0,8}(word|docx?|excel|xlsx?|ppt|powerpoint|text|jpg|jpeg|png|image)|(word|docx?|excel|xlsx?|ppt).{0,12}(to|into).{0,8}pdf/, near: ["image-to-pdf", "pdf-organize", "pdf-fill"],
      en: "Converting between PDF and Word, Excel or PowerPoint is not available yet. For Word to PDF, use your app's Save as PDF. Image to PDF and PDF editing are available.", hi: "PDF और Word, Excel या PowerPoint के बीच कन्वर्ट करना अभी उपलब्ध नहीं है। Word से PDF के लिए अपने ऐप का Save as PDF इस्तेमाल करें। Image to PDF और PDF एडिटिंग उपलब्ध हैं।" },
    { re: /(pdf).{0,20}(password|protect|unlock|encrypt|decrypt|lock)|(password|unlock).{0,12}(pdf)/, near: ["pdf-organize", "pdf-fill"],
      en: "Adding or removing a PDF password is not available yet, and password-protected PDFs cannot be opened by the PDF tools. You can request this tool.", hi: "PDF में पासवर्ड लगाना या हटाना अभी उपलब्ध नहीं है, और पासवर्ड वाली PDF PDF टूल्स में नहीं खुलती। आप यह टूल मांग सकते हैं।" },
    { re: /\b(video|audio|mp3|mp4|song|movie)\b|वीडियो|ऑडियो/, near: [], en: "DTAhub has no video or audio tools. It focuses on PDF, image, text, developer tools, calculators and career documents.", hi: "DTAhub में वीडियो या ऑडियो टूल नहीं हैं। यह PDF, इमेज, टेक्स्ट, डेवलपर टूल्स, कैलकुलेटर और करियर दस्तावेज़ों पर केंद्रित है।" },
    { re: /\b(ocr)\b|image to text|photo to text|extract text from (image|photo)/, near: ["doc-scanner"], en: "Reading text out of a photo (OCR) is not available yet. Document Scanner cleans up a photo of a page and saves it as a PDF.", hi: "फोटो से टेक्स्ट निकालना (OCR) अभी उपलब्ध नहीं है। Document Scanner पन्ने की फोटो साफ करके PDF बना देता है।" }
  ];

  /* ---------- number and unit parsing ---------- */
  var MULT = { lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, "लाख": 1e5, crore: 1e7, crores: 1e7, cr: 1e7, "करोड़": 1e7, "करोड": 1e7, k: 1e3, thousand: 1e3, hazar: 1e3, hazaar: 1e3, "हज़ार": 1e3, "हजार": 1e3, million: 1e6 };
  var NUM = /(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(lakhs?|lacs?|crores?|cr|thousand|hazaa?r|million|k|लाख|करोड़|करोड|हज़ार|हजार)?(?![\p{L}\d])/giu;
  function fnum(raw, mult) { var v = parseFloat(String(raw).replace(/,/g, "")); if (mult) v *= MULT[mult.toLowerCase()] || 1; return v; }
  function numsIn(s) { var out = [], m; NUM.lastIndex = 0; while ((m = NUM.exec(s))) out.push({ v: fnum(m[1], m[2]), i: m.index, e: m.index + m[0].length, raw: m[0] }); return out; }
  function cut(s, a, b) { return s.slice(0, a) + " ".repeat(b - a) + s.slice(b); }
  function inr(n, d) { return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }); }
  function pl(n, d) { return Number(n).toLocaleString("en-IN", { maximumFractionDigits: d == null ? 2 : d }); }

  /* safe arithmetic: own parser, never eval */
  function calcExpr(src) {
    var s = src.replace(/×|\bx\b(?=\s*[\d(])/g, "*").replace(/÷/g, "/").replace(/\^/g, "^").replace(/,/g, ""), p = 0, depth = 0;
    if (s.length > 80) return null;
    function ws() { while (s[p] === " ") p++; }
    function prim() {
      ws(); depth++; if (depth > 40) throw 0; var v;
      if (s[p] === "(") { p++; v = add(); ws(); if (s[p] !== ")") throw 0; p++; }
      else if (s[p] === "-") { p++; v = -prim(); }
      else if (s[p] === "+") { p++; v = prim(); }
      else { var m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(p)); if (!m) throw 0; p += m[0].length; v = parseFloat(m[0]); }
      ws(); while (s[p] === "%") { p++; v = v / 100; ws(); }
      depth--; return v;
    }
    function pow() { var b = prim(); ws(); if (s[p] === "^" || (s[p] === "*" && s[p + 1] === "*")) { p += s[p] === "^" ? 1 : 2; return Math.pow(b, pow()); } return b; }
    function mul() { var v = pow(); for (;;) { ws(); var c = s[p]; if (c === "*" && s[p + 1] !== "*") { p++; v *= pow(); } else if (c === "/") { p++; var d = pow(); if (d === 0) throw 1; v /= d; } else return v; } }
    function add() { var v = mul(); for (;;) { ws(); var c = s[p]; if (c === "+") { p++; v += mul(); } else if (c === "-") { p++; v -= mul(); } else return v; } }
    try { var r = add(); ws(); if (p !== s.length || !isFinite(r)) return null; return r; } catch (e) { return e === 1 ? "div0" : null; }
  }
  function fmtNum(x) { if (Math.abs(x) >= 1e15 || (Math.abs(x) < 1e-9 && x !== 0)) return x.toExponential(6); return String(+x.toPrecision(12)); }

  /* units */
  var U = {};
  function defU(cat, base, list) { list.forEach(function (r) { r[0].split("|").forEach(function (n) { U[n] = { cat: cat, f: r[1] }; }); }); }
  defU("len", "m", [["mm|millimeter|millimetre|millimeters|मिलीमीटर", .001], ["cm|centimeter|centimetre|centimeters|centimetres|सेंटीमीटर|सेमी", .01], ["m|meter|metre|meters|metres|मीटर", 1], ["km|kilometer|kilometre|kilometers|kilometres|किलोमीटर|किमी", 1000], ["in|inch|inches|इंच", .0254], ["ft|feet|foot|फुट|फीट", .3048], ["yd|yard|yards|गज", .9144], ["mile|miles|mi|मील", 1609.344]]);
  defU("wt", "g", [["mg|milligram|milligrams", .001], ["g|gram|grams|gm|ग्राम", 1], ["kg|kilo|kilos|kilogram|kilograms|किलो|किलोग्राम|केजी", 1000], ["quintal|quintals|क्विंटल", 100000], ["tonne|tonnes|ton|tons|टन", 1e6], ["lb|lbs|pound|pounds|पाउंड", 453.59237], ["oz|ounce|ounces|औंस", 28.349523125]]);
  defU("area", "sqm", [["sqm|m2|sq m|square meter|square metre|square meters|वर्ग मीटर", 1], ["sqft|sq ft|ft2|square feet|square foot|वर्ग फुट|वर्गफुट", .09290304], ["sqyd|sq yd|square yard|square yards|वर्ग गज", .83612736], ["acre|acres|एकड़|एकड", 4046.8564224], ["hectare|hectares|ha|हेक्टेयर", 10000], ["sqkm|sq km|km2", 1e6]]);
  defU("vol", "l", [["ml|milliliter|millilitre|milliliters|मिलीलीटर", .001], ["l|liter|litre|liters|litres|लीटर", 1], ["gal|gallon|gallons|गैलन", 3.785411784], ["cup|cups", .2365882365]]);
  defU("spd", "ms", [["kmh|kmph|km/h|kph", 1 / 3.6], ["mph|miles per hour", .44704], ["ms|m/s", 1], ["knot|knots", .5144444]]);
  defU("data", "b", [["b|byte|bytes", 1], ["kb|kilobyte|kilobytes", 1024], ["mb|megabyte|megabytes", 1048576], ["gb|gigabyte|gigabytes", 1073741824], ["tb|terabyte|terabytes", 1099511627776]]);
  defU("temp", "c", [["c|celsius|centigrade|°c|degc", 1], ["f|fahrenheit|°f|degf", 1], ["k|kelvin", 1]]);
  var UNAME = { len: ["m", "meter"], wt: ["g", "gram"], area: ["sqm", ""], vol: ["l", ""], spd: ["ms", ""], data: ["b", ""], temp: ["c", ""] };
  function convertUnit(v, a, b) {
    if (a.cat === "temp") {
      var c = a.n === "f" || a.n === "°f" || a.n === "fahrenheit" || a.n === "degf" ? (v - 32) * 5 / 9 : a.n === "k" || a.n === "kelvin" ? v - 273.15 : v;
      if (b.n === "f" || b.n === "°f" || b.n === "fahrenheit" || b.n === "degf") return c * 9 / 5 + 32;
      if (b.n === "k" || b.n === "kelvin") return c + 273.15; return c;
    }
    return v * a.f / b.f;
  }
  function parseUnitQuery(s) {
    var m = /(-?\d[\d,]*(?:\.\d+)?)\s*([a-z°²/ऀ-ॿ ]{1,22}?)\s+(?:to|in|into|ko|me|mein|में|को|se|=)\s+([a-z°²/ऀ-ॿ ]{1,22})\s*[?.!]*$/i.exec(s);
    if (!m) return null;
    var clean = function (x) { return x.trim().replace(/^(of|ka|ki)\s+/, "").replace(/\s+(hota|hai|hote|kitne|kitna|kitni|hoga|batao|bataiye|karo|kar do|kardo)\b.*$/, "").trim(); };
    var ua = clean(m[2]), ub = clean(m[3]), A = U[ua], B = U[ub];
    if (!A || !B || A.cat !== B.cat) return null;
    return { v: parseFloat(m[1].replace(/,/g, "")), a: { cat: A.cat, f: A.f, n: ua }, b: { cat: B.cat, f: B.f, n: ub }, ua: ua, ub: ub };
  }

  /* dates */
  var MON = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
  function parseDate(s) {
    var m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/.exec(s);
    if (m) return mk(+m[3], +m[2] - 1, +m[1]);
    m = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(s); if (m) return mk(+m[1], +m[2] - 1, +m[3]);
    m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})\b/.exec(s); if (m && MON[m[2]] != null) return mk(+m[3], MON[m[2]], +m[1]);
    m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(s); if (m && MON[m[1]] != null) return mk(+m[3], MON[m[1]], +m[2]);
    return null;
    function mk(y, mo, d) { var t = new Date(y, mo, d); return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d ? t : null; }
  }
  function ageFrom(b, now) {
    var y = now.getFullYear() - b.getFullYear(), m = now.getMonth() - b.getMonth(), d = now.getDate() - b.getDate();
    if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    var nb = new Date(now.getFullYear(), b.getMonth(), b.getDate()); if (nb < new Date(now.getFullYear(), now.getMonth(), now.getDate())) nb = new Date(now.getFullYear() + 1, b.getMonth(), b.getDate());
    var days = Math.round((nb - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    return { y: y, m: m, d: d, next: days, total: Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - b) / 864e5) };
  }
  function words(n) {
    var a = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" "), t = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
    function two(x) { return x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""); }
    function three(x) { return (x >= 100 ? a[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : ""); }
    if (n === 0) return "zero";
    var out = [], cr = Math.floor(n / 1e7), la = Math.floor(n % 1e7 / 1e5), th = Math.floor(n % 1e5 / 1e3), rest = n % 1e3;
    if (cr) out.push((cr >= 100 ? words(cr) : two(cr)) + " crore"); if (la) out.push(two(la) + " lakh"); if (th) out.push(two(th) + " thousand"); if (rest) out.push(three(rest));
    return out.join(" ");
  }

  /* ---------- calculators: return {title, rows, note, tool} or null ---------- */
  function T(en, hi, lang) { return lang === "hi" ? hi : en; }
  function extractLoan(s) {
    var r = null, t = null, m, work = s;
    m = /(\d+(?:\.\d+)?)\s*(%|percent|pc|pct|प्रतिशत|परसेंट)/.exec(work) || /(?:rate|interest|byaj|ब्याज|roi)\D{0,14}(\d+(?:\.\d+)?)/.exec(work);
    if (m) { r = parseFloat(m[1]); work = cut(work, m.index, m.index + m[0].length); }
    m = /(\d+(?:\.\d+)?)\s*(years?|yrs?|yr|saal|sal|वर्ष|साल|months?|mo|mahine|mahina|महीने|महीना|माह)(?![\p{L}])/iu.exec(work);
    if (m) { var isY = /^(y|s|व|सा)/i.test(m[2]); t = parseFloat(m[1]) * (isY ? 12 : 1); work = cut(work, m.index, m.index + m[0].length); }
    else { m = /(?:tenure|time|period|for|avadhi|अवधि)\D{0,10}(\d+(?:\.\d+)?)/.exec(work); if (m) { var tv = parseFloat(m[1]); t = tv <= 40 ? tv * 12 : tv; work = cut(work, m.index, m.index + m[0].length); } }
    var ns = numsIn(work).filter(function (n) { return n.v > 0; });
    return { r: r, months: t, nums: ns, work: work };
  }
  function calc(raw, lang, now) {
    var s = norm(raw), m;
    /* plain arithmetic */
    var ar = s.replace(/^(what is|what's|calculate|calc|solve|compute|hisab|hisaab|nikalo|kitna hota hai|kitna hai|=)\s*/, "").replace(/\s*(=|\?|kitna hota hai|kitna hai|kya hoga|hota hai)$/g, "").trim();
    if (/^[\d\s+\-*/^().,%x×÷]+$/.test(ar) && /\d/.test(ar) && /[+\-*/^x×÷%]/.test(ar.replace(/^-/, ""))) {
      var v = calcExpr(ar);
      if (v === "div0") return { title: T("Cannot divide by zero", "शून्य से भाग नहीं हो सकता", lang), rows: [] };
      if (v != null) return { title: T("Result", "नतीजा", lang), rows: [[ar.replace(/\s+/g, " "), fmtNum(v)]], big: fmtNum(v) };
    }
    /* number in words */
    if (/(in words|shabdon|shabdo|शब्दों)/.test(s) && (m = numsIn(s)[0]) && m.v < 1e12 && m.v === Math.floor(m.v)) {
      return { title: T("In words", "शब्दों में", lang), rows: [[pl(m.v, 0), words(m.v) + (/(rupee|rs|₹|inr|rupaye|रुपये)/.test(s) ? " rupees only" : "")]], note: T("Indian system (lakh and crore).", "भारतीय प्रणाली (लाख और करोड़)।", lang), tool: "number-to-words" };
    }
    /* unit conversion */
    var us = s; for (var z = 0; z < 2; z++) us = us.replace(/\s+(me|mein|में|batao|bataiye|karo|kar do|kardo|kitne|kitna|kitni|hoga|hote hain|hota hai|hai)\s*[?.!]*$/, "");
    var uq = parseUnitQuery(us);
    if (uq) { var out = convertUnit(uq.v, uq.a, uq.b); return { title: T("Conversion", "कन्वर्ज़न", lang), rows: [[pl(uq.v, 6) + " " + uq.ua, pl(out, 6) + " " + uq.ub]], big: pl(out, 6) + " " + uq.ub, note: uq.a.cat === "data" ? T("Data uses 1024 steps.", "डेटा में 1024 का क्रम लिया गया है।", lang) : "", tool: "unit-converter" }; }
    /* age */
    if (/\b(age|umar|umr|born|dob|birth|janam|birthday)\b|उम्र|जन्म|आयु/.test(s)) {
      var d = parseDate(s);
      if (d && d <= now) { var a = ageFrom(d, now); return { title: T("Age", "उम्र", lang), rows: [[T("Age", "उम्र", lang), a.y + T(" years, ", " साल, ", lang) + a.m + T(" months, ", " महीने, ", lang) + a.d + T(" days", " दिन", lang)], [T("Total days lived", "जिए हुए कुल दिन", lang), pl(a.total, 0)], [T("Days to next birthday", "अगले जन्मदिन में दिन", lang), String(a.next)]], big: a.y + T(" years", " साल", lang), tool: "age" }; }
    }
    /* finance */
    var hasP = /(%|percent|pratishat|प्रतिशत|परसेंट)/.test(s);
    if (/\bsip\b/.test(s)) {
      var e = extractLoan(s);
      if (e.r != null && e.months && e.nums.length) {
        var P = e.nums[0].v, i = e.r / 1200, n = Math.round(e.months), fv = i === 0 ? P * n : P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i), inv = P * n;
        return { st: { k: "sip", P: P, r: e.r, n: n }, title: T("SIP result", "SIP का नतीजा", lang), rows: [[T("Monthly SIP", "मासिक SIP", lang), inr(P)], [T("Total invested", "कुल निवेश", lang), inr(inv)], [T("Estimated gain", "अनुमानित लाभ", lang), inr(fv - inv)], [T("Maturity value", "मैच्योरिटी वैल्यू", lang), inr(fv)]], big: inr(fv), note: T("Assumes a steady " + e.r + "% a year, invested at the start of each month. Real returns vary.", "मान लिया गया: हर साल स्थिर " + e.r + "%, हर महीने की शुरुआत में निवेश। असली रिटर्न बदलते हैं।", lang), tool: "sip" };
      }
      return { title: T("SIP needs 3 things", "SIP के लिए 3 चीज़ें चाहिए", lang), rows: [], note: T("Try: SIP 5000 per month at 12% for 10 years", "ऐसे लिखें: SIP 5000 महीना 12% 10 साल", lang), tool: "sip" };
    }
    if (/\b(emi|loan)\b|लोन|किस्त|kist/.test(s)) {
      var e2 = extractLoan(s);
      if (e2.r != null && e2.months && e2.nums.length) {
        var P2 = e2.nums.sort(function (a, b) { return b.v - a.v; })[0].v, i2 = e2.r / 1200, n2 = Math.round(e2.months), emi = i2 === 0 ? P2 / n2 : P2 * i2 * Math.pow(1 + i2, n2) / (Math.pow(1 + i2, n2) - 1), tot = emi * n2;
        return { st: { k: "emi", P: P2, r: e2.r, n: n2 }, title: T("Loan EMI", "लोन की EMI", lang), rows: [[T("Monthly EMI", "मासिक EMI", lang), inr(emi)], [T("Loan amount", "लोन राशि", lang), inr(P2)], [T("Total interest", "कुल ब्याज", lang), inr(tot - P2)], [T("Total payment", "कुल भुगतान", lang), inr(tot)]], big: inr(emi) + T(" per month", " प्रति माह", lang), note: T(pl(e2.r) + "% a year for " + n2 + " months, reducing balance.", "सालाना " + pl(e2.r) + "% , " + n2 + " महीने, घटते बैलेंस पर।", lang), tool: "emi" };
      }
      return { title: T("EMI needs 3 things", "EMI के लिए 3 चीज़ें चाहिए", lang), rows: [], note: T("Try: EMI of 5 lakh at 9% for 5 years", "ऐसे लिखें: 5 लाख का EMI 9% पर 5 साल", lang), tool: "emi" };
    }
    if (/\b(fd|fixed deposit)\b|एफडी/.test(s)) {
      var e3 = extractLoan(s);
      if (e3.r != null && e3.months && e3.nums.length) {
        var P3 = e3.nums[0].v, yrs = e3.months / 12, A = P3 * Math.pow(1 + e3.r / 400, 4 * yrs);
        return { st: { k: "fd", P: P3, r: e3.r, n: e3.months }, title: T("FD maturity", "FD मैच्योरिटी", lang), rows: [[T("Deposit", "जमा राशि", lang), inr(P3)], [T("Interest earned", "मिला ब्याज", lang), inr(A - P3)], [T("Maturity value", "मैच्योरिटी वैल्यू", lang), inr(A)]], big: inr(A), note: T("Interest compounded quarterly, as most banks do.", "ब्याज तिमाही चक्रवृद्धि, जैसा ज़्यादातर बैंक करते हैं।", lang), tool: "fd-calculator" };
      }
    }
    if (/(compound interest|chakravriddhi|चक्रवृद्धि|\bci\b)/.test(s) || /(simple interest|saadha|sadharan|साधारण|\bsi\b)/.test(s)) {
      var e4 = extractLoan(s);
      if (e4.r != null && e4.months && e4.nums.length) {
        var P4 = e4.nums[0].v, y4 = e4.months / 12, simple = /(simple|saadha|sadharan|साधारण|\bsi\b)/.test(s), I = simple ? P4 * e4.r * y4 / 100 : P4 * Math.pow(1 + e4.r / 100, y4) - P4;
        return { title: simple ? T("Simple interest", "साधारण ब्याज", lang) : T("Compound interest", "चक्रवृद्धि ब्याज", lang), rows: [[T("Principal", "मूलधन", lang), inr(P4)], [T("Interest", "ब्याज", lang), inr(I, 2)], [T("Total amount", "कुल राशि", lang), inr(P4 + I, 2)]], big: inr(I, 2), note: simple ? "" : T("Compounded yearly.", "सालाना चक्रवृद्धि।", lang) };
      }
    }
    if (/\bgst\b|जीएसटी/.test(s)) {
      var rm = /(\d+(?:\.\d+)?)\s*(?:%|percent|pc|प्रतिशत)/.exec(s), rate = rm ? parseFloat(rm[1]) : 18, w = rm ? cut(s, rm.index, rm.index + rm[0].length) : s, ns = numsIn(w).filter(function (n) { return n.v > 0; });
      if (ns.length) {
        var amt = ns.sort(function (a, b) { return b.v - a.v; })[0].v, rev = /(incl|inclusive|included|with gst|nikalo|nikal|remove|reverse|excluding|ke andar|se gst|निकालो|निकाल)/.test(s), base, g, tt;
        if (rev) { base = amt / (1 + rate / 100); g = amt - base; tt = amt; } else { base = amt; g = amt * rate / 100; tt = amt + g; }
        return { title: T("GST at " + rate + "%", rate + "% GST", lang), rows: [[T("Price without GST", "GST के बिना कीमत", lang), inr(base, 2)], ["GST (" + rate + "%)", inr(g, 2)], ["CGST + SGST", inr(g / 2, 2) + " + " + inr(g / 2, 2)], [T("Price with GST", "GST के साथ कीमत", lang), inr(tt, 2)]], big: inr(rev ? base : tt, 2), note: (rm ? "" : T("No rate given, so 18% is assumed. ", "दर नहीं बताई, इसलिए 18% मानी गई। ", lang)) + (rev ? T("GST taken out of a GST-inclusive price.", "GST वाली कीमत से GST निकाला गया।", lang) : T("GST added to the price.", "कीमत में GST जोड़ा गया।", lang)), tool: "gst" };
      }
    }
    /* BMI */
    if (/\bbmi\b|body mass|मोटापा/.test(s)) {
      var wk = /(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|किलो)/.exec(s), hm = /(\d+(?:\.\d+)?)\s*(cm|centimet\w*|m|meters?|metres?|ft|feet|foot|inch|inches|सेमी)(?![\p{L}])/u.exec(s), hv = null;
      if (hm) { var hn = parseFloat(hm[1]), hu = hm[2]; hv = /^(cm|centi|सेमी)/.test(hu) ? hn / 100 : /^(ft|feet|foot)/.test(hu) ? hn * .3048 : /^inch/.test(hu) ? hn * .0254 : hn; }
      if (wk && hv && hv > .5 && hv < 2.8) {
        var w0 = parseFloat(wk[1]), bmi = w0 / (hv * hv), cat = bmi < 18.5 ? ["Below the usual range", "सामान्य सीमा से कम"] : bmi < 25 ? ["In the usual range", "सामान्य सीमा में"] : bmi < 30 ? ["Above the usual range", "सामान्य सीमा से ऊपर"] : ["Well above the usual range", "सामान्य सीमा से काफी ऊपर"];
        return { title: "BMI", rows: [["BMI", pl(bmi, 1)], [T("Range (WHO adult)", "रेंज (WHO वयस्क)", lang), T(cat[0], cat[1], lang)], [T("Usual range", "सामान्य सीमा", lang), "18.5 – 24.9"]], big: pl(bmi, 1), note: T("A rough screening number only, not medical advice. Ask a doctor about your health.", "यह सिर्फ मोटा अंदाज़ा है, मेडिकल सलाह नहीं। सेहत के बारे में डॉक्टर से पूछें।", lang) };
      }
      return { title: T("BMI needs weight and height", "BMI के लिए वज़न और ऊंचाई चाहिए", lang), rows: [], note: T("Try: BMI 70 kg 175 cm", "ऐसे लिखें: BMI 70 kg 175 cm", lang) };
    }
    /* profit and loss */
    var pm = /(?:cost|cp|bought|kharid\w*|खरीद\w*|लागत)\D{0,14}(\d[\d,]*(?:\.\d+)?)[^\d]{1,30}?(?:sell\w*|sold|sp|bech\w*|बेच\w*|बिक्री)\D{0,14}(\d[\d,]*(?:\.\d+)?)/.exec(s);
    if (pm) {
      var cp = fnum(pm[1]), sp = fnum(pm[2]);
      if (cp > 0) { var df = sp - cp, loss = df < 0; return { title: loss ? T("Loss", "नुकसान", lang) : df === 0 ? T("No profit, no loss", "न नफा न नुकसान", lang) : T("Profit", "मुनाफा", lang), rows: [[T("Cost price", "खरीद कीमत", lang), pl(cp)], [T("Selling price", "बिक्री कीमत", lang), pl(sp)], [loss ? T("Loss", "नुकसान", lang) : T("Profit", "मुनाफा", lang), pl(Math.abs(df))], ["% " + T("on cost", "लागत पर", lang), pl(Math.abs(df) / cp * 100, 2) + "%"]], big: pl(Math.abs(df) / cp * 100, 2) + "%" }; }
    }
    /* average */
    if (/\b(average|avg|mean|ausat)\b|औसत/.test(s)) {
      var an = numsIn(s).map(function (x) { return x.v; });
      if (an.length >= 2) { var sum = an.reduce(function (a, b) { return a + b; }, 0); return { title: T("Average", "औसत", lang), rows: [[T("Numbers", "संख्याएं", lang), an.length + ""], [T("Sum", "जोड़", lang), pl(sum, 6)], [T("Average", "औसत", lang), pl(sum / an.length, 6)]], big: pl(sum / an.length, 6) }; }
    }
    /* split a bill */
    var sb = /(split|divide|bant\w*|baant\w*|बांट\w*|बाँट\w*)/.test(s) ? numsIn(s).filter(function (x) { return x.v > 0; }) : [];
    if (sb.length >= 2) {
      var tot0 = Math.max(sb[0].v, sb[1].v), ppl = Math.min(sb[0].v, sb[1].v);
      if (ppl >= 1 && ppl === Math.floor(ppl) && ppl <= 1000) return { title: T("Split equally", "बराबर बांटना", lang), rows: [[T("Total", "कुल", lang), pl(tot0)], [T("People", "लोग", lang), pl(ppl, 0)], [T("Each pays", "हर एक का हिस्सा", lang), pl(tot0 / ppl, 2)]], big: pl(tot0 / ppl, 2) };
    }
    /* days between dates, days left */
    if (/\b(days?|din|dino|weeks?|months?)\b|दिन|कितने दिन/.test(s) && /(between|beech|bich|till|until|left|baki|bache|bachi|से|tak|to|and|aur|से)/.test(s)) {
      var parts = s.split(/\s+(?:and|to|aur|se|till|until|tak|से|तक)\s+/), d1 = null, d2 = null;
      if (parts.length >= 2) { d1 = parseDate(parts[0]); d2 = parseDate(parts.slice(1).join(" ")); }
      var td0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (!d1 && d2) d1 = td0; else if (d1 && !d2 && parts.length >= 2 && !/\d/.test(parts[1].replace(/\s/g, ""))) d2 = td0;
      if (!d1 && !d2) { var dd = parseDate(s); if (dd && dd >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) { d1 = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d2 = dd; } }
      if (d1 && d2) {
        var dn = Math.round((d2 - d1) / 864e5), ab = Math.abs(dn), wks = Math.floor(ab / 7);
        return { title: T("Days between", "दिनों का अंतर", lang), rows: [[T("From", "से", lang), d1.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })], [T("To", "तक", lang), d2.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })], [T("Days", "दिन", lang), pl(ab, 0)], [T("Weeks and days", "हफ्ते और दिन", lang), wks + T(" weeks ", " हफ्ते ", lang) + (ab % 7) + T(" days", " दिन", lang)]], big: pl(ab, 0) + T(" days", " दिन", lang) };
      }
    }
    /* percentages and discounts */
    var N = "(\\d[\\d,]*(?:\\.\\d+)?)", PC = "(?:%|percent|pc|pct|pratishat|प्रतिशत|परसेंट)";
    m = new RegExp(N + "\\s*" + PC + "\\s*(?:of|ka|ki|ke|का|की|के)\\s*" + N).exec(s);
    if (m) { var p = fnum(m[1]), b = fnum(m[2]); return pct(p, b); }
    m = new RegExp(N + "\\s*(?:ka|ki|ke|का|की|के)\\s*" + N + "\\s*" + PC).exec(s);
    if (m) { return pct(fnum(m[2]), fnum(m[1])); }
    m = new RegExp(N + "\\s*(?:is|hai|है)?\\s*(?:what|kitna|kitne|kitni|कितना|कितने)\\s*" + PC + "\\s*(?:of|ka|ki|का|की)?\\s*" + N).exec(s);
    if (m) { var a2 = fnum(m[1]), b2 = fnum(m[2]); if (b2) return { title: T("Percentage", "प्रतिशत", lang), rows: [[pl(a2) + T(" of ", " / ", lang) + pl(b2), pl(a2 / b2 * 100, 4) + "%"]], big: pl(a2 / b2 * 100, 4) + "%", tool: "percentage" }; }
    m = new RegExp(N + "\\s*(?:me|mein|में|se|par|on)?\\s*" + N + "\\s*" + PC + "\\s*(badhao|jodo|increase|add|plus|badha|बढ़ाओ|जोड़ो|ghatao|kam|minus|decrease|reduce|घटाओ|कम|discount|off|chhoot|chhut|छूट)").exec(s)
      || new RegExp(N + "\\s*" + PC + "\\s*(discount|off|chhoot|chhut|छूट)\\s*(?:on|par|pe|पर|se)?\\s*" + N).exec(s);
    if (m) {
      var base2, pp, word;
      if (/^(discount|off|chhoot|chhut|छूट)$/.test(m[2]) && !isNaN(parseFloat(m[3]))) { pp = fnum(m[1]); base2 = fnum(m[3]); word = "discount"; }
      else { base2 = fnum(m[1]); pp = fnum(m[2]); word = m[3]; }
      var up = /(badhao|jodo|increase|add|plus|badha|बढ़ाओ|जोड़ो)/.test(word), diff = base2 * pp / 100, res = up ? base2 + diff : base2 - diff;
      return { title: up ? T("After increase", "बढ़ाने के बाद", lang) : T("After discount", "छूट के बाद", lang), rows: [[T("Original", "मूल", lang), pl(base2)], [(up ? T("Increase", "बढ़त", lang) : T("Discount", "छूट", lang)) + " (" + pl(pp) + "%)", pl(diff)], [T("Final", "अंतिम", lang), pl(res)]], big: pl(res), tool: "percentage" };
    }
    return null;
    function pct(p, b) { return { title: T("Percentage", "प्रतिशत", lang), rows: [[pl(p) + "% " + T("of", "का", lang) + " " + pl(b), pl(p * b / 100, 4)]], big: pl(p * b / 100, 4), tool: "percentage" }; }
  }

  /* ---------- the brain ---------- */
  var ACTS = [
    { re: /^(dark|night)\s*(mode|theme)?$|dark mode|डार्क|अंधेरा|andhera|night mode/, act: "theme", v: "dark" },
    { re: /^(light|day)\s*(mode|theme)?$|light mode|लाइट मोड|उजाला|ujala/, act: "theme", v: "light" },
    { re: /^(hindi|हिंदी|हिन्दी)$|hindi me|hindi mein|हिंदी में|switch to hindi|change to hindi|in hindi$/, act: "lang", v: "hi" },
    { re: /^(english|अंग्रेज़ी|अंग्रेजी|angrezi)$|english me|english mein|switch to english|in english$|अंग्रेज़ी में/, act: "lang", v: "en" },
    { re: /\b(clear|reset|delete)\b.*\b(chat|history|conversation)\b|chat (clear|saaf|delete)|चैट (साफ|हटा)/, act: "clear" }
  ];
  var OPEN = /^(open|go to|goto|take me to|launch|kholo|khol do|kholiye|खोलो|खोलें|खोल दो|jao|chalo)\s+(.+)$|^(.+?)\s+(kholo|khol do|open karo|open kar do|खोलो|खोलें|खोल दो)$/;
  var GREET = /^(hi|hii|hiii|hello|hey|heya|namaste|namaskar|नमस्ते|नमस्कार|hlo|helo|good (morning|afternoon|evening)|sup|yo)\b[\s!.,?]*$/;
  var THANKS = /^(thanks|thank you|thx|ty|shukriya|dhanyavad|धन्यवाद|शुक्रिया|thank u|great|nice|ok thanks|awesome|perfect|badhiya|बढ़िया)[\s!.]*$/;
  var HELP = /^(help|what can you do|how do you work|who are you|what are you|kya kar sakte ho|tum kya kar sakte ho|aap kya kar sakte|tum kaun ho|aap kaun ho|मदद|हेल्प|तुम कौन हो|आप कौन हैं|आप क्या कर सकते हैं)[\s?!.]*$/;
  var SELF_TOOL = /(this tool|is tool|yeh tool|ye tool|iska use|isko kaise|how (do i|to) use (this|it)|yeh kaise|ye kaise|इसे कैसे|यह कैसे)/;

  function toolByQuery(q) {
    var qt = tokens(q); if (!qt.length) return [];
    var r = toolIdx.search(qt); if (!r.length) return [];
    var top = r[0], out = r.filter(function (x) { return x.score >= top.score * .75 && x.cov >= Math.max(.34, top.cov * .75); }).slice(0, 3);
    return out.length ? out : (top.cov >= .5 ? [top] : []);
  }
  function findToolName(q) {
    var s = norm(q).replace(/\b(tool|please|plz|app|calculator|maker|generator)\b/g, " ").replace(/\s+/g, " ").trim(); if (!s) return null;
    var best = null;
    D.TOOLS.forEach(function (t) {
      var names = [t.id.replace(/-/g, " "), t.en.toLowerCase(), t.hi.toLowerCase(), t.en.toLowerCase().replace(/\b(tool|calculator|maker|generator)\b/g, "").replace(/\s+/g, " ").trim()];
      names.forEach(function (n) { if (!n) return; if (n === s || n.indexOf(s) === 0 || (s.length > 3 && n.indexOf(s) > -1)) { var sc = n === s ? 3 : n.indexOf(s) === 0 ? 2 : 1; if (!best || sc > best.sc) best = { t: t, sc: sc }; } });
    });
    return best ? best.t : null;
  }
  function stepsFor(t, lang) { var k = D.KINDS[t.kind]; var steps = k ? k[lang === "hi" ? "hi" : "en"] : []; return steps; }

  function reply(input, ctx) {
    ctx = ctx || {}; var raw = String(input || "").slice(0, 300).trim(), s = norm(raw), now = ctx.now || new Date();
    var lang = isHindiInput(raw) ? "hi" : /^[\d\s+\-*/^().,%=x×÷]*$/.test(s) || !/[a-zऀ-ॿ]/.test(s) ? (ctx.siteLang || "en") : "en";
    var B = [], chips = [];
    var t = function (en, hi) { return lang === "hi" ? hi : en; };
    function P(en, hi) { B.push({ t: "p", text: t(en, hi) }); }
    function ret(extra) { return { lang: lang, blocks: B, chips: chips, mem: extra || null }; }
    function toolBlock(ids) { B.push({ t: "tools", ids: ids }); }
    function starter() { chips = lang === "hi" ? ["फोटो का साइज़ छोटा करना है", "PDF जोड़नी है", "5 लाख का EMI 9% पर 5 साल", "रिज़्यूमे बनाना है"] : ["Reduce a photo's size", "Merge PDFs", "EMI of 5 lakh at 9% for 5 years", "Make a resume"]; }
    if (!s) { P("Type what you want to do, for example: reduce photo size.", "लिखें कि क्या करना है, जैसे: फोटो का साइज़ छोटा करना है।"); starter(); return ret(); }

    /* social */
    if (GREET.test(s)) { P("Hi! I can find the right tool, answer questions about DTAhub and do quick calculations like EMI, GST or unit conversion. What do you need?", "नमस्ते! मैं सही टूल ढूंढ सकता हूं, DTAhub के सवालों के जवाब दे सकता हूं और EMI, GST या यूनिट कन्वर्ज़न जैसे हिसाब कर सकता हूं। आपको क्या चाहिए?"); starter(); return ret(); }
    if (THANKS.test(s)) { P("You're welcome! Ask me anything else.", "आपका स्वागत है! कुछ और पूछना हो तो बताएं।"); starter(); return ret(); }
    if (HELP.test(s)) {
      P("I am the DTAhub assistant. I run fully on your device: nothing you type is sent anywhere. I can:", "मैं DTAhub असिस्टेंट हूं। मैं पूरी तरह आपके डिवाइस पर चलता हूं: आप जो लिखते हैं वह कहीं नहीं भेजा जाता। मैं ये कर सकता हूं:");
      B.push({ t: "list", items: lang === "hi" ? ["सही टूल ढूंढना (जैसे: \"फोटो का साइज़ कम करना है\")", "EMI, SIP, FD, GST, प्रतिशत, उम्र और यूनिट के हिसाब", "टूल कैसे चलाएं और DTAhub के सवाल", "थीम और भाषा बदलना, टूल खोलना"] : ["Find the right tool (try: \"make my photo smaller\")", "Work out EMI, SIP, FD, GST, percentages, age and units", "Explain how a tool works and answer questions about DTAhub", "Switch theme or language and open tools"] });
      P("I am not a chat AI like ChatGPT, so I cannot write essays. I will say so honestly when I do not know.", "मैं ChatGPT जैसा चैट AI नहीं हूं, इसलिए निबंध नहीं लिख सकता। जब मुझे पता नहीं होगा तो मैं ईमानदारी से बता दूंगा।"); starter(); return ret();
    }
    /* actions */
    for (var i = 0; i < ACTS.length; i++) if (ACTS[i].re.test(s)) {
      var a = ACTS[i]; B.push({ t: "act", act: a.act, v: a.v });
      P(a.act === "theme" ? (a.v === "dark" ? "Dark mode is on." : "Light mode is on.") : a.act === "lang" ? "Language changed." : "Chat cleared.", a.act === "theme" ? (a.v === "dark" ? "डार्क मोड चालू है।" : "लाइट मोड चालू है।") : a.act === "lang" ? "भाषा बदल दी।" : "चैट साफ कर दी।");
      return ret();
    }
    /* follow-ups about the last result */
    var mem = ctx.mem || {};
    if (mem.ids && /^(open|kholo|khol do|open it|open karo|pehla|pehle wala|first|1|iska link|isko kholo|खोलो|पहला)\b[\s!.?]*$/.test(s)) { B.push({ t: "act", act: "nav", v: "/tools/" + mem.ids[0] }); P("Opening it now.", "अभी खोल रहा हूं।"); return ret(mem); }
    if (mem.ids && /^(2|second|doosra|दूसरा)[\s!.?]*$/.test(s) && mem.ids[1]) { B.push({ t: "act", act: "nav", v: "/tools/" + mem.ids[1] }); P("Opening it now.", "अभी खोल रहा हूं।"); return ret(mem); }
    if (mem.ids && /^(how|kaise|how to use|steps|use kaise|kaise use|कैसे)[\s?!.]*$|^(how do i use it|kaise chalta hai|kaise use karun|use how)[\s?!.]*$/.test(s)) { return howTo(D.tool(mem.ids[0])); }
    if (/^(more|aur|more options|aur batao|aur dikhao|and\??|और|और बताओ)[\s!.?]*$/.test(s) && mem.q) { var all = toolByQuery(mem.q).map(function (x) { return x.d.id; }); var alt = (mem.more || []).filter(function (id) { return mem.ids.indexOf(id) < 0; }); if (!alt.length) { alt = toolIdx.search(tokens(mem.q)).map(function (x) { return x.d.id; }).filter(function (id) { return mem.ids.indexOf(id) < 0; }).slice(0, 3); } if (alt.length) { P("Here are more options:", "और विकल्प ये हैं:"); toolBlock(alt); return ret({ ids: alt, q: mem.q }); } }
    /* what-if follow-up on the last EMI, SIP or FD result */
    if (mem.calc && s.split(" ").length <= 8 && /(what if|agar|if |rate|byaj|tenure|saal|sal\b|years?|months?|mahine|%|lakh|amount|instead|badal|change|\bmake\b|\bset\b|कर दो|अगर|और)/.test(s) && !/\b(emi|sip|fd|gst|loan)\b/.test(s)) {
      var fe = extractLoan(s), mc = mem.calc, nr = fe.r != null ? fe.r : mc.r, nn = fe.months ? fe.months : mc.n, nP = fe.nums.length ? fe.nums.sort(function (a, b) { return b.v - a.v; })[0].v : mc.P;
      if (fe.r != null || fe.months || fe.nums.length) {
        var fc = calc(mc.k + " " + nP + " " + nr + "% " + nn + " months", lang, now);
        if (fc) { P("Updated with your change:", "आपके बदलाव के साथ नया हिसाब:"); B.push({ t: "calc", title: fc.title, rows: fc.rows, big: fc.big, note: fc.note }); chips = lang === "hi" ? ["दर 10% करो", "5 साल करो"] : ["what if rate 10%", "what if 7 years"]; return ret({ ids: mem.ids || null, q: mem.q || "", calc: fc.st || mc }); }
      }
    }
    /* how-to for the page the user is on */
    if (ctx.page && SELF_TOOL.test(s)) { var pt = D.tool(ctx.page); if (pt) return howTo(pt); }
    if (/^(how to use|kaise use|kaise chalate|how does)\s+(.+)/.test(s)) { var nm = findToolName(s.replace(/^(how to use|kaise use|kaise chalate|how does)\s+/, "").replace(/\s+(work|kaise|use kare|kaise karte|kaise karun)$/, "")); if (nm) return howTo(nm); }

    function howTo(tl) {
      B.push({ t: "tools", ids: [tl.id] });
      var st = stepsFor(tl, lang); if (st.length) B.push({ t: "steps", items: st });
      if (tl.tip) P((lang === "hi" ? "टिप: " : "Tip: ") + tl.tip[lang === "hi" ? "hi" : "en"], "");
      B[B.length - 1].text = B[B.length - 1].text || "";
      chips = [t("Open it", "इसे खोलें")];
      return ret({ ids: [tl.id], q: tl.en });
    }

    /* open a tool by name */
    var om = OPEN.exec(s);
    if (om) { var nmq = om[2] || om[3]; var tl = findToolName(nmq); if (tl) { B.push({ t: "act", act: "nav", v: "/tools/" + tl.id }); P("Opening " + tl.en + ".", tl.hi + " खोल रहा हूं।"); return ret({ ids: [tl.id], q: tl.en }); }
      var cats = D.CATS.filter(function (c) { return norm(c.en).indexOf(norm(nmq)) > -1 || norm(c.short.en) === norm(nmq); })[0];
      if (cats) { B.push({ t: "act", act: "nav", v: "/category/" + cats.id + "/" }); P("Opening " + cats.en + ".", cats.hi + " खोल रहा हूं।"); return ret(); }
      if (/contact|संपर्क|request/.test(nmq)) { B.push({ t: "act", act: "nav", v: "/contact" }); P("Opening the contact page.", "संपर्क पेज खोल रहा हूं।"); return ret(); }
      if (/setting|सेटिंग/.test(nmq)) { B.push({ t: "act", act: "nav", v: "/settings" }); P("Opening settings.", "सेटिंग्स खोल रहा हूं।"); return ret(); }
    }

    /* calculators */
    var c = calc(raw, lang, now);
    if (c) { B.push({ t: "calc", title: c.title, rows: c.rows, big: c.big, note: c.note }); if (c.st) { chips = lang === "hi" ? ["दर 10% करो", "5 साल करो"] : ["what if rate 10%", "what if 7 years"]; } if (c.tool) { B.push({ t: "tools", ids: [c.tool], small: true }); chips = [t("Open " + D.tool(c.tool).en, D.tool(c.tool).hi + " खोलें")].concat(c.st ? chips : []); } return ret(c.tool || c.st ? { ids: c.tool ? [c.tool] : null, q: c.title, calc: c.st || null } : null); }

    /* known gaps: say so honestly */
    var sc = tokens(raw, true).join(" ");
    for (var g = 0; g < GAPS.length; g++) if (GAPS[g].re.test(s) || GAPS[g].re.test(sc)) {
      P(GAPS[g].en, GAPS[g].hi); if (GAPS[g].near.length) { P("These can help:", "ये मदद कर सकते हैं:"); toolBlock(GAPS[g].near); }
      B.push({ t: "links", items: [{ href: "/contact#request", label: t("Request this tool", "यह टूल मांगें") }] }); return ret({ ids: GAPS[g].near, q: raw });
    }

    /* decide between tools, FAQ and guides */
    var qt = tokens(raw), tr = toolByQuery(raw), fr = faqIdx.search(qt), fTop = fr[0], tTop = tr.length ? toolIdx.search(qt)[0] : null, br = blogIdx.search(qt);
    var faqWins = fTop && fTop.cov >= .55 && (!tTop || fTop.cov > tTop.cov + .05 || /^(is|are|can|do|does|will|why|kya|क्या|kyu|kaise)\b/.test(s) && fTop.cov >= tTop.cov);
    if (faqWins) {
      var f = fTop.d.f; P(f.a.en, f.a.hi); if (f.tool) toolBlock([f.tool]);
      var gd = f.guide ? (KB.blog || []).filter(function (x) { return x.slug === f.guide; })[0] : null;
      if (gd) B.push({ t: "links", items: [{ href: "/blog/" + gd.slug, label: lang === "hi" ? gd.hi : gd.en }] });
      return ret(f.tool ? { ids: [f.tool], q: raw } : null);
    }
    if (tr.length) {
      var ids = tr.map(function (x) { return x.d.id; });
      P(tr.length === 1 ? "This tool does it:" : "These tools can help:", tr.length === 1 ? "यह टूल यह काम करता है:" : "ये टूल मदद कर सकते हैं:");
      toolBlock(ids);
      var guide = br.length && br[0].cov >= .75 ? br[0].d.b : null;
      if (guide) B.push({ t: "links", items: [{ href: "/blog/" + guide.slug, label: (lang === "hi" ? "गाइड: " : "Guide: ") + (lang === "hi" ? guide.hi : guide.en) }] });
      chips = [t("How do I use it?", "यह कैसे चलाएं?"), t("Open it", "इसे खोलें")];
      return ret({ ids: ids, q: raw, more: toolIdx.search(qt).map(function (x) { return x.d.id; }).slice(3, 6) });
    }
    if (br.length && br[0].cov >= .6) { var bb = br[0].d.b; P("This guide may help:", "यह गाइड काम आ सकती है:"); B.push({ t: "links", items: [{ href: "/blog/" + bb.slug, label: lang === "hi" ? bb.hi : bb.en }] }); return ret(); }
    if (fTop && fTop.cov >= .4) { var f2 = fTop.d.f; P(f2.a.en, f2.a.hi); return ret(); }

    /* honest fallback */
    P("I am not sure I understood. I can find a tool, explain how it works, or calculate things like EMI, GST and unit conversion. Try describing the job, for example \"reduce photo size\" or \"merge two PDFs\".", "मुझे पूरी तरह समझ नहीं आया। मैं टूल ढूंढ सकता हूं, उसे चलाना समझा सकता हूं, या EMI, GST और यूनिट जैसे हिसाब कर सकता हूं। काम बताकर देखें, जैसे \"फोटो का साइज़ कम करना है\" या \"दो PDF जोड़नी हैं\"।");
    B.push({ t: "links", items: [{ href: "/tools/", label: t("Browse all tools", "सभी टूल देखें") }, { href: "/contact#request", label: t("Request a tool", "नया टूल मांगें") }] });
    starter(); return ret();
  }

  /* typeahead: tool names and a few ready phrases that start with what the person has typed */
  var PHRASES = [["EMI of 5 lakh at 9% for 5 years", "5 लाख का EMI 9% पर 5 साल"], ["SIP 5000 per month at 12% for 10 years", "SIP 5000 महीना 12% 10 साल"], ["GST 18% on 2500", "2500 पर 18% GST"], ["5 km to miles", "5 km को miles में"], ["BMI 70 kg 175 cm", "BMI 70 kg 175 cm"], ["days between 1 jan 2026 and 15 mar 2026", "1 jan 2026 से 15 mar 2026 तक के दिन"], ["reduce photo size", "फोटो का साइज़ कम करना है"], ["merge PDF files", "PDF जोड़नी है"], ["make a resume", "रिज़्यूमे बनाना है"], ["remove background from photo", "फोटो का बैकग्राउंड हटाना है"]];
  function suggest(input, siteLang) {
    var q = norm(String(input || "")); if (q.length < 2) return [];
    var hi = isHindiInput(input) || siteLang === "hi", out = [];
    PHRASES.forEach(function (p) { var x = hi ? p[1] : p[0]; if (norm(x).indexOf(q) === 0 || (q.length > 2 && norm(p[0]).indexOf(q) === 0)) out.push(x); });
    D.TOOLS.forEach(function (t) { var n = norm(t.en), h = norm(t.hi); if (out.length < 4 && (n.indexOf(q) === 0 || h.indexOf(q) === 0 || (q.length > 2 && n.indexOf(" " + q) > -1))) out.push((hi ? "खोलें " : "Open ") + (hi ? t.hi : t.en)); });
    return out.filter(function (x, i) { return out.indexOf(x) === i; }).slice(0, 4);
  }

  var API = { reply: reply, suggest: suggest, calc: calc, calcExpr: calcExpr, tokens: tokens, words: words, norm: norm };
  if (isNode) module.exports = API; else root.DTAAssist = API;
})(typeof window !== "undefined" ? window : globalThis);

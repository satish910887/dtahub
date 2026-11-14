/* DTAhub central registry. Single source of truth for the site AND the build script.
   To add a tool: create public/tools/<id>.html, add one entry in TOOLS below, run `node scripts/build.mjs`. */
(function (root) {
  var SITE = "https://dtahub.satish910887.workers.dev";

  /* Original line icons (24x24, stroke). */
  var ICONS = {
    pdf: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
    text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
    dev: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    seo: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    "pdf-merge": '<rect x="4" y="3" width="11" height="14" rx="2"/><path d="M9 21h9a2 2 0 0 0 2-2V8M7.5 8h4M7.5 12h4"/>',
    "pdf-split": '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5 20 17M8 16.5 20 7"/>',
    "image-to-pdf": '<rect x="3" y="4" width="13" height="13" rx="2"/><circle cx="7.5" cy="8.5" r="1.4"/><path d="m3 14 4-4 3 3 2-2M19 8v11m0 0-3-3m3 3 3-3"/>',
    "image-compress": '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/>',
    "image-resize": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m9 15 6-6M11.5 9H15v3.5"/>',
    "image-convert": '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    "word-counter": '<path d="M4 6h16M4 12h10M4 18h16"/>',
    "case-converter": '<path d="m3 18 5-12 5 12M5 14h6M15 18v-6a3 3 0 0 1 6 0v6M15 15h6"/>',
    "typing-helper": '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    "json-formatter": '<path d="M9 4H8a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-1"/>',
    base64: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "qr-code": '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2M14 20h2M20 14v2"/>',
    emi: '<path d="m3 10 9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    age: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    gst: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    percentage: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    "meta-tags": '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
    password: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3"/>',
    career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    drag: '<circle cx="9" cy="6" r="1.300"/><circle cx="15" cy="6" r="1.300"/><circle cx="9" cy="12" r="1.300"/><circle cx="15" cy="12" r="1.300"/><circle cx="9" cy="18" r="1.300"/><circle cx="15" cy="18" r="1.300"/>',
    "unit-converter": '<path d="M4 8h13m-3-3 3 3-3 3M20 16H7m3-3-3 3 3 3"/>',
    "sip": '<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 3 5-6"/><path d="M15 8h4v4"/>',
    "lorem-ipsum": '<path d="M5 6h14M5 10h14M5 14h9M5 18h6"/>',
    "color-palette": '<path d="M12 3a9 9 0 1 0 0 18c1.400 0 2-1 1.500-2-.5-1.100.2-2.500 1.700-2.500H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z"/><circle cx="8" cy="11" r="1.200"/><circle cx="12" cy="7.500" r="1.200"/><circle cx="16" cy="11" r="1.200"/>',
    "invoice-maker": '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    "cover-letter": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    "resume-maker": '<path d="M6 3h9l4 4v14H6z"/><circle cx="12" cy="11" r="2.2"/><path d="M8.500 17c.6-1.800 2-2.600 3.500-2.600s2.900.8 3.500 2.600"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.500M12 18.500V21M3 12h2.500M18.500 12H21M5.600 5.600l1.800 1.800M16.600 16.600l1.800 1.800M5.600 18.400l1.800-1.800M16.600 7.400l1.800-1.800"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    upload: '<path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14"/>',
    print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
    star: '<path d="m12 3.5 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.9l6.1-.8z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5S9.500 6 12 3.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
    shield: '<path d="M12 3 5 6v5.500c0 4.200 2.800 7.500 7 9.500 4.200-2 7-5.300 7-9.500V6z"/><path d="m9 12 2.200 2.200L15.500 10"/>',
    bolt: '<path d="M13 3 5 13.500h6L10 21l8-10.500h-6z"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M11 18h2"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M4 13h16M12 9c-3 0-4.500-1-4.500-2.500S9 4 12 9zm0 0c3 0 4.500-1 4.500-2.500S15 4 12 9z"/>',
    download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };

  var CATS = [
    { id: "pdf", icon: "pdf", hue: 350, en: "PDF Tools", hi: "PDF टूल्स", short: { en: "PDF", hi: "PDF" },
      den: "Merge, split and create PDFs", dhi: "PDF जोड़ें, अलग करें और बनाएं",
      intro: { en: "Merge, split and create PDF files right in your browser. No upload, no sign-up.", hi: "PDF जोड़ें, अलग करें और बनाएं, सीधे आपके ब्राउज़र में। न अपलोड, न साइन-अप।" },
      body: {
        en: "PDF is the standard format for forms, applications, bills and certificates. DTAhub PDF tools run entirely on your device: your documents are read by your own browser and never sent to our servers. Combine several files into one, pull out only the pages you need, or turn your photos into a clean PDF in seconds. They are free, work on slow connections and are designed to be easy on a phone.",
        hi: "फॉर्म, एप्लीकेशन, बिल और सर्टिफिकेट के लिए PDF सबसे आम फॉर्मेट है। DTAhub के PDF टूल्स पूरी तरह आपके डिवाइस पर चलते हैं: आपके दस्तावेज़ आपका अपना ब्राउज़र पढ़ता है और हमारे सर्वर पर कभी नहीं जाते। कई फाइलें एक में जोड़ें, सिर्फ ज़रूरी पेज निकालें या फोटो से साफ PDF बनाएं। ये मुफ्त हैं, धीमे इंटरनेट पर भी चलते हैं और फोन पर आसानी से इस्तेमाल होते हैं।" },
      related: ["image", "career"] },
    { id: "image", icon: "image", hue: 165, en: "Image Tools", hi: "इमेज टूल्स", short: { en: "Image", hi: "इमेज" },
      den: "Compress, resize and convert photos", dhi: "फोटो छोटी करें, रीसाइज़ और कन्वर्ट करें",
      intro: { en: "Compress, resize and convert photos privately. Your images never leave your phone.", hi: "फोटो को प्राइवेट तरीके से छोटा करें, रीसाइज़ करें और कन्वर्ट करें। आपकी इमेज फोन से बाहर नहीं जाती।" },
      body: {
        en: "Photos taken on modern phones are large, and many websites, forms and chat apps accept only small files. The image tools on DTAhub shrink file size, change dimensions and switch between JPG, PNG and WebP using your browser's own image engine. Nothing is uploaded, so your personal photos stay private, and the tools are light enough for low-end phones.",
        hi: "आजकल के फोन की फोटो बड़ी होती हैं, जबकि कई वेबसाइट, फॉर्म और चैट ऐप छोटी फाइल ही लेते हैं। DTAhub के इमेज टूल्स ब्राउज़र के अपने इमेज इंजन से फाइल साइज़ घटाते हैं, माप बदलते हैं और JPG, PNG, WebP के बीच बदलते हैं। कुछ भी अपलोड नहीं होता, इसलिए आपकी निजी फोटो प्राइवेट रहती हैं।" },
      related: ["pdf", "text"] },
    { id: "text", icon: "text", hue: 45, en: "Text Tools", hi: "टेक्स्ट टूल्स", short: { en: "Text", hi: "टेक्स्ट" },
      den: "Count, convert and type Hindi", dhi: "गिनें, बदलें और हिंदी में लिखें",
      intro: { en: "Word counter, case converter and a Hindi typing helper for everyday writing.", hi: "रोज़मर्रा की लिखाई के लिए शब्द गिनती, केस कन्वर्टर और हिंदी टाइपिंग हेल्पर।" },
      body: {
        en: "Whether you are writing an essay, a social media post or an application, small text utilities save time. Count words and reading time, change the letter case of any English text, or type Hindi using English letters and copy the Devanagari result. Everything works offline once the page has loaded and your text is never stored.",
        hi: "चाहे निबंध लिखना हो, सोशल मीडिया पोस्ट या आवेदन, छोटे टेक्स्ट टूल्स समय बचाते हैं। शब्द और पढ़ने का समय गिनें, अंग्रेज़ी टेक्स्ट का केस बदलें, या अंग्रेज़ी अक्षरों से हिंदी लिखकर देवनागरी नतीजा कॉपी करें। पेज खुलने के बाद सब कुछ ऑफलाइन भी चलता है और आपका टेक्स्ट कहीं सेव नहीं होता।" },
      related: ["career", "dev"] },
    { id: "dev", icon: "dev", hue: 200, en: "Developer Tools", hi: "डेवलपर टूल्स", short: { en: "Developer", hi: "डेवलपर" },
      den: "JSON, Base64 and QR utilities", dhi: "JSON, Base64 और QR यूटिलिटी",
      intro: { en: "Format JSON, encode Base64 and create QR codes. Fast, private and ad-free.", hi: "JSON फॉर्मेट करें, Base64 एनकोड करें और QR कोड बनाएं। तेज़, प्राइवेट और बिना विज्ञापन।" },
      body: {
        en: "Developers and students reach for the same small utilities again and again. DTAhub keeps them together: validate and beautify JSON, encode or decode Base64 (including Hindi and other Unicode text) and generate downloadable QR codes. Your data is processed in the browser, so it is safe to paste real examples.",
        hi: "डेवलपर और छात्र बार-बार वही छोटी यूटिलिटी इस्तेमाल करते हैं। DTAhub इन्हें एक जगह रखता है: JSON जांचें और सुंदर बनाएं, Base64 एनकोड या डिकोड करें (हिंदी और दूसरे यूनिकोड टेक्स्ट समेत) और डाउनलोड होने वाले QR कोड बनाएं। डेटा ब्राउज़र में ही प्रोसेस होता है।" },
      related: ["text", "seo"] },
    { id: "calc", icon: "calc", hue: 280, en: "Calculators", hi: "कैलकुलेटर", short: { en: "Calculator", hi: "कैलकुलेटर" },
      den: "EMI, GST, age and percentage", dhi: "EMI, GST, उम्र और प्रतिशत",
      intro: { en: "EMI with a chart, GST, age and percentage calculators, instant and free.", hi: "चार्ट के साथ EMI, GST, उम्र और प्रतिशत कैलकुलेटर, तुरंत और मुफ्त।" },
      body: {
        en: "Everyday money and date calculations should not need a spreadsheet. Work out your loan EMI with a principal versus interest chart, add or remove GST with the CGST and SGST split, find your exact age in years, months and days, or solve common percentage questions. Results update as you type. They are a general aid, so double-check important financial decisions.",
        hi: "रोज़ के पैसे और तारीख के हिसाब के लिए स्प्रेडशीट की ज़रूरत नहीं होनी चाहिए। मूलधन बनाम ब्याज चार्ट के साथ लोन की EMI निकालें, CGST-SGST के साथ GST जोड़ें या हटाएं, साल-महीने-दिन में सही उम्र जानें, या प्रतिशत के आम सवाल हल करें। टाइप करते ही नतीजा बदलता है। ये सामान्य मदद के लिए हैं, ज़रूरी आर्थिक फैसले दोबारा जांच लें।" },
      related: ["text", "seo"] },
    { id: "seo", icon: "seo", hue: 110, en: "SEO & Utility", hi: "SEO और यूटिलिटी", short: { en: "SEO & Utility", hi: "SEO और यूटिलिटी" },
      den: "Meta tags and strong passwords", dhi: "मेटा टैग और मज़बूत पासवर्ड",
      intro: { en: "Create meta tags for your pages and generate strong random passwords.", hi: "अपने पेजों के लिए मेटा टैग बनाएं और मज़बूत रैंडम पासवर्ड जनरेट करें।" },
      body: {
        en: "Good meta tags help search engines and social apps show your page properly, and strong passwords keep your accounts safe. Generate SEO, Open Graph and Twitter Card tags in one place, and create random passwords with your browser's secure random generator. Nothing you type is stored or sent anywhere.",
        hi: "अच्छे मेटा टैग सर्च इंजन और सोशल ऐप को आपका पेज सही दिखाने में मदद करते हैं, और मज़बूत पासवर्ड आपके अकाउंट सुरक्षित रखते हैं। SEO, Open Graph और Twitter Card टैग एक जगह बनाएं और ब्राउज़र के सुरक्षित रैंडम जनरेटर से पासवर्ड बनाएं। आप जो टाइप करते हैं वो कहीं सेव या भेजा नहीं जाता।" },
      related: ["dev", "text"] },
    { id: "career", icon: "career", hue: 30, en: "Resume & Career", hi: "रिज़्यूमे और करियर", short: { en: "Career", hi: "करियर" },
      den: "Resume, cover letter and invoice makers", dhi: "रिज़्यूमे, कवर लेटर और इनवॉइस मेकर",
      intro: { en: "Build a clean, professional resume with a live preview and save it as a PDF. Private, free and no sign-up.", hi: "लाइव प्रीव्यू के साथ साफ, प्रोफेशनल रिज़्यूमे बनाएं और PDF में सेव करें। प्राइवेट, मुफ्त और बिना साइन-अप।" },
      body: {
        en: "A good resume is short, clear and easy for both people and software to read. The DTAhub resume maker gives you six original templates, a live A4 preview and a checklist that points out what is missing. Your details are saved only on your own device and the PDF keeps real, selectable text, which is what most applicant tracking systems need.",
        hi: "अच्छा रिज़्यूमे छोटा, साफ और इंसानों व सॉफ्टवेयर दोनों के लिए पढ़ने में आसान होता है। DTAhub का रिज़्यूमे मेकर छह ओरिजिनल टेम्पलेट, लाइव A4 प्रीव्यू और एक चेकलिस्ट देता है जो बताती है क्या छूट गया है। आपकी जानकारी सिर्फ आपके अपने डिवाइस पर सेव रहती है और PDF में असली, चुनने लायक टेक्स्ट रहता है, जो ज़्यादातर रिक्रूटमेंट सिस्टम को चाहिए।" },
      related: ["text", "pdf"] }
  ];

  /* kind decides the generic "how to use" steps shown on the tool page. */
  var KINDS = {
    file: { en: ["Tap the box (or drag a file onto it) and choose your file.", "Adjust the options if you need to.", "Download the result. Your file never leaves your device."],
            hi: ["बॉक्स पर टैप करें (या फाइल खींचकर डालें) और अपनी फाइल चुनें।", "ज़रूरत हो तो विकल्प बदलें।", "नतीजा डाउनलोड करें। आपकी फाइल डिवाइस से बाहर नहीं जाती।"] },
    text: { en: ["Type or paste your text into the box.", "Tap the action button for the result.", "Copy the result with one tap."],
            hi: ["बॉक्स में टेक्स्ट लिखें या पेस्ट करें।", "नतीजे के लिए एक्शन बटन दबाएं।", "एक टैप में नतीजा कॉपी करें।"] },
    builder: { en: ["Fill in your details section by section. Everything is saved on your device as you type.", "Pick a template, colour and font and watch the live preview.", "Check the checklist, then tap Download PDF and choose Save as PDF."],
               hi: ["अपनी जानकारी सेक्शन-दर-सेक्शन भरें। टाइप करते ही सब आपके डिवाइस पर सेव होता है।", "टेम्पलेट, रंग और फॉन्ट चुनें और लाइव प्रीव्यू देखें।", "चेकलिस्ट देखें, फिर Download PDF दबाकर Save as PDF चुनें।"] },
    doc: { en: ["Fill in the details. They are saved on your device as you type.", "Check the live preview on the page.", "Tap Download PDF and choose Save as PDF."],
           hi: ["जानकारी भरें। टाइप करते ही वह आपके डिवाइस पर सेव होती है।", "पेज पर लाइव प्रीव्यू देखें।", "Download PDF दबाकर Save as PDF चुनें।"] },
    gen: { en: ["Pick your options or enter a value.", "The result updates instantly.", "Tap a result to copy it."],
           hi: ["अपने विकल्प चुनें या मान डालें।", "नतीजा तुरंत बदलता है।", "कॉपी करने के लिए नतीजे पर टैप करें।"] },
    calc: { en: ["Enter your numbers or dates.", "Results update instantly as you type.", "Change any value to compare scenarios."],
            hi: ["अपने अंक या तारीखें डालें।", "टाइप करते ही नतीजा तुरंत बदलता है।", "अलग स्थितियां देखने के लिए कोई भी मान बदलें।"] }
  };

  var D = "2026-11-13";
  var TOOLS = [
    { id: "resume-maker", cat: "career", kind: "builder", noReset: 1, pop: 0, featured: 1, added: "2026-11-14",
      en: "Resume Maker", hi: "रिज़्यूमे मेकर", den: "Build a resume and save as PDF", dhi: "रिज़्यूमे बनाएं, PDF में सेव करें",
      about: { en: "Resume Maker lets you build a professional resume with six original templates (including an ATS-simple and an Indian fresher CV), a live A4 preview, your own accent colour and font, an optional photo, drag-and-drop ordering of sections and saved versions for different jobs. The checklist flags a missing summary, thin experience or a resume that runs past two pages. The PDF keeps real selectable text so applicant tracking systems can read it.", hi: "Resume Maker से आप छह ओरिजिनल टेम्पलेट (ATS-सिंपल और भारतीय फ्रेशर CV समेत), लाइव A4 प्रीव्यू, अपना रंग और फॉन्ट, वैकल्पिक फोटो, सेक्शन को खींचकर क्रम बदलने और अलग-अलग नौकरियों के लिए सेव वर्ज़न की सुविधा के साथ प्रोफेशनल रिज़्यूमे बना सकते हैं। चेकलिस्ट बताती है कि समरी छूटी है, अनुभव कम है या रिज़्यूमे दो पेज से लंबा है। PDF में असली चुनने लायक टेक्स्ट रहता है ताकि रिक्रूटमेंट सिस्टम उसे पढ़ सकें।" },
      tip: { en: "Keep it to one or two pages, start each point with an action word and add numbers where you can. Use Export to keep a backup file.", hi: "एक या दो पेज रखें, हर पॉइंट किसी एक्शन शब्द से शुरू करें और जहां हो सके अंक जोड़ें। बैकअप के लिए Export से फाइल सेव रखें।" },
      related: ["cover-letter", "word-counter", "image-compress"] },
    { id: "cover-letter", cat: "career", kind: "doc", noReset: 1, pop: 30, added: "2026-11-14",
      en: "Cover Letter Maker", hi: "कवर लेटर मेकर", den: "Write a cover letter and save as PDF", dhi: "कवर लेटर बनाएं, PDF में सेव करें",
      about: { en: "Cover Letter Maker turns a few short answers into a clean one-page letter. It fills your name and contact details from your saved resume, offers three tones, and lets you edit the final text before you save it as a PDF. It uses a template, not artificial intelligence, so read and personalise the letter before you send it.", hi: "Cover Letter Maker कुछ छोटे जवाबों से साफ एक पेज का पत्र बना देता है। यह आपका नाम और संपर्क सेव किए रिज़्यूमे से भर देता है, तीन अंदाज़ देता है और PDF बनाने से पहले आप पूरा टेक्स्ट बदल सकते हैं। यह टेम्पलेट से बनता है, कृत्रिम बुद्धिमत्ता से नहीं, इसलिए भेजने से पहले पत्र पढ़कर अपने हिसाब से बदलें।" },
      tip: { en: "Name the company and the role, and mention one real result you achieved. Keep the letter under one page.", hi: "कंपनी और पद का नाम लिखें और अपनी एक असली उपलब्धि बताएं। पत्र एक पेज से छोटा रखें।" },
      related: ["resume-maker","word-counter","pdf-merge"] },
    { id: "invoice-maker", cat: "career", kind: "doc", noReset: 1, pop: 31, added: "2026-11-14",
      en: "Invoice Maker", hi: "इनवॉइस मेकर", den: "Create a GST invoice and save as PDF", dhi: "GST इनवॉइस बनाएं, PDF में सेव करें",
      about: { en: "Invoice Maker creates a clean invoice with your details, your client, line items, optional GST per item and a discount. It totals everything, writes the amount in words and lets you save the invoice as a PDF. Your details stay on your device. It does not file GST returns or replace an accountant.", hi: "Invoice Maker आपकी जानकारी, ग्राहक, आइटम, हर आइटम पर वैकल्पिक GST और छूट के साथ साफ इनवॉइस बनाता है। यह सब जोड़ता है, राशि शब्दों में लिखता है और इनवॉइस को PDF में सेव करने देता है। आपकी जानकारी आपके डिवाइस पर ही रहती है। यह GST रिटर्न नहीं भरता और अकाउंटेंट की जगह नहीं लेता।" },
      tip: { en: "Number your invoices in order and check the GST rate and your GSTIN with your accountant.", hi: "इनवॉइस को क्रम से नंबर दें और GST दर और अपना GSTIN अपने अकाउंटेंट से जांच लें।" },
      related: ["gst","percentage","resume-maker"] },
    { id: "unit-converter", cat: "calc", kind: "calc", pop: 32, added: "2026-11-14",
      en: "Unit Converter", hi: "यूनिट कन्वर्टर", den: "Length, weight, area, temperature and more", dhi: "लंबाई, वज़न, क्षेत्रफल, तापमान और बहुत कुछ",
      about: { en: "Unit Converter changes values between common units of length, weight, area, volume, temperature, speed, data size and time. It shows the converted value as you type and a table with every unit in the group. Area includes acre, hectare, square feet and gaj (square yard).", hi: "Unit Converter लंबाई, वज़न, क्षेत्रफल, आयतन, तापमान, गति, डेटा साइज़ और समय की आम इकाइयों के बीच मान बदलता है। टाइप करते ही बदला हुआ मान और ग्रुप की हर इकाई की तालिका दिखती है। क्षेत्रफल में एकड़, हेक्टेयर, वर्ग फुट और गज (वर्ग गज) शामिल हैं।" },
      tip: { en: "Use the swap button to reverse the direction. Land records can use local units, so check the unit before relying on a result.", hi: "दिशा उलटने के लिए swap बटन दबाएं। ज़मीन के रिकॉर्ड में स्थानीय इकाइयां हो सकती हैं, इसलिए नतीजे पर भरोसा करने से पहले इकाई जांच लें।" },
      related: ["percentage","age","emi"] },
    { id: "sip", cat: "calc", kind: "calc", pop: 33, added: "2026-11-14",
      en: "SIP Calculator", hi: "SIP कैलकुलेटर", den: "Estimate mutual fund SIP growth", dhi: "म्यूचुअल फंड SIP का अनुमान",
      about: { en: "SIP Calculator estimates how a monthly investment could grow at an assumed yearly return, using monthly compounding. It shows the amount you invest, the estimated gain and the final value with a simple bar. Real returns change from year to year and are never guaranteed.", hi: "SIP Calculator अनुमान लगाता है कि मासिक निवेश मानी हुई सालाना दर पर मासिक चक्रवृद्धि से कितना बढ़ सकता है। यह आपका निवेश, अनुमानित लाभ और अंतिम मूल्य एक सरल बार के साथ दिखाता है। असली रिटर्न हर साल बदलता है और कभी पक्का नहीं होता।" },
      tip: { en: "Try a lower return than you hope for. This is an estimate, not advice or a promise.", hi: "जितनी उम्मीद हो उससे कम रिटर्न भी आज़माएं। यह सिर्फ अनुमान है, सलाह या वादा नहीं।" },
      related: ["emi","percentage","gst"] },
    { id: "lorem-ipsum", cat: "text", kind: "gen", pop: 34, added: "2026-11-14",
      en: "Lorem Ipsum Generator", hi: "लोरेम इप्सम जनरेटर", den: "Placeholder text for designs", dhi: "डिज़ाइन के लिए नमूना टेक्स्ट",
      about: { en: "Lorem Ipsum Generator makes placeholder paragraphs, sentences or words for mock-ups and layouts. Choose how many, start with the classic opening line if you like, and copy the result in one tap. It runs in your browser.", hi: "Lorem Ipsum Generator मॉक-अप और लेआउट के लिए नमूना पैराग्राफ, वाक्य या शब्द बनाता है। कितने चाहिए चुनें, चाहें तो क्लासिक शुरुआती लाइन से शुरू करें और एक टैप में कॉपी करें। यह आपके ब्राउज़र में चलता है।" },
      tip: { en: "Replace placeholder text with real content before publishing a page.", hi: "पेज छापने से पहले नमूना टेक्स्ट की जगह असली सामग्री डालें।" },
      related: ["word-counter","case-converter","typing-helper"] },
    { id: "color-palette", cat: "dev", kind: "gen", pop: 35, added: "2026-11-14",
      en: "Colour Palette Generator", hi: "कलर पैलेट जनरेटर", den: "Matching colours from one colour", dhi: "एक रंग से मेल खाते रंग",
      about: { en: "Colour Palette Generator builds matching colours from one base colour: complementary, analogous, triadic and a row of tints and shades. Tap any swatch to copy its HEX code, and see its RGB and HSL values and its contrast ratio against white and black.", hi: "Colour Palette Generator एक बेस रंग से मेल खाते रंग बनाता है: कॉम्प्लिमेंटरी, एनालॉगस, ट्रायडिक और हल्के-गहरे रंगों की पंक्ति। किसी भी रंग पर टैप करके उसका HEX कोड कॉपी करें और उसके RGB, HSL और सफेद-काले के साथ कंट्रास्ट अनुपात देखें।" },
      tip: { en: "For readable text aim for a contrast ratio of at least 4.5 to 1.", hi: "पढ़ने लायक टेक्स्ट के लिए कंट्रास्ट अनुपात कम से कम 4.5 से 1 रखें।" },
      related: ["meta-tags","qr-code","json-formatter"] },
    { id: "pdf-merge", cat: "pdf", kind: "file", pop: 1, featured: 1, added: D,
      en: "Merge PDF", hi: "PDF जोड़ें", den: "Combine many PDFs into one", dhi: "कई PDF को एक बनाएं",
      about: { en: "Merge PDF joins two or more PDF files into a single document in the order you choose. Use the arrow buttons to reorder files before merging. The files are processed by your browser, so private documents such as certificates or bills are never uploaded.", hi: "Merge PDF दो या ज़्यादा PDF फाइलों को आपके चुने क्रम में एक दस्तावेज़ में जोड़ता है। जोड़ने से पहले तीर वाले बटन से क्रम बदलें। फाइलें ब्राउज़र में ही प्रोसेस होती हैं, इसलिए सर्टिफिकेट या बिल जैसे निजी दस्तावेज़ अपलोड नहीं होते।" },
      tip: { en: "Password-protected PDFs must be unlocked first. Have photos? Convert them with Image to PDF, then merge.", hi: "पासवर्ड वाली PDF पहले अनलॉक करनी होगी। फोटो हैं? पहले Image to PDF से बदलें, फिर जोड़ें।" },
      related: ["pdf-split", "image-to-pdf", "image-compress"] },
    { id: "pdf-split", cat: "pdf", kind: "file", pop: 5, added: D,
      en: "Split PDF", hi: "PDF अलग करें", den: "Extract pages from a PDF", dhi: "PDF के पेज अलग करें",
      about: { en: "Split PDF extracts the pages you pick into a new PDF. Enter ranges like 1-3, 5, 8-10 and the tool builds a fresh file containing only those pages in that order.", hi: "Split PDF आपके चुने पेजों से नई PDF बनाता है। 1-3, 5, 8-10 जैसी रेंज डालें और टूल सिर्फ उन्हीं पेजों की नई फाइल बना देगा।" },
      tip: { en: "Need to remove pages? Extract all the pages you want to keep.", hi: "पेज हटाने हैं? जो पेज रखने हैं उन्हें निकाल लें।" },
      related: ["pdf-merge", "image-to-pdf"] },
    { id: "image-to-pdf", cat: "pdf", kind: "file", pop: 3, added: D,
      en: "Image to PDF", hi: "इमेज से PDF", den: "Turn photos into a PDF", dhi: "फोटो को PDF बनाएं",
      about: { en: "Image to PDF turns one or many photos into a single PDF. Choose A4 pages with a neat margin or pages that match each photo. Photos are resized sensibly so the PDF stays easy to share.", hi: "Image to PDF एक या कई फोटो से एक PDF बनाता है। सुंदर मार्जिन वाले A4 पेज या हर फोटो के माप वाले पेज चुनें। फोटो समझदारी से छोटी की जाती हैं ताकि PDF शेयर करना आसान रहे।" },
      tip: { en: "Scanning documents with your camera? Add the photos in order, then create the PDF.", hi: "कैमरे से दस्तावेज़ स्कैन कर रहे हैं? फोटो क्रम से जोड़ें, फिर PDF बनाएं।" },
      related: ["pdf-merge", "image-compress", "image-resize"] },
    { id: "image-compress", cat: "image", kind: "file", pop: 2, featured: 1, added: D,
      en: "Compress Image", hi: "इमेज छोटी करें", den: "Reduce image size", dhi: "इमेज का साइज़ घटाएं",
      about: { en: "Compress Image reduces the file size of JPG, PNG and WebP photos. Move the quality slider and watch the size change live, then download. Useful for forms that accept only 100 KB or 200 KB and for sending photos on slow networks.", hi: "Compress Image JPG, PNG और WebP फोटो का फाइल साइज़ घटाता है। क्वालिटी स्लाइडर हिलाएं, साइज़ तुरंत बदलता दिखेगा, फिर डाउनलोड करें। 100 KB या 200 KB वाले फॉर्म और धीमे नेटवर्क पर फोटो भेजने के लिए उपयोगी।" },
      tip: { en: "Quality 60 to 80 percent usually looks the same. Still too big? Resize the image first.", hi: "60 से 80 प्रतिशत क्वालिटी आमतौर पर एक जैसी दिखती है। फिर भी बड़ी है? पहले इमेज रीसाइज़ करें।" },
      related: ["image-resize", "image-convert", "image-to-pdf"] },
    { id: "image-resize", cat: "image", kind: "file", pop: 6, added: D,
      en: "Resize Image", hi: "इमेज रीसाइज़", den: "Change width and height", dhi: "चौड़ाई-ऊंचाई बदलें",
      about: { en: "Resize Image changes the width and height of a photo in pixels or with quick 25, 50 and 75 percent buttons. Keep proportions locked to avoid stretching.", hi: "Resize Image फोटो की चौड़ाई और ऊंचाई पिक्सल में या 25, 50, 75 प्रतिशत बटन से बदलता है। खिंचाव से बचने के लिए अनुपात लॉक रखें।" },
      tip: { en: "Smaller dimensions also mean a smaller file, which helps for uploads.", hi: "माप छोटा करने से फाइल भी छोटी होती है, जो अपलोड में काम आती है।" },
      related: ["image-compress", "image-convert"] },
    { id: "image-convert", cat: "image", kind: "file", pop: 8, added: D,
      en: "Image Converter", hi: "इमेज कन्वर्टर", den: "JPG, PNG, WebP", dhi: "JPG, PNG, WebP",
      about: { en: "Image Converter changes a photo between JPG, PNG and WebP. PNG keeps transparency and sharp edges, JPG is small for photos, and WebP is often the smallest of all.", hi: "Image Converter फोटो को JPG, PNG और WebP के बीच बदलता है। PNG पारदर्शिता और तेज़ किनारे रखता है, JPG फोटो के लिए छोटा होता है, और WebP अक्सर सबसे छोटा।" },
      tip: { en: "Converting to JPG fills transparent areas with white.", hi: "JPG में बदलने पर पारदर्शी हिस्से सफेद हो जाते हैं।" },
      related: ["image-compress", "image-resize", "image-to-pdf"] },
    { id: "word-counter", cat: "text", kind: "text", pop: 4, added: D,
      en: "Word Counter", hi: "शब्द गिनें", den: "Words, characters, reading time", dhi: "शब्द, अक्षर, पढ़ने का समय",
      about: { en: "Word Counter counts words, characters with and without spaces, sentences, paragraphs and estimated reading time. It understands Hindi full stops as well as English ones.", hi: "Word Counter शब्द, स्पेस सहित और बिना स्पेस के अक्षर, वाक्य, पैराग्राफ और पढ़ने का अनुमानित समय गिनता है। यह हिंदी के पूर्ण विराम को भी समझता है।" },
      tip: { en: "Reading time assumes about 200 words per minute.", hi: "पढ़ने का समय करीब 200 शब्द प्रति मिनट मानकर निकलता है।" },
      related: ["case-converter", "typing-helper", "meta-tags"] },
    { id: "case-converter", cat: "text", kind: "text", pop: 9, added: D,
      en: "Case Converter", hi: "केस बदलें", den: "UPPER, lower, Title case", dhi: "UPPER, lower, Title",
      about: { en: "Case Converter switches English text between UPPERCASE, lowercase, Title Case, Sentence case and toggle case. Undo brings back your previous text.", hi: "Case Converter अंग्रेज़ी टेक्स्ट को UPPERCASE, lowercase, Title Case, Sentence case और toggle case में बदलता है। Undo से पिछला टेक्स्ट वापस आ जाता है।" },
      tip: { en: "Pasted text in the wrong case? Sentence case fixes most of it.", hi: "गलत केस में टेक्स्ट पेस्ट हो गया? Sentence case ज़्यादातर ठीक कर देता है।" },
      related: ["word-counter", "typing-helper", "meta-tags"] },
    { id: "typing-helper", cat: "text", kind: "text", pop: 7, featured: 1, added: D,
      en: "Hindi Typing Helper", hi: "हिंदी टाइपिंग", den: "Type Hindi using English letters", dhi: "अंग्रेज़ी अक्षरों से हिंदी लिखें",
      about: { en: "Hindi Typing Helper converts Hinglish typed in English letters into Devanagari instantly. Write namaste dosto and get नमस्ते दोस्तो. It uses simple built-in rules, so it also works offline.", hi: "Hindi Typing Helper अंग्रेज़ी अक्षरों में लिखी हिंग्लिश को तुरंत देवनागरी में बदलता है। namaste dosto लिखें और नमस्ते दोस्तो पाएं। यह सरल बिल्ट-इन नियमों पर चलता है, इसलिए ऑफलाइन भी काम करता है।" },
      tip: { en: "Type long vowels yourself: kitaab for किताब, not kitab.", hi: "लंबी मात्रा खुद लिखें: किताब के लिए kitab नहीं, kitaab।" },
      related: ["word-counter", "case-converter"] },
    { id: "json-formatter", cat: "dev", kind: "text", pop: 10, added: D,
      en: "JSON Formatter", hi: "JSON फॉर्मेटर", den: "Format and validate JSON", dhi: "JSON सुधारें और जांचें",
      about: { en: "JSON Formatter validates JSON and beautifies it with clean indentation, or minifies it for compact storage. If the JSON is invalid you get the error message from the parser.", hi: "JSON Formatter JSON को जांचता है और साफ इंडेंटेशन के साथ सुंदर बनाता है, या छोटा करने के लिए minify करता है। JSON गलत हो तो पार्सर का एरर मैसेज दिखता है।" },
      tip: { en: "Your JSON is parsed in the browser and never sent anywhere.", hi: "आपका JSON ब्राउज़र में ही पार्स होता है, कहीं भेजा नहीं जाता।" },
      related: ["base64", "qr-code"] },
    { id: "base64", cat: "dev", kind: "text", pop: 12, added: D,
      en: "Base64 Tool", hi: "Base64 टूल", den: "Encode and decode", dhi: "एनकोड और डिकोड",
      about: { en: "Base64 Tool encodes text to Base64 and decodes it back. It handles Unicode correctly, so Hindi and emoji round-trip without damage.", hi: "Base64 Tool टेक्स्ट को Base64 में एनकोड और वापस डिकोड करता है। यह यूनिकोड सही संभालता है, इसलिए हिंदी और इमोजी बिना बिगड़े वापस आते हैं।" },
      tip: { en: "Base64 is an encoding, not encryption. Do not use it to hide secrets.", hi: "Base64 एक एनकोडिंग है, एन्क्रिप्शन नहीं। राज़ छिपाने के लिए इस्तेमाल न करें।" },
      related: ["json-formatter", "password"] },
    { id: "qr-code", cat: "dev", kind: "text", pop: 11, featured: 1, added: D,
      en: "QR Code Generator", hi: "QR कोड बनाएं", den: "Create QR for text or links", dhi: "लिंक या टेक्स्ट का QR",
      about: { en: "QR Code Generator creates a QR code for any link or text. Pick the size and error correction level, then download the PNG. Higher correction survives more damage but makes a denser code.", hi: "QR Code Generator किसी भी लिंक या टेक्स्ट का QR कोड बनाता है। साइज़ और एरर करेक्शन लेवल चुनें, फिर PNG डाउनलोड करें। ऊंचा करेक्शन ज़्यादा खराबी झेलता है पर कोड घना होता है।" },
      tip: { en: "Always scan the code with a phone camera before printing it.", hi: "प्रिंट करने से पहले कोड को फोन कैमरे से ज़रूर स्कैन करें।" },
      related: ["base64", "meta-tags", "password"] },
    { id: "emi", cat: "calc", kind: "calc", pop: 2, featured: 1, added: D,
      en: "EMI Calculator", hi: "EMI कैलकुलेटर", den: "Loan EMI with chart", dhi: "लोन EMI चार्ट के साथ",
      about: { en: "EMI Calculator finds your monthly loan instalment, total interest and total payment, with a chart of principal versus interest. Enter the amount, yearly interest rate and tenure in years or months.", hi: "EMI Calculator आपकी मासिक किस्त, कुल ब्याज और कुल भुगतान निकालता है, मूलधन बनाम ब्याज के चार्ट के साथ। राशि, सालाना ब्याज दर और अवधि साल या महीनों में डालें।" },
      tip: { en: "Banks may add processing fees, so real costs can be slightly higher.", hi: "बैंक प्रोसेसिंग फीस जोड़ सकते हैं, इसलिए असली खर्च थोड़ा ज़्यादा हो सकता है।" },
      related: ["gst", "percentage", "age"] },
    { id: "age", cat: "calc", kind: "calc", pop: 13, added: D,
      en: "Age Calculator", hi: "उम्र कैलकुलेटर", den: "Exact age in years, months, days", dhi: "सही उम्र निकालें",
      about: { en: "Age Calculator gives your exact age in years, months and days, plus total months, weeks and days lived, and how many days remain until your next birthday.", hi: "Age Calculator आपकी सही उम्र साल, महीने और दिनों में बताता है, साथ में कुल महीने, हफ्ते और दिन, और अगले जन्मदिन में बचे दिन।" },
      tip: { en: "Change the second date to find age on any day, such as a form's cut-off date.", hi: "फॉर्म की कट-ऑफ तारीख जैसी किसी भी दिन की उम्र जानने के लिए दूसरी तारीख बदलें।" },
      related: ["percentage", "emi", "gst"] },
    { id: "gst", cat: "calc", kind: "calc", pop: 14, added: D,
      en: "GST Calculator", hi: "GST कैलकुलेटर", den: "Add or remove GST", dhi: "GST जोड़ें या हटाएं",
      about: { en: "GST Calculator adds GST to a price or removes it from a GST-inclusive price, and shows the CGST and SGST halves. Quick buttons cover the 5, 12, 18 and 28 percent slabs.", hi: "GST Calculator कीमत में GST जोड़ता है या GST वाली कीमत से हटाता है, और CGST-SGST के दो हिस्से दिखाता है। 5, 12, 18 और 28 प्रतिशत स्लैब के लिए क्विक बटन हैं।" },
      tip: { en: "Check the current GST rate for your product before relying on a result.", hi: "नतीजे पर भरोसा करने से पहले अपने उत्पाद की मौजूदा GST दर जांच लें।" },
      related: ["percentage", "emi", "age"] },
    { id: "percentage", cat: "calc", kind: "calc", pop: 15, added: D,
      en: "Percentage Calculator", hi: "प्रतिशत कैलकुलेटर", den: "Quick percentage maths", dhi: "प्रतिशत निकालें",
      about: { en: "Percentage Calculator answers three common questions: what is X percent of Y, X is what percent of Y, and the percentage change from X to Y.", hi: "Percentage Calculator तीन आम सवाल हल करता है: Y का X प्रतिशत कितना, X, Y का कितने प्रतिशत है, और X से Y तक प्रतिशत बदलाव।" },
      tip: { en: "Useful for discounts, marks and price changes.", hi: "छूट, अंक और कीमत के बदलाव के लिए उपयोगी।" },
      related: ["gst", "emi", "age"] },
    { id: "meta-tags", cat: "seo", kind: "text", pop: 16, added: D,
      en: "Meta Tag Generator", hi: "मेटा टैग जनरेटर", den: "SEO tags for your page", dhi: "पेज के लिए SEO टैग",
      about: { en: "Meta Tag Generator builds the title, description, canonical, Open Graph and Twitter Card tags for a web page. Character counters show when a title or description is getting too long for search results.", hi: "Meta Tag Generator वेब पेज के लिए title, description, canonical, Open Graph और Twitter Card टैग बनाता है। कैरेक्टर काउंटर बताते हैं कि title या description सर्च रिज़ल्ट के लिए कब ज़्यादा लंबा हो रहा है।" },
      tip: { en: "Keep titles under about 60 characters and descriptions under about 160.", hi: "Title करीब 60 और description करीब 160 अक्षरों से कम रखें।" },
      related: ["word-counter", "qr-code", "password"] },
    { id: "password", cat: "seo", kind: "text", pop: 17, added: D,
      en: "Password Generator", hi: "पासवर्ड जनरेटर", den: "Strong random passwords", dhi: "मज़बूत पासवर्ड बनाएं",
      about: { en: "Password Generator creates random passwords with your browser's secure random number generator. Choose length and character types, and see an estimate of strength in bits. Nothing is stored or sent.", hi: "Password Generator ब्राउज़र के सुरक्षित रैंडम नंबर जनरेटर से रैंडम पासवर्ड बनाता है। लंबाई और अक्षर के प्रकार चुनें और मज़बूती का अनुमान बिट्स में देखें। कुछ भी सेव या भेजा नहीं जाता।" },
      tip: { en: "Use a different password for every important account and keep them in a password manager.", hi: "हर ज़रूरी अकाउंट के लिए अलग पासवर्ड रखें और उन्हें पासवर्ड मैनेजर में संभालें।" },
      related: ["base64", "qr-code", "meta-tags"] }
  ];

  var STATIC_PAGES = {
    "/": { title: "DTAhub – Your Everyday Digital Toolkit | Free Online Tools", desc: "DTAhub is your everyday digital toolkit: free PDF, image, text, developer tools and calculators that run privately in your browser. No sign-up." },
    "/blog/": { title: "Guides and How-tos", desc: "Simple step-by-step guides for PDF, image and everyday online tools from DTAhub." },
    "/settings.html": { title: "Settings", desc: "Choose language, theme and animations, and clear the favourites and data DTAhub keeps on your device." },
    "/contact.html": { title: "Contact, Feedback and Tool Requests", desc: "Send feedback, report a problem or request a new free tool for DTAhub." },
    "/privacy.html": { title: "Privacy Policy", desc: "How DTAhub handles your data: files are processed in your browser and are never uploaded." },
    "/terms.html": { title: "Terms of Use", desc: "Terms of use for DTAhub free online tools." }
  };


  var FAQ = [
    { q: { en: "Is DTAhub really free?", hi: "क्या DTAhub सच में मुफ्त है?" },
      a: { en: "Yes. Every tool is free to use, with no sign-up, no watermark and no hidden limits.", hi: "हां। हर टूल मुफ्त है, न साइन-अप, न वॉटरमार्क और न कोई छिपी सीमा।" } },
    { q: { en: "Are my files uploaded to a server?", hi: "क्या मेरी फाइलें किसी सर्वर पर अपलोड होती हैं?" },
      a: { en: "No. PDF, image, text and calculator tools run inside your own browser. Your files and text never leave your device.", hi: "नहीं। PDF, इमेज, टेक्स्ट और कैलकुलेटर टूल्स आपके अपने ब्राउज़र में चलते हैं। आपकी फाइलें और टेक्स्ट डिवाइस से बाहर नहीं जाते।" } },
    { q: { en: "Do I need to create an account?", hi: "क्या मुझे अकाउंट बनाना पड़ेगा?" },
      a: { en: "No. Your theme, language, favourites and recently used tools are saved only on your own device.", hi: "नहीं। आपका थीम, भाषा, पसंदीदा और हाल में इस्तेमाल किए टूल्स सिर्फ आपके अपने डिवाइस पर सेव रहते हैं।" } },
    { q: { en: "Can I use DTAhub offline or install it as an app?", hi: "क्या मैं DTAhub ऑफलाइन चला सकता हूं या ऐप की तरह इंस्टॉल कर सकता हूं?" },
      a: { en: "Yes. Open the site once, then use Install app from the menu (or your browser's Add to Home screen). Pages you have opened keep working without internet.", hi: "हां। साइट एक बार खोलें, फिर मेनू में Install app (या ब्राउज़र का Add to Home screen) चुनें। जो पेज आप खोल चुके हैं वे बिना इंटरनेट भी चलते हैं।" } },
    { q: { en: "Will my resume be readable by hiring software?", hi: "क्या मेरा रिज़्यूमे हायरिंग सॉफ्टवेयर पढ़ पाएगा?" },
      a: { en: "Yes. The PDF from the Resume Maker keeps real text instead of a picture, so applicant tracking systems can read it. Classic and Minimal are the safest templates.", hi: "हां। Resume Maker की PDF में तस्वीर की जगह असली टेक्स्ट रहता है, इसलिए रिक्रूटमेंट सिस्टम उसे पढ़ सकते हैं। Classic और Minimal सबसे सुरक्षित टेम्पलेट हैं।" } },
    { q: { en: "How can I request a new tool?", hi: "नया टूल कैसे मांगूं?" },
      a: { en: "Use the Contact page and choose Tool request. We read every suggestion.", hi: "Contact पेज पर जाकर Tool request चुनें। हम हर सुझाव पढ़ते हैं।" } }
  ];
  var CARD_ESC = function (s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };

  var api = { FAQ: FAQ, esc: CARD_ESC, SITE: SITE, ICONS: ICONS, CATS: CATS, TOOLS: TOOLS, KINDS: KINDS, STATIC_PAGES: STATIC_PAGES };
  api.icon = function (key, size) {
    return '<svg class="ic" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[key] || "") + "</svg>";
  };
  api.tool = function (id) { for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === id) return TOOLS[i]; };
  api.cat = function (id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; };
  api.toolUrl = function (t) { return "/tools/" + t.id + ".html"; };
  api.catUrl = function (c) { return "/category/" + c.id + "/"; };

  api.cardHTML = function (t, isNew) {
    var c = api.cat(t.cat), e = CARD_ESC;
    var q = (t.en + " " + t.hi + " " + t.den + " " + t.dhi + " " + t.id + " " + c.en).toLowerCase();
    return '<article class="card reveal" style="--h:' + (c.hue || 45) + '" data-id="' + t.id + '" data-cat="' + t.cat + '" data-q="' + e(q) + '">' +
      '<div class="card-top"><span class="ico">' + api.icon(t.id, 22) + '</span><h3><a class="stretch" href="' + api.toolUrl(t) + '"><span data-en="' + e(t.en) + '" data-hi="' + e(t.hi) + '">' + e(t.en) + "</span></a></h3></div>" +
      '<p data-en="' + e(t.den) + '" data-hi="' + e(t.dhi) + '">' + e(t.den) + "</p>" +
      '<div class="meta"><span class="tag" data-en="' + e(c.short.en) + '" data-hi="' + e(c.short.hi) + '">' + e(c.short.en) + "</span>" +
      '<span class="tag free" data-en="Free" data-hi="मुफ्त">Free</span>' + (isNew ? '<span class="tag" data-en="New" data-hi="नया">New</span>' : "") +
      '<span class="card-open"><span data-en="Open" data-hi="खोलें">Open</span>' + api.icon("arrow", 16) + "</span></div>" +
      '<button class="fav" type="button" aria-pressed="false" data-fav="' + t.id + '" aria-label="Favourite">' + api.icon("star", 18) + "</button></article>";
  };
  api.catCardHTML = function (c) {
    var n = TOOLS.filter(function (t) { return t.cat === c.id; }).length, e = CARD_ESC;
    return '<a class="ccard reveal" style="--h:' + (c.hue || 45) + '" href="' + api.catUrl(c) + '"><span class="ico">' + api.icon(c.icon, 22) + '</span><span><b data-en="' + e(c.en) + '" data-hi="' + e(c.hi) + '">' + e(c.en) + '</b><small data-en="' + e(c.den) + '" data-hi="' + e(c.dhi) + '">' + e(c.den) + " </small><small> · " + n + "</small></span></a>";
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.DTA = api; root.CATS = CATS; root.TOOLS = TOOLS; }
})(typeof window !== "undefined" ? window : globalThis);

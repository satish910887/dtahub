/* DTAhub Resume Maker. Everything runs in the browser; data is kept in localStorage on this device only. */
(function () {
  "use strict";
  var D = window.DTA, KEY = "dta_resume_v1", PAGE_H = 1123;
  var SECS = ["summary", "experience", "education", "projects", "skills", "certs", "languages"];
  var SIDE = ["skills", "certs", "languages"];
  var HL = {
    en: { summary: "Summary", experience: "Experience", education: "Education", projects: "Projects", skills: "Skills", certs: "Certificates", languages: "Languages", contact: "Contact", present: "Present" },
    hi: { summary: "सारांश", experience: "अनुभव", education: "शिक्षा", projects: "प्रोजेक्ट्स", skills: "कौशल", certs: "प्रमाणपत्र", languages: "भाषाएं", contact: "संपर्क", present: "वर्तमान" }
  };
  var FONTS = { sans: '"Segoe UI","Noto Sans","Noto Sans Devanagari",Roboto,Arial,sans-serif', serif: 'Georgia,"Noto Serif","Noto Serif Devanagari","Times New Roman",serif' };
  var SIZES = { s: "12px", m: "13px", l: "14px" };
  var SWATCHES = ["#8b6cf6", "#2563eb", "#0f766e", "#16a34a", "#dc2626", "#ea580c", "#be185d", "#111827"];
  var TPLS = ["modern", "classic", "minimal", "bold"];
  var TPL_NAME = { modern: ["Modern", "मॉडर्न"], classic: ["Classic", "क्लासिक"], minimal: ["Minimal", "मिनिमल"], bold: ["Bold", "बोल्ड"] };
  var T = function (en, hi) { return L(en, hi); };

  function $$(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function str(v, max) { return typeof v === "string" ? v.slice(0, max || 400) : ""; }

  /* ---------- data model ---------- */
  var ex = function () { return { role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }; };
  var ed = function () { return { degree: "", school: "", location: "", start: "", end: "", grade: "" }; };
  var sk = function () { return { group: "", items: "" }; };
  var pr = function () { return { name: "", link: "", desc: "" }; };
  var ce = function () { return { name: "", issuer: "", year: "" }; };
  var FACT = { experience: ex, education: ed, skills: sk, projects: pr, certs: ce };

  function blank() {
    return { v: 1, tpl: "modern", ac: "#8b6cf6", font: "sans", size: "m", hl: "en", order: SECS.slice(), hide: {}, photo: "", sample: false,
      basics: { name: "", title: "", email: "", phone: "", location: "", website: "", link: "" }, summary: "",
      experience: [ex()], education: [ed()], skills: [sk()], projects: [], certs: [], languages: "" };
  }
  function sample() {
    var d = blank(); d.sample = true;
    d.basics = { name: "Riya Verma", title: "Frontend Developer", email: "riya.verma@example.com", phone: "+91 98765 43210", location: "Pune, India", website: "riyaverma.example.com", link: "linkedin.com/in/riya-verma-example" };
    d.summary = "Frontend developer with 2 years of experience building fast, accessible web apps in React. I enjoy turning designs into clean interfaces and improving performance for users on slow networks.";
    d.experience = [
      { role: "Frontend Developer", company: "BrightLeaf Labs", location: "Pune", start: "Jun 2023", end: "", current: true, bullets: "Built a reusable component library used by 6 product teams\nCut page load time by 38% by splitting code and lazy-loading images\nMentored 3 interns and reviewed 150+ pull requests" },
      { role: "Web Developer Intern", company: "Nimbus Soft", location: "Remote", start: "Jan 2023", end: "May 2023", current: false, bullets: "Created 12 responsive pages from Figma designs\nFixed 40+ UI bugs and raised the Lighthouse score from 62 to 91" }
    ];
    d.education = [{ degree: "B.Tech, Computer Science", school: "Savitribai Phule Pune University", location: "Pune", start: "2019", end: "2023", grade: "CGPA 8.4" }];
    d.skills = [{ group: "Languages", items: "JavaScript, TypeScript, HTML, CSS, Python" }, { group: "Tools", items: "React, Git, Figma, Jest, Webpack" }];
    d.projects = [{ name: "ExpenseLens", link: "github.com/example/expenselens", desc: "Offline-first expense tracker used by 1,200 people\nBuilt with React and IndexedDB" }];
    d.certs = [{ name: "Responsive Web Design", issuer: "freeCodeCamp", year: "2022" }];
    d.languages = "English, Hindi, Marathi";
    return d;
  }
  function normalize(raw) {
    var b = blank(); if (!raw || typeof raw !== "object") return b;
    b.sample = !!raw.sample;
    b.tpl = TPLS.indexOf(raw.tpl) > -1 ? raw.tpl : b.tpl;
    b.ac = /^#[0-9a-f]{6}$/i.test(raw.ac || "") ? raw.ac : b.ac;
    b.font = FONTS[raw.font] ? raw.font : "sans"; b.size = SIZES[raw.size] ? raw.size : "m"; b.hl = raw.hl === "hi" ? "hi" : "en";
    var o = Array.isArray(raw.order) ? raw.order.filter(function (x, i, a) { return SECS.indexOf(x) > -1 && a.indexOf(x) === i; }) : [];
    SECS.forEach(function (s) { if (o.indexOf(s) < 0) o.push(s); }); b.order = o;
    if (raw.hide && typeof raw.hide === "object") SECS.forEach(function (s) { if (raw.hide[s]) b.hide[s] = true; });
    if (typeof raw.photo === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(raw.photo) && raw.photo.length < 400000) b.photo = raw.photo;
    if (raw.basics) Object.keys(b.basics).forEach(function (k) { b.basics[k] = str(raw.basics[k], 160); });
    b.summary = str(raw.summary, 1500); b.languages = str(raw.languages, 300);
    Object.keys(FACT).forEach(function (k) {
      if (!Array.isArray(raw[k])) return;
      b[k] = raw[k].slice(0, 25).map(function (it) {
        var e = FACT[k](); if (!it || typeof it !== "object") return e;
        Object.keys(e).forEach(function (f) { e[f] = f === "current" ? !!it[f] : str(it[f], f === "bullets" || f === "desc" ? 2500 : 160); });
        return e;
      });
    });
    return b;
  }

  /* ---------- persistence ---------- */
  var d, saveTimer, warned = false;
  function load() { try { var r = localStorage.getItem(KEY); if (r) return normalize(JSON.parse(r)); } catch (e) {} return sample(); }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(d)); var t = new Date(); $$("rbSaved").textContent = T("Saved on this device at ", "इस डिवाइस पर सेव हुआ: ") + ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2); }
      catch (e) { if (!warned) { warned = true; toast(T("Could not save on this device (storage full or blocked). Use Export backup.", "इस डिवाइस पर सेव नहीं हो सका (स्टोरेज भरा या बंद)। Export backup इस्तेमाल करें।"), "err"); } }
    }, 350);
  }
  function path(p, v) {
    var k = p.split("."), o = d, i;
    for (i = 0; i < k.length - 1; i++) o = o[k[i]];
    if (arguments.length > 1) o[k[i]] = v; return o[k[i]];
  }

  /* ---------- preview ---------- */
  function lines(s) { return String(s || "").split(/\n/).map(function (x) { return x.replace(/^\s*[-•*·]\s*/, "").trim(); }).filter(Boolean); }
  function has(o) { return Object.keys(o).some(function (k) { return typeof o[k] === "string" && o[k].trim(); }); }
  function safeUrl(u) { u = (u || "").trim(); if (/^https?:\/\//i.test(u)) return u; if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return "https://" + u; return ""; }
  function link(text) { var h = safeUrl(text); return h ? '<a href="' + esc(h) + '">' + esc(text) + "</a>" : esc(text); }
  function ul(s) { var l = lines(s); return l.length ? '<ul class="rt-ul">' + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""; }
  function range(a, b, cur) { a = (a || "").trim(); b = cur ? HL[d.hl].present : (b || "").trim(); return a && b ? a + " – " + b : a || b; }
  function split(s) { return String(s || "").split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function sec(id, inner, tpl) { return inner ? '<div class="rt-sec"><div class="rt-sec-h">' + esc(HL[d.hl][id]) + "</div>" + inner + "</div>" : ""; }

  function section(id, tpl) {
    var h = "", asTags = tpl === "modern" || tpl === "minimal";
    if (id === "summary") { if (d.summary.trim()) h = '<p class="rt-p">' + esc(d.summary).replace(/\n/g, "<br>") + "</p>"; }
    else if (id === "experience") h = d.experience.filter(has).map(function (x) { return '<div class="rt-item"><div class="rt-row"><b>' + esc(x.role) + '</b><span class="rt-d">' + esc(range(x.start, x.end, x.current)) + '</span></div><div class="rt-sub">' + esc([x.company, x.location].filter(Boolean).join(" · ")) + "</div>" + ul(x.bullets) + "</div>"; }).join("");
    else if (id === "education") h = d.education.filter(has).map(function (x) { return '<div class="rt-item"><div class="rt-row"><b>' + esc(x.degree) + '</b><span class="rt-d">' + esc(range(x.start, x.end)) + '</span></div><div class="rt-sub">' + esc([x.school, x.location, x.grade].filter(Boolean).join(" · ")) + "</div></div>"; }).join("");
    else if (id === "projects") h = d.projects.filter(has).map(function (x) { return '<div class="rt-item"><div class="rt-row"><b>' + esc(x.name) + '</b><span class="rt-d">' + (x.link ? link(x.link) : "") + "</span></div>" + ul(x.desc) + "</div>"; }).join("");
    else if (id === "skills") h = d.skills.filter(has).map(function (x) {
      var it = split(x.items), g = x.group.trim();
      return '<div class="rt-sk">' + (g ? "<b>" + esc(g) + (asTags ? "" : ":") + "</b> " : "") + (asTags ? '<div class="rt-tags">' + it.map(function (t) { return '<span class="rt-tag">' + esc(t) + "</span>"; }).join("") + "</div>" : esc(it.join(", "))) + "</div>"; }).join("");
    else if (id === "certs") h = d.certs.filter(has).map(function (x) { return '<div class="rt-item"><div class="rt-row"><b>' + esc(x.name) + '</b><span class="rt-d">' + esc(x.year) + '</span></div><div class="rt-sub">' + esc(x.issuer) + "</div></div>"; }).join("");
    else if (id === "languages") { var l = split(d.languages); if (l.length) h = asTags ? '<div class="rt-tags">' + l.map(function (t) { return '<span class="rt-tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "<div>" + esc(l.join(", ")) + "</div>"; }
    return sec(id, h, tpl);
  }

  function contactItems() {
    var b = d.basics, a = [];
    if (b.email) a.push('<a href="mailto:' + esc(b.email) + '">' + esc(b.email) + "</a>");
    if (b.phone) a.push("<span>" + esc(b.phone) + "</span>");
    if (b.location) a.push("<span>" + esc(b.location) + "</span>");
    if (b.website) a.push(link(b.website));
    if (b.link) a.push(link(b.link));
    return a;
  }

  function buildPaper() {
    var tpl = d.tpl, b = d.basics, ci = contactItems();
    var photo = d.photo ? '<img class="rt-photo" src="' + d.photo + '" alt="">' : "";
    var head = '<div class="rt-name">' + esc(b.name || T("Your Name", "आपका नाम")) + "</div>" + (b.title ? '<div class="rt-title">' + esc(b.title) + "</div>" : "");
    var order = d.order.filter(function (id) { return !d.hide[id]; });
    var inner;
    if (tpl === "modern") {
      var main = order.filter(function (id) { return SIDE.indexOf(id) < 0; }).map(function (id) { return section(id, tpl); }).join("");
      var side = order.filter(function (id) { return SIDE.indexOf(id) > -1; });
      var sideHtml = photo + (ci.length ? '<div class="rt-sec"><div class="rt-sec-h">' + esc(HL[d.hl].contact) + '</div><div class="rt-cl">' + ci.map(function (x) { return "<div>" + x + "</div>"; }).join("") + "</div></div>" : "") + side.map(function (id) { return section(id, tpl); }).join("");
      inner = '<div class="rt-wrap"><div class="rt-side">' + sideHtml + '</div><div class="rt-main">' + head + main + "</div></div>";
    } else if (tpl === "bold") {
      inner = '<div class="rt-head"><div>' + head + '<div class="rt-contact">' + ci.join("") + "</div></div>" + photo + '</div><div class="rt-wrap">' + order.map(function (id) { return section(id, tpl); }).join("") + "</div>";
    } else {
      inner = '<div class="rt-wrap"><div class="rt-head">' + head + '<div class="rt-contact">' + ci.join("") + "</div></div>" + order.map(function (id) { return section(id, tpl); }).join("") + "</div>";
    }
    return inner;
  }

  var pages = 1;
  function renderPreview() {
    var p = $$("paper");
    p.className = "paper rt-" + d.tpl; p.style.setProperty("--ac", d.ac); p.style.setProperty("--fs", SIZES[d.size]); p.style.setProperty("--rf", FONTS[d.font]);
    p.style.setProperty("--tint", "color-mix(in srgb," + d.ac + " 11%,#fff)");
    p.innerHTML = buildPaper();
    p.lang = d.hl === "hi" ? "hi" : "en";
    fit(); renderCheck();
  }
  function fit() {
    var st = $$("rbStage"), w = st.clientWidth; if (w < 60) return;
    var sc = Math.min(1, w / 794), h = $$("paper").offsetHeight;
    $$("rbScale").style.transform = "scale(" + sc + ")";
    $$("rbFit").style.width = 794 * sc + "px"; $$("rbFit").style.height = h * sc + "px";
    pages = Math.max(1, Math.ceil((h - 2) / PAGE_H));
    var g = ""; for (var i = 1; i < pages; i++) g += '<div style="top:' + i * PAGE_H + 'px"><span>' + T("Page " + (i + 1) + " starts", "पेज " + (i + 1) + " यहां से") + "</span></div>";
    $$("rbGuides").innerHTML = g;
    var el = $$("rbPages"); el.textContent = pages + T(pages === 1 ? " page" : " pages", " पेज"); el.classList.toggle("warn", pages > 2);
  }

  /* ---------- checklist (plain rules, not an AI score) ---------- */
  function renderCheck() {
    var b = d.basics, exps = d.experience.filter(has), bullets = [];
    exps.forEach(function (e) { bullets = bullets.concat(lines(e.bullets)); });
    d.projects.filter(has).forEach(function (p) { bullets = bullets.concat(lines(p.desc)); });
    var words = d.summary.trim() ? d.summary.trim().split(/\s+/).length : 0;
    var skillsN = d.skills.reduce(function (n, s) { return n + split(s.items).length; }, 0);
    var withNum = bullets.filter(function (x) { return /\d/.test(x); }).length;
    var C = [
      [b.name.trim() && b.title.trim(), T("Name and job title added", "नाम और जॉब टाइटल जोड़े")],
      [b.email.trim() && b.phone.trim(), T("Email and phone added", "ईमेल और फोन जोड़े")],
      [words >= 25 && words <= 80, T("Summary of 25 to 80 words (now " + words + ")", "25 से 80 शब्दों की समरी (अभी " + words + ")")],
      [exps.length + d.projects.filter(has).length > 0, T("At least one job or project added", "कम से कम एक जॉब या प्रोजेक्ट जोड़ा")],
      [exps.length === 0 || exps.every(function (e) { return lines(e.bullets).length >= 2; }), T("Each job has 2 or more points", "हर जॉब में 2 या ज़्यादा पॉइंट")],
      [bullets.length > 0 && withNum / bullets.length >= 0.4, T("Add numbers (%, ₹, counts) to show impact", "असर दिखाने के लिए अंक (%, ₹, गिनती) जोड़ें")],
      [skillsN >= 6, T("6 or more skills listed (now " + skillsN + ")", "6 या ज़्यादा स्किल (अभी " + skillsN + ")")],
      [d.education.filter(has).length > 0, T("Education added", "शिक्षा जोड़ी")],
      [pages <= 2, T("Fits in 2 pages or fewer", "2 पेज या उससे कम")],
      [bullets.every(function (x) { return x.length <= 220; }), T("No point is too long (under 220 characters)", "कोई पॉइंट बहुत लंबा नहीं (220 अक्षर से कम)")]
    ];
    var ok = C.filter(function (c) { return c[0]; }).length;
    $$("rbCheckH").textContent = T("Resume checklist: ", "रिज़्यूमे चेकलिस्ट: ") + ok + " / " + C.length;
    $$("rbCheck").innerHTML = C.map(function (c) { return '<li class="' + (c[0] ? "ok" : "no") + '">' + D.icon(c[0] ? "check" : "plus", 16) + "<span>" + esc(c[1]) + "</span></li>"; }).join("");
  }

  /* ---------- form ---------- */
  var openSet = { basics: true };
  function F(label, p, opt) {
    opt = opt || {}; var v = path(p), ph = opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : "";
    var cls = "rb-f" + (opt.full ? " full" : "");
    if (opt.rows) return '<label class="' + cls + '"><span>' + esc(label) + '</span><textarea data-p="' + p + '" rows="' + opt.rows + '" maxlength="' + (opt.max || 2500) + '"' + ph + ">" + esc(v) + "</textarea>" + (opt.hint ? '<small class="hint" id="' + opt.hint + '"></small>' : "") + "</label>";
    return '<label class="' + cls + '"><span>' + esc(label) + '</span><input data-p="' + p + '" type="' + (opt.type || "text") + '" value="' + esc(v) + '" maxlength="160"' + ph + (opt.im ? ' inputmode="' + opt.im + '"' : "") + (opt.ac ? ' autocomplete="' + opt.ac + '"' : "") + "></label>";
  }
  function entry(kind, i, title, body) {
    var n = d[kind].length, bt = function (a, ic, lab, dis) { return '<button type="button" class="mini" data-act="' + a + ":" + kind + ":" + i + '" aria-label="' + lab + '"' + (dis ? " disabled" : "") + ">" + D.icon(ic, 16) + "</button>"; };
    return '<div class="rb-entry"><div class="rb-entry-h"><b>' + esc(title || T("New entry", "नई एंट्री")) + '</b><span class="rb-acts">' + bt("up", "up", "Move up", i === 0) + bt("down", "down", "Move down", i === n - 1) + bt("del", "close", "Delete", false) + '</span></div><div class="rb-grid">' + body + "</div></div>";
  }
  function addBtn(kind, label) { return '<button type="button" class="btn rb-add" data-act="add:' + kind + ':0">' + D.icon("plus", 16) + esc(label) + "</button>"; }
  function acc(id, title, count, body) { return '<details class="rb-sec" data-id="' + id + '"' + (openSet[id] ? " open" : "") + "><summary>" + esc(title) + (count != null ? "<small>" + count + "</small>" : "") + '</summary><div class="rb-body">' + body + "</div></details>"; }

  function renderForm() {
    var h = "";
    h += acc("basics", T("Personal details", "व्यक्तिगत जानकारी"), null, '<div class="rb-grid">' +
      F(T("Full name", "पूरा नाम"), "basics.name", { ac: "name" }) + F(T("Job title", "जॉब टाइटल"), "basics.title", { ph: T("e.g. Accountant", "जैसे: अकाउंटेंट") }) +
      F("Email", "basics.email", { type: "email", ac: "email" }) + F(T("Phone", "फोन"), "basics.phone", { type: "tel", im: "tel", ac: "tel" }) +
      F(T("City, Country", "शहर, देश"), "basics.location") + F(T("Website", "वेबसाइट"), "basics.website", { ph: "example.com" }) +
      F(T("LinkedIn or other link", "LinkedIn या दूसरा लिंक"), "basics.link", { full: true, ph: "linkedin.com/in/yourname" }) + "</div>");
    h += acc("summary", T("Summary", "सारांश"), null, F(T("2 to 3 lines about you", "आपके बारे में 2-3 लाइन"), "summary", { rows: 4, max: 1500, full: true, hint: "sumHint" }));
    h += acc("experience", T("Experience", "अनुभव"), d.experience.filter(has).length,
      d.experience.map(function (x, i) { return entry("experience", i, x.role || x.company, F(T("Job title", "पद"), "experience." + i + ".role") + F(T("Company", "कंपनी"), "experience." + i + ".company") + F(T("Location", "जगह"), "experience." + i + ".location") + F(T("Start (e.g. Jun 2023)", "शुरू (जैसे Jun 2023)"), "experience." + i + ".start") + F(T("End", "खत्म"), "experience." + i + ".end", { ph: x.current ? HL[d.hl].present : "" }) +
        '<label class="rb-f rb-chk full"><input type="checkbox" data-c="experience.' + i + '.current"' + (x.current ? " checked" : "") + "><span>" + esc(T("I currently work here", "मैं अभी यहीं काम करता/करती हूं")) + "</span></label>" +
        F(T("Key points (one per line)", "मुख्य पॉइंट (हर लाइन में एक)"), "experience." + i + ".bullets", { rows: 5, full: true, ph: T("Started with a verb and add numbers", "क्रिया से शुरू करें, अंक जोड़ें") })); }).join("") + addBtn("experience", T("Add experience", "अनुभव जोड़ें")));
    h += acc("education", T("Education", "शिक्षा"), d.education.filter(has).length,
      d.education.map(function (x, i) { return entry("education", i, x.degree || x.school, F(T("Degree / course", "डिग्री / कोर्स"), "education." + i + ".degree", { full: true }) + F(T("School / college", "स्कूल / कॉलेज"), "education." + i + ".school", { full: true }) + F(T("Location", "जगह"), "education." + i + ".location") + F(T("Grade / marks", "ग्रेड / अंक"), "education." + i + ".grade") + F(T("Start", "शुरू"), "education." + i + ".start") + F(T("End", "खत्म"), "education." + i + ".end")); }).join("") + addBtn("education", T("Add education", "शिक्षा जोड़ें")));
    h += acc("projects", T("Projects", "प्रोजेक्ट्स"), d.projects.filter(has).length,
      d.projects.map(function (x, i) { return entry("projects", i, x.name, F(T("Project name", "प्रोजेक्ट का नाम"), "projects." + i + ".name") + F(T("Link", "लिंक"), "projects." + i + ".link") + F(T("Points (one per line)", "पॉइंट (हर लाइन में एक)"), "projects." + i + ".desc", { rows: 4, full: true })); }).join("") + addBtn("projects", T("Add project", "प्रोजेक्ट जोड़ें")));
    h += acc("skills", T("Skills", "कौशल"), d.skills.filter(has).length,
      d.skills.map(function (x, i) { return entry("skills", i, x.group, F(T("Group (optional)", "ग्रुप (वैकल्पिक)"), "skills." + i + ".group", { full: true, ph: T("e.g. Tools", "जैसे: टूल्स") }) + F(T("Skills (separated by commas)", "स्किल (कॉमा से अलग)"), "skills." + i + ".items", { rows: 2, full: true })); }).join("") + addBtn("skills", T("Add skill group", "स्किल ग्रुप जोड़ें")));
    h += acc("certs", T("Certificates and awards", "प्रमाणपत्र और पुरस्कार"), d.certs.filter(has).length,
      d.certs.map(function (x, i) { return entry("certs", i, x.name, F(T("Name", "नाम"), "certs." + i + ".name", { full: true }) + F(T("Issued by", "किसने दिया"), "certs." + i + ".issuer") + F(T("Year", "साल"), "certs." + i + ".year")); }).join("") + addBtn("certs", T("Add certificate", "प्रमाणपत्र जोड़ें")));
    h += acc("languages", T("Languages", "भाषाएं"), null, F(T("Languages you know (separated by commas)", "आप कौन सी भाषाएं जानते हैं (कॉमा से अलग)"), "languages", { rows: 2, full: true, max: 300 }));
    h += acc("layout", T("Sections: order and visibility", "सेक्शन: क्रम और दिखना"), null, '<ul class="rb-ord">' + d.order.map(function (id, i) {
      return "<li><span>" + esc(HL[L("en", "hi") === "hi" ? "hi" : "en"][id]) + "</span>" +
        '<label><input type="checkbox" data-hide="' + id + '"' + (d.hide[id] ? "" : " checked") + "> " + esc(T("Show", "दिखाएं")) + "</label>" +
        '<button type="button" class="mini" data-act="ordup:' + id + ':0"' + (i === 0 ? " disabled" : "") + ' aria-label="Up">' + D.icon("up", 16) + "</button>" +
        '<button type="button" class="mini" data-act="orddown:' + id + ':0"' + (i === d.order.length - 1 ? " disabled" : "") + ' aria-label="Down">' + D.icon("down", 16) + "</button></li>";
    }).join("") + '</ul><p class="hint">' + esc(T("In the Modern template, Skills, Certificates and Languages sit in the sidebar.", "Modern टेम्पलेट में Skills, Certificates और Languages साइडबार में रहते हैं।")) + "</p>");
    $$("rbForm").innerHTML = h; sumHint();
  }
  function sumHint() { var el = $$("sumHint"); if (!el) return; var n = d.summary.trim() ? d.summary.trim().split(/\s+/).length : 0; el.textContent = n + T(" words (aim for 25 to 80)", " शब्द (25 से 80 रखें)"); }

  function renderStatic() {
    $$("rbTpls").innerHTML = TPLS.map(function (t) {
      var svg = { modern: '<rect x="0" y="0" width="22" height="80" fill="currentColor" opacity=".25"/><rect x="28" y="8" width="26" height="5" fill="currentColor"/><rect x="28" y="20" width="26" height="3" opacity=".5" fill="currentColor"/><rect x="28" y="28" width="26" height="3" opacity=".5" fill="currentColor"/><rect x="5" y="14" width="12" height="3" fill="currentColor" opacity=".6"/>',
        classic: '<rect x="14" y="8" width="32" height="5" fill="currentColor"/><rect x="6" y="18" width="48" height="1.5" fill="currentColor"/><rect x="6" y="26" width="48" height="3" opacity=".5" fill="currentColor"/><rect x="6" y="34" width="48" height="3" opacity=".5" fill="currentColor"/>',
        minimal: '<rect x="6" y="8" width="28" height="5" fill="currentColor"/><rect x="6" y="22" width="14" height="2" fill="currentColor" opacity=".7"/><rect x="6" y="28" width="48" height="3" opacity=".4" fill="currentColor"/><rect x="6" y="40" width="14" height="2" fill="currentColor" opacity=".7"/><rect x="6" y="46" width="48" height="3" opacity=".4" fill="currentColor"/>',
        bold: '<rect x="0" y="0" width="60" height="22" fill="currentColor" opacity=".7"/><rect x="6" y="8" width="26" height="5" fill="#fff"/><rect x="6" y="30" width="48" height="3" opacity=".5" fill="currentColor"/><rect x="6" y="38" width="48" height="3" opacity=".5" fill="currentColor"/>' }[t];
      return '<button type="button" class="rb-tpl" data-tpl="' + t + '" aria-pressed="' + (d.tpl === t) + '"><svg viewBox="0 0 60 80" aria-hidden="true"><rect x=".5" y=".5" width="59" height="79" rx="3" fill="#fff" fill-opacity=".08" stroke="currentColor" stroke-opacity=".3"/>' + svg + "</svg>" + esc(TPL_NAME[t][L("en", "hi") === "hi" ? 1 : 0]) + "</button>";
    }).join("");
    $$("rbSw").innerHTML = SWATCHES.map(function (c) { return '<button type="button" class="sw" data-ac="' + c + '" style="background:' + c + '" aria-pressed="' + (d.ac.toLowerCase() === c) + '" aria-label="' + c + '"></button>'; }).join("") + '<input type="color" id="rbColor" value="' + d.ac + '" aria-label="Custom colour">';
    $$("rbFont").value = d.font; $$("rbSize").value = d.size; $$("rbHl").value = d.hl;
    $$("rbFont").options[0].text = T("Sans-serif (clean)", "सैन्स-सेरिफ़ (साफ)"); $$("rbFont").options[1].text = T("Serif (classic)", "सेरिफ़ (क्लासिक)");
    $$("rbSize").options[0].text = T("Small", "छोटा"); $$("rbSize").options[1].text = T("Medium", "मध्यम"); $$("rbSize").options[2].text = T("Large", "बड़ा");
    $$("rbPhotoImg").hidden = !d.photo; $$("rbPhotoRm").hidden = !d.photo; if (d.photo) $$("rbPhotoImg").src = d.photo;
    var sm = $$("rbSample"); sm.hidden = !d.sample;
    if (d.sample) { sm.innerHTML = esc(T("This is an example resume. Replace it with your own details, or ", "यह एक उदाहरण रिज़्यूमे है। इसे अपनी जानकारी से बदलें, या ")) + '<button type="button" class="btn" id="rbSampleClear">' + esc(T("start with an empty resume", "खाली रिज़्यूमे से शुरू करें")) + "</button>"; }
  }
  function renderAll() { renderStatic(); renderForm(); renderPreview(); }

  /* ---------- events ---------- */
  var form = $$("rbForm");
  form.addEventListener("input", function (e) {
    var t = e.target, p = t.getAttribute("data-p"); if (!p) return;
    path(p, t.value); d.sample = false; $$("rbSample").hidden = true;
    if (p === "summary") sumHint();
    renderPreview(); save();
  });
  form.addEventListener("change", function (e) {
    var t = e.target, c = t.getAttribute("data-c"), hd = t.getAttribute("data-hide");
    if (c) { path(c, t.checked); d.sample = false; renderForm(); renderPreview(); save(); }
    else if (hd) { if (t.checked) delete d.hide[hd]; else d.hide[hd] = true; renderPreview(); save(); }
  });
  form.addEventListener("toggle", function (e) { var s = e.target; if (s.classList && s.classList.contains("rb-sec")) { var id = s.getAttribute("data-id"); if (s.open) openSet[id] = true; else delete openSet[id]; } }, true);
  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    var a = b.getAttribute("data-act").split(":"), act = a[0], kind = a[1], i = +a[2], arr = d[kind];
    if (act === "add") { if (arr.length >= 25) { toast(T("Limit reached", "सीमा पूरी हो गई"), "err"); return; } arr.push(FACT[kind]()); openSet[kind] = true; }
    else if (act === "del") arr.splice(i, 1);
    else if (act === "up" && i > 0) { var t = arr[i]; arr[i] = arr[i - 1]; arr[i - 1] = t; }
    else if (act === "down" && i < arr.length - 1) { var u = arr[i]; arr[i] = arr[i + 1]; arr[i + 1] = u; }
    else if (act === "ordup" || act === "orddown") { var o = d.order, k = o.indexOf(kind), j = act === "ordup" ? k - 1 : k + 1; if (j >= 0 && j < o.length) { var x = o[k]; o[k] = o[j]; o[j] = x; } openSet.layout = true; }
    d.sample = false; renderForm(); renderPreview(); save();
    if (act === "add") { var es = form.querySelectorAll('.rb-sec[data-id="' + kind + '"] .rb-entry'); var last = es[es.length - 1]; if (last) { var f = last.querySelector("input,textarea"); if (f) f.focus({ preventScroll: false }); } }
  });

  $$("rbTpls").addEventListener("click", function (e) { var b = e.target.closest("[data-tpl]"); if (!b) return; d.tpl = b.getAttribute("data-tpl"); renderStatic(); renderPreview(); save(); });
  $$("rbSw").addEventListener("click", function (e) { var b = e.target.closest("[data-ac]"); if (!b) return; d.ac = b.getAttribute("data-ac"); renderStatic(); renderPreview(); save(); });
  $$("rbSw").addEventListener("input", function (e) { if (e.target.id === "rbColor") { d.ac = e.target.value; $$("rbSw").querySelectorAll(".sw").forEach(function (s) { s.setAttribute("aria-pressed", "false"); }); renderPreview(); save(); } });
  [["rbFont", "font"], ["rbSize", "size"], ["rbHl", "hl"]].forEach(function (m) { $$(m[0]).addEventListener("change", function () { d[m[1]] = this.value; renderPreview(); save(); }); });

  pickImage($$("rbPhoto"), function (im) {
    if (!im) { toast(T("Could not open this image.", "यह इमेज नहीं खुल सकी।"), "err"); return; }
    var c = document.createElement("canvas"), s = Math.min(im.naturalWidth, im.naturalHeight), x = c.getContext("2d");
    c.width = c.height = 240; x.fillStyle = "#fff"; x.fillRect(0, 0, 240, 240);
    x.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, 240, 240);
    d.photo = c.toDataURL("image/jpeg", 0.85); $$("rbPhoto").value = ""; renderStatic(); renderPreview(); save();
    toast(T("Photo added. Modern and Bold templates show it.", "फोटो जुड़ गई। Modern और Bold टेम्पलेट में दिखेगी।"));
  });
  $$("rbPhotoRm").onclick = function () { d.photo = ""; renderStatic(); renderPreview(); save(); };

  function confirm2(btn, label, fn) {
    if (btn.getAttribute("data-sure") === "1") { btn.removeAttribute("data-sure"); DTAapply(); fn(); return; }
    btn.setAttribute("data-sure", "1"); btn.textContent = label;
    setTimeout(function () { if (btn.getAttribute("data-sure") === "1") { btn.removeAttribute("data-sure"); DTAapply(); } }, 3500);
  }
  function hasContent() { return !d.sample && (d.basics.name || d.summary || d.experience.some(has) || d.education.some(has) || d.skills.some(has)); }
  $$("rbExample").onclick = function () { var go = function () { d = sample(); renderAll(); save(); toast(T("Example loaded", "उदाहरण लोड हुआ")); }; if (hasContent()) confirm2(this, T("Tap again: replaces your resume", "फिर टैप करें: आपका रिज़्यूमे बदल जाएगा"), go); else go(); };
  $$("rbClear").onclick = function () { confirm2(this, T("Tap again to delete everything", "सब मिटाने के लिए फिर टैप करें"), function () { d = blank(); renderAll(); save(); toast(T("Cleared", "साफ हो गया")); }); };
  document.addEventListener("click", function (e) { if (e.target.id === "rbSampleClear") { d = blank(); renderAll(); save(); } });
  $$("rbExport").onclick = function () {
    var name = (d.basics.name || "resume").trim().replace(/[^\wऀ-ॿ-]+/g, "-").slice(0, 40) || "resume";
    saveBlob(new Blob([JSON.stringify({ app: "dtahub-resume", v: 1, data: d })], { type: "application/json" }), "dtahub-" + name + ".json");
  };
  $$("rbImport").addEventListener("change", function () {
    var f = this.files[0]; this.value = ""; if (!f) return;
    if (f.size > 1500000) { toast(T("File is too large for a resume backup.", "रिज़्यूमे बैकअप के लिए फाइल बहुत बड़ी है।"), "err"); return; }
    var r = new FileReader();
    r.onload = function () {
      try { var j = JSON.parse(r.result); if (!j || j.app !== "dtahub-resume" || !j.data) throw 0; d = normalize(j.data); d.sample = false; renderAll(); save(); toast(T("Backup imported", "बैकअप इम्पोर्ट हुआ")); }
      catch (e) { toast(T("This is not a DTAhub resume backup.", "यह DTAhub रिज़्यूमे बैकअप नहीं है।"), "err"); }
    };
    r.onerror = function () { toast(T("Could not read the file.", "फाइल पढ़ नहीं सके।"), "err"); };
    r.readAsText(f);
  });

  $$("rbPrint").onclick = function () {
    var old = document.title, n = (d.basics.name || "").trim();
    document.title = (n ? n + " - " : "") + "Resume";
    toast(T("Choose “Save as PDF” in the print window", "प्रिंट विंडो में “Save as PDF” चुनें"));
    setTimeout(function () { window.print(); setTimeout(function () { document.title = old; }, 1500); }, 250);
  };

  var tabs = $$("rb");
  document.querySelector(".rb-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]"); if (!b) return;
    tabs.setAttribute("data-tab", b.getAttribute("data-tab"));
    document.querySelectorAll(".rb-tabs .chip").forEach(function (c) { var on = c === b; c.classList.toggle("on", on); c.setAttribute("aria-selected", on); });
    if (b.getAttribute("data-tab") === "view") { fit(); window.scrollTo({ top: 0 }); }
  });
  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe($$("rbStage")); else addEventListener("resize", fit);
  document.addEventListener("langchange", function () { if (d) { renderStatic(); renderForm(); renderCheck(); fit(); } });

  d = load(); renderAll();
  if (!localStorage.getItem(KEY)) $$("rbSaved").textContent = T("Your changes are saved on this device automatically.", "आपके बदलाव इसी डिवाइस पर अपने आप सेव होते हैं।");
})();

#!/usr/bin/env node
/* DTAhub build: keeps every page consistent from the central registry (public/js/tools-data.js).
   Safe to run many times: injected parts live between <!--DTA:NAME--> markers and are replaced in place.
   Usage:  node scripts/build.mjs            (site = address in tools-data.js)
           SITE_URL=https://dtahub.com node scripts/build.mjs   (after you buy a domain)           */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PUB = path.join(ROOT, "public");
const D = require(path.join(PUB, "js/tools-data.js"));
const SITE = (process.env.SITE_URL || D.SITE).replace(/\/+$/, "");
const YEAR = new Date().getFullYear();
const e = D.esc;
const bi = (en, hi, tag = "span", attrs = "") => `<${tag}${attrs} data-en="${e(en)}" data-hi="${e(hi)}">${e(en)}</${tag}>`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const clean = (p) => p.replace(/index\.html$/, "").replace(/\.html$/, "");
const abs = (p) => SITE + clean(p);

const mark = (n, c) => `<!--DTA:${n}-->${c}<!--/DTA:${n}-->`;
function block(html, name, content, place) {
  const re = new RegExp(`<!--DTA:${name}-->[\\s\\S]*?<!--/DTA:${name}-->`);
  const m = mark(name, content);
  return re.test(html) ? html.replace(re, () => m) : place(html, m);
}
const lastMain = /<\/main>(?![\s\S]*<\/main>)/;

const logo = (s = 32) => `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="dtalg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c969"/><stop offset="1" stop-color="#8b6cf6"/></linearGradient></defs><path d="M20 2.5 35.5 11.5v17L20 37.5 4.5 28.5v-17z" fill="none" stroke="url(#dtalg${s})" stroke-width="2.4" stroke-linejoin="round"/><path d="M14.5 12.5h5.5a7.5 7.5 0 0 1 0 15h-5.5z" fill="url(#dtalg${s})"/></svg>`;

/* ---------- shared chrome ---------- */
function header() {
  const cats = D.CATS.map((c) => `<a href="${D.catUrl(c)}">${D.icon(c.icon, 20)}${bi(c.en, c.hi)}</a>`).join("");
  return `<a class="skip" href="#main">${bi("Skip to content", "मुख्य सामग्री पर जाएं")}</a>
<header class="nav">
 <a class="logo" href="/" aria-label="DTAhub – Your Everyday Digital Toolkit">${logo(32)}<span>DTA<b>hub</b></span></a>
 <nav class="links" aria-label="Main"><a href="/#tools">${bi("Tools", "टूल्स")}</a><a href="/#categories">${bi("Categories", "श्रेणियां")}</a><a href="/blog/">${bi("Guides", "गाइड्स")}</a><a href="/contact.html">${bi("Contact", "संपर्क")}</a></nav>
 <div class="actions">
  <button class="kbd-btn" type="button" data-open-palette aria-label="Search">${D.icon("search", 18)}${bi("Search tools…", "टूल खोजें…")}<kbd>Ctrl K</kbd></button>
  <button class="icon-btn s-btn" type="button" data-open-palette aria-label="Search">${D.icon("search", 19)}</button>
  <button class="icon-btn" id="langBtn" type="button" aria-label="Language">हि</button>
  <button class="icon-btn" id="themeBtn" type="button" aria-label="Theme">${D.icon("sun", 19)}</button>
  <button class="icon-btn menu-btn" id="menuBtn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="mnav">${D.icon("menu", 20)}</button>
 </div>
</header>
<nav class="mnav" id="mnav" aria-label="Mobile">
 <a href="/">${D.icon("bolt", 20)}${bi("Home", "होम")}</a>
 <a href="/#tools">${D.icon("search", 20)}${bi("All tools", "सभी टूल्स")}</a>
 <a href="/blog/">${D.icon("text", 20)}${bi("Guides", "गाइड्स")}</a>
 <a href="/contact.html">${D.icon("plus", 20)}${bi("Contact and requests", "संपर्क और मांग")}</a>
 <a href="/settings.html">${D.icon("settings", 20)}${bi("Settings", "सेटिंग्स")}</a>
 <div class="sep"></div><small>${bi("Categories", "श्रेणियां")}</small>${cats}
 <div class="sep"></div><a href="#" data-install hidden>${D.icon("download", 20)}${bi("Install app", "ऐप इंस्टॉल करें")}</a>
</nav>`;
}

function footer() {
  const li = (h, i) => `<li><a href="${h}">${i}</a></li>`;
  return `<footer class="foot"><div class="foot-in">
 <div><a class="logo" href="/">${logo(28)}<span>DTA<b>hub</b></span></a><p class="blurb">${bi("DTAhub – Your Everyday Digital Toolkit. Free tools that run privately in your browser.", "DTAhub – आपका रोज़ का डिजिटल टूलकिट। मुफ्त टूल्स जो आपके ब्राउज़र में प्राइवेट तरीके से चलते हैं।")}</p><p><button class="btn" type="button" data-install hidden>${D.icon("download", 18)}${bi("Install app", "ऐप इंस्टॉल करें")}</button></p></div>
 <div><h4>${bi("Categories", "श्रेणियां")}</h4><ul>${D.CATS.map((c) => li(D.catUrl(c), bi(c.en, c.hi))).join("")}</ul></div>
 <div><h4>${bi("Company", "कंपनी")}</h4><ul>${li("/blog/", bi("Guides", "गाइड्स"))}${li("/contact.html", bi("Contact", "संपर्क"))}${li("/contact.html#request", bi("Request a tool", "टूल मांगें"))}${li("/settings.html", bi("Settings", "सेटिंग्स"))}${li("/privacy.html", bi("Privacy Policy", "प्राइवेसी पॉलिसी"))}${li("/terms.html", bi("Terms", "शर्तें"))}</ul></div>
 <div><h4>${bi("All tools", "सभी टूल्स")}</h4><ul class="two">${D.TOOLS.map((t) => li(D.toolUrl(t), bi(t.en, t.hi))).join("")}</ul></div>
</div><div class="foot-bot"><span>© ${YEAR} DTAhub</span><span>${bi("Made with care in India.", "भारत में प्यार से बनाया गया।")}</span></div></footer>`;
}

function crumbs(items) {
  const lis = items.map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${bi(it.en, it.hi)}</li>` : `<li><a href="${it.url}">${bi(it.en, it.hi)}</a></li>`)).join("");
  return `<nav aria-label="Breadcrumb"><ol class="crumbs">${lis}</ol></nav>`;
}
const crumbLD = (items) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.en, item: abs(it.url || it.path || "/") })) });

function headBlock(m) {
  const url = abs(m.path);
  return `<title>${e(m.title)}</title>
<meta name="description" content="${e(m.desc)}">
${m.noindex ? '<meta name="robots" content="noindex">' : `<meta name="robots" content="index, follow, max-image-preview:large">\n<link rel="canonical" href="${url}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="DTAhub"><meta property="og:locale" content="en_IN">
<meta property="og:title" content="${e(m.title)}"><meta property="og:description" content="${e(m.desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(m.title)}"><meta name="twitter:description" content="${e(m.desc)}"><meta name="twitter:image" content="${SITE}/og.png">
<meta name="theme-color" content="#08080d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">
<script>try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);if(localStorage.getItem("lang")==="hi")document.documentElement.lang="hi";if(localStorage.getItem("motion")==="off")document.documentElement.setAttribute("data-motion","off")}catch(e){}</script>
<noscript><style>.reveal{opacity:1!important;transform:none!important}</style></noscript>
${(m.jsonld || []).map(ld).join("\n")}`;
}

/* ---------- page processor ---------- */
function processPage(file, m, parts = {}) {
  let h = fs.readFileSync(file, "utf8");
  h = h.replace(/<title>[\s\S]*?<\/title>\s*/, "").replace(/<meta name="description"[^>]*>\s*/, "");
  h = block(h, "META", headBlock(m), (s, x) => s.replace("</head>", () => x + "\n</head>"));
  h = h.replace(/<body[^>]*>/, () => `<body data-page="${m.type}"${m.toolId ? ` data-tool="${m.toolId}"` : ""}>`);
  h = block(h, "NAV", header(), (s, x) => s.replace(/<body[^>]*>/, (b) => b + "\n" + x));
  h = h.replace(/<main(?![^>]*\bid=)/, '<main id="main"');
  if (parts.crumbs) h = block(h, "CRUMBS", crumbs(parts.crumbs), (s, x) => (/<a class="back"/.test(s) ? s.replace(/<a class="back"[^>]*>[\s\S]*?<\/a>/, () => x) : s.replace(/(<main[^>]*>)/, (y) => y + "\n" + x)));
  if (parts.actions) h = block(h, "ACTIONS", parts.actions, (s, x) => s.replace(/(<p class="lead"[^>]*>[\s\S]*?<\/p>)/, (y) => y + "\n" + x));
  if (parts.extra) h = block(h, "EXTRA", parts.extra, (s, x) => s.replace(lastMain, () => x + "\n</main>"));
  h = block(h, "FOOT", footer(), (s, x) => s.replace(lastMain, () => "</main>\n" + x));
  h = h.replace(/<script src="\/js\/tools-data\.js"><\/script>\s*/g, "").replace('<script src="/js/tool.js"></script>', () => '<script src="/js/tools-data.js"></script>\n<script src="/js/tool.js"></script>');
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== h) fs.writeFileSync(file, h);
}

/* ---------- tool pages ---------- */
function descFor(t) {
  const first = t.about.en.split(/(?<=\.)\s+/)[0];
  const d = (first + " Free, private, no sign-up.").length <= 158 ? first + " Free, private, no sign-up." : first;
  return d.length > 160 ? d.slice(0, 157) + "…" : d;
}
const PRIV = {
  file: ["Your files are processed on your device and never uploaded. Limits: 30 MB per image, 50 MB per PDF.", "आपकी फाइलें आपके डिवाइस पर प्रोसेस होती हैं, अपलोड नहीं होतीं। सीमा: हर इमेज 30 MB, हर PDF 50 MB।"],
  text: ["Your text stays in your browser. Nothing is stored or sent anywhere.", "आपका टेक्स्ट आपके ब्राउज़र में ही रहता है। कुछ भी सेव या कहीं भेजा नहीं जाता।"],
  builder: ["Your details are saved only on this device while you type. Nothing is uploaded. Use Export to keep a backup file.", "आपकी जानकारी टाइप करते समय सिर्फ इसी डिवाइस पर सेव होती है। कुछ भी अपलोड नहीं होता। बैकअप के लिए Export इस्तेमाल करें।"],
  calc: ["Calculations run in your browser. Nothing you enter is stored or sent.", "हिसाब आपके ब्राउज़र में होता है। आप जो डालते हैं वो सेव या भेजा नहीं जाता।"]
};
function toolActions(t) {
  return `<div class="tool-acts">
 <button class="btn" type="button" data-fav="${t.id}" aria-pressed="false">${D.icon("star", 18)}<span class="n" data-en="Save" data-hi="सेव करें">Save</span><span class="y" data-en="Saved" data-hi="सेव हो गया">Saved</span></button>
 <button class="btn" type="button" data-share>${D.icon("share", 18)}${bi("Share", "शेयर")}</button>
 ${t.noReset ? "" : `<button class="btn" type="button" data-reset>${bi("Reset", "रीसेट")}</button>`}
</div>`;
}
function toolExtra(t) {
  const steps = D.KINDS[t.kind], p = PRIV[t.kind];
  const rel = (t.related || []).map(D.tool).filter(Boolean).map((r) => D.cardHTML(r)).join("");
  return `<aside class="privacy-note">${D.icon("shield", 20)}${bi(p[0], p[1], "p")}</aside>
<section class="seo-about">
 ${bi("About " + t.en, t.hi + " के बारे में", "h2")}
 ${bi(t.about.en, t.about.hi, "p")}
 ${bi("How to use", "कैसे इस्तेमाल करें", "h2")}
 <ol>${steps.en.map((s, i) => bi(s, steps.hi[i], "li")).join("")}</ol>
 ${bi("Good to know", "काम की बात", "h2")}
 ${bi(t.tip.en, t.tip.hi, "p")}
 ${bi("Related tools", "मिलते-जुलते टूल्स", "h2")}
 <div class="grid sm">${rel}</div>
</section>`;
}
function buildTools() {
  for (const t of D.TOOLS) {
    const file = path.join(PUB, "tools", t.id + ".html");
    if (!fs.existsSync(file)) { console.error("MISSING page for tool:", t.id); process.exitCode = 1; continue; }
    const c = D.cat(t.cat), p = D.toolUrl(t);
    const cr = [{ en: "Home", hi: "होम", url: "/" }, { en: c.en, hi: c.hi, url: D.catUrl(c) }, { en: t.en, hi: t.hi, url: p }];
    const desc = descFor(t);
    processPage(file, {
      type: "tool", toolId: t.id, path: p, title: `${t.en} – Free Online Tool | DTAhub`, desc,
      jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: t.en, url: abs(p), description: desc, applicationCategory: "UtilitiesApplication", operatingSystem: "Any (web browser)", browserRequirements: "Requires JavaScript", inLanguage: ["en", "hi"], isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "INR" }, publisher: { "@type": "Organization", name: "DTAhub", url: SITE + "/" } }, crumbLD(cr)]
    }, { crumbs: cr, actions: toolActions(t), extra: toolExtra(t) });
  }
  const known = new Set(D.TOOLS.map((t) => t.id + ".html"));
  for (const f of fs.readdirSync(path.join(PUB, "tools"))) if (!known.has(f)) console.warn("WARNING: tools/" + f + " is not in the registry (not in sitemap/directory).");
}

/* ---------- category pages ---------- */
function catPage(c) {
  const tools = D.TOOLS.filter((t) => t.cat === c.id), feat = tools.filter((t) => t.featured);
  const rel = (c.related || []).map(D.cat).filter(Boolean);
  const p = D.catUrl(c);
  const cr = [{ en: "Home", hi: "होम", url: "/" }, { en: c.en, hi: c.hi, url: p }];
  const dir = path.join(PUB, "category", c.id); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/tool.css"></head>
<body><div class="bg-glow"></div>
<main id="main" class="wrap">
<div class="page-h"><!--DTA:CRUMBS--><!--/DTA:CRUMBS-->
 <h1><span class="ico" style="display:inline-grid;vertical-align:middle;margin-right:10px">${D.icon(c.icon, 24)}</span>${bi(c.en, c.hi)}</h1>
 ${bi(c.intro.en, c.intro.hi, "p", ' class="lead-l"')}
 <div class="cat-bar"><div class="field">${D.icon("search", 18)}<input id="catQ" type="search" autocomplete="off" aria-label="Search in ${e(c.en)}" data-ph-en="Search in ${e(c.en)}…" data-ph-hi="${e(c.hi)} में खोजें…" placeholder="Search in ${e(c.en)}…"></div>
  <label class="sr" for="catSort">Sort</label><select id="catSort" class="sel"><option value="rec" data-en="Recommended" data-hi="सुझाए गए">Recommended</option><option value="az" data-en="A to Z" data-hi="A से Z">A to Z</option></select></div>
</div>
${feat.length ? `<section class="sec"><div class="sec-h"><div>${bi("Top picks", "खास टूल्स", "h2")}</div></div><div class="grid">${feat.map((t) => D.cardHTML(t)).join("")}</div></section>` : ""}
<section class="sec"><div class="sec-h"><div>${bi("All " + c.en, "सभी " + c.hi, "h2")}</div></div>
 <div id="allGrid" class="grid">${tools.map((t) => D.cardHTML(t)).join("")}</div>
 <div id="catEmpty" class="empty" hidden><b data-en="No tool found" data-hi="कोई टूल नहीं मिला">No tool found</b><a class="btn gold" href="/contact.html#request" data-en="Request a tool" data-hi="टूल मांगें">Request a tool</a></div>
</section>
<section class="seo-about"><h2>${bi("About " + c.en, c.hi + " के बारे में", "span")}</h2>${bi(c.body.en, c.body.hi, "p")}</section>
<section class="sec"><div class="sec-h"><div>${bi("Related categories", "मिलती-जुलती श्रेणियां", "h2")}</div></div><div class="cgrid">${rel.map(D.catCardHTML).join("")}</div></section>
<div class="cta-band reveal">${bi("Need a different tool?", "कोई और टूल चाहिए?", "h2")}${bi("Tell us what to build next.", "बताइए अगला क्या बनाएं।", "p")}<a class="btn gold" href="/contact.html#request" data-en="Request a tool" data-hi="टूल मांगें">Request a tool</a></div>
</main>
<script src="/js/tools-data.js"></script>
<script src="/js/tool.js"></script>
<script>(function(){var g=document.getElementById("allGrid"),q=document.getElementById("catQ"),s=document.getElementById("catSort"),em=document.getElementById("catEmpty"),orig=[].slice.call(g.children);
function run(){var v=q.value.trim().toLowerCase().split(/\\s+/).filter(Boolean),a=orig.slice(),n=0;
if(s.value==="az")a.sort(function(x,y){return x.querySelector("h3").textContent.localeCompare(y.querySelector("h3").textContent)});
a.forEach(function(c){var h=c.getAttribute("data-q"),ok=v.every(function(t){return h.indexOf(t)>-1});c.hidden=!ok;if(ok)n++;g.appendChild(c)});em.hidden=n>0}
q.addEventListener("input",run);s.addEventListener("change",run)})();</script>
</body></html>`;
  fs.writeFileSync(file, html);
  const items = tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, url: abs(D.toolUrl(t)), name: t.en }));
  processPage(file, {
    type: "category", path: p, title: `${c.en} – Free Online Tools | DTAhub`, desc: c.intro.en,
    jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: c.en, url: abs(p), description: c.intro.en, mainEntity: { "@type": "ItemList", itemListElement: items } }, crumbLD(cr)]
  }, { crumbs: cr });
}

/* ---------- home, static, blog, 404 ---------- */
const BLOG = {
  "compress-image-guide": { en: "How to compress an image without losing quality", hi: "क्वालिटी खोए बिना इमेज कैसे छोटी करें", desc: "Step by step guide to compress photos for forms, WhatsApp and websites without visible quality loss.", date: "2026-11-13" },
  "merge-pdf-guide": { en: "How to merge PDF files on your phone", hi: "फोन पर PDF फाइलें कैसे जोड़ें", desc: "Step by step guide to combine several PDF files into one on your phone, free and private.", date: "2026-11-13" }
};
function buildPages() {
  const S = D.STATIC_PAGES, H = { en: "Home", hi: "होम", url: "/" };
  const faq = D.FAQ.map((f) => `<details><summary>${bi(f.q.en, f.q.hi)}</summary>${bi(f.a.en, f.a.hi, "p")}</details>`).join("");
  let idx = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
  idx = block(idx, "FAQ", faq, (s, x) => s);
  fs.writeFileSync(path.join(PUB, "index.html"), idx);
  processPage(path.join(PUB, "index.html"), {
    type: "home", path: "/", title: S["/"].title, desc: S["/"].desc,
    jsonld: [
      { "@context": "https://schema.org", "@type": "WebSite", name: "DTAhub", url: SITE + "/", description: S["/"].desc, inLanguage: ["en", "hi"] },
      { "@context": "https://schema.org", "@type": "Organization", name: "DTAhub", url: SITE + "/", logo: SITE + "/icons/icon-512.png" },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: D.FAQ.map((f) => ({ "@type": "Question", name: f.q.en, acceptedAnswer: { "@type": "Answer", text: f.a.en } })) }
    ]
  });
  const st = [["contact.html", "/contact.html", { en: "Contact", hi: "संपर्क" }], ["privacy.html", "/privacy.html", { en: "Privacy Policy", hi: "प्राइवेसी पॉलिसी" }], ["terms.html", "/terms.html", { en: "Terms of Use", hi: "उपयोग की शर्तें" }]];
  for (const [f, p, n] of st) { const cr = [H, { ...n, url: p }]; processPage(path.join(PUB, f), { type: "page", path: p, title: `${S[p].title} | DTAhub`, desc: S[p].desc, jsonld: [crumbLD(cr)] }, { crumbs: cr }); }
  processPage(path.join(PUB, "settings.html"), { type: "page", path: "/settings.html", noindex: true, title: "Settings | DTAhub", desc: S["/settings.html"].desc }, { crumbs: [H, { en: "Settings", hi: "सेटिंग्स", url: "/settings.html" }] });
  const bcr = [H, { en: "Guides", hi: "गाइड्स", url: "/blog/" }];
  processPage(path.join(PUB, "blog/index.html"), { type: "page", path: "/blog/", title: `${S["/blog/"].title} | DTAhub`, desc: S["/blog/"].desc, jsonld: [crumbLD(bcr)] }, { crumbs: bcr });
  for (const [slug, b] of Object.entries(BLOG)) {
    const p = `/blog/${slug}.html`, cr = [H, { en: "Guides", hi: "गाइड्स", url: "/blog/" }, { en: b.en, hi: b.hi, url: p }];
    processPage(path.join(PUB, "blog", slug + ".html"), {
      type: "article", path: p, title: `${b.en} | DTAhub`, desc: b.desc,
      jsonld: [{ "@context": "https://schema.org", "@type": "Article", headline: b.en, description: b.desc, datePublished: b.date, dateModified: b.date, mainEntityOfPage: abs(p), author: { "@type": "Organization", name: "DTAhub" }, publisher: { "@type": "Organization", name: "DTAhub", logo: { "@type": "ImageObject", url: SITE + "/icons/icon-512.png" } }, image: SITE + "/og.png" }, crumbLD(cr)]
    }, { crumbs: cr });
  }
  processPage(path.join(PUB, "404.html"), { type: "404", path: "/404", noindex: true, title: "Page not found | DTAhub", desc: "This page could not be found. Search DTAhub for the tool you need." });
}

/* ---------- sitemap, robots, manifest, headers, service worker ---------- */
function walk(dir, out = []) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
function buildSite() {
  const urls = ["/", ...D.CATS.map(D.catUrl), ...D.TOOLS.map(D.toolUrl), "/blog/", ...Object.keys(BLOG).map((s) => `/blog/${s}.html`), "/contact.html", "/privacy.html", "/terms.html"];
  fs.writeFileSync(path.join(PUB, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${abs(u)}</loc></url>`).join("\n")}\n</urlset>\n`);
  fs.writeFileSync(path.join(PUB, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /404\n\nSitemap: ${SITE}/sitemap.xml\n`);
  const sc = D.TOOLS.filter((t) => t.featured).slice(0, 4).map((t) => ({ name: t.en, short_name: t.en, url: D.toolUrl(t), icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] }));
  fs.writeFileSync(path.join(PUB, "manifest.webmanifest"), JSON.stringify({ name: "DTAhub – Your Everyday Digital Toolkit", short_name: "DTAhub", description: D.STATIC_PAGES["/"].desc, start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#08080d", theme_color: "#08080d", lang: "en", categories: ["utilities", "productivity"], icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }], shortcuts: sc }, null, 2) + "\n");
  fs.writeFileSync(path.join(PUB, "_headers"), `# Security headers. If you add Google AdSense later, its domains must be added to script-src, img-src, frame-src and connect-src.
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://api.web3forms.com; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'

/sw.js
  Cache-Control: no-cache

/js/vendor/*
  Cache-Control: public, max-age=604800
`);

  /* service worker: version = hash of every public file, so any change refreshes the offline cache */
  const files = walk(PUB).filter((f) => !/sw\.js$|_headers$/.test(f)).sort();
  const hash = crypto.createHash("sha1"); for (const f of files) { hash.update(f); hash.update(fs.readFileSync(f)); }
  const ver = hash.digest("hex").slice(0, 10);
  const pre = files.map((f) => "/" + path.relative(PUB, f).split(path.sep).join("/")).filter((u) => !u.startsWith("/js/vendor/") && !/\.(txt|xml)$/.test(u) && u !== "/og.png").map((u) => (u === "/index.html" ? "/" : u.endsWith("/index.html") ? u.slice(0, -10) : u));
  fs.writeFileSync(path.join(PUB, "sw.js"), `/* DTAhub service worker (generated by scripts/build.mjs). Offline support for pages you open. */
const V = "dtahub-${ver}";
const PRE = ${JSON.stringify(pre)};
const fresh = (res) => (res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res);
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(PRE.map((u) => fetch(u).then((r) => (r.ok ? c.put(u, fresh(r)) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((res) => { const out = fresh(res); if (res.ok) { const cp = out.clone(); caches.open(V).then((c) => c.put(r, cp)); } return out; })
      .catch(() => caches.match(r).then((m) => m || caches.match(r, { ignoreSearch: true })).then((m) => m || caches.match("/"))));
    return;
  }
  e.respondWith(caches.match(r).then((hit) => {
    const net = fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
`);
  console.log(`Built: ${D.TOOLS.length} tools, ${D.CATS.length} categories, ${urls.length} sitemap URLs, SW ${ver}, site ${SITE}`);
}

buildTools();
D.CATS.forEach(catPage);
buildPages();
buildSite();

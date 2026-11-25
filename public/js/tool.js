/* DTAhub shared shell: language, theme, toasts, favourites, recents, command palette,
   drag & drop, file validation, share, install prompt, offline. Loaded on every page. */
(function () {
  var D = window.DTA, C = window.DTAcore, root = document.documentElement;
  /* shared helpers now live in DTAcore (dta-core.js); the globals below stay as stable aliases for every page script */
  var get = C.store.get, put = C.store.put, getList = C.store.list;
  var lang = C.i18n.lang(), theme = get("theme", "light") === "dark" ? "dark" : "light", motion = get("motion", "on") === "off" ? "off" : "on", accent = get("accent", "gold");
  if (accent !== "emerald" && accent !== "rose") accent = "gold";

  window.L = C.i18n.L;
  window.fmt = function (n) { var s = C.num.fmtIN(n); return s === "" ? Number(n).toLocaleString("en-IN") : s; };
  window.$ = C.dom.$;
  window.DTAlang = function () { return lang; };
  window.DTAstore = C.store;
  window.toast = C.ui.toast;
  window.copyText = C.ui.copy;

  /* ---------- scroll reveal + card spotlight ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08 }) : null;
  window.DTAwatch = function () { document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); }); };
  if (window.matchMedia && matchMedia("(hover:hover)").matches) {
    document.addEventListener("pointermove", function (e) {
      var c = e.target.closest && e.target.closest(".card"); if (!c) return;
      var r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px");
      c.style.setProperty("--ry", (((e.clientX - r.left) / r.width - .5) * 7).toFixed(2) + "deg"); c.style.setProperty("--rx", (((e.clientY - r.top) / r.height - .5) * -7).toFixed(2) + "deg");
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var c = e.target.closest && e.target.closest(".card,.ccard"); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); }
    }, { passive: true });
  }

  /* ---------- favourites + recents ---------- */
  window.DTAfav = {
    list: function () { return getList("dta_fav"); },
    has: function (id) { return getList("dta_fav").indexOf(id) > -1; },
    toggle: function (id) {
      var a = getList("dta_fav"), i = a.indexOf(id); if (i > -1) a.splice(i, 1); else a.unshift(id);
      put("dta_fav", JSON.stringify(a)); syncFavs(); document.dispatchEvent(new Event("favchange")); return i === -1;
    }
  };
  window.DTArecent = function () { return getList("dta_recent"); };
  function syncFavs() {
    var a = getList("dta_fav");
    document.querySelectorAll("[data-fav]").forEach(function (b) { b.setAttribute("aria-pressed", a.indexOf(b.getAttribute("data-fav")) > -1 ? "true" : "false"); });
  }
  window.DTAsync = syncFavs;
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fav]"); if (!b) return;
    e.preventDefault(); var id = b.getAttribute("data-fav"), t = D.tool(id), on = DTAfav.toggle(id);
    b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
    toast(on ? L("Saved to favourites", "पसंदीदा में सेव हुआ") : L("Removed from favourites", "पसंदीदा से हटाया") + (t ? "" : ""));
  });
  var cur = document.body.getAttribute("data-tool");
  if (cur) { var r = getList("dta_recent").filter(function (x) { return x !== cur; }); r.unshift(cur); put("dta_recent", JSON.stringify(r.slice(0, 8))); }

  /* ---------- premium motion for the tool listing: aurora, constellation canvas, pointer spotlight, staggered cards ---------- */
  window.DTAstagger = function () {
    document.querySelectorAll(".grid").forEach(function (g) { Array.prototype.forEach.call(g.children, function (c, i) { c.style.setProperty("--i", Math.min(i % 12, 11)); }); });
  };
  DTAstagger();
  (function () {
    var host = [document.getElementById("tools")], ag = document.getElementById("allGrid"); if (ag) host.push(ag.closest("section"));
    var secs = host.filter(Boolean); if (!secs.length) return; return; /* background aurora/constellation removed for a lighter site */
    var root = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    function motionOn() { return root.getAttribute("data-motion") !== "off" && !mq.matches; }
    secs.forEach(function (sec) {
      sec.classList.add("fx");
      var bg = document.createElement("div"); bg.className = "fx-bg"; bg.setAttribute("aria-hidden", "true");
      bg.innerHTML = '<i class="au a1"></i><i class="au a2"></i><i class="au a3"></i><canvas></canvas><b class="spot"></b>';
      sec.insertBefore(bg, sec.firstChild);
      var cv = bg.querySelector("canvas"), cx = cv.getContext("2d"), H = 340, W = 0, P = [], raf = 0, last = 0, vis = false, ptr = null, col1 = "242,201,105", col2 = "139,108,246";
      function size() {
        var r = bg.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1); W = Math.max(1, Math.round(r.width));
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var n = Math.max(14, Math.min(46, Math.round(W / 26))); P = [];
        for (var i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 1.6, c: i % 3 ? 1 : 0 });
      }
      function colors() { var s = getComputedStyle(root), f = function (n, d) { var v = s.getPropertyValue(n).trim(); return v ? v.replace(/\s+/g, ",") : d; }; col1 = f("--a1r", col1); col2 = f("--a2r", col2); }
      function frame(now) {
        raf = requestAnimationFrame(frame); if (now - last < 33) return; last = now;
        cx.clearRect(0, 0, W, H);
        for (var i = 0; i < P.length; i++) {
          var p = P[i]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
          for (var j = i + 1; j < P.length; j++) { var q = P[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy; if (d < 12000) { cx.strokeStyle = "rgba(" + col2 + "," + (.22 * (1 - d / 12000)).toFixed(3) + ")"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); } }
          if (ptr) { var ex = p.x - ptr.x, ey = p.y - ptr.y, ed = ex * ex + ey * ey; if (ed < 20000) { cx.strokeStyle = "rgba(" + col1 + "," + (.5 * (1 - ed / 20000)).toFixed(3) + ")"; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(ptr.x, ptr.y); cx.stroke(); p.x += ex * .0008; p.y += ey * .0008; } }
          cx.fillStyle = "rgba(" + (p.c ? col1 : col2) + ",.75)"; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.2832); cx.fill();
        }
      }
      function sync() { if (vis && motionOn()) { if (!raf) { colors(); if (!P.length) size(); raf = requestAnimationFrame(frame); } } else { if (raf) cancelAnimationFrame(raf); raf = 0; if (!motionOn()) cx.clearRect(0, 0, W, H); } }
      if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; sync(); }, { rootMargin: "100px" }).observe(sec); else { vis = true; sync(); }
      new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-motion", "data-accent", "data-theme"] });
      window.addEventListener("resize", function () { P = []; if (vis) size(); }, { passive: true });
      if (mq.addEventListener) mq.addEventListener("change", sync);
      if (window.matchMedia && matchMedia("(hover:hover)").matches) {
        var pend = 0, ev = null;
        sec.addEventListener("pointermove", function (e) {
          ev = e; if (pend) return; pend = requestAnimationFrame(function () {
            pend = 0; var r = sec.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
            bg.style.setProperty("--sx", x + "px"); bg.style.setProperty("--sy", y + "px"); sec.classList.add("hot");
            var cr = cv.getBoundingClientRect(); ptr = ev.clientY >= cr.top && ev.clientY <= cr.bottom ? { x: ev.clientX - cr.left, y: ev.clientY - cr.top } : null;
          });
        }, { passive: true });
        sec.addEventListener("pointerleave", function () { sec.classList.remove("hot"); ptr = null; });
      }
    });
  })();

  /* ---------- tool page header, guide TOC, bottom-nav state ---------- */
  (function () {
    var main = document.getElementById("main"), id = document.body.getAttribute("data-tool");
    var h1 = main && main.querySelector(":scope > h1"), lead = main && main.querySelector(":scope > p.lead");
    if (id && h1 && D.tool(id)) {
      var t = D.tool(id), c = D.cat(t.cat), w = document.createElement("div"); w.className = "thero"; w.style.setProperty("--h", c.hue || 45);
      var med = document.createElement("span"); med.className = "tmed"; med.setAttribute("aria-hidden", "true"); med.innerHTML = D.icon(id, 30) + "<i></i>";
      var txt = document.createElement("div"); h1.parentNode.insertBefore(w, h1); w.appendChild(med); w.appendChild(txt); txt.appendChild(h1); if (lead) txt.appendChild(lead);
      var bd = document.createElement("div"); bd.className = "tbadges";
      [["Free", "मुफ्त"], ["Stays on your device", "आपके डिवाइस पर ही"], ["No sign-up", "साइन-अप नहीं"]].forEach(function (p) { var s = document.createElement("span"); s.setAttribute("data-en", p[0]); s.setAttribute("data-hi", p[1]); s.textContent = p[0]; bd.appendChild(s); });
      w.appendChild(bd);
    }
    if (document.body.getAttribute("data-page") === "article" && main) {
      var hs = main.querySelectorAll("h2");
      if (hs.length > 1) {
        var box = document.createElement("nav"); box.className = "toc"; box.setAttribute("aria-label", "Contents");
        box.innerHTML = '<b data-en="In this guide" data-hi="इस गाइड में">In this guide</b><ol></ol>'; var ol = box.querySelector("ol");
        hs.forEach(function (h, i) { h.id = h.id || "s" + (i + 1); var li = document.createElement("li"), a = document.createElement("a"); a.href = "#" + h.id; a.setAttribute("data-en", h.getAttribute("data-en") || h.textContent); a.setAttribute("data-hi", h.getAttribute("data-hi") || h.textContent); a.textContent = h.textContent; li.appendChild(a); ol.appendChild(li); });
        var first = main.querySelector(":scope > h1 ~ p"); if (first) first.parentNode.insertBefore(box, first.nextSibling);
      }
    }
    var p = location.pathname;
    document.querySelectorAll(".bnav a").forEach(function (a) {
      var k = a.getAttribute("data-b"), on = (k === "home" && (p === "/" || p === "/index.html")) || (k === "blog" && p.indexOf("/blog") === 0) || (k === "settings" && p.indexOf("/settings") === 0) || (k === "tools" && (p.indexOf("/tools/") === 0 || p.indexOf("/category/") === 0));
      if (on) a.classList.add("on");
    });
  })();

  /* Hindi names for screen readers: labels written in English in the markup or built by scripts are swapped by this table */
  var AH = {"Main":"मुख्य मेन्यू","Menu":"मेन्यू","More":"और","Quick":"क्विक लिंक","Search":"खोजें","Search tools":"टूल खोजें","Breadcrumb":"आप यहाँ हैं","Favourite":"पसंदीदा","More in this category":"इस श्रेणी के और टूल","Theme":"थीम","Accent":"रंग","Animations":"एनिमेशन","Language":"भाषा","Categories":"श्रेणियाँ","Custom colour":"अपना रंग","DTAhub – Your Everyday Digital Toolkit":"DTAhub – आपका रोज़ का डिजिटल टूलकिट","Balance chart":"बकाया राशि का चार्ट","Growth chart":"बढ़त का चार्ट","Principal vs interest":"मूलधन बनाम ब्याज","Repayment schedule":"किस्तों की तालिका","Delete":"हटाएं","Remove":"हटाएं","Down":"नीचे","Up":"ऊपर","Move down":"नीचे ले जाएं","Move up":"ऊपर ले जाएं","Drag to reorder":"क्रम बदलने के लिए खींचें","Editor":"संपादक","Export":"एक्सपोर्ट","Flags":"फ्लैग","Hash results":"हैश नतीजे","Hindi output":"हिंदी आउटपुट","Item":"आइटम","Price":"कीमत","Price ₹":"कीमत ₹","Letter text":"पत्र का टेक्स्ट","Preview":"प्रीव्यू","Result":"नतीजा","Type":"प्रकार","Unit":"इकाई","Version name":"वर्शन का नाम","View":"व्यू","Discount %":"छूट %","Discount percent":"छूट प्रतिशत","Extra discount percent":"अतिरिक्त छूट प्रतिशत","Extra discount % (optional)":"अतिरिक्त छूट % (वैकल्पिक)","e.g. Ms. Sharma":"जैसे: श्रीमती शर्मा","X number":"X संख्या","Y number":"Y संख्या","X percent":"X प्रतिशत","Qty":"मात्रा","GST %":"जीएसटी %","Rotate":"घुमाएं"};
  function trAttr(el, attr) {
    var k = "data-o-" + attr, o = el.getAttribute(k), cur = el.getAttribute(attr);
    if (o !== null && cur !== o && cur !== AH[o]) { el.removeAttribute(k); o = null; }
    if (o === null) { if (cur === null || !Object.prototype.hasOwnProperty.call(AH, cur)) return; o = cur; el.setAttribute(k, o); }
    el.setAttribute(attr, lang === "hi" ? AH[o] : o);
  }
  function trAll() {
    document.querySelectorAll("[aria-label]:not([data-label-en])").forEach(function (el) { trAttr(el, "aria-label"); });
    document.querySelectorAll("[placeholder]:not([data-ph-en])").forEach(function (el) { trAttr(el, "placeholder"); });
  }
  var trT = 0;
  if (window.MutationObserver) new MutationObserver(function () { if (lang === "hi") { clearTimeout(trT); trT = setTimeout(trAll, 120); } }).observe(document.documentElement, { childList: true, subtree: true });
  /* ---------- apply language / theme ---------- */
  function apply() {
    root.lang = lang; root.setAttribute("data-theme", theme); root.setAttribute("data-motion", motion); if (accent === "gold") root.removeAttribute("data-accent"); else root.setAttribute("data-accent", accent);
    document.querySelectorAll("[data-en]").forEach(function (el) { var v = el.getAttribute("data-" + lang); if (v !== null) el.textContent = v; });
    document.querySelectorAll("[data-ph-en]").forEach(function (el) { el.placeholder = el.getAttribute("data-ph-" + lang); });
    document.querySelectorAll("[data-label-en]").forEach(function (el) { el.setAttribute("aria-label", el.getAttribute("data-label-" + lang)); });
    trAll();
    var lb = $("langBtn"), tb = $("themeBtn");
    if (lb) { lb.textContent = lang === "en" ? "हि" : "EN"; lb.setAttribute("aria-label", lang === "en" ? "हि – switch to Hindi" : "EN – switch to English"); }
    if (tb) { tb.innerHTML = D.icon(theme === "dark" ? "sun" : "moon", 19); tb.setAttribute("aria-label", theme === "dark" ? L("Switch to light theme", "लाइट थीम चुनें") : L("Switch to dark theme", "डार्क थीम चुनें")); }
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", theme === "dark" ? "#08080d" : "#f4f7fe");
    document.dispatchEvent(new Event("langchange"));
  }
  window.DTAapply = apply;
  function setLang() { lang = C.i18n.toggle(); apply(); }
  function setTheme() { theme = theme === "dark" ? "light" : "dark"; put("theme", theme); apply(); }
  window.DTAsettings = {
    setLang: function (l) { lang = C.i18n.set(l); apply(); },
    setTheme: function (t) { theme = t === "light" ? "light" : "dark"; put("theme", theme); apply(); },
    setMotion: function (m) { motion = m === "off" ? "off" : "on"; put("motion", motion); apply(); },
    setAccent: function (a) { accent = a === "emerald" || a === "rose" ? a : "gold"; put("accent", accent); apply(); },
    get: function () { return { lang: lang, theme: theme, motion: motion, accent: accent }; }
  };
  var lb = $("langBtn"), tb = $("themeBtn"); if (lb) lb.onclick = setLang; if (tb) tb.onclick = setTheme;

  /* ---------- mobile nav ---------- */
  var mb = $("menuBtn"), mn = $("mnav"), more = $("moreBtn"), sc = $("mscrim"), lastFocus = null;
  var morePath = /^\/(settings|contact|privacy|terms|category)/.test(location.pathname);
  if (more && morePath) more.classList.add("on");
  function menu(open) {
    if (!mn) return;
    mn.classList.toggle("open", open); if (sc) sc.classList.toggle("open", open);
    [mb, more].forEach(function (b) { if (b) b.setAttribute("aria-expanded", open ? "true" : "false"); });
    if (mb) mb.innerHTML = D.icon(open ? "close" : "menu", 20);
    if (more) { more.classList.toggle("on", open || morePath); more.innerHTML = D.icon(open ? "close" : "menu", 22) + '<span data-en="' + (open ? "Close" : "More") + '" data-hi="' + (open ? "बंद" : "और") + '">' + (open ? L("Close", "बंद") : L("More", "और")) + "</span>"; }
    if (open) { lastFocus = document.activeElement; setTimeout(function () { var f = mn.querySelector("a:not([hidden])"); if (f && more && isOpen()) f.focus({ preventScroll: true }); }, 70); }
    else if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} lastFocus = null; }
  }
  var isOpen = function () { return mn && mn.classList.contains("open"); };
  if (mb) mb.onclick = function () { menu(!isOpen()); };
  if (more) more.onclick = function () { menu(!isOpen()); };
  if (sc) sc.onclick = function () { menu(false); };
  if (mn) mn.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); });
  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;
    if (e.key === "Escape") { menu(false); return; }
    if (e.key === "Tab" && more) {
      var f = [].slice.call(mn.querySelectorAll("a:not([hidden])")).concat([more]); if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("resize", function () { if (isOpen() && window.innerWidth >= 760) menu(false); });
  (function () {
    var pth = location.pathname.replace(/\.html$/, "");
    document.querySelectorAll(".links a, .mnav a, .ddp a").forEach(function (a) {
      var h = (a.getAttribute("href") || "").replace(/\.html$/, ""); if (h.charAt(0) !== "/") return;
      var hit = h.indexOf("#") > -1 ? ((h === "/#categories" && pth.indexOf("/category/") === 0)) : (h !== "/" && pth.indexOf(h) === 0);
      if (hit) a.setAttribute("aria-current", "page");
    });
  })();
  if (window.innerWidth < 760) document.querySelectorAll(".fd").forEach(function (d) { d.removeAttribute("open"); });
  /* back to top, only after a good scroll */
  (function () {
    var b = document.createElement("button"); b.type = "button"; b.className = "totop"; b.setAttribute("aria-label", L("Back to top", "ऊपर जाएं")); b.innerHTML = D.icon("up", 20);
    document.body.appendChild(b); var t = 0;
    function chk() { t = 0; b.classList.toggle("show", window.scrollY > 900); }
    window.addEventListener("scroll", function () { if (!t) t = requestAnimationFrame(chk); }, { passive: true });
    b.onclick = function () { var rm = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.getAttribute("data-motion") === "off"; window.scrollTo({ top: 0, behavior: rm ? "auto" : "smooth" }); var m = document.getElementById("main"); if (m) { m.setAttribute("tabindex", "-1"); m.focus({ preventScroll: true }); } };
    document.addEventListener("langchange", function () { b.setAttribute("aria-label", L("Back to top", "ऊपर जाएं")); });
  })();

  /* ---------- share + reset ---------- */
  document.addEventListener("click", function (e) {
    var s = e.target.closest && e.target.closest("[data-share]");
    if (s) {
      var url = location.origin + location.pathname, title = document.title;
      if (navigator.share) navigator.share({ title: title, url: url }).catch(function () {});
      else copyText(url);
      return;
    }
    var r = e.target.closest && e.target.closest("[data-reset]");
    if (r) location.assign(location.pathname);
  });

  /* ---------- drag & drop + file validation ---------- */
  document.querySelectorAll(".drop").forEach(function (d) {
    var inp = d.querySelector('input[type="file"]'); if (!inp) return;
    ["dragenter", "dragover"].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add("over"); }); });
    ["dragleave", "dragend"].forEach(function (ev) { d.addEventListener(ev, function () { d.classList.remove("over"); }); });
    d.addEventListener("drop", function (e) {
      e.preventDefault(); d.classList.remove("over");
      var fs = e.dataTransfer && e.dataTransfer.files; if (!fs || !fs.length) return;
      try {
        var dt = new DataTransfer(); for (var i = 0; i < fs.length; i++) { dt.items.add(fs[i]); if (!inp.multiple) break; }
        inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (err) { toast(L("Drag and drop is not supported here. Tap the box instead.", "यहां ड्रैग-ड्रॉप नहीं चलता। बॉक्स पर टैप करें।"), "err"); }
    });
  });
  var MB = 1048576;
  document.addEventListener("change", function (e) {
    var i = e.target; if (!i || i.type !== "file" || !i.files) return;
    var acc = (i.accept || "").toLowerCase(), img = acc.indexOf("image") > -1, pdf = acc.indexOf("pdf") > -1; if (!img && !pdf) return;
    for (var k = 0; k < i.files.length; k++) {
      var f = i.files[k], okType = img ? (f.type.indexOf("image/") === 0 || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(f.name)) : (f.type === "application/pdf" || /\.pdf$/i.test(f.name));
      var max = pdf ? 50 * MB : 30 * MB, bad = null;
      if (!okType) bad = L("Unsupported file: ", "यह फाइल सपोर्टेड नहीं है: ") + f.name;
      else if (f.size > max) bad = L("File is too large (max ", "फाइल बहुत बड़ी है (अधिकतम ") + (max / MB) + " MB): " + f.name;
      else if (f.size === 0) bad = L("File is empty: ", "फाइल खाली है: ") + f.name;
      if (bad) { e.stopImmediatePropagation(); e.stopPropagation(); i.value = ""; toast(bad, "err"); return; }
    }
  }, true);

  /* ---------- command palette ---------- */
  var pal, palIn, palList, items = [], sel = 0, lastFocus;
  function esc(s) { return D.esc(s); }
  function build() {
    pal = document.createElement("div"); pal.className = "pal-bg"; pal.setAttribute("role", "dialog"); pal.setAttribute("aria-modal", "true"); pal.setAttribute("aria-label", "Search");
    pal.innerHTML = '<div class="pal"><div class="pal-in">' + D.icon("search", 20) + '<input id="palIn" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palList"><kbd>Esc</kbd></div><div class="pal-list" id="palList" role="listbox"></div><div class="pal-foot"><span>↑↓ ' + "navigate" + '</span><span>↵ open</span><span>Esc close</span></div></div>';
    document.body.appendChild(pal); palIn = pal.querySelector("input"); palList = pal.querySelector(".pal-list");
    pal.addEventListener("mousedown", function (e) { if (e.target === pal) close(); });
    palIn.addEventListener("input", function () { sel = 0; render(); });
    palIn.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); } else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { e.preventDefault(); run(items[sel]); } else if (e.key === "Tab") e.preventDefault();
    });
    palList.addEventListener("click", function (e) { var a = e.target.closest("[data-i]"); if (a) { e.preventDefault(); run(items[+a.getAttribute("data-i")]); } });
  }
  function tools(q) {
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    var rank = function (t) { var n = (t.en + " " + t.hi + " " + t.id).toLowerCase(); return toks.every(function (x) { return n.indexOf(x) === 0 || n.indexOf(" " + x) > -1 || n.indexOf("-" + x) > -1; }) ? 0 : 1; };
    return D.TOOLS.filter(function (t) { var h = (t.en + " " + t.hi + " " + t.den + " " + t.dhi + " " + t.id + " " + D.cat(t.cat).en).toLowerCase(); return toks.every(function (x) { return h.indexOf(x) > -1; }); })
      .map(function (t, i) { return { t: t, i: i, r: rank(t) }; }).sort(function (a, b) { return a.r - b.r || a.i - b.i; }).map(function (x) { return x.t; });
  }
  function render() {
    var q = palIn.value.trim(), out = [], html = "";
    function sec(title, arr) { if (!arr.length) return; html += "<h5>" + esc(title) + "</h5>"; arr.forEach(function (it) { it.i = out.length; out.push(it); html += row(it); }); }
    function row(it) { return '<' + (it.href ? 'a href="' + it.href + '"' : "button type=\"button\"") + ' role="option" id="po' + it.i + '" data-i="' + it.i + '" class="' + (it.i === sel ? "on" : "") + '" aria-selected="' + (it.i === sel) + '">' + it.ic + "<span>" + esc(it.label) + "</span>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</" + (it.href ? "a" : "button") + ">"; }
    function T(t) { return { href: D.toolUrl(t), ic: D.icon(t.id, 20), label: t[lang], sub: D.cat(t.cat)[lang] }; }
    if (!q) {
      var fv = DTAfav.list().map(D.tool).filter(Boolean), rc = DTArecent().map(D.tool).filter(Boolean);
      sec(L("Favourites", "पसंदीदा"), fv.map(T)); sec(L("Recently used", "हाल में इस्तेमाल"), rc.slice(0, 5).map(T));
      sec(L("All tools", "सभी टूल्स"), D.TOOLS.map(T).slice(0, 8));
    } else sec(L("Tools", "टूल्स"), tools(q).slice(0, 8).map(T));
    var cats = D.CATS.filter(function (c) { return !q || (c.en + " " + c.hi).toLowerCase().indexOf(q.toLowerCase()) > -1; }).map(function (c) { return { href: D.catUrl(c), ic: D.icon(c.icon, 20), label: c[lang], sub: L("Category", "श्रेणी") }; });
    sec(L("Categories", "श्रेणियां"), q ? cats : cats.slice(0, 0));
    var acts = [
      { ic: D.icon(theme === "dark" ? "sun" : "moon", 20), label: theme === "dark" ? L("Switch to light mode", "लाइट मोड चालू करें") : L("Switch to dark mode", "डार्क मोड चालू करें"), fn: setTheme },
      { ic: D.icon("globe", 20), label: lang === "en" ? "हिंदी में बदलें" : "Switch to English", fn: setLang },
      { ic: D.icon("settings", 20), label: L("Settings", "सेटिंग्स"), href: "/settings" },
      { ic: D.icon("plus", 20), label: L("Request a tool", "नया टूल मांगें"), href: "/contact#request" }
    ].filter(function (a) { return !q || a.label.toLowerCase().indexOf(q.toLowerCase()) > -1; });
    sec(L("Actions", "एक्शन"), acts);
    if (!out.length) html = '<h5>' + esc(L("No results", "कोई नतीजा नहीं")) + '</h5><a href="/contact#request">' + D.icon("plus", 20) + "<span>" + esc(L("Request this tool", "यह टूल मांगें")) + "</span></a>";
    items = out; if (sel >= out.length) sel = 0; palList.innerHTML = html;
    var on = palList.querySelector(".on"); palIn.setAttribute("aria-activedescendant", on ? on.id : "");
  }
  function move(d) {
    if (!items.length) return; sel = (sel + d + items.length) % items.length;
    palList.querySelectorAll("[data-i]").forEach(function (n) { var on = +n.getAttribute("data-i") === sel; n.classList.toggle("on", on); n.setAttribute("aria-selected", on); if (on) { n.scrollIntoView({ block: "nearest" }); palIn.setAttribute("aria-activedescendant", n.id); } });
  }
  function run(it) { if (!it) return; close(); if (it.href) location.assign(it.href); else if (it.fn) it.fn(); }
  function open() {
    if (!pal) build(); lastFocus = document.activeElement; menu(false);
    palIn.placeholder = L("Search tools, categories, actions…", "टूल, श्रेणी, एक्शन खोजें…"); palIn.value = ""; sel = 0; render();
    pal.classList.add("open"); setTimeout(function () { palIn.focus(); }, 30); document.body.style.overflow = "hidden";
  }
  function close() { if (!pal) return; pal.classList.remove("open"); document.body.style.overflow = ""; if (lastFocus && lastFocus !== document.body && lastFocus.focus) lastFocus.focus(); if (palIn && document.activeElement === palIn) palIn.blur(); }
  window.DTApalette = open;
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-open-palette]")) { e.preventDefault(); open(); } });
  document.addEventListener("keydown", function (e) {
    var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal && pal.classList.contains("open") ? close() : open(); }
    else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
    else if (e.key === "Escape") { if (pal && pal.classList.contains("open")) close(); else menu(false); }
  });
  document.addEventListener("langchange", function () { if (pal && pal.classList.contains("open")) { palIn.placeholder = L("Search tools, categories, actions…", "टूल, श्रेणी, एक्शन खोजें…"); render(); } });
  if (/Mac|iPhone|iPad/.test(navigator.platform || "")) document.querySelectorAll(".kbd-btn kbd").forEach(function (k) { k.textContent = "⌘K"; });

  /* ---------- PWA: service worker + install ---------- */
  var deferred;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = false; }); });
  window.addEventListener("appinstalled", function () { deferred = null; document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = true; }); toast(L("DTAhub installed", "DTAhub इंस्टॉल हो गया")); });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-install]"); if (!b || !deferred) return;
    deferred.prompt(); deferred.userChoice.then(function () { deferred = null; b.hidden = true; });
  });
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });

  /* ---------- motion: scroll progress, ripple, count-up ---------- */
  var pr = document.createElement("div"); pr.className = "prog"; pr.setAttribute("aria-hidden", "true"); document.body.appendChild(pr);
  var tick = false;
  function prog() { tick = false; var h = document.documentElement.scrollHeight - innerHeight; pr.style.transform = "scaleX(" + (h > 0 ? Math.min(1, scrollY / h) : 0) + ")"; }
  addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(prog); } }, { passive: true }); prog();
  document.addEventListener("pointerdown", function (e) {
    if (motion === "off") return;
    var b = e.target.closest && e.target.closest(".btn,.chip,.icon-btn"); if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), s = document.createElement("span"), d = Math.max(r.width, r.height) * 1.6;
    s.className = "ripple"; s.style.cssText = "width:" + d + "px;height:" + d + "px;left:" + (e.clientX - r.left - d / 2) + "px;top:" + (e.clientY - r.top - d / 2) + "px";
    b.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
  }, { passive: true });
  window.DTAcount = function (el, to) {
    if (motion === "off" || !window.requestAnimationFrame) { el.textContent = to; return; }
    var t0 = performance.now(), dur = 900;
    (function f(t) { var k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
  };

  document.querySelectorAll("main").forEach(function (m) { m.classList.add("page-in"); });
  apply(); syncFavs(); DTAwatch(); menu(false);
})();

/* Accessibility: connect each <label> to the field that follows it, so screen readers announce the field name. */
(function () {
  var n = 0, CTRL = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea";
  function link(root) {
    (root || document).querySelectorAll("label:not([for])").forEach(function (lb) {
      if (lb.querySelector("input,select,textarea")) return;
      var c = null, s = lb.nextElementSibling;
      while (s && !c) { c = s.matches(CTRL) ? s : s.querySelector(CTRL); s = s.nextElementSibling; if (s && s.tagName === "LABEL") break; }
      if (!c || c.getAttribute("aria-label") || c.getAttribute("aria-labelledby")) return;
      if (!c.id) c.id = "dta-f" + (++n);
      lb.setAttribute("for", c.id);
    });
  }
  var t;
  function later() { clearTimeout(t); t = setTimeout(link, 60); }
  function start() { link(); try { new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
/* assistant launcher: loaded after the page is idle, so it never delays the first paint */
(function () {
  function go() { if (window.__dtaAst) return; var s = document.createElement("script"); s.src = "/js/assistant.js"; s.defer = true; document.head.appendChild(s); }
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(go, { timeout: 3000 });
})();

/* Quietly finish the offline copy of every tool on a good connection (only missing files are fetched). The Settings page can also do this on request. */
(function () {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  var c = navigator.connection;
  if (!c || c.saveData || c.effectiveType !== "4g") return;
  setTimeout(function () {
    navigator.serviceWorker.ready.then(function (r) {
      if (!r.active) return;
      r.active.postMessage({ type: "warm" });
    }).catch(function () {});
  }, 12000);
})();

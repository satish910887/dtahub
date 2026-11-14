/* DTAhub shared shell: language, theme, toasts, favourites, recents, command palette,
   drag & drop, file validation, share, install prompt, offline. Loaded on every page. */
(function () {
  var D = window.DTA, root = document.documentElement;
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function getList(k) { try { var a = JSON.parse(localStorage.getItem(k)); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  var lang = get("lang", "en") === "hi" ? "hi" : "en", theme = get("theme", "dark") === "light" ? "light" : "dark", motion = get("motion", "on") === "off" ? "off" : "on";

  window.L = function (en, hi) { return lang === "hi" ? hi : en; };
  window.fmt = function (n) { return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 }); };
  window.$ = function (i) { return document.getElementById(i); };
  window.DTAlang = function () { return lang; };
  window.DTAstore = { get: get, put: put, list: getList };

  /* ---------- toast ---------- */
  window.toast = function (msg, type) {
    var c = document.querySelector(".toasts");
    if (!c) { c = document.createElement("div"); c.className = "toasts"; c.setAttribute("aria-live", "polite"); document.body.appendChild(c); }
    var t = document.createElement("div"); t.className = "toast " + (type || "ok");
    t.innerHTML = D.icon(type === "err" ? "close" : "shield", 18) + "<span></span>";
    t.lastChild.textContent = msg; c.appendChild(t);
    while (c.children.length > 3) c.removeChild(c.firstChild);
    setTimeout(function () { t.classList.add("out"); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260); }, 2600);
  };

  window.copyText = function (text, btn) {
    function done() {
      toast(L("Copied to clipboard", "कॉपी हो गया"));
      if (btn) { var o = btn.textContent; btn.textContent = L("Copied ✓", "कॉपी हो गया ✓"); setTimeout(function () { btn.textContent = o; }, 1400); }
    }
    function fb() { var a = document.createElement("textarea"); a.value = text; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); var ok = false; try { ok = document.execCommand("copy"); } catch (e) {} document.body.removeChild(a); if (ok) done(); else toast(L("Could not copy. Select the text and copy manually.", "कॉपी नहीं हुआ। टेक्स्ट चुनकर खुद कॉपी करें।"), "err"); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
  };

  /* ---------- scroll reveal + card spotlight ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08 }) : null;
  window.DTAwatch = function () { document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); }); };
  if (window.matchMedia && matchMedia("(hover:hover)").matches) {
    document.addEventListener("pointermove", function (e) {
      var c = e.target.closest && e.target.closest(".card"); if (!c) return;
      var r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px");
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

  /* ---------- apply language / theme ---------- */
  function apply() {
    root.lang = lang; root.setAttribute("data-theme", theme); root.setAttribute("data-motion", motion);
    document.querySelectorAll("[data-en]").forEach(function (el) { var v = el.getAttribute("data-" + lang); if (v !== null) el.textContent = v; });
    document.querySelectorAll("[data-ph-en]").forEach(function (el) { el.placeholder = el.getAttribute("data-ph-" + lang); });
    document.querySelectorAll("[data-label-en]").forEach(function (el) { el.setAttribute("aria-label", el.getAttribute("data-label-" + lang)); });
    var lb = $("langBtn"), tb = $("themeBtn");
    if (lb) lb.textContent = lang === "en" ? "हि" : "EN";
    if (tb) tb.innerHTML = D.icon(theme === "dark" ? "sun" : "moon", 19);
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute("content", theme === "dark" ? "#08080d" : "#f7f6fb");
    document.dispatchEvent(new Event("langchange"));
  }
  window.DTAapply = apply;
  function setLang() { lang = lang === "en" ? "hi" : "en"; put("lang", lang); apply(); }
  function setTheme() { theme = theme === "dark" ? "light" : "dark"; put("theme", theme); apply(); }
  window.DTAsettings = {
    setLang: function (l) { lang = l === "hi" ? "hi" : "en"; put("lang", lang); apply(); },
    setTheme: function (t) { theme = t === "light" ? "light" : "dark"; put("theme", theme); apply(); },
    setMotion: function (m) { motion = m === "off" ? "off" : "on"; put("motion", motion); apply(); },
    get: function () { return { lang: lang, theme: theme, motion: motion }; }
  };
  var lb = $("langBtn"), tb = $("themeBtn"); if (lb) lb.onclick = setLang; if (tb) tb.onclick = setTheme;

  /* ---------- mobile nav ---------- */
  var mb = $("menuBtn"), mn = $("mnav");
  function menu(open) { if (!mb || !mn) return; mn.classList.toggle("open", open); mb.setAttribute("aria-expanded", open ? "true" : "false"); mb.innerHTML = D.icon(open ? "close" : "menu", 20); }
  if (mb) { mb.onclick = function () { menu(!mn.classList.contains("open")); }; mn.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); }); }
  document.querySelectorAll(".links a, .mnav a").forEach(function (a) {
    var h = a.getAttribute("href"); if (h && h.charAt(0) === "/" && h.indexOf("#") < 0 && h !== "/" && location.pathname.indexOf(h) === 0) a.setAttribute("aria-current", "page");
  });

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
      { ic: D.icon("settings", 20), label: L("Settings", "सेटिंग्स"), href: "/settings.html" },
      { ic: D.icon("plus", 20), label: L("Request a tool", "नया टूल मांगें"), href: "/contact.html#request" }
    ].filter(function (a) { return !q || a.label.toLowerCase().indexOf(q.toLowerCase()) > -1; });
    sec(L("Actions", "एक्शन"), acts);
    if (!out.length) html = '<h5>' + esc(L("No results", "कोई नतीजा नहीं")) + '</h5><a href="/contact.html#request">' + D.icon("plus", 20) + "<span>" + esc(L("Request this tool", "यह टूल मांगें")) + "</span></a>";
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
  function close() { if (!pal) return; pal.classList.remove("open"); document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
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

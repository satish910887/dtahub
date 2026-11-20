/* DTAhub Assistant: launcher and chat window. The engine (assistant-engine.js) loads only when the chat is first opened. */
(function () {
  "use strict";
  if (window.__dtaAst || !document.body) return; window.__dtaAst = 1;
  var KEY = "dta_ast_v1", MAX = 40, D = window.DTA, engineReady = false, loading = null, open = false, st = { msgs: [], mem: null }, el = {}, fab;
  function L2(en, hi) { return typeof window.L === "function" ? window.L(en, hi) : en; }
  function lang() { return typeof window.DTAlang === "function" ? window.DTAlang() : "en"; }
  function mk(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function load(src) { return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function ensure() {
    if (engineReady) return Promise.resolve();
    if (loading) return loading;
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "/css/assistant.css"; document.head.appendChild(css);
    loading = load("/js/kb-blog.js").then(function () { return load("/js/assistant-engine.js"); }).then(function () { engineReady = !!window.DTAAssist; });
    return loading;
  }
  try { var sv = JSON.parse(localStorage.getItem(KEY) || "null"); if (sv && Array.isArray(sv.msgs)) st = { msgs: sv.msgs.slice(-MAX), mem: sv.mem || null }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ msgs: st.msgs.slice(-MAX), mem: st.mem })); } catch (e) {} }

  /* ---------- launcher ---------- */
  fab = mk("button", "ast-fab"); fab.type = "button"; fab.id = "astFab";
  fab.setAttribute("aria-haspopup", "dialog"); fab.setAttribute("aria-expanded", "false"); fab.setAttribute("aria-controls", "astPanel");
  fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2l2.1 5.6 5.6 2.1-5.6 2.1L12 17.6l-2.1-5.6L4.3 9.9l5.6-2.1z"/><path fill="currentColor" opacity=".8" d="M19 14l.9 2.4 2.4.9-2.4.9L19 20.6l-.9-2.4-2.4-.9 2.4-.9z"/></svg><span class="ast-fl"></span>';
  function fabLabel() { var t = L2("Ask", "पूछें"); fab.querySelector(".ast-fl").textContent = t; fab.setAttribute("aria-label", L2("Ask the DTAhub Assistant", "DTAhub असिस्टेंट से पूछें")); }
  fabLabel(); document.addEventListener("langchange", function () { fabLabel(); if (open) paintStatic(); });
  fab.addEventListener("click", function () { open ? close() : openPanel(); });
  document.body.appendChild(fab);

  /* ---------- panel ---------- */
  function build() {
    if (el.panel) return;
    var p = mk("section", "ast-panel"); p.id = "astPanel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "false"); p.hidden = true;
    var h = mk("header", "ast-h"), ti = mk("div", "ast-t"); ti.appendChild(mk("b", "", "DTAhub Assistant")); el.sub = mk("small"); ti.appendChild(el.sub);
    var cl = mk("button", "ast-ib"); cl.type = "button"; cl.id = "astClear"; cl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
    var x = mk("button", "ast-ib"); x.type = "button"; x.id = "astClose"; x.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    h.appendChild(ti); h.appendChild(cl); h.appendChild(x);
    el.log = mk("div", "ast-log"); el.log.setAttribute("role", "log"); el.log.setAttribute("aria-live", "polite"); el.log.tabIndex = 0;
    var f = mk("form", "ast-f"); el.in = mk("textarea"); el.in.rows = 1; el.in.maxLength = 300; el.in.id = "astIn"; el.in.setAttribute("autocomplete", "off"); el.in.spellcheck = false;
    el.send = mk("button", "ast-send"); el.send.type = "submit"; el.send.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    f.appendChild(el.in); f.appendChild(el.send);
    el.note = mk("p", "ast-n");
    p.appendChild(h); p.appendChild(el.log); p.appendChild(f); p.appendChild(el.note);
    var scrim = mk("div", "ast-scrim"); scrim.hidden = true; el.scrim = scrim;
    document.body.appendChild(scrim); document.body.appendChild(p); el.panel = p; el.clr = cl; el.x = x;
    x.addEventListener("click", close); scrim.addEventListener("click", close);
    cl.addEventListener("click", clearChat);
    f.addEventListener("submit", function (e) { e.preventDefault(); var v = el.in.value.trim(); if (v) { el.in.value = ""; grow(); ask(v); } });
    el.in.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true })); } });
    el.in.addEventListener("input", grow);
    p.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } });
    paintStatic();
  }
  function grow() { el.in.style.height = "auto"; el.in.style.height = Math.min(110, el.in.scrollHeight) + "px"; }
  function paintStatic() {
    el.panel.setAttribute("aria-label", L2("DTAhub Assistant", "DTAhub असिस्टेंट"));
    el.sub.textContent = L2("Works on your device. Nothing you type is sent anywhere.", "आपके डिवाइस पर चलता है। आप जो लिखते हैं वह कहीं नहीं भेजा जाता।");
    el.clr.setAttribute("aria-label", L2("Clear chat", "चैट साफ करें")); el.clr.title = el.clr.getAttribute("aria-label");
    el.x.setAttribute("aria-label", L2("Close", "बंद करें")); el.x.title = el.x.getAttribute("aria-label");
    el.in.placeholder = L2("Ask: reduce photo size, EMI 5 lakh 9% 5 years...", "पूछें: फोटो का साइज़ कम, 5 लाख EMI 9% 5 साल...");
    el.in.setAttribute("aria-label", L2("Type your question", "अपना सवाल लिखें"));
    el.send.setAttribute("aria-label", L2("Send", "भेजें"));
    el.note.textContent = L2("A built-in helper, not a chat AI. It may miss things, so check important numbers.", "यह बिल्ट-इन हेल्पर है, चैट AI नहीं। कुछ चूक सकता है, इसलिए ज़रूरी आंकड़े जांच लें।");
  }
  function pageTool() { var m = /^\/tools\/([a-z0-9-]+)/.exec(location.pathname); return m ? m[1] : ""; }

  /* ---------- rendering ---------- */
  function toolCard(id, small) {
    var t = D && D.tool ? D.tool(id) : null; if (!t) return null;
    var a = mk("a", "ast-tool"); a.href = D.toolUrl(t);
    var ic = mk("span", "ast-ti"); ic.innerHTML = D.icon(t.id, 20); a.appendChild(ic);
    var tx = mk("span", "ast-tx"); tx.appendChild(mk("b", "", lang() === "hi" ? t.hi : t.en)); tx.appendChild(mk("small", "", small ? L2("Open the full tool", "पूरा टूल खोलें") : (lang() === "hi" ? t.dhi : t.den))); a.appendChild(tx);
    var ar = mk("span", "ast-ar", "›"); ar.setAttribute("aria-hidden", "true"); a.appendChild(ar); return a;
  }
  function renderBlocks(box, blocks) {
    blocks.forEach(function (b) {
      if (b.t === "p") { if (b.text) box.appendChild(mk("p", "", b.text)); }
      else if (b.t === "list") { var u = mk("ul"); b.items.forEach(function (i) { u.appendChild(mk("li", "", i)); }); box.appendChild(u); }
      else if (b.t === "steps") { var o = mk("ol"); b.items.forEach(function (i) { o.appendChild(mk("li", "", i)); }); box.appendChild(o); }
      else if (b.t === "tools") { var w = mk("div", "ast-tools"); b.ids.forEach(function (id) { var c = toolCard(id, b.small); if (c) w.appendChild(c); }); box.appendChild(w); }
      else if (b.t === "calc") {
        var c = mk("div", "ast-calc"); c.appendChild(mk("b", "ast-ct", b.title)); if (b.big) c.appendChild(mk("div", "ast-big", b.big));
        if (b.rows && b.rows.length) { var tb = mk("dl", "ast-rows"); b.rows.forEach(function (r) { tb.appendChild(mk("dt", "", r[0])); tb.appendChild(mk("dd", "", r[1])); }); c.appendChild(tb); }
        if (b.note) c.appendChild(mk("small", "ast-cn", b.note)); box.appendChild(c);
      }
      else if (b.t === "links") { var l = mk("div", "ast-links"); b.items.forEach(function (i) { if (/^\/[^/]/.test(i.href) || i.href === "/") { var a = mk("a", "ast-link", i.label); a.href = i.href; l.appendChild(a); } }); box.appendChild(l); }
    });
  }
  function addMsg(m, animate) {
    var row = mk("div", "ast-m " + (m.r === "u" ? "ast-u" : "ast-a")); if (!animate) row.classList.add("ast-static");
    var bub = mk("div", "ast-b");
    if (m.r === "u") bub.textContent = m.text; else renderBlocks(bub, m.blocks || []);
    row.appendChild(bub);
    if (m.r === "a" && m.chips && m.chips.length) {
      var cs = mk("div", "ast-chips"); m.chips.forEach(function (c) { var b = mk("button", "ast-chip", c); b.type = "button"; b.addEventListener("click", function () { ask(c); }); cs.appendChild(b); }); row.appendChild(cs);
    }
    el.log.appendChild(row); return row;
  }
  function scrollEnd(row) { if (row && row.previousElementSibling && row.classList.contains("ast-a")) { el.log.scrollTop = row.offsetTop - 8; } else el.log.scrollTop = el.log.scrollHeight; }
  function repaintChips() { var chipRows = el.log.querySelectorAll(".ast-chips"); for (var i = 0; i < chipRows.length - 1; i++) chipRows[i].remove(); }

  /* ---------- logic ---------- */
  function runActs(blocks) {
    blocks.forEach(function (b) {
      if (b.t !== "act") return;
      if (b.act === "theme") { var cur = document.documentElement.getAttribute("data-theme") || "light"; if (cur !== b.v) { var tb = document.getElementById("themeBtn"); tb && tb.click(); } }
      else if (b.act === "lang") { if (lang() !== b.v) { var lb = document.getElementById("langBtn"); lb && lb.click(); } }
      else if (b.act === "clear") { clearChat(true); }
      else if (b.act === "nav" && /^\/[a-z0-9/_#?=.-]*$/i.test(b.v)) { setTimeout(function () { location.href = b.v; }, 450); }
    });
  }
  function ask(text) {
    ensure().then(function () {
      var um = { r: "u", text: text }; st.msgs.push(um); addMsg(um, true);
      var res;
      try { res = window.DTAAssist.reply(text, { mem: st.mem, page: pageTool(), siteLang: lang(), now: new Date() }); }
      catch (e) { res = { blocks: [{ t: "p", text: L2("Sorry, something went wrong on my side. Please try again.", "माफ़ कीजिए, मुझसे कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।") }], chips: [], mem: null }; }
      if (res.mem !== null) st.mem = res.mem;
      var am = { r: "a", blocks: res.blocks.filter(function (b) { return b.t !== "act"; }), chips: res.chips || [] }; st.msgs.push(am); repaintChips();
      var row = addMsg(am, true); scrollEnd(row); save(); runActs(res.blocks);
    }).catch(function () { var row = addMsg({ r: "a", blocks: [{ t: "p", text: L2("Could not load the assistant. Check your internet once and try again.", "असिस्टेंट लोड नहीं हो सका। एक बार इंटरनेट जांचकर दोबारा कोशिश करें।") }] }, true); scrollEnd(row); });
  }
  function clearChat(silent) {
    st = { msgs: [], mem: null }; save(); el.log.textContent = ""; if (silent !== true) welcome(); else welcome();
  }
  function welcome() {
    var res = window.DTAAssist.reply("hello", { siteLang: lang(), page: pageTool() }), blocks = res.blocks.slice(), chips = res.chips.slice();
    var pt = pageTool(), t = pt && D.tool(pt); if (t) chips.unshift(L2("How do I use " + t.en + "?", t.hi + " कैसे चलाएं?"));
    var m = { r: "a", blocks: blocks, chips: chips }; st.msgs = [m]; addMsg(m, false); save();
  }
  function openPanel() {
    ensure().then(function () {
      build(); el.panel.hidden = false; el.scrim.hidden = false; open = true; fab.setAttribute("aria-expanded", "true"); document.documentElement.classList.add("ast-open");
      if (!el.log.childNodes.length) { if (st.msgs.length) { st.msgs.forEach(function (m) { addMsg(m, false); }); repaintChips(); } else welcome(); }
      requestAnimationFrame(function () { el.panel.classList.add("on"); el.scrim.classList.add("on"); el.log.scrollTop = el.log.scrollHeight; if (!matchMedia("(pointer:coarse)").matches) el.in.focus(); });
    }).catch(function () { if (window.toast) window.toast(L2("Could not load the assistant.", "असिस्टेंट लोड नहीं हो सका।"), "err"); });
  }
  function close() {
    if (!el.panel) return; el.panel.classList.remove("on"); el.scrim.classList.remove("on"); open = false; fab.setAttribute("aria-expanded", "false"); document.documentElement.classList.remove("ast-open");
    setTimeout(function () { if (!open) { el.panel.hidden = true; el.scrim.hidden = true; } }, 220); fab.focus();
  }
  document.addEventListener("keydown", function (e) { if ((e.key === "/" && (e.ctrlKey || e.metaKey)) || (e.key.toLowerCase() === "k" && e.shiftKey && (e.ctrlKey || e.metaKey))) { e.preventDefault(); open ? close() : openPanel(); } });
  /* warm the engine when the browser is idle, so the first answer is instant */
  (window.requestIdleCallback || function (f) { setTimeout(f, 3500); })(function () { if (navigator.connection && navigator.connection.saveData) return; ensure().catch(function () {}); }, { timeout: 6000 });
})();

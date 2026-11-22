/* DTAhub homepage: renders everything from the central registry (tools-data.js). */
(function () {
  var D = window.DTA, first = true, cat = "all", q = "", sort = "featured";
  var DAY = 864e5;
  function $$(id) { return document.getElementById(id); }
  function isNew(t) { return t.added > D.LAUNCH && Date.now() - Date.parse(t.added) < 45 * DAY; }
  function cards(list) { return list.map(function (t) { return D.cardHTML(t, isNew(t)); }).join(""); }
  function done() { DTAapply(); DTAsync(); DTAwatch(); }

  function stats() {
    var n = D.TOOLS.length, c = D.CATS.length;
    $$("stats").innerHTML =
      '<span>' + D.icon("bolt", 16) + '<b data-count="' + n + '">' + n + '</b> <span data-en="free tools" data-hi="मुफ्त टूल्स">free tools</span></span>' +
      '<span>' + D.icon("globe", 16) + '<b data-count="' + c + '">' + c + '</b> <span data-en="categories" data-hi="श्रेणियां">categories</span></span>' +
      '<span>' + D.icon("shield", 16) + '<span data-en="Files stay on your device" data-hi="फाइलें आपके डिवाइस पर रहती हैं">Files stay on your device</span></span>' +
      '<span>' + D.icon("gift", 16) + '<span data-en="No sign-up" data-hi="बिना साइन-अप">No sign-up</span></span>';
  }
  function visuals() {
    document.querySelectorAll("[data-count]").forEach(function (b) { DTAcount(b, +b.getAttribute("data-count")); });
    var pids = ["pdf-merge", "image-compress", "qr-code", "resume-maker"];
    $$("pop").innerHTML = pids.map(function (id) { var t = D.tool(id); return t ? '<a class="pchip" href="' + D.toolUrl(t) + '"><span data-en="' + D.esc(t.en) + '" data-hi="' + D.esc(t.hi) + '">' + D.esc(t.en) + "</span></a>" : ""; }).join("");
    var pill = function (t, hid) { var c = D.cat(t.cat); return '<a class="pill" style="--h:' + c.hue + '" href="' + D.toolUrl(t) + '"' + (hid ? ' tabindex="-1" aria-hidden="true"' : "") + ">" + D.icon(t.id, 18) + '<span data-en="' + D.esc(t.en) + '" data-hi="' + D.esc(t.hi) + '">' + D.esc(t.en) + "</span></a>"; };
    $$("marq").innerHTML = D.TOOLS.map(function (t) { return pill(t, false); }).join("") + D.TOOLS.map(function (t) { return pill(t, true); }).join("");
  }
  function renderCats() { $$("catGrid").innerHTML = D.CATS.map(D.catCardHTML).join(""); }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function renderNew() {
    var l = D.TOOLS.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return Date.parse(b.t.added) - Date.parse(a.t.added) || b.i - a.i; }).slice(0, 6).map(function (x) { return x.t; });
    $$("newList").innerHTML = l.map(function (t) {
      var c = D.cat(t.cat), d = new Date(t.added), e = D.esc;
      return '<li style="--h:' + (c.hue || 45) + '"><a href="' + D.toolUrl(t) + '"><span class="ico">' + D.icon(t.id, 20) + '</span><span class="rn"><b data-en="' + e(t.en) + '" data-hi="' + e(t.hi) + '">' + e(t.en) + '</b><small data-en="' + e(t.den) + '" data-hi="' + e(t.dhi) + '">' + e(t.den) + '</small></span><time datetime="' + t.added + '">' + d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear() + "</time></a></li>";
    }).join("");
  }
  function renderMine() {
    var fv = DTAfav.list().map(D.tool).filter(Boolean), rc = DTArecent().map(D.tool).filter(Boolean).slice(0, 6);
    $$("recSec").hidden = !rc.length;
    $$("favSec").hidden = !fv.length;
    $$("favGrid").className = fv.length ? "grid sm" : "";
    $$("favGrid").innerHTML = fv.length ? cards(fv) : '<div class="empty-sm"><svg class="st" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m32 8 7.500 15.200 16.800 2.400-12.200 11.900 2.900 16.700L32 46.200 17 54.200l2.900-16.700L7.700 25.600l16.800-2.400z"/><path d="M32 22v14M25 29h14" stroke="#8b6cf6"/></svg><div><b data-en="No favourites yet" data-hi="अभी कोई पसंदीदा नहीं">No favourites yet</b><span data-en="Tap the star on any tool to keep it here." data-hi="किसी भी टूल का स्टार दबाएं, वो यहां रहेगा।">Tap the star on any tool to keep it here.</span></div></div>';
    $$("recGrid").innerHTML = cards(rc);
  }
  function renderChips() {
    var all = [{ id: "all", icon: "", en: "All", hi: "सभी" }].concat(D.CATS);
    $$("chips").innerHTML = all.map(function (c) {
      return '<button type="button" class="chip' + (c.id === cat ? " on" : "") + '" data-id="' + c.id + '" aria-pressed="' + (c.id === cat) + '">' + (c.icon ? D.icon(c.icon, 16) : "") + '<span data-en="' + D.esc(c.en) + '" data-hi="' + D.esc(c.hi) + '">' + D.esc(c.en) + "</span></button>";
    }).join("");
    inkMove();
  }
  var ink = document.createElement("i"); ink.className = "chip-ink"; ink.setAttribute("aria-hidden", "true");
  function inkMove() {
    var box = $$("chips"), on = box.querySelector(".chip.on"); box.classList.add("ink"); box.appendChild(ink);
    if (!on) return;
    requestAnimationFrame(function () { ink.style.width = on.offsetWidth + "px"; ink.style.transform = "translateX(" + on.offsetLeft + "px)"; ink.style.opacity = "1"; });
  }
  window.addEventListener("resize", function () { inkMove(); }, { passive: true });
  function match(t, s) { if (!s) return true; var toks = s.split(/\s+/).filter(Boolean), h = (t.en + " " + t.hi + " " + t.den + " " + t.dhi + " " + t.id + " " + D.cat(t.cat).en).toLowerCase(); return toks.every(function (x) { return h.indexOf(x) > -1; }); }
  function list() {
    var s = q.trim().toLowerCase(), l = D.TOOLS.filter(function (t) { return (cat === "all" || t.cat === cat) && match(t, s); });
    if (sort === "az") l.sort(function (a, b) { return a.en.localeCompare(b.en); });
    else if (sort === "new") l = l.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return Date.parse(b.t.added) - Date.parse(a.t.added) || b.i - a.i; }).map(function (x) { return x.t; });
    else l = l.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return (b.t.featured ? 1 : 0) - (a.t.featured ? 1 : 0) || a.i - b.i; }).map(function (x) { return x.t; });
    return l;
  }
  function renderGrid() {
    var l = list(); $$("grid").innerHTML = cards(l); $$("empty").hidden = l.length > 0; $$("grid").hidden = !l.length;
    $$("count").textContent = l.length + " / " + D.TOOLS.length;
    if (window.DTAstagger) DTAstagger();
    var g = $$("grid"); if (first) first = false; else { g.classList.remove("sweep"); void g.offsetWidth; g.classList.add("sweep"); }
    done();
  }

  /* suggestions under the hero search box */
  var sug = $$("sug"), si = $$("search"), act = -1, sugItems = [];
  function suggest() {
    var v = si.value.trim().toLowerCase();
    if (!v) { sug.hidden = true; si.setAttribute("aria-expanded", "false"); sugItems = []; return; }
    sugItems = D.TOOLS.filter(function (t) { return match(t, v); }).sort(function (a, b) { var f = function (t) { var n = (t.en + " " + t.id).toLowerCase(); return n.indexOf(v) === 0 || n.indexOf(" " + v) > -1 || n.indexOf("-" + v) > -1 ? 0 : 1; }; return f(a) - f(b); }).slice(0, 5); act = sugItems.length ? 0 : -1;
    sug.innerHTML = sugItems.length ? sugItems.map(function (t, i) {
      return '<a role="option" id="sg' + i + '" class="' + (i === act ? "on" : "") + '" href="' + D.toolUrl(t) + '">' + D.icon(t.id, 20) + "<span>" + D.esc(t[DTAlang()]) + "</span><small>" + D.esc(D.cat(t.cat)[DTAlang()]) + "</small></a>";
    }).join("") : '<a href="/contact#request">' + D.icon("plus", 20) + "<span>" + D.esc(L("No tool found. Request it?", "टूल नहीं मिला। मांगें?")) + "</span></a>";
    sug.hidden = false; si.setAttribute("aria-expanded", "true");
  }
  $$("sbtn").addEventListener("click", function () { sug.hidden = true; document.getElementById("tools").scrollIntoView(); });
  si.addEventListener("input", function () { q = si.value; suggest(); renderGrid(); });
  si.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!sugItems.length) return; e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + sugItems.length) % sugItems.length;
      sug.querySelectorAll("a").forEach(function (a, i) { a.classList.toggle("on", i === act); });
    } else if (e.key === "Enter") { if (sugItems[act]) location.assign(D.toolUrl(sugItems[act])); else document.getElementById("tools").scrollIntoView(); }
    else if (e.key === "Escape") { si.value = ""; q = ""; suggest(); renderGrid(); }
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search")) sug.hidden = true; });
  si.addEventListener("focus", function () { if (si.value) suggest(); });

  $$("chips").addEventListener("click", function (e) { var b = e.target.closest(".chip"); if (!b) return; cat = b.getAttribute("data-id"); renderChips(); renderGrid(); });
  $$("sort").addEventListener("change", function () { sort = this.value; renderGrid(); });
  $$("reset").addEventListener("click", function () { cat = "all"; q = ""; si.value = ""; sort = "featured"; $$("sort").value = "featured"; sug.hidden = true; renderChips(); renderGrid(); });
  document.addEventListener("favchange", function () { renderMine(); done(); });
  document.addEventListener("langchange", function () { if (sugItems.length || si.value) suggest(); });

  stats(); visuals(); renderCats(); renderNew(); renderMine(); renderChips(); renderGrid();
  if (location.hash === "#tools" || location.hash === "#categories") setTimeout(function () { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }, 50);
})();

/* DTAhub homepage: renders everything from the central registry (tools-data.js). */
(function () {
  var D = window.DTA, cat = "all", q = "", sort = "featured";
  var DAY = 864e5;
  function $$(id) { return document.getElementById(id); }
  function isNew(t) { return Date.now() - Date.parse(t.added) < 45 * DAY; }
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
    var pos = [["3%", "14%"], ["90%", "8%"], ["0%", "52%"], ["93%", "56%"], ["9%", "86%"], ["84%", "88%"]];
    var ids = ["resume-maker", "qr-code", "emi", "image-compress", "pdf-merge", "typing-helper"];
    $$("orbs").innerHTML = ids.map(function (id, i) {
      var t = D.tool(id), c = D.cat(t.cat);
      return '<span class="orb" style="--h:' + c.hue + ';left:' + pos[i][0] + ';top:' + pos[i][1] + ';animation-delay:-' + (i * 1.3) + 's">' + D.icon(id, 24) + "</span>";
    }).join("");
    var pill = function (t, hid) { var c = D.cat(t.cat); return '<a class="pill" style="--h:' + c.hue + '" href="' + D.toolUrl(t) + '"' + (hid ? ' tabindex="-1" aria-hidden="true"' : "") + ">" + D.icon(t.id, 18) + '<span data-en="' + D.esc(t.en) + '" data-hi="' + D.esc(t.hi) + '">' + D.esc(t.en) + "</span></a>"; };
    $$("marq").innerHTML = D.TOOLS.map(function (t) { return pill(t, false); }).join("") + D.TOOLS.map(function (t) { return pill(t, true); }).join("");
  }
  function renderCats() { $$("catGrid").innerHTML = D.CATS.map(D.catCardHTML).join(""); }
  function renderTop() { $$("topGrid").innerHTML = cards(D.TOOLS.filter(function (t) { return t.featured; })); }
  function renderNew() {
    var l = D.TOOLS.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) { return Date.parse(b.t.added) - Date.parse(a.t.added) || b.i - a.i; }).slice(0, 6).map(function (x) { return x.t; });
    $$("newGrid").innerHTML = cards(l);
  }
  function renderMine() {
    var fv = DTAfav.list().map(D.tool).filter(Boolean), rc = DTArecent().map(D.tool).filter(Boolean).slice(0, 6);
    $$("favSec").hidden = !fv.length; $$("recSec").hidden = !rc.length;
    $$("favGrid").innerHTML = cards(fv); $$("recGrid").innerHTML = cards(rc);
  }
  function renderChips() {
    var all = [{ id: "all", icon: "", en: "All", hi: "सभी" }].concat(D.CATS);
    $$("chips").innerHTML = all.map(function (c) {
      return '<button type="button" class="chip' + (c.id === cat ? " on" : "") + '" data-id="' + c.id + '" aria-pressed="' + (c.id === cat) + '">' + (c.icon ? D.icon(c.icon, 16) : "") + '<span data-en="' + D.esc(c.en) + '" data-hi="' + D.esc(c.hi) + '">' + D.esc(c.en) + "</span></button>";
    }).join("");
  }
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
    $$("count").textContent = l.length + " / " + D.TOOLS.length; done();
  }

  /* suggestions under the hero search box */
  var sug = $$("sug"), si = $$("search"), act = -1, sugItems = [];
  function suggest() {
    var v = si.value.trim().toLowerCase();
    if (!v) { sug.hidden = true; si.setAttribute("aria-expanded", "false"); sugItems = []; return; }
    sugItems = D.TOOLS.filter(function (t) { return match(t, v); }).sort(function (a, b) { var f = function (t) { var n = (t.en + " " + t.id).toLowerCase(); return n.indexOf(v) === 0 || n.indexOf(" " + v) > -1 || n.indexOf("-" + v) > -1 ? 0 : 1; }; return f(a) - f(b); }).slice(0, 5); act = sugItems.length ? 0 : -1;
    sug.innerHTML = sugItems.length ? sugItems.map(function (t, i) {
      return '<a role="option" id="sg' + i + '" class="' + (i === act ? "on" : "") + '" href="' + D.toolUrl(t) + '">' + D.icon(t.id, 20) + "<span>" + D.esc(t[DTAlang()]) + "</span><small>" + D.esc(D.cat(t.cat)[DTAlang()]) + "</small></a>";
    }).join("") : '<a href="/contact.html#request">' + D.icon("plus", 20) + "<span>" + D.esc(L("No tool found. Request it?", "टूल नहीं मिला। मांगें?")) + "</span></a>";
    sug.hidden = false; si.setAttribute("aria-expanded", "true");
  }
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

  stats(); visuals(); renderCats(); renderTop(); renderNew(); renderMine(); renderChips(); renderGrid();
  if (location.hash === "#tools" || location.hash === "#categories") setTimeout(function () { var el = document.querySelector(location.hash); if (el) el.scrollIntoView(); }, 50);
})();

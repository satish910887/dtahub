(function () {
  var g = document.getElementById("tiGrid"), q = document.getElementById("tiQ"), s = document.getElementById("tiSort"),
    em = document.getElementById("tiEmpty"), ct = document.getElementById("tiCount"), chips = document.getElementById("tiChips");
  if (!g) return;
  var D = window.DTA, cards = [].slice.call(g.children), cat = "all";
  var added = {}; D.TOOLS.forEach(function (t, i) { added[t.id] = { a: t.added || "", i: i }; });
  function title(c) { return c.querySelector("h3").textContent; }
  function run() {
    var v = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean), a = cards.slice(), n = 0;
    if (s.value === "az") a.sort(function (x, y) { return title(x).localeCompare(title(y)); });
    else if (s.value === "new") a.sort(function (x, y) { var p = added[x.getAttribute("data-id")], r = added[y.getAttribute("data-id")]; return r.a < p.a ? -1 : r.a > p.a ? 1 : p.i - r.i; });
    else a.sort(function (x, y) { return added[x.getAttribute("data-id")].i - added[y.getAttribute("data-id")].i; });
    a.forEach(function (c) {
      var h = c.getAttribute("data-q"), ok = (cat === "all" || c.getAttribute("data-cat") === cat) && v.every(function (t) { return h.indexOf(t) > -1; });
      c.hidden = !ok; if (ok) n++; g.appendChild(c);
    });
    em.hidden = n > 0;
    var en = n + " / " + cards.length + " tools", hi = n + " / " + cards.length + " टूल्स";
    ct.setAttribute("data-en", en); ct.setAttribute("data-hi", hi);
    ct.textContent = document.documentElement.lang === "hi" ? hi : en;
  }
  function pick(id) {
    cat = id;
    [].forEach.call(chips.children, function (b) { var on = b.getAttribute("data-cat") === id; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    run();
  }
  chips.addEventListener("click", function (e) { var b = e.target.closest("button[data-cat]"); if (b) pick(b.getAttribute("data-cat")); });
  q.addEventListener("input", run); s.addEventListener("change", run);
  window.addEventListener("langchange", run);
  var m = /[?&]q=([^&]*)/.exec(location.search), c = /[?&]cat=([^&]*)/.exec(location.search);
  try { if (m) q.value = decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) {}
  var cid = c && decodeURIComponent(c[1]);
  if (cid && D.CATS.some(function (x) { return x.id === cid; })) pick(cid); else run();
})();

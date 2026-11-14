/* Small helpers shared by the Invoice Maker and Cover Letter Maker. */
(function () {
  "use strict";
  var g = function (id) { return document.getElementById(id); };
  window.Doc = {
    esc: function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); },
    str: function (v, max) { return typeof v === "string" ? v.slice(0, max || 300) : ""; },
    today: function () { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); },
    pretty: function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return iso || ""; return +m[3] + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1] + " " + m[1]; },
    /* scale the 794px-wide paper to the width of its box */
    fit: function () {
      var st = g("dpStage"), sc = Math.min(1, (st.clientWidth - 20) / 794); if (st.clientWidth < 80) return 1;
      g("dpScale").style.transform = "scale(" + sc + ")";
      g("dpFit").style.width = 794 * sc + "px"; g("dpFit").style.height = g("dpPaper").offsetHeight * sc + "px";
      return Math.max(1, Math.ceil((g("dpPaper").offsetHeight - 2) / 1123));
    },
    print: function (title) {
      var old = document.title; document.title = title;
      toast(L("Choose “Save as PDF” in the print window", "प्रिंट विंडो में “Save as PDF” चुनें"));
      setTimeout(function () { window.print(); setTimeout(function () { document.title = old; }, 1500); }, 250);
    },
    watch: function (fn) { if (window.ResizeObserver) new ResizeObserver(fn).observe(g("dpStage")); else addEventListener("resize", fn); },
    sure: function (btn, label, fn) {
      if (btn.getAttribute("data-sure") === "1") { btn.removeAttribute("data-sure"); DTAapply(); fn(); return; }
      btn.setAttribute("data-sure", "1"); btn.textContent = label;
      setTimeout(function () { if (btn.getAttribute("data-sure") === "1") { btn.removeAttribute("data-sure"); DTAapply(); } }, 3500);
    }
  };
})();

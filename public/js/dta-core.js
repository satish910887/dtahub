/* DTAcore: DTAhub's own small framework. Original code, no third-party dependency.
   One place for the things every page and tool needs: strings, numbers (Indian formats), safe storage,
   events, language, DOM helpers, files and downloads, images, toasts and copy, URL-hash state and input validation.
   Pure modules (str, num, store, events, i18n, hash, validate) also run in Node for unit tests (scripts/core-test.mjs).
   Browser-only modules (dom, files, img, ui) are written so that loading this file never touches the DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DTAcore = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (root) {
  "use strict";
  var C = { version: "1.0.0" };
  var doc = function () { return root.document || null; };

  /* ---------------- events ---------------- */
  C.events = function () {
    var m = {};
    return {
      on: function (n, f) { (m[n] = m[n] || []).push(f); return function () { this.off(n, f); }.bind(this); },
      off: function (n, f) { if (m[n]) m[n] = m[n].filter(function (x) { return x !== f; }); },
      once: function (n, f) { var o = this.on(n, function (a) { o(); f(a); }); return o; },
      emit: function (n, a) { (m[n] || []).slice().forEach(function (f) { try { f(a); } catch (e) { if (root.console) console.error(e); } }); }
    };
  };
  C.bus = C.events();

  /* ---------------- strings ---------------- */
  var ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  C.str = {
    esc: function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); },
    slug: function (s) { return String(s == null ? "" : s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); },
    truncate: function (s, n, tail) { s = String(s == null ? "" : s); var a = Array.from(s); return a.length <= n ? s : a.slice(0, Math.max(0, n - (tail == null ? 1 : Array.from(tail).length))).join("") + (tail == null ? "…" : tail); },
    pad: function (n, w, ch) { var s = String(n), c = ch == null ? "0" : ch; while (s.length < w) s = c + s; return s; },
    isBlank: function (s) { return s == null || String(s).trim() === ""; },
    graphemes: function (s) {
      s = String(s == null ? "" : s);
      if (root.Intl && Intl.Segmenter) { var n = 0, it = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s); for (var x of it) n++; return n; }
      return Array.from(s).length;
    }
  };

  /* ---------------- numbers ---------------- */
  var N = C.num = {
    clamp: function (n, lo, hi) { return Math.min(hi, Math.max(lo, n)); },
    round: function (n, d) { var k = Math.pow(10, d || 0); return Math.round((n + (n < 0 ? -1 : 1) * 1e-12) * k) / k; },
    /* "1,234.5" -> 1234.5; blank or junk -> NaN (never 0) */
    parse: function (v) {
      if (typeof v === "number") return isFinite(v) ? v : NaN;
      if (v == null) return NaN;
      var s = String(v).trim().replace(/[,\s ]/g, "");
      if (!s || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
      return Number(s);
    },
    /* Indian digit grouping: 1234567.891 -> "12,34,567.89" */
    fmtIN: function (n, max) {
      n = Number(n); if (!isFinite(n)) return "";
      max = max == null ? 2 : max;
      try { return n.toLocaleString("en-IN", { maximumFractionDigits: max }); }
      catch (e) { return N.round(n, max).toString(); }
    },
    inr: function (n, max) { return "₹ " + N.fmtIN(n, max == null ? 0 : max); },
    /* 1250000 -> "12.5 L", 25000000 -> "2.5 Cr" */
    compact: function (n) {
      n = Number(n); if (!isFinite(n)) return "";
      var a = Math.abs(n), s = n < 0 ? "-" : "", f = function (v, u) { return s + (Math.round(v * 100) / 100) + " " + u; };
      if (a >= 1e7) return f(a / 1e7, "Cr"); if (a >= 1e5) return f(a / 1e5, "L"); if (a >= 1e3) return f(a / 1e3, "K");
      return s + String(Math.round(a * 100) / 100);
    },
    bytes: function (b) { return b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB"; },
    pct: function (a, b, d) { return b === 0 ? NaN : N.round(a / b * 100, d == null ? 2 : d); },
    isInt: function (n) { return typeof n === "number" && isFinite(n) && Math.floor(n) === n; }
  };

  /* ---------------- safe storage (falls back to memory when blocked) ---------------- */
  C.store = function (backend) {
    var mem = {}, ls = backend === undefined ? (function () { try { return root.localStorage || null; } catch (e) { return null; } })() : backend;
    function rd(k) { try { if (ls) { var v = ls.getItem(k); return v === null ? undefined : v; } } catch (e) {} return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : undefined; }
    function wr(k, v) { try { if (ls) { ls.setItem(k, v); delete mem[k]; return true; } } catch (e) {} mem[k] = String(v); return false; }
    var S = {
      get: function (k, d) { var v = rd(k); return v === undefined ? d : v; },
      put: function (k, v) { return wr(k, String(v)); },
      del: function (k) { try { if (ls) ls.removeItem(k); } catch (e) {} delete mem[k]; },
      json: function (k, d) { var v = rd(k); if (v === undefined) return d; try { return JSON.parse(v); } catch (e) { return d; } },
      putJson: function (k, v) { return wr(k, JSON.stringify(v)); },
      list: function (k) { var a = S.json(k, []); return Array.isArray(a) ? a : []; },
      /* newest first, no duplicates, capped */
      push: function (k, item, max) { var a = S.list(k).filter(function (x) { return x !== item; }); a.unshift(item); if (max) a = a.slice(0, max); S.putJson(k, a); return a; }
    };
    return S;
  };
  C.store = (function (make) { var d = make(); for (var k in d) make[k] = d[k]; return make; })(C.store);

  /* ---------------- language ---------------- */
  var lang = null;
  C.i18n = {
    lang: function () { if (lang === null) lang = C.store.get("lang", "en") === "hi" ? "hi" : "en"; return lang; },
    set: function (l) { lang = l === "hi" ? "hi" : "en"; C.store.put("lang", lang); C.bus.emit("lang", lang); return lang; },
    toggle: function () { return C.i18n.set(C.i18n.lang() === "en" ? "hi" : "en"); },
    L: function (en, hi) { return C.i18n.lang() === "hi" ? hi : en; },
    /* { en:"..", hi:".." } -> current language, falling back to English */
    pick: function (o) { if (o == null) return ""; var l = C.i18n.lang(); return o[l] != null ? o[l] : o.en; }
  };

  /* ---------------- URL-hash state (shareable calculator links) ---------------- */
  C.hash = {
    parse: function (s) {
      var o = {}; s = String(s == null ? "" : s).replace(/^#/, "");
      if (!s) return o;
      s.split("&").forEach(function (p) { if (!p) return; var i = p.indexOf("="), k = i < 0 ? p : p.slice(0, i), v = i < 0 ? "" : p.slice(i + 1); try { o[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) {} });
      return o;
    },
    stringify: function (o) { return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== null; }).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&"); },
    read: function () { return C.hash.parse(root.location ? root.location.hash : ""); },
    write: function (o) { try { root.history.replaceState(null, "", "#" + C.hash.stringify(o)); return true; } catch (e) { return false; } }
  };

  /* ---------------- validation (returns {ok, value, error:{en,hi}}) ---------------- */
  var bad = function (en, hi) { return { ok: false, value: NaN, error: { en: en, hi: hi } }; };
  C.validate = {
    number: function (v, o) {
      o = o || {};
      if (C.str.isBlank(v)) return o.required === false ? { ok: true, value: o.def == null ? NaN : o.def, error: null } : bad("Enter a number.", "एक संख्या डालें।");
      var n = N.parse(v);
      if (isNaN(n)) return bad("This is not a valid number.", "यह सही संख्या नहीं है।");
      if (o.int && !N.isInt(n)) return bad("Use a whole number.", "पूरी संख्या डालें।");
      if (o.min != null && n < o.min) return bad("Must be at least " + o.min + ".", "कम से कम " + o.min + " होना चाहिए।");
      if (o.max != null && n > o.max) return bad("Must be at most " + o.max + ".", "ज़्यादा से ज़्यादा " + o.max + " होना चाहिए।");
      return { ok: true, value: n, error: null };
    },
    email: function (s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || "").trim()); },
    url: function (s, o) {
      var protos = (o && o.protocols) || ["http:", "https:"];
      try { var u = new URL(String(s).trim()); return protos.indexOf(u.protocol) > -1; } catch (e) { return false; }
    },
    hexColor: function (s) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || "").trim()); }
  };

  /* ---------------- DOM (browser only) ---------------- */
  var el = function (id) { var d = doc(); return d ? d.getElementById(id) : null; };
  C.dom = {
    $: el,
    $$: function (sel, r) { var d = doc(); return d ? Array.prototype.slice.call((r || d).querySelectorAll(sel)) : []; },
    /* h("button", {class:"btn", onclick:fn, "data-x":1}, ["text", childNode]) */
    h: function (tag, attrs, kids) {
      var d = doc(), e = d.createElement(tag);
      for (var k in (attrs || {})) {
        var v = attrs[k]; if (v == null || v === false) continue;
        if (k.slice(0, 2) === "on" && typeof v === "function") e.addEventListener(k.slice(2), v);
        else if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
        else e.setAttribute(k, v === true ? "" : v);
      }
      [].concat(kids == null ? [] : kids).forEach(function (c) { e.appendChild(typeof c === "string" || typeof c === "number" ? d.createTextNode(String(c)) : c); });
      return e;
    },
    on: function (t, ev, fn, opt) { t.addEventListener(ev, fn, opt); return function () { t.removeEventListener(ev, fn, opt); }; },
    delegate: function (r, ev, sel, fn) { return C.dom.on(r, ev, function (e) { var t = e.target.closest && e.target.closest(sel); if (t && r.contains(t)) fn(e, t); }); },
    debounce: function (fn, ms) { var t; var f = function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; f.cancel = function () { clearTimeout(t); }; return f; },
    throttle: function (fn, ms) { var last = 0, t; return function () { var a = arguments, s = this, now = Date.now(); if (now - last >= ms) { last = now; fn.apply(s, a); } else { clearTimeout(t); t = setTimeout(function () { last = Date.now(); fn.apply(s, a); }, ms - (now - last)); } }; },
    ready: function (fn) { var d = doc(); if (!d || d.readyState !== "loading") fn(); else d.addEventListener("DOMContentLoaded", fn); }
  };

  /* ---------------- files and downloads ---------------- */
  var EXT = { "image/jpeg": "jpg", "image/webp": "webp", "image/avif": "avif", "image/png": "png", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "text/csv": "csv", "application/json": "json", "application/zip": "zip" };
  C.files = {
    MAX_BYTES: 50 * 1024 * 1024,
    baseName: function (f) { return String(f && f.name != null ? f.name : f).replace(/\.[^.]+$/, ""); },
    extOf: function (t) { return EXT[t] || "png"; },
    sizeOf: N.bytes,
    /* strips characters that are illegal in file names */
    safeName: function (s, def) { var n = String(s == null ? "" : s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "").replace(/^\.+/, "").trim().slice(0, 120); return n || def || "dtahub-file"; },
    saveBlob: function (blob, name, quiet) {
      var d = doc(), a = d.createElement("a"); a.href = root.URL.createObjectURL(blob); a.download = name;
      d.body.appendChild(a); a.click(); d.body.removeChild(a);
      setTimeout(function () { root.URL.revokeObjectURL(a.href); }, 4000);
      if (!quiet) C.ui.toast(C.i18n.L("Download started ✓", "डाउनलोड शुरू ✓") + " " + name);
    },
    saveText: function (text, name, type) { C.files.saveBlob(new root.Blob([text], { type: (type || "text/plain") + ";charset=utf-8" }), name); },
    readBuffer: function (f) { return f.arrayBuffer ? f.arrayBuffer() : new Promise(function (ok, no) { var r = new root.FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsArrayBuffer(f); }); },
    readText: function (f) { return f.text ? f.text() : new Promise(function (ok, no) { var r = new root.FileReader(); r.onload = function () { ok(r.result); }; r.onerror = no; r.readAsText(f); }); },
    /* resolves {file, im} where im is null if the file is not a readable image */
    loadImage: function (file) {
      return new Promise(function (ok) {
        var u = root.URL.createObjectURL(file), im = new root.Image();
        im.onload = function () { root.URL.revokeObjectURL(u); ok({ f: file, im: im }); };
        im.onerror = function () { root.URL.revokeObjectURL(u); ok({ f: file, im: null }); };
        im.src = u;
      });
    },
    /* splits files into accepted / rejected with a reason code: empty, big, type, count */
    validate: function (files, o) {
      o = o || {}; var max = o.maxBytes || C.files.MAX_BYTES, ok = [], badF = [];
      Array.prototype.slice.call(files || []).forEach(function (f, i) {
        var why = null;
        if (o.maxCount && i >= o.maxCount) why = "count";
        else if (!f.size) why = "empty";
        else if (f.size > max) why = "big";
        else if (o.types && o.types.length && !o.types.some(function (t) { return t.slice(-1) === "*" ? f.type.indexOf(t.slice(0, -1)) === 0 : f.type === t; })) why = "type";
        if (why) badF.push({ file: f, reason: why }); else ok.push(f);
      });
      return { ok: ok, bad: badF };
    },
    reasonText: function (r) {
      var L = C.i18n.L;
      return r === "empty" ? L("The file is empty.", "फाइल खाली है।") : r === "big" ? L("The file is too large (limit 50 MB).", "फाइल बहुत बड़ी है (सीमा 50 MB)।") : r === "type" ? L("This file type is not supported here.", "यह फाइल टाइप यहां सपोर्ट नहीं है।") : L("Too many files.", "बहुत ज़्यादा फाइलें।");
    }
  };

  /* ---------------- images ---------------- */
  C.img = {
    /* scale (w,h) down so the longer side is at most max; never scales up */
    fit: function (w, h, max) { var m = Math.max(w, h); if (!(max > 0) || m <= max) return [w, h]; var k = max / m; return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; },
    render: function (im, w, h, type, q) {
      var c = doc().createElement("canvas"); c.width = w; c.height = h;
      var x = c.getContext("2d");
      if (type !== "image/png") { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
      x.imageSmoothingQuality = "high"; x.drawImage(im, 0, 0, w, h);
      return new Promise(function (res) { c.toBlob(res, type, q); });
    }
  };

  /* ---------------- UI: toast, copy, screen-reader announce ---------------- */
  C.ui = {
    toast: function (msg, type) {
      var d = doc(); if (!d) return;
      var c = d.querySelector(".toasts");
      if (!c) { c = d.createElement("div"); c.className = "toasts"; c.setAttribute("aria-live", "polite"); d.body.appendChild(c); }
      var t = d.createElement("div"); t.className = "toast " + (type || "ok");
      var ic = root.DTA && root.DTA.icon ? root.DTA.icon(type === "err" ? "close" : "shield", 18) : "";
      t.innerHTML = ic + "<span></span>"; t.lastChild.textContent = msg; c.appendChild(t);
      while (c.children.length > 3) c.removeChild(c.firstChild);
      setTimeout(function () { t.classList.add("out"); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260); }, 2600);
    },
    copy: function (text, btn) {
      var d = doc(), L = C.i18n.L;
      function done() {
        C.ui.toast(L("Copied to clipboard", "कॉपी हो गया"));
        if (btn) { var o = btn.textContent; btn.textContent = L("Copied", "कॉपी हो गया"); btn.classList.add("copied"); setTimeout(function () { btn.textContent = o; btn.classList.remove("copied"); }, 1400); }
      }
      function fb() {
        var a = d.createElement("textarea"); a.value = text; a.style.position = "fixed"; a.style.opacity = "0"; d.body.appendChild(a); a.select();
        var ok = false; try { ok = d.execCommand("copy"); } catch (e) {} d.body.removeChild(a);
        if (ok) done(); else C.ui.toast(L("Could not copy. Select the text and copy manually.", "कॉपी नहीं हुआ। टेक्स्ट चुनकर खुद कॉपी करें।"), "err");
      }
      if (root.navigator && navigator.clipboard && root.isSecureContext) navigator.clipboard.writeText(text).then(done, fb); else fb();
    }
  };

  return C;
});

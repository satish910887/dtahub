/* DTApdfView: DTAhub's own PDF page renderer (canvas 2D). Original code, no third-party dependency.
   Reads through DTApdf (objects, filters), draws glyphs from DTApdfFont outlines.
     var doc = await DTApdfView.open(bytes);  var page = await doc.getPage(1);
     var vp = page.getViewport({scale: 1.5});  await page.render({canvasContext: ctx, viewport: vp}).promise;
   Mirrors the small slice of the PDF.js API the DTAhub tools use: numPages, getPage, getViewport, render, getAnnotations.
   Not supported, drawn as a light placeholder instead: JPEG 2000 and JBIG2 images, predefined CJK CMaps for fonts that are not embedded. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root, require("./dta-pdf.js"), require("./dta-pdf-font.js"), require("./dta-pdf-data.js"));
  else root.DTApdfView = factory(root, root.DTApdf, root.DTApdfFont, root.DTApdfData);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, P, FONT, DATA) {
  "use strict";
  var Name = P.Name, Ref = P.Ref, Str = P.Str, Dict = P.Dict, Stream = P.Stream, dictOf = P.util.dictOf;
  function ViewError(name, msg) { var e = new Error(msg || name); e.name = name; return e; }
  var isName = function (o, n) { return o instanceof Name && (n === undefined || o.n === n); };
  var num = function (v, d) { return typeof v === "number" && isFinite(v) ? v : d; };
  function mul(m, n) { return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]; }
  function inv(m) { var d = m[0] * m[3] - m[1] * m[2]; if (!d) return [1, 0, 0, 1, 0, 0]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; }
  function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function arr(doc, o) { o = doc.get(o); return Array.isArray(o) ? o.map(function (x) { return doc.get(x); }) : null; }
  function numArr(doc, o) { var a = arr(doc, o); return a && a.every(function (x) { return typeof x === "number"; }) ? a : null; }
  function gd(doc, d, k) { d = dictOf(d); return d ? doc.get(d.get(k)) : undefined; }

  /* ================= PDF functions (types 0, 2, 3, 4) ================= */
  function makeFunction(doc, obj) {
    obj = doc.get(obj); if (Array.isArray(obj)) { var fs = obj.map(function (o) { return makeFunction(doc, o); }); return { nIn: fs[0] ? fs[0].nIn : 1, nOut: fs.length, ev: function (x) { return fs.map(function (f) { return f.ev(x)[0]; }); } }; }
    var d = dictOf(obj); if (!d) return { nIn: 1, nOut: 1, ev: function (x) { return [x[0]]; } };
    var type = gd(doc, d, "FunctionType"), domain = numArr(doc, d.get("Domain")) || [0, 1], range = numArr(doc, d.get("Range")), nIn = domain.length >> 1, fn;
    function clipOut(o) { if (range) for (var i = 0; i < o.length && i * 2 + 1 < range.length; i++) o[i] = clamp(o[i], range[i * 2], range[i * 2 + 1]); return o; }
    function clipIn(x) { return x.map(function (v, i) { return clamp(v, domain[i * 2], domain[i * 2 + 1]); }); }
    if (type === 2) {
      var c0 = numArr(doc, d.get("C0")) || [0], c1 = numArr(doc, d.get("C1")) || [1], n = num(gd(doc, d, "N"), 1);
      fn = function (x) { var t = clamp(x[0], domain[0], domain[1]), p = n === 1 ? t : Math.pow(t, n); return clipOut(c0.map(function (a, i) { return a + p * ((c1[i] === undefined ? a : c1[i]) - a); })); };
      return { nIn: 1, nOut: c0.length, ev: fn };
    }
    if (type === 3) {
      var fns = (arr(doc, d.get("Functions")) || []).map(function (f) { return makeFunction(doc, f); }), bounds = numArr(doc, d.get("Bounds")) || [], enc = numArr(doc, d.get("Encode")) || [];
      fn = function (x) {
        var t = clamp(x[0], domain[0], domain[1]), k = 0; while (k < bounds.length && t >= bounds[k]) k++; if (k >= fns.length) k = fns.length - 1;
        var lo = k === 0 ? domain[0] : bounds[k - 1], hi = k === bounds.length ? domain[1] : bounds[k], e0 = num(enc[k * 2], 0), e1 = num(enc[k * 2 + 1], 1);
        var u = hi === lo ? e0 : e0 + (t - lo) * (e1 - e0) / (hi - lo); return clipOut(fns[k].ev([u]));
      };
      return { nIn: 1, nOut: fns[0] ? fns[0].nOut : 1, ev: fn };
    }
    if (type === 0 && obj instanceof Stream) {
      var size = numArr(doc, d.get("Size")) || [2], bps = num(gd(doc, d, "BitsPerSample"), 8), nOut = range ? range.length >> 1 : 1, enc0 = numArr(doc, d.get("Encode")), dec = numArr(doc, d.get("Decode")) || range, data = doc.decodeStream(obj), maxv = Math.pow(2, bps) - 1;
      if (!enc0) { enc0 = []; size.forEach(function (s) { enc0.push(0, s - 1); }); }
      var strides = [], tot = 1; size.forEach(function (s) { strides.push(tot); tot *= s; });
      var sample = function (idx, o) { var bit = (idx * nOut + o) * bps, v = 0; if (bps === 8) return data[bit >> 3] || 0; if (bps === 16) return ((data[bit >> 3] << 8) | data[(bit >> 3) + 1]) || 0; if (bps === 32) return ((data[bit >> 3] * 16777216) + (data[(bit >> 3) + 1] << 16) + (data[(bit >> 3) + 2] << 8) + data[(bit >> 3) + 3]) || 0; for (var i = 0; i < bps; i++) { var b = bit + i; v = (v << 1) | (((data[b >> 3] || 0) >> (7 - (b & 7))) & 1); } return v; };
      fn = function (x) {
        x = clipIn(x); var e = [], i0 = [], fr = [], k;
        for (k = 0; k < nIn; k++) { var xi = domain[k * 2 + 1] === domain[k * 2] ? 0 : (x[k] - domain[k * 2]) / (domain[k * 2 + 1] - domain[k * 2]); var ev = clamp(enc0[k * 2] + xi * (enc0[k * 2 + 1] - enc0[k * 2]), 0, size[k] - 1); e.push(ev); i0.push(Math.min(Math.floor(ev), size[k] - 1)); fr.push(ev - i0[k]); }
        var out = new Array(nOut).fill(0), corners = 1 << nIn;
        for (var c = 0; c < corners; c++) { var w = 1, idx = 0; for (k = 0; k < nIn; k++) { var up = (c >> k) & 1, ii = Math.min(i0[k] + up, size[k] - 1); w *= up ? fr[k] : 1 - fr[k]; idx += ii * strides[k]; } if (w) for (var o = 0; o < nOut; o++) out[o] += w * sample(idx, o); }
        for (var q = 0; q < nOut; q++) { var lo = dec[q * 2], hi = dec[q * 2 + 1]; out[q] = lo + out[q] * (hi - lo) / maxv; }
        return clipOut(out);
      };
      return { nIn: nIn, nOut: nOut, ev: fn };
    }
    if (type === 4 && obj instanceof Stream) {
      var prog = parsePS(new TextDecoder("latin1").decode(doc.decodeStream(obj))), nOut4 = range ? range.length >> 1 : 1;
      fn = function (x) { var st = clipIn(x).slice(); try { runPS(prog, st); } catch (e) { return new Array(nOut4).fill(0); } var o = st.slice(-nOut4); while (o.length < nOut4) o.unshift(0); return clipOut(o); };
      return { nIn: nIn, nOut: nOut4, ev: fn };
    }
    return { nIn: 1, nOut: 1, ev: function (x) { return [x[0]]; } };
  }
  function parsePS(src) {
    var toks = src.match(/[{}]|[^\s{}]+/g) || [], pos = 0;
    function block() { var out = []; while (pos < toks.length) { var t = toks[pos++]; if (t === "{") out.push(block()); else if (t === "}") return out; else out.push(isNaN(+t) ? t : +t); } return out; }
    while (pos < toks.length && toks[pos] !== "{") pos++; pos++; return block();
  }
  function runPS(prog, st) {
    for (var i = 0; i < prog.length; i++) {
      var t = prog[i], a, b;
      if (typeof t === "number") { st.push(t); continue; }
      if (Array.isArray(t)) { var nx = prog[i + 1]; if (nx === "if") { i++; if (st.pop()) runPS(t, st); } else if (Array.isArray(nx) && prog[i + 2] === "ifelse") { i += 2; if (st.pop()) runPS(t, st); else runPS(nx, st); } continue; }
      switch (t) {
        case "abs": st.push(Math.abs(st.pop())); break; case "add": b = st.pop(); a = st.pop(); st.push(a + b); break; case "sub": b = st.pop(); a = st.pop(); st.push(a - b); break;
        case "mul": b = st.pop(); a = st.pop(); st.push(a * b); break; case "div": b = st.pop(); a = st.pop(); st.push(b ? a / b : 0); break; case "idiv": b = st.pop(); a = st.pop(); st.push(b ? Math.trunc(a / b) : 0); break;
        case "mod": b = st.pop(); a = st.pop(); st.push(b ? a % b : 0); break; case "neg": st.push(-st.pop()); break; case "atan": b = st.pop(); a = st.pop(); { var r = Math.atan2(a, b) * 180 / Math.PI; st.push(r < 0 ? r + 360 : r); } break;
        case "ceiling": st.push(Math.ceil(st.pop())); break; case "floor": st.push(Math.floor(st.pop())); break; case "round": st.push(Math.round(st.pop())); break; case "truncate": case "cvi": st.push(Math.trunc(st.pop())); break; case "cvr": break;
        case "cos": st.push(Math.cos(st.pop() * Math.PI / 180)); break; case "sin": st.push(Math.sin(st.pop() * Math.PI / 180)); break; case "exp": b = st.pop(); a = st.pop(); st.push(Math.pow(a, b)); break;
        case "ln": st.push(Math.log(st.pop())); break; case "log": st.push(Math.log10(st.pop())); break; case "sqrt": st.push(Math.sqrt(st.pop())); break;
        case "and": b = st.pop(); a = st.pop(); st.push(typeof a === "boolean" ? a && b : a & b); break; case "or": b = st.pop(); a = st.pop(); st.push(typeof a === "boolean" ? a || b : a | b); break;
        case "xor": b = st.pop(); a = st.pop(); st.push(typeof a === "boolean" ? a !== b : a ^ b); break; case "not": a = st.pop(); st.push(typeof a === "boolean" ? !a : ~a); break;
        case "bitshift": b = st.pop(); a = st.pop(); st.push(b >= 0 ? a << b : a >> -b); break;
        case "eq": b = st.pop(); a = st.pop(); st.push(a === b); break; case "ne": b = st.pop(); a = st.pop(); st.push(a !== b); break; case "gt": b = st.pop(); a = st.pop(); st.push(a > b); break;
        case "ge": b = st.pop(); a = st.pop(); st.push(a >= b); break; case "lt": b = st.pop(); a = st.pop(); st.push(a < b); break; case "le": b = st.pop(); a = st.pop(); st.push(a <= b); break;
        case "true": st.push(true); break; case "false": st.push(false); break; case "pop": st.pop(); break; case "dup": st.push(st[st.length - 1]); break; case "exch": b = st.pop(); a = st.pop(); st.push(b, a); break;
        case "copy": { var n = st.pop(); st.push.apply(st, st.slice(st.length - n)); break; } case "index": { var k = st.pop(); st.push(st[st.length - 1 - k]); break; }
        case "roll": { var j = st.pop(), nn = st.pop(); if (nn > 0) { var seg = st.splice(st.length - nn, nn); j = ((j % nn) + nn) % nn; for (var q = 0; q < nn; q++) st.push(seg[(q - j + nn) % nn]); } break; }
        default: break;
      }
    }
  }

  /* ================= colour spaces ================= */
  function rgbOut(r, g, b) { return [Math.round(clamp(r, 0, 1) * 255), Math.round(clamp(g, 0, 1) * 255), Math.round(clamp(b, 0, 1) * 255)]; }
  var CS_GRAY = { name: "DeviceGray", n: 1, init: [0], rgb: function (c) { return rgbOut(c[0], c[0], c[0]); } };
  var CS_RGB = { name: "DeviceRGB", n: 3, init: [0, 0, 0], rgb: function (c) { return rgbOut(c[0], c[1], c[2]); } };
  /* DeviceCMYK -> RGB: multilinear blend of the sixteen ink-corner colours (typical process-ink look, close to what viewers show) */
  var CMYK_CORNERS = (function () {
    var base = { c: [0, 174, 239], m: [236, 0, 140], y: [255, 242, 0], cm: [46, 49, 146], cy: [0, 166, 81], my: [237, 28, 36], cmy: [54, 54, 57] }, t = [], i;
    for (i = 0; i < 16; i++) {
      var key = (i & 1 ? "c" : "") + (i & 2 ? "m" : "") + (i & 4 ? "y" : ""), col = key ? base[key] : [255, 255, 255];
      t.push(i & 8 ? [col[0] * 35 / 255, col[1] * 31 / 255, col[2] * 32 / 255] : col);
    }
    return t;
  })();
  var CS_CMYK = { name: "DeviceCMYK", n: 4, init: [0, 0, 0, 1], rgb: function (c) {
    var C = clamp(c[0], 0, 1), M = clamp(c[1], 0, 1), Y = clamp(c[2], 0, 1), K = clamp(c[3], 0, 1), r = 0, g = 0, b = 0;
    for (var i = 0; i < 16; i++) { var w = (i & 1 ? C : 1 - C) * (i & 2 ? M : 1 - M) * (i & 4 ? Y : 1 - Y) * (i & 8 ? K : 1 - K); if (w) { var q = CMYK_CORNERS[i]; r += w * q[0]; g += w * q[1]; b += w * q[2]; } }
    return [Math.round(r), Math.round(g), Math.round(b)];
  } };
  function parseCS(doc, o, res, depth) {
    depth = depth || 0; if (depth > 6) return CS_GRAY; o = doc.get(o);
    if (o instanceof Name) {
      switch (o.n) {
        case "DeviceGray": case "G": case "CalGray": return CS_GRAY; case "DeviceRGB": case "RGB": case "CalRGB": return CS_RGB; case "DeviceCMYK": case "CMYK": return CS_CMYK;
        case "Pattern": return { name: "Pattern", n: 0, init: [], rgb: function () { return [0, 0, 0]; }, base: null };
      }
      var rs = res && gd(doc, res, "ColorSpace"), ent = rs && gd(doc, rs, o.n); if (ent !== undefined && ent !== null && !(ent instanceof Name && ent.n === o.n)) return parseCS(doc, ent, res, depth + 1);
      return CS_GRAY;
    }
    if (!Array.isArray(o) || !o.length) return CS_GRAY;
    var k = doc.get(o[0]), kn = k instanceof Name ? k.n : "";
    if (kn === "DeviceGray" || kn === "G" || kn === "CalGray") return CS_GRAY; if (kn === "DeviceRGB" || kn === "RGB" || kn === "CalRGB") return CS_RGB; if (kn === "DeviceCMYK" || kn === "CMYK") return CS_CMYK;
    if (kn === "ICCBased") { var st = doc.get(o[1]), d = dictOf(st), n = d ? num(doc.get(d.get("N")), 3) : 3; if (n === 1) return CS_GRAY; if (n === 4) return CS_CMYK; return CS_RGB; }
    if (kn === "Lab") {
      var ld = dictOf(doc.get(o[1])) || new Dict(), wp = numArr(doc, ld.get("WhitePoint")) || [0.9505, 1, 1.089], rg = numArr(doc, ld.get("Range")) || [-100, 100, -100, 100];
      return { name: "Lab", n: 3, init: [0, 0, 0], range: [0, 100, rg[0], rg[1], rg[2], rg[3]], rgb: function (c) {
        var L = clamp(c[0], 0, 100), a = clamp(c[1], rg[0], rg[1]), b = clamp(c[2], rg[2], rg[3]), M = (L + 16) / 116, Lx = M + a / 500, Nz = M - b / 200;
        var g = function (x) { return x >= 6 / 29 ? x * x * x : 108 / 841 * (x - 4 / 29); }, X = wp[0] * g(Lx), Y = wp[1] * g(M), Z = wp[2] * g(Nz);
        var r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z, gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z, bb = 0.0557 * X - 0.204 * Y + 1.057 * Z, f = function (v) { v = clamp(v, 0, 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
        return rgbOut(f(r), f(gg), f(bb));
      } };
    }
    if (kn === "Indexed" || kn === "I") {
      var base = parseCS(doc, o[1], res, depth + 1), hival = num(doc.get(o[2]), 255), lk = doc.get(o[3]), bytes = lk instanceof Stream ? doc.decodeStream(lk) : lk instanceof Str ? lk.b : new Uint8Array(0), pal = [];
      for (var i = 0; i <= hival; i++) { var comps = []; for (var j = 0; j < base.n; j++) { var bv = bytes[i * base.n + j] || 0; comps.push(base.range ? base.range[j * 2] + bv / 255 * (base.range[j * 2 + 1] - base.range[j * 2]) : bv / 255); } pal.push(base.rgb(comps)); }
      return { name: "Indexed", n: 1, init: [0], indexed: true, hival: hival, pal: pal, rgb: function (c) { return pal[clamp(Math.round(c[0]), 0, hival)] || [0, 0, 0]; } };
    }
    if (kn === "Separation" || kn === "DeviceN") {
      var names = doc.get(o[1]), alt = parseCS(doc, o[2], res, depth + 1), fn = makeFunction(doc, o[3]), nn = kn === "Separation" ? 1 : (Array.isArray(names) ? names.length : 1);
      var allNone = kn === "Separation" ? (names instanceof Name && names.n === "None") : (Array.isArray(names) && names.every(function (x) { x = doc.get(x); return x instanceof Name && x.n === "None"; }));
      return { name: kn, n: nn, init: new Array(nn).fill(1), none: allNone, rgb: function (c) { return alt.rgb(fn.ev(c)); } };
    }
    if (kn === "Pattern") return { name: "Pattern", n: 0, init: [], rgb: function () { return [0, 0, 0]; }, base: o[1] ? parseCS(doc, o[1], res, depth + 1) : null };
    return CS_GRAY;
  }

  /* ================= image decoding ================= */
  function filterNames(doc, st) {
    var f = doc.get(st.dict.get("Filter") || st.dict.get("F")), out = [];
    (f == null ? [] : Array.isArray(f) ? f.map(doc.get, doc) : [f]).forEach(function (x) { if (x instanceof Name) out.push(x.n); }); return out;
  }
  var UNSUPPORTED_IMG = { JPXDecode: 1, JBIG2Decode: 1 };
  function splitFilters(doc, st) {
    /* decode everything before a final image codec; returns {data, codec, parms} */
    var names = filterNames(doc, st), pr = doc.get(st.dict.get("DecodeParms") || st.dict.get("DP")), parms = Array.isArray(pr) ? pr.map(doc.get, doc) : [pr];
    var idx = -1; for (var i = 0; i < names.length; i++) if (/^(DCTDecode|DCT|JPXDecode|JBIG2Decode|CCITTFaxDecode|CCF)$/.test(names[i])) { idx = i; break; }
    if (idx < 0) return { data: doc.decodeStream(st), codec: null };
    var pre = new Stream(new Dict(), st.raw); if (idx > 0) { pre.dict.set("Filter", names.slice(0, idx).map(function (n) { return new Name(n); })); pre.dict.set("DecodeParms", parms.slice(0, idx)); }
    return { data: idx > 0 ? doc.decodeStream(pre) : st.raw, codec: names[idx], parms: parms[idx] instanceof Dict ? parms[idx] : null };
  }
  function canvasOf(w, h) { if (typeof OffscreenCanvas !== "undefined" && !(root.document && root.document.createElement)) return new OffscreenCanvas(w, h); var c = root.document.createElement("canvas"); c.width = w; c.height = h; return c; }
  /* returns {w,h,rgba:Uint8ClampedArray} */
  async function decodeRaster(doc, st, res, opt) {
    opt = opt || {}; var d = st.dict, w = num(gd(doc, d, "Width") || gd(doc, d, "W"), 0), h = num(gd(doc, d, "Height") || gd(doc, d, "H"), 0), isMask = gd(doc, d, "ImageMask") === true || gd(doc, d, "IM") === true;
    if (!(w > 0 && h > 0) || w * h > 120e6) throw ViewError("ImageError", "bad image size");
    var bpc = isMask ? 1 : num(gd(doc, d, "BitsPerComponent") || gd(doc, d, "BPC"), 8), decode = numArr(doc, d.get("Decode") || d.get("D"));
    var sp = splitFilters(doc, st), rgba = new Uint8ClampedArray(w * h * 4), i, n = w * h;
    if (sp.codec && UNSUPPORTED_IMG[sp.codec]) { var e = ViewError("Unsupported", sp.codec); e.w = w; e.h = h; throw e; }
    if (sp.codec === "CCITTFaxDecode" || sp.codec === "CCF") {
      var bits = ccittDecode(sp.data, sp.parms ? { K: num(gd(doc, sp.parms, "K"), 0), cols: num(gd(doc, sp.parms, "Columns"), 1728), rows: num(gd(doc, sp.parms, "Rows"), h), black1: gd(doc, sp.parms, "BlackIs1") === true, align: gd(doc, sp.parms, "EncodedByteAlign") === true } : { K: 0, cols: 1728, rows: h, black1: false, align: false }, h);
      sp = { data: bits, codec: null }; bpc = 1;
    }
    var cs = isMask ? CS_GRAY : (d.has("ColorSpace") || d.has("CS")) ? parseCS(doc, d.get("ColorSpace") || d.get("CS"), res) : null;
    if (sp.codec === "DCTDecode" || sp.codec === "DCT") {
      var bm = await createBitmap(sp.data, w, h); var cv = canvasOf(bm.width, bm.height), cx = cv.getContext("2d"); cx.drawImage(bm, 0, 0); var id = cx.getImageData(0, 0, bm.width, bm.height);
      if (bm.close) bm.close(); if (id.width !== w || id.height !== h) { w = id.width; h = id.height; rgba = new Uint8ClampedArray(w * h * 4); n = w * h; }
      rgba.set(id.data); if (cs === CS_GRAY && false) { /* the browser already converted */ }
      if (decode && cs && cs.n === 3 && decode[0] === 1 && decode[1] === 0) for (i = 0; i < n * 4; i += 4) { rgba[i] = 255 - rgba[i]; rgba[i + 1] = 255 - rgba[i + 1]; rgba[i + 2] = 255 - rgba[i + 2]; }
      return finishMasks(doc, d, res, { w: w, h: h, rgba: rgba }, opt);
    }
    var data = sp.data;
    if (isMask) {
      var inv0 = decode && decode[0] === 1, rowB = (w + 7) >> 3, col = opt.color || [0, 0, 0];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var bit = ((data[y * rowB + (x >> 3)] || 0) >> (7 - (x & 7))) & 1, paint = inv0 ? bit === 1 : bit === 0, o = (y * w + x) * 4; rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = paint ? 255 : 0; }
      return { w: w, h: h, rgba: rgba, stencil: true };
    }
    if (!cs) cs = CS_GRAY; var nc = cs.n || 1, maxv = Math.pow(2, bpc) - 1, rowBytes = (w * nc * bpc + 7) >> 3, dmin = [], dmax = [];
    for (i = 0; i < nc; i++) { if (decode && decode.length >= nc * 2) { dmin.push(decode[i * 2]); dmax.push(decode[i * 2 + 1]); } else if (cs.indexed) { dmin.push(0); dmax.push(maxv); } else if (cs.range) { dmin.push(cs.range[i * 2]); dmax.push(cs.range[i * 2 + 1]); } else { dmin.push(0); dmax.push(1); } }
    var maskKey = numArr(doc, d.get("Mask")), comps = new Array(nc), lut = null;
    if (nc === 1 && bpc <= 8) { lut = []; for (var v = 0; v <= maxv; v++) lut.push(cs.rgb([dmin[0] + v * (dmax[0] - dmin[0]) / maxv])); }
    for (var yy = 0; yy < h; yy++) {
      var rs = yy * rowBytes, bitp = 0;
      for (var xx = 0; xx < w; xx++) {
        var o2 = (yy * w + xx) * 4, raw0 = 0, r, g, b;
        if (bpc === 8) { if (nc === 3 && cs === CS_RGB && !decode) { r = data[rs + xx * 3]; g = data[rs + xx * 3 + 1]; b = data[rs + xx * 3 + 2]; rgba[o2] = r; rgba[o2 + 1] = g; rgba[o2 + 2] = b; rgba[o2 + 3] = 255; if (maskKey && maskKey.length >= 6 && r >= maskKey[0] && r <= maskKey[1] && g >= maskKey[2] && g <= maskKey[3] && b >= maskKey[4] && b <= maskKey[5]) rgba[o2 + 3] = 0; continue; }
          for (var c = 0; c < nc; c++) { var rv = data[rs + xx * nc + c] || 0; if (c === 0) raw0 = rv; comps[c] = dmin[c] + rv * (dmax[c] - dmin[c]) / 255; } }
        else {
          for (var c2 = 0; c2 < nc; c2++) { var rv2 = 0; if (bpc === 16) { var po = rs + (xx * nc + c2) * 2; rv2 = ((data[po] << 8) | data[po + 1]) || 0; } else { var bo = rs * 8 + bitp; rv2 = ((data[bo >> 3] || 0) >> (8 - bpc - (bo & 7))) & maxv; bitp += bpc; } if (c2 === 0) raw0 = rv2; comps[c2] = dmin[c2] + rv2 * (dmax[c2] - dmin[c2]) / maxv; }
        }
        var rgb = lut && bpc <= 8 ? lut[raw0] : cs.rgb(comps); rgba[o2] = rgb[0]; rgba[o2 + 1] = rgb[1]; rgba[o2 + 2] = rgb[2]; rgba[o2 + 3] = 255;
        if (maskKey && maskKey.length >= nc * 2 && nc === 1 && raw0 >= maskKey[0] && raw0 <= maskKey[1]) rgba[o2 + 3] = 0;
      }
    }
    return finishMasks(doc, d, res, { w: w, h: h, rgba: rgba }, opt);
  }
  async function finishMasks(doc, d, res, img, opt) {
    var sm = doc.get(d.get("SMask")), mk = doc.get(d.get("Mask"));
    if (sm instanceof Stream && !opt.noMask) {
      try { var m = await decodeRaster(doc, sm, res, { noMask: true }); img = combineAlpha(img, m, function (r, g, b) { return r; }); } catch (e) { /* ignore a bad mask */ }
    } else if (mk instanceof Stream && !opt.noMask) {
      try { var m2 = await decodeRaster(doc, mk, res, { noMask: true, color: [0, 0, 0] }); img = combineAlpha(img, m2, function (r, g, b, a) { return a; }); } catch (e) { /* ignore */ }
    }
    return img;
  }
  function combineAlpha(img, m, pick) {
    var W = Math.max(img.w, m.w), H = Math.max(img.h, m.h), out = new Uint8ClampedArray(W * H * 4);
    for (var y = 0; y < H; y++) { var iy = Math.min(img.h - 1, Math.floor(y * img.h / H)), my = Math.min(m.h - 1, Math.floor(y * m.h / H)); for (var x = 0; x < W; x++) { var ix = Math.min(img.w - 1, Math.floor(x * img.w / W)), mx = Math.min(m.w - 1, Math.floor(x * m.w / W)), a = (iy * img.w + ix) * 4, b = (my * m.w + mx) * 4, o = (y * W + x) * 4; out[o] = img.rgba[a]; out[o + 1] = img.rgba[a + 1]; out[o + 2] = img.rgba[a + 2]; out[o + 3] = Math.round(pick(m.rgba[b], m.rgba[b + 1], m.rgba[b + 2], m.rgba[b + 3]) * img.rgba[a + 3] / 255); } }
    return { w: W, h: H, rgba: out };
  }
  function createBitmap(bytes, w, h) {
    var blob = new Blob([bytes], { type: "image/jpeg" });
    if (typeof createImageBitmap === "function") return createImageBitmap(blob, { colorSpaceConversion: "none" }).catch(function () { return createImageBitmap(blob); });
    return Promise.reject(ViewError("ImageError", "no JPEG decoder"));
  }

  /* ================= CCITT G3 / G4 fax decoder ================= */
  var WHITE_TERM = "00110101 000111 0111 1000 1011 1100 1110 1111 10011 10100 00111 01000 001000 000011 110100 110101 101010 101011 0100111 0001100 0001000 0010111 0000011 0000100 0101000 0101011 0010011 0100100 0011000 00000010 00000011 00011010 00011011 00010010 00010011 00010100 00010101 00010110 00010111 00101000 00101001 00101010 00101011 00101100 00101101 00000100 00000101 00001010 00001011 01010010 01010011 01010100 01010101 00100100 00100101 01011000 01011001 01011010 01011011 01001010 01001011 00110010 00110011 00110100".split(" ");
  var WHITE_MAKE = "11011 10010 010111 0110111 00110110 00110111 01100100 01100101 01101000 01100111 011001100 011001101 011010010 011010011 011010100 011010101 011010110 011010111 011011000 011011001 011011010 011011011 010011000 010011001 010011010 011000 010011011".split(" ");
  var BLACK_TERM = "0000110111 010 11 10 011 0011 0010 00011 000101 000100 0000100 0000101 0000111 00000100 00000111 000011000 0000010111 0000011000 0000001000 00001100111 00001101000 00001101100 00000110111 00000101000 00000010111 00000011000 000011001010 000011001011 000011001100 000011001101 000001101000 000001101001 000001101010 000001101011 000011010010 000011010011 000011010100 000011010101 000011010110 000011010111 000001101100 000001101101 000011011010 000011011011 000001010100 000001010101 000001010110 000001010111 000001100100 000001100101 000001010010 000001010011 000000100100 000000110111 000000111000 000000100111 000000101000 000001011000 000001011001 000000101011 000000101100 000001011010 000001100110 000001100111".split(" ");
  var BLACK_MAKE = "0000001111 000011001000 000011001001 000001011011 000000110011 000000110100 000000110101 0000001101100 0000001101101 0000001001010 0000001001011 0000001001100 0000001001101 0000001110010 0000001110011 0000001110100 0000001110101 0000001110110 0000001110111 0000001010010 0000001010011 0000001010100 0000001010101 0000001011010 0000001011011 0000001100100 0000001100101".split(" ");
  var EXT_MAKE = "00000001000 00000001100 00000001101 000000010010 000000010011 000000010100 000000010101 000000010110 000000010111 000000011100 000000011101 000000011110 000000011111".split(" ");
  var CC = null;
  function ccittTables() {
    if (CC) return CC; var w = {}, b = {}, i;
    for (i = 0; i < 64; i++) { w[WHITE_TERM[i]] = i; b[BLACK_TERM[i]] = i; }
    for (i = 0; i < WHITE_MAKE.length; i++) w[WHITE_MAKE[i]] = 64 * (i + 1);
    for (i = 0; i < BLACK_MAKE.length; i++) b[BLACK_MAKE[i]] = 64 * (i + 1);
    for (i = 0; i < EXT_MAKE.length; i++) { w[EXT_MAKE[i]] = 1792 + 64 * i; b[EXT_MAKE[i]] = 1792 + 64 * i; }
    return (CC = { w: w, b: b });
  }
  function ccittDecode(src, o, hint) {
    var T = ccittTables(), cols = o.cols, rows = o.rows || hint || 0, bp = 0, total = src.length * 8, K = o.K;
    function bit() { if (bp >= total) return -1; var v = (src[bp >> 3] >> (7 - (bp & 7))) & 1; bp++; return v; }
    function peek(n) { var v = 0; for (var i = 0; i < n; i++) { var p = bp + i; v = (v << 1) | (p < total ? (src[p >> 3] >> (7 - (p & 7))) & 1 : 0); } return v; }
    function run(white) {
      var tab = white ? T.w : T.b, tot = 0;
      for (;;) { var code = "", v = -1, found = -1; for (var l = 1; l <= 13; l++) { var bb = bit(); if (bb < 0) return tot || -1; code += bb; if (tab[code] !== undefined) { found = tab[code]; break; } } if (found < 0) return -1; tot += found; if (found < 64) return tot; }
    }
    var rowBytes = (cols + 7) >> 3, out = [], ref = [cols, cols], y = 0, row;
    function skipEOL() { for (var g = 0; g < 4; g++) { while (peek(1) === 0 && bp < total && peek(12) !== 1 && false) bp++; } }
    while ((!rows || y < rows) && bp < total) {
      if (o.align) bp = (bp + 7) & ~7;
      /* EOL handling for G3 */
      if (K >= 0) { var guard = 0; while (peek(12) === 1 && guard++ < 4) { bp += 12; if (K > 0) bp++; } if (peek(11) === 0 && K >= 0) { /* fill bits */ var z = 0; while (bp < total && peek(1) === 0 && z++ < 64) bp++; if (peek(1) === 1) bp++; } }
      var mode2d = K < 0, cur = [];
      if (K > 0) { var tag = bit(); mode2d = tag === 0; }
      if (!mode2d) { var a0 = 0, white = true; cur = []; while (a0 < cols) { var r = run(white); if (r < 0) { a0 = cols; break; } a0 += r; cur.push(Math.min(a0, cols)); white = !white; } }
      else {
        var pos = -1, whiteC = true, changes = []; /* changes: positions where colour flips */
        var a0p = -1, refc = ref;
        function findB1(a0v, white2) { var i = 0; while (i < refc.length && (refc[i] <= a0v || (i % 2 === 0) !== white2)) i++; return i; }
        var curChanges = []; var col = true; /* col true = white */
        a0p = -1;
        while (a0p < cols) {
          var b1i = 0; while (b1i < refc.length && (refc[b1i] <= a0p || ((b1i % 2 === 0) !== col))) b1i++;
          var b1 = b1i < refc.length ? refc[b1i] : cols, b2 = b1i + 1 < refc.length ? refc[b1i + 1] : cols;
          if (peek(1) === 1) { bp++; a0p = b1; curChanges.push(a0p); col = !col; }
          else if (peek(3) === 3) { bp += 3; a0p = b1 + 1; curChanges.push(a0p); col = !col; }
          else if (peek(3) === 2) { bp += 3; a0p = b1 - 1; curChanges.push(a0p); col = !col; }
          else if (peek(3) === 1) { bp += 3; var r1 = run(col), r2 = run(!col); if (r1 < 0 || r2 < 0) { a0p = cols; break; } var s = Math.max(a0p, 0) + r1; curChanges.push(Math.min(s, cols)); curChanges.push(Math.min(s + r2, cols)); a0p = s + r2; }
          else if (peek(4) === 1) { bp += 4; a0p = b2; }
          else if (peek(6) === 3) { bp += 6; a0p = b1 + 2; curChanges.push(a0p); col = !col; }
          else if (peek(6) === 2) { bp += 6; a0p = b1 - 2; curChanges.push(a0p); col = !col; }
          else if (peek(7) === 3) { bp += 7; a0p = b1 + 3; curChanges.push(a0p); col = !col; }
          else if (peek(7) === 2) { bp += 7; a0p = b1 - 3; curChanges.push(a0p); col = !col; }
          else if (peek(12) === 1 || peek(12) === 0 || bp >= total) { bp = Math.min(total, bp + 12); break; }
          else { bp++; if (bp >= total) break; }
        }
        cur = curChanges.filter(function (v) { return v >= 0; }).map(function (v) { return Math.min(v, cols); });
      }
      /* paint the row */
      row = new Uint8Array(rowBytes); var colr = 0, px = 0; /* 0 white */
      var edges = cur.slice(); edges.push(cols);
      for (var e = 0; e < edges.length; e++) { var end = Math.max(px, Math.min(edges[e], cols)); if (colr === 1) for (var xx = px; xx < end; xx++) row[xx >> 3] |= 0x80 >> (xx & 7); px = end; colr ^= 1; }
      out.push(row); ref = cur.length ? cur.concat([cols, cols]) : [cols, cols]; y++;
    }
    var res = new Uint8Array(rowBytes * (rows || out.length)); out.forEach(function (r2, i) { res.set(r2, i * rowBytes); });
    /* rows are black=1 here; PDF default (BlackIs1 false) wants 0 = black, so invert */
    if (!o.black1) for (var q = 0; q < res.length; q++) res[q] ^= 255;
    return res;
  }

  /* ================= fonts ================= */
  var AFM_NAMES = { Helvetica: 1 };
  function cleanFontName(n) { n = String(n || "").replace(/^[A-Z]{6}\+/, "").replace(/\s+/g, ""); return n; }
  function substitute(name, flags) {
    var n = cleanFontName(name), low = n.toLowerCase(), bold = /bold|black|heavy|demi/.test(low) || !!(flags & 0x40000), italic = /italic|oblique/.test(low) || !!(flags & 64), fam;
    if (/courier|mono|consol|typewriter/.test(low) || (flags & 1)) fam = "mono";
    else if (/times|serif|georgia|garamond|palatino|bookman|century|cambria|minion|roman/.test(low) && !/sans/.test(low)) fam = "serif";
    else if (/arial|helvetica|sans|verdana|tahoma|calibri|segoe|trebuchet/.test(low)) fam = "sans";
    else fam = flags & 2 ? "serif" : "sans";
    var css = fam === "mono" ? "'Courier New', Courier, 'Liberation Mono', 'DejaVu Sans Mono', monospace" : fam === "serif" ? "'Times New Roman', Times, 'Liberation Serif', 'DejaVu Serif', serif" : "Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif";
    var std = null;
    if (/^(arial|helvetica)/.test(low) && !/narrow|black|unicode/.test(low)) std = bold && italic ? "Helvetica-BoldOblique" : bold ? "Helvetica-Bold" : italic ? "Helvetica-Oblique" : "Helvetica";
    else if (/^(times|timesnewroman)/.test(low)) std = bold && italic ? "Times-BoldItalic" : bold ? "Times-Bold" : italic ? "Times-Italic" : "Times-Roman";
    else if (/^couriernew|^courier/.test(low)) std = "Courier" + (bold || italic ? "-" + (bold ? "Bold" : "") + (italic ? "Oblique" : "") : "");
    else if (/^symbol/.test(low)) std = "Symbol"; else if (/zapfdingbats/.test(low)) std = "ZapfDingbats";
    return { css: css, bold: bold, italic: italic, fam: fam, std: std };
  }
  var SYMBOL_U = (function () {
    var m = {}, up = "ΑΒΧΔΕΦΓΗΙϑΚΛΜΝΟΠΘΡΣΤΥςΩΞΨΖ", lo = "αβχδεφγηιϕκλμνοπθρστυϖωξψζ", i; for (i = 0; i < 26; i++) { m[65 + i] = up.charCodeAt(i); m[97 + i] = lo.charCodeAt(i); }
    var extra = { 0xa3: 0x2264, 0xa5: 0x221e, 0xb1: 0xb1, 0xb2: 0x2033, 0xb3: 0x2265, 0xb4: 0xd7, 0xb5: 0x221d, 0xb6: 0x2202, 0xb7: 0x2022, 0xb8: 0xf7, 0xb9: 0x2260, 0xba: 0x2261, 0xbb: 0x2248, 0xbc: 0x2026, 0xa2: 0x2032, 0xd0: 0x2220, 0xd1: 0x2207, 0xd5: 0x220f, 0xd6: 0x221a, 0xd7: 0x22c5, 0xd8: 0xac, 0xd9: 0x2227, 0xda: 0x2228, 0xe5: 0x2211, 0xf2: 0x222b, 0xaa: 0x2660, 0xa8: 0x2666, 0xa7: 0x2663, 0xa9: 0x2665, 0xac: 0x2190, 0xad: 0x2191, 0xae: 0x2192, 0xaf: 0x2193, 0xab: 0x2194, 0xc5: 0x2295, 0xc6: 0x2205, 0xc7: 0x2229, 0xc8: 0x222a, 0xce: 0x2208, 0xcf: 0x2209, 0xd3: 0xa9, 0xe4: 0x2122, 0x22: 0x2200, 0x24: 0x2203, 0x27: 0x220b, 0x2d: 0x2212, 0x40: 0x2245 };
    for (var k in extra) m[k] = extra[k]; return m;
  })();
  function pathToPath2D(path) {
    var p = new Path2D(), i = 0; while (i < path.length) { var o = path[i++]; if (o === 0) { p.moveTo(path[i], path[i + 1]); i += 2; } else if (o === 1) { p.lineTo(path[i], path[i + 1]); i += 2; } else if (o === 2) { p.bezierCurveTo(path[i], path[i + 1], path[i + 2], path[i + 3], path[i + 4], path[i + 5]); i += 6; } else p.closePath(); }
    return p;
  }
  /* parse a CMap stream: codespace ranges + cid ranges (or bf mappings for ToUnicode) */
  function parseCMap(doc, st, name) {
    var cm = { cs: [], cid: [], cidchar: new Map(), uni: new Map(), uniRanges: [], wmode: 0 }, txt = new TextDecoder("latin1").decode(doc.decodeStream(st));
    function hexv(h) { return parseInt(h, 16); }
    var m, re = /begincodespacerange([\s\S]*?)endcodespacerange/g;
    while ((m = re.exec(txt))) { var r = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g, q; while ((q = r.exec(m[1]))) cm.cs.push({ n: q[1].length / 2, lo: hexv(q[1]), hi: hexv(q[2]) }); }
    re = /begincidrange([\s\S]*?)endcidrange/g; while ((m = re.exec(txt))) { var r2 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(\d+)/g, q2; while ((q2 = r2.exec(m[1]))) cm.cid.push({ n: q2[1].length / 2, lo: hexv(q2[1]), hi: hexv(q2[2]), cid: +q2[3] }); }
    re = /begincidchar([\s\S]*?)endcidchar/g; while ((m = re.exec(txt))) { var r3 = /<([0-9a-fA-F]+)>\s*(\d+)/g, q3; while ((q3 = r3.exec(m[1]))) cm.cidchar.set(hexv(q3[1]) + ":" + q3[1].length / 2, +q3[2]); }
    re = /beginbfchar([\s\S]*?)endbfchar/g; while ((m = re.exec(txt))) { var r4 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g, q4; while ((q4 = r4.exec(m[1]))) cm.uni.set(hexv(q4[1]), uniStr(q4[2])); }
    re = /beginbfrange([\s\S]*?)endbfrange/g; while ((m = re.exec(txt))) {
      var r5 = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g, q5;
      while ((q5 = r5.exec(m[1]))) { var lo = hexv(q5[1]), hi = hexv(q5[2]); if (q5[3][0] === "[") { var ar = q5[3].match(/<([0-9a-fA-F]*)>/g) || []; for (var k = 0; k <= hi - lo && k < ar.length; k++) cm.uni.set(lo + k, uniStr(ar[k].slice(1, -1))); } else if (hi - lo < 65536) { var base = uniStr(q5[3].slice(1, -1)); for (var j = 0; j <= hi - lo; j++) { var cp = base.codePointAt(base.length - 1 > 0 && base.length > 1 && base.charCodeAt(0) >= 0xd800 ? 0 : base.length - 1); cm.uni.set(lo + j, base.length === 1 ? String.fromCharCode(base.charCodeAt(0) + j) : base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + j)); } } }
    }
    if (/\/WMode\s+1/.test(txt)) cm.wmode = 1; var uc = /\/Name\s*\/(\S+)/.exec(txt); return cm;
  }
  function uniStr(h) { var s = ""; for (var i = 0; i + 3 < h.length + 1; i += 4) s += String.fromCharCode(parseInt(h.substr(i, 4), 16)); return s; }

  var ENC_BASE = { StandardEncoding: DATA.std, WinAnsiEncoding: DATA.win, MacRomanEncoding: DATA.mac };
  function winMacInverse() { var m = {}; DATA.mac.forEach(function (n, c) { if (n && m[n] === undefined) m[n] = c; }); return m; }
  var MAC_INV = null;

  async function loadFont(doc, fdict, ctx) {
    var d = dictOf(doc.get(fdict)); if (!d) throw ViewError("FontError", "bad font"); var sub = gd(doc, d, "Subtype"), st = sub instanceof Name ? sub.n : "Type1", baseName = gd(doc, d, "BaseFont"), bn = baseName instanceof Name ? baseName.n : "";
    var F = { kind: "simple", bn: bn, widths: null, firstChar: 0, missingW: 0, enc: null, flags: 0, fm: [0.001, 0, 0, 0.001, 0, 0], embedded: null, sub: null, cache: new Map(), toUni: null };
    if (st === "Type3") return loadType3(doc, d, F);
    if (st === "Type0") return loadType0(doc, d, F);
    var desc = dictOf(gd(doc, d, "FontDescriptor")); F.flags = desc ? num(gd(doc, desc, "Flags"), 0) : 0;
    var fc = num(gd(doc, d, "FirstChar"), 0), ws = numArr(doc, d.get("Widths")); F.firstChar = fc; F.widths = ws; F.missingW = desc ? num(gd(doc, desc, "MissingWidth"), 0) : 0;
    /* encoding */
    var encObj = gd(doc, d, "Encoding"), baseEnc = null, diffs = null, hasEnc = false;
    if (encObj instanceof Name) { baseEnc = ENC_BASE[encObj.n] || null; hasEnc = !!baseEnc; }
    else if (dictOf(encObj)) { var be = gd(doc, encObj, "BaseEncoding"); if (be instanceof Name) baseEnc = ENC_BASE[be.n] || null; hasEnc = true; var df = arr(doc, dictOf(encObj).get("Differences")); if (df) { diffs = []; var c = 0; df.forEach(function (x) { if (typeof x === "number") c = x; else if (x instanceof Name) diffs[c++] = x.n; }); } }
    F.hasEnc = hasEnc; F.baseEncGiven = !!baseEnc; F.diffs = diffs;
    var subst = substitute(bn, F.flags); F.sub = subst;
    /* embedded program */
    var ff = desc && (doc.get(dictOf(desc).get("FontFile")) || doc.get(dictOf(desc).get("FontFile2")) || doc.get(dictOf(desc).get("FontFile3")));
    if (ff instanceof Stream) {
      try {
        var bytes = doc.decodeStream(ff), loaded = FONT.load(bytes, desc.get("FontFile") ? "type1" : undefined); F.embedded = loaded;
        if (loaded.kind === "sfnt" && loaded.font.cff && !loaded.font.t.glyf) { F.fm = loaded.font.cff.fontMatrix; }
        else if (loaded.kind === "sfnt") F.fm = [1 / loaded.font.unitsPerEm, 0, 0, 1 / loaded.font.unitsPerEm, 0, 0];
        else if (loaded.kind === "cff") F.fm = loaded.font.fontMatrix; else if (loaded.kind === "type1") F.fm = loaded.font.fontMatrix;
      } catch (e) { F.embedded = null; }
    }
    /* code -> glyph name table */
    var names = new Array(256).fill(""), bse = baseEnc;
    if (!bse) { if (F.embedded && F.embedded.kind === "type1") bse = F.embedded.font.encoding; else if (!F.embedded) bse = (subst.std === "Symbol" || subst.std === "ZapfDingbats") ? null : (st === "TrueType" && (F.flags & 32) ? DATA.win : DATA.std); else if (st === "TrueType") bse = DATA.win; else bse = null; }
    if (bse) for (var i = 0; i < 256; i++) names[i] = bse[i] || "";
    if (diffs) diffs.forEach(function (n, i) { if (n !== undefined) names[i] = n; });
    F.names = names;
    var tu = doc.get(d.get("ToUnicode")); if (tu instanceof Stream) { try { F.toUni = parseCMap(doc, tu); } catch (e) { /* ignore */ } }
    return F;
  }
  function loadType3(doc, d, F) {
    F.kind = "type3"; F.fm = numArr(doc, d.get("FontMatrix")) || [0.001, 0, 0, 0.001, 0, 0]; F.charProcs = dictOf(gd(doc, d, "CharProcs")); F.res = gd(doc, d, "Resources"); F.firstChar = num(gd(doc, d, "FirstChar"), 0); F.widths = numArr(doc, d.get("Widths"));
    var enc = gd(doc, d, "Encoding"), names = new Array(256).fill(""), dd = dictOf(enc); if (dd) { var df = arr(doc, dd.get("Differences")), c = 0; if (df) df.forEach(function (x) { if (typeof x === "number") c = x; else if (x instanceof Name) names[c++] = x.n; }); }
    F.names = names; F.type3 = true; return F;
  }
  async function loadType0(doc, d, F) {
    F.kind = "cid"; var desc0 = arr(doc, d.get("DescendantFonts")), cf = desc0 && dictOf(desc0[0]); if (!cf) throw ViewError("FontError", "no descendant font");
    var enc = gd(doc, d, "Encoding"), cm = null; F.identity = false;
    if (enc instanceof Name) { if (/^Identity/.test(enc.n)) F.identity = true; else F.predefinedCMap = enc.n; if (/-V$/.test(enc.n)) F.vertical = true; }
    else if (enc instanceof Stream) { cm = parseCMap(doc, enc); F.cmap = cm; }
    var fd = dictOf(gd(doc, cf, "FontDescriptor")), sub = gd(doc, cf, "Subtype"); F.cidType = sub instanceof Name ? sub.n : "CIDFontType2"; F.flags = fd ? num(gd(doc, fd, "Flags"), 0) : 0;
    F.dw = num(gd(doc, cf, "DW"), 1000); F.w = new Map(); var W = arr(doc, dictOf(cf).get("W"));
    if (W) { for (var i = 0; i < W.length;) { var c1 = W[i], nx = doc.get(W[i + 1]); if (Array.isArray(nx)) { nx.forEach(function (v, k) { F.w.set(c1 + k, num(doc.get(v), F.dw)); }); i += 2; } else { var c2 = nx, wv = num(doc.get(W[i + 2]), F.dw); if (c2 - c1 < 70000) for (var c = c1; c <= c2; c++) F.w.set(c, wv); i += 3; } } }
    F.sub = substitute(F.bn || (gd(doc, cf, "BaseFont") && gd(doc, cf, "BaseFont").n), F.flags);
    var ff = fd && (doc.get(dictOf(fd).get("FontFile2")) || doc.get(dictOf(fd).get("FontFile3")) || doc.get(dictOf(fd).get("FontFile")));
    if (ff instanceof Stream) { try { var loaded = FONT.load(doc.decodeStream(ff), fd.get("FontFile") ? "type1" : undefined); F.embedded = loaded; if (loaded.kind === "sfnt" && !(loaded.font.cff && !loaded.font.t.glyf)) F.fm = [1 / loaded.font.unitsPerEm, 0, 0, 1 / loaded.font.unitsPerEm, 0, 0]; else if (loaded.kind === "cff") F.fm = loaded.font.fontMatrix; else if (loaded.kind === "sfnt") F.fm = loaded.font.cff.fontMatrix; } catch (e) { F.embedded = null; } }
    var c2g = doc.get(dictOf(cf).get("CIDToGIDMap")); if (c2g instanceof Stream) F.c2g = doc.decodeStream(c2g);
    var tu = doc.get(d.get("ToUnicode")); if (tu instanceof Stream) { try { F.toUni = parseCMap(doc, tu); } catch (e) { /* ignore */ } }
    return F;
  }
  /* split a string into [{code, bytes}] for the font */
  function decodeText(F, b) {
    var out = [], i;
    if (F.kind !== "cid") { for (i = 0; i < b.length; i++) out.push({ code: b[i], cid: b[i], n: 1 }); return out; }
    var cm = F.cmap;
    if (!cm) { for (i = 0; i + 1 < b.length; i += 2) { var cd = (b[i] << 8) | b[i + 1]; out.push({ code: cd, cid: cd, n: 2 }); } return out; }
    var maxN = cm.cs.reduce(function (a, r) { return Math.max(a, r.n); }, 1);
    for (i = 0; i < b.length;) {
      var matched = false;
      for (var n = 1; n <= maxN && i + n <= b.length; n++) { var v = 0; for (var k = 0; k < n; k++) v = v * 256 + b[i + k]; if (cm.cs.some(function (r) { return r.n === n && v >= r.lo && v <= r.hi; })) { out.push({ code: v, n: n, cid: cmapCid(cm, v, n) }); i += n; matched = true; break; } }
      if (!matched) { out.push({ code: b[i], n: 1, cid: 0 }); i++; }
    }
    return out;
  }
  function cmapCid(cm, v, n) { var cc = cm.cidchar.get(v + ":" + n); if (cc !== undefined) return cc; for (var i = 0; i < cm.cid.length; i++) { var r = cm.cid[i]; if (r.n === n && v >= r.lo && v <= r.hi) return r.cid + v - r.lo; } return 0; }

  /* width in 1/1000 em */
  function glyphWidth(F, u) {
    if (F.kind === "cid") { var w = F.w.get(u.cid); return w === undefined ? F.dw : w; }
    if (F.type3) { var i3 = u.code - F.firstChar; return F.widths && F.widths[i3] !== undefined ? F.widths[i3] * F.fm[0] * 1000 : 0; }
    var i = u.code - F.firstChar; if (F.widths && i >= 0 && i < F.widths.length && typeof F.widths[i] === "number") return F.widths[i];
    if (!F.embedded && F.sub.std) { var wv = stdWidth(F, u.code); if (wv !== undefined) return wv; }
    if (F.embedded && !(F.widths && F.widths.length)) { var g = embeddedGlyph(F, u); if (g && g.adv !== undefined) return g.adv; }
    return F.missingW;
  }
  function stdWidth(F, code) {
    var tbl = P.util.afm && P.util.afm(F.sub.std); if (!tbl) return F.sub.std.indexOf("Courier") === 0 ? 600 : undefined;
    var nm = F.names[code], uc = nm ? DATA.uni(nm) : undefined; if (uc === undefined || uc < 32 || uc > 255) { var cp = DATA.win.indexOf(nm); uc = cp > 0 ? cp : undefined; } return uc !== undefined ? tbl[uc - 32] : undefined;
  }
  /* returns {p:Path2D, adv:(1/1000 em) or undefined, m:matrix} for an embedded glyph */
  function embeddedGlyph(F, u) {
    var key = F.kind === "cid" ? u.cid : u.code, hit = F.cache.get(key); if (hit !== undefined) return hit;
    var e = F.embedded, res = null, path = null, adv, fm = F.fm;
    try {
      if (e.kind === "type1") {
        var nm = F.names[u.code] || e.font.encoding[u.code]; if (!e.font.has(nm)) nm = e.font.encoding[u.code]; if (e.font.has(nm)) { var r = e.font.path(nm); path = r.path; adv = r.width * e.font.fontMatrix[0] * 1000; }
      } else if (e.kind === "cff") {
        var cff = e.font, gid = 0;
        if (F.kind === "cid") { gid = cff.isCID ? cff.gidForCid(u.cid) : (F.c2g ? ((F.c2g[u.cid * 2] << 8) | F.c2g[u.cid * 2 + 1]) : u.cid); }
        else { var nm2 = F.names[u.code]; gid = nm2 ? cff.gidForName(nm2) : 0; if (!gid && cff.encoding) gid = cff.encoding[u.code] || 0; if (!gid && cff.isCID) gid = u.code; }
        var rr = cff.path(gid); path = rr.path; adv = rr.width * cff.fontMatrix[0] * 1000; if (rr.fm) fm = mul(rr.fm, F.fm);
      } else if (e.kind === "sfnt") {
        var tt = e.font, gid2 = 0;
        if (F.kind === "cid") {
          if (F.c2g) gid2 = (F.c2g[u.cid * 2] << 8) | F.c2g[u.cid * 2 + 1]; else if (tt.cff && !tt.t.glyf) gid2 = tt.cff.isCID ? tt.cff.gidForCid(u.cid) : u.cid; else gid2 = u.cid;
        } else gid2 = ttGid(F, tt, u.code);
        if (tt.cff && !tt.t.glyf) { var r3 = tt.cff.path(gid2); path = r3.path; fm = tt.cff.fontMatrix; } else path = tt.path(gid2);
        adv = tt.advance(gid2) * 1000 / tt.unitsPerEm;
      }
    } catch (err) { path = null; }
    if (path) res = { p: pathToPath2D(path), adv: adv, fm: fm, empty: !path.length };
    F.cache.set(key, res || null); return res || null;
  }
  function ttGid(F, tt, code) {
    var nm = F.names[code], g = 0, c;
    if (F.hasEnc && !(F.flags & 4) && nm) {
      var uc = DATA.uni(nm); var c31 = tt.cmap(3, 1) || tt.cmap(0); if (uc !== undefined && c31) g = tt.lookup(c31, uc);
      if (!g) { var c10 = tt.cmap(1, 0); if (c10) { MAC_INV = MAC_INV || winMacInverse(); var mc = MAC_INV[nm]; if (mc !== undefined) g = tt.lookup(c10, mc); } }
      if (!g) { var pg = tt.postNames()[nm]; if (pg) g = pg; }
      if (g) return g;
    }
    c = tt.cmap(3, 0); if (c) { g = tt.lookup(c, code) || tt.lookup(c, 0xf000 + code) || tt.lookup(c, 0xf100 + code) || tt.lookup(c, 0xf200 + code); if (g) return g; }
    c = tt.cmap(1, 0); if (c) { g = tt.lookup(c, code); if (g) return g; }
    c = tt.cmap(3, 1) || tt.cmap(0); if (c) { g = tt.lookup(c, code); if (nm && !g) { var u2 = DATA.uni(nm); if (u2 !== undefined) g = tt.lookup(c, u2); } if (g) return g; }
    if (nm) { var pg2 = tt.postNames()[nm]; if (pg2) return pg2; }
    return tt.cmaps.length ? 0 : code;
  }
  /* the character to draw when no font program is available */
  function fallbackChar(F, u) {
    if (F.kind === "cid") { if (F.toUni) { var s = F.toUni.uni.get(u.code); if (s) return s; } return ""; }
    var nm = F.names[u.code]; if (F.sub.std === "Symbol") { var sy = SYMBOL_U[u.code]; if (sy) return String.fromCharCode(sy); }
    if (nm) { var uc = DATA.uni(nm); if (uc !== undefined) return String.fromCodePoint(uc); }
    if (F.toUni) { var s2 = F.toUni.uni.get(u.code); if (s2) return s2; }
    return u.code >= 32 ? String.fromCharCode(u.code) : "";
  }

  /* ================= content stream tokenizer ================= */
  var WS = { 0: 1, 9: 1, 10: 1, 12: 1, 13: 1, 32: 1 }, DL = { 40: 1, 41: 1, 60: 1, 62: 1, 91: 1, 93: 1, 123: 1, 125: 1, 47: 1, 37: 1 };
  function Lexer(b, doc) { this.p = new P.util.Parser(b, 0, doc); this.b = b; }
  /* returns {op:"name"} for keywords, or an object/number/array */
  Lexer.prototype.next = function () {
    var p = this.p, b = this.b; p.ws(); if (p.p >= b.length) return undefined; var c = b[p.p];
    if (c === 41 || c === 62 || c === 93 || c === 125 || c === 123) { p.p++; return { op: String.fromCharCode(c) }; }
    if (c === 47 || c === 40 || c === 91 || (c === 60)) { try { return p.obj(); } catch (e) { p.p++; return null; } }
    if ((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46) { var s0 = p.p; try { var nv = p.obj(); if (nv instanceof Ref) { p.p = s0; while (p.p < b.length && !WS[b[p.p]] && !DL[b[p.p]]) p.p++; return num0(b, s0, p.p); } return nv; } catch (e) { p.p++; return 0; } }
    var s = p.p; while (p.p < b.length && !WS[b[p.p]] && !DL[b[p.p]]) p.p++; if (p.p === s) p.p++;
    return { op: String.fromCharCode.apply(null, b.subarray(s, p.p)) };
  };
  function num0(b, s, e) { return parseFloat(String.fromCharCode.apply(null, b.subarray(s, e))) || 0; }

  var BLEND = { Normal: "source-over", Compatible: "source-over", Multiply: "multiply", Screen: "screen", Overlay: "overlay", Darken: "darken", Lighten: "lighten", ColorDodge: "color-dodge", ColorBurn: "color-burn", HardLight: "hard-light", SoftLight: "soft-light", Difference: "difference", Exclusion: "exclusion", Hue: "hue", Saturation: "saturation", Color: "color", Luminosity: "luminosity" };
  function newGS(ctm) { return { ctm: ctm, fillCS: CS_GRAY, strokeCS: CS_GRAY, fill: "#000000", stroke: "#000000", fillPat: null, strokePat: null, lw: 1, cap: 0, join: 0, miter: 10, dash: [], dashPhase: 0, fa: 1, sa: 1, blend: "source-over", smask: null,
    font: null, fs: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, Ts: 0, Tr: 0, hidden: false }; }
  function rgbStr(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }

  function Renderer(doc, ctx, base, shared, opt) {
    this.doc = doc; this.ctx = ctx; this.base = base; this.sh = shared; this.opt = opt || {}; this.gs = newGS(base); this.stack = []; this.depth = 0;
    this.path = null; this.pendingClip = null; this.text = null; this.clipText = null; this.cancelled = false; this.ops = 0; this.t0 = Date.now(); this.patBase = base; this.ignoreColor = false; this.mc = []; this.hiddenDepth = 0;
  }
  Renderer.prototype.yieldIf = async function () {
    if (this.cancelled) throw ViewError("RenderingCancelled", "cancelled");
    if (++this.ops % 400 === 0 && Date.now() - this.t0 > 30) { await new Promise(function (r) { setTimeout(r, 0); }); this.t0 = Date.now(); if (this.cancelled) throw ViewError("RenderingCancelled", "cancelled"); }
  };
  Renderer.prototype.setT = function (m) { this.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); };
  Renderer.prototype.applyGS = function () {
    var c = this.ctx, g = this.gs; c.lineWidth = Math.max(g.lw, 0); c.lineCap = ["butt", "round", "square"][g.cap] || "butt"; c.lineJoin = ["miter", "round", "bevel"][g.join] || "miter"; c.miterLimit = g.miter || 10;
    try { c.setLineDash(g.dash); c.lineDashOffset = g.dashPhase; } catch (e) { /* ignore */ } c.globalCompositeOperation = g.blend;
  };
  /* run a content stream */
  Renderer.prototype.run = async function (bytes, res) {
    var lx = new Lexer(bytes, this.doc), args = [], self = this, doc = this.doc, stackBase = this.stack.length;
    for (;;) {
      var t = lx.next(); if (t === undefined) break;
      if (t && typeof t === "object" && typeof t.op === "string" && !(t instanceof Name) && !(t instanceof Dict)) {
        var op = t.op;
        if (op === "BI") { try { await this.inlineImage(lx, res); } catch (e) { if (e && e.name === "RenderingCancelled") throw e; } args = []; continue; }
        try { var r = this.exec(op, args, res); if (r && typeof r.then === "function") await r; } catch (e) { if (e && e.name === "RenderingCancelled") throw e; if (root.DTA_PDF_DEBUG) console.warn("pdf op " + op, e); }
        args = []; await this.yieldIf();
      } else { args.push(t); if (args.length > 64) args.shift(); }
    }
    while (this.stack.length > stackBase) this.restore();
  };
  Renderer.prototype.save = function () { this.ctx.save(); this.stack.push(this.gs); var n = Object.assign({}, this.gs); this.gs = n; };
  Renderer.prototype.restore = function () { if (!this.stack.length) return; this.ctx.restore(); this.gs = this.stack.pop(); this.applyGS(); };
  Renderer.prototype.vis = function () { return !this.hiddenDepth; };
  Renderer.prototype.exec = function (op, a, res) {
    var gs = this.gs, ctx = this.ctx, doc = this.doc, n = a.length, i;
    switch (op) {
      case "q": this.save(); break;
      case "Q": this.restore(); break;
      case "cm": if (n >= 6) { gs.ctm = mul(a.slice(-6), gs.ctm); this.setT(gs.ctm); } break;
      case "w": gs.lw = a[n - 1]; ctx.lineWidth = gs.lw; break;
      case "J": gs.cap = a[n - 1]; this.applyGS(); break; case "j": gs.join = a[n - 1]; this.applyGS(); break; case "M": gs.miter = a[n - 1]; this.applyGS(); break;
      case "d": { var da = Array.isArray(a[n - 2]) ? a[n - 2] : []; gs.dash = da.some(function (x) { return !(x >= 0); }) || da.every(function (x) { return x === 0; }) ? [] : (da.length % 2 ? da.concat(da) : da); gs.dashPhase = a[n - 1] || 0; this.applyGS(); break; }
      case "ri": case "i": case "BX": case "EX": case "MP": case "DP": break;
      case "gs": return this.setExtGState(a[n - 1], res);
      /* path construction */
      case "m": this.p().moveTo(a[n - 2], a[n - 1]); this.cur = [a[n - 2], a[n - 1]]; break;
      case "l": this.p().lineTo(a[n - 2], a[n - 1]); this.cur = [a[n - 2], a[n - 1]]; break;
      case "c": this.p().bezierCurveTo(a[n - 6], a[n - 5], a[n - 4], a[n - 3], a[n - 2], a[n - 1]); this.cur = [a[n - 2], a[n - 1]]; break;
      case "v": { var cu = this.cur || [a[n - 4], a[n - 3]]; this.p().bezierCurveTo(cu[0], cu[1], a[n - 4], a[n - 3], a[n - 2], a[n - 1]); this.cur = [a[n - 2], a[n - 1]]; break; }
      case "y": this.p().bezierCurveTo(a[n - 4], a[n - 3], a[n - 2], a[n - 1], a[n - 2], a[n - 1]); this.cur = [a[n - 2], a[n - 1]]; break;
      case "h": this.p().closePath(); break;
      case "re": { var x = a[n - 4], y = a[n - 3], w = a[n - 2], h = a[n - 1], p = this.p(); p.moveTo(x, y); p.lineTo(x + w, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath(); this.cur = [x, y]; break; }
      /* painting */
      case "S": return this.paintPath(false, true, false, false); case "s": this.p().closePath(); return this.paintPath(false, true, false, false);
      case "f": case "F": return this.paintPath(true, false, false, false); case "f*": return this.paintPath(true, false, true, false);
      case "B": return this.paintPath(true, true, false, false); case "B*": return this.paintPath(true, true, true, false);
      case "b": this.p().closePath(); return this.paintPath(true, true, false, false); case "b*": this.p().closePath(); return this.paintPath(true, true, true, false);
      case "n": return this.paintPath(false, false, false, false);
      case "W": this.pendingClip = "nonzero"; break; case "W*": this.pendingClip = "evenodd"; break;
      /* colour */
      case "g": this.setCS(false, CS_GRAY, a.slice(-1)); break; case "G": this.setCS(true, CS_GRAY, a.slice(-1)); break;
      case "rg": this.setCS(false, CS_RGB, a.slice(-3)); break; case "RG": this.setCS(true, CS_RGB, a.slice(-3)); break;
      case "k": this.setCS(false, CS_CMYK, a.slice(-4)); break; case "K": this.setCS(true, CS_CMYK, a.slice(-4)); break;
      case "cs": case "CS": { var st = op === "CS", cs = parseCS(doc, a[n - 1], res); if (st) { gs.strokeCS = cs; gs.stroke = cs.name === "Pattern" ? "#000000" : rgbStr(cs.rgb(cs.init)); gs.strokePat = null; } else { gs.fillCS = cs; gs.fill = cs.name === "Pattern" ? "#000000" : rgbStr(cs.rgb(cs.init)); gs.fillPat = null; } break; }
      case "sc": case "scn": case "SC": case "SCN": return this.setColorN(op[0] === "S", a, res);
      case "sh": return this.shadingOp(a[n - 1], res);
      case "Do": return this.doXObject(a[n - 1], res);
      /* text */
      case "BT": this.tm = [1, 0, 0, 1, 0, 0]; this.tlm = [1, 0, 0, 1, 0, 0]; this.clipText = null; break;
      case "ET": if (this.clipText) { var cp = this.clipText; this.clipText = null; ctx.save(); /* clip applies to the rest of the stream */ ctx.restore(); this.applyTextClip(cp); } break;
      case "Tc": gs.Tc = a[n - 1]; break; case "Tw": gs.Tw = a[n - 1]; break; case "Tz": gs.Th = a[n - 1] / 100; break; case "TL": gs.TL = a[n - 1]; break; case "Tr": gs.Tr = a[n - 1]; break; case "Ts": gs.Ts = a[n - 1]; break;
      case "Tf": return this.setFont(a[n - 2], a[n - 1], res);
      case "Td": this.tlm = mul([1, 0, 0, 1, a[n - 2], a[n - 1]], this.tlm || [1, 0, 0, 1, 0, 0]); this.tm = this.tlm.slice(); break;
      case "TD": gs.TL = -a[n - 1]; this.tlm = mul([1, 0, 0, 1, a[n - 2], a[n - 1]], this.tlm || [1, 0, 0, 1, 0, 0]); this.tm = this.tlm.slice(); break;
      case "Tm": this.tm = a.slice(-6); this.tlm = this.tm.slice(); break;
      case "T*": this.tlm = mul([1, 0, 0, 1, 0, -gs.TL], this.tlm || [1, 0, 0, 1, 0, 0]); this.tm = this.tlm.slice(); break;
      case "Tj": return this.showText(a[n - 1]);
      case "'": this.tlm = mul([1, 0, 0, 1, 0, -gs.TL], this.tlm || [1, 0, 0, 1, 0, 0]); this.tm = this.tlm.slice(); return this.showText(a[n - 1]);
      case "\"": gs.Tw = a[n - 3]; gs.Tc = a[n - 2]; this.tlm = mul([1, 0, 0, 1, 0, -gs.TL], this.tlm || [1, 0, 0, 1, 0, 0]); this.tm = this.tlm.slice(); return this.showText(a[n - 1]);
      case "TJ": return this.showTJ(a[n - 1]);
      case "d0": break; case "d1": this.ignoreColor = true; break;
      /* marked content */
      case "BMC": this.mc.push(false); break;
      case "BDC": { var hid = false, tag = a[n - 2], pr = a[n - 1]; if (tag instanceof Name && tag.n === "OC") { var pd = pr instanceof Name ? gd(doc, gd(doc, res, "Properties"), pr.n) : pr; hid = this.sh.ocHidden(pd); } this.mc.push(hid); if (hid) this.hiddenDepth++; break; }
      case "EMC": { var hh = this.mc.pop(); if (hh) this.hiddenDepth--; break; }
      default: break;
    }
  };
  Renderer.prototype.p = function () { if (!this.path) { this.path = new Path2D(); } return this.path; };
  Renderer.prototype.setCS = function (stroke, cs, comps) {
    if (this.ignoreColor) return; var gs = this.gs, css = rgbStr(cs.rgb(comps));
    if (stroke) { gs.strokeCS = cs; gs.stroke = css; gs.strokePat = null; } else { gs.fillCS = cs; gs.fill = css; gs.fillPat = null; }
  };
  Renderer.prototype.setColorN = function (stroke, a, res) {
    if (this.ignoreColor) return; var gs = this.gs, cs = stroke ? gs.strokeCS : gs.fillCS, last = a[a.length - 1];
    if (cs.name === "Pattern") {
      if (last instanceof Name) {
        var pat = gd(this.doc, gd(this.doc, res, "Pattern"), last.n), comps = a.slice(0, -1).filter(function (x) { return typeof x === "number"; }), col = cs.base && comps.length ? rgbStr(cs.base.rgb(comps)) : null;
        var po = { obj: pat, color: col, res: res, base: this.patBase };
        if (stroke) { gs.strokePat = po; } else { gs.fillPat = po; }
      }
      return;
    }
    var comps2 = a.filter(function (x) { return typeof x === "number"; }).slice(-Math.max(cs.n, 1)); while (comps2.length < cs.n) comps2.push(0);
    if (cs.none) return; this.setCS(stroke, cs, comps2); if (stroke) gs.strokeCS = cs; else gs.fillCS = cs;
  };
  Renderer.prototype.fillStyle = async function (stroke) {
    var gs = this.gs, pat = stroke ? gs.strokePat : gs.fillPat;
    if (pat) { var st = await this.makePattern(pat); if (st) return st; }
    return stroke ? gs.stroke : gs.fill;
  };
  Renderer.prototype.paint = async function (fn) {
    if (!this.gs.smask) return fn(this.ctx);
    var sm = this.gs.smask, main = this.ctx, cv = canvasOf(main.canvas.width, main.canvas.height), c2 = cv.getContext("2d");
    c2.setTransform(main.getTransform()); this.ctx = c2; this.applyGS();
    try { await fn(c2); } finally { this.ctx = main; }
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = "destination-in"; c2.globalAlpha = 1; c2.drawImage(sm.canvas, 0, 0);
    main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = 1; main.globalCompositeOperation = this.gs.blend; main.drawImage(cv, 0, 0); main.restore();
  };
  Renderer.prototype.paintPath = async function (fill, stroke, eo, _) {
    var path = this.path, gs = this.gs, ctx = this.ctx, clip = this.pendingClip; this.path = null; this.pendingClip = null; this.cur = null;
    if (!path) return;
    if (this.vis() && (fill || stroke)) {
      var fs = fill ? await this.fillStyle(false) : null, ss = stroke ? await this.fillStyle(true) : null, self = this;
      await this.paint(async function (c) {
        if (fill && !(gs.fillCS.none)) { if (fs && fs.shading) await self.fillShading(c, path, fs, eo ? "evenodd" : "nonzero"); else { c.globalAlpha = gs.fa; c.fillStyle = fs; c.fill(path, eo ? "evenodd" : "nonzero"); } }
        if (stroke && !(gs.strokeCS.none)) { c.globalAlpha = gs.sa; if (ss && ss.shading) { /* shading strokes are rare: use mid colour */ c.strokeStyle = "#808080"; } else c.strokeStyle = ss; var lw = gs.lw; if (lw <= 0) { var sc = Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2])) || 1; c.lineWidth = 1 / sc; } else c.lineWidth = lw; c.stroke(path); }
        c.globalAlpha = 1;
      });
    }
    if (clip) ctx.clip(path, clip);
  };
  Renderer.prototype.setExtGState = async function (name, res) {
    var doc = this.doc, d = dictOf(gd(doc, gd(doc, res, "ExtGState"), name instanceof Name ? name.n : "")); if (!d) return; var gs = this.gs, self = this;
    for (var k of d.keys()) {
      var v = doc.get(d.get(k));
      switch (k) {
        case "LW": gs.lw = v; break; case "LC": gs.cap = v; break; case "LJ": gs.join = v; break; case "ML": gs.miter = v; break;
        case "D": if (Array.isArray(v)) { var da = (doc.get(v[0]) || []).map(function (x) { return doc.get(x); }); gs.dash = da.every(function (x) { return x === 0; }) ? [] : (da.length % 2 ? da.concat(da) : da); gs.dashPhase = num(doc.get(v[1]), 0); } break;
        case "CA": gs.sa = num(v, 1); break; case "ca": gs.fa = num(v, 1); break;
        case "BM": { var bm = Array.isArray(v) ? doc.get(v[0]) : v; gs.blend = bm instanceof Name ? BLEND[bm.n] || "source-over" : "source-over"; break; }
        case "Font": if (Array.isArray(v)) { var fo = v[0]; gs.font = await this.sh.font(fo); gs.fs = num(doc.get(v[1]), 0); } break;
        case "SMask": if (v instanceof Name) gs.smask = null; else if (dictOf(v)) { try { gs.smask = await this.makeSMask(dictOf(v), res); } catch (e) { if (root.DTA_PDF_DEBUG) console.warn("smask", e && e.stack); gs.smask = null; } } break;
      }
    }
    this.applyGS();
  };
  Renderer.prototype.makeSMask = async function (sd, res) {
    var doc = this.doc, g = doc.get(sd.get("G")); if (!(g instanceof Stream)) return null;
    var type = gd(doc, sd, "S"), lum = type instanceof Name && type.n === "Luminosity", main = this.ctx, w = main.canvas.width, h = main.canvas.height, cv = canvasOf(w, h), c2 = cv.getContext("2d");
    var bcArr = numArr(doc, sd.get("BC")), bc = [0, 0, 0]; var gcs = null; var grp = dictOf(gd(doc, g.dict, "Group")); if (grp && grp.has("CS")) gcs = parseCS(doc, grp.get("CS"), res); if (bcArr && gcs) bc = gcs.rgb(bcArr); else if (bcArr && bcArr.length === 1) bc = CS_GRAY.rgb(bcArr); else if (bcArr && bcArr.length === 3) bc = CS_RGB.rgb(bcArr);
    if (lum) { c2.fillStyle = rgbStr(bc); c2.fillRect(0, 0, w, h); }
    var sub = new Renderer(doc, c2, this.gs.ctm, this.sh, this.opt); sub.setT(this.gs.ctm); sub.depth = this.depth + 1; if (sub.depth > 12) return null; sub.patBase = this.patBase;
    await sub.drawForm(g, res);
    var id = c2.getImageData(0, 0, w, h), px = id.data, out = c2.createImageData(w, h), od = out.data, tr = sd.get("TR") ? makeFunction(doc, sd.get("TR")) : null;
    for (var i = 0; i < px.length; i += 4) { var a = lum ? (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255 : px[i + 3] / 255; if (tr && gd(doc, sd, "TR") instanceof Dict) a = tr.ev([a])[0]; od[i + 3] = Math.round(clamp(a, 0, 1) * 255); }
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, w, h); c2.putImageData(out, 0, 0); return { canvas: cv };
  };
  /* ---------- XObjects ---------- */
  Renderer.prototype.drawForm = async function (st, res) {
    var doc = this.doc, d = st.dict; if (this.depth > 14) return;
    var m = numArr(doc, d.get("Matrix")) || [1, 0, 0, 1, 0, 0], bb = numArr(doc, d.get("BBox")), fres = gd(doc, d, "Resources") || res, ctx = this.ctx;
    this.save(); this.depth++; var oldPB = this.patBase, oldText = [this.tm, this.tlm]; this.gs.ctm = mul(m, this.gs.ctm); this.patBase = this.gs.ctm; this.setT(this.gs.ctm);
    if (bb && bb.length >= 4) { var cp = new Path2D(); cp.rect(Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3]), Math.abs(bb[2] - bb[0]), Math.abs(bb[3] - bb[1])); ctx.clip(cp); }
    var savePath = this.path; this.path = null;
    try { await this.run(doc.decodeStream(st), fres); } finally { this.path = savePath; this.depth--; this.patBase = oldPB; this.tm = oldText[0]; this.tlm = oldText[1]; this.restore(); }
  };
  Renderer.prototype.doXObject = async function (nm, res) {
    var doc = this.doc, x = gd(doc, gd(doc, res, "XObject"), nm instanceof Name ? nm.n : ""); if (!(x instanceof Stream)) return;
    var sub = gd(doc, x.dict, "Subtype"), oc = x.dict.get("OC"); if (oc && this.sh.ocHidden(oc)) return;
    if (!this.vis()) return;
    if (sub instanceof Name && sub.n === "Form") {
      var self = this, gs0 = this.gs, grp = dictOf(gd(doc, x.dict, "Group"));
      if (grp && (gs0.fa < 1 || gs0.blend !== "source-over" || gs0.smask) && this.depth < 10) { /* a transparency group is composited as one object */
        var main = this.ctx, layer = canvasOf(main.canvas.width, main.canvas.height), lc = layer.getContext("2d"), sr = new Renderer(doc, lc, gs0.ctm, this.sh, this.opt);
        sr.gs = Object.assign({}, gs0, { fa: 1, sa: 1, blend: "source-over", smask: null }); sr.depth = this.depth + 1; sr.patBase = this.patBase; sr.curRes = this.curRes; sr.hiddenDepth = this.hiddenDepth; sr.cancelled = this.cancelled; sr.setT(gs0.ctm);
        await sr.drawForm(x, res);
        return this.paint(function () { main.save(); main.setTransform(1, 0, 0, 1, 0, 0); main.globalAlpha = gs0.fa; main.globalCompositeOperation = gs0.blend; main.drawImage(layer, 0, 0); main.restore(); });
      }
      return this.paint(function () { return self.drawForm(x, res); });
    }
    if (sub instanceof Name && sub.n === "Image") return this.drawImage(x, res);
  };
  Renderer.prototype.drawImage = async function (st, res) {
    var doc = this.doc, gs = this.gs, self = this, img;
    var isMask = gd(doc, st.dict, "ImageMask") === true || gd(doc, st.dict, "IM") === true;
    var col = isMask ? (gs.fill && /^rgb\((\d+),(\d+),(\d+)\)/.exec(gs.fill)) : null; col = col ? [+col[1], +col[2], +col[3]] : [0, 0, 0];
    var key = st; var cached = this.sh.imgCache.get(st);
    if (cached && !isMask) img = cached;
    else {
      try { img = await decodeRaster(doc, st, res, { color: col }); } catch (e) { if (e && e.name === "RenderingCancelled") throw e; img = null; if (e && e.name === "Unsupported") img = { placeholder: true }; }
      if (img && !isMask && !img.placeholder && img.w * img.h < 4e6) this.sh.imgCache.set(st, img);
    }
    if (!img) return;
    await this.paint(async function (c) {
      c.save(); c.globalAlpha = gs.fa; c.transform(1, 0, 0, -1, 0, 1);
      if (img.placeholder) { c.fillStyle = "#e6e6e6"; c.fillRect(0, 0, 1, 1); c.restore(); return; }
      var cv = canvasOf(img.w, img.h), cx = cv.getContext("2d"), id = cx.createImageData(img.w, img.h); id.data.set(img.rgba); cx.putImageData(id, 0, 0);
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(cv, 0, 0, 1, 1); c.restore();
    });
  };
  Renderer.prototype.inlineImage = async function (lx, res) {
    var doc = this.doc, d = new Dict(), p = lx.p, b = lx.b, ABB = { BPC: "BitsPerComponent", CS: "ColorSpace", D: "Decode", DP: "DecodeParms", F: "Filter", H: "Height", IM: "ImageMask", I: "Interpolate", W: "Width" };
    var VAL = { G: "DeviceGray", RGB: "DeviceRGB", CMYK: "DeviceCMYK", I: "Indexed", AHx: "ASCIIHexDecode", A85: "ASCII85Decode", LZW: "LZWDecode", Fl: "FlateDecode", RL: "RunLengthDecode", CCF: "CCITTFaxDecode", DCT: "DCTDecode" };
    for (;;) { var k = lx.next(); if (k === undefined) return; if (k && k.op === "ID") break; if (!(k instanceof Name)) continue; var v = lx.next(); if (v && v.op === "ID") break; var key = ABB[k.n] || k.n; if (v instanceof Name && VAL[v.n] && key !== "Filter") v = new Name(VAL[v.n]); if (key === "Filter") { if (v instanceof Name && VAL[v.n]) v = new Name(VAL[v.n]); else if (Array.isArray(v)) v = v.map(function (x) { return x instanceof Name && VAL[x.n] ? new Name(VAL[x.n]) : x; }); } if (key === "ColorSpace" && Array.isArray(v) && v[0] instanceof Name && VAL[v[0].n]) v[0] = new Name(VAL[v[0].n]); d.set(key, v); }
    p.p++; var start = p.p, w = num(d.get("Width"), 0), h = num(d.get("Height"), 0), end = -1;
    if (!d.has("Filter")) { var bpc = d.get("ImageMask") === true ? 1 : num(d.get("BitsPerComponent"), 8), cs = d.get("ImageMask") === true ? CS_GRAY : parseCS(doc, d.get("ColorSpace"), res), len = Math.ceil(w * (cs.n || 1) * bpc / 8) * h; end = start + len; }
    if (end < 0 || end > b.length) { end = start; while (end < b.length) { if (b[end] === 69 && b[end + 1] === 73 && (end === start || WS[b[end - 1]]) && (end + 2 >= b.length || WS[b[end + 2]] || DL[b[end + 2]])) break; end++; } }
    var raw = b.subarray(start, end); p.p = end; var q = end; while (q < b.length && WS[b[q]]) q++; if (b[q] === 69 && b[q + 1] === 73) p.p = q + 2;
    if (!this.vis()) return; await this.drawImage(new Stream(d, raw), res);
  };

  /* ---------- patterns and shadings ---------- */
  Renderer.prototype.makePattern = async function (po) {
    var doc = this.doc, st = po.obj, d = dictOf(st); if (!d) return null; var pt = num(gd(doc, d, "PatternType"), 1);
    var mt = numArr(doc, d.get("Matrix")) || [1, 0, 0, 1, 0, 0], M = mul(mt, po.base);
    if (pt === 2) { var sh = gd(doc, d, "Shading"); return { shading: sh, matrix: M, res: po.res, ext: gd(doc, d, "ExtGState") }; }
    if (!(st instanceof Stream)) return null;
    var bb = numArr(doc, d.get("BBox")) || [0, 0, 1, 1], xs = num(gd(doc, d, "XStep"), bb[2] - bb[0]) || (bb[2] - bb[0]) || 1, ys = num(gd(doc, d, "YStep"), bb[3] - bb[1]) || (bb[3] - bb[1]) || 1, ptype = num(gd(doc, d, "PaintType"), 1);
    var sx = Math.hypot(M[0], M[1]), sy = Math.hypot(M[2], M[3]), tw = clamp(Math.ceil(Math.abs(xs) * sx), 1, 3000), th = clamp(Math.ceil(Math.abs(ys) * sy), 1, 3000), key = tw + "x" + th + (ptype === 2 ? po.color : "");
    var cache = this.sh.patCache.get(st) || {}; this.sh.patCache.set(st, cache); var tile = cache[key];
    if (!tile) {
      tile = canvasOf(tw, th); var tc = tile.getContext("2d"), tm = [tw / Math.abs(xs), 0, 0, th / Math.abs(ys), -Math.min(bb[0], bb[2]) * tw / Math.abs(xs), -Math.min(bb[1], bb[3]) * th / Math.abs(ys)];
      var sub = new Renderer(doc, tc, tm, this.sh, this.opt); sub.depth = this.depth + 1; if (sub.depth > 8) return null; sub.setT(tm); if (ptype === 2 && po.color) { sub.gs.fill = po.color; sub.gs.stroke = po.color; sub.ignoreColor = true; }
      var cp = new Path2D(); cp.rect(Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3]), Math.abs(bb[2] - bb[0]), Math.abs(bb[3] - bb[1])); tc.clip(cp);
      try { await sub.run(doc.decodeStream(st), gd(doc, d, "Resources") || po.res); } catch (e) { if (e && e.name === "RenderingCancelled") throw e; }
      cache[key] = tile;
    }
    var pat = this.ctx.createPattern(tile, "repeat"); if (!pat) return null;
    var full = mul([Math.abs(xs) / tw, 0, 0, Math.abs(ys) / th, Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3])], M), cur = this.gs.ctm, pm = mul(full, inv(cur));
    try { pat.setTransform(new DOMMatrix([pm[0], pm[1], pm[2], pm[3], pm[4], pm[5]])); } catch (e) { return null; }
    return pat;
  };
  function shadingColor(doc, sh, res) {
    var d = dictOf(sh), cs = parseCS(doc, d.get("ColorSpace"), res), fo = d.get("Function") ? makeFunction(doc, d.get("Function")) : null;
    return function (t) { var comps = fo ? fo.ev([t]) : [t]; while (comps.length < cs.n) comps.push(0); return cs.rgb(comps); };
  }
  /* paint a shading into the current clip using the given shading-space -> device matrix */
  Renderer.prototype.paintShading = async function (c, sh, M, res) {
    var doc = this.doc, d = dictOf(sh); if (!d) return; var type = num(gd(doc, d, "ShadingType"), 0), cs = parseCS(doc, d.get("ColorSpace"), res), bb = numArr(doc, d.get("BBox"));
    var w = c.canvas.width, h = c.canvas.height; c.save(); c.setTransform(M[0], M[1], M[2], M[3], M[4], M[5]);
    if (bb && bb.length >= 4) { var cp = new Path2D(); cp.rect(Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3]), Math.abs(bb[2] - bb[0]), Math.abs(bb[3] - bb[1])); c.clip(cp); }
    var iv = inv(M), corners = [apply(iv, 0, 0), apply(iv, w, 0), apply(iv, 0, h), apply(iv, w, h)], X0 = Math.min.apply(null, corners.map(function (p) { return p[0]; })), X1 = Math.max.apply(null, corners.map(function (p) { return p[0]; })), Y0 = Math.min.apply(null, corners.map(function (p) { return p[1]; })), Y1 = Math.max.apply(null, corners.map(function (p) { return p[1]; }));
    if (type === 2 || type === 3) {
      var co = numArr(doc, d.get("Coords")), dom = numArr(doc, d.get("Domain")) || [0, 1], ext = arr(doc, d.get("Extend")) || [false, false], fn = shadingColor(doc, sh, res), g;
      if (!co) { c.restore(); return; }
      if (type === 2) { g = c.createLinearGradient(co[0], co[1], co[2], co[3]); } else g = c.createRadialGradient(co[0], co[1], co[2], co[3], co[4], co[5]);
      var N = 64; for (var i = 0; i <= N; i++) { var t = dom[0] + (dom[1] - dom[0]) * i / N, col = fn(t); g.addColorStop(i / N, "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")"); }
      if (type === 2 && (!ext[0] || !ext[1])) { var dx = co[2] - co[0], dy = co[3] - co[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, BIG = 1e6, lo = ext[0] ? -BIG : 0, hi = ext[1] ? BIG : L, sp = new Path2D(); sp.moveTo(co[0] + ux * lo + nx * BIG, co[1] + uy * lo + ny * BIG); sp.lineTo(co[0] + ux * hi + nx * BIG, co[1] + uy * hi + ny * BIG); sp.lineTo(co[0] + ux * hi - nx * BIG, co[1] + uy * hi - ny * BIG); sp.lineTo(co[0] + ux * lo - nx * BIG, co[1] + uy * lo - ny * BIG); sp.closePath(); c.clip(sp); }
      c.fillStyle = g; c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    } else if (type === 1) {
      var dm = numArr(doc, d.get("Domain")) || [0, 1, 0, 1], fm = numArr(doc, d.get("Matrix")) || [1, 0, 0, 1, 0, 0], ff = makeFunction(doc, d.get("Function")), S = 96, cv = canvasOf(S, S), cx = cv.getContext("2d"), id = cx.createImageData(S, S);
      for (var yy = 0; yy < S; yy++) for (var xx = 0; xx < S; xx++) { var comps = ff.ev([dm[0] + (xx + .5) / S * (dm[1] - dm[0]), dm[2] + (yy + .5) / S * (dm[3] - dm[2])]); var rgb = cs.rgb(comps), o = (yy * S + xx) * 4; id.data[o] = rgb[0]; id.data[o + 1] = rgb[1]; id.data[o + 2] = rgb[2]; id.data[o + 3] = 255; }
      cx.putImageData(id, 0, 0); c.transform(fm[0], fm[1], fm[2], fm[3], fm[4], fm[5]); c.transform((dm[1] - dm[0]) / S, 0, 0, (dm[3] - dm[2]) / S, dm[0], dm[2]); c.drawImage(cv, 0, 0);
    } else if (type >= 4 && type <= 7) { await this.meshShading(c, sh, type, cs, res, d); }
    c.restore();
  };
  /* mesh shadings drawn as small flat/gouraud triangles */
  Renderer.prototype.meshShading = async function (c, sh, type, cs, res, d) {
    var doc = this.doc, data = doc.decodeStream(sh), bpco = num(gd(doc, d, "BitsPerCoordinate"), 8), bpcm = num(gd(doc, d, "BitsPerComponent"), 8), bpf = num(gd(doc, d, "BitsPerFlag"), 8), dec = numArr(doc, d.get("Decode")) || [0, 1, 0, 1, 0, 1], fo = d.get("Function") ? makeFunction(doc, d.get("Function")) : null, nc = fo ? 1 : cs.n;
    var bitpos = 0; function rd(n) { var v = 0; for (var i = 0; i < n; i++) { var b = bitpos + i; v = v * 2 + (((data[b >> 3] || 0) >> (7 - (b & 7))) & 1); } bitpos += n; return v; }
    var cmax = Math.pow(2, bpco) - 1, mmax = Math.pow(2, bpcm) - 1, total = data.length * 8;
    function vertex() { var x = dec[0] + rd(bpco) / cmax * (dec[1] - dec[0]), y = dec[2] + rd(bpco) / cmax * (dec[3] - dec[2]), comps = []; for (var k = 0; k < nc; k++) comps.push(dec[4 + k * 2] + rd(bpcm) / mmax * (dec[5 + k * 2] - dec[4 + k * 2])); return { x: x, y: y, c: fo ? cs.rgb(fo.ev(comps)) : cs.rgb(comps) }; }
    function align() { bitpos = (bitpos + 7) & ~7; }
    var tris = [];
    function tri(a, b, cc) { tris.push([a, b, cc]); }
    if (type === 4) { var va = null, vb = null, vc = null; while (bitpos + bpf + 2 * bpco + nc * bpcm <= total) { var f = rd(bpf), v = vertex(); align(); if (f === 0) { var v2 = null, v3 = null; if (bitpos + bpf + 2 * bpco + nc * bpcm > total) break; rd(bpf); v2 = vertex(); align(); rd(bpf); v3 = vertex(); align(); va = v; vb = v2; vc = v3; } else if (f === 1) { va = vb; vb = vc; vc = v; } else { vb = vc; vc = v; } if (va && vb && vc) tri(va, vb, vc); } }
    else if (type === 5) { var vpr = num(gd(doc, d, "VerticesPerRow"), 2), prev = null; while (bitpos + 2 * bpco + nc * bpcm <= total) { var row = []; for (var i = 0; i < vpr && bitpos + 2 * bpco + nc * bpcm <= total; i++) row.push(vertex()); if (row.length < vpr) break; if (prev) for (var j = 0; j < vpr - 1; j++) { tri(prev[j], prev[j + 1], row[j]); tri(prev[j + 1], row[j + 1], row[j]); } prev = row; } }
    else { /* Coons / tensor patches: subdivide the boundary into a grid of quads */
      var np = type === 6 ? 12 : 16, prevP = null, prevC = null;
      while (bitpos + bpf <= total) {
        var fl = rd(bpf), pts = [], cols = [], nNew = fl === 0 ? np : np - 4, nCol = fl === 0 ? 4 : 2; if (bitpos + nNew * 2 * bpco + nCol * nc * bpcm > total) break;
        for (var k = 0; k < nNew; k++) pts.push([dec[0] + rd(bpco) / cmax * (dec[1] - dec[0]), dec[2] + rd(bpco) / cmax * (dec[3] - dec[2])]);
        for (var k2 = 0; k2 < nCol; k2++) { var cm = []; for (var q = 0; q < nc; q++) cm.push(dec[4 + q * 2] + rd(bpcm) / mmax * (dec[5 + q * 2] - dec[4 + q * 2])); cols.push(fo ? cs.rgb(fo.ev(cm)) : cs.rgb(cm)); } align();
        if (fl !== 0 && prevP) { var pp = prevP, e = fl === 1 ? [pp[3], pp[4], pp[5], pp[6]] : fl === 2 ? [pp[6], pp[7], pp[8], pp[9]] : [pp[9], pp[10], pp[11], pp[0]]; var ec = fl === 1 ? [prevC[1], prevC[2]] : fl === 2 ? [prevC[2], prevC[3]] : [prevC[3], prevC[0]]; pts = e.concat(pts); cols = ec.concat(cols); }
        prevP = pts; prevC = cols; if (pts.length < 12) continue;
        /* boundary curves: p0..p3 left(bottom?) - use Coons formula on the 12 control points */
        var P = pts, C1 = [P[0], P[1], P[2], P[3]], D2 = [P[3], P[4], P[5], P[6]], C2 = [P[9], P[8], P[7], P[6]], D1 = [P[0], P[11], P[10], P[9]];
        var bez = function (cp, t) { var u = 1 - t; return [u * u * u * cp[0][0] + 3 * u * u * t * cp[1][0] + 3 * u * t * t * cp[2][0] + t * t * t * cp[3][0], u * u * u * cp[0][1] + 3 * u * u * t * cp[1][1] + 3 * u * t * t * cp[2][1] + t * t * t * cp[3][1]]; };
        var G = 10; var grid = [];
        for (var iu = 0; iu <= G; iu++) { var u2 = iu / G, row2 = []; for (var iv2 = 0; iv2 <= G; iv2++) { var v4 = iv2 / G, c1 = bez(C1, u2), c2 = bez(C2, u2), d1 = bez(D1, v4), d2 = bez(D2, v4), p00 = P[0], p03 = P[9], p30 = P[3], p33 = P[6];
          var sx = (1 - v4) * c1[0] + v4 * c2[0] + (1 - u2) * d1[0] + u2 * d2[0] - ((1 - u2) * (1 - v4) * p00[0] + (1 - u2) * v4 * p03[0] + u2 * (1 - v4) * p30[0] + u2 * v4 * p33[0]), sy = (1 - v4) * c1[1] + v4 * c2[1] + (1 - u2) * d1[1] + u2 * d2[1] - ((1 - u2) * (1 - v4) * p00[1] + (1 - u2) * v4 * p03[1] + u2 * (1 - v4) * p30[1] + u2 * v4 * p33[1]);
          var cc00 = cols[0], cc03 = cols[1], cc33 = cols[2], cc30 = cols[3], col = [0, 1, 2].map(function (ch) { return Math.round((1 - u2) * ((1 - v4) * cc00[ch] + v4 * cc03[ch]) + u2 * ((1 - v4) * cc30[ch] + v4 * cc33[ch])); });
          row2.push({ x: sx, y: sy, c: col }); } grid.push(row2); }
        for (var a1 = 0; a1 < G; a1++) for (var b1 = 0; b1 < G; b1++) { tri(grid[a1][b1], grid[a1 + 1][b1], grid[a1][b1 + 1]); tri(grid[a1 + 1][b1], grid[a1 + 1][b1 + 1], grid[a1][b1 + 1]); }
      }
    }
    /* flat shading of each triangle with the average colour plus a tiny stroke to hide seams */
    var W = c.canvas.width, H = c.canvas.height, M = c.getTransform();
    var cv = canvasOf(W, H), cx = cv.getContext("2d"); cx.setTransform(M);
    tris.forEach(function (t) {
      var sub = 4; /* split into a few gouraud-ish strips for smoother look */
      for (var s = 0; s < sub; s++) { var f0 = s / sub, f1 = (s + 1) / sub; var a = t[0], b = t[1], cc = t[2]; var mid = (f0 + f1) / 2; var col = [0, 1, 2].map(function (k) { return Math.round(a.c[k] * (1 - mid) + (b.c[k] + cc.c[k]) / 2 * mid); });
        var p0 = [a.x + (b.x - a.x) * f0, a.y + (b.y - a.y) * f0], p1 = [a.x + (b.x - a.x) * f1, a.y + (b.y - a.y) * f1], q0 = [a.x + (cc.x - a.x) * f0, a.y + (cc.y - a.y) * f0], q1 = [a.x + (cc.x - a.x) * f1, a.y + (cc.y - a.y) * f1];
        cx.beginPath(); cx.moveTo(p0[0], p0[1]); cx.lineTo(p1[0], p1[1]); cx.lineTo(q1[0], q1[1]); cx.lineTo(q0[0], q0[1]); cx.closePath(); cx.fillStyle = cx.strokeStyle = rgbStr(col); cx.lineWidth = 0.0; cx.fill(); }
    });
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cv, 0, 0); c.restore();
  };
  Renderer.prototype.fillShading = async function (c, path, fs, rule) {
    c.save(); c.clip(path, rule); c.globalAlpha = this.gs.fa;
    var d = dictOf(fs.shading), bg = d && numArr(this.doc, d.get("Background"));
    if (bg) { var cs = parseCS(this.doc, d.get("ColorSpace"), fs.res); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = rgbStr(cs.rgb(bg)); c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); }
    await this.paintShading(c, fs.shading, fs.matrix, fs.res); c.restore();
  };
  Renderer.prototype.shadingOp = async function (nm, res) {
    if (!this.vis()) return; var sh = gd(this.doc, gd(this.doc, res, "Shading"), nm instanceof Name ? nm.n : ""); if (!sh) return; var self = this, gs = this.gs;
    await this.paint(async function (c) { c.save(); c.globalAlpha = gs.fa; await self.paintShading(c, sh, gs.ctm, res); c.restore(); });
  };

  /* ---------- text ---------- */
  Renderer.prototype.setFont = async function (nm, size, res) {
    var fd = dictOf(gd(this.doc, res, "Font")), ent = fd && fd.get(nm instanceof Name ? nm.n : "");
    this.gs.fs = num(size, 0); this.gs.font = ent ? await this.sh.font(ent) : null;
  };
  Renderer.prototype.showTJ = async function (a) {
    if (!Array.isArray(a)) return; var gs = this.gs;
    for (var i = 0; i < a.length; i++) { var x = a[i]; if (x instanceof Str) await this.showText(x); else if (typeof x === "number") this.tm = mul([1, 0, 0, 1, -x / 1000 * gs.fs * gs.Th, 0], this.tm); }
  };
  Renderer.prototype.showText = async function (s) {
    if (!(s instanceof Str)) return; var gs = this.gs, F = gs.font, ctx = this.ctx; if (!F) return; if (!this.tm) { this.tm = [1, 0, 0, 1, 0, 0]; this.tlm = this.tm.slice(); }
    var units = decodeText(F, s.b), vis = this.vis() && gs.Tr !== 3 && gs.fs !== 0, self = this, fs = gs.fs;
    for (var k = 0; k < units.length; k++) {
      var u = units[k], w = glyphWidth(F, u) / 1000;
      if (vis || F.type3) await this.drawGlyph(F, u, w);
      var tx = (w * fs + gs.Tc + (u.n === 1 && u.code === 32 ? gs.Tw : 0)) * gs.Th; this.tm = mul([1, 0, 0, 1, tx, 0], this.tm);
    }
  };
  Renderer.prototype.drawGlyph = async function (F, u, w) {
    var gs = this.gs, ctx = this.ctx, fs = gs.fs, tr = mul([fs * gs.Th, 0, 0, fs, 0, gs.Ts], mul(this.tm, gs.ctm));
    if (F.type3) {
      if (!this.vis()) return; var nm = F.names[u.code], cp = nm && F.charProcs && F.charProcs.get(nm), st = cp && this.doc.get(cp); if (!(st instanceof Stream) || this.depth > 6) return;
      var full = mul(F.fm, tr), saveIgnore = this.ignoreColor, svTm = [this.tm, this.tlm], self = this;
      this.save(); this.depth++; this.gs.ctm = full; this.setT(full); this.gs.Tr = 0; this.gs.lw = 1; this.gs.dash = []; this.applyGS(); this.ignoreColor = false; var svPath = this.path; this.path = null;
      try { await this.run(this.doc.decodeStream(st), F.res || this.curRes); } finally { this.path = svPath; this.depth--; this.ignoreColor = saveIgnore; this.restore(); this.tm = svTm[0]; this.tlm = svTm[1]; this.setT(this.gs.ctm); }
      return;
    }
    var mode = gs.Tr, doFill = mode === 0 || mode === 2 || mode === 4 || mode === 6, doStroke = mode === 1 || mode === 2 || mode === 5 || mode === 6, clip = mode >= 4;
    var g = F.embedded ? embeddedGlyph(F, u) : null;
    if (g) {
      if (g.empty) return; var full2 = mul(g.fm, tr);
      if (clip) { (this.clipText = this.clipText || []).push({ p: g.p, m: full2 }); }
      if (!this.vis()) return;
      var fsx = await this.fillStyle(false), ssx = doStroke ? await this.fillStyle(true) : null, self2 = this;
      await this.paint(async function (c) {
        c.save(); c.setTransform(full2[0], full2[1], full2[2], full2[3], full2[4], full2[5]);
        if (doFill && !gs.fillCS.none) { c.globalAlpha = gs.fa; if (fsx && fsx.shading) { c.restore(); c.save(); var pp = new Path2D(); pp.addPath(g.p, new DOMMatrix(full2)); c.setTransform(1, 0, 0, 1, 0, 0); await self2.fillShading(c, pp, fsx, "nonzero"); } else { c.fillStyle = fsx; c.fill(g.p); } }
        if (doStroke) { var sc = Math.sqrt(Math.abs(full2[0] * full2[3] - full2[1] * full2[2])) || 1, cs2 = Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2])) || 1; c.globalAlpha = gs.sa; c.strokeStyle = ssx && !ssx.shading ? ssx : "#808080"; c.lineWidth = Math.max(gs.lw, 0.01) * cs2 / sc; c.stroke(g.p); }
        c.restore(); c.globalAlpha = 1;
      });
      return;
    }
    if (F.embedded && F.kind !== "cid" && !fallbackChar(F, u)) return;
    var ch = fallbackChar(F, u); if (!ch || ch === " " || ch === " " || !this.vis()) return;
    var sub = F.sub, size = 100, fnt = (sub.italic ? "italic " : "") + (sub.bold ? "bold " : "") + size + "px " + sub.css, sx = 1;
    var fsx2 = await this.fillStyle(false), self3 = this;
    await this.paint(async function (c) {
      c.save(); c.font = fnt; var measured = c.measureText(ch).width; if (w > 0 && measured > 0) { sx = clamp(w * size / measured, 0.6, 1.6); if (Math.abs(sx - 1) < 0.03) sx = 1; }
      var m = mul([fs * gs.Th / size * sx, 0, 0, -fs / size, 0, gs.Ts], mul(self3.tm, gs.ctm)); c.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]); c.textBaseline = "alphabetic"; c.globalAlpha = gs.fa;
      if (doFill) { c.fillStyle = fsx2 && !fsx2.shading ? fsx2 : "#000"; c.fillText(ch, 0, 0); } if (doStroke) { c.strokeStyle = gs.stroke; c.lineWidth = gs.lw * 100 / fs; c.strokeText(ch, 0, 0); }
      c.restore(); c.globalAlpha = 1;
    });
  };
  Renderer.prototype.applyTextClip = function (list) {
    var ctx = this.ctx, comb = new Path2D(), iv = inv(this.gs.ctm); list.forEach(function (g) { var m = mul(g.m, iv); comb.addPath(g.p, new DOMMatrix([m[0], m[1], m[2], m[3], m[4], m[5]])); });
    ctx.clip(comb);
  };

  /* ================= document level ================= */
  function Shared(doc) {
    this.doc = doc; this.fonts = new Map(); this.imgCache = new Map(); this.patCache = new Map(); var self = this;
    var rd = dictOf(doc.get(doc.root())), ocp = rd && dictOf(doc.get(rd.get("OCProperties"))), off = new Set(), on = new Set(), baseOn = true;
    if (ocp) { var dd = dictOf(doc.get(ocp.get("D"))); if (dd) { var bs = doc.get(dd.get("BaseState")); if (bs instanceof Name && bs.n === "OFF") baseOn = false; (arr0(doc, dd.get("OFF")) || []).forEach(function (r) { if (r instanceof Ref) off.add(r.num); }); (arr0(doc, dd.get("ON")) || []).forEach(function (r) { if (r instanceof Ref) on.add(r.num); }); } }
    this.ocOff = off; this.ocOn = on; this.ocBaseOn = baseOn;
  }
  function arr0(doc, o) { o = doc.get(o); return Array.isArray(o) ? o : null; }
  Shared.prototype.font = async function (ent) {
    var key = ent instanceof Ref ? ent.num : ent; if (this.fonts.has(key)) return this.fonts.get(key);
    var pr = loadFont(this.doc, ent, this).catch(function (e) { if (root.DTA_PDF_DEBUG) console.warn("font load failed", e && e.stack); return null; }); this.fonts.set(key, pr); return pr;
  };
  Shared.prototype.ocHidden = function (o) {
    var doc = this.doc, self = this; if (!this.ocOff.size && this.ocBaseOn && !this.ocOn.size) return false;
    function ocgHidden(r) { if (r instanceof Ref) { if (self.ocOff.has(r.num)) return true; if (!self.ocBaseOn && !self.ocOn.has(r.num)) return true; } return false; }
    if (o instanceof Ref) { var d = dictOf(doc.get(o)); if (d && isName(doc.get(d.get("Type")), "OCMD")) { var og = d.get("OCGs"), list = Array.isArray(doc.get(og)) ? doc.get(og) : [og]; if (!list.length || !og) return false; return list.every(function (r) { return ocgHidden(r); }); } return ocgHidden(o); }
    var dd2 = dictOf(o); if (dd2 && isName(doc.get(dd2.get("Type")), "OCMD")) { var og2 = dd2.get("OCGs"), l2 = Array.isArray(doc.get(og2)) ? doc.get(og2) : [og2]; if (!og2 || !l2.length) return false; return l2.every(function (r) { return ocgHidden(r); }); }
    return false;
  };

  function Viewport(view, rotate, scale, ox, oy) {
    var x0 = view[0], y0 = view[1], x1 = view[2], y1 = view[3], t, w = x1 - x0, h = y1 - y0, rot = ((rotate % 360) + 360) % 360;
    if (rot === 0) t = [scale, 0, 0, -scale, -scale * x0, scale * y1]; else if (rot === 90) t = [0, scale, scale, 0, -scale * y0, -scale * x0]; else if (rot === 180) t = [-scale, 0, 0, scale, scale * x1, -scale * y0]; else t = [0, -scale, -scale, 0, scale * y1, scale * x1];
    t[4] += ox || 0; t[5] += oy || 0; this.transform = t; this.scale = scale; this.rotation = rot; this.viewBox = view; this.width = (rot % 180 ? h : w) * scale; this.height = (rot % 180 ? w : h) * scale;
  }
  Viewport.prototype.convertToViewportPoint = function (x, y) { return apply(this.transform, x, y); };
  Viewport.prototype.convertToViewportRectangle = function (r) { var a = apply(this.transform, r[0], r[1]), b = apply(this.transform, r[2], r[3]); return [a[0], a[1], b[0], b[1]]; };
  Viewport.prototype.convertToPdfPoint = function (x, y) { return apply(inv(this.transform), x, y); };

  function PageProxy(docp, pg, index) {
    this._d = docp; this._p = pg; this.pageNumber = index + 1; var doc = docp.doc;
    var mb = pg.getMediaBox(), cr = pg.attr("CropBox"), cb = Array.isArray(cr) ? cr.map(function (x) { return doc.get(x); }) : null, v = mb.slice();
    if (cb && cb.length >= 4 && cb.every(function (x) { return typeof x === "number"; })) { var c = [Math.min(cb[0], cb[2]), Math.min(cb[1], cb[3]), Math.max(cb[0], cb[2]), Math.max(cb[1], cb[3])]; var ix0 = Math.max(c[0], mb[0]), iy0 = Math.max(c[1], mb[1]), ix1 = Math.min(c[2], mb[2]), iy1 = Math.min(c[3], mb[3]); if (ix1 > ix0 && iy1 > iy0) v = [ix0, iy0, ix1, iy1]; }
    this.view = v; this.rotate = pg.getRotation().angle;
  }
  PageProxy.prototype.cleanup = function () { return true; };
  PageProxy.prototype.getViewport = function (o) { o = o || {}; var rot = o.rotation === undefined ? this.rotate : o.rotation; return new Viewport(this.view, rot, o.scale || 1, o.offsetX, o.offsetY); };
  PageProxy.prototype.render = function (o) {
    var self = this, docp = this._d, doc = docp.doc, ctx = o.canvasContext, vp = o.viewport, mode = o.annotationMode === undefined ? 1 : o.annotationMode, r = new Renderer(doc, ctx, vp.transform, docp.shared, {});
    var p = (async function () {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); if (o.background) { ctx.fillStyle = o.background; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); } ctx.restore();
      ctx.save(); r.setT(vp.transform); r.applyGS(); var v = self.view, cp = new Path2D(); cp.rect(v[0], v[1], v[2] - v[0], v[3] - v[1]); ctx.clip(cp);
      try {
        var res = self._p.attr("Resources"); r.curRes = res; var c = doc.get(self._p.dict().get("Contents")), parts = c instanceof Stream ? [c] : Array.isArray(c) ? c.map(function (x) { return doc.get(x); }).filter(function (x) { return x instanceof Stream; }) : [];
        var chunks = [], tot = 0; parts.forEach(function (s) { try { var b = doc.decodeStream(s); chunks.push(b, new Uint8Array([10])); tot += b.length + 1; } catch (e) { /* skip a broken chunk */ } });
        var all = new Uint8Array(tot), q = 0; chunks.forEach(function (b) { all.set(b, q); q += b.length; });
        await r.run(all, res);
        while (r.stack.length) r.restore();
        if (mode !== 0) await self.drawAnnots(r, mode);
      } finally { ctx.restore(); }
    })();
    return { promise: p, cancel: function () { r.cancelled = true; } };
  };
  PageProxy.prototype.drawAnnots = async function (r, mode) {
    var doc = this._d.doc, an = doc.get(this._p.dict().get("Annots")); if (!Array.isArray(an)) return;
    for (var i = 0; i < an.length; i++) {
      var a = dictOf(doc.get(an[i])); if (!a) continue; var st = gd(doc, a, "Subtype"), sn = st instanceof Name ? st.n : "", fl = num(gd(doc, a, "F"), 0);
      if (sn === "Popup" || (fl & 2) || (fl & 32)) continue; if (sn === "Widget" && mode === 2) continue; if (a.get("OC") && r.sh.ocHidden(a.get("OC"))) continue;
      var ap = dictOf(gd(doc, a, "AP")), nn = ap && doc.get(ap.get("N")), form = null;
      if (nn instanceof Stream) form = nn; else if (nn instanceof Dict) { var as = gd(doc, a, "AS"); if (as instanceof Name) { var s2 = doc.get(nn.get(as.n)); if (s2 instanceof Stream) form = s2; } }
      if (!form) continue;
      var rc = numArr(doc, a.get("Rect")); if (!rc || rc.length < 4) continue; var bb = numArr(doc, form.dict.get("BBox")) || [0, 0, 1, 1], mx = numArr(doc, form.dict.get("Matrix")) || [1, 0, 0, 1, 0, 0];
      var cs = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]].map(function (p) { return apply(mx, p[0], p[1]); }), xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; });
      var tx0 = Math.min.apply(null, xs), tx1 = Math.max.apply(null, xs), ty0 = Math.min.apply(null, ys), ty1 = Math.max.apply(null, ys), rx0 = Math.min(rc[0], rc[2]), ry0 = Math.min(rc[1], rc[3]), rx1 = Math.max(rc[0], rc[2]), ry1 = Math.max(rc[1], rc[3]);
      var sx = tx1 - tx0 ? (rx1 - rx0) / (tx1 - tx0) : 1, sy = ty1 - ty0 ? (ry1 - ry0) / (ty1 - ty0) : 1, A = [sx, 0, 0, sy, rx0 - tx0 * sx, ry0 - ty0 * sy];
      r.save(); r.gs.ctm = mul(A, r.gs.ctm); r.setT(r.gs.ctm); try { await r.drawForm(form, this._p.attr("Resources")); } catch (e) { if (e && e.name === "RenderingCancelled") throw e; } r.restore();
    }
  };
  /* PDF.js-shaped annotation data (only what the DTAhub form filler reads) */
  PageProxy.prototype.getAnnotations = async function () {
    var doc = this._d.doc, an = doc.get(this._p.dict().get("Annots")), out = []; if (!Array.isArray(an)) return out;
    var form = this._d.form || (this._d.form = doc.getForm()), byRef = new Map(); try { form.getFields().forEach(function (f) { f.widgetRefs.forEach(function (w) { if (w instanceof Ref) byRef.set(w.num, f); }); }); } catch (e) { /* no form */ }
    an.forEach(function (ref) {
      var a = dictOf(doc.get(ref)); if (!a) return; var st = gd(doc, a, "Subtype"), rc = numArr(doc, a.get("Rect")) || [0, 0, 0, 0], fl = num(gd(doc, a, "F"), 0), o = { subtype: st instanceof Name ? st.n : "", rect: rc, hidden: !!(fl & 2) || !!(fl & 32) };
      var f = ref instanceof Ref ? byRef.get(ref.num) : null;
      if (f) {
        var k = f.kind(), v = f.attr("V"), ff = f.ff; o.fieldName = f.name; o.readOnly = !!(ff & 1); o.fieldType = f.ft; o.pushButton = k === "button"; o.radioButton = k === "radio"; o.checkBox = k === "checkbox"; o.multiLine = !!(f.ft === "Tx" && (ff & 4096));
        var ml = f.attr("MaxLen"); if (typeof ml === "number") o.maxLen = ml;
        if (v instanceof Str) o.fieldValue = P.util.strText(v); else if (v instanceof Name) o.fieldValue = v.n; else if (Array.isArray(v)) o.fieldValue = v.map(function (x) { x = doc.get(x); return x instanceof Str ? P.util.strText(x) : ""; }); else o.fieldValue = "";
        if (k === "checkbox" || k === "radio") { var w = f.widgets().filter(function (x) { return x.ref === ref || (x.ref instanceof Ref && ref instanceof Ref && x.ref.num === ref.num); })[0], ap = w && dictOf(doc.get(w.d.get("AP"))), nn = ap && doc.get(ap.get("N")); o.buttonValue = nn instanceof Dict ? (nn.keys().filter(function (q) { return q !== "Off"; })[0] || "Yes") : "Yes"; if (v === undefined || (v instanceof Name && v.n === "Off")) o.fieldValue = "Off"; }
        if (k === "dropdown" || k === "list") o.options = f.options().map(function (q) { return { exportValue: q.value, displayValue: q.label }; });
      }
      out.push(o);
    });
    return out;
  };

  function DocProxy(doc) { this.doc = doc; this.numPages = doc.getPageCount(); this.shared = new Shared(doc); this.fingerprints = []; }
  DocProxy.prototype.getPage = function (n) {
    if (!(n >= 1 && n <= this.numPages)) return Promise.reject(ViewError("InvalidPageRequest", "page " + n + " does not exist"));
    return Promise.resolve(new PageProxy(this, this.doc.getPage(n - 1), n - 1));
  };
  DocProxy.prototype.destroy = function () { this.shared.imgCache.clear(); this.shared.fonts.clear(); return Promise.resolve(); };
  /* open(bytes) -> Promise<DocProxy>. Throws PasswordException for files that need a password. */
  function open(input, opt) {
    return new Promise(function (resolve, reject) {
      try {
        var d = P.Doc.load(input instanceof Uint8Array ? input : new Uint8Array(input), opt);
        if (!d.getPageCount()) throw ViewError("InvalidPDFException", "This PDF has no pages."); resolve(new DocProxy(d));
      } catch (e) {
        if (e && e.code === "encrypted") { var pe = ViewError("PasswordException", e.message); pe.code = 1; reject(pe); }
        else if (e && e.code === "not-pdf") reject(ViewError("InvalidPDFException", e.message)); else reject(e);
      }
    });
  }
  /* PDF.js-shaped entry point so existing tool code keeps working */
  function getDocument(o) { return { promise: open(o && o.data !== undefined ? o.data : o) }; }
  return { open: open, getDocument: getDocument, GlobalWorkerOptions: {}, Viewport: Viewport, internals: { parseCS: parseCS, makeFunction: makeFunction, decodeRaster: decodeRaster, ccittDecode: ccittDecode, Renderer: Renderer } };
});

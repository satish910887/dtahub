/* DTApdf core: DTAhub's own PDF engine. Original code, no third-party dependency.
   Reads PDF 1.0-2.0 files (classic xref, xref streams, object streams, incremental updates, broken-xref recovery),
   copies pages between documents, edits page properties and writes valid PDFs.
   Not supported on purpose: encrypted files (reported clearly, never silently mangled).
     var doc = await DTApdf.Doc.load(bytes);  doc.getPageCount();  var out = DTApdf.Doc.create();
     var pages = await out.copyPages(doc, [0, 2]);  pages.forEach(p => out.addPage(p));  var bytes = await out.save();
   Pure and DOM-free: unit tested in Node (scripts/pdf-test.mjs) against qpdf, pdfinfo, pdftotext and rendered pixels. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else { var api = factory(root); var old = root.DTApdf || {}; for (var k in api) old[k] = api[k]; root.DTApdf = old; }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  function PdfError(code, msg) { var e = new Error(msg || code); e.name = "PdfError"; e.code = code; return e; }

  /* ================= object model ================= */
  function Name(n) { this.n = n; }
  function Ref(num, gen) { this.num = num; this.gen = gen || 0; }
  function Str(b, hex) { this.b = b; this.hex = !!hex; }
  function Dict(map) { this.m = map || new Map(); }
  Dict.prototype.get = function (k) { return this.m.get(k); };
  Dict.prototype.set = function (k, v) { this.m.set(k, v); return this; };
  Dict.prototype.has = function (k) { return this.m.has(k); };
  Dict.prototype.del = function (k) { this.m.delete(k); return this; };
  Dict.prototype.keys = function () { return Array.from(this.m.keys()); };
  function Stream(dict, raw) { this.dict = dict; this.raw = raw; this.compress = false; }
  var isName = function (o, n) { return o instanceof Name && (n === undefined || o.n === n); };
  function dictOf(o) { return o instanceof Dict ? o : o instanceof Stream ? o.dict : null; }
  function N(n) { return new Name(n); }
  function mkDict(o) { var d = new Dict(); for (var k in (o || {})) d.set(k, o[k]); return d; }

  /* ================= inflate (RFC 1951), tolerant of truncated data ================= */
  var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var CLORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  function huff(lengths, n) {
    var count = new Uint16Array(16), symbol = new Uint16Array(n), offs = new Uint16Array(16), i;
    for (i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    for (i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (i = 0; i < n; i++) if (lengths[i]) symbol[offs[lengths[i]]++] = i;
    return { count: count, symbol: symbol };
  }
  var FIXL, FIXD;
  function inflate(src, start) {
    var pos = start || 0, bitBuf = 0, bitCnt = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0, eof = false;
    function need(n) { if (op + n > out.length) { var o = new Uint8Array(Math.max(out.length * 2, op + n)); o.set(out); out = o; } }
    function bits(n) {
      while (bitCnt < n) { if (pos >= src.length) { eof = true; return 0; } bitBuf |= src[pos++] << bitCnt; bitCnt += 8; }
      var v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCnt -= n; return v;
    }
    function decode(h) {
      var code = 0, first = 0, index = 0;
      for (var len = 1; len < 16; len++) {
        code |= bits(1); if (eof) return -1;
        var c = h.count[len];
        if (code - c < first) return h.symbol[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      return -1;
    }
    if (!FIXL) {
      var l = new Uint8Array(288), i; for (i = 0; i < 144; i++) l[i] = 8; for (; i < 256; i++) l[i] = 9; for (; i < 280; i++) l[i] = 7; for (; i < 288; i++) l[i] = 8;
      FIXL = huff(l, 288); var d = new Uint8Array(30).fill(5); FIXD = huff(d, 30);
    }
    for (var last = 0; !last && !eof;) {
      last = bits(1); var type = bits(2);
      if (eof) break;
      if (type === 0) {
        bitBuf = 0; bitCnt = 0;
        if (pos + 4 > src.length) break;
        var len = src[pos] | (src[pos + 1] << 8); pos += 4;
        var take = Math.min(len, src.length - pos); need(take); out.set(src.subarray(pos, pos + take), op); op += take; pos += take;
        if (take < len) break;
      } else if (type === 1 || type === 2) {
        var lc, dc;
        if (type === 1) { lc = FIXL; dc = FIXD; }
        else {
          var nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4, lens = new Uint8Array(320), k;
          for (k = 0; k < ncode; k++) lens[CLORD[k]] = bits(3);
          var cl = huff(lens, 19); lens = new Uint8Array(320); k = 0;
          while (k < nlen + ndist && !eof) {
            var sym = decode(cl); if (sym < 0) { eof = true; break; }
            if (sym < 16) lens[k++] = sym;
            else { var prev = 0, rep; if (sym === 16) { prev = k ? lens[k - 1] : 0; rep = 3 + bits(2); } else if (sym === 17) rep = 3 + bits(3); else rep = 11 + bits(7); while (rep-- && k < nlen + ndist) lens[k++] = prev; }
          }
          if (eof) break;
          lc = huff(lens.subarray(0, nlen), nlen); dc = huff(lens.subarray(nlen, nlen + ndist), ndist);
        }
        for (;;) {
          var s = decode(lc); if (s < 0) { eof = true; break; }
          if (s < 256) { need(1); out[op++] = s; }
          else if (s === 256) break;
          else {
            s -= 257; if (s >= 29) { eof = true; break; }
            var ln = LBASE[s] + bits(LEXT[s]), ds = decode(dc); if (ds < 0 || ds >= 30) { eof = true; break; }
            var dist = DBASE[ds] + bits(DEXT[ds]); if (dist > op) { eof = true; break; }
            need(ln); for (var q = 0; q < ln; q++, op++) out[op] = out[op - dist];
          }
        }
      } else break;
    }
    return out.subarray(0, op);
  }
  function zlibInflate(b) {
    var st = 0; if (b.length > 2 && (b[0] & 0x0f) === 8 && ((b[0] << 8) | b[1]) % 31 === 0) st = (b[1] & 0x20) ? 6 : 2;
    return inflate(b, st);
  }

  /* ---------- deflate (via the browser's CompressionStream when present; otherwise stored blocks) ---------- */
  function adler32(b) { var a = 1, s = 0; for (var i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; s = (s + a) % 65521; } return ((s << 16) | a) >>> 0; }
  function zlibStored(b) {
    var n = Math.ceil(b.length / 65535) || 1, out = new Uint8Array(2 + b.length + n * 5 + 4), p = 0, i;
    out[p++] = 0x78; out[p++] = 0x01;
    for (i = 0; i < n; i++) { var chunk = b.subarray(i * 65535, (i + 1) * 65535), L = chunk.length; out[p++] = i === n - 1 ? 1 : 0; out[p++] = L & 255; out[p++] = L >> 8; out[p++] = ~L & 255; out[p++] = (~L >> 8) & 255; out.set(chunk, p); p += L; }
    var a = adler32(b); out[p++] = a >>> 24; out[p++] = (a >>> 16) & 255; out[p++] = (a >>> 8) & 255; out[p++] = a & 255;
    return out;
  }
  function zlibDeflate(b) {
    if (typeof root.CompressionStream === "function" && typeof root.Response === "function") {
      try {
        var cs = new root.CompressionStream("deflate"), w = cs.writable.getWriter(); w.write(b); w.close();
        return new root.Response(cs.readable).arrayBuffer().then(function (ab) { var o = new Uint8Array(ab); return o.length < b.length ? o : zlibStored(b); }, function () { return zlibStored(b); });
      } catch (e) { /* fall through */ }
    }
    return Promise.resolve(zlibStored(b));
  }

  /* ---------- stream filters ---------- */
  function unpredict(data, parms) {
    var pred = parms && parms.get("Predictor") || 1; if (typeof pred !== "number" || pred === 1) return data;
    var colors = parms.get("Colors") || 1, bpc = parms.get("BitsPerComponent") || 8, cols = parms.get("Columns") || 1, bpp = Math.max(1, (colors * bpc + 7) >> 3), rowLen = (cols * colors * bpc + 7) >> 3;
    if (pred === 2) { if (bpc !== 8) throw PdfError("unsupported", "TIFF predictor with " + bpc + " bits"); var t = new Uint8Array(data); for (var r = 0; r + rowLen <= t.length; r += rowLen) for (var i = colors; i < rowLen; i++) t[r + i] = (t[r + i] + t[r + i - colors]) & 255; return t; }
    var rows = Math.floor(data.length / (rowLen + 1)), out = new Uint8Array(rows * rowLen);
    for (var y = 0; y < rows; y++) {
      var ft = data[y * (rowLen + 1)], so = y * (rowLen + 1) + 1, d0 = y * rowLen, up = d0 - rowLen;
      for (var x = 0; x < rowLen; x++) {
        var rv = data[so + x], a = x >= bpp ? out[d0 + x - bpp] : 0, b = y ? out[up + x] : 0, c = x >= bpp && y ? out[up + x - bpp] : 0, v;
        if (ft === 0) v = rv; else if (ft === 1) v = rv + a; else if (ft === 2) v = rv + b; else if (ft === 3) v = rv + ((a + b) >> 1);
        else { var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = rv + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
        out[d0 + x] = v & 255;
      }
    }
    return out;
  }
  function a85(b) {
    var out = [], g = [], i = 0, s = Array.prototype.map.call(b, function (x) { return x; });
    for (; i < s.length; i++) {
      var c = s[i]; if (c === 126) break; if (c <= 32) continue;
      if (c === 122 && !g.length) { out.push(0, 0, 0, 0); continue; }
      g.push(c - 33);
      if (g.length === 5) { var v = 0; g.forEach(function (d) { v = v * 85 + d; }); out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); g = []; }
    }
    if (g.length > 1) { var n = g.length; while (g.length < 5) g.push(84); var v2 = 0; g.forEach(function (d) { v2 = v2 * 85 + d; }); var bytes = [(v2 >>> 24) & 255, (v2 >>> 16) & 255, (v2 >>> 8) & 255, v2 & 255]; for (var k = 0; k < n - 1; k++) out.push(bytes[k]); }
    return new Uint8Array(out);
  }
  function ahex(b) {
    var h = []; for (var i = 0; i < b.length; i++) { var c = b[i]; if (c === 62) break; if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) h.push(String.fromCharCode(c)); }
    if (h.length % 2) h.push("0"); var o = new Uint8Array(h.length / 2); for (var j = 0; j < o.length; j++) o[j] = parseInt(h[2 * j] + h[2 * j + 1], 16); return o;
  }

  /* ================= lexer / parser ================= */
  var WS = { 0: 1, 9: 1, 10: 1, 12: 1, 13: 1, 32: 1 }, DELIM = { 40: 1, 41: 1, 60: 1, 62: 1, 91: 1, 93: 1, 123: 1, 125: 1, 47: 1, 37: 1 };
  function Parser(buf, pos, doc) { this.b = buf; this.p = pos || 0; this.doc = doc; }
  Parser.prototype.ws = function () {
    var b = this.b;
    for (;;) {
      while (this.p < b.length && WS[b[this.p]]) this.p++;
      if (b[this.p] === 37) { while (this.p < b.length && b[this.p] !== 10 && b[this.p] !== 13) this.p++; } else break;
    }
  };
  Parser.prototype.isDelimOrWs = function (c) { return c === undefined || WS[c] || DELIM[c]; };
  Parser.prototype.readInt = function () {
    var s = this.p, b = this.b; while (b[this.p] >= 48 && b[this.p] <= 57) this.p++;
    if (this.p === s) return null; return parseInt(String.fromCharCode.apply(null, b.subarray(s, this.p)), 10);
  };
  Parser.prototype.obj = function () {
    this.ws(); var b = this.b, c = b[this.p];
    if (c === undefined) throw PdfError("eof", "unexpected end of data");
    if (c === 60 && b[this.p + 1] === 60) return this.dict();
    if (c === 60) return this.hexStr();
    if (c === 91) { this.p++; var a = []; for (;;) { this.ws(); if (b[this.p] === 93) { this.p++; break; } if (this.p >= b.length) break; a.push(this.obj()); } return a; }
    if (c === 40) return this.litStr();
    if (c === 47) return this.name();
    if ((c >= 48 && c <= 57) || c === 43 || c === 45 || c === 46) return this.num();
    var s = this.p; while (this.p < b.length && !this.isDelimOrWs(b[this.p])) this.p++;
    var kw = String.fromCharCode.apply(null, b.subarray(s, this.p));
    if (kw === "true") return true; if (kw === "false") return false; if (kw === "null") return null;
    if (this.p === s) this.p++; /* stray delimiter, skip */
    throw PdfError("syntax", "unexpected token '" + kw + "'");
  };
  Parser.prototype.num = function () {
    var b = this.b, s = this.p, c = b[this.p];
    if (c === 43 || c === 45) this.p++;
    var isInt = true; while (this.p < b.length && ((b[this.p] >= 48 && b[this.p] <= 57) || b[this.p] === 46 || b[this.p] === 45)) { if (b[this.p] === 46) isInt = false; this.p++; }
    var t = String.fromCharCode.apply(null, b.subarray(s, this.p)).replace(/(?!^)-/g, ""), v = parseFloat(t); if (isNaN(v)) v = 0;
    if (isInt && v >= 0 && !/^[-+]/.test(t)) { /* maybe "n g R" */
      var save = this.p; this.ws(); var g = this.readInt();
      if (g !== null) { this.ws(); if (b[this.p] === 82 && this.isDelimOrWs(b[this.p + 1])) { this.p++; return new Ref(v, g); } }
      this.p = save;
    }
    return v;
  };
  Parser.prototype.name = function () {
    var b = this.b, out = []; this.p++;
    while (this.p < b.length && !this.isDelimOrWs(b[this.p])) {
      var c = b[this.p++];
      if (c === 35 && this.p + 1 < b.length) { var h = parseInt(String.fromCharCode(b[this.p], b[this.p + 1]), 16); if (!isNaN(h)) { out.push(h); this.p += 2; continue; } }
      out.push(c);
    }
    return new Name(decodeURIComponentSafe(out));
  };
  function decodeURIComponentSafe(bytes) { try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { return String.fromCharCode.apply(null, bytes); } }
  Parser.prototype.hexStr = function () {
    var b = this.b, h = []; this.p++;
    while (this.p < b.length && b[this.p] !== 62) { var c = b[this.p++]; if ((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)) h.push(String.fromCharCode(c)); }
    this.p++; if (h.length % 2) h.push("0"); var o = new Uint8Array(h.length / 2); for (var i = 0; i < o.length; i++) o[i] = parseInt(h[2 * i] + h[2 * i + 1], 16); return new Str(o, true);
  };
  Parser.prototype.litStr = function () {
    var b = this.b, o = [], depth = 1; this.p++;
    while (this.p < b.length && depth > 0) {
      var c = b[this.p++];
      if (c === 92) {
        var d = b[this.p++];
        if (d === 110) o.push(10); else if (d === 114) o.push(13); else if (d === 116) o.push(9); else if (d === 98) o.push(8); else if (d === 102) o.push(12);
        else if (d >= 48 && d <= 55) { var v = d - 48, k = 0; while (k < 2 && b[this.p] >= 48 && b[this.p] <= 55) { v = v * 8 + b[this.p++] - 48; k++; } o.push(v & 255); }
        else if (d === 13) { if (b[this.p] === 10) this.p++; } else if (d === 10) { /* line continuation */ } else o.push(d);
      } else if (c === 40) { depth++; o.push(c); } else if (c === 41) { depth--; if (depth > 0) o.push(c); } else o.push(c);
    }
    return new Str(new Uint8Array(o), false);
  };
  Parser.prototype.dict = function () {
    var b = this.b, d = new Dict(); this.p += 2;
    for (;;) {
      this.ws(); if (this.p >= b.length) break;
      if (b[this.p] === 62 && b[this.p + 1] === 62) { this.p += 2; break; }
      if (b[this.p] !== 47) { /* malformed: skip a token */ try { this.obj(); } catch (e) { this.p++; } continue; }
      var k = this.name().n; this.ws();
      if (b[this.p] === 62 && b[this.p + 1] === 62) { d.set(k, null); continue; }
      d.set(k, this.obj());
    }
    return d;
  };
  var te = function (s) { return new TextEncoder().encode(s); };
  function indexOfBytes(buf, pat, from, to) {
    outer: for (var i = from || 0, e = (to === undefined ? buf.length : to) - pat.length; i <= e; i++) { for (var j = 0; j < pat.length; j++) if (buf[i + j] !== pat[j]) continue outer; return i; }
    return -1;
  }
  function lastIndexOfBytes(buf, pat, from) {
    outer: for (var i = (from === undefined ? buf.length - pat.length : from); i >= 0; i--) { for (var j = 0; j < pat.length; j++) if (buf[i + j] !== pat[j]) continue outer; return i; }
    return -1;
  }
  var ENDSTREAM = te("endstream"), ENDOBJ = te("endobj"), STARTXREF = te("startxref");

  /* ================= document ================= */
  function Doc() { this.objs = new Map(); this.xref = null; this.trailer = new Dict(); this.nextNum = 1; this.buf = null; this._pages = null; this.cache = new Map(); }

  Doc.create = function () {
    var d = new Doc(); var pages = d.add(mkDict({ Type: N("Pages"), Kids: [], Count: 0 }));
    var cat = d.add(mkDict({ Type: N("Catalog"), Pages: pages }));
    d.trailer.set("Root", cat); d.pagesRef = pages; d._pages = []; d._producer = true; return d;
  };
  Doc.prototype.add = function (o) { var r = new Ref(this.nextNum++, 0); this.objs.set(r.num, o); return r; };

  Doc.load = function (input, opt) {
    opt = opt || {};
    var buf = input instanceof Uint8Array ? input : new Uint8Array(input.buffer ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input);
    var d = new Doc(); d.buf = buf;
    if (indexOfBytes(buf, te("%PDF-"), 0, Math.min(buf.length, 2048)) < 0) throw PdfError("not-pdf", "This file is not a PDF.");
    d.headerOffset = Math.max(0, indexOfBytes(buf, te("%PDF-"), 0, Math.min(buf.length, 2048)));
    var ok = false;
    try { ok = d.readXrefChain(); if (ok) d.root(); } catch (e) { if (e.code === "encrypted") throw e; ok = false; }
    if (!ok) { d.cache.clear(); d.rebuild(); }
    if (d.trailer.has("Encrypt") && !opt.ignoreEncryption) throw PdfError("encrypted", "This PDF is password protected.");
    var rt; try { rt = d.root(); } catch (e) { rt = null; }
    if (!rt || !dictOf(rt)) { d.cache.clear(); d.rebuild(); rt = d.root(); if (!rt) throw PdfError("damaged", "This PDF is damaged and cannot be read."); }
    d.nextNum = (d.maxNum || 0) + 1;
    return d;
  };
  Doc.prototype.root = function () { return this.get(this.trailer.get("Root")); };

  Doc.prototype.readXrefChain = function () {
    var buf = this.buf, sx = lastIndexOfBytes(buf, STARTXREF); if (sx < 0) return false;
    var p = new Parser(buf, sx + 9); p.ws(); var off = p.readInt(); if (off === null) return false;
    this.xref = new Map(); this.maxNum = 0;
    var seen = new Set(), queue = [off + this.headerOffset], first = true;
    while (queue.length) {
      var o = queue.shift(); if (seen.has(o) || o < 0 || o >= buf.length) { if (first) return false; continue; } seen.add(o);
      var pr = new Parser(buf, o); pr.ws(); var tr;
      if (buf[pr.p] === 120 && buf[pr.p + 1] === 114) { /* "xref" */
        pr.p += 4; pr.ws();
        for (;;) {
          pr.ws(); if (buf[pr.p] === 116) break; /* "trailer" */
          var start = pr.readInt(); pr.ws(); var cnt = pr.readInt(); if (start === null || cnt === null) return false;
          for (var i = 0; i < cnt; i++) {
            pr.ws(); var offs = pr.readInt(); pr.ws(); var gen = pr.readInt(); pr.ws(); var f = buf[pr.p]; pr.p++;
            if (offs === null || gen === null) return false;
            var num = start + i; if (!this.xref.has(num)) this.xref.set(num, f === 110 ? { t: 1, off: offs + this.headerOffset, gen: gen } : { t: 0 });
            if (num > this.maxNum) this.maxNum = num;
          }
        }
        pr.p += 7; tr = pr.obj(); if (!(tr instanceof Dict)) return false;
        if (tr.has("XRefStm")) queue.unshift(tr.get("XRefStm") + this.headerOffset);
      } else { /* xref stream */
        var st = this.parseIndirectAt(o); if (!st || !(st.v instanceof Stream)) return false;
        tr = st.v.dict; var data = this.decodeStream(st.v);
        var W = tr.get("W"), idx = tr.get("Index") || [0, tr.get("Size")], w0 = W[0], w1 = W[1], w2 = W[2], q = 0;
        for (var s = 0; s < idx.length; s += 2) for (var k = 0; k < idx[s + 1]; k++) {
          var rd = function (n) { var v = 0; for (var z = 0; z < n; z++) v = v * 256 + data[q++]; return v; };
          var t = w0 ? rd(w0) : 1, a = rd(w1), b2 = rd(w2), nn = idx[s] + k;
          if (q > data.length) break;
          if (!this.xref.has(nn)) this.xref.set(nn, t === 1 ? { t: 1, off: a + this.headerOffset, gen: b2 } : t === 2 ? { t: 2, stm: a, idx: b2 } : { t: 0 });
          if (nn > this.maxNum) this.maxNum = nn;
        }
      }
      if (first) { this.trailer = new Dict(new Map(tr.m)); first = false; } else tr.keys().forEach(function (k2) { if (!this.trailer.has(k2)) this.trailer.set(k2, tr.get(k2)); }, this);
      var prev = tr.get("Prev"); if (typeof prev === "number") queue.push(prev + this.headerOffset);
    }
    return this.trailer.has("Root");
  };

  /* Recover when the xref is missing or wrong: scan the file for "N G obj" and trailers. */
  Doc.prototype.rebuild = function () {
    var buf = this.buf, s = ""; for (var i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, Math.min(buf.length, i + 32768)));
    this.xref = new Map(); this.maxNum = 0; this.objs = new Map(); this.cache = new Map();
    var re = /(?:^|[\r\n\s])(\d{1,10})\s+(\d{1,5})\s+obj\b/g, m, found = [];
    while ((m = re.exec(s))) { var num = +m[1], off = m.index + m[0].indexOf(m[1]); found.push([num, +m[2], off]); this.xref.set(num, { t: 1, off: off, gen: +m[2] }); if (num > this.maxNum) this.maxNum = num; }
    var tr = new Dict(), trre = /trailer/g, t;
    while ((t = trre.exec(s))) { try { var d = new Parser(buf, t.index + 7).obj(); if (d instanceof Dict) d.keys().forEach(function (k) { tr.set(k, d.get(k)); }); } catch (e) { /* ignore */ } }
    var self = this;
    found.forEach(function (f) { /* xref streams carry the trailer keys; object streams hold compressed objects */
      var ref = new Ref(f[0], f[1]), o; try { o = self.getRaw(ref); } catch (e) { return; }
      var dd = dictOf(o); if (!dd) return;
      if (isName(dd.get("Type"), "XRef")) ["Root", "Info", "ID", "Encrypt"].forEach(function (k) { if (dd.has(k) && !tr.has(k)) tr.set(k, dd.get(k)); });
      if (isName(dd.get("Type"), "ObjStm") && o instanceof Stream) {
        try {
          var data = self.decodeStream(o), n = dd.get("N"), pp = new Parser(data, 0), ids = [];
          for (var k = 0; k < n; k++) { pp.ws(); var on = pp.readInt(); pp.ws(); pp.readInt(); ids.push(on); }
          ids.forEach(function (on2, ix) { if (!self.xref.has(on2) || self.xref.get(on2).t !== 1) self.xref.set(on2, { t: 2, stm: f[0], idx: ix }); if (on2 > self.maxNum) self.maxNum = on2; });
        } catch (e) { /* ignore */ }
      }
    });
    if (!tr.has("Root")) { /* find the catalog by type */
      for (var num2 of this.xref.keys()) { var oo; try { oo = this.get(new Ref(num2, 0)); } catch (e) { continue; } var d2 = dictOf(oo); if (d2 && isName(d2.get("Type"), "Catalog")) tr.set("Root", new Ref(num2, 0)); }
    }
    this.trailer = tr;
  };

  Doc.prototype.parseIndirectAt = function (off) {
    var p = new Parser(this.buf, off, this); p.ws();
    var num = p.readInt(); p.ws(); var gen = p.readInt(); p.ws();
    if (num === null || gen === null || this.buf[p.p] !== 111 || this.buf[p.p + 1] !== 98 || this.buf[p.p + 2] !== 106) return null;
    p.p += 3; var v = p.obj(); p.ws();
    if (v instanceof Dict && this.buf[p.p] === 115 && this.buf[p.p + 1] === 116 && this.buf[p.p + 2] === 114) { /* "stream" */
      p.p += 6; if (this.buf[p.p] === 13) p.p++; if (this.buf[p.p] === 10) p.p++;
      var start = p.p, len = v.get("Length"), end = -1;
      if (len instanceof Ref) { try { len = this.get(len); } catch (e) { len = null; } }
      if (typeof len === "number" && len >= 0 && start + len <= this.buf.length) {
        var q = start + len; while (WS[this.buf[q]]) q++;
        if (this.buf[q] === 101 && indexOfBytes(this.buf, ENDSTREAM, q, q + 9) === q) end = start + len;
      }
      if (end < 0) { end = indexOfBytes(this.buf, ENDSTREAM, start); if (end < 0) end = this.buf.length; if (this.buf[end - 1] === 10) end--; if (this.buf[end - 1] === 13) end--; }
      v = new Stream(v, this.buf.slice(start, end));
    }
    return { num: num, gen: gen, v: v };
  };

  Doc.prototype.getRaw = function (ref) {
    var num = ref.num;
    if (this.objs.has(num)) return this.objs.get(num);
    if (this.cache.has(num)) return this.cache.get(num);
    var e = this.xref && this.xref.get(num); if (!e || e.t === 0) return null;
    var v = null;
    if (e.t === 1) {
      var r = this.parseIndirectAt(e.off);
      if (!r || r.num !== num) { /* offset is wrong: search for the object header */
        var hdr = new RegExp("(^|[\\r\\n\\s])" + num + "\\s+\\d+\\s+obj\\b"), s = ""; var b = this.buf;
        for (var i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 32768)));
        var mm = hdr.exec(s); r = mm ? this.parseIndirectAt(mm.index + mm[0].indexOf(String(num))) : null;
      }
      v = r ? r.v : null;
    } else if (e.t === 2) {
      var stm = this.getRaw(new Ref(e.stm, 0)); if (!(stm instanceof Stream)) return null;
      var key = "os" + e.stm, os = this.cache.get(key);
      if (!os) {
        var data = this.decodeStream(stm), n = stm.dict.get("N"), first = stm.dict.get("First"), pp = new Parser(data, 0), nums = [], offs = [];
        for (var k = 0; k < n; k++) { pp.ws(); nums.push(pp.readInt()); pp.ws(); offs.push(pp.readInt()); }
        os = { data: data, nums: nums, offs: offs, first: first }; this.cache.set(key, os);
      }
      var ix = os.nums[e.idx] === num ? e.idx : os.nums.indexOf(num); if (ix < 0) return null;
      v = new Parser(os.data, os.first + os.offs[ix], this).obj();
    }
    this.cache.set(num, v); return v;
  };
  Doc.prototype.get = function (o) { var n = 0; while (o instanceof Ref && n++ < 32) o = this.getRaw(o); return o instanceof Ref ? null : o; };
  Doc.prototype.dget = function (d, k) { return this.get(dictOf(d) ? dictOf(d).get(k) : null); };

  Doc.prototype.decodeStream = function (st) {
    var f = this.get(st.dict.get("Filter") || st.dict.get("F")), pr = this.get(st.dict.get("DecodeParms") || st.dict.get("DP")), data = st.raw;
    var fl = f == null ? [] : Array.isArray(f) ? f.map(this.get, this) : [f], ps = Array.isArray(pr) ? pr.map(this.get, this) : [pr];
    for (var i = 0; i < fl.length; i++) {
      var n = fl[i] && fl[i].n, parms = ps[i] instanceof Dict ? ps[i] : null;
      if (n === "FlateDecode" || n === "Fl") data = unpredict(zlibInflate(data), parms ? resolveDict(this, parms) : null);
      else if (n === "ASCIIHexDecode" || n === "AHx") data = ahex(data);
      else if (n === "ASCII85Decode" || n === "A85") data = a85(data);
      else if (n === "RunLengthDecode" || n === "RL") { var o = [], q = 0; while (q < data.length) { var l = data[q++]; if (l === 128) break; if (l < 128) { for (var k = 0; k <= l; k++) o.push(data[q + k]); q += l + 1; } else { for (var k2 = 0; k2 < 257 - l; k2++) o.push(data[q]); q++; } } data = new Uint8Array(o); }
      else throw PdfError("unsupported", "unsupported stream filter " + n);
    }
    return data;
  };
  function resolveDict(doc, d) { var r = new Dict(); d.keys().forEach(function (k) { r.set(k, doc.get(d.get(k))); }); return r; }

  /* ---------- pages ---------- */
  var INHERIT = ["Resources", "MediaBox", "CropBox", "Rotate"];
  Doc.prototype.loadPages = function () {
    if (this._pages) return this._pages;
    var out = [], self = this, seen = new Set();
    function walk(nodeRef, inh) {
      var node = self.get(nodeRef), d = dictOf(node); if (!d) return;
      if (nodeRef instanceof Ref) { if (seen.has(nodeRef.num)) return; seen.add(nodeRef.num); }
      var kids = self.get(d.get("Kids")), type = self.get(d.get("Type"));
      if (Array.isArray(kids) && !(isName(type, "Page"))) {
        var ni = Object.assign({}, inh); INHERIT.forEach(function (k) { if (d.has(k)) ni[k] = d.get(k); });
        kids.forEach(function (k) { walk(k, ni); });
      } else out.push(new Page(self, nodeRef instanceof Ref ? nodeRef : self.add(d), inh));
    }
    var pr = this.get(this.root()) && this.get(this.root()); var rootD = dictOf(pr);
    walk(rootD ? rootD.get("Pages") : null, {});
    this._pages = out; return out;
  };

  function Page(doc, ref, inh) { this.doc = doc; this.ref = ref; this.inh = inh || {}; }
  Page.prototype.dict = function () { return dictOf(this.doc.get(this.ref)); };
  Page.prototype.attr = function (k) { var d = this.dict(); return this.doc.get(d.has(k) ? d.get(k) : this.inh[k]); };
  Page.prototype.getMediaBox = function () {
    var mb = this.attr("MediaBox"), v = Array.isArray(mb) ? mb.map(function (x) { return this.doc.get(x); }, this) : null;
    if (!v || v.length < 4 || v.some(function (x) { return typeof x !== "number"; })) return [0, 0, 612, 792];
    return [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])];
  };
  Page.prototype.getSize = function () { var m = this.getMediaBox(); return { width: m[2] - m[0], height: m[3] - m[1] }; };
  Page.prototype.getRotation = function () { var r = this.attr("Rotate"); r = typeof r === "number" ? r : 0; return { type: "degrees", angle: ((Math.round(r / 90) * 90) % 360 + 360) % 360 }; };
  Page.prototype.setRotation = function (a) {
    a = typeof a === "object" ? a.angle : a;
    if (a % 90 !== 0) throw PdfError("invalid", "rotation must be a multiple of 90");
    this.dict().set("Rotate", ((a % 360) + 360) % 360);
  };

  Doc.prototype.getPageCount = function () { return this.loadPages().length; };
  Doc.prototype.getPageIndices = function () { return this.loadPages().map(function (_, i) { return i; }); };
  Doc.prototype.getPage = function (i) { var p = this.loadPages()[i]; if (!p) throw PdfError("range", "page " + i + " does not exist"); return p; };
  Doc.prototype.getPages = function () { return this.loadPages().slice(); };

  Doc.prototype.ensureTree = function () {
    /* flatten into one Pages node so editing stays simple and valid */
    var pages = this.loadPages(), rootD = dictOf(this.get(this.root())), pref = rootD.get("Pages");
    if (!(pref instanceof Ref) || !dictOf(this.get(pref))) { pref = this.add(mkDict({ Type: N("Pages"), Kids: [], Count: 0 })); rootD.set("Pages", pref); }
    this.pagesRef = pref; return pages;
  };
  Doc.prototype.syncTree = function () {
    var pages = this._pages, pd = dictOf(this.get(this.pagesRef)), self = this;
    pd.set("Kids", pages.map(function (p) { return p.ref; })); pd.set("Count", pages.length); pd.del("Parent");
    pages.forEach(function (p) { var d = p.dict(); d.set("Parent", self.pagesRef); INHERIT.forEach(function (k) { if (!d.has(k) && p.inh[k] !== undefined) d.set(k, p.inh[k]); }); p.inh = {}; });
  };
  Doc.prototype.addPage = function (a) {
    this.ensureTree(); var p;
    if (a instanceof Page) p = a;
    else { var sz = Array.isArray(a) ? a : [595.28, 841.89]; p = new Page(this, this.add(mkDict({ Type: N("Page"), MediaBox: [0, 0, sz[0], sz[1]], Resources: new Dict(), Contents: [] })), {}); }
    this._pages.push(p); return p;
  };
  Doc.prototype.insertPage = function (i, a) { var p = this.addPage(a); this._pages.pop(); this._pages.splice(i, 0, p); return p; };
  Doc.prototype.removePage = function (i) { this.ensureTree(); this._pages.splice(i, 1); };

  /* copy pages from another document: deep-copies everything a page needs, never drags in the other pages */
  var SKIP_KEYS = { Parent: 1, StructParents: 1, B: 1, Thumb: 1, PieceInfo: 1, "AA": 1 };
  Doc.prototype.copyPages = function (src, indices) {
    var self = this, memo = new Map();
    function copy(o, depth) {
      if (o instanceof Ref) {
        if (memo.has(o.num)) return memo.get(o.num);
        var target = src.getRaw(o), td = dictOf(target);
        if (td && isName(src.get(td.get("Type")), "Page")) return null; /* links to other pages are dropped */
        var nr = new Ref(self.nextNum++, 0); memo.set(o.num, nr); self.objs.set(nr.num, null);
        self.objs.set(nr.num, copy(target, depth + 1)); return nr;
      }
      if (Array.isArray(o)) return o.map(function (x) { return copy(x, depth + 1); });
      if (o instanceof Dict) { var d = new Dict(); o.m.forEach(function (v, k) { if (depth <= 1 && SKIP_KEYS[k]) return; d.set(k, copy(v, depth + 1)); }); return d; }
      if (o instanceof Stream) { var s = new Stream(copy(o.dict, depth + 1), o.raw); return s; }
      return o;
    }
    var pages = src.loadPages(), out = [];
    (indices || src.getPageIndices()).forEach(function (i) {
      var pg = pages[i]; if (!pg) throw PdfError("range", "page " + (i + 1) + " does not exist");
      var d = pg.dict().m, nd = new Dict();
      d.forEach(function (v, k) { if (!SKIP_KEYS[k]) nd.set(k, copy(v, 1)); });
      INHERIT.forEach(function (k) { if (!nd.has(k) && pg.inh[k] !== undefined) nd.set(k, copy(pg.inh[k], 1)); });
      nd.set("Type", N("Page")); if (!nd.has("Resources")) nd.set("Resources", new Dict());
      /* annotations: keep the widgets and links, drop the back pointer */
      out.push(new Page(self, self.add(nd), {}));
    });
    return Promise.resolve(out);
  };

  /* ---------- metadata ---------- */
  function textString(s) {
    s = String(s); if (/^[\x20-\x7e]*$/.test(s)) return new Str(te(s), false);
    var u = [0xfe, 0xff]; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); u.push(c >> 8, c & 255); } return new Str(new Uint8Array(u), true);
  }
  Doc.prototype.info = function () {
    var r = this.trailer.get("Info"), d = dictOf(this.get(r));
    if (!d) { d = new Dict(); this.trailer.set("Info", this.add(d)); }
    return d;
  };
  ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"].forEach(function (k) { Doc.prototype["set" + k] = function (v) { this.info().set(k, textString(v)); return this; }; });
  Doc.prototype.getTitle = function () { var s = this.get(this.info().get("Title")); return s instanceof Str ? strText(s) : undefined; };
  function strText(s) { var b = s.b; if (b[0] === 0xfe && b[1] === 0xff) { var o = ""; for (var i = 2; i + 1 < b.length; i += 2) o += String.fromCharCode((b[i] << 8) | b[i + 1]); return o; } return String.fromCharCode.apply(null, b); }

  /* ================= writer ================= */
  function fmtNum(n) { if (!isFinite(n)) return "0"; if (Math.floor(n) === n) return String(n); var s = n.toFixed(6).replace(/0+$/, "").replace(/\.$/, ""); return s === "-0" ? "0" : s; }
  function serialize(o, out) {
    if (o === null || o === undefined) out.push("null");
    else if (o === true) out.push("true"); else if (o === false) out.push("false");
    else if (typeof o === "number") out.push(fmtNum(o));
    else if (o instanceof Name) out.push("/" + escName(o.n));
    else if (o instanceof Ref) out.push(o.num + " " + o.gen + " R");
    else if (o instanceof Str) {
      var b = o.b, plain = !o.hex; if (plain) for (var i = 0; i < b.length; i++) if (b[i] < 32 || b[i] > 126) { plain = false; break; }
      if (plain) { var s = ""; for (var j = 0; j < b.length; j++) { var c = b[j]; s += (c === 40 || c === 41 || c === 92) ? "\\" + String.fromCharCode(c) : String.fromCharCode(c); } out.push("(" + s + ")"); }
      else { var h = ""; for (var k = 0; k < b.length; k++) h += (b[k] < 16 ? "0" : "") + b[k].toString(16); out.push("<" + h + ">"); }
    } else if (Array.isArray(o)) { out.push("["); o.forEach(function (x, i2) { if (i2) out.push(" "); serialize(x, out); }); out.push("]"); }
    else if (o instanceof Dict) { out.push("<<"); o.m.forEach(function (v, k2) { out.push("/" + escName(k2) + " "); serialize(v, out); out.push(" "); }); out.push(">>"); }
    else throw PdfError("write", "cannot write value of type " + typeof o);
  }
  function escName(n) {
    var b = te(n), s = ""; for (var i = 0; i < b.length; i++) { var c = b[i]; s += (c < 33 || c > 126 || DELIM[c] || c === 35) ? "#" + (c < 16 ? "0" : "") + c.toString(16) : String.fromCharCode(c); } return s;
  }
  var latin = function (s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };

  Doc.prototype.save = function () {
    var self = this;
    if (this._pages) { this.ensureTree(); this.syncTree(); }
    if (this._producer) { var inf = this.info(); if (!inf.has("Producer")) inf.set("Producer", textString("DTAhub")); if (!inf.has("CreationDate")) inf.set("CreationDate", new Str(te(pdfDate(new Date())), false)); this._producer = false; }
    /* reachable objects only, renumbered from 1 */
    var order = [], map = new Map();
    function visit(o) {
      if (o instanceof Ref) {
        if (map.has(o.num)) return; var t = self.getRaw(o); if (t === null || t === undefined) { return; }
        map.set(o.num, order.length + 1); order.push([o.num, t]); visit(t);
      } else if (Array.isArray(o)) o.forEach(visit);
      else if (o instanceof Dict) o.m.forEach(visit);
      else if (o instanceof Stream) visit(o.dict);
    }
    ["Root", "Info"].forEach(function (k) { visit(self.trailer.get(k)); });
    function remap(o) {
      if (o instanceof Ref) return map.has(o.num) ? new Ref(map.get(o.num), 0) : null;
      if (Array.isArray(o)) return o.map(remap);
      if (o instanceof Dict) { var d = new Dict(); o.m.forEach(function (v, k) { d.set(k, remap(v)); }); return d; }
      return o;
    }
    var jobs = order.map(function (e) {
      var o = e[1];
      if (o instanceof Stream) {
        var d = remap(o.dict), raw = o.raw;
        d.del("DL"); d.set("Length", raw.length);
        if (o.compress && !d.has("Filter")) return zlibDeflate(raw).then(function (z) { d.set("Filter", N("FlateDecode")); d.set("Length", z.length); return new Stream(d, z); });
        return Promise.resolve(new Stream(d, raw));
      }
      return Promise.resolve(remap(o));
    });
    return Promise.all(jobs).then(function (objs) {
      var chunks = [], len = 0, offs = [];
      function push(x) { var b = typeof x === "string" ? latin(x) : x; chunks.push(b); len += b.length; }
      push("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
      objs.forEach(function (o, i) {
        offs[i + 1] = len; var parts = []; serialize(o instanceof Stream ? o.dict : o, parts);
        push((i + 1) + " 0 obj\n" + parts.join("")); if (o instanceof Stream) { push("\nstream\n"); push(o.raw); push("\nendstream"); } push("\nendobj\n");
      });
      var xr = len, n = objs.length + 1, x = "xref\n0 " + n + "\n0000000000 65535 f \n";
      for (var i = 1; i < n; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
      var tr = new Dict(); tr.set("Size", n); tr.set("Root", remap(self.trailer.get("Root")));
      if (self.trailer.has("Info") && remap(self.trailer.get("Info"))) tr.set("Info", remap(self.trailer.get("Info")));
      var id = new Uint8Array(16); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(id) : id.forEach(function (_, k) { id[k] = Math.floor(Math.random() * 256); });
      tr.set("ID", [new Str(id, true), new Str(id, true)]);
      var tp = []; serialize(tr, tp); push(x + "trailer\n" + tp.join("") + "\nstartxref\n" + xr + "\n%%EOF\n");
      var out = new Uint8Array(len), p = 0; chunks.forEach(function (c) { out.set(c, p); p += c.length; }); return out;
    });
  };
  function pdfDate(d) { var p = function (n) { return String(n).padStart(2, "0"); }; return "D:" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z"; }

  return {
    Doc: Doc, Page: Page, Name: Name, Ref: Ref, Str: Str, Dict: Dict, Stream: Stream, PdfError: PdfError,
    util: { inflate: zlibInflate, deflate: zlibDeflate, mkDict: mkDict, N: N, dictOf: dictOf, serialize: serialize, textString: textString, Parser: Parser, te: te, strText: strText }
  };
});

/* DTApdf core: DTAhub's own PDF engine. Original code, no third-party dependency.
   Reads PDF 1.0-2.0 files (classic xref, xref streams, object streams, incremental updates, broken-xref recovery),
   copies pages between documents, edits page properties and writes valid PDFs.
   Not supported on purpose: encrypted files (reported clearly, never silently mangled).
     var doc = await DTApdf.Doc.load(bytes);  doc.getPageCount();  var out = DTApdf.Doc.create();
     var pages = await out.copyPages(doc, [0, 2]);  pages.forEach(p => out.addPage(p));  var bytes = await out.save();
   Pure and DOM-free: unit tested in Node (scripts/pdf-test.mjs) against qpdf, pdfinfo, pdftotext and rendered pixels. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root);
  else if (!(root.DTApdf && root.DTApdf.Doc && root.DTApdf.Ref)) { var api = factory(root); var old = root.DTApdf || {}; for (var k in api) old[k] = api[k]; root.DTApdf = old; }
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
  /* A stream's stored bytes are either held in memory (_raw) or still referenced inside the source file (_src, _off, _len) and read only when
     somebody asks for `raw`. The writer copies untouched streams straight from the source as zero-copy slices. */
  function Stream(dict, raw) { this.dict = dict; this._raw = raw === undefined ? null : raw; this._src = null; this._off = 0; this._len = 0; this._dec = null; this.compress = false; }
  Object.defineProperty(Stream.prototype, "raw", {
    get: function () {
      if (this._raw === null) { var b = this._src ? this._src.copy(this._off, this._len) : new Uint8Array(0); this._raw = this._dec ? this._dec(b) : b; }
      return this._raw;
    },
    set: function (v) { this._raw = v; this._src = null; this._dec = null; },
    enumerable: true, configurable: true
  });
  Stream.prototype.rawLength = function () { return this._raw !== null ? this._raw.length : this._dec ? this.raw.length : this._len; };
  Stream.prototype.rawRef = function () { return this._raw === null && this._src && !this._dec ? this._src.ref(this._off, this._len) : null; }; /* zero-copy view of the untouched stored bytes, or null */
  Stream.prototype.clone = function (dict) { var s = new Stream(dict, this._raw); s._src = this._src; s._off = this._off; s._len = this._len; s._dec = this._dec; s.compress = this.compress; return s; };
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
    var pos = start || 0, bitBuf = 0, bitCnt = 0, out = new Uint8Array(Math.min(Math.max(1024, src.length * 4), 67108864)), op = 0, eof = false;
    function need(n) { if (op + n > out.length) { if (op + n > 1200000000) throw PdfError("limit", "decoded data is too large"); var o = new Uint8Array(Math.min(Math.max(out.length * 2, op + n), 1200000000)); o.set(out); out = o; } }
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
  function Parser(buf, pos, doc) { this.b = buf; this.p = pos || 0; this.doc = doc; this.depth = 0; }
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
    if (c === 91) { if (++this.depth > 300) throw PdfError("syntax", "nesting too deep"); this.p++; var a = []; for (;;) { this.ws(); if (b[this.p] === 93) { this.p++; break; } if (this.p >= b.length) break; a.push(this.obj()); } this.depth--; return a; }
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
    var b = this.b, d = new Dict(); this.p += 2; if (++this.depth > 300) throw PdfError("syntax", "nesting too deep");
    for (;;) {
      this.ws(); if (this.p >= b.length) break;
      if (b[this.p] === 62 && b[this.p + 1] === 62) { this.p += 2; break; }
      if (b[this.p] !== 47) { /* malformed: skip a token */ try { this.obj(); } catch (e) { this.p++; } continue; }
      var k = this.name().n; this.ws();
      if (b[this.p] === 62 && b[this.p + 1] === 62) { d.set(k, null); continue; }
      d.set(k, this.obj());
    }
    this.depth--; return d;
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

  /* ================= byte sources =================
     A source gives the engine random access to the file. MemSource wraps bytes already in memory. BlobSource wraps a Blob/File and
     reads it synchronously with FileReaderSync (available inside Web Workers), so files far bigger than memory can be opened: only the
     cross-reference data and the objects that are really needed are read, and stream data is referenced, never copied, until it is
     decoded or written out (as a zero-copy Blob slice). */
  function MemSource(u8) { this.u8 = u8; this.size = u8.length; this.kind = "mem"; }
  MemSource.prototype.read = function (off, len) { if (off < 0) off = 0; return this.u8.subarray(off, Math.min(this.size, off + len)); };
  MemSource.prototype.copy = function (off, len) { return this.u8.slice(off, off + len); };
  MemSource.prototype.ref = function (off, len) { return this.u8.subarray(off, off + len); };
  var BLOCK = 262144, MAXBLOCKS = 48;
  function BlobSource(blob) {
    if (typeof root.FileReaderSync !== "function") throw PdfError("env", "Blob sources need a Web Worker (FileReaderSync).");
    this.blob = blob; this.size = blob.size; this.kind = "blob"; this.fr = new root.FileReaderSync(); this.blocks = new Map();
  }
  BlobSource.prototype._raw = function (off, len) { return new Uint8Array(this.fr.readAsArrayBuffer(this.blob.slice(off, off + len))); };
  BlobSource.prototype._block = function (i) {
    var m = this.blocks, b = m.get(i);
    if (b) { m.delete(i); m.set(i, b); return b; }
    b = this._raw(i * BLOCK, BLOCK); m.set(i, b); if (m.size > MAXBLOCKS) m.delete(m.keys().next().value);
    return b;
  };
  BlobSource.prototype.read = function (off, len) {
    if (off < 0) off = 0; len = Math.min(len, this.size - off); if (len <= 0) return new Uint8Array(0);
    if (len <= BLOCK) { var b0 = Math.floor(off / BLOCK); if (Math.floor((off + len - 1) / BLOCK) === b0) { var s = off - b0 * BLOCK; return this._block(b0).subarray(s, s + len); } }
    return this._raw(off, len);
  };
  BlobSource.prototype.copy = function (off, len) { return this._raw(off, len); };
  BlobSource.prototype.ref = function (off, len) { return this.blob.slice(off, off + len); };
  function isBlobLike(x) { return !!x && typeof x === "object" && typeof x.size === "number" && typeof x.slice === "function" && !(x instanceof Uint8Array) && !(x instanceof ArrayBuffer) && typeof x.read !== "function"; }
  function toSource(input) {
    if (input && typeof input.read === "function" && typeof input.ref === "function" && typeof input.size === "number") return input;
    if (isBlobLike(input)) return new BlobSource(input);
    if (input instanceof Uint8Array) return new MemSource(input);
    if (input instanceof ArrayBuffer) return new MemSource(new Uint8Array(input));
    if (input && input.buffer instanceof ArrayBuffer) return new MemSource(new Uint8Array(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)));
    throw PdfError("not-pdf", "This file is not a PDF.");
  }
  function findBytes(src, pat, from) { /* first occurrence at or after `from`, scanning in 1 MB pieces */
    var CH = 1048576, ov = pat.length - 1, pos = from;
    while (pos < src.size) {
      var n = Math.min(CH + ov, src.size - pos), i = indexOfBytes(src.read(pos, n), pat, 0); if (i >= 0) return pos + i;
      if (pos + n >= src.size) break; pos += CH;
    }
    return -1;
  }
  function findLastBytes(src, pat) { /* last occurrence anywhere: the tail is tried first, then bigger and bigger pieces going backwards */
    var ov = pat.length - 1, end = src.size, CH = 2048;
    while (end > 0) {
      var start = Math.max(0, end - CH), b = src.read(start, Math.min(src.size - start, end - start + ov)), i = lastIndexOfBytes(b, pat);
      if (i >= 0) return start + i;
      end = start; CH = Math.min(CH * 8, 4194304);
    }
    return -1;
  }
  var LATIN1 = typeof TextDecoder === "function" ? new TextDecoder("latin1") : null;
  function latin1(b) { if (LATIN1) return LATIN1.decode(b); var s = ""; for (var i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 32768))); return s; }

  /* ================= document ================= */
  function Doc() { this.objs = new Map(); this.xref = null; this.trailer = new Dict(); this.nextNum = 1; this.buf = null; this.src = null; this._pages = null; this.cache = new Map(); this._os = new Map(); this._osBytes = 0; }

  Doc.create = function () {
    var d = new Doc(); var pages = d.add(mkDict({ Type: N("Pages"), Kids: [], Count: 0 }));
    var cat = d.add(mkDict({ Type: N("Catalog"), Pages: pages }));
    d.trailer.set("Root", cat); d.pagesRef = pages; d._pages = []; d._producer = true; return d;
  };
  Doc.prototype.add = function (o) { var r = new Ref(this.nextNum++, 0); this.objs.set(r.num, o); return r; };

  /* input: Uint8Array | ArrayBuffer | Blob/File (only inside a Web Worker) | a source object. Throws PdfError codes: not-pdf, encrypted, damaged. */
  Doc.load = function (input, opt) {
    opt = opt || {};
    var src = toSource(input), d = new Doc(); d.src = src; if (src.u8) d.buf = src.u8;
    var head = src.read(0, Math.min(src.size, 2048)), hp = indexOfBytes(head, te("%PDF-"), 0, head.length);
    if (hp < 0) throw PdfError("not-pdf", "This file is not a PDF.");
    d.headerOffset = Math.max(0, hp);
    var ok = false;
    try { ok = d.readXrefChain(); if (ok) d.root(); } catch (e) { if (e.code === "encrypted") throw e; ok = false; }
    if (!ok) { d.cache.clear(); d._os.clear(); d.rebuild(); d._rebuilt = true; }
    if (d.trailer.has("Encrypt") && !opt.ignoreEncryption) d.setupCrypt();
    var rt; try { rt = d.root(); } catch (e) { rt = null; }
    if (!rt || !dictOf(rt)) { d.cache.clear(); d._os.clear(); d.rebuild(); d._rebuilt = true; rt = d.root(); if (!rt) throw PdfError("damaged", "This PDF is damaged and cannot be read."); }
    d.nextNum = (d.maxNum || 0) + 1;
    return d;
  };
  /* like load, but also accepts a Blob on the main thread (read into memory there, because only workers can read a Blob synchronously) */
  Doc.loadAsync = function (input, opt) {
    if (isBlobLike(input) && typeof root.FileReaderSync !== "function") {
      return (typeof input.arrayBuffer === "function" ? input.arrayBuffer() : Promise.reject(PdfError("env", "cannot read this file"))).then(function (ab) { return Doc.load(new Uint8Array(ab), opt); });
    }
    try { return Promise.resolve(Doc.load(input, opt)); } catch (e) { return Promise.reject(e); }
  };
  Doc.prototype.setupCrypt = function () {
    var er = this.trailer.get("Encrypt"), ed = dictOf(this.get(er)); if (!ed) throw PdfError("encrypted", "This PDF is password protected.");
    var ids = this.get(this.trailer.get("ID")), id0 = Array.isArray(ids) && this.get(ids[0]) instanceof Str ? this.get(ids[0]).b : new Uint8Array(0);
    if (er instanceof Ref) this.encNum = er.num;
    this.crypt = makeCrypt(this, ed, id0); this.cache.clear(); this._os.clear(); this._osBytes = 0;
  };
  Doc.prototype.root = function () { return this.get(this.trailer.get("Root")); };

  /* classic cross-reference table: `pos` is just after the word "xref". Returns the trailer dictionary, or null when the table is unusable. */
  Doc.prototype._readXrefTable = function (pos, hint) {
    var src = this.src, hdr = this.headerOffset, avail = src.size - pos, win = src.u8 ? avail : Math.min(avail, Math.max(65536, (hint || 0) + 1024));
    for (;;) {
      var b = src.read(pos, win), pr = new Parser(b, 0), more = win < avail, tr = null, bad = false;
      try {
        for (;;) {
          pr.ws(); if (pr.p >= b.length) { bad = true; break; }
          if (b[pr.p] === 116) break; /* "trailer" */
          var start = pr.readInt(); pr.ws(); var cnt = pr.readInt(); if (start === null || cnt === null) { bad = true; break; }
          for (var i = 0; i < cnt; i++) {
            pr.ws(); var offs = pr.readInt(); pr.ws(); var gen = pr.readInt(); pr.ws(); var f = b[pr.p]; pr.p++;
            if (offs === null || gen === null) { bad = true; break; }
            var num = start + i; if (!this.xref.has(num)) this.xref.set(num, f === 110 ? { t: 1, off: offs + hdr, gen: gen } : { t: 0 });
            if (num > this.maxNum) this.maxNum = num;
          }
          if (bad) break;
        }
        if (!bad) { pr.p += 7; tr = pr.obj(); if (!(tr instanceof Dict)) bad = true; else if (more && pr.p > b.length - 64) bad = true; }
      } catch (e) { bad = true; }
      if (!bad) return tr;
      if (!more) return null;
      win = Math.min(avail, win * 4);
    }
  };

  Doc.prototype.readXrefChain = function () {
    var src = this.src, sx = findLastBytes(src, STARTXREF); if (sx < 0) return false;
    var p = new Parser(src.read(sx + 9, 48), 0); p.ws(); var off = p.readInt(); if (off === null) return false;
    this.xref = new Map(); this.maxNum = 0;
    var seen = new Set(), hdr = this.headerOffset, queue = [off + hdr], first = true;
    while (queue.length) {
      var o = queue.shift(); if (seen.has(o) || o < 0 || o >= src.size) { if (first) return false; continue; } seen.add(o);
      var head = src.read(o, 64), hp = new Parser(head, 0), tr; hp.ws();
      if (head[hp.p] === 120 && head[hp.p + 1] === 114) { /* "xref" */
        tr = this._readXrefTable(o + hp.p + 4, first ? sx - o : 0); if (!tr) return false;
        if (tr.has("XRefStm")) queue.unshift(tr.get("XRefStm") + hdr);
      } else { /* xref stream */
        var st = this.parseIndirectAt(o); if (!st || !(st.v instanceof Stream)) return false;
        tr = st.v.dict; var data = this.decodeStream(st.v);
        var W = tr.get("W"), idx = tr.get("Index") || [0, tr.get("Size")], w0 = W[0], w1 = W[1], w2 = W[2], q = 0, z, v1, v2, v3;
        for (var s = 0; s < idx.length; s += 2) for (var k = 0; k < idx[s + 1]; k++) {
          if (q + w0 + w1 + w2 > data.length) break;
          if (w0) { v1 = 0; for (z = 0; z < w0; z++) v1 = v1 * 256 + data[q++]; } else v1 = 1;
          v2 = 0; for (z = 0; z < w1; z++) v2 = v2 * 256 + data[q++];
          v3 = 0; for (z = 0; z < w2; z++) v3 = v3 * 256 + data[q++];
          var nn = idx[s] + k;
          if (!this.xref.has(nn)) this.xref.set(nn, v1 === 1 ? { t: 1, off: v2 + hdr, gen: v3 } : v1 === 2 ? { t: 2, stm: v2, idx: v3 } : { t: 0 });
          if (nn > this.maxNum) this.maxNum = nn;
        }
      }
      if (first) { this.trailer = new Dict(new Map(tr.m)); first = false; } else tr.keys().forEach(function (k2) { if (!this.trailer.has(k2)) this.trailer.set(k2, tr.get(k2)); }, this);
      var prev = tr.get("Prev"); if (typeof prev === "number") queue.push(prev + hdr);
    }
    return this.trailer.has("Root");
  };

  /* Finds every "N G obj" header (and every "trailer" word) in 4 MB pieces, so even huge damaged files never need one giant string. */
  Doc.prototype._scanObjects = function (onObj, onTrailer) {
    var src = this.src, size = src.size, CH = 4194304, OV = 1300, pos = 0, re = /(?:^|[\r\n\s])(\d{1,10})\s+(\d{1,5})\s+obj\b/g, tre = /trailer/g;
    while (pos < size) {
      var cs = pos > 0 ? pos - 1 : 0, end = Math.min(size, pos + CH + OV), s = latin1(src.read(cs, end - cs)), lim = Math.min(size, pos + CH), m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        var abs = cs + m.index + m[0].indexOf(m[1]); if (abs < pos) continue; if (abs >= lim) break;
        onObj(+m[1], +m[2], abs, s, m.index + m[0].length);
      }
      tre.lastIndex = 0;
      while ((m = tre.exec(s))) { var ta = cs + m.index; if (ta < pos) continue; if (ta >= lim) break; onTrailer(ta); }
      pos += CH;
    }
  };
  Doc.prototype._findHeader = function (num) { /* offset of the newest "num G obj" in the file, or -1 */
    if (!this._hdr) { var m = new Map(); this._scanObjects(function (n, g, abs) { m.set(n, abs); }, function () { /* not needed */ }); this._hdr = m; }
    var a = this._hdr.get(num); return a === undefined ? -1 : a;
  };

  /* Recover when the xref is missing or wrong: scan the file for "N G obj" and trailers. */
  Doc.prototype.rebuild = function () {
    var self = this, src = this.src, tr = new Dict(), cand = [], cats = [], trailers = [];
    this.xref = new Map(); this.maxNum = 0; this.objs = new Map(); this.cache = new Map(); this._os = new Map(); this._osBytes = 0; this._hdr = null;
    this._scanObjects(function (num, gen, abs, s, after) {
      self.xref.set(num, { t: 1, off: abs, gen: gen }); if (num > self.maxNum) self.maxNum = num;
      var sn = s.substr(after, 1200);
      if (/\/(?:XRef|ObjStm)\b/.test(sn)) cand.push([num, gen]); else if (/\/Catalog\b/.test(sn)) cats.push(num);
    }, function (at) { trailers.push(at); });
    trailers.forEach(function (at) { try { var d = new Parser(src.read(at + 7, 65536), 0).obj(); if (d instanceof Dict) d.keys().forEach(function (k) { tr.set(k, d.get(k)); }); } catch (e) { /* ignore */ } });
    cand.forEach(function (f) { /* xref streams carry the trailer keys; object streams hold compressed objects */
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
    if (!tr.has("Root")) { /* find the catalog by type: plain objects first, then everything (objects inside object streams) */
      cats.forEach(function (n) { var oo; try { oo = self.get(new Ref(n, 0)); } catch (e) { return; } var d2 = dictOf(oo); if (d2 && isName(d2.get("Type"), "Catalog")) tr.set("Root", new Ref(n, 0)); });
      if (!tr.has("Root")) for (var num2 of this.xref.keys()) { var oo2; try { oo2 = this.get(new Ref(num2, 0)); } catch (e) { continue; } var d3 = dictOf(oo2); if (d3 && isName(d3.get("Type"), "Catalog")) tr.set("Root", new Ref(num2, 0)); }
    }
    this.trailer = tr;
  };

  Doc.prototype.parseIndirectAt = function (off) {
    var src = this.src, size = src.size, win = src.u8 ? size - off : 4096;
    for (;;) {
      var n = Math.min(win, size - off); if (n <= 0) return null;
      var more = off + n < size, b = src.read(off, n), p = new Parser(b, 0, this);
      p.ws(); var num = p.readInt(); p.ws(); var gen = p.readInt(); p.ws();
      if (num === null || gen === null || b[p.p] !== 111 || b[p.p + 1] !== 98 || b[p.p + 2] !== 106) { if (more && p.p > b.length - 24) { win *= 4; continue; } return null; }
      p.p += 3; var v;
      try { v = p.obj(); } catch (e) { if (more) { win *= 4; continue; } throw e; }
      p.ws();
      if (more && p.p > b.length - 48) { win *= 4; continue; } /* the object may have been cut off by the end of the window */
      if (v instanceof Dict && b[p.p] === 115 && b[p.p + 1] === 116 && b[p.p + 2] === 114) { /* "stream" */
        p.p += 6; if (b[p.p] === 13) p.p++; if (b[p.p] === 10) p.p++;
        var start = off + p.p, len = v.get("Length"), end = -1;
        if (len instanceof Ref) { try { len = this.get(len); } catch (e) { len = null; } }
        if (typeof len === "number" && len >= 0 && start + len <= size) {
          var tl = src.read(start + len, 24), q = 0; while (q < tl.length && WS[tl[q]]) q++;
          if (tl[q] === 101 && indexOfBytes(tl, ENDSTREAM, q, q + 9) === q) end = start + len;
        }
        if (end < 0) { end = findBytes(src, ENDSTREAM, start); if (end < 0) end = size; if (end > start && src.read(end - 1, 1)[0] === 10) end--; if (end > start && src.read(end - 1, 1)[0] === 13) end--; }
        var st = new Stream(v, null); st._src = src; st._off = start; st._len = end - start; v = st;
      }
      return { num: num, gen: gen, v: v };
    }
  };

  Doc.prototype.getRaw = function (ref) {
    var num = ref.num;
    if (this.objs.has(num)) return this.objs.get(num);
    if (this.cache.has(num)) return this.cache.get(num);
    var e = this.xref && this.xref.get(num); if (!e || e.t === 0) return null;
    var v = null;
    if (e.t === 1) {
      var r = this.parseIndirectAt(e.off);
      if (!r || r.num !== num) { var at = this._findHeader(num); r = at >= 0 ? this.parseIndirectAt(at) : null; } /* the offset is wrong: look the header up */
      v = r ? r.v : null; if (v && this.crypt && num !== this.encNum) v = this.crypt.obj(v, num, r.gen);
    } else if (e.t === 2) {
      var stm = this.getRaw(new Ref(e.stm, 0)); if (!(stm instanceof Stream)) return null;
      var os = this._os.get(e.stm);
      if (!os) {
        var data = this.decodeStream(stm), n = stm.dict.get("N"), first = stm.dict.get("First"), pp = new Parser(data, 0), nums = [], offs = [];
        for (var k = 0; k < n; k++) { pp.ws(); nums.push(pp.readInt()); pp.ws(); offs.push(pp.readInt()); }
        os = { data: data, nums: nums, offs: offs, first: first }; this._os.set(e.stm, os); this._osBytes += data.length;
        while (this._osBytes > 100663296 && this._os.size > 1) { var ok0 = this._os.keys().next().value; this._osBytes -= this._os.get(ok0).data.length; this._os.delete(ok0); }
      } else { this._os.delete(e.stm); this._os.set(e.stm, os); }
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
  /* native zlib inflate (DecompressionStream); resolves null when it cannot be used or the data is damaged, so callers fall back to the tolerant inflater */
  function inflateNative(bytes) {
    if (typeof root.DecompressionStream !== "function") return Promise.resolve(null);
    return new Promise(function (resolve) {
      try {
        var ds = new root.DecompressionStream("deflate"), w = ds.writable.getWriter(), rd = ds.readable.getReader(), chunks = [], total = 0;
        w.write(bytes).then(function () { return w.close(); }, function () { /* reported by the reader */ }).catch(function () { /* reported by the reader */ });
        (function pump() {
          rd.read().then(function (r) {
            if (r.done) { var out = new Uint8Array(total), p = 0; for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], p); p += chunks[i].length; } resolve(out); return; }
            chunks.push(r.value); total += r.value.length; if (total > 1.2e9) { rd.cancel().catch(function () { /* ignore */ }); resolve(null); return; } pump();
          }, function () { resolve(null); });
        })();
      } catch (e) { resolve(null); }
    });
  }
  /* Same result as decodeStream, but a big plain Flate stream is inflated natively (several times faster than the JavaScript inflater). */
  Doc.prototype.decodeStreamAsync = function (st) {
    var self = this, f = this.get(st.dict.get("Filter") || st.dict.get("F")), fl = f == null ? [] : Array.isArray(f) ? f.map(this.get, this) : [f], nm = fl.length === 1 && fl[0] && fl[0].n;
    if ((nm !== "FlateDecode" && nm !== "Fl") || st.rawLength() < 32768 || typeof root.DecompressionStream !== "function") return Promise.resolve().then(function () { return self.decodeStream(st); });
    var pr = this.get(st.dict.get("DecodeParms") || st.dict.get("DP")), parms = Array.isArray(pr) ? this.get(pr[0]) : pr;
    return inflateNative(st.raw).then(function (out) { return out ? unpredict(out, parms instanceof Dict ? resolveDict(self, parms) : null) : self.decodeStream(st); });
  };
  function resolveDict(doc, d) { var r = new Dict(); d.keys().forEach(function (k) { r.set(k, doc.get(d.get(k))); }); return r; }

  /* ---------- pages ---------- */
  var INHERIT = ["Resources", "MediaBox", "CropBox", "Rotate"];
  Doc.prototype.loadPages = function () {
    if (this._pages) return this._pages;
    var out = [], seen = new Set(), rootD = dictOf(this.root()), stack = [[rootD ? rootD.get("Pages") : null, {}]]; /* iterative: very deep or very wide trees cannot overflow the stack */
    while (stack.length) {
      var it = stack.pop(), nodeRef = it[0], inh = it[1], d = dictOf(this.get(nodeRef)); if (!d) continue;
      if (nodeRef instanceof Ref) { if (seen.has(nodeRef.num)) continue; seen.add(nodeRef.num); }
      var kids = this.get(d.get("Kids")), type = this.get(d.get("Type"));
      if (Array.isArray(kids) && !(isName(type, "Page"))) {
        var ni = Object.assign({}, inh); INHERIT.forEach(function (k) { if (d.has(k)) ni[k] = d.get(k); });
        for (var i = kids.length - 1; i >= 0; i--) stack.push([kids[i], ni]);
      } else out.push(new Page(this, nodeRef instanceof Ref ? nodeRef : this.add(d), inh));
    }
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
  Doc.prototype.copyPages = function (src, indices, opt) {
    var self = this, memo = new Map(), todo = [], pages = src.loadPages(), out = [], idx = indices || src.getPageIndices(), onp = opt && opt.progress;
    function mapRef(o) { /* gives the copy a new number and queues the target; the queue is drained in a loop, so long chains of references cannot overflow the stack */
      var hit = memo.get(o.num); if (hit) return hit;
      var target = src.getRaw(o), td = dictOf(target);
      if (td && isName(src.get(td.get("Type")), "Page")) return null; /* links to other pages are dropped */
      var nr = new Ref(self.nextNum++, 0); memo.set(o.num, nr); self.objs.set(nr.num, null); todo.push([target, nr.num]);
      return nr;
    }
    function cp(o, depth) {
      if (o instanceof Ref) return mapRef(o);
      if (Array.isArray(o)) { var a = new Array(o.length); for (var i = 0; i < o.length; i++) a[i] = cp(o[i], depth + 1); return a; }
      if (o instanceof Dict) { var d = new Dict(); o.m.forEach(function (v, k) { if (depth <= 1 && SKIP_KEYS[k]) return; d.set(k, cp(v, depth + 1)); }); return d; }
      if (o instanceof Stream) return o.clone(cp(o.dict, depth + 1)); /* shares the stored bytes, nothing is read or copied here */
      return o;
    }
    idx.forEach(function (i, n) {
      var pg = pages[i]; if (!pg) throw PdfError("range", "page " + (i + 1) + " does not exist");
      var d = pg.dict().m, nd = new Dict();
      d.forEach(function (v, k) { if (!SKIP_KEYS[k]) nd.set(k, cp(v, 1)); });
      INHERIT.forEach(function (k) { if (!nd.has(k) && pg.inh[k] !== undefined) nd.set(k, cp(pg.inh[k], 1)); });
      nd.set("Type", N("Page")); if (!nd.has("Resources")) nd.set("Resources", new Dict());
      while (todo.length) { var t = todo.pop(); self.objs.set(t[1], cp(t[0], 2)); }
      out.push(new Page(self, self.add(nd), {}));
      if (onp) onp(n + 1, idx.length);
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
  ["Title", "Author", "Subject", "Keywords", "Creator", "Producer"].forEach(function (k) { Doc.prototype["get" + k] = function () { var d = dictOf(this.get(this.trailer.get("Info"))), s = d && this.get(d.get(k)); return s instanceof Str ? strText(s) : undefined; }; });
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

  /* Collects the output as a list of parts (small text/byte buffers plus untouched stream data referenced from the source), so a huge
     file never has to exist as one big array. toBlob() hands the parts to the browser; toBytes() joins them. */
  function Writer() { this.parts = []; this.len = 0; this.buf = new Uint8Array(65536); this.bp = 0; }
  Writer.prototype.str = function (s) {
    var n = s.length, b = this.buf, i;
    if (this.bp + n > b.length) { this.flush(); if (n > b.length) { var t = new Uint8Array(n); for (i = 0; i < n; i++) t[i] = s.charCodeAt(i) & 255; this.parts.push(t); this.len += n; return; } }
    var p = this.bp; for (i = 0; i < n; i++) b[p + i] = s.charCodeAt(i) & 255; this.bp = p + n; this.len += n;
  };
  Writer.prototype.flush = function () { if (this.bp) { this.parts.push(this.buf.slice(0, this.bp)); this.bp = 0; } };
  Writer.prototype.data = function (d, n) { this.flush(); this.parts.push(d); this.len += n; };
  Writer.prototype.toBlob = function (type) { this.flush(); return new root.Blob(this.parts, { type: type || "application/pdf" }); };
  Writer.prototype.toBytes = async function () {
    this.flush(); var out = new Uint8Array(this.len), p = 0;
    for (var i = 0; i < this.parts.length; i++) {
      var part = this.parts[i], u = part instanceof Uint8Array ? part : new Uint8Array(await part.arrayBuffer());
      out.set(u, p); p += u.length;
    }
    return out;
  };
  /* every object reachable from the given roots, numbered 1.. in depth-first order (iterative, so very long chains cannot overflow the stack) */
  Doc.prototype._collect = function (roots) {
    var order = [], map = new Map(), stack = [], i;
    for (i = roots.length - 1; i >= 0; i--) stack.push(roots[i]);
    while (stack.length) {
      var o = stack.pop();
      if (o instanceof Ref) {
        if (map.has(o.num)) continue; var t = this.getRaw(o); if (t === null || t === undefined) continue;
        map.set(o.num, order.length + 1); order.push([o.num, t]); stack.push(t);
      } else if (Array.isArray(o)) { for (i = o.length - 1; i >= 0; i--) stack.push(o[i]); }
      else if (o instanceof Dict) { var vals = Array.from(o.m.values()); for (i = vals.length - 1; i >= 0; i--) stack.push(vals[i]); }
      else if (o instanceof Stream) stack.push(o.dict);
    }
    return { order: order, map: map };
  };
  /* opt: progress(done,total) and isCancelled() callbacks; asBlob keeps big generated streams out of the JavaScript heap */
  Doc.prototype._write = async function (opt) {
    opt = opt || {}; var self = this;
    if (this._pages) { this.ensureTree(); this.syncTree(); }
    if (this._producer) { var inf = this.info(); if (!inf.has("Producer")) inf.set("Producer", textString("DTAhub")); if (!inf.has("CreationDate")) inf.set("CreationDate", new Str(te(pdfDate(new Date())), false)); this._producer = false; }
    var col = this._collect([this.trailer.get("Root"), this.trailer.get("Info")]), order = col.order, map = col.map;
    function remap(o) {
      if (o instanceof Ref) return map.has(o.num) ? new Ref(map.get(o.num), 0) : null;
      if (Array.isArray(o)) return o.map(remap);
      if (o instanceof Dict) { var d = new Dict(); o.m.forEach(function (v, k) { d.set(k, remap(v)); }); return d; }
      return o;
    }
    var W = new Writer(), offs = new Array(order.length + 1), total = order.length;
    W.str("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n");
    for (var i = 0; i < total; i++) {
      var o = order[i][1]; offs[i + 1] = W.len;
      if (o instanceof Stream) {
        var d = remap(o.dict), data, len, ref; d.del("DL");
        if (o.compress && !d.has("Filter")) { var z = await zlibDeflate(o.raw); d.set("Filter", N("FlateDecode")); data = z; len = z.length; }
        else if ((ref = o.rawRef())) { data = ref; len = o.rawLength(); }
        else { data = o.raw; len = data.length; }
        if (opt.asBlob && len >= 1048576 && root.Blob && data instanceof Uint8Array) data = new root.Blob([data]);
        d.set("Length", len);
        var ps = []; serialize(d, ps);
        W.str((i + 1) + " 0 obj\n" + ps.join("") + "\nstream\n"); W.data(data, len); W.str("\nendstream\nendobj\n");
      } else { var ps2 = []; serialize(remap(o), ps2); W.str((i + 1) + " 0 obj\n" + ps2.join("") + "\nendobj\n"); }
      if ((i & 127) === 0) { if (opt.isCancelled && opt.isCancelled()) throw PdfError("cancelled", "cancelled"); if (opt.progress) opt.progress(i, total); }
    }
    var xr = W.len, n = total + 1, line = [];
    W.str("xref\n0 " + n + "\n0000000000 65535 f \n");
    for (var k = 1; k < n; k++) { line.push(String(offs[k]).padStart(10, "0") + " 00000 n \n"); if (line.length >= 2048) { W.str(line.join("")); line = []; } }
    if (line.length) W.str(line.join(""));
    var tr = new Dict(); tr.set("Size", n); tr.set("Root", remap(self.trailer.get("Root")));
    if (self.trailer.has("Info") && remap(self.trailer.get("Info"))) tr.set("Info", remap(self.trailer.get("Info")));
    var id = new Uint8Array(16); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(id) : id.forEach(function (_, k2) { id[k2] = Math.floor(Math.random() * 256); });
    tr.set("ID", [new Str(id, true), new Str(id, true)]);
    var tp = []; serialize(tr, tp); W.str("trailer\n" + tp.join("") + "\nstartxref\n" + xr + "\n%%EOF\n");
    if (opt.progress) opt.progress(total, total);
    return W;
  };
  Doc.prototype.save = function (opt) { return this._write(opt).then(function (W) { return W.toBytes(); }); };
  Doc.prototype.saveBlob = function (opt) { opt = Object.assign({ asBlob: true }, opt || {}); return this._write(opt).then(function (W) { return W.toBlob("application/pdf"); }); };
  function pdfDate(d) { var p = function (n) { return String(n).padStart(2, "0"); }; return "D:" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z"; }

  /* ================= drawing: fonts, images, text, opacity, clip ================= */
  var AFM = {"H":[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,761,222,556,333,1000,556,556,333,1000,667,333,1000,761,611,761,761,222,222,333,333,350,556,1000,333,1000,500,333,944,761,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],"HB":[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,761,278,556,500,1000,556,556,333,1000,667,333,1000,761,611,761,761,278,278,500,500,350,556,1000,333,1000,556,333,944,761,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],"T":[250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,761,500,761,333,500,444,1000,500,500,333,1000,556,333,889,761,611,761,761,333,333,444,444,350,500,1000,333,980,389,333,722,761,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500],"TB":[250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,761,500,761,333,500,500,1000,500,500,333,1000,556,333,1000,761,667,761,761,333,333,500,500,350,500,1000,333,1000,389,333,722,761,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500],"TI":[250,333,420,500,500,833,778,214,333,333,500,675,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,675,675,675,500,920,611,611,667,722,611,611,722,722,333,444,667,556,833,667,722,611,722,611,500,556,722,611,833,611,556,556,389,278,389,422,500,333,500,500,444,500,444,278,500,500,278,278,444,278,722,500,500,500,500,389,389,278,500,444,667,444,444,389,400,275,400,541,761,500,761,333,500,556,889,500,500,333,1000,500,333,944,761,556,761,761,333,333,556,556,350,500,889,333,980,389,333,667,761,389,556,250,389,500,500,500,500,275,500,333,760,276,500,675,333,760,333,400,675,300,300,333,500,523,250,333,300,310,500,750,750,750,500,611,611,611,611,611,611,889,667,611,611,611,611,333,333,333,333,722,667,722,722,722,722,722,675,722,722,722,722,722,556,611,500,500,500,500,500,500,500,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,675,500,500,500,500,500,444,500,444],"TBI":[250,389,555,500,500,833,778,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,832,667,667,667,722,667,667,722,778,389,500,667,611,889,722,722,611,722,667,556,611,722,667,889,667,611,611,333,278,333,570,500,333,500,500,444,500,444,333,500,556,278,278,500,278,778,556,500,500,500,389,389,278,556,444,667,500,444,389,348,220,348,570,761,500,761,333,500,500,1000,500,500,333,1000,556,333,944,761,611,761,761,333,333,500,500,350,500,1000,333,1000,389,333,722,761,389,611,250,389,500,500,500,500,220,500,333,747,266,500,606,333,747,333,400,570,300,300,333,576,500,250,333,300,300,500,750,750,750,500,667,667,667,667,667,667,944,667,667,667,667,667,389,389,389,389,722,722,722,722,722,722,722,570,722,722,722,722,722,611,611,500,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,444,500,444]};
  var CP1252 = { 8364: 128, 8218: 130, 402: 131, 8222: 132, 8230: 133, 8224: 134, 8225: 135, 710: 136, 8240: 137, 352: 138, 8249: 139, 338: 140, 381: 142, 8216: 145, 8217: 146, 8220: 147, 8221: 148, 8226: 149, 8211: 150, 8212: 151, 732: 152, 8482: 153, 353: 154, 8250: 155, 339: 156, 382: 158, 376: 159 };
  function winAnsi(s) {
    var o = []; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c < 256 && (c >= 32 || c === 9)) o.push(c < 32 ? 32 : c); else if (CP1252[c]) o.push(CP1252[c]); else o.push(63); } return o;
  }
  var FONTS = { Helvetica: ["Helvetica", "H"], "Helvetica-Bold": ["Helvetica-Bold", "HB"], "Helvetica-Oblique": ["Helvetica-Oblique", "H"], "Helvetica-BoldOblique": ["Helvetica-BoldOblique", "HB"],
    "Times-Roman": ["Times-Roman", "T"], "Times-Bold": ["Times-Bold", "TB"], "Times-Italic": ["Times-Italic", "TI"], "Times-BoldItalic": ["Times-BoldItalic", "TBI"],
    Courier: ["Courier", null], "Courier-Bold": ["Courier-Bold", null], "Courier-Oblique": ["Courier-Oblique", null], "Courier-BoldOblique": ["Courier-BoldOblique", null] };
  Doc.prototype.embedFont = function (name) {
    var f = FONTS[name || "Helvetica"]; if (!f) throw PdfError("font", "unknown standard font " + name);
    this._fonts = this._fonts || {};
    if (!this._fonts[name]) {
      var tbl = f[1] ? AFM[f[1]] : null, ref = this.add(mkDict({ Type: N("Font"), Subtype: N("Type1"), BaseFont: N(f[0]), Encoding: N("WinAnsiEncoding") }));
      this._fonts[name] = {
        ref: ref, name: f[0],
        widthOfTextAtSize: function (t, size) { var w = 0, b = winAnsi(String(t)); for (var i = 0; i < b.length; i++) w += tbl ? (tbl[b[i] - 32] || 0) : 600; return w * size / 1000; },
        heightAtSize: function (size) { return size * 0.75; }
      };
    }
    return this._fonts[name];
  };
  function jpegInfo(b) {
    if (b[0] !== 0xff || b[1] !== 0xd8) throw PdfError("image", "not a JPEG file");
    var p = 2, adobe = false, info = null;
    while (p + 4 <= b.length) {
      if (b[p] !== 0xff) { p++; continue; } var m = b[p + 1]; if (m === 0xff) { p++; continue; }
      if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { p += 2; continue; }
      var L = (b[p + 2] << 8) | b[p + 3];
      if (m === 0xee && L >= 12 && b[p + 4] === 0x41 && b[p + 5] === 0x64) adobe = true;
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { info = { bpc: b[p + 4], h: (b[p + 5] << 8) | b[p + 6], w: (b[p + 7] << 8) | b[p + 8], n: b[p + 9] }; break; }
      p += 2 + L;
    }
    if (!info) throw PdfError("image", "damaged JPEG file"); info.adobe = adobe; return info;
  }
  Doc.prototype.embedJpg = function (bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var i = jpegInfo(bytes), d = mkDict({ Type: N("XObject"), Subtype: N("Image"), Width: i.w, Height: i.h, BitsPerComponent: i.bpc, ColorSpace: N(i.n === 1 ? "DeviceGray" : i.n === 4 ? "DeviceCMYK" : "DeviceRGB"), Filter: N("DCTDecode") });
    if (i.n === 4 && i.adobe) d.set("Decode", [1, 0, 1, 0, 1, 0, 1, 0]);
    var st = new Stream(d, bytes); return Promise.resolve({ ref: this.add(st), width: i.w, height: i.h, scale: function (k) { return { width: i.w * k, height: i.h * k }; } });
  };
  Doc.prototype.embedPng = function (bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var sig = [137, 80, 78, 71, 13, 10, 26, 10]; for (var s = 0; s < 8; s++) if (bytes[s] !== sig[s]) throw PdfError("image", "not a PNG file");
    var p = 8, ih = null, plte = null, trns = null, idat = [], tot = 0;
    while (p + 8 <= bytes.length) {
      var len = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0, ty = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]), dt = bytes.subarray(p + 8, p + 8 + len);
      if (ty === "IHDR") ih = { w: ((dt[0] << 24) | (dt[1] << 16) | (dt[2] << 8) | dt[3]) >>> 0, h: ((dt[4] << 24) | (dt[5] << 16) | (dt[6] << 8) | dt[7]) >>> 0, bd: dt[8], ct: dt[9], il: dt[12] };
      else if (ty === "PLTE") plte = dt; else if (ty === "tRNS") trns = dt; else if (ty === "IDAT") { idat.push(dt); tot += dt.length; } else if (ty === "IEND") break;
      p += 12 + len;
    }
    if (!ih || !idat.length) throw PdfError("image", "damaged PNG file");
    if (ih.il) throw PdfError("unsupported", "interlaced PNG");
    var data = new Uint8Array(tot), q = 0; idat.forEach(function (c) { data.set(c, q); q += c.length; });
    var ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ih.ct]; if (!ch) throw PdfError("image", "unknown PNG type");
    var self = this, w = ih.w, h = ih.h, d = mkDict({ Type: N("XObject"), Subtype: N("Image"), Width: w, Height: h });
    var cs = ih.ct === 0 || ih.ct === 4 ? N("DeviceGray") : ih.ct === 3 ? [N("Indexed"), N("DeviceRGB"), plte.length / 3 - 1, new Str(plte.slice(), true)] : N("DeviceRGB");
    var res = { ref: null, width: w, height: h };
    if ((ih.ct === 0 || ih.ct === 2 || ih.ct === 3) && !trns && ih.bd <= 8) { /* pass the compressed data straight through */
      d.set("ColorSpace", cs); d.set("BitsPerComponent", ih.bd); d.set("Filter", N("FlateDecode"));
      d.set("DecodeParms", mkDict({ Predictor: 15, Colors: ch, BitsPerComponent: ih.bd, Columns: w }));
      res.ref = this.add(new Stream(d, data)); return Promise.resolve(res);
    }
    var raw = unpredict(zlibInflate(data), mkDict({ Predictor: 15, Colors: ch, BitsPerComponent: ih.bd, Columns: w })), bps = ih.bd === 16 ? 2 : 1;
    if (ih.bd < 8 && (ih.ct === 3 || ih.ct === 0)) throw PdfError("unsupported", "low bit depth PNG with transparency");
    var cc = ih.ct === 4 ? 1 : ih.ct === 6 ? 3 : ch, color = new Uint8Array(w * h * cc), alpha = null, n = w * h, i, k;
    if (ih.ct === 4 || ih.ct === 6) {
      alpha = new Uint8Array(n); var stride = ch * bps;
      for (i = 0; i < n; i++) { for (k = 0; k < cc; k++) color[i * cc + k] = raw[i * stride + k * bps]; alpha[i] = raw[i * stride + cc * bps]; }
    } else if (ih.ct === 3) { color = raw; alpha = new Uint8Array(n); for (i = 0; i < n; i++) alpha[i] = trns && raw[i] < trns.length ? trns[raw[i]] : 255; }
    else { for (i = 0; i < n * cc; i++) color[i] = raw[i * bps]; if (trns && trns.length >= 2) { /* colour-key transparency */ alpha = new Uint8Array(n).fill(255); var key = []; for (k = 0; k < cc; k++) key.push(bps === 2 ? ((trns[k * 2] << 8) | trns[k * 2 + 1]) >> 8 : trns[k * 2 + 1]); for (i = 0; i < n; i++) { var all = true; for (k = 0; k < cc; k++) if (color[i * cc + k] !== key[k]) { all = false; break; } if (all) alpha[i] = 0; } } }
    d.set("ColorSpace", ih.ct === 3 ? cs : cc === 1 ? N("DeviceGray") : N("DeviceRGB")); d.set("BitsPerComponent", 8);
    var st = new Stream(d, color); st.compress = true;
    if (alpha) { var ad = mkDict({ Type: N("XObject"), Subtype: N("Image"), Width: w, Height: h, ColorSpace: N("DeviceGray"), BitsPerComponent: 8 }), as = new Stream(ad, alpha); as.compress = true; d.set("SMask", this.add(as)); }
    res.ref = this.add(st); return Promise.resolve(res);
  };
  function rgb(r, g, b) { return { r: r, g: g, b: b }; }
  function degrees(a) { return { type: "degrees", angle: a }; }
  function f(n) { return fmtNum(Math.round(n * 10000) / 10000); }
  Page.prototype._res = function (kind) {
    var d = this.dict();
    if (!this._ownRes) {
      var old = this.doc.get(d.has("Resources") ? d.get("Resources") : this.inh.Resources), nr = new Dict();
      if (old instanceof Dict) old.m.forEach(function (v, k) { nr.set(k, v); });
      d.set("Resources", nr); this._ownRes = nr;
    }
    var sub = this.doc.get(this._ownRes.get(kind)), nd = new Dict();
    if (!(this._ownSub && this._ownSub[kind])) { if (sub instanceof Dict) sub.m.forEach(function (v, k) { nd.set(k, v); }); this._ownRes.set(kind, nd); (this._ownSub = this._ownSub || {})[kind] = nd; }
    return this._ownSub[kind];
  };
  Page.prototype._name = function (kind, prefix, ref) {
    var sub = this._res(kind); this._names = this._names || {}; var key = kind + ref.num;
    if (!this._names[key]) { var i = 1; while (sub.has(prefix + i)) i++; this._names[key] = prefix + i; sub.set(prefix + i, ref); }
    return this._names[key];
  };
  Page.prototype._gs = function (op) {
    if (op === undefined || op >= 1) return "";
    var o = Math.max(0, op), g = this.doc.add(mkDict({ Type: N("ExtGState"), ca: o, CA: o })); return "/" + this._name("ExtGState", "DTAG", g) + " gs ";
  };
  Page.prototype._push = function (s) { (this._ops = this._ops || []).push(s); };
  Page.prototype._flush = function () {
    if (!this._ops || !this._ops.length) return;
    var d = this.dict(), c = this.doc.get(d.get("Contents")), parts = [];
    if (c instanceof Stream) parts = [d.get("Contents")]; else if (Array.isArray(c)) parts = c.slice();
    var mk = function (s) { return this.doc.add(new Stream(new Dict(), te(s))); }.bind(this), body = mk(this._ops.join("\n"));
    if (parts.length) { var st = mk("q"), en = mk("Q"); parts = [st].concat(parts, [en, body]); } else parts = [body];
    d.set("Contents", parts); this._ops = [];
  };
  Page.prototype.drawText = function (text, o) {
    o = o || {}; var font = o.font || this.doc.embedFont("Helvetica"), size = o.size || 12, c = o.color || rgb(0, 0, 0), a = ((o.rotate && o.rotate.angle) || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    var fn = this._name("Font", "DTAF", font.ref), bytes = winAnsi(String(text)), hex = ""; for (var i = 0; i < bytes.length; i++) hex += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
    this._push("q " + this._gs(o.opacity) + f(c.r) + " " + f(c.g) + " " + f(c.b) + " rg BT /" + fn + " " + f(size) + " Tf " + f(cs) + " " + f(sn) + " " + f(-sn) + " " + f(cs) + " " + f(o.x || 0) + " " + f(o.y || 0) + " Tm <" + hex + "> Tj ET Q");
  };
  Page.prototype.drawImage = function (img, o) {
    o = o || {}; var w = o.width === undefined ? img.width : o.width, h = o.height === undefined ? img.height : o.height, a = ((o.rotate && o.rotate.angle) || 0) * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    var nm = this._name("XObject", "DTAI", img.ref), clip = o.clip ? f(o.clip[0]) + " " + f(o.clip[1]) + " " + f(o.clip[2]) + " " + f(o.clip[3]) + " re W n " : "";
    this._push("q " + this._gs(o.opacity) + clip + f(w * cs) + " " + f(w * sn) + " " + f(-h * sn) + " " + f(h * cs) + " " + f(o.x || 0) + " " + f(o.y || 0) + " cm /" + nm + " Do Q");
  };
  Page.prototype.drawRect = function (o) {
    var c = o.color, b = o.borderColor, ops = "q " + this._gs(o.opacity);
    if (c) ops += f(c.r) + " " + f(c.g) + " " + f(c.b) + " rg "; if (b) ops += f(b.r) + " " + f(b.g) + " " + f(b.b) + " RG " + f(o.borderWidth || 1) + " w ";
    ops += f(o.x) + " " + f(o.y) + " " + f(o.width) + " " + f(o.height) + " re " + (c && b ? "B" : c ? "f" : "S") + " Q"; this._push(ops);
  };
  Page.prototype.drawLine = function (o) {
    var c = o.color || rgb(0, 0, 0); this._push("q " + this._gs(o.opacity) + f(c.r) + " " + f(c.g) + " " + f(c.b) + " RG " + f(o.thickness || 1) + " w " + (o.cap === "round" ? "1 J " : "") + f(o.start.x) + " " + f(o.start.y) + " m " + f(o.end.x) + " " + f(o.end.y) + " l S Q");
  };
  Page.prototype.drawOps = function (s) { this._push(s); };
  var _syncTree = Doc.prototype.syncTree;
  Doc.prototype.syncTree = function () { this._pages.forEach(function (p) { p._flush(); }); _syncTree.call(this); };

  /* ================= phase 3: data URLs, paths, blend modes, AcroForm fill + flatten ================= */
  function dataUrlBytes(s) {
    var m = /^data:[^,]*?(;base64)?,(.*)$/s.exec(s); if (!m) throw PdfError("image", "bad data URL");
    if (m[1]) { var bin = (root.atob || function (x) { return Buffer.from(x, "base64").toString("binary"); })(m[2]), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
    return te(decodeURIComponent(m[2]));
  }
  ["embedJpg", "embedPng"].forEach(function (k) { var orig = Doc.prototype[k]; Doc.prototype[k] = function (b) { return orig.call(this, typeof b === "string" ? dataUrlBytes(b) : b); }; });
  var StandardFonts = { Helvetica: "Helvetica", HelveticaBold: "Helvetica-Bold", HelveticaOblique: "Helvetica-Oblique", HelveticaBoldOblique: "Helvetica-BoldOblique",
    TimesRoman: "Times-Roman", TimesRomanBold: "Times-Bold", TimesRomanItalic: "Times-Italic", TimesRomanBoldItalic: "Times-BoldItalic",
    Courier: "Courier", CourierBold: "Courier-Bold", CourierOblique: "Courier-Oblique", CourierBoldOblique: "Courier-BoldOblique" };
  function canEncode(s) { s = String(s); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (!((c >= 32 && c < 256 && !(c >= 127 && c < 160)) || CP1252[c] || c === 9)) return false; } return true; }
  var _embedFont = Doc.prototype.embedFont;
  Doc.prototype.embedFont = function (n) { var f = _embedFont.call(this, StandardFonts[n] || n); f.canEncode = canEncode; return f; };

  Page.prototype.getCropRect = function () {
    var cb = this.attr("CropBox"), v = Array.isArray(cb) ? cb.map(function (x) { return this.doc.get(x); }, this) : null;
    if (!v || v.length < 4 || v.some(function (x) { return typeof x !== "number"; })) v = this.getMediaBox();
    var x0 = Math.min(v[0], v[2]), y0 = Math.min(v[1], v[3]); return { x: x0, y: y0, width: Math.abs(v[2] - v[0]), height: Math.abs(v[3] - v[1]) };
  };
  Page.prototype.getMediaRect = function () { var m = this.getMediaBox(); return { x: m[0], y: m[1], width: m[2] - m[0], height: m[3] - m[1] }; };
  var _gs0 = Page.prototype._gs;
  Page.prototype._gs = function (op, blend) {
    if (!blend) return _gs0.call(this, op);
    var o = op === undefined ? 1 : Math.max(0, Math.min(1, op)), g = this.doc.add(mkDict({ Type: N("ExtGState"), ca: o, CA: o, BM: N(blend) })); return "/" + this._name("ExtGState", "DTAG", g) + " gs ";
  };
  /* points are in PDF user space. opts: color (fill), borderColor, borderWidth, close, opacity, blendMode ("Multiply"), round (round caps and joins) */
  Page.prototype.drawPolygon = function (pts, o) {
    o = o || {}; if (!pts.length) return; var c = o.color, b = o.borderColor, s = "q " + this._gs(o.opacity, o.blendMode);
    if (c) s += f(c.r) + " " + f(c.g) + " " + f(c.b) + " rg "; if (b) s += f(b.r) + " " + f(b.g) + " " + f(b.b) + " RG " + f(o.borderWidth || 1) + " w ";
    if (o.round) s += "1 J 1 j ";
    pts.forEach(function (p, i) { s += f(p[0]) + " " + f(p[1]) + (i ? " l " : " m "); });
    var close = o.close !== false && pts.length > 2;
    if (close) s += "h "; s += (c && b && close ? "B" : c && close ? "f" : "S") + " Q"; this._push(s);
  };

  /* ---------- AcroForm ---------- */
  function Field(doc, ref, d, name, type, ff, widgets) { this.doc = doc; this.ref = ref; this.d = d; this.name = name; this.ft = type; this.ff = ff; this.widgetRefs = widgets; }
  Field.prototype.attr = function (k) { var d = this.d, n = 0; while (d && n++ < 32) { if (d.has(k)) return this.doc.get(d.get(k)); d = dictOf(this.doc.get(d.get("Parent"))); } return undefined; };
  Field.prototype.getName = function () { return this.name; };
  Field.prototype.kind = function () {
    if (this.ft === "Tx") return "text";
    if (this.ft === "Sig") return "signature";
    if (this.ft === "Btn") return this.ff & 65536 ? "button" : this.ff & 32768 ? "radio" : "checkbox";
    if (this.ft === "Ch") return this.ff & 131072 ? "dropdown" : "list";
    return "unknown";
  };
  Field.prototype.widgets = function () { return this.widgetRefs.map(function (r) { return { ref: r, d: dictOf(this.doc.get(r)) }; }, this).filter(function (w) { return w.d; }); };
  Field.prototype.options = function () {
    var o = this.attr("Opt"), doc = this.doc; if (!Array.isArray(o)) return [];
    return o.map(function (x) { x = doc.get(x); if (Array.isArray(x)) return { value: strText(doc.get(x[0])), label: strText(doc.get(x[1])) }; var t = x instanceof Str ? strText(x) : ""; return { value: t, label: t }; });
  };
  function onState(doc, w) {
    var ap = dictOf(doc.get(w.d.get("AP"))), n = ap && doc.get(ap.get("N")); if (n instanceof Dict) { var ks = n.keys().filter(function (k) { return k !== "Off"; }); if (ks.length) return ks[0]; }
    return null;
  }
  function parseDA(doc, field) {
    var da = field.attr("DA"); if (!(da instanceof Str)) { var af = dictOf(doc.get(dictOf(doc.get(doc.root())).get("AcroForm"))); da = af && doc.get(af.get("DA")); }
    var s = da instanceof Str ? strText(da) : "", t = s.split(/\s+/), r = { font: "Helv", size: 0, color: rgb(0, 0, 0) };
    for (var i = 0; i < t.length; i++) {
      if (t[i] === "Tf" && i >= 2) { r.font = t[i - 2].replace(/^\//, ""); r.size = parseFloat(t[i - 1]) || 0; }
      else if (t[i] === "g" && i >= 1) { var g = parseFloat(t[i - 1]) || 0; r.color = rgb(g, g, g); }
      else if (t[i] === "rg" && i >= 3) r.color = rgb(+t[i - 3], +t[i - 2], +t[i - 1]);
      else if (t[i] === "k" && i >= 4) { var c = +t[i - 4], m = +t[i - 3], y = +t[i - 2], k = +t[i - 1]; r.color = rgb((1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)); }
    }
    return r;
  }
  function baseFontOf(doc, field, fname) {
    var af = dictOf(doc.get(dictOf(doc.get(doc.root())).get("AcroForm"))), dr = dictOf(doc.get(field.attr("DR"))) || (af && dictOf(doc.get(af.get("DR")))), fd = dr && dictOf(doc.get(dr.get("Font"))), fo = fd && dictOf(doc.get(fd.get(fname))), bf = fo && doc.get(fo.get("BaseFont")), n = bf instanceof Name ? bf.n : "";
    n = n.replace(/^[A-Z]{6}\+/, ""); if (FONTS[n]) return n;
    var low = n.toLowerCase(), bold = /bold/.test(low), it = /italic|oblique/.test(low);
    if (/times|serif/.test(low) && !/sans/.test(low)) return bold && it ? "Times-BoldItalic" : bold ? "Times-Bold" : it ? "Times-Italic" : "Times-Roman";
    if (/courier|mono/.test(low)) return "Courier" + (bold || it ? "-" + (bold ? "Bold" : "") + (it ? "Oblique" : "") : "");
    return bold ? "Helvetica-Bold" : "Helvetica";
  }
  function wrapLines(text, font, size, maxW) {
    var out = []; String(text).split(/\r\n|\r|\n/).forEach(function (para) {
      var words = para.split(" "), cur = "";
      words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (cur && font.widthOfTextAtSize(t, size) > maxW) { out.push(cur); cur = w; } else cur = t; }); out.push(cur);
    }); return out;
  }
  function pdfHex(text) { var b = winAnsi(text), h = ""; for (var i = 0; i < b.length; i++) h += (b[i] < 16 ? "0" : "") + b[i].toString(16); return "<" + h + ">"; }
  function rectOf(doc, d) { var r = doc.get(d.get("Rect")); r = Array.isArray(r) ? r.map(function (x) { return doc.get(x); }) : [0, 0, 0, 0]; return [Math.min(r[0], r[2]), Math.min(r[1], r[3]), Math.max(r[0], r[2]), Math.max(r[1], r[3])]; }
  function mkAP(doc, w, h, rot, content, res) {
    var d = mkDict({ Type: N("XObject"), Subtype: N("Form"), BBox: [0, 0, rot % 180 ? h : w, rot % 180 ? w : h], Resources: res || new Dict() });
    if (rot === 90) d.set("Matrix", [0, 1, -1, 0, w, 0]); else if (rot === 180) d.set("Matrix", [-1, 0, 0, -1, w, h]); else if (rot === 270) d.set("Matrix", [0, -1, 1, 0, 0, h]);
    return new Stream(d, te(content));
  }
  function mkColor(a) { return Array.isArray(a) && a.length === 1 ? f(a[0]) + " " + f(a[0]) + " " + f(a[0]) : Array.isArray(a) && a.length === 3 ? a.map(f).join(" ") : null; }
  function mkBox(doc, w, d, W, H) {
    var mk = dictOf(doc.get(d.get("MK"))), s = "", bg = mk && mkColor(doc.get(mk.get("BG")) && doc.get(mk.get("BG")).map && doc.get(mk.get("BG")).map(function (x) { return doc.get(x); })), bc = mk && mkColor(doc.get(mk.get("BC")) && doc.get(mk.get("BC")).map && doc.get(mk.get("BC")).map(function (x) { return doc.get(x); }));
    var bs = dictOf(doc.get(d.get("BS"))), bw = bs && typeof doc.get(bs.get("W")) === "number" ? doc.get(bs.get("W")) : 1;
    if (bg) s += "q " + bg + " rg 0 0 " + f(W) + " " + f(H) + " re f Q\n";
    if (bc && bw > 0) s += "q " + bc + " RG " + f(bw) + " w " + f(bw / 2) + " " + f(bw / 2) + " " + f(W - bw) + " " + f(H - bw) + " re S Q\n";
    return { s: s, bw: bg || bc ? bw : 0 };
  }
  Field.prototype.refresh = function () {
    var doc = this.doc, kind = this.kind(), v = this.attr("V"), text = "";
    if (kind === "text") text = v instanceof Str ? strText(v) : "";
    else if (kind === "dropdown" || kind === "list") {
      var val = Array.isArray(v) ? v[0] : v; val = val instanceof Str ? strText(doc.get(val)) : ""; var op = this.options().filter(function (o) { return o.value === val; })[0]; text = op ? op.label : val;
    } else return;
    var da = parseDA(doc, this), fname = baseFontOf(doc, this, da.font), font = doc.embedFont(fname), multi = kind === "text" && (this.ff & 4096), comb = kind === "text" && (this.ff & 16777216) && this.attr("MaxLen"), q = this.attr("Q") || 0;
    var self = this;
    this.widgets().forEach(function (w) {
      var r = rectOf(doc, w.d), W = r[2] - r[0], H = r[3] - r[1], mk = dictOf(doc.get(w.d.get("MK"))), rot = mk && typeof doc.get(mk.get("R")) === "number" ? ((doc.get(mk.get("R")) % 360) + 360) % 360 : 0;
      var cw = rot % 180 ? H : W, ch = rot % 180 ? W : H, box = mkBox(doc, w, w.d, cw, ch), bw = box.bw + 1, s = box.s + "/Tx BMC q " + bw + " " + bw + " " + f(cw - 2 * bw) + " " + f(ch - 2 * bw) + " re W n\nBT " + f(da.color.r) + " " + f(da.color.g) + " " + f(da.color.b) + " rg\n";
      var size = da.size, pad = bw + 1;
      if (text) {
        if (multi) {
          size = size || 12; var lines = wrapLines(text, font, size, cw - 2 * pad), lh = size * 1.15, y0 = ch - pad - size * 0.9;
          s += "/Helv " + f(size) + " Tf\n"; var px = 0, py = 0;
          lines.forEach(function (ln, i) { var tw = font.widthOfTextAtSize(ln, size), x = q === 1 ? (cw - tw) / 2 : q === 2 ? cw - pad - tw : pad, y = y0 - i * lh; s += f(x - px) + " " + f(y - py) + " Td " + pdfHex(ln) + " Tj\n"; px = x; py = y; });
        } else if (comb) {
          size = size || Math.min(12, (ch - 2 * bw) * 0.75); var cell = cw / comb, px2 = 0, py2 = 0; s += "/Helv " + f(size) + " Tf\n";
          Array.from(text).slice(0, comb).forEach(function (chr, i) { var x = cell * i + (cell - font.widthOfTextAtSize(chr, size)) / 2, y = ch / 2 - size * 0.35; s += f(x - px2) + " " + f(y - py2) + " Td " + pdfHex(chr) + " Tj\n"; px2 = x; py2 = y; });
        } else {
          size = size || Math.min(12, (ch - 2 * bw) * 0.75); var tw0 = font.widthOfTextAtSize(text, size); if (tw0 > cw - 2 * pad) size = Math.max(4, size * (cw - 2 * pad) / tw0);
          var tw1 = font.widthOfTextAtSize(text, size), x1 = q === 1 ? (cw - tw1) / 2 : q === 2 ? cw - pad - tw1 : pad, y1 = ch / 2 - size * 0.35;
          s += "/Helv " + f(size) + " Tf\n" + f(x1) + " " + f(y1) + " Td " + pdfHex(text) + " Tj\n";
        }
      }
      s += "ET Q EMC";
      var res = mkDict({ Font: mkDict({ Helv: font.ref }) }), st = mkAP(doc, W, H, rot, s, res);
      w.d.set("AP", mkDict({ N: doc.add(st) }));
    });
  };
  Field.prototype.setText = function (t) {
    if (this.kind() !== "text") throw PdfError("form", "not a text field"); t = String(t);
    if (!canEncode(t.replace(/[\r\n]/g, " "))) throw PdfError("encoding", "text has characters this font cannot show");
    var ml = this.attr("MaxLen"); if (typeof ml === "number" && t.length > ml) t = t.slice(0, ml);
    this.d.set("V", textString(t)); this.d.del("RV"); this.refresh();
  };
  Field.prototype.select = function (v) {
    var kind = this.kind(), doc = this.doc;
    if (kind === "radio") {
      var ws = this.widgets(), hit = ws.some(function (w) { return onState(doc, w) === v; });
      if (!hit) throw PdfError("form", "no such radio option " + v);
      this.d.set("V", N(v)); ws.forEach(function (w) { w.d.set("AS", N(onState(doc, w) === v ? v : "Off")); });
    } else if (kind === "dropdown" || kind === "list") {
      v = String(v); if (!canEncode(v)) throw PdfError("encoding", "unsupported characters"); this.d.set("V", textString(v)); this.refresh();
    } else throw PdfError("form", "cannot select on this field");
  };
  Field.prototype.check = function (on) {
    if (this.kind() !== "checkbox") throw PdfError("form", "not a checkbox"); on = on !== false; var doc = this.doc, ws = this.widgets(), st = "Off";
    if (on) { st = null; ws.forEach(function (w) { st = st || onState(doc, w); }); st = st || "Yes"; }
    ws.forEach(function (w) {
      var r = rectOf(doc, w.d), W = r[2] - r[0], H = r[3] - r[1], ap = dictOf(doc.get(w.d.get("AP"))), nn = ap && doc.get(ap.get("N"));
      if (on && !(nn instanceof Dict && nn.has(st))) { /* no appearance supplied: draw a vector check mark */
        var box = mkBox(doc, w, w.d, W, H), mark = box.s + "q 0 g " + f(Math.max(1, Math.min(W, H) * .13)) + " w 1 J 1 j " + f(W * .2) + " " + f(H * .55) + " m " + f(W * .42) + " " + f(H * .25) + " l " + f(W * .8) + " " + f(H * .8) + " l S Q",
          nd = new Dict(); nd.set(st, doc.add(mkAP(doc, W, H, 0, mark))); nd.set("Off", doc.add(mkAP(doc, W, H, 0, box.s))); w.d.set("AP", mkDict({ N: nd }));
      }
      w.d.set("AS", N(on ? st : "Off"));
    });
    this.d.set("V", N(on ? st : "Off"));
  };
  Field.prototype.uncheck = function () { this.check(false); };

  function Form(doc) { this.doc = doc; var rd = dictOf(doc.get(doc.root())); this.af = rd && dictOf(doc.get(rd.get("AcroForm"))); this._f = null; }
  Form.prototype.getFields = function () {
    if (this._f) return this._f; var doc = this.doc, out = [], seen = new Set(); this._f = out; if (!this.af) return out;
    function walk(ref, pname) {
      var d = dictOf(doc.get(ref)); if (!d) return; if (ref instanceof Ref) { if (seen.has(ref.num)) return; seen.add(ref.num); }
      var t = doc.get(d.get("T")), name = t instanceof Str ? (pname ? pname + "." : "") + strText(t) : pname, kids = doc.get(d.get("Kids")), sub = Array.isArray(kids) && kids.some(function (k) { var kd = dictOf(doc.get(k)); return kd && kd.has("T"); });
      if (sub) { kids.forEach(function (k) { walk(k, name); }); return; }
      var fld = new Field(doc, ref, d, name, null, 0, Array.isArray(kids) ? kids : [ref]); var ft = fld.attr("FT"), ff = fld.attr("Ff");
      fld.ft = ft instanceof Name ? ft.n : null; fld.ff = typeof ff === "number" ? ff : 0; if (fld.ft) out.push(fld);
    }
    var fl = doc.get(this.af.get("Fields")); if (Array.isArray(fl)) fl.forEach(function (r) { walk(r, ""); }); return out;
  };
  Form.prototype.getField = function (name) { var r = this.getFields().filter(function (x) { return x.name === name; })[0]; if (!r) throw PdfError("form", "no field named " + name); return r; };
  Form.prototype.updateFieldAppearances = function () {
    var need = this.af && this.doc.get(this.af.get("NeedAppearances")) === true;
    this.getFields().forEach(function (fl) {
      var k = fl.kind(); if (k !== "text" && k !== "dropdown" && k !== "list") return;
      var doc = fl.doc, missing = fl.widgets().some(function (w) { var ap = dictOf(doc.get(w.d.get("AP"))); return !ap || !doc.get(ap.get("N")); });
      if (missing || need) { try { fl.refresh(); } catch (e) { /* leave it */ } }
    });
    if (this.af && need) this.af.set("NeedAppearances", false);
  };
  /* bake every field's appearance into the page and remove the interactive fields */
  Form.prototype.flatten = function () {
    var doc = this.doc, fields = this.getFields(), self = this; if (!this.af) return; this.updateFieldAppearances();
    var wset = new Map(); fields.forEach(function (fl) { fl.widgets().forEach(function (w) { if (w.ref instanceof Ref) wset.set(w.ref.num, w); }); });
    doc.loadPages().forEach(function (pg) {
      var d = pg.dict(), an = doc.get(d.get("Annots")); if (!Array.isArray(an)) return; var keep = [];
      an.forEach(function (a) {
        var w = a instanceof Ref && wset.get(a.num); if (!w) { keep.push(a); return; }
        var fl = typeof doc.get(w.d.get("F")) === "number" ? doc.get(w.d.get("F")) : 0, ap = dictOf(doc.get(w.d.get("AP"))), n = ap && doc.get(ap.get("N")), ref = null;
        if (n instanceof Dict) { var as = doc.get(w.d.get("AS")); if (as instanceof Name && n.has(as.n)) ref = n.get(as.n); } else if (ap) ref = ap.get("N");
        var st = ref && doc.get(ref);
        if (!(fl & 2) && !(fl & 32) && st instanceof Stream) {
          var bb = doc.get(st.dict.get("BBox")), mx = doc.get(st.dict.get("Matrix")); bb = Array.isArray(bb) ? bb.map(function (x) { return doc.get(x); }) : [0, 0, 1, 1]; mx = Array.isArray(mx) ? mx.map(function (x) { return doc.get(x); }) : [1, 0, 0, 1, 0, 0];
          var cs = [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]], [bb[0], bb[3]]].map(function (p) { return [mx[0] * p[0] + mx[2] * p[1] + mx[4], mx[1] * p[0] + mx[3] * p[1] + mx[5]]; }),
            xs = cs.map(function (p) { return p[0]; }), ys = cs.map(function (p) { return p[1]; }), tx0 = Math.min.apply(null, xs), tx1 = Math.max.apply(null, xs), ty0 = Math.min.apply(null, ys), ty1 = Math.max.apply(null, ys), r = rectOf(doc, w.d),
            sx = tx1 - tx0 ? (r[2] - r[0]) / (tx1 - tx0) : 1, sy = ty1 - ty0 ? (r[3] - r[1]) / (ty1 - ty0) : 1, nm = pg._name("XObject", "DTAX", ref);
          pg._push("q " + f(sx) + " 0 0 " + f(sy) + " " + f(r[0] - tx0 * sx) + " " + f(r[1] - ty0 * sy) + " cm /" + nm + " Do Q");
        }
      });
      d.set("Annots", keep);
    });
    this.af.set("Fields", []); this.af.del("NeedAppearances");
  };
  Doc.prototype.getForm = function () { return new Form(this); };
  Doc.prototype.getCatalog = function () { return dictOf(this.get(this.root())); };

  /* ================= standard security handler (empty user password): RC4-40/128, AES-128, AES-256 ================= */
  var PAD = new Uint8Array([0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08, 0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);
  function cat() { var n = 0, i; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var o = new Uint8Array(n), p = 0; for (i = 0; i < arguments.length; i++) { o.set(arguments[i], p); p += arguments[i].length; } return o; }
  var MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21], MD5_K = null;
  function md5(msg) {
    if (!MD5_K) { MD5_K = []; for (var i = 0; i < 64; i++) MD5_K.push(Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0); }
    var n = msg.length, tot = ((n + 8) >> 6) * 64 + 64, b = new Uint8Array(tot); b.set(msg); b[n] = 0x80; var dv = new DataView(b.buffer); dv.setUint32(tot - 8, (n * 8) >>> 0, true); dv.setUint32(tot - 4, Math.floor(n / 536870912), true);
    var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (var off = 0; off < tot; off += 64) {
      var M = []; for (var j = 0; j < 16; j++) M.push(dv.getUint32(off + j * 4, true)); var A = a0, B = b0, C = c0, D = d0;
      for (var k = 0; k < 64; k++) { var F, g; if (k < 16) { F = (B & C) | (~B & D); g = k; } else if (k < 32) { F = (D & B) | (~D & C); g = (5 * k + 1) % 16; } else if (k < 48) { F = B ^ C ^ D; g = (3 * k + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * k) % 16; }
        F = (F + A + MD5_K[k] + M[g]) >>> 0; A = D; D = C; C = B; B = (B + ((F << MD5_S[k]) | (F >>> (32 - MD5_S[k])))) >>> 0; }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    var o = new Uint8Array(16), od = new DataView(o.buffer); od.setUint32(0, a0, true); od.setUint32(4, b0, true); od.setUint32(8, c0, true); od.setUint32(12, d0, true); return o;
  }
  function rc4(key, data) {
    var s = new Uint8Array(256), i, j = 0, t; for (i = 0; i < 256; i++) s[i] = i; for (i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
    var o = new Uint8Array(data.length); i = 0; j = 0; for (var k = 0; k < data.length; k++) { i = (i + 1) & 255; j = (j + s[i]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; o[k] = data[k] ^ s[(s[i] + s[j]) & 255]; } return o;
  }
  var K256 = null;
  function sha256(msg) {
    if (!K256) { K256 = []; var pr = [], n = 2; while (pr.length < 64) { var ok = true; for (var d = 2; d * d <= n; d++) if (n % d === 0) { ok = false; break; } if (ok) pr.push(n); n++; } K256 = pr.map(function (p) { return Math.floor((Math.pow(p, 1 / 3) % 1) * 4294967296) >>> 0; }); }
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], len = msg.length, tot = ((len + 8) >> 6) * 64 + 64, b = new Uint8Array(tot); b.set(msg); b[len] = 0x80; var dv = new DataView(b.buffer); dv.setUint32(tot - 4, (len * 8) >>> 0); dv.setUint32(tot - 8, Math.floor(len / 536870912));
    var w = new Uint32Array(64), rr = function (x, n) { return (x >>> n) | (x << (32 - n)); };
    for (var off = 0; off < tot; off += 64) {
      var i; for (i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4); for (i = 16; i < 64; i++) { var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
      var a = h[0], bb = h[1], c = h[2], d2 = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) { var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K256[i] + w[i]) >>> 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) >>> 0; hh = g; g = f; f = e; e = (d2 + t1) >>> 0; d2 = c; c = bb; bb = a; a = (t1 + t2) >>> 0; }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + bb) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d2) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    var o = new Uint8Array(32), od = new DataView(o.buffer); for (var q = 0; q < 8; q++) od.setUint32(q * 4, h[q]); return o;
  }
  var K512 = null;
  function sha512(msg, is384) {
    var M = (1n << 64n) - 1n;
    if (!K512) { K512 = []; var pr = [], n = 2; while (pr.length < 80) { var ok = true; for (var d = 2; d * d <= n; d++) if (n % d === 0) { ok = false; break; } if (ok) pr.push(n); n++; }
      var icbrt = function (x) { /* floor(frac(cbrt(x)) * 2^64) with BigInt */ var X = BigInt(x) << 192n, lo = 0n, hi = 1n << 75n; while (lo < hi) { var mid = (lo + hi + 1n) >> 1n; if (mid * mid * mid <= X) lo = mid; else hi = mid - 1n; } return lo & M; };
      K512 = pr.map(icbrt); }
    var isqrtFrac = function (x) { var X = BigInt(x) << 128n, lo = 0n, hi = 1n << 72n; while (lo < hi) { var mid = (lo + hi + 1n) >> 1n; if (mid * mid <= X) lo = mid; else hi = mid - 1n; } return lo & M; };
    var h = is384 ? [8, 9, 10, 11, 12, 13, 14, 15].map(function (i) { return isqrtFrac([2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71][i + 0]); }) : [2, 3, 5, 7, 11, 13, 17, 19].map(isqrtFrac);
    if (is384) { /* SHA-384 uses the square roots of the 9th..16th primes */ var pp = [23, 29, 31, 37, 41, 43, 47, 53]; h = pp.map(isqrtFrac); }
    var len = msg.length, tot = ((len + 16) >> 7) * 128 + 128, b = new Uint8Array(tot); b.set(msg); b[len] = 0x80; var dv = new DataView(b.buffer); dv.setUint32(tot - 4, (len * 8) >>> 0); dv.setUint32(tot - 8, Math.floor(len / 536870912));
    var rr = function (x, n) { return ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M; }, w = new Array(80);
    for (var off = 0; off < tot; off += 128) {
      var i; for (i = 0; i < 16; i++) w[i] = (BigInt(dv.getUint32(off + i * 8)) << 32n) | BigInt(dv.getUint32(off + i * 8 + 4));
      for (i = 16; i < 80; i++) { var s0 = rr(w[i - 15], 1) ^ rr(w[i - 15], 8) ^ (w[i - 15] >> 7n), s1 = rr(w[i - 2], 19) ^ rr(w[i - 2], 61) ^ (w[i - 2] >> 6n); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M; }
      var a = h[0], bb = h[1], c = h[2], d2 = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 80; i++) { var S1 = rr(e, 14) ^ rr(e, 18) ^ rr(e, 41), ch = (e & f) ^ (~e & M & g), t1 = (hh + S1 + ch + K512[i] + w[i]) & M, S0 = rr(a, 28) ^ rr(a, 34) ^ rr(a, 39), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) & M; hh = g; g = f; f = e; e = (d2 + t1) & M; d2 = c; c = bb; bb = a; a = (t1 + t2) & M; }
      h = [h[0] + a, h[1] + bb, h[2] + c, h[3] + d2, h[4] + e, h[5] + f, h[6] + g, h[7] + hh].map(function (x) { return x & M; });
    }
    var out = new Uint8Array(is384 ? 48 : 64), od = new DataView(out.buffer); for (var q = 0; q < (is384 ? 6 : 8); q++) { od.setUint32(q * 8, Number(h[q] >> 32n)); od.setUint32(q * 8 + 4, Number(h[q] & 0xffffffffn)); } return out;
  }
  /* AES */
  var SBOX = null, ISBOX = null, MUL = null;
  function aesInit() {
    if (SBOX) return; SBOX = new Uint8Array(256); ISBOX = new Uint8Array(256); var p = 1, q = 1, rotl = function (x, s) { return ((x << s) | (x >> (8 - s))) & 255; };
    do { p = p ^ ((p << 1) & 255) ^ (p & 0x80 ? 0x1b : 0); q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 255; if (q & 0x80) q ^= 0x09; var x = q ^ rotl(q, 1) ^ rotl(q, 2) ^ rotl(q, 3) ^ rotl(q, 4); SBOX[p] = (x ^ 0x63) & 255; } while (p !== 1);
    SBOX[0] = 0x63; for (var i = 0; i < 256; i++) ISBOX[SBOX[i]] = i;
    var gm = function (a, b) { var r = 0; while (b) { if (b & 1) r ^= a; a = ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 255; b >>= 1; } return r; }; MUL = {}; [2, 3, 9, 11, 13, 14].forEach(function (m) { var t = new Uint8Array(256); for (var k = 0; k < 256; k++) t[k] = gm(k, m); MUL[m] = t; });
  }
  function aesKeys(key) {
    aesInit(); var nk = key.length / 4, nr = nk + 6, w = new Uint8Array(16 * (nr + 1)), i; w.set(key); var rc = 1;
    for (i = nk; i < 4 * (nr + 1); i++) { var t = [w[(i - 1) * 4], w[(i - 1) * 4 + 1], w[(i - 1) * 4 + 2], w[(i - 1) * 4 + 3]]; if (i % nk === 0) { t = [SBOX[t[1]] ^ rc, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]]; rc = ((rc << 1) ^ (rc & 0x80 ? 0x1b : 0)) & 255; } else if (nk > 6 && i % nk === 4) t = t.map(function (v) { return SBOX[v]; }); for (var k = 0; k < 4; k++) w[i * 4 + k] = w[(i - nk) * 4 + k] ^ t[k]; }
    return { w: w, nr: nr };
  }
  function aesBlock(s, K, dec) {
    var nr = K.nr, w = K.w, i, r, t = new Uint8Array(16);
    function add(rd) { for (var k = 0; k < 16; k++) s[k] ^= w[rd * 16 + k]; }
    if (!dec) {
      add(0); for (r = 1; r <= nr; r++) {
        for (i = 0; i < 16; i++) s[i] = SBOX[s[i]]; t.set(s); for (i = 0; i < 16; i++) s[i] = t[(i + 4 * (i % 4)) % 16];
        if (r < nr) for (var c = 0; c < 4; c++) { var a0 = s[c * 4], a1 = s[c * 4 + 1], a2 = s[c * 4 + 2], a3 = s[c * 4 + 3]; s[c * 4] = MUL[2][a0] ^ MUL[3][a1] ^ a2 ^ a3; s[c * 4 + 1] = a0 ^ MUL[2][a1] ^ MUL[3][a2] ^ a3; s[c * 4 + 2] = a0 ^ a1 ^ MUL[2][a2] ^ MUL[3][a3]; s[c * 4 + 3] = MUL[3][a0] ^ a1 ^ a2 ^ MUL[2][a3]; }
        add(r);
      }
    } else {
      add(nr); for (r = nr - 1; r >= 0; r--) {
        t.set(s); for (i = 0; i < 16; i++) s[(i + 4 * (i % 4)) % 16] = t[i]; for (i = 0; i < 16; i++) s[i] = ISBOX[s[i]]; add(r);
        if (r > 0) for (var c2 = 0; c2 < 4; c2++) { var b0 = s[c2 * 4], b1 = s[c2 * 4 + 1], b2 = s[c2 * 4 + 2], b3 = s[c2 * 4 + 3]; s[c2 * 4] = MUL[14][b0] ^ MUL[11][b1] ^ MUL[13][b2] ^ MUL[9][b3]; s[c2 * 4 + 1] = MUL[9][b0] ^ MUL[14][b1] ^ MUL[11][b2] ^ MUL[13][b3]; s[c2 * 4 + 2] = MUL[13][b0] ^ MUL[9][b1] ^ MUL[14][b2] ^ MUL[11][b3]; s[c2 * 4 + 3] = MUL[11][b0] ^ MUL[13][b1] ^ MUL[9][b2] ^ MUL[14][b3]; }
      }
    }
  }
  function cbcDecrypt(key, iv, data, unpad) {
    var K = aesKeys(key), n = Math.floor(data.length / 16), out = new Uint8Array(n * 16), prev = iv, blk = new Uint8Array(16);
    for (var b = 0; b < n; b++) { blk.set(data.subarray(b * 16, b * 16 + 16)); var cur = data.subarray(b * 16, b * 16 + 16); aesBlock(blk, K, true); for (var k = 0; k < 16; k++) out[b * 16 + k] = blk[k] ^ prev[k]; prev = cur; }
    if (unpad && out.length) { var pl = out[out.length - 1]; if (pl >= 1 && pl <= 16) return out.subarray(0, out.length - pl); }
    return out;
  }
  function cbcEncryptNoPad(key, iv, data) {
    var K = aesKeys(key), n = data.length / 16, out = new Uint8Array(data.length), prev = iv, blk = new Uint8Array(16);
    for (var b = 0; b < n; b++) { for (var k = 0; k < 16; k++) blk[k] = data[b * 16 + k] ^ prev[k]; aesBlock(blk, K, false); out.set(blk, b * 16); prev = out.subarray(b * 16, b * 16 + 16); } return out;
  }
  function hash2B(pw, salt, udata) {
    var K = sha256(cat(pw, salt, udata)), i = 0;
    for (;;) {
      var one = cat(pw, K, udata), K1 = new Uint8Array(one.length * 64); for (var r = 0; r < 64; r++) K1.set(one, r * one.length);
      var E = cbcEncryptNoPad(K.subarray(0, 16), K.subarray(16, 32), K1), m = 0; for (var k = 0; k < 16; k++) m += E[k]; m %= 3;
      K = m === 0 ? sha256(E) : m === 1 ? sha512(E, true) : sha512(E, false); i++;
      if (i >= 64 && E[E.length - 1] <= i - 32) break;
    }
    return K.subarray(0, 32);
  }
  function eqBytes(a, b, n) { for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; }
  /* returns {obj(o, num, gen)} that decrypts every string and stream of an object; throws code "encrypted" when a password is needed */
  function makeCrypt(doc, enc, id0) {
    var g = function (k) { return doc.get(enc.get(k)); }, V = g("V") || 0, R = g("R") || 2, O = g("O"), U = g("U"), Pm = g("P"), len = g("Length") || 40, encMeta = g("EncryptMetadata") !== false;
    var fail = function () { return PdfError("encrypted", "This PDF is password protected."); };
    if (!(O instanceof Str) || !(U instanceof Str)) throw fail(); var Ob = O.b, Ub = U.b, key, stm = "RC4", strm = "RC4";
    if (V >= 4) {
      var cf = dictOf(g("CF")), pick = function (nm) { var n = doc.get(enc.get(nm)); n = n instanceof Name ? n.n : "Identity"; if (n === "Identity") return "NONE"; var d = cf && dictOf(doc.get(cf.get(n))), m = d && doc.get(d.get("CFM")); m = m instanceof Name ? m.n : "None"; return m === "V2" ? "RC4" : m === "AESV2" ? "AES" : m === "AESV3" ? "AES256" : "NONE"; };
      stm = pick("StmF"); strm = pick("StrF"); var cd = cf && dictOf(doc.get(cf.get("StdCF"))); if (V === 4) len = (cd && doc.get(cd.get("Length"))) ? (doc.get(cd.get("Length")) <= 40 ? doc.get(cd.get("Length")) * 8 : doc.get(cd.get("Length"))) : 128;
    }
    if (V >= 5) {
      var UE = g("UE"); if (!(UE instanceof Str) || Ub.length < 48) throw fail();
      var pw = new Uint8Array(0), vs = Ub.subarray(32, 40), ks = Ub.subarray(40, 48), hv = R >= 6 ? hash2B(pw, vs, new Uint8Array(0)) : sha256(cat(pw, vs));
      if (!eqBytes(hv, Ub, 32)) throw fail();
      var ik = R >= 6 ? hash2B(pw, ks, new Uint8Array(0)) : sha256(cat(pw, ks)); key = cbcDecrypt(ik, new Uint8Array(16), UE.b.subarray(0, 32), false);
    } else {
      var n = V === 1 ? 5 : Math.max(5, Math.min(16, len / 8)), p4 = new Uint8Array(4); new DataView(p4.buffer).setInt32(0, Pm | 0, true);
      var h = md5(cat(PAD, Ob.subarray(0, 32), p4, id0, R >= 4 && !encMeta ? new Uint8Array([255, 255, 255, 255]) : new Uint8Array(0)));
      if (R >= 3) for (var i = 0; i < 50; i++) h = md5(h.subarray(0, n)); key = h.subarray(0, n);
      var ok; if (R === 2) ok = eqBytes(rc4(key, PAD), Ub, 32); else { var x = rc4(key, md5(cat(PAD, id0))); for (var r2 = 1; r2 <= 19; r2++) x = rc4(key.map(function (b) { return b ^ r2; }), x); ok = eqBytes(x, Ub, 16); }
      if (!ok) throw fail();
    }
    function objKey(num, gen, aes) {
      if (V >= 5) return key; var ext = [num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]; if (aes) ext.push(0x73, 0x41, 0x6c, 0x54);
      return md5(cat(key, new Uint8Array(ext))).subarray(0, Math.min(key.length + 5, 16));
    }
    function dec(method, bytes, num, gen) {
      if (method === "NONE") return bytes; if (method === "RC4") return rc4(objKey(num, gen, false), bytes);
      if (bytes.length < 32) return new Uint8Array(0); return cbcDecrypt(objKey(num, gen, true), bytes.subarray(0, 16), bytes.subarray(16), true);
    }
    function walk(o, num, gen) {
      if (o instanceof Str) return new Str(dec(strm, o.b, num, gen), o.hex);
      if (Array.isArray(o)) return o.map(function (x) { return walk(x, num, gen); });
      if (o instanceof Dict) { var d = new Dict(); o.m.forEach(function (v, k) { d.set(k, walk(v, num, gen)); }); return d; }
      if (o instanceof Stream) {
        var d2 = walk(o.dict, num, gen), t = d2.get("Type"), skip = (t instanceof Name && (t.n === "XRef" || (t.n === "Metadata" && !encMeta))); var fl = d2.get("Filter"), f0 = Array.isArray(fl) ? fl[0] : fl; if (f0 instanceof Name && f0.n === "Crypt") skip = true;
        var s = new Stream(d2, null); s._src = o._src; s._off = o._off; s._len = o._len; if (o._raw !== null) s._raw = skip ? o._raw : dec(stm, o._raw, num, gen); else if (!skip) s._dec = function (bb) { return dec(stm, bb, num, gen); }; return s; /* decrypted only when somebody reads the data */
      }
      return o;
    }
    return { obj: walk };
  }

  return {
    Doc: Doc, Page: Page, Name: Name, Ref: Ref, Str: Str, Dict: Dict, Stream: Stream, PdfError: PdfError, MemSource: MemSource, BlobSource: BlobSource,
    rgb: rgb, degrees: degrees, StandardFonts: StandardFonts, Form: Form,
    util: { _crypto: { md5: md5, sha256: sha256, sha512: sha512, rc4: rc4, cbcDecrypt: cbcDecrypt, cbcEncryptNoPad: cbcEncryptNoPad }, afm: function (n) { var k = { Helvetica: "H", "Helvetica-Oblique": "H", "Helvetica-Bold": "HB", "Helvetica-BoldOblique": "HB", "Times-Roman": "T", "Times-Bold": "TB", "Times-Italic": "TI", "Times-BoldItalic": "TBI" }[n]; return k ? AFM[k] : null; }, inflate: zlibInflate, deflate: zlibDeflate, mkDict: mkDict, N: N, dictOf: dictOf, serialize: serialize, textString: textString, Parser: Parser, te: te, strText: strText }
  };
});

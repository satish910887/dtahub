/* DTAqr: DTAhub's own QR Code encoder (ISO/IEC 18004 Model 2). Original code, no third-party dependency.
   Supports versions 1-40, error correction L/M/Q/H, numeric, alphanumeric and byte (UTF-8) modes, all 8 masks with
   the standard penalty scoring. Usage:
     var q = DTAqr.create("https://dtahub.example", { ec: "M" });
     q.size, q.version, q.mask, q.isDark(row, col), q.toSvg({ margin: 4, fg: "#000", bg: "#fff", scale: 1 })
   Pure and DOM-free, so it is unit tested in Node (scripts/qr-test.mjs) and cross-checked with a real QR decoder. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DTAqr = factory();
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- tables (ISO 18004 table 9), index = version, [0] unused ---------- */
  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  };
  var BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  };
  var FMT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  var ALNUM = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

  /* ---------- Reed-Solomon over GF(256), polynomial 0x11D ---------- */
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]; }
  function rsGenerator(deg) {
    var g = [1];
    for (var i = 0; i < deg; i++) { var n = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { n[j] ^= g[j]; n[j + 1] ^= gmul(g[j], EXP[i]); } g = n; }
    return g; /* highest degree first, leading 1 */
  }
  function rsRemainder(data, gen) {
    var deg = gen.length - 1, r = new Array(deg).fill(0);
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ r.shift(); r.push(0);
      if (f) for (var j = 0; j < deg; j++) r[j] ^= gmul(gen[j + 1], f);
    }
    return r;
  }

  /* ---------- bit buffer ---------- */
  function Bits() { this.b = []; }
  Bits.prototype.put = function (v, n) { for (var i = n - 1; i >= 0; i--) this.b.push((v >>> i) & 1); };

  /* ---------- version geometry ---------- */
  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, ec) { return Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[ec][v] * BLOCKS[ec][v]; }
  function alignPositions(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, size = v * 4 + 17, res = [6];
    for (var p = size - 7; res.length < n; p -= step) res.splice(1, 0, p);
    return res;
  }
  function countBits(mode, v) { var i = v <= 9 ? 0 : v <= 26 ? 1 : 2; return { num: [10, 12, 14], alnum: [9, 11, 13], byte: [8, 16, 16] }[mode][i]; }
  var MODE_IND = { num: 1, alnum: 2, byte: 4 };

  function utf8(s) {
    if (typeof TextEncoder !== "undefined") return Array.prototype.slice.call(new TextEncoder().encode(s));
    var o = [], enc = unescape(encodeURIComponent(s)); for (var i = 0; i < enc.length; i++) o.push(enc.charCodeAt(i)); return o;
  }
  function pickMode(s) {
    if (/^[0-9]*$/.test(s)) return "num";
    for (var i = 0; i < s.length; i++) if (ALNUM.indexOf(s.charAt(i)) < 0) return "byte";
    return "alnum";
  }
  /* returns {bytes, len, bits(fn)} describing the payload for the chosen mode */
  function payload(s, mode) {
    if (mode === "byte") { var by = utf8(s); return { len: by.length, write: function (b) { by.forEach(function (x) { b.put(x, 8); }); }, bitLen: by.length * 8 }; }
    if (mode === "num") return { len: s.length, bitLen: Math.floor(s.length / 3) * 10 + (s.length % 3 === 0 ? 0 : s.length % 3 === 1 ? 4 : 7), write: function (b) {
      for (var i = 0; i < s.length; i += 3) { var g = s.substr(i, 3); b.put(parseInt(g, 10), g.length === 3 ? 10 : g.length === 2 ? 7 : 4); } } };
    return { len: s.length, bitLen: Math.floor(s.length / 2) * 11 + (s.length % 2) * 6, write: function (b) {
      for (var i = 0; i + 1 < s.length; i += 2) b.put(ALNUM.indexOf(s.charAt(i)) * 45 + ALNUM.indexOf(s.charAt(i + 1)), 11);
      if (s.length % 2) b.put(ALNUM.indexOf(s.charAt(s.length - 1)), 6); } };
  }

  /* ---------- matrix building ---------- */
  function Matrix(v) {
    this.v = v; this.n = v * 4 + 17;
    this.m = []; this.f = []; /* module value, function-pattern flag */
    for (var i = 0; i < this.n; i++) { this.m.push(new Array(this.n).fill(false)); this.f.push(new Array(this.n).fill(false)); }
  }
  Matrix.prototype.set = function (r, c, dark, fn) { this.m[r][c] = !!dark; if (fn) this.f[r][c] = true; };
  Matrix.prototype.finder = function (cr, cc) {
    for (var dr = -4; dr <= 4; dr++) for (var dc = -4; dc <= 4; dc++) {
      var r = cr + dr, c = cc + dc; if (r < 0 || c < 0 || r >= this.n || c >= this.n) continue;
      var d = Math.max(Math.abs(dr), Math.abs(dc)); this.set(r, c, d !== 2 && d !== 4, true);
    }
  };
  Matrix.prototype.align = function (cr, cc) {
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) this.set(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1, true);
  };
  Matrix.prototype.drawFunctions = function () {
    var n = this.n, i;
    for (i = 0; i < n; i++) { this.set(6, i, i % 2 === 0, true); this.set(i, 6, i % 2 === 0, true); }
    this.finder(3, 3); this.finder(3, n - 4); this.finder(n - 4, 3);
    var ap = alignPositions(this.v);
    for (var a = 0; a < ap.length; a++) for (var b = 0; b < ap.length; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === ap.length - 1) || (a === ap.length - 1 && b === 0)) continue;
      this.align(ap[a], ap[b]);
    }
    this.drawFormat(0, 0); /* reserve; real bits are written after the mask is chosen */
    this.drawVersion();
  };
  Matrix.prototype.drawFormat = function (ecBits, mask) {
    var data = (ecBits << 3) | mask, rem = data, i;
    for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412, n = this.n, bit = function (k) { return ((bits >>> k) & 1) !== 0; };
    for (i = 0; i <= 5; i++) this.set(i, 8, bit(i), true);
    this.set(7, 8, bit(6), true); this.set(8, 8, bit(7), true); this.set(8, 7, bit(8), true);
    for (i = 9; i < 15; i++) this.set(8, 14 - i, bit(i), true);
    for (i = 0; i < 8; i++) this.set(8, n - 1 - i, bit(i), true);
    for (i = 8; i < 15; i++) this.set(n - 15 + i, 8, bit(i), true);
    this.set(n - 8, 8, true, true); /* the always-dark module */
  };
  Matrix.prototype.drawVersion = function () {
    if (this.v < 7) return;
    var rem = this.v, i;
    for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    var bits = (this.v << 12) | rem, n = this.n;
    for (i = 0; i < 18; i++) { var d = ((bits >>> i) & 1) !== 0, a = n - 11 + (i % 3), b = Math.floor(i / 3); this.set(b, a, d, true); this.set(a, b, d, true); }
  };
  Matrix.prototype.placeData = function (cw) {
    var n = this.n, i = 0, total = cw.length * 8;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < n; vert++) for (var j = 0; j < 2; j++) {
        var c = right - j, up = ((right + 1) & 2) === 0, r = up ? n - 1 - vert : vert;
        if (!this.f[r][c] && i < total) { this.m[r][c] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
  };
  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; }, function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; }, function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];
  Matrix.prototype.applyMask = function (k) { for (var r = 0; r < this.n; r++) for (var c = 0; c < this.n; c++) if (!this.f[r][c] && MASKS[k](r, c)) this.m[r][c] = !this.m[r][c]; };
  Matrix.prototype.penalty = function () {
    var n = this.n, m = this.m, s = 0, r, c, k;
    function runs(line) {
      var p = 0, run = 1, i;
      for (i = 1; i < n; i++) { if (line[i] === line[i - 1]) { run++; } else { if (run >= 5) p += 3 + run - 5; run = 1; } }
      if (run >= 5) p += 3 + run - 5;
      /* finder-like 1:1:3:1:1 with 4 light modules on either side (rule 3, 40 points each) */
      for (i = 0; i + 11 <= n; i++) {
        var a = [1, 0, 1, 1, 1, 0, 1], ok1 = true, ok2 = true, t;
        for (t = 0; t < 7; t++) { if ((line[i + t] ? 1 : 0) !== a[t]) ok1 = false; if ((line[i + 4 + t] ? 1 : 0) !== a[t]) ok2 = false; }
        if (ok1 && !line[i + 7] && !line[i + 8] && !line[i + 9] && !line[i + 10]) p += 40;
        if (ok2 && !line[i] && !line[i + 1] && !line[i + 2] && !line[i + 3]) p += 40;
      }
      return p;
    }
    for (r = 0; r < n; r++) s += runs(m[r]);
    for (c = 0; c < n; c++) { var col = []; for (r = 0; r < n; r++) col.push(m[r][c]); s += runs(col); }
    for (r = 0; r + 1 < n; r++) for (c = 0; c + 1 < n; c++) if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) s += 3;
    var dark = 0; for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (m[r][c]) dark++;
    k = Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1; /* each full 5% step away from 50% */
    return s + (k > 0 ? k * 10 : 0);
  };

  /* ---------- main entry ---------- */
  function create(text, opt) {
    opt = opt || {};
    var ec = String(opt.ec || "M").toUpperCase(); if (!ECC_PER_BLOCK[ec]) throw new Error("DTAqr: ec must be L, M, Q or H");
    var s = String(text == null ? "" : text), mode = opt.mode || pickMode(s);
    if (mode === "alnum" && pickMode(s) === "byte") mode = "byte"; if (mode === "num" && pickMode(s) !== "num") mode = pickMode(s);
    var pl = payload(s, mode), v = 0, ver;
    for (ver = opt.minVersion || 1; ver <= (opt.maxVersion || 40); ver++) {
      if (4 + countBits(mode, ver) + pl.bitLen <= dataCodewords(ver, ec) * 8) { v = ver; break; }
    }
    if (!v) throw new Error("DTAqr: text is too long for a QR code");
    /* data bits: mode, count, payload, terminator, byte padding, 0xEC/0x11 pad */
    var b = new Bits(); b.put(MODE_IND[mode], 4); b.put(pl.len, countBits(mode, v)); pl.write(b);
    var cap = dataCodewords(v, ec) * 8; b.put(0, Math.min(4, cap - b.b.length)); while (b.b.length % 8) b.b.push(0);
    for (var pad = 0xec; b.b.length < cap; pad ^= 0xec ^ 0x11) b.put(pad, 8);
    var data = []; for (var i = 0; i < b.b.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | b.b[i + j]; data.push(x); }
    /* split into blocks, add Reed-Solomon, interleave */
    var nb = BLOCKS[ec][v], eclen = ECC_PER_BLOCK[ec][v], raw = Math.floor(rawModules(v) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), gen = rsGenerator(eclen), blocks = [], k = 0;
    for (i = 0; i < nb; i++) { var dl = shortLen - eclen + (i < nShort ? 0 : 1), d = data.slice(k, k + dl); k += dl; blocks.push({ d: d, e: rsRemainder(d, gen) }); }
    var cw = [], maxD = shortLen - eclen + 1;
    for (i = 0; i < maxD; i++) blocks.forEach(function (bl) { if (i < bl.d.length) cw.push(bl.d[i]); });
    for (i = 0; i < eclen; i++) blocks.forEach(function (bl) { cw.push(bl.e[i]); });
    /* place, then choose the mask with the lowest penalty (or the forced one) */
    var best = null, bestMask = -1, bestScore = Infinity, from = 0, to = 7;
    if (opt.mask != null) { from = to = opt.mask | 0; if (from < 0 || from > 7) throw new Error("DTAqr: mask must be 0-7"); }
    for (var mk = from; mk <= to; mk++) {
      var M = new Matrix(v); M.drawFunctions(); M.placeData(cw); M.applyMask(mk); M.drawFormat(FMT_BITS[ec], mk);
      var sc = M.penalty(); if (sc < bestScore) { bestScore = sc; best = M; bestMask = mk; }
    }
    return new QR(best, v, ec, bestMask, mode);
  }

  function QR(M, v, ec, mask, mode) { this.version = v; this.ec = ec; this.mask = mask; this.mode = mode; this.size = M.n; this._m = M.m; }
  QR.prototype.isDark = function (r, c) { return r >= 0 && c >= 0 && r < this.size && c < this.size && this._m[r][c]; };
  /* [[0,1,...],...] of 0/1 values */
  QR.prototype.matrix = function () { return this._m.map(function (row) { return row.map(function (x) { return x ? 1 : 0; }); }); };
  QR.prototype.toSvg = function (o) {
    o = o || {}; var mg = o.margin == null ? 4 : o.margin, n = this.size, t = n + mg * 2, fg = o.fg || "#000000", bg = o.bg || "#ffffff", px = o.scalable ? "100%" : (o.scale || 1) * t, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (this._m[r][c]) d += "M" + (c + mg) + "," + (r + mg) + "h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + " " + t + '" width="' + px + '" height="' + px + '" shape-rendering="crispEdges"><rect width="' + t + '" height="' + t + '" fill="' + bg + '"/><path d="' + d + '" fill="' + fg + '"/></svg>';
  };

  return {
    create: create,
    /* largest number of characters that fits at this EC level, for the given text mode */
    capacity: function (ec, mode) {
      var best = 0; mode = mode || "byte";
      for (var v = 1; v <= 40; v++) { var bitsAvail = dataCodewords(v, ec) * 8 - 4 - countBits(mode, v), n = mode === "byte" ? Math.floor(bitsAvail / 8) : mode === "num" ? Math.floor(bitsAvail / 10) * 3 + (bitsAvail % 10 >= 7 ? 2 : bitsAvail % 10 >= 4 ? 1 : 0) : Math.floor(bitsAvail / 11) * 2 + (bitsAvail % 11 >= 6 ? 1 : 0); best = n; }
      return best;
    },
    _internals: { rsGenerator: rsGenerator, rsRemainder: rsRemainder, rawModules: rawModules, dataCodewords: dataCodewords, alignPositions: alignPositions }
  };
});

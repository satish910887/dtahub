/* DTApdfFont: DTAhub's own glyph-outline parsers for the fonts embedded in PDF files.
   TrueType / OpenType (glyf and CFF), bare CFF (Type1C, CIDFontType0C) and Type 1 (eexec) fonts.
   Original code. Every glyph comes back as a flat path array: [0,x,y] move, [1,x,y] line, [2,x1,y1,x2,y2,x3,y3] cubic, [3] close.
   Pure and DOM-free so it can be tested in Node against fontTools. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(root, require("./dta-pdf-data.js"));
  else root.DTApdfFont = factory(root, root.DTApdfData);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, DATA) {
  "use strict";
  function FontError(m) { var e = new Error(m); e.name = "FontError"; return e; }

  /* ================= TrueType / OpenType ================= */
  function TTF(buf) {
    this.b = buf; var dv = this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), base = 0;
    if (buf.length < 12) throw FontError("font too short");
    var tag = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    if (tag === "ttcf") base = dv.getUint32(12);
    var n = dv.getUint16(base + 4); this.t = {};
    for (var i = 0; i < n; i++) { var p = base + 12 + i * 16; if (p + 16 > buf.length) break; this.t[String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3])] = { off: dv.getUint32(p + 8), len: dv.getUint32(p + 12) }; }
    var head = this.t.head; this.unitsPerEm = head ? dv.getUint16(head.off + 18) || 1000 : 1000; this.locFmt = head ? dv.getInt16(head.off + 50) : 0;
    this.numGlyphs = this.t.maxp ? dv.getUint16(this.t.maxp.off + 4) : 0;
    this.nHM = this.t.hhea ? dv.getUint16(this.t.hhea.off + 34) : 0;
    this.cache = {}; this.cff = null;
    if (this.t["CFF "]) { var c = this.t["CFF "]; this.cff = new CFF(buf.subarray(c.off, c.off + c.len)); if (!this.numGlyphs) this.numGlyphs = this.cff.numGlyphs; }
    else if (!this.t.glyf || !this.t.loca) throw FontError("no outlines in font");
    else if (!this.numGlyphs) this.numGlyphs = Math.floor(this.t.loca.len / (this.locFmt ? 4 : 2)) - 1;
    this.cmaps = this.readCmap(); this._names = null;
  }
  TTF.prototype.readCmap = function () {
    var t = this.t.cmap, dv = this.dv, out = []; if (!t) return out;
    var n = dv.getUint16(t.off + 2);
    for (var i = 0; i < n; i++) { var p = t.off + 4 + i * 8, off = t.off + dv.getUint32(p + 4); if (off + 4 > this.b.length) continue; out.push({ pid: dv.getUint16(p), eid: dv.getUint16(p + 2), off: off, fmt: dv.getUint16(off), map: null }); }
    return out;
  };
  TTF.prototype.cmap = function (pid, eid) { for (var i = 0; i < this.cmaps.length; i++) if (this.cmaps[i].pid === pid && (eid === undefined || this.cmaps[i].eid === eid)) return this.cmaps[i]; return null; };
  TTF.prototype.lookup = function (st, code) {
    var dv = this.dv, o = st.off, f = st.fmt, len = this.b.length;
    try {
      if (f === 0) return code < 256 ? this.b[o + 6 + code] : 0;
      if (f === 4) {
        var sc = dv.getUint16(o + 6) / 2, endO = o + 14, startO = endO + sc * 2 + 2, deltaO = startO + sc * 2, rangeO = deltaO + sc * 2;
        for (var i = 0; i < sc; i++) {
          if (code <= dv.getUint16(endO + i * 2)) {
            var s = dv.getUint16(startO + i * 2); if (code < s) return 0;
            var ro = dv.getUint16(rangeO + i * 2), d = dv.getInt16(deltaO + i * 2);
            if (ro === 0) return (code + d) & 0xffff;
            var g = dv.getUint16(rangeO + i * 2 + ro + (code - s) * 2); return g ? (g + d) & 0xffff : 0;
          }
        }
        return 0;
      }
      if (f === 6) { var first = dv.getUint16(o + 6), cnt = dv.getUint16(o + 8); return code >= first && code < first + cnt ? dv.getUint16(o + 10 + (code - first) * 2) : 0; }
      if (f === 12) { var ng = dv.getUint32(o + 12); for (var k = 0; k < ng; k++) { var q = o + 16 + k * 12, a = dv.getUint32(q), b = dv.getUint32(q + 4); if (code >= a && code <= b) return dv.getUint32(q + 8) + code - a; if (code < a) break; } return 0; }
      if (f === 2 || f === 13 || f === 10) return 0;
    } catch (e) { return 0; }
    return 0;
  };
  TTF.prototype.postNames = function () {
    if (this._names) return this._names; var names = this._names = {}, t = this.t.post; if (!t) return names;
    var dv = this.dv, fmt = dv.getUint32(t.off);
    if (fmt === 0x00020000) {
      var n = dv.getUint16(t.off + 32), idx = [], p = t.off + 34, i; for (i = 0; i < n; i++) idx.push(dv.getUint16(p + i * 2)); p += n * 2;
      var strs = [], end = t.off + t.len; while (p < end) { var l = this.b[p++]; strs.push(String.fromCharCode.apply(null, this.b.subarray(p, p + l))); p += l; }
      var MAC = macGlyphNames();
      for (i = 0; i < n; i++) { var x = idx[i], nm = x < 258 ? MAC[x] : strs[x - 258]; if (nm && names[nm] === undefined) names[nm] = i; }
    }
    return names;
  };
  TTF.prototype.gidForName = function (name) { if (this.cff && !this.t.glyf) { var g = this.cff.gidForName(name); return g; } var v = this.postNames()[name]; return v === undefined ? 0 : v; };
  TTF.prototype.advance = function (gid) {
    var hm = this.t.hmtx; if (!hm || !this.nHM) return 0; var i = Math.min(gid, this.nHM - 1); var p = hm.off + i * 4; return p + 2 <= this.b.length ? this.dv.getUint16(p) : 0;
  };
  TTF.prototype.glyphRange = function (gid) {
    var loca = this.t.loca, dv = this.dv, a, b; if (gid < 0 || gid >= this.numGlyphs) return null;
    if (this.locFmt) { if (loca.off + gid * 4 + 8 > this.b.length) return null; a = dv.getUint32(loca.off + gid * 4); b = dv.getUint32(loca.off + gid * 4 + 4); }
    else { if (loca.off + gid * 2 + 4 > this.b.length) return null; a = dv.getUint16(loca.off + gid * 2) * 2; b = dv.getUint16(loca.off + gid * 2 + 2) * 2; }
    return b > a ? [this.t.glyf.off + a, this.t.glyf.off + b] : null;
  };
  TTF.prototype.path = function (gid, depth) {
    if (this.cff) { var r = this.cff.path(gid); return r.path; }
    if (this.cache[gid]) return this.cache[gid]; var out = this._glyph(gid, depth || 0); this.cache[gid] = out; return out;
  };
  TTF.prototype._glyph = function (gid, depth) {
    var rg = this.glyphRange(gid); if (!rg || depth > 6) return []; var dv = this.dv, p = rg[0], nc = dv.getInt16(p); p += 10;
    if (nc >= 0) {
      var ends = [], i; for (i = 0; i < nc; i++) { ends.push(dv.getUint16(p)); p += 2; }
      var np = nc ? ends[nc - 1] + 1 : 0, il = dv.getUint16(p); p += 2 + il; var flags = new Uint8Array(np);
      for (i = 0; i < np;) { var f = this.b[p++]; flags[i++] = f; if (f & 8) { var r = this.b[p++]; while (r-- && i < np) flags[i++] = f; } }
      var xs = new Float64Array(np), ys = new Float64Array(np), v = 0;
      for (i = 0; i < np; i++) { var fl = flags[i]; if (fl & 2) { var d = this.b[p++]; v += fl & 16 ? d : -d; } else if (!(fl & 16)) { v += dv.getInt16(p); p += 2; } xs[i] = v; }
      v = 0;
      for (i = 0; i < np; i++) { var fl2 = flags[i]; if (fl2 & 4) { var d2 = this.b[p++]; v += fl2 & 32 ? d2 : -d2; } else if (!(fl2 & 32)) { v += dv.getInt16(p); p += 2; } ys[i] = v; }
      var out = [], s = 0;
      for (var c = 0; c < nc; c++) { contour(out, xs, ys, flags, s, ends[c]); s = ends[c] + 1; }
      return out;
    }
    var res = [], more = true;
    while (more && p + 4 <= rg[1] + 2) {
      var fg = dv.getUint16(p), gi = dv.getUint16(p + 2), dx, dy; p += 4;
      if (fg & 1) { if (fg & 2) { dx = dv.getInt16(p); dy = dv.getInt16(p + 2); } else { dx = 0; dy = 0; } p += 4; } else { if (fg & 2) { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); } else { dx = 0; dy = 0; } p += 2; }
      var a = 1, b = 0, cc = 0, dd = 1;
      if (fg & 8) { a = dd = dv.getInt16(p) / 16384; p += 2; } else if (fg & 0x40) { a = dv.getInt16(p) / 16384; dd = dv.getInt16(p + 2) / 16384; p += 4; } else if (fg & 0x80) { a = dv.getInt16(p) / 16384; b = dv.getInt16(p + 2) / 16384; cc = dv.getInt16(p + 4) / 16384; dd = dv.getInt16(p + 6) / 16384; p += 8; }
      var sub = this._glyph(gi, depth + 1);
      appendT(res, sub, a, b, cc, dd, fg & 2 ? dx : 0, fg & 2 ? dy : 0);
      more = !!(fg & 0x20);
    }
    return res;
  };
  function appendT(out, src, a, b, c, d, e, f) {
    var i = 0; while (i < src.length) {
      var op = src[i++];
      if (op === 0 || op === 1) { out.push(op, a * src[i] + c * src[i + 1] + e, b * src[i] + d * src[i + 1] + f); i += 2; }
      else if (op === 2) { out.push(2); for (var k = 0; k < 3; k++) { out.push(a * src[i] + c * src[i + 1] + e, b * src[i] + d * src[i + 1] + f); i += 2; } }
      else out.push(3);
    }
  }
  function contour(out, xs, ys, fl, s, e) {
    var n = e - s + 1; if (n < 1) return; var pts = [], i;
    for (i = s; i <= e; i++) pts.push([xs[i], ys[i], fl[i] & 1]);
    var start;
    if (pts[0][2]) start = pts[0]; else if (pts[n - 1][2]) { start = pts[n - 1]; pts.unshift(pts.pop()); } else start = [(pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2, 1], pts.unshift(start);
    out.push(0, start[0], start[1]); var cx = start[0], cy = start[1], ctrl = null;
    function quad(qx, qy, x, y) { out.push(2, cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y); cx = x; cy = y; }
    for (i = 1; i <= pts.length; i++) {
      var pnt = i === pts.length ? start : pts[i];
      if (pnt[2]) { if (ctrl) { quad(ctrl[0], ctrl[1], pnt[0], pnt[1]); ctrl = null; } else { out.push(1, pnt[0], pnt[1]); cx = pnt[0]; cy = pnt[1]; } }
      else { if (ctrl) quad(ctrl[0], ctrl[1], (ctrl[0] + pnt[0]) / 2, (ctrl[1] + pnt[1]) / 2); ctrl = pnt; }
    }
    if (ctrl) quad(ctrl[0], ctrl[1], start[0], start[1]);
    out.push(3);
  }
  var _mac = null;
  function macGlyphNames() {
    if (_mac) return _mac;
    _mac = (".notdef .null nonmarkingreturn space exclam quotedbl numbersign dollar percent ampersand quotesingle parenleft parenright asterisk plus comma hyphen period slash zero one two three four five six seven eight nine colon semicolon less equal greater question at A B C D E F G H I J K L M N O P Q R S T U V W X Y Z bracketleft backslash bracketright asciicircum underscore grave a b c d e f g h i j k l m n o p q r s t u v w x y z braceleft bar braceright asciitilde Adieresis Aring Ccedilla Eacute Ntilde Odieresis Udieresis aacute agrave acircumflex adieresis atilde aring ccedilla eacute egrave ecircumflex edieresis iacute igrave icircumflex idieresis ntilde oacute ograve ocircumflex odieresis otilde uacute ugrave ucircumflex udieresis dagger degree cent sterling section bullet paragraph germandbls registered copyright trademark acute dieresis notequal AE Oslash infinity plusminus lessequal greaterequal yen mu partialdiff summation product pi integral ordfeminine ordmasculine Omega ae oslash questiondown exclamdown logicalnot radical florin approxequal Delta guillemotleft guillemotright ellipsis nonbreakingspace Agrave Atilde Otilde OE oe endash emdash quotedblleft quotedblright quoteleft quoteright divide lozenge ydieresis Ydieresis fraction currency guilsinglleft guilsinglright fi fl daggerdbl periodcentered quotesinglbase quotedblbase perthousand Acircumflex Ecircumflex Aacute Edieresis Egrave Iacute Icircumflex Idieresis Igrave Oacute Ocircumflex apple Ograve Uacute Ucircumflex Ugrave dotlessi circumflex tilde macron breve dotaccent ring cedilla hungarumlaut ogonek caron Lslash lslash Scaron scaron Zcaron zcaron brokenbar Eth eth Yacute yacute Thorn thorn minus multiply onesuperior twosuperior threesuperior onehalf onequarter threequarters franc Gbreve gbreve Idotaccent Scedilla scedilla Cacute cacute Ccaron ccaron dcroat").split(" ");
    return _mac;
  }

  /* ================= CFF (Compact Font Format) ================= */
  function CFF(buf) {
    this.b = buf; var b = buf; if (b[0] !== 1) throw FontError("unsupported CFF version");
    var hdr = b[2], pos = hdr, nameIdx = this.index(pos); pos = nameIdx.end; var topIdx = this.index(pos); pos = topIdx.end; var strIdx = this.index(pos); pos = strIdx.end; var gsub = this.index(pos);
    this.strings = strIdx.items; this.gsubrs = gsub.items;
    var top = this.dict(topIdx.items[0][0], topIdx.items[0][1]); this.top = top;
    var csOff = top[17] && top[17][0]; if (csOff === undefined) throw FontError("CFF has no CharStrings");
    this.charStrings = this.index(csOff).items; this.numGlyphs = this.charStrings.length;
    this.fontMatrix = top[1207] && top[1207].length === 6 ? top[1207] : [0.001, 0, 0, 0.001, 0, 0];
    this.isCID = !!top[1230];
    this.privs = [];
    if (this.isCID && top[1236]) {
      var fda = this.index(top[1236][0]).items, self = this;
      this.fdMatrix = []; fda.forEach(function (r, i) { var fd = self.dict(r[0], r[1]); self.privs.push(self.readPrivate(fd[18])); self.fdMatrix.push(fd[1207] && fd[1207].length === 6 ? fd[1207] : null); });
      this.fdSelect = this.readFDSelect(top[1237] && top[1237][0]);
    } else this.privs.push(this.readPrivate(top[18]));
    this.charset = this.readCharset(top[15] ? top[15][0] : 0); this.nameToGid = null; this.cache = {};
    this.encoding = this.isCID ? null : this.readEncoding(top[16] ? top[16][0] : 0);
  }
  CFF.prototype.index = function (pos) {
    var b = this.b, count = (b[pos] << 8) | b[pos + 1]; if (!count) return { items: [], end: pos + 2 };
    var os = b[pos + 2], offs = [], p = pos + 3, i; for (i = 0; i <= count; i++) { var v = 0; for (var k = 0; k < os; k++) v = v * 256 + b[p++]; offs.push(v); }
    var base = p - 1, items = []; for (i = 0; i < count; i++) items.push([base + offs[i], base + offs[i + 1]]);
    return { items: items, end: base + offs[count] };
  };
  CFF.prototype.dict = function (s, e) {
    var b = this.b, out = {}, st = [], p = s;
    while (p < e) {
      var c = b[p++];
      if (c <= 21) { var op = c; if (c === 12) op = 1200 + b[p++]; out[op] = st; st = []; }
      else if (c === 28) { st.push(((b[p] << 8) | b[p + 1]) << 16 >> 16); p += 2; }
      else if (c === 29) { st.push((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]); p += 4; }
      else if (c === 30) { var s2 = ""; for (;;) { var by = b[p++], hi = by >> 4, lo = by & 15, done = false;[hi, lo].forEach(function (n) { if (done) return; if (n < 10) s2 += n; else if (n === 10) s2 += "."; else if (n === 11) s2 += "E"; else if (n === 12) s2 += "E-"; else if (n === 14) s2 += "-"; else if (n === 15) done = true; }); if (done || p >= e) break; } st.push(parseFloat(s2) || 0); }
      else if (c >= 32 && c <= 246) st.push(c - 139);
      else if (c >= 247 && c <= 250) st.push((c - 247) * 256 + b[p++] + 108);
      else if (c >= 251 && c <= 254) st.push(-(c - 251) * 256 - b[p++] - 108);
    }
    return out;
  };
  CFF.prototype.readPrivate = function (pd) {
    var r = { subrs: [], dw: 0, nw: 0 }; if (!pd || pd.length < 2) return r;
    var d = this.dict(pd[1], pd[1] + pd[0]); r.dw = d[20] ? d[20][0] : 0; r.nw = d[21] ? d[21][0] : 0;
    if (d[19]) r.subrs = this.index(pd[1] + d[19][0]).items; return r;
  };
  CFF.prototype.readFDSelect = function (off) {
    var b = this.b, n = this.numGlyphs, out = new Uint8Array(n); if (off === undefined) return out;
    if (b[off] === 0) for (var i = 0; i < n; i++) out[i] = b[off + 1 + i];
    else if (b[off] === 3) { var nr = (b[off + 1] << 8) | b[off + 2], p = off + 3; for (var r = 0; r < nr; r++) { var first = (b[p] << 8) | b[p + 1], fd = b[p + 2], next = (b[p + 3] << 8) | b[p + 4]; for (var g = first; g < next && g < n; g++) out[g] = fd; p += 3; } }
    return out;
  };
  CFF.prototype.sid = function (s) { var std = DATA.cffStd; if (s < std.length) return std[s]; var r = this.strings[s - std.length]; return r ? String.fromCharCode.apply(null, this.b.subarray(r[0], r[1])) : ".notdef"; };
  CFF.prototype.readCharset = function (off) {
    var n = this.numGlyphs, out = new Array(n), b = this.b; out[0] = 0;
    if (off <= 2) { for (var i = 1; i < n; i++) out[i] = i; return out; }
    var fmt = b[off], p = off + 1, g = 1;
    if (fmt === 0) { while (g < n) { out[g++] = (b[p] << 8) | b[p + 1]; p += 2; } }
    else { while (g < n && p < b.length) { var first = (b[p] << 8) | b[p + 1], left; p += 2; if (fmt === 1) left = b[p++]; else { left = (b[p] << 8) | b[p + 1]; p += 2; } for (var k = 0; k <= left && g < n; k++) out[g++] = first + k; } }
    return out;
  };
  CFF.prototype.readEncoding = function (off) {
    var enc = new Array(256).fill(0), b = this.b, self = this;
    if (off <= 1) { var std = DATA.std; for (var c = 0; c < 256; c++) if (std[c]) enc[c] = self.gidForName(std[c]); return enc; }
    var fmt = b[off] & 0x7f, p = off + 1;
    if (fmt === 0) { var nc = b[p++]; for (var i = 1; i <= nc; i++) enc[b[p++]] = i; }
    else { var nr = b[p++], g = 1; for (var r = 0; r < nr; r++) { var first = b[p++], left = b[p++]; for (var k = 0; k <= left; k++) enc[first + k] = g++; } }
    if (b[off] & 0x80) { var ns = b[p++]; for (var s = 0; s < ns; s++) { var code = b[p++], sid = (b[p] << 8) | b[p + 1]; p += 2; var gg = self.gidForName(self.sid(sid)); if (gg) enc[code] = gg; } }
    return enc;
  };
  CFF.prototype.glyphName = function (gid) { return this.isCID ? null : this.sid(this.charset[gid]); };
  CFF.prototype.gidForName = function (name) {
    if (!this.nameToGid) { var m = this.nameToGid = Object.create(null); if (!this.isCID) for (var g = this.numGlyphs - 1; g >= 0; g--) m[this.sid(this.charset[g])] = g; }
    var v = this.nameToGid[name]; return v === undefined ? 0 : v;
  };
  CFF.prototype.gidForCid = function (cid) {
    if (!this.isCID) return cid < this.numGlyphs ? cid : 0;
    if (!this._c2g) { var m = this._c2g = new Map(); for (var g = 0; g < this.numGlyphs; g++) m.set(this.charset[g], g); }
    var v = this._c2g.get(cid); return v === undefined ? 0 : v;
  };
  function bias(n) { return n < 1240 ? 107 : n < 33900 ? 1131 : 32768; }
  CFF.prototype.path = function (gid) {
    if (this.cache[gid]) return this.cache[gid]; var r = this._run(gid); this.cache[gid] = r; return r;
  };
  CFF.prototype._run = function (gid, seacDepth) {
    var cs = this.charStrings[gid]; if (!cs) return { path: [], width: 0 };
    var fd = this.isCID ? this.fdSelect[gid] : 0, priv = this.privs[fd] || this.privs[0] || { subrs: [], dw: 0, nw: 0 }, self = this, b = this.b;
    var st = [], path = [], x = 0, y = 0, nStems = 0, width = null, haveW = false, open = false, steps = 0, ended = false, tx = 0, ty = 0;
    var gb = bias(this.gsubrs.length), lb = bias(priv.subrs.length), trans = [];
    function moveTo(dx, dy) { if (open) path.push(3); x += dx; y += dy; path.push(0, x, y); open = true; }
    function lineTo(dx, dy) { x += dx; y += dy; path.push(1, x, y); }
    function curve(a, b2, c, d, e, f) { var x1 = x + a, y1 = y + b2, x2 = x1 + c, y2 = y1 + d; x = x2 + e; y = y2 + f; path.push(2, x1, y1, x2, y2, x, y); }
    function chkW(expect, even) { if (haveW) return; haveW = true; if (even ? st.length % 2 === 1 : st.length > expect) width = priv.nw + st.shift(); }
    function exec(s, e, depth) {
      var p = s;
      while (p < e && !ended) {
        if (++steps > 200000) { ended = true; return; }
        var c = b[p++];
        if (c >= 32 || c === 28) {
          if (c === 28) { st.push(((b[p] << 8) | b[p + 1]) << 16 >> 16); p += 2; }
          else if (c <= 246) st.push(c - 139); else if (c <= 250) st.push((c - 247) * 256 + b[p++] + 108); else if (c <= 254) st.push(-(c - 251) * 256 - b[p++] - 108);
          else { st.push(((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) / 65536); p += 4; }
          continue;
        }
        var i, n;
        switch (c) {
          case 1: case 3: case 18: case 23: chkW(0, true); nStems += st.length >> 1; st.length = 0; break;
          case 19: case 20: chkW(0, true); nStems += st.length >> 1; st.length = 0; p += (nStems + 7) >> 3; break;
          case 21: chkW(2); moveTo(st[st.length - 2] || 0, st[st.length - 1] || 0); st.length = 0; break;
          case 22: chkW(1); moveTo(st[st.length - 1] || 0, 0); st.length = 0; break;
          case 4: chkW(1); moveTo(0, st[st.length - 1] || 0); st.length = 0; break;
          case 5: for (i = 0; i + 1 < st.length; i += 2) lineTo(st[i], st[i + 1]); st.length = 0; break;
          case 6: case 7: { var h = c === 6; for (i = 0; i < st.length; i++) { if (h) lineTo(st[i], 0); else lineTo(0, st[i]); h = !h; } st.length = 0; break; }
          case 8: for (i = 0; i + 5 < st.length; i += 6) curve(st[i], st[i + 1], st[i + 2], st[i + 3], st[i + 4], st[i + 5]); st.length = 0; break;
          case 24: for (i = 0; i + 5 < st.length - 2; i += 6) curve(st[i], st[i + 1], st[i + 2], st[i + 3], st[i + 4], st[i + 5]); lineTo(st[i], st[i + 1]); st.length = 0; break;
          case 25: for (i = 0; i + 1 < st.length - 6; i += 2) lineTo(st[i], st[i + 1]); curve(st[i], st[i + 1], st[i + 2], st[i + 3], st[i + 4], st[i + 5]); st.length = 0; break;
          case 26: { i = 0; var dx1 = 0; if (st.length % 4) dx1 = st[i++]; for (; i + 3 < st.length; i += 4) { curve(dx1, st[i], st[i + 1], st[i + 2], 0, st[i + 3]); dx1 = 0; } st.length = 0; break; }
          case 27: { i = 0; var dy1 = 0; if (st.length % 4) dy1 = st[i++]; for (; i + 3 < st.length; i += 4) { curve(st[i], dy1, st[i + 1], st[i + 2], st[i + 3], 0); dy1 = 0; } st.length = 0; break; }
          case 30: case 31: {
            var hv = c === 31; i = 0;
            while (i + 3 < st.length) {
              var last = st.length - i === 5 ? st[i + 4] : 0;
              if (hv) curve(st[i], 0, st[i + 1], st[i + 2], last, st[i + 3]); else curve(0, st[i], st[i + 1], st[i + 2], st[i + 3], last);
              hv = !hv; i += 4;
            }
            st.length = 0; break;
          }
          case 10: case 29: { var arr = c === 10 ? priv.subrs : self.gsubrs, bs = c === 10 ? lb : gb, idx = st.pop() + bs, r = arr[idx]; if (r && depth < 12) exec(r[0], r[1], depth + 1); break; }
          case 11: return;
          case 14: {
            chkW(0); if (st.length >= 4) { /* seac-style accent */
              var adx = st[st.length - 4], ady = st[st.length - 3], bch = st[st.length - 2], ach = st[st.length - 1], std = DATA.std;
              if (!seacDepth) { var bg = self.gidForName(std[bch]), ag = self.gidForName(std[ach]); if (open) path.push(3); open = false; var br = self._run(bg, 1), ar = self._run(ag, 1); path = path.concat(br.path); appendT(path, ar.path, 1, 0, 0, 1, adx, ady); }
            }
            if (open) path.push(3); open = false; ended = true; return;
          }
          case 12: {
            var c2 = b[p++];
            if (c2 === 35) { curve(st[0], st[1], st[2], st[3], st[4], st[5]); curve(st[6], st[7], st[8], st[9], st[10], st[11]); st.length = 0; }
            else if (c2 === 34) { curve(st[0], 0, st[1], st[2], st[3], 0); curve(st[4], 0, st[5], -st[2], st[6], 0); st.length = 0; }
            else if (c2 === 36) { curve(st[0], st[1], st[2], st[3], st[4], 0); curve(st[5], 0, st[6], st[7], st[8], -(st[1] + st[3] + st[7])); st.length = 0; }
            else if (c2 === 37) { var dx = st[0] + st[2] + st[4] + st[6] + st[8], dy = st[1] + st[3] + st[5] + st[7] + st[9]; curve(st[0], st[1], st[2], st[3], st[4], st[5]); if (Math.abs(dx) > Math.abs(dy)) curve(st[6], st[7], st[8], st[9], st[10], -dy); else curve(st[6], st[7], st[8], st[9], -dx, st[10]); st.length = 0; }
            else if (c2 === 3) { var b1 = st.pop(), a1 = st.pop(); st.push(a1 && b1 ? 1 : 0); } else if (c2 === 4) { var b2 = st.pop(), a2 = st.pop(); st.push(a2 || b2 ? 1 : 0); } else if (c2 === 5) st.push(st.pop() ? 0 : 1);
            else if (c2 === 9) st.push(Math.abs(st.pop())); else if (c2 === 10) { var q = st.pop(), w = st.pop(); st.push(w + q); } else if (c2 === 11) { var q1 = st.pop(), w1 = st.pop(); st.push(w1 - q1); } else if (c2 === 12) { var q2 = st.pop(), w2 = st.pop(); st.push(w2 / q2); }
            else if (c2 === 14) st.push(-st.pop()); else if (c2 === 15) { var q3 = st.pop(), w3 = st.pop(); st.push(w3 === q3 ? 1 : 0); } else if (c2 === 18) st.pop(); else if (c2 === 20) { var ix = st.pop(), v = st.pop(); trans[ix] = v; } else if (c2 === 21) st.push(trans[st.pop()] || 0);
            else if (c2 === 22) { var v2 = st.pop(), v1 = st.pop(), s2 = st.pop(), s1 = st.pop(); st.push(v1 <= v2 ? s1 : s2); } else if (c2 === 23) st.push(0.5); else if (c2 === 24) { var q4 = st.pop(), w4 = st.pop(); st.push(w4 * q4); } else if (c2 === 26) st.push(Math.sqrt(st.pop()));
            else if (c2 === 27) { var t = st[st.length - 1]; st.push(t); } else if (c2 === 28) { var q5 = st.pop(), w5 = st.pop(); st.push(q5, w5); } else if (c2 === 29) { var ii = st.pop(); st.push(st[st.length - 1 - Math.max(0, ii)] || 0); }
            else if (c2 === 30) { var jj = st.pop(), nn = st.pop(), seg = st.splice(st.length - nn, nn); jj = ((jj % nn) + nn) % nn; for (var k = 0; k < nn; k++) st.push(seg[(k - jj + nn) % nn]); }
            else st.length = 0;
            break;
          }
          default: st.length = 0;
        }
      }
    }
    exec(cs[0], cs[1], 0); if (open) path.push(3);
    if (width === null) width = priv.dw; else width = width;
    var res = { path: path, width: width };
    if (this.isCID && this.fdMatrix && this.fdMatrix[fd]) { /* font matrix of the sub-font multiplies the top one */ res.fm = this.fdMatrix[fd]; }
    return res;
  };

  /* ================= Type 1 ================= */
  function Type1(buf, len1) {
    var b = buf, txt = latin(b);
    if (b[0] === 0x80) { /* PFB segments */
      var parts = [], p = 0; while (p + 6 <= b.length && b[p] === 0x80) { var ty = b[p + 1]; if (ty === 3) break; var l = b[p + 2] | (b[p + 3] << 8) | (b[p + 4] << 16) | (b[p + 5] << 24); parts.push(b.subarray(p + 6, p + 6 + l)); p += 6 + l; }
      var tot = parts.reduce(function (a, x) { return a + x.length; }, 0), nb = new Uint8Array(tot), q = 0; parts.forEach(function (x) { nb.set(x, q); q += x.length; }); b = nb; txt = latin(b); len1 = parts[0].length;
    }
    var ee = txt.indexOf("eexec"); if (ee < 0) throw FontError("not a Type 1 font");
    var clear = txt.slice(0, ee), p2 = ee + 5; while (b[p2] === 32 || b[p2] === 10 || b[p2] === 13 || b[p2] === 9) p2++;
    var enc = b.subarray(p2), isHex = true; for (var i = 0; i < 4; i++) { var ch = enc[i]; if (!((ch >= 48 && ch <= 57) || (ch >= 65 && ch <= 70) || (ch >= 97 && ch <= 102))) isHex = false; }
    if (isHex) { var hx = [], hv = -1; for (var k = 0; k < enc.length; k++) { var cc = enc[k], d = cc >= 48 && cc <= 57 ? cc - 48 : cc >= 65 && cc <= 70 ? cc - 55 : cc >= 97 && cc <= 102 ? cc - 87 : -1; if (d < 0) continue; if (hv < 0) hv = d; else { hx.push(hv * 16 + d); hv = -1; } } enc = new Uint8Array(hx); }
    var priv = decrypt(enc, 55665, 4), ptxt = latin(priv);
    this.fontMatrix = [0.001, 0, 0, 0.001, 0, 0]; var fm = /\/FontMatrix\s*\[([^\]]+)\]/.exec(clear); if (fm) { var v = fm[1].trim().split(/\s+/).map(parseFloat); if (v.length === 6 && v.every(isFinite)) this.fontMatrix = v; }
    this.encoding = new Array(256).fill(""); var er = /dup\s+(\d+)\s*\/(\S+)\s+put/g, m;
    var encPart = clear.slice(clear.indexOf("/Encoding")); if (/\/Encoding\s+StandardEncoding\s+def/.test(clear)) this.encoding = DATA.std.slice(); else while ((m = er.exec(encPart))) this.encoding[+m[1]] = m[2];
    var lenIV = 4, lm = /\/lenIV\s+(\d+)/.exec(ptxt); if (lm) lenIV = +lm[1];
    this.subrs = []; this.glyphs = Object.create(null); this.lenIV = lenIV; this.cache = {};
    var sp = ptxt.indexOf("/Subrs"), cp = ptxt.indexOf("/CharStrings"), rd;
    function rd2(from, to, cb) {
      var re = /dup\s+(\d+)\s+(\d+)\s+(RD|-\||\S+)\s/g, mm; re.lastIndex = from;
      while ((mm = re.exec(ptxt)) && mm.index < to) { var n = +mm[2], st = mm.index + mm[0].length; cb(+mm[1], priv.subarray(st, st + n)); re.lastIndex = st + n; }
    }
    var self = this;
    if (sp >= 0) rd2(sp, cp > sp ? cp : ptxt.length, function (i, data) { self.subrs[i] = decrypt(data, 4330, lenIV); });
    if (cp >= 0) { var cr = /\/(\S+)\s+(\d+)\s+(RD|-\||\S+)\s/g; cr.lastIndex = cp + 12; var mm2; while ((mm2 = cr.exec(ptxt))) { var n2 = +mm2[2], st2 = mm2.index + mm2[0].length; if (mm2[1] === "FontName") continue; self.glyphs[mm2[1]] = decrypt(priv.subarray(st2, st2 + n2), 4330, lenIV); cr.lastIndex = st2 + n2; } }
    if (!Object.keys(this.glyphs).length) throw FontError("Type 1 font has no glyphs");
  }
  function latin(b) { var s = "", i = 0; for (; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 8192))); return s; }
  function decrypt(src, r, skip) { var out = new Uint8Array(Math.max(0, src.length - skip)); for (var i = 0; i < src.length; i++) { var c = src[i], pl = c ^ (r >> 8); r = ((c + r) * 52845 + 22719) & 0xffff; if (i >= skip) out[i - skip] = pl; } return out; }
  Type1.prototype.has = function (name) { return !!this.glyphs[name]; };
  Type1.prototype.path = function (name) {
    if (this.cache[name]) return this.cache[name]; var cs = this.glyphs[name]; if (!cs) return { path: [], width: 0 };
    var r = this._run(cs, 0); this.cache[name] = r; return r;
  };
  Type1.prototype._run = function (cs, depth) {
    var self = this, st = [], ps = [], path = [], x = 0, y = 0, sbx = 0, sby = 0, width = 0, open = false, flex = false, fpts = [], ended = false, steps = 0;
    function mv(dx, dy) { x += dx; y += dy; if (flex) { fpts.push([x, y]); return; } if (open) path.push(3); path.push(0, x, y); open = true; }
    function ln(dx, dy) { x += dx; y += dy; if (!open) { path.push(0, x - dx, y - dy); open = true; } path.push(1, x, y); }
    function cv(a, b, c, d, e, f) { if (!open) { path.push(0, x, y); open = true; } var x1 = x + a, y1 = y + b, x2 = x1 + c, y2 = y1 + d; x = x2 + e; y = y2 + f; path.push(2, x1, y1, x2, y2, x, y); }
    function exec(code, d) {
      var p = 0;
      while (p < code.length && !ended) {
        if (++steps > 100000) { ended = true; return; }
        var c = code[p++];
        if (c >= 32) {
          if (c <= 246) st.push(c - 139); else if (c <= 250) st.push((c - 247) * 256 + code[p++] + 108); else if (c <= 254) st.push(-(c - 251) * 256 - code[p++] - 108);
          else { st.push((code[p] << 24) | (code[p + 1] << 16) | (code[p + 2] << 8) | code[p + 3]); p += 4; }
          continue;
        }
        switch (c) {
          case 13: sbx = st[0]; width = st[1]; x = sbx; y = 0; st.length = 0; break;
          case 1: case 3: st.length = 0; break;
          case 4: mv(0, st.pop()); st.length = 0; break;
          case 5: ln(st[0], st[1]); st.length = 0; break;
          case 6: ln(st[0], 0); st.length = 0; break;
          case 7: ln(0, st[0]); st.length = 0; break;
          case 8: cv(st[0], st[1], st[2], st[3], st[4], st[5]); st.length = 0; break;
          case 9: if (open) path.push(3); open = false; st.length = 0; break;
          case 10: { var si = st.pop(), sub = self.subrs[si]; if (sub && d < 12) exec(sub, d + 1); break; }
          case 11: return;
          case 14: if (open) path.push(3); open = false; ended = true; return;
          case 21: mv(st[0], st[1]); st.length = 0; break;
          case 22: mv(st[0], 0); st.length = 0; break;
          case 30: cv(0, st[0], st[1], st[2], st[3], 0); st.length = 0; break;
          case 31: cv(st[0], 0, st[1], st[2], 0, st[3]); st.length = 0; break;
          case 12: {
            var c2 = code[p++];
            if (c2 === 7) { sbx = st[0]; sby = st[1]; width = st[2]; x = sbx; y = sby; st.length = 0; }
            else if (c2 === 12) { var q = st.pop(), w = st.pop(); st.push(w / q); }
            else if (c2 === 16) { /* callothersubr */
              var on = st.pop(), na = st.pop(), args = []; for (var i = 0; i < na; i++) args.push(st.pop());
              if (on === 1) { flex = true; fpts = []; }
              else if (on === 2) { /* point already recorded by rmoveto */ }
              else if (on === 0) {
                flex = false; if (fpts.length >= 7) { var f = fpts; if (!open) { path.push(0, f[0][0], f[0][1]); open = true; } path.push(2, f[1][0], f[1][1], f[2][0], f[2][1], f[3][0], f[3][1], 2, f[4][0], f[4][1], f[5][0], f[5][1], f[6][0], f[6][1]); x = f[6][0]; y = f[6][1]; }
                ps.push(args[0], args[1]); /* y then x are popped by "pop pop setcurrentpoint" */
                ps = [y, x];
              } else if (on === 3) ps.push(args[0]); else { for (var j = args.length - 1; j >= 0; j--) ps.push(args[j]); }
            }
            else if (c2 === 17) st.push(ps.length ? ps.pop() : 0);
            else if (c2 === 33) { x = st[0]; y = st[1]; st.length = 0; }
            else if (c2 === 6) { /* seac: asb adx ady bchar achar */
              var asb = st[0], adx = st[1], ady = st[2], bch = st[3], ach = st[4]; st.length = 0;
              if (!depth) {
                var bn = DATA.std[bch], an = DATA.std[ach], br = self.glyphs[bn] && self._run(self.glyphs[bn], 1), ar = self.glyphs[an] && self._run(self.glyphs[an], 1);
                if (open) path.push(3); open = false; if (br) path = path.concat(br.path); if (ar) appendT(path, ar.path, 1, 0, 0, 1, sbx - asb + adx, ady);
              }
              ended = true; return;
            } else st.length = 0;
            break;
          }
          default: st.length = 0;
        }
      }
    }
    exec(cs, 0); if (open) path.push(3); return { path: path, width: width };
  };

  /* ================= detection ================= */
  function load(bytes, hint) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), t4 = String.fromCharCode(b[0], b[1], b[2], b[3]);
    if (t4 === "OTTO" || t4 === "true" || t4 === "ttcf" || (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0)) return { kind: "sfnt", font: new TTF(b) };
    if (b[0] === 1 && b[1] === 0 && b[2] >= 4) return { kind: "cff", font: new CFF(b) };
    if (b[0] === 0x80 || t4.slice(0, 2) === "%!") return { kind: "type1", font: new Type1(b) };
    if (hint === "type1") return { kind: "type1", font: new Type1(b) };
    throw FontError("unknown font format");
  }
  return { TTF: TTF, CFF: CFF, Type1: Type1, load: load, FontError: FontError, appendT: appendT };
});

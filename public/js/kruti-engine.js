/* DTAhub: Kruti Dev 010 <-> Unicode Hindi converter engine.
   Original code. Works on-device, no network. Covers the common Kruti Dev 010 keyboard layout;
   rare glyphs are left unchanged. Exposes DTAkruti.toUnicode(text, {digits}) and DTAkruti.toKruti(text). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DTAkruti = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var HAL = "्", NUK = "़";

  /* consonant -> typed key for the full letter and for its half (conjunct-leading) form */
  var FULL = { "क": "d", "ख": "[k", "ग": "x", "घ": "?k", "ङ": "³", "च": "p", "छ": "N", "ज": "t", "झ": ">", "ञ": "¥",
    "ट": "V", "ठ": "B", "ड": "M", "ढ": "<", "ण": ".k", "त": "r", "थ": "Fk", "द": "n", "ध": "/k", "न": "u",
    "प": "i", "फ": "Q", "ब": "c", "भ": "Hk", "म": "e", "य": ";", "र": "j", "ल": "y", "व": "o", "श": "'k",
    "ष": "\"k", "स": "l", "ह": "g" };
  var HALF = { "क": "D", "ख": "[", "ग": "X", "घ": "?", "च": "P", "ज": "T", "त": "R", "थ": "F", "ध": "/", "न": "U",
    "प": "I", "फ": "¶", "ब": "C", "भ": "H", "म": "E", "य": "¸", "ल": "Y", "व": "O", "श": "'", "ष": "\"",
    "स": "L", "ण": "." };
  /* ready-made conjunct glyphs: [first, second] -> [full key, half key or null] */
  var PAIR = { "क्ष": ["{k", "{"], "ज्ञ": ["K", null], "श्र": ["J", null], "त्र": ["=", null],
    "द्व": ["}", null], "द्य": ["|", null], "क्र": ["Ø", null], "त्त": ["Ùk", "Ù"] };
  var VOW = { "अ": "v", "आ": "vk", "इ": "b", "ई": "bZ", "उ": "m", "ऊ": "Å", "ए": ",", "ऐ": ",s", "ओ": "vks", "औ": "vkS", "ऋ": "_" };
  var MAT = { "ा": "k", "ी": "h", "ु": "q", "ू": "w", "ृ": "`", "े": "s", "ै": "S", "ो": "ks", "ौ": "kS" };
  var SIGN = { "ं": "a", "ँ": "¡", "ः": "%" };
  var NUKTA_FULL = { "क": "d+", "ख": "[+k", "ग": "x+", "ज": "t+", "ड": "M+", "ढ": "<+", "फ": "Q+" };
  var DIGI = "०१२३४५६७८९";

  /* ---------- Kruti Dev -> Unicode ---------- */
  var DEC = {}, k;
  function put(key, val, type) { DEC[key] = { v: val, t: type }; }
  for (k in FULL) put(FULL[k], k, "F");
  for (k in HALF) put(HALF[k], k + HAL, "H");
  for (k in PAIR) { put(PAIR[k][0], k.replace(HAL, HAL), "F"); if (PAIR[k][1]) put(PAIR[k][1], k + HAL, "H"); }
  put("Ñ", "कृ", "F");
  for (k in NUKTA_FULL) put(NUKTA_FULL[k], k + NUK, "F");
  put("[+k", "ख़", "F");
  for (k in VOW) put(VOW[k], k, "V");
  for (k in MAT) if (k !== "ि") put(MAT[k], k, "M");
  for (k in SIGN) put(SIGN[k], k, "M");
  put("~", HAL, "T"); put("+", NUK, "N"); put("A", "।", "P"); put("]", ",", "P"); put("\\", "?", "P");
  put("f", "ि", "I"); put("Z", "", "R"); put("z", "्र", "Q"); put("ª", "्र", "Q");
  put("Xk", "ग", "F");

  function toUnicode(src, opt) {
    opt = opt || {};
    var s = String(src == null ? "" : src), out = [], i = 0, cs = -1, inCl = false, pendI = false;
    while (i < s.length) {
      var tok = null, len = 0, l;
      for (l = 3; l >= 1 && !tok; l--) { var key = s.substr(i, l); if (key.length === l && DEC[key]) { tok = DEC[key]; len = l; } }
      if (!tok) {
        var ch = s.charAt(i);
        if (opt.digits !== false && ch >= "0" && ch <= "9") out.push(DIGI.charAt(+ch)); else out.push(ch);
        i++; inCl = false; cs = -1; pendI = false; continue;
      }
      i += len;
      if (tok.t === "F" || tok.t === "H") {
        if (!inCl) cs = out.length;
        out.push(tok.v);
        if (tok.t === "H") { inCl = true; continue; }
        inCl = false;
        while (i < s.length && (s.charAt(i) === "z" || s.charAt(i) === "ª")) { out.push("्र"); i++; }
        if (s.charAt(i) === "+" && tok.v.indexOf(NUK) < 0) { out.push(NUK); i++; }
        if (pendI) { out.push("ि"); pendI = false; }
      } else if (tok.t === "I") { pendI = true; }
      else if (tok.t === "R") { if (cs >= 0) { out.splice(cs, 0, "र्"); } else out.push("Z"); }
      else if (tok.t === "T") { out.push(HAL); inCl = true; }
      else if (tok.t === "N") { out.push(NUK); }
      else { out.push(tok.v); inCl = false; if (tok.t === "V" || tok.t === "P") cs = -1; }
    }
    return out.join("");
  }

  /* ---------- Unicode -> Kruti Dev ---------- */
  function isCons(c) { return !!FULL[c]; }
  function toKruti(src) {
    var s = String(src == null ? "" : src).normalize("NFD"), out = "", i = 0, n = s.length;
    while (i < n) {
      var c = s.charAt(i);
      if (VOW[c] !== undefined) { out += VOW[c]; i++; continue; }
      if (c === "।") { out += "A"; i++; continue; }
      if (c === ",") { out += "]"; i++; continue; }
      if (c === "?") { out += "\\"; i++; continue; }
      if (c >= "०" && c <= "९") { out += String(DIGI.indexOf(c)); i++; continue; }
      if (!isCons(c)) { out += MAT[c] !== undefined ? MAT[c] : SIGN[c] !== undefined ? SIGN[c] : c; i++; continue; }
      /* collect one consonant cluster: C (nukta)? (halant C (nukta)?)* */
      var cl = [], j = i;
      for (;;) {
        var cc = s.charAt(j); j++;
        var nk = false; if (s.charAt(j) === NUK) { nk = true; j++; }
        cl.push({ c: cc, nk: nk });
        if (s.charAt(j) === HAL && isCons(s.charAt(j + 1))) { j++; continue; }
        break;
      }
      var halantEnd = s.charAt(j) === HAL; if (halantEnd) j++;
      var reph = false;
      if (cl.length > 1 && cl[0].c === "र" && !cl[0].nk) { reph = true; cl.shift(); }
      var body = "", m = 0;
      while (m < cl.length) {
        var cur = cl[m], last = m === cl.length - 1 && !halantEnd, nx = cl[m + 1];
        if (!last && nx && !cur.nk && !nx.nk && PAIR[cur.c + HAL + nx.c]) {
          var pr = PAIR[cur.c + HAL + nx.c], lastAfter = m + 1 === cl.length - 1 && !halantEnd;
          if (lastAfter) { body += pr[0]; m += 2; continue; }
          if (pr[1]) { body += pr[1]; m += 2; continue; }
        }
        if (!last && nx && nx.c === "र" && !nx.nk && !cur.nk && (m + 1 === cl.length - 1)) {
          var zq = (cur.c === "ट" || cur.c === "ड" || cur.c === "छ") ? "ª" : "z";
          body += FULL[cur.c] + zq; m += 2; continue;
        }
        if (cur.nk) body += NUKTA_FULL[cur.c] || (FULL[cur.c] + "+");
        else if (m === cl.length - 1) body += FULL[cur.c] + (halantEnd ? "~" : "");
        else body += HALF[cur.c] !== undefined ? HALF[cur.c] : FULL[cur.c] + "~";
        m++;
      }
      /* matras and signs that follow */
      var mat = "", front = "", tail = "";
      while (j < n) {
        var t = s.charAt(j);
        if (t === "ि") { front = "f"; j++; }
        else if (MAT[t] !== undefined) { mat += MAT[t]; j++; }
        else if (SIGN[t] !== undefined) { tail += SIGN[t]; j++; }
        else break;
      }
      if (mat.charAt(0) === "`" && /d$/.test(body) && !cl[cl.length - 1].nk && !halantEnd) { body = body.slice(0, -1) + "Ñ"; mat = mat.slice(1); }
      out += front + body + mat + (reph ? "Z" : "") + tail;
      i = j;
    }
    return out;
  }

  return { toUnicode: toUnicode, toKruti: toKruti };
});

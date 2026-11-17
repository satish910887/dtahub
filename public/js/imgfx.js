/* DTAfx - original pixel engine for the DTAhub image editor (no third-party code).
   DTAfx.process(imageData, params) edits pixels in place. All amounts are -100..100 or 0..100. */
(function () {
  "use strict";
  function boxBlur(src, w, h, r) {
    if (r < 1) return new Uint8ClampedArray(src);
    var tmp = new Uint8ClampedArray(src.length), out = new Uint8ClampedArray(src.length), d = r * 2 + 1, x, y, c, i, s, o;
    for (c = 0; c < 3; c++) {
      for (y = 0; y < h; y++) {
        o = y * w * 4 + c; s = 0;
        for (x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x)) * 4];
        for (x = 0; x < w; x++) {
          tmp[o + x * 4] = s / d;
          s += src[o + Math.min(w - 1, x + r + 1) * 4] - src[o + Math.max(0, x - r) * 4];
        }
      }
      for (x = 0; x < w; x++) {
        o = x * 4 + c; s = 0;
        for (y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w * 4 + o];
        for (y = 0; y < h; y++) {
          out[y * w * 4 + o] = s / d;
          s += tmp[Math.min(h - 1, y + r + 1) * w * 4 + o] - tmp[Math.max(0, y - r) * w * 4 + o];
        }
      }
    }
    for (i = 3; i < src.length; i += 4) out[i] = src[i];
    return out;
  }
  function pixelate(p, w, h, bs) {
    var x, y, i, j, n, r, g, b, yy, xx;
    for (y = 0; y < h; y += bs) for (x = 0; x < w; x += bs) {
      r = g = b = n = 0;
      for (yy = y; yy < Math.min(h, y + bs); yy++) for (xx = x; xx < Math.min(w, x + bs); xx++) { i = (yy * w + xx) * 4; r += p[i]; g += p[i + 1]; b += p[i + 2]; n++; }
      r /= n; g /= n; b /= n;
      for (yy = y; yy < Math.min(h, y + bs); yy++) for (xx = x; xx < Math.min(w, x + bs); xx++) { j = (yy * w + xx) * 4; p[j] = r; p[j + 1] = g; p[j + 2] = b; }
    }
  }
  function autoLevels(id) {
    var p = id.data, hist = new Uint32Array(256), n = 0, i, lo = 0, hi = 255, a = 0;
    for (i = 0; i < p.length; i += 16) { hist[Math.round(.299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2])]++; n++; }
    for (i = 0; i < 256; i++) { a += hist[i]; if (a >= n * 0.01) { lo = i; break; } }
    a = 0;
    for (i = 255; i >= 0; i--) { a += hist[i]; if (a >= n * 0.01) { hi = i; break; } }
    if (hi - lo < 30) { lo = 0; hi = 255; }
    return { lo: lo, hi: hi };
  }
  function process(id, q) {
    var w = id.width, h = id.height, p = id.data, n = p.length, i, v = q.v;
    if (v.pz > 0) { var bs = Math.round(w * v.pz * 0.0006); if (bs >= 2) pixelate(p, w, h, bs); }
    if (v.bl > 0) { var rb = Math.round(w * 0.0004 * v.bl); if (rb >= 1) { var b0 = boxBlur(p, w, h, rb); b0 = boxBlur(b0, w, h, rb); p.set(b0); } }
    var lo = v.lo, hi = v.hi, lv = (lo > 0 || hi < 255), lk = 255 / Math.max(1, hi - lo),
      ex = Math.pow(2, v.ex / 50), bri = v.br * 2.55,
      cc = v.co * 2.55, cf = (259 * (cc + 255)) / (255 * (259 - cc)),
      hl = v.hl * .6, sh = v.sh * .6, tp = v.tp * .5, ti = v.ti, sat = 1 + v.sa / 100, vib = v.vi / 100,
      doTone = (hl !== 0 || sh !== 0), r, g, b, y, t, mx, mn, s;
    for (i = 0; i < n; i += 4) {
      r = p[i]; g = p[i + 1]; b = p[i + 2];
      if (lv) { r = (r - lo) * lk; g = (g - lo) * lk; b = (b - lo) * lk; }
      if (ex !== 1) { r *= ex; g *= ex; b *= ex; }
      r += bri; g += bri; b += bri;
      if (cc !== 0) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128; }
      if (doTone) { y = (.299 * r + .587 * g + .114 * b) / 255; y = y < 0 ? 0 : y > 1 ? 1 : y; t = sh * (1 - y) * (1 - y) + hl * y * y; r += t; g += t; b += t; }
      if (tp !== 0 || ti !== 0) { r += tp + ti * .15; b += -tp + ti * .15; g -= ti * .4; }
      y = .299 * r + .587 * g + .114 * b;
      if (vib !== 0) { mx = Math.max(r, g, b); mn = Math.min(r, g, b); s = (mx - mn) / 255; t = 1 + vib * (1 - s); r = y + (r - y) * t; g = y + (g - y) * t; b = y + (b - y) * t; }
      if (sat !== 1) { r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat; }
      if (q.iv) { r = 255 - r; g = 255 - g; b = 255 - b; }
      if (q.gr) { y = .299 * r + .587 * g + .114 * b; r = g = b = y; }
      if (q.se) { var R = .393 * r + .769 * g + .189 * b, G = .349 * r + .686 * g + .168 * b, B = .272 * r + .534 * g + .131 * b; r = R; g = G; b = B; }
      p[i] = r < 0 ? 0 : r > 255 ? 255 : r; p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    if (v.sp > 0) {
      var rs = Math.max(1, Math.round(w * 0.0012)), bl = boxBlur(p, w, h, rs), am = v.sp / 100 * 1.6, d, k;
      for (i = 0; i < n; i += 4) for (k = 0; k < 3; k++) { d = p[i + k] + am * (p[i + k] - bl[i + k]); p[i + k] = d < 0 ? 0 : d > 255 ? 255 : d; }
    }
    if (v.vg > 0) {
      var cx = w / 2, cy = h / 2, f, nx, ny, dd, a = v.vg / 100, x, yy;
      for (yy = 0; yy < h; yy++) { ny = (yy - cy) / cy; for (x = 0; x < w; x++) {
        nx = (x - cx) / cx; dd = Math.sqrt(nx * nx + ny * ny) / 1.414; dd = Math.max(0, dd - .3) / .7; f = 1 - a * dd * dd * 1.15; if (f < 0) f = 0;
        i = (yy * w + x) * 4; p[i] *= f; p[i + 1] *= f; p[i + 2] *= f; } }
    }
    if (v.gn > 0) {
      var seed = 1234567, amp = v.gn * 1.1, nz;
      for (i = 0; i < n; i += 4) { seed = (seed * 1664525 + 1013904223) >>> 0; nz = ((seed >>> 8) / 16777216 - .5) * amp; p[i] += nz; p[i + 1] += nz; p[i + 2] += nz; }
    }
    return id;
  }
  var PRESETS = {
    none: {},
    vivid: { co: 18, sa: 28, vi: 25, sp: 15 },
    warm: { tp: 38, ti: 6, sa: 10, br: 4 },
    cool: { tp: -38, ti: -4, sa: 6 },
    vintage: { sa: -28, tp: 24, co: -12, br: 6, vg: 38, gn: 18 },
    fade: { co: -22, br: 12, sa: -22, sh: 25 },
    dramatic: { co: 38, sa: -12, sh: -18, hl: 22, vg: 28, sp: 20 },
    noir: { co: 32, vg: 32, gn: 12, _gr: 1 },
    sepia: { _se: 1, vg: 18 }
  };
  window.DTAfx = { process: process, autoLevels: autoLevels, PRESETS: PRESETS };
})();

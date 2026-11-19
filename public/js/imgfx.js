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

  /* ---- curves: monotone cubic through control points -> 256 LUT ---- */
  function lut(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0]; });
    var n = pts.length, x = [], y = [], d = [], m = [], i, out = new Uint8ClampedArray(256), k = 0, v, h, t, t2, t3, a, b, s2, tt;
    for (i = 0; i < n; i++) { x[i] = pts[i][0]; y[i] = pts[i][1]; }
    for (i = 0; i < n - 1; i++) d[i] = (y[i + 1] - y[i]) / Math.max(1e-6, x[i + 1] - x[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; } else {
        a = m[i] / d[i]; b = m[i + 1] / d[i]; s2 = a * a + b * b;
        if (s2 > 9) { tt = 3 / Math.sqrt(s2); m[i] = tt * a * d[i]; m[i + 1] = tt * b * d[i]; }
      }
    }
    for (v = 0; v < 256; v++) {
      while (k < n - 2 && v > x[k + 1]) k++;
      h = Math.max(1e-6, x[k + 1] - x[k]); t = (v - x[k]) / h; t2 = t * t; t3 = t2 * t;
      out[v] = Math.round((2 * t3 - 3 * t2 + 1) * y[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * y[k + 1] + (t3 - t2) * h * m[k + 1]);
    }
    return out;
  }
  function isId(pts) { return !pts || (pts.length === 2 && pts[0][0] === 0 && pts[0][1] === 0 && pts[1][0] === 255 && pts[1][1] === 255); }
  /* ---- colour mix: 8 hue bands, each hue / saturation / luminance ---- */
  var HC = [0, 30, 60, 120, 180, 240, 280, 320], HW = [30, 25, 35, 50, 40, 40, 40, 35], HR = 0, HG = 0, HB = 0;
  function hslPix(r, g, b, A) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510, dl = mx - mn, s = 0, h = 0, i, dd, w, dh = 0, ds = 0, dL = 0, c, X, m, r1, g1, b1;
    if (dl < 2) { HR = r; HG = g; HB = b; return; }
    s = l > .5 ? dl / (510 - mx - mn) : dl / (mx + mn);
    if (mx === r) h = ((g - b) / dl) % 6; else if (mx === g) h = (b - r) / dl + 2; else h = (r - g) / dl + 4;
    h *= 60; if (h < 0) h += 360;
    var gate = Math.min(1, s * 4);
    for (i = 0; i < 8; i++) {
      dd = Math.abs(h - HC[i]); if (dd > 180) dd = 360 - dd;
      w = 1 - dd / HW[i]; if (w <= 0) continue; w *= gate;
      dh += w * A[i][0] * .3; ds += w * A[i][1] / 100; dL += w * A[i][2] / 100;
    }
    h = (h + dh + 360) % 360; s = Math.max(0, Math.min(1, s * (1 + ds))); l = Math.max(0, Math.min(1, l + dL * .25 * (dL > 0 ? 1 - l : l)));
    c = (1 - Math.abs(2 * l - 1)) * s; X = c * (1 - Math.abs((h / 60) % 2 - 1)); m = l - c / 2;
    if (h < 60) { r1 = c; g1 = X; b1 = 0; } else if (h < 120) { r1 = X; g1 = c; b1 = 0; } else if (h < 180) { r1 = 0; g1 = c; b1 = X; }
    else if (h < 240) { r1 = 0; g1 = X; b1 = c; } else if (h < 300) { r1 = X; g1 = 0; b1 = c; } else { r1 = c; g1 = 0; b1 = X; }
    HR = (r1 + m) * 255; HG = (g1 + m) * 255; HB = (b1 + m) * 255;
  }
  /* ---- coordinate mapping: strokes are stored 0..1 of the whole photo ---- */
  function mapper(q, w, h) {
    var m = q.map || { x: 0, y: 0, w: 1, h: 1, W: w, H: h };
    return { X: function (n) { return (n - m.x) / m.w * w; }, Y: function (n) { return (n - m.y) / m.h * h; }, R: function (n) { return n * Math.min(m.W, m.H) * w / (m.w * m.W); } };
  }
  function region(p, w, x0, y0, bw, bh) {
    var o = new Uint8ClampedArray(bw * bh * 4), y, x, si, di = 0;
    for (y = 0; y < bh; y++) { si = ((y0 + y) * w + x0) * 4; for (x = 0; x < bw * 4; x++) o[di++] = p[si + x]; }
    return o;
  }
  /* ---- retouch brush: smooth, heal, lighten, darken, colour, sharpen ---- */
  function retouch(id, q) {
    var w = id.width, h = id.height, p = id.data, M = mapper(q, w, h), si, st, pts, r, a, k, i, j, x, y;
    for (si = 0; si < q.rt.length; si++) {
      st = q.rt[si]; pts = st.p; if (!pts.length) continue;
      r = Math.max(2, M.R(st.s)); a = st.a / 100;
      var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, P = [];
      for (k = 0; k < pts.length; k++) { var px = M.X(pts[k][0]), py = M.Y(pts[k][1]); P.push([px, py]); minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); }
      var x0 = Math.max(0, Math.floor(minx - r - 1)), y0 = Math.max(0, Math.floor(miny - r - 1)), x1 = Math.min(w, Math.ceil(maxx + r + 1)), y1 = Math.min(h, Math.ceil(maxy + r + 1)), bw = x1 - x0, bh = y1 - y0;
      if (bw < 2 || bh < 2) continue;
      var mk = new Float32Array(bw * bh), step = Math.max(1, r / 3), seg, n, t, cx, cy, ex, ey, dd, v, X0, X1, Y0, Y1;
      for (k = 0; k < P.length; k++) {
        var A = P[Math.max(0, k - 1)], B = P[k], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        n = k === 0 ? 1 : Math.max(1, Math.ceil(len / step));
        for (seg = 1; seg <= n; seg++) {
          t = k === 0 ? 1 : seg / n; cx = A[0] + (B[0] - A[0]) * t - x0; cy = A[1] + (B[1] - A[1]) * t - y0;
          X0 = Math.max(0, Math.floor(cx - r)); X1 = Math.min(bw - 1, Math.ceil(cx + r)); Y0 = Math.max(0, Math.floor(cy - r)); Y1 = Math.min(bh - 1, Math.ceil(cy + r));
          for (y = Y0; y <= Y1; y++) for (x = X0; x <= X1; x++) {
            ex = x - cx; ey = y - cy; dd = Math.sqrt(ex * ex + ey * ey) / r; if (dd >= 1) continue;
            v = 1 - dd; v = v * v * (3 - 2 * v); i = y * bw + x; if (v > mk[i]) mk[i] = v;
          }
        }
      }
      var src = region(p, w, x0, y0, bw, bh), bl = null, md = st.m;
      if (md === "sm") { bl = boxBlur(boxBlur(src, bw, bh, Math.max(1, Math.round(r * .3))), bw, bh, Math.max(1, Math.round(r * .3))); }
      else if (md === "hl") { bl = boxBlur(boxBlur(boxBlur(src, bw, bh, Math.max(2, Math.round(r * .55))), bw, bh, Math.max(2, Math.round(r * .55))), bw, bh, Math.max(1, Math.round(r * .3))); }
      else if (md === "sp") { bl = boxBlur(src, bw, bh, Math.max(1, Math.round(r * .12))); }
      var wg, c, lum2, o, ch;
      for (y = 0; y < bh; y++) for (x = 0; x < bw; x++) {
        wg = mk[y * bw + x]; if (wg <= 0) continue; wg *= a; i = (y * bw + x) * 4; j = ((y0 + y) * w + x0 + x) * 4;
        if (md === "sm") { for (ch = 0; ch < 3; ch++) p[j + ch] = p[j + ch] + (bl[i + ch] - p[j + ch]) * wg; }
        else if (md === "hl") { var hw = Math.min(1, wg * 1.6); for (ch = 0; ch < 3; ch++) p[j + ch] = p[j + ch] + (bl[i + ch] - p[j + ch]) * hw; }
        else if (md === "dg") { for (ch = 0; ch < 3; ch++) p[j + ch] = Math.min(255, p[j + ch] * (1 + .7 * wg) + 22 * wg); }
        else if (md === "bn") { for (ch = 0; ch < 3; ch++) p[j + ch] = p[j + ch] * (1 - .6 * wg); }
        else if (md === "sa" || md === "ds") {
          lum2 = .299 * p[j] + .587 * p[j + 1] + .114 * p[j + 2]; o = md === "sa" ? 1 + 1.3 * wg : 1 - wg;
          for (ch = 0; ch < 3; ch++) { c = lum2 + (p[j + ch] - lum2) * o; p[j + ch] = c < 0 ? 0 : c > 255 ? 255 : c; }
        }
        else if (md === "sp") { for (ch = 0; ch < 3; ch++) { c = p[j + ch] + (p[j + ch] - bl[i + ch]) * wg * 2.2; p[j + ch] = c < 0 ? 0 : c > 255 ? 255 : c; } }
      }
    }
  }
  /* ---- focus blur: round or band, like a lens / tilt-shift ---- */
  function focusBlur(id, q) {
    var f = q.fb, w = id.width, h = id.height, p = id.data, M = mapper(q, w, h), rb = Math.max(1, Math.round(w * 0.0009 * f.am));
    var bl = boxBlur(boxBlur(boxBlur(p, w, h, rb), w, h, rb), w, h, rb), cx = M.X(f.x), cy = M.Y(f.y), R = Math.max(4, M.R(f.r)), x, y, i, d, t, ang = (f.an || 0) * Math.PI / 180, sn = Math.sin(ang), cs = Math.cos(ang), ex, ey, ch;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      ex = x - cx; ey = y - cy;
      d = f.t === "r" ? Math.sqrt(ex * ex + ey * ey) : Math.abs(-ex * sn + ey * cs);
      t = (d / R - 1) / .9; if (t <= 0) continue; if (t > 1) t = 1; t = t * t * (3 - 2 * t);
      i = (y * w + x) * 4; for (ch = 0; ch < 3; ch++) p[i + ch] += (bl[i + ch] - p[i + ch]) * t;
    }
  }
  /* ---- cut-out: remove a background colour (from the edges, or everywhere) ---- */
  function cutout(id, rb) {
    var w = id.width, h = id.height, p = id.data, N = w * h, c = rb.c, T2 = Math.pow(rb.tol * 4.42, 2), x, y, i, j, seen = new Uint8Array(N), stack = new Int32Array(N), sp = 0, any = false;
    function ok(k) { var q4 = k * 4, dr = p[q4] - c[0], dg = p[q4 + 1] - c[1], db = p[q4 + 2] - c[2]; return dr * dr + dg * dg + db * db <= T2; }
    if (rb.all) { for (i = 0; i < N; i++) if (ok(i)) { seen[i] = 1; any = true; } }
    else {
      function push(k) { if (!seen[k] && ok(k)) { seen[k] = 1; stack[sp++] = k; } }
      for (x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
      for (y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
      while (sp) {
        i = stack[--sp]; x = i % w; any = true;
        if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < N - w) push(i + w);
      }
      any = true;
    }
    if (!any) return;
    var fr = Math.round(rb.so / 100 * Math.max(w, h) * 0.004);
    if (fr >= 1) {
      var m = new Uint8ClampedArray(N * 4);
      for (i = 0; i < N; i++) m[i * 4] = seen[i] ? 255 : 0;
      m = boxBlur(boxBlur(m, w, h, fr), w, h, fr);
      for (i = 0; i < N; i++) { j = i * 4 + 3; p[j] = p[j] * (1 - m[i * 4] / 255); }
    } else { for (i = 0; i < N; i++) if (seen[i]) p[i * 4 + 3] = 0; }
  }
  function process(id, q) {
    var w = id.width, h = id.height, p = id.data, n = p.length, i, v = q.v;
    if (v.pz > 0) { var bs = Math.round(w * v.pz * 0.0006); if (bs >= 2) pixelate(p, w, h, bs); }
    if (v.bl > 0) { var rb = Math.round(w * 0.0004 * v.bl); if (rb >= 1) { var b0 = boxBlur(p, w, h, rb); b0 = boxBlur(b0, w, h, rb); p.set(b0); } }
    var lo = v.lo, hi = v.hi, lv = (lo > 0 || hi < 255), lk = 255 / Math.max(1, hi - lo),
      ex = Math.pow(2, v.ex / 50), bri = v.br * 2.55,
      cc = v.co * 2.55, cf = (259 * (cc + 255)) / (255 * (259 - cc)),
      hl = v.hl * .6, sh = v.sh * .6, tp = v.tp * .5, ti = v.ti, sat = 1 + v.sa / 100, vib = v.vi / 100,
      doTone = (hl !== 0 || sh !== 0), r, g, b, y, t, mx, mn, s,
      hsOn = !!(q.hs && q.hs.some(function (a) { return a[0] || a[1] || a[2]; })), cvOn = false, lm, lr, lg, lb2;
    if (q.cv && !(isId(q.cv.m) && isId(q.cv.r) && isId(q.cv.g) && isId(q.cv.b))) {
      cvOn = true; lm = lut(q.cv.m); lr = lut(q.cv.r); lg = lut(q.cv.g); lb2 = lut(q.cv.b);
      for (i = 0; i < 256; i++) { lr[i] = lr[lm[i]]; lg[i] = lg[lm[i]]; lb2[i] = lb2[lm[i]]; }
    }
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
      if (hsOn) { r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b; hslPix(r, g, b, q.hs); r = HR; g = HG; b = HB; }
      if (q.iv) { r = 255 - r; g = 255 - g; b = 255 - b; }
      if (q.gr) { y = .299 * r + .587 * g + .114 * b; r = g = b = y; }
      if (q.se) { var R = .393 * r + .769 * g + .189 * b, G = .349 * r + .686 * g + .168 * b, B = .272 * r + .534 * g + .131 * b; r = R; g = G; b = B; }
      if (cvOn) { r = lr[(r < 0 ? 0 : r > 255 ? 255 : r) + .5 | 0]; g = lg[(g < 0 ? 0 : g > 255 ? 255 : g) + .5 | 0]; b = lb2[(b < 0 ? 0 : b > 255 ? 255 : b) + .5 | 0]; }
      p[i] = r < 0 ? 0 : r > 255 ? 255 : r; p[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; p[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    if (v.sp > 0) {
      var rs = Math.max(1, Math.round(w * 0.0012)), bl = boxBlur(p, w, h, rs), am = v.sp / 100 * 1.6, d, k;
      for (i = 0; i < n; i += 4) for (k = 0; k < 3; k++) { d = p[i + k] + am * (p[i + k] - bl[i + k]); p[i + k] = d < 0 ? 0 : d > 255 ? 255 : d; }
    }
    if (v.cl) {
      var rc = Math.max(2, Math.round(w * 0.012)), bc = boxBlur(boxBlur(p, w, h, rc), w, h, rc), kc = v.cl / 100 * (v.cl > 0 ? 1.1 : .8), dc, kk;
      for (i = 0; i < n; i += 4) for (kk = 0; kk < 3; kk++) { dc = p[i + kk] + kc * (p[i + kk] - bc[i + kk]); p[i + kk] = dc < 0 ? 0 : dc > 255 ? 255 : dc; }
    }
    if (q.fb && q.fb.t !== "off") focusBlur(id, q);
    if (q.rt && q.rt.length) retouch(id, q);
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
  window.DTAfx = { process: process, autoLevels: autoLevels, PRESETS: PRESETS, lut: lut, isId: isId, cutout: cutout };
})();

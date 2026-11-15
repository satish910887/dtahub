/* DTAhub original minimal PDF writer: builds a multi-page PDF from JPEG images. No external library. */
(function () {
  var enc = function (s) { return new TextEncoder().encode(s); };
  var SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
  window.DTApdf = {
    /* pages: [{jpeg:Uint8Array, w:px, h:px}], opt.size: "a4" | "letter" | "fit" */
    build: function (pages, opt) {
      opt = opt || {};
      var chunks = [], offs = [], len = 0, n = pages.length;
      function push(x) { var b = typeof x === "string" ? enc(x) : x; chunks.push(b); len += b.length; }
      function obj(i, body) { offs[i] = len; push(i + " 0 obj\n"); body(); push("\nendobj\n"); }
      push("%PDF-1.4\n%âãÏÓ\n");
      obj(1, function () { push("<< /Type /Catalog /Pages 2 0 R >>"); });
      var kids = pages.map(function (_, i) { return (3 + 3 * i) + " 0 R"; }).join(" ");
      obj(2, function () { push("<< /Type /Pages /Kids [" + kids + "] /Count " + n + " >>"); });
      pages.forEach(function (p, i) {
        var pg = 3 + 3 * i, ct = pg + 1, im = pg + 2, W, H, w, h, x, y, k;
        if (opt.size === "a4" || opt.size === "letter") {
          var s = SIZES[opt.size]; W = s[0]; H = s[1];
          if (p.w > p.h * 1.15) { var t = W; W = H; H = t; }
          k = Math.min(W / p.w, H / p.h); w = p.w * k; h = p.h * k; x = (W - w) / 2; y = (H - h) / 2;
        } else { W = p.w * 72 / 150; H = p.h * 72 / 150; w = W; h = H; x = 0; y = 0; }
        var f = function (v) { return v.toFixed(2); };
        obj(pg, function () { push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + f(W) + " " + f(H) + "] /Resources << /XObject << /Im0 " + im + " 0 R >> >> /Contents " + ct + " 0 R >>"); });
        var stream = "q " + f(w) + " 0 0 " + f(h) + " " + f(x) + " " + f(y) + " cm /Im0 Do Q";
        obj(ct, function () { push("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream"); });
        obj(im, function () {
          push("<< /Type /XObject /Subtype /Image /Width " + p.w + " /Height " + p.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n");
          push(p.jpeg); push("\nendstream");
        });
      });
      var total = 3 + 3 * n, xref = len, x2 = "xref\n0 " + total + "\n0000000000 65535 f \n";
      for (var i = 1; i < total; i++) x2 += ("0000000000" + offs[i]).slice(-10) + " 00000 n \n";
      push(x2 + "trailer\n<< /Size " + total + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
      return new Blob(chunks, { type: "application/pdf" });
    }
  };
})();

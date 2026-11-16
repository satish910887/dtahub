/* DTAhub original ZIP writer (store method, no compression). Used for "download all" in image and PDF tools. */
(function () {
  var T = null;
  function crc(u8) {
    if (!T) { T = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } }
    var r = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) r = T[(r ^ u8[i]) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0;
  }
  function dosTime(d) { return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()]; }
  /* files: [{name:"a.jpg", data:Uint8Array}] -> Blob (application/zip). Duplicate names get " (2)" etc. */
  window.DTAzip = {
    crc32: crc,
    build: function (files) {
      var enc = new TextEncoder(), parts = [], central = [], off = 0, used = {}, dt = dosTime(new Date());
      files.forEach(function (f) {
        var name = f.name || "file", base = name, n = 1;
        while (used[name]) { n++; var i = base.lastIndexOf("."); name = i > 0 ? base.slice(0, i) + " (" + n + ")" + base.slice(i) : base + " (" + n + ")"; }
        used[name] = 1;
        var nb = enc.encode(name), d = f.data, c = crc(d), h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt[0], true); h.setUint16(12, dt[1], true);
        h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
        parts.push(new Uint8Array(h.buffer), nb, d);
        var z = new DataView(new ArrayBuffer(46));
        z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint16(10, 0, true); z.setUint16(12, dt[0], true); z.setUint16(14, dt[1], true);
        z.setUint32(16, c, true); z.setUint32(20, d.length, true); z.setUint32(24, d.length, true); z.setUint16(28, nb.length, true); z.setUint32(42, off, true);
        central.push(new Uint8Array(z.buffer), nb);
        off += 30 + nb.length + d.length;
      });
      var cs = 0; central.forEach(function (c) { cs += c.length; });
      var e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
      return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/zip" });
    }
  };
})();

/* DTAhub original WebGL hero crystal: a low-poly gem with glass-like faces, rim light and glowing edges.
   Plain WebGL, no library. Pauses off-screen, stays still with motion off / reduced motion, hides if WebGL is missing. */
(function () {
  /* floating glass tiles with parallax (decorative) */
  (function () {
    var host = document.getElementById("gts"), D = window.DTA; if (!host || !D || !D.CATS) return;
    var spec = [["pdf", 7, 20, 74, -14, 10, 7, 6.5], ["image", 80, 12, 64, 12, -12, 5, 7.5], ["calc", 88, 54, 80, 16, 8, 9, 8.5], ["dev", 4, 60, 66, -10, -8, 6, 7], ["text", 24, 74, 54, 8, 14, 3, 9], ["seo", 68, 76, 58, -12, -10, 4, 6]];
    spec.forEach(function (c, i) {
      var cat = D.cat(c[0]); if (!cat) return;
      var t = document.createElement("span"); t.className = "gt"; t.style.cssText = "--x:" + c[1] + "%;--y:" + c[2] + "%;--s:" + c[3] + "px;--ry:" + c[4] + "deg;--rx:" + c[5] + "deg;--k:" + c[6] + ";--t:" + c[7] + "s;--dl:-" + (i * 1.3) + "s";
      t.innerHTML = D.icon(cat.icon, Math.round(c[3] * .46)); host.appendChild(t);
    });
    var hw = host.parentNode, pend = 0, ev = null;
    if (window.matchMedia && matchMedia("(hover:hover)").matches) hw.addEventListener("pointermove", function (e) {
      ev = e; if (pend) return; pend = requestAnimationFrame(function () { pend = 0; var r = hw.getBoundingClientRect(); hw.style.setProperty("--mx", ((ev.clientX - r.left) / r.width - .5).toFixed(3)); hw.style.setProperty("--my", ((ev.clientY - r.top) / r.height - .5).toFixed(3)); });
    }, { passive: true });
  })();
  function crystal() {
  var cv = document.getElementById("gem"); if (!cv) return;
  if (navigator.connection && navigator.connection.saveData) { cv.remove(); return; }
  var gl; try { gl = cv.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) {}
  if (!gl) { cv.remove(); return; }
  var root = document.documentElement, mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  /* ---- geometry: stretched icosahedron, flat shaded ---- */
  var t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(function (v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l * 1.28, v[2] / l]; });
  var F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  var tri = [], edges = [], seen = {};
  F.forEach(function (f) {
    var a = V[f[0]], b = V[f[1]], c = V[f[2]], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    var n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
    [a, b, c].forEach(function (p) { tri.push(p[0], p[1], p[2], n[0], n[1], n[2]); });
    [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (e) { var k = Math.min(e[0], e[1]) + "-" + Math.max(e[0], e[1]); if (!seen[k]) { seen[k] = 1; edges.push.apply(edges, V[e[0]].concat(V[e[1]])); } });
  });
  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
  function prog(vs, fs) { var p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs); if (!a || !b) return null; gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; }
  var VS = "attribute vec3 aP;attribute vec3 aN;uniform mat3 uR;uniform float uA;varying vec3 vN;" +
    "void main(){vec3 p=uR*aP;vN=uR*aN;float w=3.2-p.z;gl_Position=vec4(p.x*.82/uA,p.y*.82,-p.z*.3,w*.42);}";
  var FS = "precision mediump float;varying vec3 vN;uniform vec3 uC1;uniform vec3 uC2;uniform float uBack;" +
    "void main(){vec3 n=normalize(vN);if(uBack>.5)n=-n;vec3 L=normalize(vec3(-.5,.8,.7));float d=max(dot(n,L),0.);" +
    "float f=pow(1.-abs(n.z),2.4);vec3 base=mix(uC2,uC1,clamp(n.y*.5+.5+d*.25,0.,1.));" +
    "vec3 col=base*(.22+.9*d)+uC1*f*.7+vec3(.9)*pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),24.)*.5;" +
    "float a=(uBack>.5?.22:.5)+f*.4;gl_FragColor=vec4(col*a,a);}";
  var VE = "attribute vec3 aP;uniform mat3 uR;uniform float uA;void main(){vec3 p=uR*aP;float w=3.2-p.z;gl_Position=vec4(p.x*.82/uA,p.y*.82,-p.z*.3+.001,w*.42);}";
  var FE = "precision mediump float;uniform vec3 uC1;void main(){gl_FragColor=vec4(uC1*.85,.85);}";
  var P1 = prog(VS, FS), P2 = prog(VE, FE); if (!P1 || !P2) { cv.remove(); return; }
  var bt = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bt); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri), gl.STATIC_DRAW);
  var be = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, be); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edges), gl.STATIC_DRAW);
  var L1 = { aP: gl.getAttribLocation(P1, "aP"), aN: gl.getAttribLocation(P1, "aN"), uR: gl.getUniformLocation(P1, "uR"), uA: gl.getUniformLocation(P1, "uA"), uC1: gl.getUniformLocation(P1, "uC1"), uC2: gl.getUniformLocation(P1, "uC2"), uBack: gl.getUniformLocation(P1, "uBack") };
  var L2 = { aP: gl.getAttribLocation(P2, "aP"), uR: gl.getUniformLocation(P2, "uR"), uA: gl.getUniformLocation(P2, "uA"), uC1: gl.getUniformLocation(P2, "uC1") };
  var c1 = [.95, .79, .41], c2 = [.55, .42, .96];
  function colors() { var s = getComputedStyle(root), f = function (n, d) { var v = s.getPropertyValue(n).trim().split(/\s+/).map(Number); return v.length === 3 && !v.some(isNaN) ? v.map(function (x) { return x / 255; }) : d; }; c1 = f("--a1r", c1); c2 = f("--a2r", c2); }
  var rx = -.35, ry = 0, tx = 0, ty = 0, raf = 0, vis = false, t0 = performance.now(), last = 0;
  function mat(ax, ay) { var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    /* Ry * Rx, column-major */ return new Float32Array([cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy]); }
  function size() { var dpr = Math.min(1.5, window.devicePixelRatio || 1), w = Math.max(2, Math.round(cv.clientWidth * dpr)), h = Math.max(2, Math.round(cv.clientHeight * dpr)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } gl.viewport(0, 0, w, h); }
  function draw(time) {
    size(); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var spin = motionOn() ? time * .00028 : .6;
    rx += (-.3 + ty * .5 - rx) * .06; ry += (spin + tx * .7 - ry) * (motionOn() ? 1 : .06); if (motionOn()) ry = spin + tx * .7;
    var R = mat(rx, ry), a = cv.width / cv.height;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.CULL_FACE);
    gl.useProgram(P1); gl.bindBuffer(gl.ARRAY_BUFFER, bt);
    gl.enableVertexAttribArray(L1.aP); gl.vertexAttribPointer(L1.aP, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(L1.aN); gl.vertexAttribPointer(L1.aN, 3, gl.FLOAT, false, 24, 12);
    gl.uniformMatrix3fv(L1.uR, false, R); gl.uniform1f(L1.uA, a); gl.uniform3fv(L1.uC1, c1); gl.uniform3fv(L1.uC2, c2);
    gl.cullFace(gl.FRONT); gl.uniform1f(L1.uBack, 1); gl.drawArrays(gl.TRIANGLES, 0, tri.length / 6);
    gl.cullFace(gl.BACK); gl.uniform1f(L1.uBack, 0); gl.drawArrays(gl.TRIANGLES, 0, tri.length / 6);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(P2); gl.bindBuffer(gl.ARRAY_BUFFER, be); gl.disableVertexAttribArray(L1.aN);
    gl.enableVertexAttribArray(L2.aP); gl.vertexAttribPointer(L2.aP, 3, gl.FLOAT, false, 12, 0);
    gl.uniformMatrix3fv(L2.uR, false, R); gl.uniform1f(L2.uA, a); gl.uniform3fv(L2.uC1, c1);
    gl.drawArrays(gl.LINES, 0, edges.length / 3);
  }
  function motionOn() { return root.getAttribute("data-motion") !== "off" && !mq.matches; }
  function frame(now) { raf = requestAnimationFrame(frame); if (now - last < 33) return; last = now; draw(now - t0); }
  function sync() { colors(); if (vis && motionOn()) { if (!raf) raf = requestAnimationFrame(frame); } else { if (raf) cancelAnimationFrame(raf); raf = 0; if (vis) draw(0); } }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; sync(); }).observe(cv); else { vis = true; sync(); }
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-motion", "data-accent", "data-theme"] });
  if (mq.addEventListener) mq.addEventListener("change", sync);
  window.addEventListener("resize", function () { if (vis && !raf) draw(0); }, { passive: true });
  var wrap = cv.parentNode;
  if (window.matchMedia && matchMedia("(hover:hover)").matches) wrap.addEventListener("pointermove", function (e) { var r = wrap.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - .5) * 1.2; ty = ((e.clientY - r.top) / r.height - .5) * 1.2; }, { passive: true });
  var drag = null;
  cv.style.touchAction = "pan-y";
  cv.addEventListener("webglcontextlost", function (e) { e.preventDefault(); cv.style.display = "none"; });
  }
  /* start only after load, when the browser is idle and the visitor interacts (or after 4 s), so it never delays first paint or input */
  var started = 0;
  function go() { if (started) return; started = 1; ["pointermove", "touchstart", "scroll", "keydown"].forEach(function (n) { removeEventListener(n, go); }); var run = function () { crystal(); var c = document.getElementById("gem"); if (c) requestAnimationFrame(function () { c.classList.add("on"); }); }; if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1500 }); else setTimeout(run, 300); }
  function arm() { ["pointermove", "touchstart", "scroll", "keydown"].forEach(function (n) { addEventListener(n, go, { passive: true, once: true }); }); setTimeout(go, 4000); }
  if (document.readyState === "complete") arm(); else addEventListener("load", arm);
})();

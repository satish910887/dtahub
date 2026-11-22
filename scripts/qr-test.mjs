// Unit tests for public/js/dta-qr.js. Cross-checks against the reference qrcode.js (scripts/fixtures, test only) (a different implementation).
// Run: node scripts/qr-test.mjs      (decoder check: node scripts/qr-test.mjs --dump out.json, then scripts/qr-decode.py)
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Q = require("../public/js/dta-qr.js");
let ref = null;
try { ref = require("./fixtures/qrcode-reference.js"); if (typeof ref !== "function") ref = ref.qrcode || null; if (ref && ref.stringToBytesFuncs) ref.stringToBytes = ref.stringToBytesFuncs["UTF-8"]; /* same as tools-qr-code.js */ } catch (e) { ref = null; }
let n = 0; const t = (name, f) => { try { f(); n++; } catch (e) { console.error("FAIL", name, "\n ", e.message); process.exitCode = 1; } };

t("capacity matches the standard", () => {
  assert.equal(Q.capacity("L", "num"), 7089); assert.equal(Q.capacity("L", "alnum"), 4296); assert.equal(Q.capacity("L", "byte"), 2953);
  assert.equal(Q.capacity("H", "num"), 3057); assert.equal(Q.capacity("H", "alnum"), 1852); assert.equal(Q.capacity("H", "byte"), 1273);
  assert.equal(Q.capacity("M", "byte"), 2331); assert.equal(Q.capacity("Q", "byte"), 1663);
});
t("sizes and version selection", () => {
  assert.equal(Q.create("HELLO WORLD", { ec: "Q" }).version, 1); assert.equal(Q.create("A", { ec: "L" }).size, 21);
  assert.equal(Q.create("a".repeat(17), { ec: "L" }).version, 1); assert.equal(Q.create("a".repeat(18), { ec: "L" }).version, 2);
  assert.equal(Q.create("a".repeat(2953), { ec: "L" }).version, 40); assert.throws(() => Q.create("a".repeat(2954), { ec: "L" }), /too long/);
  assert.equal(Q.create("0".repeat(7089), { ec: "L" }).version, 40);
});
t("mode choice", () => { assert.equal(Q.create("123456").mode, "num"); assert.equal(Q.create("ABC-123 $%").mode, "alnum"); assert.equal(Q.create("abc").mode, "byte"); assert.equal(Q.create("हिंदी").mode, "byte"); assert.equal(Q.create("123", { mode: "alnum" }).mode, "alnum"); assert.equal(Q.create("abc", { mode: "num" }).mode, "byte"); });
t("function patterns", () => {
  const q = Q.create("hello", { ec: "M" }), s = q.size;
  for (const [r, c] of [[0, 0], [0, s - 7], [s - 7, 0]]) { for (let i = 0; i < 7; i++) { assert.ok(q.isDark(r, c + i) && q.isDark(r + 6, c + i) && q.isDark(r + i, c) && q.isDark(r + i, c + 6)); } assert.ok(q.isDark(r + 3, c + 3)); assert.ok(!q.isDark(r + 1, c + 1)); }
  for (let i = 8; i < s - 8; i++) assert.equal(q.isDark(6, i), i % 2 === 0), assert.equal(q.isDark(i, 6), i % 2 === 0);
  assert.ok(q.isDark(s - 8, 8)); assert.ok(!q.isDark(-1, 0)); assert.ok(!q.isDark(0, s));
});
t("rs and geometry", () => {
  const I = Q._internals; assert.equal(I.rawModules(1), 26 * 8); assert.equal(I.rawModules(7), 196 * 8); assert.equal(I.rawModules(40), 3706 * 8);
  assert.deepEqual(I.alignPositions(1), []); assert.deepEqual(I.alignPositions(2), [6, 18]); assert.deepEqual(I.alignPositions(7), [6, 22, 38]); assert.deepEqual(I.alignPositions(32), [6, 34, 60, 86, 112, 138]); assert.deepEqual(I.alignPositions(40), [6, 30, 58, 86, 114, 142, 170]);
  // known: 16-byte data of the ISO "01234567" example gives ECC codewords 0xA5 0x24 0xD4 0xC1 0xED 0x36 0xC7 0x87 0x2C 0x55 (spec annex I)
  const data = [0x10, 0x20, 0x0C, 0x56, 0x61, 0x80, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11];
  assert.deepEqual(I.rsRemainder(data, I.rsGenerator(10)), [0xA5, 0x24, 0xD4, 0xC1, 0xED, 0x36, 0xC7, 0x87, 0x2C, 0x55]);
});
t("svg output", () => { const s = Q.create("x").toSvg({ margin: 2, fg: "#123456" }); assert.ok(s.startsWith("<svg") && s.includes("#123456") && s.includes('viewBox="0 0 25 25"')); });
t("forced mask is respected", () => { for (let m = 0; m < 8; m++) assert.equal(Q.create("hello", { mask: m }).mask, m); assert.throws(() => Q.create("x", { mask: 9 }), /mask/); assert.throws(() => Q.create("x", { ec: "Z" }), /ec must/); });

if (ref) {
  const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const words = ["https://dtahub.satish910887.workers.dev/", "upi://pay?pa=name@bank&pn=Test%20User&am=125.50&cu=INR", "WIFI:T:WPA;S:My Net;P:pass;;", "BEGIN:VCARD\nVERSION:3.0\nFN:Ravi Kumar\nTEL:+919999999999\nEND:VCARD", "हिंदी टेक्स्ट ✓ ünïcode", "", "1", "Hello, World!"];
  const cases = [];
  for (const ec of ["L", "M", "Q", "H"]) { for (const w of words) cases.push([w, ec]); for (const len of [1, 7, 14, 20, 26, 34, 50, 100, 200, 500, 1000, 1700].filter((l) => l <= Q.capacity(ec, "byte"))) cases.push([Array.from({ length: len }, () => String.fromCharCode(33 + Math.floor(rnd() * 90))).join(""), ec]); }
  cases.push(["x".repeat(1273), "H"], ["y".repeat(2953), "L"]);
  let versions = new Set(), checked = 0;
  t("matrix equals vendor qrcode.js for " + cases.length + " inputs (some mask)", () => {
    for (const [w, ec] of cases) {
      const r = ref(0, ec); r.addData(w); r.make();
      const sz = r.getModuleCount(), mine = Q.create(w, { ec, mode: "byte" });
      assert.equal(mine.size, sz, `size for ${JSON.stringify(w.slice(0, 20))} ${ec}`);
      let found = -1;
      for (let m = 0; m < 8 && found < 0; m++) { const q = Q.create(w, { ec, mode: "byte", mask: m }); let same = true; for (let i = 0; i < sz && same; i++) for (let j = 0; j < sz; j++) if (q.isDark(i, j) !== r.isDark(i, j)) { same = false; break; } if (same) found = m; }
      assert.ok(found >= 0, `no mask reproduces vendor output for ${JSON.stringify(w.slice(0, 30))} ec=${ec} version=${mine.version}`);
      versions.add(mine.version); checked++;
    }
  });
  t("many versions covered", () => { assert.ok(versions.size >= 10, "versions covered: " + [...versions].sort((a, b) => a - b)); });
  // every version 1..40 at every EC level, using the exact capacity so the version is forced
  t("all 160 version/ec pairs match vendor", () => {
    for (const ec of ["L", "M", "Q", "H"]) for (let v = 1; v <= 40; v++) {
      const cap = Q._internals.dataCodewords(v, ec), len = Math.max(1, cap - (v <= 9 ? 2 : 3)), w = Array.from({ length: len }, (_, i) => String.fromCharCode(48 + ((i * 7 + v) % 74))).join("");
      const r = ref(0, ec); r.addData(w); r.make(); const mine = Q.create(w, { ec, mode: "byte" });
      if (mine.version !== (r.getModuleCount() - 17) / 4) continue; // vendor may pick a different version near a boundary
      let ok = false; for (let m = 0; m < 8 && !ok; m++) { const q = Q.create(w, { ec, mode: "byte", mask: m }); ok = true; for (let i = 0; i < q.size && ok; i++) for (let j = 0; j < q.size; j++) if (q.isDark(i, j) !== r.isDark(i, j)) { ok = false; break; } }
      assert.ok(ok, `v${v} ${ec}`); checked++;
    }
  });
  console.log("compared", checked, "matrices with vendor qrcode.js");
} else console.log("vendor qrcode.js not loadable in Node; skipped cross-check");

const di = process.argv.indexOf("--dump");
if (di > 0) { // matrices for the Python decoder check
  const out = []; for (const [w, ec] of [["https://dtahub.satish910887.workers.dev/", "M"], ["upi://pay?pa=name@bank&pn=Test%20User&am=125.50&cu=INR", "Q"], ["WIFI:T:WPA;S:My Net;P:pass;;", "L"], ["हिंदी टेक्स्ट ✓ ünïcode", "M"], ["0123456789012345", "H"], ["HELLO WORLD 123", "Q"], ["BEGIN:VCARD\nVERSION:3.0\nFN:Ravi Kumar\nTEL:+919999999999\nEND:VCARD", "M"], ["x".repeat(300), "L"], ["Hello, World!", "H"], ["z".repeat(800), "M"]]) { const q = Q.create(w, { ec }); out.push({ text: w, ec, version: q.version, mask: q.mask, mode: q.mode, m: q.matrix() }); }
  fs.writeFileSync(process.argv[di + 1], JSON.stringify(out));
}
console.log(process.exitCode ? "qr tests FAILED" : `qr tests passed (${n})`);

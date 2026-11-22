// Unit tests for public/js/dta-core.js (pure modules). Run: node scripts/core-test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../public/js/dta-core.js");
let n = 0; const t = (name, f) => { try { f(); n++; } catch (e) { console.error("FAIL", name, "\n ", e.message); process.exitCode = 1; } };
const eq = assert.deepEqual;

t("str.esc", () => { assert.equal(C.str.esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"); assert.equal(C.str.esc(null), ""); });
t("str.slug", () => { assert.equal(C.str.slug("  Merge PDF Files! "), "merge-pdf-files"); assert.equal(C.str.slug("हिंदी टूल"), "हिंदी-टूल"); });
t("str.truncate", () => { assert.equal(C.str.truncate("abcdef", 4), "abc…"); assert.equal(C.str.truncate("abc", 4), "abc"); assert.equal(C.str.truncate("हिन्दी", 3, "..").length > 0, true); });
t("str.pad/isBlank", () => { assert.equal(C.str.pad(7, 3), "007"); assert.equal(C.str.isBlank("  "), true); assert.equal(C.str.isBlank("0"), false); });
t("str.graphemes", () => { assert.equal(C.str.graphemes("abc"), 3); const g = C.str.graphemes("नमस्ते"); assert.ok(g === 3 || g === 4, "got " + g); /* 3 on Unicode 15.1+ (conjunct clusters), 4 on older ICU */ assert.ok(g < Array.from("नमस्ते").length); });

t("num.parse", () => { assert.equal(C.num.parse("1,234.5"), 1234.5); assert.ok(isNaN(C.num.parse(""))); assert.ok(isNaN(C.num.parse("abc"))); assert.ok(isNaN(C.num.parse(null))); assert.ok(isNaN(C.num.parse(Infinity))); assert.equal(C.num.parse(" -2e3 "), -2000); assert.equal(C.num.parse(".5"), .5); });
t("num.fmtIN", () => { assert.equal(C.num.fmtIN(1234567.891), "12,34,567.89"); assert.equal(C.num.fmtIN(1000), "1,000"); assert.equal(C.num.fmtIN(NaN), ""); assert.equal(C.num.inr(1500000), "₹ 15,00,000"); });
t("num.compact", () => { assert.equal(C.num.compact(1250000), "12.5 L"); assert.equal(C.num.compact(25000000), "2.5 Cr"); assert.equal(C.num.compact(1500), "1.5 K"); assert.equal(C.num.compact(-250000), "-2.5 L"); assert.equal(C.num.compact(12), "12"); });
t("num.round/clamp/pct/bytes", () => { assert.equal(C.num.round(1.005, 2), 1.01); assert.equal(C.num.clamp(9, 0, 5), 5); assert.equal(C.num.pct(1, 8), 12.5); assert.ok(isNaN(C.num.pct(1, 0))); assert.equal(C.num.bytes(1536), "1.5 KB"); assert.equal(C.num.bytes(500), "500 B"); assert.equal(C.num.bytes(3 * 1048576), "3.00 MB"); });

t("store memory fallback", () => {
  const s = C.store(null); assert.equal(s.get("a", "d"), "d"); s.put("a", 5); assert.equal(s.get("a"), "5");
  s.putJson("j", { x: 1 }); eq(s.json("j"), { x: 1 }); eq(s.json("zz", [9]), [9]); s.put("bad", "{oops"); eq(s.json("bad", "fb"), "fb");
  s.del("a"); assert.equal(s.get("a", "gone"), "gone");
});
t("store.list/push", () => { const s = C.store(null); s.push("r", "a", 3); s.push("r", "b", 3); s.push("r", "a", 3); s.push("r", "c", 3); s.push("r", "d", 3); eq(s.list("r"), ["d", "c", "a"]); s.put("notlist", "{}"); eq(s.list("notlist"), []); });
t("store survives throwing backend", () => {
  const boom = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const s = C.store(boom); assert.equal(s.put("k", "v"), false); assert.equal(s.get("k"), "v"); s.del("k"); assert.equal(s.get("k", "x"), "x");
});
t("store real backend", () => { const m = {}; const b = { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } }; const s = C.store(b); assert.equal(s.put("q", 1), true); assert.equal(m.q, "1"); });

t("events", () => {
  const e = C.events(), got = []; const off = e.on("x", (v) => got.push(v)); e.emit("x", 1); off(); e.emit("x", 2); e.once("y", (v) => got.push("y" + v)); e.emit("y", 1); e.emit("y", 2);
  e.on("z", () => { throw new Error("handler error must not break others"); }); e.on("z", () => got.push("z")); const ce = console.error; console.error = () => {}; e.emit("z"); console.error = ce;
  eq(got, [1, "y1", "z"]);
});
t("i18n", () => {
  assert.equal(C.i18n.L("a", "b"), "a"); const seen = []; C.bus.on("lang", (l) => seen.push(l));
  assert.equal(C.i18n.set("hi"), "hi"); assert.equal(C.i18n.L("a", "b"), "b"); assert.equal(C.i18n.pick({ en: "E", hi: "H" }), "H"); assert.equal(C.i18n.pick({ en: "E" }), "E");
  assert.equal(C.i18n.toggle(), "en"); assert.equal(C.i18n.set("xx"), "en"); eq(seen, ["hi", "en", "en"]);
});
t("hash", () => {
  eq(C.hash.parse("#a=1&b=x%20y&c"), { a: "1", b: "x y", c: "" }); eq(C.hash.parse(""), {}); eq(C.hash.parse("#%E0%A4%A=1&ok=2"), { ok: "2" });
  assert.equal(C.hash.stringify({ a: 1, b: "x y", c: undefined, d: null }), "a=1&b=x%20y"); eq(C.hash.parse(C.hash.stringify({ q: "हिंदी & more" })), { q: "हिंदी & more" });
});
t("validate.number", () => {
  const v = C.validate.number; assert.equal(v("5", { min: 1, max: 10 }).value, 5); assert.equal(v("", {}).ok, false); assert.equal(v("", { required: false, def: 7 }).value, 7);
  assert.equal(v("abc").ok, false); assert.equal(v("0", { min: 1 }).ok, false); assert.equal(v("11", { max: 10 }).error.en, "Must be at most 10."); assert.equal(v("2.5", { int: true }).ok, false); assert.equal(v("1,000", {}).value, 1000);
});
t("validate misc", () => {
  assert.ok(C.validate.email("a@b.co")); assert.ok(!C.validate.email("a@b")); assert.ok(!C.validate.email("a b@c.com"));
  assert.ok(C.validate.url("https://x.in/a?b=1")); assert.ok(!C.validate.url("javascript:alert(1)")); assert.ok(!C.validate.url("not a url")); assert.ok(C.validate.url("mailto:a@b.c", { protocols: ["mailto:"] }));
  assert.ok(C.validate.hexColor("#fff")); assert.ok(C.validate.hexColor("#A1b2C3")); assert.ok(!C.validate.hexColor("#ffff")); assert.ok(!C.validate.hexColor("fff"));
});
t("files helpers", () => {
  assert.equal(C.files.baseName({ name: "photo.final.jpg" }), "photo.final"); assert.equal(C.files.baseName("a.pdf"), "a"); assert.equal(C.files.extOf("image/jpeg"), "jpg"); assert.equal(C.files.extOf("zzz"), "png"); assert.equal(C.files.sizeOf(2048), "2.0 KB");
  assert.equal(C.files.safeName('a/b:c*?"<>|d.pdf'), "abcd.pdf"); assert.equal(C.files.safeName("   ", "x"), "x"); assert.equal(C.files.safeName("..hidden"), "hidden");
});
t("files.validate", () => {
  const f = (name, size, type) => ({ name, size, type }), r = C.files.validate([f("a.png", 10, "image/png"), f("e.png", 0, "image/png"), f("b.pdf", 10, "application/pdf"), f("big.png", 60 * 1048576, "image/png"), f("c.png", 5, "image/png")], { types: ["image/*"], maxCount: 4 });
  eq(r.ok.map((x) => x.name), ["a.png"]); eq(r.bad.map((x) => x.reason), ["empty", "type", "big", "count"]);
  assert.equal(C.files.validate([f("a", 1, "x/y")], {}).ok.length, 1); assert.equal(C.files.validate(null).ok.length, 0);
});
t("img.fit", () => { eq(C.img.fit(4000, 3000, 2000), [2000, 1500]); eq(C.img.fit(800, 600, 2000), [800, 600]); eq(C.img.fit(800, 600, 0), [800, 600]); eq(C.img.fit(10000, 1, 100), [100, 1]); });
t("no DOM at load", () => { assert.equal(typeof C.dom.h, "function"); assert.equal(C.dom.$("x"), null); eq(C.dom.$$("div"), []); let c = 0; C.dom.ready(() => c++); assert.equal(c, 1); });
t("debounce/throttle exist", () => { assert.equal(typeof C.dom.debounce(() => {}, 5).cancel, "function"); let k = 0; const th = C.dom.throttle(() => k++, 1000); th(); th(); assert.equal(k, 1); });
console.log(process.exitCode ? "core tests FAILED" : `core tests passed (${n})`);

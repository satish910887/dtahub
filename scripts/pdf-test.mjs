// Tests for DTApdf core (public/js/dta-pdf.js). Usage: node scripts/pdf-test.mjs <dir-with-a.pdf,b.pdf,a_os.pdf>
import { createRequire } from "module"; import fs from "fs"; import { execFileSync } from "child_process";
const require = createRequire(import.meta.url); const P = require("../public/js/dta-pdf.js");
const dir = process.argv[2] || "."; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const rd = f => new Uint8Array(fs.readFileSync(dir + "/" + f));
const tmp = dir + "/_out.pdf";
function check(bytes, pages, text) {
  fs.writeFileSync(tmp, bytes);
  try { execFileSync("qpdf", ["--check", tmp], { stdio: "pipe" }); ok(true); } catch (e) { ok(false, "qpdf check: " + e.stdout + e.stderr); }
  const info = execFileSync("pdfinfo", [tmp]).toString(); ok(new RegExp("Pages:\\s+" + pages + "\\b").test(info), "pages " + pages + " got " + info);
  if (text) { const t = execFileSync("pdftotext", [tmp, "-"]).toString().replace(/\s+/g, " "); ok(t.includes(text), "text '" + text + "' in '" + t + "'"); }
}
// load classic, objstm, qdf
for (const f of ["a.pdf", "a_os.pdf", "a_qdf.pdf"]) { const d = P.Doc.load(rd(f)); ok(d.getPageCount() === 3, f + " count"); }
// merge
const out = P.Doc.create();
for (const [f, idx] of [["a.pdf", [0, 2]], ["b.pdf", null], ["a_os.pdf", [1]]]) { const s = P.Doc.load(rd(f)); (await out.copyPages(s, idx)).forEach(p => out.addPage(p)); }
out.setTitle("Merged ✓");
const bytes = await out.save(); check(bytes, 5, "Doc a page 3 Doc b page 1");
const re = P.Doc.load(bytes); ok(re.getPageCount() === 5 && re.getTitle() === "Merged ✓", "reload+title");
// rotate + remove + blank
re.getPage(0).setRotation(90); re.removePage(1); re.addPage([200, 300]);
const b2 = await re.save(); check(b2, 5);
ok(P.Doc.load(b2).getPage(0).getRotation().angle === 90, "rotation kept");
ok(P.Doc.load(b2).getPage(4).getSize().width === 200, "blank size");
// damaged xref: corrupt startxref offset
const bad = rd("a.pdf").slice(); const s = Buffer.from(bad).toString("latin1"); const i = s.lastIndexOf("startxref");
const broken = Buffer.from(s.slice(0, i) + "startxref\n99\n%%EOF\n", "latin1");
ok(P.Doc.load(new Uint8Array(broken)).getPageCount() === 3, "rebuild xref");
// truncated trailer
ok(P.Doc.load(new Uint8Array(broken.subarray(0, i - 5))).getPageCount() >= 1, "truncated");
// encrypted
fs.existsSync(dir + "/enc.pdf") && (() => { try { P.Doc.load(rd("enc.pdf")); ok(false, "enc should throw"); } catch (e) { ok(e.code === "encrypted", "enc code " + e.code); } })();
try { P.Doc.load(new Uint8Array([1, 2, 3])); ok(false, "not pdf"); } catch (e) { ok(e.code === "not-pdf", "not-pdf"); }
// deflate roundtrip
const raw = new Uint8Array(5000).map((_, i) => i * 7 % 251); const z = await P.util.deflate(raw); const u = P.util.inflate(z);
ok(u.length === raw.length && u.every((v, k) => v === raw[k]), "deflate roundtrip");
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

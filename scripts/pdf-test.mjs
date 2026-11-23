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

// ---- drawing ----
{
  const d = P.Doc.create(), pg = d.addPage([300, 200]), font = d.embedFont("Helvetica");
  ok(Math.abs(font.widthOfTextAtSize("A", 1000) - 667) < 1, "AFM width");
  pg.drawRect({ x: 0, y: 0, width: 300, height: 200, color: P.rgb(1, 1, 1) });
  pg.drawText("Hello DTA", { x: 20, y: 150, size: 20, font, color: P.rgb(0, 0, 0) });
  pg.drawText("Rot", { x: 250, y: 20, size: 14, font, rotate: P.degrees(90) });
  const png = await d.embedPng(rd("rgba.png")); pg.drawImage(png, { x: 20, y: 20, width: 80, height: 40 });
  const jp = await d.embedJpg(rd("b.jpg")); pg.drawImage(jp, { x: 120, y: 20, width: 64, height: 32, opacity: 0.5 });
  const g = await d.embedPng(rd("rgb.png")); pg.drawImage(g, { x: 200, y: 100, width: 60, height: 60, clip: [200, 100, 30, 60] });
  for (const f of ["pal.png", "gray.png"]) { const im = await d.embedPng(rd(f)); pg.drawImage(im, { x: 5, y: 5, width: 5, height: 5 }); }
  pg.drawLine({ start: { x: 0, y: 190 }, end: { x: 300, y: 190 }, thickness: 2, cap: "round", color: P.rgb(1, 0, 0) });
  const b = await d.save(); check(b, 1, "Hello DTA");
  fs.writeFileSync(tmp, b); execFileSync("pdftoppm", ["-r", "72", "-png", "-singlefile", tmp, dir + "/_r"]);
  const py = execFileSync("python3", ["-c", `
from PIL import Image
im=Image.open("${dir}/_r.png").convert("RGB"); W,H=im.size; print(W,H)
def px(x,y): return im.getpixel((x,H-1-y))
print(px(40,40)); print(px(90,40)); print(px(150,35)); print(px(210,130)); print(px(245,130))`]).toString().trim().split("\n");
  ok(py[0] === "300 200", "render size " + py[0]);
  ok(py[1] === "(255, 0, 0)", "png opaque red " + py[1]);
  ok(py[2] === "(255, 255, 255)", "png alpha transparent " + py[2]);
  const o = eval(py[3].replace("(", "[").replace(")", "]")); ok(o[0] > 120 && o[0] < 135 && o[2] > 240, "jpeg 50% opacity " + py[3]);
  ok(py[4] === "(0, 200, 0)" || /^\(0, 19\d, 0\)$/.test(py[4]), "clip inside " + py[4]);
  ok(py[5] === "(255, 255, 255)", "clip outside " + py[5]);
  // existing page + draw keeps old content
  const base = P.Doc.load(rd("a.pdf")); const bp = base.getPage(0); bp.drawText("STAMP", { x: 100, y: 500, size: 30 });
  const b3 = await base.save(); check(b3, 3, "Doc a page 1"); fs.writeFileSync(tmp, b3); ok(execFileSync("pdftotext", [tmp, "-"]).toString().includes("STAMP"), "stamp text");
}

// ---- forms ----
{
  const d = P.Doc.load(rd("f.pdf")), form = d.getForm(), fl = form.getFields();
  ok(fl.length === 5, "field count " + fl.length);
  ok(form.getField("g").kind() === "radio" && form.getField("city").kind() === "dropdown" && form.getField("agree").kind() === "checkbox", "kinds");
  form.getField("name").setText("Satish Kumar");
  form.getField("note").setText("line one of a long note that must wrap across lines\nsecond para");
  form.getField("agree").check(); form.getField("g").select("B"); form.getField("city").select("Goa");
  let threw = false; try { form.getField("name").setText("हिंदी"); } catch (e) { threw = e.code === "encoding"; } ok(threw, "hindi refused");
  const filled = await d.save(); check(filled, 1, "Satish Kumar");
  const py = execFileSync("python3", ["-c", `
from pypdf import PdfReader
r=PdfReader("${tmp}"); 
import sys
fs=r.get_fields(); print(fs["name"].get("/V"),"|",fs["agree"].get("/V"),"|",fs["g"].get("/V"),"|",fs["city"].get("/V"))`]).toString();
  fs.writeFileSync(tmp, filled);
  const py2 = execFileSync("python3", ["-c", `
from pypdf import PdfReader
r=PdfReader("${tmp}"); fs=r.get_fields(); print(fs["name"].get("/V"),"|",fs["agree"].get("/V"),"|",fs["g"].get("/V"),"|",fs["city"].get("/V"))`]).toString().trim();
  ok(py2 === "Satish Kumar | /Yes | /B | Goa", "pypdf values: " + py2);
  // flatten
  const d2 = P.Doc.load(filled), f2 = d2.getForm(); f2.flatten();
  const flat = await d2.save(); check(flat, 1, "Satish Kumar");
  fs.writeFileSync(tmp, flat);
  const py3 = execFileSync("python3", ["-c", `
from pypdf import PdfReader
r=PdfReader("${tmp}"); print(len(r.get_fields() or {}), len(r.pages[0].get("/Annots") or []))`]).toString().trim();
  ok(py3 === "0 0", "flatten removed fields " + py3);
  const txt = execFileSync("pdftotext", [tmp, "-"]).toString(); ok(/wrap/.test(txt) && /Goa/.test(txt) && /second para/.test(txt), "flatten text " + txt.replace(/\n/g, "|"));
  execFileSync("pdftoppm", ["-r", "72", "-png", "-singlefile", tmp, dir + "/_fl"]);
}
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

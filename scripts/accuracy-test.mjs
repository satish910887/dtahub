/* Accuracy checks for tool logic that can run without a browser: node scripts/accuracy-test.mjs */
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const root = new URL("../public/js/pg/", import.meta.url).pathname;
const read = (f) => fs.readFileSync(root + f, "utf8");
const pick = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
let fail = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fail++; console.log("FAIL", m); } };

/* JSON formatter: output must keep numbers, escapes, duplicate keys and key order, and match JSON.stringify layout */
{
  const lossless = new Function(pick(read("tools-json-formatter.js"), "function lossless", "function indent") + ";return lossless")();
  const sample = '{"id":12345678901234567890,"f":1.10,"neg":-0.0,"a":1,"a":2,"2":1,"1":"\\u00e9","e":[],"o":{}}';
  const out = lossless(sample, true, 2, false);
  ok(out === sample, "lossless minify keeps the text exactly: " + out);
  ok(lossless(sample, false, 2, false).includes('"id": 12345678901234567890'), "big integer kept");
  const rnd = (d) => { const r = Math.random(); if (d > 3 || r < .35) return [Math.floor(Math.random() * 1000), -5.5, 'x"y\\z', "é😀\n", true, null, 1e5, 0][Math.floor(Math.random() * 8)]; if (r < .65) return Array.from({ length: Math.random() * 4 | 0 }, () => rnd(d + 1)); const o = {}; for (let i = 0, n = Math.random() * 4 | 0; i < n; i++) o["k" + (Math.random() * 9 | 0)] = rnd(d + 1); return o; };
  for (let t = 0; t < 1500; t++) { const v = rnd(0), txt = JSON.stringify(v); for (const ind of [2, 4, "\t"]) ok(lossless(txt, false, ind, false) === JSON.stringify(v, null, ind), "pretty " + txt); ok(lossless(txt, true, 2, false) === txt, "min " + txt); }
}

/* Myers diff: valid script and the minimum number of edits */
{
  const myers = new Function(pick(read("tools-text-diff.js"), "function myers", "function diff(A,B)") + ";return myers")();
  const al = ["a", "b", "c", "d", "e"], mk = (n) => Array.from({ length: n }, () => al[Math.random() * al.length | 0]);
  for (let t = 0; t < 1500; t++) {
    const A = mk(Math.random() * 30 | 0), B = mk(Math.random() * 30 | 0), ops = myers(A, B), ra = [], rb = [];
    ops.forEach(([o, i]) => { if (o === "=") { ra.push(A[i]); rb.push(A[i]); } else if (o === "-") ra.push(A[i]); else rb.push(B[i]); });
    const n = A.length, m = B.length, T = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) T[i][j] = A[i] === B[j] ? T[i + 1][j + 1] + 1 : Math.max(T[i + 1][j], T[i][j + 1]);
    ok(ra.join() === A.join() && rb.join() === B.join(), "diff rebuilds both sides");
    ok(ops.filter((o) => o[0] !== "=").length === n + m - 2 * T[0][0], "diff is minimal");
  }
}

/* Age: whole years/months/days must match calendar rules (month ends are clamped, days never negative) */
{
  const diff = new Function(pick(read("tools-age.js"), "function addM", "function fmtA") + ";return diff")();
  const t = (a, b, y, m, d) => { const r = diff(new Date(a + "T00:00:00"), new Date(b + "T00:00:00")); ok(r[0] === y && r[1] === m && r[2] === d, `age ${a}→${b} gave ${r}`); };
  t("2023-01-31", "2023-03-01", 0, 1, 1); t("2024-01-31", "2024-03-01", 0, 1, 1); t("2020-05-31", "2020-06-30", 0, 1, 0);
  t("2000-02-29", "2024-02-28", 23, 11, 30); t("2021-08-30", "2025-03-03", 3, 6, 3); t("1995-12-29", "2011-03-20", 15, 2, 20);
  for (let k = 0; k < 3000; k++) { const a = new Date(1950, 0, 1 + Math.random() * 27000 | 0), b = new Date(+a + Math.random() * 12000 * 864e5); const r = diff(a, b); ok(r[0] >= 0 && r[1] >= 0 && r[1] < 12 && r[2] >= 0 && r[2] < 32, "age never negative"); }
}

/* CSV parser: quotes, doubled quotes, CRLF, BOM, other delimiters */
{
  const L = (a) => a, parse = new Function("L", pick(read("tools-csv-json.js"), "function parseCSV", "function conv(v)") + ";return parseCSV")(L);
  const j = (x) => JSON.stringify(x);
  ok(j(parse('a,"b,c"\r\n"x""y",z\r\n', ",")) === j([["a", "b,c"], ['x"y', "z"]]), "csv quotes");
  ok(j(parse("﻿a;b\n1;2", ";")) === j([["a", "b"], ["1", "2"]]), "csv bom and semicolon");
  ok(j(parse('"a\nb",c', ",")) === j([["a\nb", "c"]]), "csv newline in quotes");
  let threw = false; try { parse('"open', ","); } catch (e) { threw = true; } ok(threw, "csv unclosed quote throws");
}
console.log(fail ? `${fail} of ${total} checks FAILED` : `accuracy checks passed (${total})`);
process.exit(fail ? 1 : 0);

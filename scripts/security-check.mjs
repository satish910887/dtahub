/* Fails the build if the site drifts away from its security rules. Run: node scripts/security-check.mjs */
import fs from "node:fs"; import crypto from "node:crypto"; import path from "node:path";
const PUB = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "public");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "vendor" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
const bad = [];
const CSP = (/Content-Security-Policy:\s*(.+)/.exec(fs.readFileSync(path.join(PUB, "_headers"), "utf8")) || [])[1] || "";
const files = walk(PUB);
for (const f of files.filter((x) => x.endsWith(".html"))) {
  const h = fs.readFileSync(f, "utf8"), r = path.relative(PUB, f);
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(h.replace(/<script[\s\S]*?<\/script>/gi, ""))) bad.push(r + ": inline event handler attribute");
  if (/(href|src|action)\s*=\s*["']\s*javascript:/i.test(h)) bad.push(r + ": javascript: URL");
  for (const m of h.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) { if (/ld\+json/.test(m[1])) continue; const hs = "'sha256-" + crypto.createHash("sha256").update(m[2]).digest("base64") + "'"; if (!CSP.includes(hs)) bad.push(r + ": inline script not covered by a CSP hash"); }
  if (/<a[^>]+target="_blank"(?![^>]*rel="[^"]*noopener)/i.test(h)) bad.push(r + ": target=_blank without rel=noopener");
  if (/(?:src|href)=["']http:\/\//i.test(h)) bad.push(r + ": insecure http:// resource");
}
for (const f of files.filter((x) => x.endsWith(".js") && !x.endsWith("sw.js"))) {
  const j = fs.readFileSync(f, "utf8"), r = path.relative(PUB, f);
  if (/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(j)) bad.push(r + ": eval, new Function or document.write");
  if (/setTimeout\s*\(\s*["'`]|setInterval\s*\(\s*["'`]/.test(j)) bad.push(r + ": string passed to setTimeout/setInterval");
}
const hd = fs.readFileSync(path.join(PUB, "_headers"), "utf8");
const csp = (/Content-Security-Policy:\s*(.+)/.exec(hd) || [])[1] || "";
for (const [re, msg] of [[/script-src[^;]*'unsafe-inline'/, "script-src must not allow unsafe-inline"], [/script-src[^;]*'unsafe-eval'/, "script-src must not allow unsafe-eval"], [/script-src[^;]*\*/, "script-src must not use wildcards"]]) if (re.test(csp)) bad.push("_headers: " + msg);
for (const need of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "script-src-attr 'none'"]) if (!csp.includes(need)) bad.push("_headers: CSP is missing " + need);
for (const h of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) if (!hd.includes(h + ":")) bad.push("_headers: missing " + h);
if (bad.length) { console.error("SECURITY CHECK FAILED:\n - " + bad.join("\n - ")); process.exit(1); }
console.log("security check passed (" + files.length + " files)");

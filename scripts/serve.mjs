// Local preview server that mimics Cloudflare static assets (clean URLs, 404.html). Usage: node scripts/serve.mjs [port]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const PUB = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../public");
const CSP = (fs.readFileSync(path.join(PUB, "_headers"), "utf8").match(/Content-Security-Policy: (.*)/) || [])[1];
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); let f = path.join(PUB, p);
  const cand = [f, f + ".html", path.join(f, "index.html")];
  const hit = cand.find((c) => c.startsWith(PUB) && fs.existsSync(c) && fs.statSync(c).isFile());
  if (!hit) { res.writeHead(404, { "Content-Type": T[".html"], ...(CSP ? { "Content-Security-Policy": CSP } : {}) }); return res.end(fs.readFileSync(path.join(PUB, "404.html"))); }
  const h = { "Content-Type": T[path.extname(hit)] || "application/octet-stream" };
  if (CSP) h["Content-Security-Policy"] = CSP;
  if (hit.endsWith("sw.js")) h["Cache-Control"] = "no-cache";
  res.writeHead(200, h); fs.createReadStream(hit).pipe(res);
}).listen(+process.argv[2] || 8787, () => console.log("http://localhost:" + (+process.argv[2] || 8787)));

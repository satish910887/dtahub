"""Generates PNG icons and the social share image from original SVG/HTML. Run: python3 scripts/make-icons.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / "public"
def body(u, rounded):
    x0, w, rx = (2, 60, 16) if rounded else (0, 64, 0)
    ring = f'<rect x="2.6" y="2.6" width="58.8" height="58.8" rx="15.4" fill="none" stroke="url(#s{u})" stroke-width="1.3"/>' if rounded else ''
    return (f'<defs><linearGradient id="t{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#63a4ff"/><stop offset=".5" stop-color="#2f5bea"/><stop offset="1" stop-color="#5a3df0"/></linearGradient>'
    f'<linearGradient id="h{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
    f'<linearGradient id="s{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".6" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#9ad7ff" stop-opacity=".35"/></linearGradient>'
    f'<linearGradient id="d{u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#d3e1ff"/></linearGradient>'
    f'<linearGradient id="n{u}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#3b82f6"/></linearGradient>'
    f'<clipPath id="c{u}"><rect x="{x0}" y="{x0}" width="{w}" height="{w}" rx="{rx}"/></clipPath></defs>'
    f'<g><rect x="{x0}" y="{x0}" width="{w}" height="{w}" rx="{rx}" fill="url(#t{u})"/>'
    f'<g clip-path="url(#c{u})"><rect x="{x0}" y="{x0}" width="{w}" height="{w//2}" fill="url(#h{u})"/><circle cx="58" cy="64" r="27" fill="#22d3ee" opacity=".2"/><circle cx="6" cy="2" r="22" fill="#fff" opacity=".07"/></g>{ring}</g>'
    f'<g><path fill-rule="evenodd" fill="#0e1f7a" opacity=".3" transform="translate(0 1.8)" d="M18 15h14a17 17 0 0 1 0 34H18zM26.500 23v18H32a9 9 0 0 0 0-18z"/>'
    f'<path fill-rule="evenodd" fill="url(#d{u})" d="M18 15h14a17 17 0 0 1 0 34H18zM26.500 23v18H32a9 9 0 0 0 0-18z"/></g>'
    f'<circle cx="32.500" cy="32" r="3.600" fill="url(#n{u})"/>'
    f'<path fill="#bff6ff" d="M48 11.500l1.500 4 4 1.500-4 1.500-1.500 4-1.500-4-4-1.500 4-1.500z"/>')
def mark(s, pad, rounded=False, u="m"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 64 64">{body(u, rounded)}</svg>'
og = f'''<html><body style="margin:0;width:1200px;height:630px;background:#f4f7fe;font-family:Inter,system-ui,sans-serif;color:#0f1b4d;position:relative;overflow:hidden">
<div style="position:absolute;left:-180px;top:-260px;width:820px;height:820px;border-radius:50%;background:radial-gradient(circle,rgba(79,140,255,.35),transparent 65%)"></div>
<div style="position:absolute;right:-200px;bottom:-320px;width:820px;height:820px;border-radius:50%;background:radial-gradient(circle,rgba(90,61,240,.28),transparent 65%)"></div>
<div style="position:absolute;left:80px;top:76px;display:flex;align-items:center;gap:22px">
{mark(96, 0, True, "og")}
<span style="font-size:58px;font-weight:800;letter-spacing:-.02em">DTA<span style="color:#2f5bea">hub</span></span></div>
<div style="position:absolute;left:80px;top:250px;font-size:84px;font-weight:800;line-height:1.05;letter-spacing:-.035em">Everything You Need.<br><span style="background:linear-gradient(110deg,#2f5bea,#5a3df0);-webkit-background-clip:text;color:transparent">One Powerful Toolkit.</span></div>
<div style="position:absolute;left:80px;bottom:70px;font-size:30px;color:#4a5784">Free PDF, image, text and developer tools, calculators. Private, in your browser.</div>
</body></html>'''
jobs = [("icons/dta2-192.png", 192, 0.0), ("icons/dta2-512.png", 512, 0.0), ("icons/dta2-maskable-512.png", 512, 0.22), ("icons/dta2-180.png", 180, 0.0)]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for name, s, pad in jobs:
        pg.set_viewport_size({"width": s, "height": s}); pg.set_content(f'<body style="margin:0">{mark(s, pad)}</body>'); pg.screenshot(path=str(root / name))
    pg.set_viewport_size({"width": 1200, "height": 630}); pg.set_content(og); pg.screenshot(path=str(root / "og.png"))
    b.close()
print("icons done")

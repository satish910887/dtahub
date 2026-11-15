"""Generates PNG icons and the social share image from original SVG/HTML. Run: python3 scripts/make-icons.py"""
import pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent / "public"
mark = lambda s, pad: f'''<svg xmlns="http://www.w3.org/2000/svg" width="{s}" height="{s}" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c969"/><stop offset="1" stop-color="#8b6cf6"/></linearGradient></defs><rect width="64" height="64" fill="#0d0d15"/><g transform="translate(32 32) scale({1-pad}) translate(-32 -32)"><path d="M32 8 52 19.500v25L32 56 12 44.500v-25z" fill="none" stroke="url(#g)" stroke-width="3.400" stroke-linejoin="round"/><path d="M24 22h8a10 10 0 0 1 0 20h-8z" fill="url(#g)"/></g></svg>'''
og = '''<html><body style="margin:0;width:1200px;height:630px;background:#08080d;font-family:Inter,system-ui,sans-serif;color:#ececf4;position:relative;overflow:hidden">
<div style="position:absolute;left:-200px;top:-260px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(139,108,246,.55),transparent 65%)"></div>
<div style="position:absolute;right:-220px;bottom:-300px;width:800px;height:800px;border-radius:50%;background:radial-gradient(circle,rgba(242,201,105,.35),transparent 65%)"></div>
<div style="position:absolute;left:80px;top:80px;display:flex;align-items:center;gap:20px">
<svg width="84" height="84" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2c969"/><stop offset="1" stop-color="#8b6cf6"/></linearGradient></defs><path d="M32 6 54 18.500v27L32 58 10 45.500v-27z" fill="none" stroke="url(#g)" stroke-width="3.400" stroke-linejoin="round"/><path d="M23 21h9a11 11 0 0 1 0 22h-9z" fill="url(#g)"/></svg>
<span style="font-size:56px;font-weight:800;letter-spacing:-.02em">DTA<span style="color:#f2c969">hub</span></span></div>
<div style="position:absolute;left:80px;top:250px;font-size:84px;font-weight:800;line-height:1.05;letter-spacing:-.035em">Everything You Need.<br><span style="background:linear-gradient(110deg,#f2c969,#b5a1ff);-webkit-background-clip:text;color:transparent">One Powerful Toolkit.</span></div>
<div style="position:absolute;left:80px;bottom:70px;font-size:30px;color:#9a9ab2">Free PDF, image, text and developer tools, calculators. Private, in your browser.</div>
</body></html>'''
jobs = [("icons/icon-192.png", 192, 0.0), ("icons/icon-512.png", 512, 0.0), ("icons/maskable-512.png", 512, 0.22), ("icons/apple-touch-icon.png", 180, 0.0)]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for name, s, pad in jobs:
        pg.set_viewport_size({"width": s, "height": s}); pg.set_content(f'<body style="margin:0">{mark(s, pad)}</body>'); pg.screenshot(path=str(root / name))
    pg.set_viewport_size({"width": 1200, "height": 630}); pg.set_content(og); pg.screenshot(path=str(root / "og.png"))
    b.close()
print("icons done")

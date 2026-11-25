#!/usr/bin/env python3
"""Static accessibility/structure scan of every built page: python3 scripts/a11y-static.py"""
import glob,re,sys,collections
from html.parser import HTMLParser
root="public/"
class P(HTMLParser):
    def __init__(s):
        super().__init__();s.ids=collections.Counter();s.h=[];s.lang=None;s.title="";s.in_title=False;s.meta=False;s.imgs=[];s.mains=0;s.skip=False;s.cur=0;s.inputs=[];s.labels=set();s.btn=[];s._b=None;s.links=[];s.lab=0
    def handle_starttag(s,t,a):
        a=dict(a)
        if "id" in a:s.ids[a["id"]]+=1
        if t=="html":s.lang=a.get("lang")
        if t=="title":s.in_title=True
        if t=="meta" and a.get("name")=="description" and a.get("content"):s.meta=True
        if t in("h1","h2","h3","h4","h5","h6"):s.h.append(int(t[1]))
        if t=="img":s.imgs.append(a)
        if t=="main":s.mains+=1
        if t=="a" and a.get("class")=="skip":s.skip=True
        if t=="a" and a.get("href","").startswith("/"):s.links.append(a["href"])
        if t=="label":
            s.lab+=1
            if a.get("for"):s.labels.add(a["for"])
        if t in("input","select","textarea") and a.get("type") not in("hidden","submit","button") and not s.lab:s.inputs.append(a)
    def handle_endtag(s,t):
        if t=="label" and s.lab:s.lab-=1
        if t=="title":s.in_title=False
    def handle_data(s,d):
        if s.in_title:s.title+=d
bad=0
for f in sorted(glob.glob(root+"**/*.html",recursive=True)):
    if "/vendor/" in f: continue
    s=open(f).read();p=P();p.feed(s);iss=[]
    d=[k for k,v in p.ids.items() if v>1]
    if d:iss.append("duplicate ids: "+",".join(d[:5]))
    if p.lang not in("en","en-IN"):iss.append("html lang="+str(p.lang))
    if not p.title.strip():iss.append("no title")
    if not p.meta and not f.endswith("404.html"):iss.append("no meta description")
    if p.h.count(1)!=1:iss.append("h1 count %d"%p.h.count(1))
    for a,b in zip(p.h,p.h[1:]):
        if b>a+1:iss.append("heading jump h%d->h%d"%(a,b));break
    for im in p.imgs:
        if "alt" not in im:iss.append("img without alt: "+im.get("src","")[:40])
    if p.mains!=1 and "/vendor" not in f:iss.append("main count %d"%p.mains)
    if not p.skip and "docs" not in f:iss.append("no skip link")
    # form-control names are attached at runtime by tool.js; check them in a browser (axe / name audit)
    if iss:bad+=1;print(f[len(root):],"::","; ".join(iss[:6]))
print("pages with issues:",bad);sys.exit(1 if bad else 0)

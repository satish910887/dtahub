import sys, json, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.cu2quPen import Cu2QuPen
def truth(path):
    res={}
    if path.endswith(".pfb"):
        from fontTools.t1Lib import T1Font
        f=T1Font(path); f.parse(); gs=f.getGlyphSet()
        names=list(gs.keys())
        for n in names[:300]:
            res[n]=gs[n]
        return res, gs
    f=TTFont(path, fontNumber=0); gs=f.getGlyphSet(); order=f.getGlyphOrder(); 
    return {i: order[i] for i in range(min(len(order),300))}, gs
def stats(gs,name):
    b=BoundsPen(gs); gs[name].draw(b); a=AreaPen(gs); gs[name].draw(a); return b.bounds, a.value
path=sys.argv[1]; subprocess.check_call(["node","dump.js",path,"/tmp/ft.json"]); d=json.load(open("/tmp/ft.json"))
bad=0; tot=0
if path.endswith(".pfb"):
    from fontTools.t1Lib import T1Font
    f=T1Font(path); f.parse(); gs=f.getGlyphSet()
    items=[(n,n) for n in d["out"]]
else:
    f=TTFont(path, fontNumber=0); gs=f.getGlyphSet(); order=f.getGlyphOrder()
    items=[(k,order[int(k)]) for k in d["out"]]
for k,name in items:
    try: b,a=stats(gs,name)
    except Exception as e: continue
    m=d["out"][k]; tot+=1
    if b is None:
        if m is not None and abs(m["area"])>1: bad+=1; print("extra",name)
        continue
    if m is None: bad+=1; print("missing",name); continue
    tol=max(2,0.01*max(b[2]-b[0],b[3]-b[1]))
    ok=all(abs(x-y)<=tol for x,y in zip(b,m["bbox"])) and abs(abs(a)-abs(m["area"]))<=0.02*abs(a)+4
    if not ok:
        bad+=1
        if bad<6: print("MISMATCH",name,b,m["bbox"],a,m["area"])
print(path.split("/")[-1],d["kind"],"glyphs",tot,"bad",bad)

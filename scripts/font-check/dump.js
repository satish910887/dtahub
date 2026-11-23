const F=require("../../public/js/dta-pdf-font.js"),fs=require("fs");
const [,, file, outp]=process.argv; const r=F.load(new Uint8Array(fs.readFileSync(file))); const out={};
function stats(path){let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9,area=0,cx=0,cy=0,sx=0,sy=0,i=0;
 const pt=(x,y)=>{minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)};
 const seg=(x0,y0,x1,y1)=>{area+=(x0*y1-x1*y0)/2};
 while(i<path.length){const o=path[i++];
  if(o===0){ if(cx!==sx||cy!==sy) seg(cx,cy,sx,sy); cx=sx=path[i];cy=sy=path[i+1];i+=2;pt(cx,cy)}
  else if(o===1){const x=path[i],y=path[i+1];i+=2;seg(cx,cy,x,y);cx=x;cy=y;pt(x,y)}
  else if(o===2){const [x1,y1,x2,y2,x3,y3]=path.slice(i,i+6);i+=6;let px=cx,py=cy;for(let t=1;t<=24;t++){const u=t/24,v=1-u;const x=v*v*v*cx+3*v*v*u*x1+3*v*u*u*x2+u*u*u*x3,y=v*v*v*cy+3*v*v*u*y1+3*v*u*u*y2+u*u*u*y3;seg(px,py,x,y);px=x;py=y;pt(x,y)}cx=x3;cy=y3}
  else {seg(cx,cy,sx,sy);cx=sx;cy=sy}}
 return {bbox:[minx,miny,maxx,maxy],area}}
if(r.kind==="sfnt"){const f=r.font;const n=Math.min(f.numGlyphs,300);for(let g=0;g<n;g++){const p=f.path(g);out[g]=p.length?stats(p):null}}
else if(r.kind==="cff"){const f=r.font;const n=Math.min(f.numGlyphs,300);for(let g=0;g<n;g++){const p=f.path(g).path;out[g]=p.length?stats(p):null}}
else {const f=r.font;for(const nm of Object.keys(f.glyphs).slice(0,300)){const p=f.path(nm).path;out[nm]=p.length?stats(p):null}}
fs.writeFileSync(outp,JSON.stringify({kind:r.kind,out}));

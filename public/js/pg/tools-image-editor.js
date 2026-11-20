var PI=Math.PI,im=null,file=null,S=null,hist=[],hp=-1,base=null,bk="",cmp=false,pc=null,pk="",tool="";
function fresh(){return{rot:0,fx:1,fy:1,ang:0,crop:{x:0,y:0,w:1,h:1},ratio:0,gr:0,se:0,iv:0,flt:"none",
 v:{ex:0,br:0,co:0,hl:0,sh:0,sa:0,vi:0,tp:0,ti:0,cl:0,bl:0,sp:0,pz:0,vg:0,gn:0,lo:0,hi:255},
 t:{t:"",sz:8,op:90,co:"#ffffff",pos:"br",ol:1,fo:"sans"},ann:[],
 cv:{m:[[0,0],[255,255]],r:[[0,0],[255,255]],g:[[0,0],[255,255]],b:[[0,0],[255,255]]},
 hs:[[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]],
 rt:[],fb:{t:"off",x:.5,y:.5,r:.25,am:50,an:0},rb:{on:0,c:[255,255,255],tol:25,so:30,all:0},fr:{w:0,c:"#ffffff",rd:0}}}
var FONTS={sans:"'Space Grotesk','Noto Sans Devanagari',system-ui,sans-serif",serif:"Georgia,'Noto Serif Devanagari','Times New Roman',serif",mono:"ui-monospace,Menlo,Consolas,'Courier New',monospace",hand:"'Segoe Script','Bradley Hand','Comic Sans MS','Noto Sans Devanagari',cursive",bold:"Impact,'Arial Black','Noto Sans Devanagari',sans-serif"};
var rtool="",picking=false;
function updMode(){var w=$("cmpw");if(!w||!S)return;var a=(!$("pAnn").hidden&&!!tool)||(!$("pRet").hidden&&!!rtool)||(!$("pFoc").hidden&&S.fb.t!=="off")||(!$("pCut").hidden&&picking);w.classList.toggle("ann",!!a)}
var SL={ang:["ang","Straighten","सीधा करें",-45,45,.5],
 adj:[["ex","Exposure","एक्सपोज़र"],["br","Brightness","चमक"],["co","Contrast","कॉन्ट्रास्ट"],["hl","Highlights","हाइलाइट"],["sh","Shadows","शैडो"],["sa","Saturation","रंग की गहराई"],["vi","Vibrance","वाइब्रेंस"],["tp","Warmth","गर्माहट"],["ti","Tint","टिंट"],["cl","Clarity","क्लैरिटी"]],
 fx:[["bl","Blur","ब्लर",0,100],["sp","Sharpen","शार्प",0,100],["pz","Pixelate","पिक्सेल",0,100],["vg","Vignette","वignette",0,100],["gn","Grain","ग्रेन",0,100]]};
SL.fx[3][2]="विग्नेट";
var ARS=[["Free","फ्री",0],["Square 1:1","चौकोर 1:1",1],["4:3","4:3",4/3],["3:4","3:4",3/4],["16:9","16:9",16/9],["9:16","9:16",9/16],["3:2","3:2",1.5],["4:5 (Instagram)","4:5 (Instagram)",.8],["2:1","2:1",2],["A4","A4",1/1.4142]];
var FLT=[["none","Original","असली"],["vivid","Vivid","विविड"],["warm","Warm","गर्म"],["cool","Cool","ठंडा"],["vintage","Vintage","विंटेज"],["fade","Fade","फेड"],["dramatic","Dramatic","ड्रामैटिक"],["noir","Noir","नॉयर"]];
function mkSlider(box,id,en,hi,mn,mx,st){
 var d=document.createElement("div");
 d.innerHTML='<label for="s_'+id+'"><span data-en="'+en+'" data-hi="'+hi+'">'+en+'</span><b id="n_'+id+'">0</b></label><input id="s_'+id+'" type="range" min="'+mn+'" max="'+mx+'" step="'+(st||1)+'" value="0">';
 box.appendChild(d);
 var r=d.querySelector("input");
 r.addEventListener("input",function(){if(id==="ang")dropAnn();set(id,+r.value);S.flt="none";schedule()});
 r.addEventListener("change",commit);
 r.addEventListener("dblclick",function(){r.value=id==="ang"?0:0;set(id,0);schedule();commit()});
}
function set(id,v){if(id==="ang")S.ang=v;else S.v[id]=v;$("n_"+id).textContent=v}
function get(id){return id==="ang"?S.ang:S.v[id]}
SL.adj.forEach(function(a){mkSlider($("sl-adj"),a[0],a[1],a[2],-100,100)});
SL.fx.forEach(function(a){mkSlider($("sl-fx"),a[0],a[1],a[2],0,100)});
mkSlider($("sl-ang"),"ang","Straighten","सीधा करें",-45,45,.5);
ARS.forEach(function(a,i){var b=document.createElement("button");b.type="button";b.className="chip";b.setAttribute("aria-pressed",i?"false":"true");b.dataset.r=a[2];b.dataset.en=a[0];b.dataset.hi=a[1];b.textContent=a[0];
 b.onclick=function(){S.ratio=a[2];if(a[2])fitRatio();syncUI();schedule();commit()};$("ars").appendChild(b)});
FLT.forEach(function(a){var b=document.createElement("button");b.type="button";b.className="chip";b.dataset.f=a[0];b.dataset.en=a[1];b.dataset.hi=a[2];b.textContent=a[1];b.setAttribute("aria-pressed","false");
 b.onclick=function(){applyPreset(a[0]);syncUI();schedule();commit()};$("flts").appendChild(b)});
if(window.DTAapply)DTAapply();
function applyPreset(k){
 var P=DTAfx.PRESETS[k]||{},keep={ex:1};
 ["br","co","hl","sh","sa","vi","tp","ti","cl","bl","sp","pz","vg","gn"].forEach(function(i){S.v[i]=P[i]||0});
 S.gr=P._gr||0;S.se=P._se||0;S.iv=0;S.flt=k;S.v.lo=0;S.v.hi=255;
}
function snap(){return JSON.stringify(S)}
function commit(){var j=snap();if(hist[hp]===j)return;hist=hist.slice(0,hp+1);hist.push(j);if(hist.length>60)hist.shift();hp=hist.length-1;btns()}
function btns(){$("undo").disabled=hp<=0;$("redo").disabled=hp>=hist.length-1}
function go(i){hp=i;S=JSON.parse(hist[hp]);syncUI();schedule();btns()}
$("undo").onclick=function(){if(hp>0)go(hp-1)};$("redo").onclick=function(){if(hp<hist.length-1)go(hp+1)};
$("rs").onclick=function(){S=fresh();syncUI();schedule();commit()};
function syncUI(){
 SL.adj.forEach(function(a){$("s_"+a[0]).value=S.v[a[0]];$("n_"+a[0]).textContent=S.v[a[0]]});
 SL.fx.forEach(function(a){$("s_"+a[0]).value=S.v[a[0]];$("n_"+a[0]).textContent=S.v[a[0]]});
 $("s_ang").value=S.ang;$("n_ang").textContent=S.ang;
 ["gr","se","iv"].forEach(function(k){$(k).setAttribute("aria-pressed",S[k]?"true":"false")});
 [].forEach.call($("flts").children,function(b){b.setAttribute("aria-pressed",b.dataset.f===S.flt?"true":"false")});
 [].forEach.call($("ars").children,function(b){b.setAttribute("aria-pressed",+b.dataset.r===S.ratio?"true":"false")});
 $("tx").value=S.t.t;$("tsz").value=S.t.sz;$("top").value=S.t.op;$("tco").value=S.t.co;$("tpos").value=S.t.pos;$("tol").checked=!!S.t.ol;
 $("tfo").value=S.t.fo||"sans";
 syncPro();
 placeCrop();
}
/* ---------- geometry ---------- */
function transformed(max){
 var W=im.naturalWidth,H=im.naturalHeight,k=max?Math.min(1,max/Math.max(W,H)):1,w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
 var q=S.rot%180!==0,cw=q?h:w,ch=q?w:h,c=document.createElement("canvas");c.width=cw;c.height=ch;
 var x=c.getContext("2d"),a=S.ang*PI/180,sc=1;
 if(a){var aa=Math.abs(a);sc=Math.cos(aa)+Math.sin(aa)*Math.max(cw/ch,ch/cw)}
 x.imageSmoothingQuality="high";x.translate(cw/2,ch/2);x.rotate(a);x.scale(sc,sc);x.rotate(S.rot*PI/180);x.scale(S.fx,S.fy);
 x.drawImage(im,-w/2,-h/2,w,h);return c;
}
function fitRatio(){
 var r=S.ratio,c=S.crop,W=base.width,H=base.height,cx=c.x+c.w/2,cy=c.y+c.h/2,w=c.w,h=w*W/(r*H);
 if(h>1){h=1;w=h*H*r/W}if(w>1){w=1;h=w*W/(r*H)}
 c.w=w;c.h=h;c.x=Math.min(1-w,Math.max(0,cx-w/2));c.y=Math.min(1-h,Math.max(0,cy-h/2));
}
function params(map){return{v:S.v,gr:S.gr,se:S.se,iv:S.iv,cv:S.cv,hs:S.hs,rt:S.rt,fb:S.fb,map:map||null}}
function drawText(x,W,H,rx,ry,rw,rh){
 var t=S.t;if(!t.t.trim())return;
 var px=Math.max(8,Math.round(rh*t.sz/100)),m=px*.6;
 x.save();x.font="700 "+px+"px "+(FONTS[t.fo]||FONTS.sans);x.textBaseline="middle";x.globalAlpha=t.op/100;
 var tw=x.measureText(t.t).width,pc=t.pos,tx,ty;
 tx=pc[1]==="l"?rx+m:pc[1]==="r"?rx+rw-m-tw:rx+(rw-tw)/2;
 ty=pc[0]==="t"?ry+m+px/2:pc[0]==="b"?ry+rh-m-px/2:ry+rh/2;
 if(t.ol){x.lineWidth=Math.max(2,px/6);x.strokeStyle="rgba(0,0,0,.75)";x.lineJoin="round";x.strokeText(t.t,tx,ty)}
 x.fillStyle=t.co;x.fillText(t.t,tx,ty);x.restore();
}
function dropAnn(){if((S.ann&&S.ann.length)||(S.rt&&S.rt.length)){S.ann=[];S.rt=[];toast(L("Drawings removed because the photo was rotated. Undo brings them back.","फोटो घुमाने से ड्रॉइंग हट गई। Undo से वापस आ जाएगी।"))}}
function rr(x,X,Y,W,H,r){r=Math.max(0,Math.min(r,W/2,H/2));x.moveTo(X+r,Y);x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath()}
function drawFrame(x,rx,ry,rw,rh,jpg){
 var f=S.fr;if(!f||(!f.w&&!f.rd))return;var m=Math.min(rw,rh),bw=m*f.w/100,r=m*f.rd/100;
 x.save();
 if(bw>0){x.fillStyle=f.c;x.beginPath();rr(x,rx,ry,rw,rh,r);rr(x,rx+bw,ry+bw,rw-2*bw,rh-2*bw,Math.max(0,r-bw));x.fill("evenodd")}
 if(r>0){x.globalCompositeOperation="destination-out";x.beginPath();x.rect(rx,ry,rw,rh);rr(x,rx,ry,rw,rh,r);x.fill("evenodd");
  if(jpg){x.globalCompositeOperation="destination-over";x.fillStyle="#fff";x.fillRect(rx,ry,rw,rh)}}
 x.restore();
}
function lum(h){var n=parseInt(h.slice(1),16);return(.299*(n>>16)+.587*((n>>8)&255)+.114*(n&255))}
function drawAnn(x,W,H){
 var m=Math.min(W,H),mt=x.getTransform();
 S.ann.forEach(function(a){
  x.save();x.lineCap="round";x.lineJoin="round";x.strokeStyle=x.fillStyle=a.c||"#ef4444";x.lineWidth=Math.max(1,(a.w||.008)*m);
  if(a.k==="pen"&&a.p.length){x.beginPath();var p=a.p;x.moveTo(p[0][0]*W,p[0][1]*H);
   if(p.length===1)x.lineTo(p[0][0]*W+.01,p[0][1]*H);
   for(var i=1;i<p.length-1;i++){var mx=(p[i][0]+p[i+1][0])/2*W,my=(p[i][1]+p[i+1][1])/2*H;x.quadraticCurveTo(p[i][0]*W,p[i][1]*H,mx,my)}
   if(p.length>1)x.lineTo(p[p.length-1][0]*W,p[p.length-1][1]*H);x.stroke()}
  else if(a.k==="rect"){x.strokeRect(a.x*W,a.y*H,a.w2*W,a.h2*H)}
  else if(a.k==="ell"){x.beginPath();x.ellipse((a.x+a.w2/2)*W,(a.y+a.h2/2)*H,Math.abs(a.w2*W/2),Math.abs(a.h2*H/2),0,0,2*PI);x.stroke()}
  else if(a.k==="arrow"){
   var x0=a.x*W,y0=a.y*H,x1=a.x2*W,y1=a.y2*H,ang=Math.atan2(y1-y0,x1-x0),hl=Math.max(x.lineWidth*4,m*.03);
   x.beginPath();x.moveTo(x0,y0);x.lineTo(x1-Math.cos(ang)*hl*.6,y1-Math.sin(ang)*hl*.6);x.stroke();
   x.beginPath();x.moveTo(x1,y1);x.lineTo(x1-hl*Math.cos(ang-.45),y1-hl*Math.sin(ang-.45));x.lineTo(x1-hl*Math.cos(ang+.45),y1-hl*Math.sin(ang+.45));x.closePath();x.fill()}
  else if(a.k==="text"){
   var px=Math.max(8,a.s*m);x.font="700 "+px+"px "+(FONTS[a.f]||FONTS.sans);x.textBaseline="middle";x.textAlign="left";
   x.lineWidth=Math.max(2,px/7);x.strokeStyle=lum(a.c)>140?"rgba(0,0,0,.8)":"rgba(255,255,255,.85)";x.strokeText(a.t,a.x*W,a.y*H);x.fillText(a.t,a.x*W,a.y*H)}
  else if(a.k==="hide"){
   var rx=Math.min(a.x,a.x+a.w2)*W,ry=Math.min(a.y,a.y+a.h2)*H,rw=Math.abs(a.w2)*W,rh=Math.abs(a.h2)*H,sc=mt.a;
   var dx=Math.max(0,Math.floor(rx*sc+mt.e)),dy=Math.max(0,Math.floor(ry*sc+mt.f)),dw=Math.min(x.canvas.width-dx,Math.ceil(rw*sc)),dh=Math.min(x.canvas.height-dy,Math.ceil(rh*sc));
   if(dw>2&&dh>2){
    var b=Math.max(6,Math.round(Math.max(dw,dh)/9)),t=document.createElement("canvas");t.width=Math.max(1,Math.ceil(dw/b));t.height=Math.max(1,Math.ceil(dh/b));
    var tx=t.getContext("2d");tx.imageSmoothingEnabled=true;tx.drawImage(x.canvas,dx,dy,dw,dh,0,0,t.width,t.height);
    x.setTransform(1,0,0,1,0,0);x.imageSmoothingEnabled=false;x.drawImage(t,0,0,t.width,t.height,dx,dy,dw,dh);
   }}
  x.restore();
 });
}
/* ---------- preview ---------- */
var raf=0;
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render)}
function render(){
 if(!im)return;
 var key=S.rot+"|"+S.fx+"|"+S.fy+"|"+S.ang;
 if(key!==bk){base=transformed(900);bk=key;pk="";if(S.ratio)fitRatio();placeCrop()}
 var cv=$("cv"),x=cv.getContext("2d");cv.width=base.width;cv.height=base.height;
 var pkey=key+JSON.stringify(params())+JSON.stringify(S.rb);
 if(pkey!==pk){pc=pc||document.createElement("canvas");pc.width=base.width;pc.height=base.height;var px=pc.getContext("2d");px.clearRect(0,0,pc.width,pc.height);px.drawImage(base,0,0);var id=px.getImageData(0,0,pc.width,pc.height);if(S.rb.on)DTAfx.cutout(id,S.rb);DTAfx.process(id,params());px.putImageData(id,0,0);pk=pkey}
 x.drawImage(pc,0,0);drawAnn(x,cv.width,cv.height);
 var c=S.crop;drawText(x,cv.width,cv.height,c.x*cv.width,c.y*cv.height,c.w*cv.width,c.h*cv.height);
 drawFrame(x,c.x*cv.width,c.y*cv.height,c.w*cv.width,c.h*cv.height,false);
 guide(x,cv.width,cv.height);
 if(cmp){var o=$("cvo");o.width=base.width;o.height=base.height;o.getContext("2d").drawImage(base,0,0);clip()}
}
function guide(x,W,H){
 if($("pFoc").hidden||S.fb.t==="off")return;var f=S.fb,m=Math.min(W,H),cx=f.x*W,cy=f.y*H,R=f.r*m;
 x.save();x.lineWidth=Math.max(2,m/260);x.setLineDash([m/60,m/60]);x.strokeStyle="#fff";x.shadowColor="rgba(0,0,0,.7)";x.shadowBlur=4;
 if(f.t==="r"){x.beginPath();x.arc(cx,cy,R,0,2*PI);x.stroke()}
 else{var a=f.an*PI/180,ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux,L=W+H;[-1,1].forEach(function(sg){x.beginPath();x.moveTo(cx+nx*R*sg-ux*L,cy+ny*R*sg-uy*L);x.lineTo(cx+nx*R*sg+ux*L,cy+ny*R*sg+uy*L);x.stroke()})}
 x.setLineDash([]);x.beginPath();x.arc(cx,cy,m/90,0,2*PI);x.fillStyle="#fff";x.fill();x.restore();
}
function clip(){var v=+$("cmpr").value;$("cvo").style.clipPath="inset(0 "+(100-v)+"% 0 0)";$("cdiv").style.left=v+"%"}
$("cmpb").onclick=function(){cmp=!cmp;this.setAttribute("aria-pressed",cmp?"true":"false");$("cvo").hidden=!cmp;$("cdiv").hidden=!cmp;$("cmpr").hidden=!cmp;schedule()};
$("cmpr").addEventListener("input",clip);
/* ---------- crop box ---------- */
function placeCrop(){
 var b=$("cbx");if(!im||!base){return}
 var c=S.crop;b.hidden=false;b.style.left=c.x*100+"%";b.style.top=c.y*100+"%";b.style.width=c.w*100+"%";b.style.height=c.h*100+"%";
}
(function(){
 var drag=null,wrap=$("cmpw");
 function frac(e){var r=wrap.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
 function down(e){
  if(!im)return;var h=e.target.dataset&&e.target.dataset.h,p=frac(e),c=S.crop;
  if(h){var ax=h[1]==="w"?c.x+c.w:c.x,ay=h[0]==="n"?c.y+c.h:c.y;drag={m:"r",ax:ax,ay:ay}}
  else if(e.target.id==="cbx"){drag={m:"m",ox:p.x-c.x,oy:p.y-c.y}}
  else return;
  wrap.setPointerCapture&&wrap.setPointerCapture(e.pointerId);e.preventDefault();
 }
 function move(e){
  if(!drag)return;var p=frac(e),c=S.crop;
  if(drag.m==="m"){c.x=Math.min(1-c.w,Math.max(0,p.x-drag.ox));c.y=Math.min(1-c.h,Math.max(0,p.y-drag.oy))}
  else{
   var px=Math.min(1,Math.max(0,p.x)),py=Math.min(1,Math.max(0,p.y)),sx=px>=drag.ax?1:-1,sy=py>=drag.ay?1:-1,
    mw=sx>0?1-drag.ax:drag.ax,mh=sy>0?1-drag.ay:drag.ay,w=Math.abs(px-drag.ax),h=Math.abs(py-drag.ay),W=base.width,H=base.height;
   if(S.ratio){w=Math.min(w,mw,mh*S.ratio*H/W);h=w*W/(S.ratio*H)}else{w=Math.min(w,mw);h=Math.min(h,mh)}
   w=Math.max(.05,w);h=Math.max(.05,h);
   c.w=w;c.h=h;c.x=sx>0?drag.ax:drag.ax-w;c.y=sy>0?drag.ay:drag.ay-h;
  }
  placeCrop();schedule();
 }
 function up(){if(drag){drag=null;commit()}}
 wrap.addEventListener("pointerdown",down);wrap.addEventListener("pointermove",move);wrap.addEventListener("pointerup",up);wrap.addEventListener("pointercancel",up);
})();
/* ---------- controls ---------- */
document.querySelectorAll(".ie-tabs .chip").forEach(function(b){b.onclick=function(){
 document.querySelectorAll(".ie-tabs .chip").forEach(function(x){var on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-selected",on?"true":"false");$(x.dataset.tab).hidden=!on})}});
function geo(f){return function(){dropAnn();f();bk="";schedule();commit()}}
$("rl").onclick=geo(function(){S.rot=(S.rot+270)%360;S.crop={x:0,y:0,w:1,h:1}});
$("rr").onclick=geo(function(){S.rot=(S.rot+90)%360;S.crop={x:0,y:0,w:1,h:1}});
$("fh").onclick=geo(function(){S.fx=-S.fx});$("fv").onclick=geo(function(){S.fy=-S.fy});
["gr","se","iv"].forEach(function(k){$(k).onclick=function(){S[k]=S[k]?0:1;S.flt="custom";syncUI();schedule();commit()}});
$("s_ang").addEventListener("input",function(){bk=""});
$("auto").onclick=function(){
 var c=document.createElement("canvas");c.width=base.width;c.height=base.height;var x=c.getContext("2d");x.drawImage(base,0,0);
 var r=DTAfx.autoLevels(x.getImageData(0,0,c.width,c.height));S.v.lo=r.lo;S.v.hi=r.hi;S.v.sa=Math.max(S.v.sa,8);S.v.vi=Math.max(S.v.vi,12);S.flt="none";syncUI();schedule();commit();
};
$("tx").addEventListener("input",function(){S.t.t=$("tx").value;schedule()});$("tx").addEventListener("change",commit);
[["tsz","sz"],["top","op"]].forEach(function(a){$(a[0]).addEventListener("input",function(){S.t[a[1]]=+$(a[0]).value;schedule()});$(a[0]).addEventListener("change",commit)});
$("tco").addEventListener("input",function(){S.t.co=$("tco").value;schedule()});$("tco").addEventListener("change",commit);
$("tpos").onchange=function(){S.t.pos=$("tpos").value;schedule();commit()};
$("tol").onchange=function(){S.t.ol=$("tol").checked?1:0;schedule();commit()};
pickImage($("f"),function(i,f){
 $("err").hidden=true;$("ok").hidden=true;
 if(!i){$("ctl").hidden=true;$("err").hidden=false;$("err").textContent=L("This file could not be read as an image.","यह फाइल इमेज की तरह नहीं खुली।");return}
 im=i;file=f;S=fresh();bk="";hist=[];hp=-1;$("ctl").hidden=false;$("dt").textContent=f.name;
 $("info").textContent=i.naturalWidth+" × "+i.naturalHeight+" px • "+sizeOf(f.size);
 render();syncUI();commit();
});
async function exportBlob(fm,q){
 var t=transformed(0),c=S.crop,W=t.width,H=t.height;
 if(S.rb.on){var tx=t.getContext("2d"),ti=tx.getImageData(0,0,W,H);DTAfx.cutout(ti,S.rb);tx.putImageData(ti,0,0)}
 var sx=Math.round(c.x*W),sy=Math.round(c.y*H),sw=Math.max(1,Math.min(W-sx,Math.round(c.w*W))),sh=Math.max(1,Math.min(H-sy,Math.round(c.h*H)));
 var mx=+$("mx").value||0,k=mx>0?Math.min(1,mx/Math.max(sw,sh)):1,dw=Math.max(1,Math.round(sw*k)),dh=Math.max(1,Math.round(sh*k));
 var o=document.createElement("canvas");o.width=dw;o.height=dh;var x=o.getContext("2d");x.imageSmoothingQuality="high";
 if(fm==="image/jpeg"){x.fillStyle="#fff";x.fillRect(0,0,dw,dh)}
 x.drawImage(t,sx,sy,sw,sh,0,0,dw,dh);
 var id=x.getImageData(0,0,dw,dh);DTAfx.process(id,params({x:sx/W,y:sy/H,w:sw/W,h:sh/H,W:W,H:H}));x.putImageData(id,0,0);
 if(S.ann.length){x.save();x.translate(-sx*dw/sw,-sy*dh/sh);x.scale(dw/sw,dh/sh);drawAnn(x,W,H);x.restore()}
 drawText(x,dw,dh,0,0,dw,dh);
 drawFrame(x,0,0,dw,dh,fm==="image/jpeg");
 var b=await new Promise(function(r){o.toBlob(r,fm,q)});if(!b)throw 0;return{b:b,w:dw,h:dh};
}
$("go").onclick=async function(){
 if(!im)return;var e=$("err");e.hidden=true;$("ok").hidden=true;
 try{
  var fm=$("fm").value,r=await exportBlob(fm,+$("qq").value/100);
  saveBlob(r.b,baseName(file)+"-edited."+extOf(fm));
  $("ok").hidden=false;$("ok").textContent=L("Done ✓ ","हो गया ✓ ")+r.w+" × "+r.h+" • "+sizeOf(r.b.size);
 }catch(x){e.hidden=false;e.textContent=L("Could not save. The image may be too large for this device.","सेव नहीं हो पाई। इमेज इस डिवाइस के लिए बहुत बड़ी हो सकती है।")}
};
if(navigator.clipboard&&window.ClipboardItem){$("cp").hidden=false;$("cp").onclick=async function(){
 if(!im)return;var e=$("err");e.hidden=true;$("ok").hidden=true;
 try{var r=await exportBlob("image/png",1);await navigator.clipboard.write([new ClipboardItem({"image/png":r.b})]);$("ok").hidden=false;$("ok").textContent=L("Copied ✓ Paste it in any app.","कॉपी हो गया ✓ किसी भी ऐप में पेस्ट करें।")}
 catch(x){e.hidden=false;e.textContent=L("Could not copy on this browser. Use Download instead.","इस ब्राउज़र में कॉपी नहीं हुआ। डाउनलोड इस्तेमाल करें।")}
}}
/* ---------- drawing tools ---------- */
(function(){
 var wrap=$("cmpw"),cur=null;
 function mode(){updMode()}
 document.querySelectorAll(".ie-tabs .chip").forEach(function(b){b.addEventListener("click",mode)});
 [].forEach.call($("atools").children,function(b){b.onclick=function(){tool=tool===b.dataset.tool?"":b.dataset.tool;[].forEach.call($("atools").children,function(x){x.setAttribute("aria-pressed",x.dataset.tool===tool?"true":"false")});$("atw").hidden=tool!=="text";mode();if(tool==="text")$("atx").focus()}});
 function frac(e){var r=wrap.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]}
 wrap.addEventListener("pointerdown",function(e){
  if(!im||!tool||$("pAnn").hidden||e.target.dataset&&e.target.dataset.h)return;
  var p=frac(e),col=$("acol").value,w=+$("aw").value/1000;
  if(tool==="text"){var t=$("atx").value.trim();if(!t){$("atx").focus();return}S.ann.push({k:"text",x:p[0],y:p[1],t:t,c:col,f:$("afo").value,s:Math.max(.02,w*3)});schedule();commit();e.preventDefault();return}
  if(tool==="pen")cur={k:"pen",c:col,w:w,p:[p]};
  else if(tool==="arrow")cur={k:"arrow",c:col,w:w,x:p[0],y:p[1],x2:p[0],y2:p[1]};
  else cur={k:tool,c:col,w:w,x:p[0],y:p[1],w2:0,h2:0};
  S.ann.push(cur);wrap.setPointerCapture&&wrap.setPointerCapture(e.pointerId);e.preventDefault();schedule();
 });
 wrap.addEventListener("pointermove",function(e){
  if(!cur)return;var p=frac(e);
  if(cur.k==="pen"){var l=cur.p[cur.p.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>.002)cur.p.push(p)}
  else if(cur.k==="arrow"){cur.x2=p[0];cur.y2=p[1]}
  else{cur.w2=p[0]-cur.x;cur.h2=p[1]-cur.y}
  schedule();
 });
 function up(){if(!cur)return;var c=cur;cur=null;
  var tiny=c.k==="pen"?false:c.k==="arrow"?Math.hypot(c.x2-c.x,c.y2-c.y)<.01:Math.abs(c.w2)<.01||Math.abs(c.h2)<.01;
  if(tiny)S.ann.pop();schedule();commit()}
 wrap.addEventListener("pointerup",up);wrap.addEventListener("pointercancel",up);
 $("alast").onclick=function(){if(S.ann.length){S.ann.pop();schedule();commit()}};
 $("aclr").onclick=function(){if(S.ann.length){S.ann=[];schedule();commit()}};
 document.addEventListener("keydown",function(e){
  var el=document.activeElement,typing=el&&(el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&/text|number|search/.test(el.type)));
  if(typing||!im||!(e.ctrlKey||e.metaKey))return;var k=e.key.toLowerCase();
  if(k==="z"&&!e.shiftKey){e.preventDefault();$("undo").click()}else if(k==="y"||(k==="z"&&e.shiftKey)){e.preventDefault();$("redo").click()}
 });
})();

/* ---------- pro tools: curves, colour mix, retouch, focus, cut-out, frame ---------- */
var ch="m",cvd=null,HN=[["Red","लाल","#ef4444"],["Orange","नारंगी","#f97316"],["Yellow","पीला","#eab308"],["Green","हरा","#22c55e"],["Aqua","आसमानी","#06b6d4"],["Blue","नीला","#3b82f6"],["Purple","बैंगनी","#8b5cf6"],["Magenta","गुलाबी","#ec4899"]],hb=0;
var cvc=$("cvc"),cx2=cvc.getContext("2d");
function drawCurve(){
 var W=cvc.width,pts=S.cv[ch],col=ch==="r"?"#ef4444":ch==="g"?"#22c55e":ch==="b"?"#3b82f6":"#9ca3af",l=DTAfx.lut(pts),i;
 cx2.clearRect(0,0,W,W);cx2.lineWidth=2;cx2.strokeStyle="rgba(128,128,128,.3)";
 for(i=1;i<4;i++){cx2.beginPath();cx2.moveTo(i*W/4,0);cx2.lineTo(i*W/4,W);cx2.moveTo(0,i*W/4);cx2.lineTo(W,i*W/4);cx2.stroke()}
 cx2.beginPath();cx2.moveTo(0,W);cx2.lineTo(W,0);cx2.stroke();
 cx2.lineWidth=5;cx2.strokeStyle=col;cx2.beginPath();for(i=0;i<256;i++){var X=i/255*W,Y=W-l[i]/255*W;i?cx2.lineTo(X,Y):cx2.moveTo(X,Y)}cx2.stroke();
 pts.forEach(function(q){cx2.beginPath();cx2.arc(q[0]/255*W,W-q[1]/255*W,13,0,2*PI);cx2.fillStyle=col;cx2.fill();cx2.lineWidth=4;cx2.strokeStyle="#fff";cx2.stroke()});
}
(function(){
 function pos(e){var r=cvc.getBoundingClientRect();return[Math.round(Math.min(255,Math.max(0,(e.clientX-r.left)/r.width*255))),Math.round(Math.min(255,Math.max(0,255-(e.clientY-r.top)/r.height*255)))]}
 function near(p){var pts=S.cv[ch],k=-1,b=22;pts.forEach(function(q,i){var d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<b){b=d;k=i}});return k}
 cvc.addEventListener("pointerdown",function(e){
  if(!im)return;var p=pos(e),k=near(p),pts=S.cv[ch];
  if(k<0){pts.push(p);pts.sort(function(a,b){return a[0]-b[0]});k=pts.indexOf(p)}
  cvd=k;cvc.setPointerCapture&&cvc.setPointerCapture(e.pointerId);e.preventDefault();upCurve();
 });
 cvc.addEventListener("pointermove",function(e){
  if(cvd===null)return;var p=pos(e),pts=S.cv[ch],q=pts[cvd],last=pts.length-1;
  q[1]=p[1];if(cvd>0&&cvd<last)q[0]=Math.min(pts[cvd+1][0]-3,Math.max(pts[cvd-1][0]+3,p[0]));
  upCurve();
 });
 function end(){if(cvd!==null){cvd=null;commit()}}
 cvc.addEventListener("pointerup",end);cvc.addEventListener("pointercancel",end);
 cvc.addEventListener("dblclick",function(e){var p=pos(e),k=near(p),pts=S.cv[ch];if(k>0&&k<pts.length-1){pts.splice(k,1);upCurve();commit()}});
 function upCurve(){S.flt="custom";drawCurve();schedule()}
 [].forEach.call($("cvch").querySelectorAll("[data-ch]"),function(b){b.onclick=function(){ch=b.dataset.ch;syncPro()}});
 $("cvrs").onclick=function(){S.cv[ch]=[[0,0],[255,255]];drawCurve();schedule();commit()};
})();
HN.forEach(function(a,i){var b=document.createElement("button");b.type="button";b.className="chip";b.setAttribute("aria-pressed",i?"false":"true");b.dataset.en=a[0];b.dataset.hi=a[1];b.textContent=a[0];b.style.borderColor=a[2];
 b.onclick=function(){hb=i;syncPro()};$("hsb").appendChild(b)});
[["Hue","रंगत"],["Saturation","गहराई"],["Brightness","चमक"]].forEach(function(a,k){
 var d=document.createElement("div");d.innerHTML='<label for="hs'+k+'"><span data-en="'+a[0]+'" data-hi="'+a[1]+'">'+a[0]+'</span><b id="hn'+k+'">0</b></label><input id="hs'+k+'" type="range" min="-100" max="100" value="0">';$("sl-hs").appendChild(d);
 var r=d.querySelector("input");r.addEventListener("input",function(){S.hs[hb][k]=+r.value;$("hn"+k).textContent=r.value;S.flt="custom";schedule()});r.addEventListener("change",commit);
 r.addEventListener("dblclick",function(){r.value=0;S.hs[hb][k]=0;$("hn"+k).textContent=0;schedule();commit()});
});
$("hsrs").onclick=function(){S.hs=S.hs.map(function(){return[0,0,0]});syncPro();schedule();commit()};
function syncPro(){
 if(!S)return;
 [].forEach.call($("cvch").querySelectorAll("[data-ch]"),function(b){b.setAttribute("aria-pressed",b.dataset.ch===ch?"true":"false")});
 drawCurve();
 [].forEach.call($("hsb").children,function(b,i){b.setAttribute("aria-pressed",i===hb?"true":"false")});
 for(var k=0;k<3;k++){$("hs"+k).value=S.hs[hb][k];$("hn"+k).textContent=S.hs[hb][k]}
 var f=S.fb;[].forEach.call($("fbt").children,function(b){b.setAttribute("aria-pressed",b.dataset.fb===f.t?"true":"false")});
 $("fba").value=f.am;$("fbr").value=Math.round(f.r*100);$("fbn").value=f.an;
 var r=S.rb;$("rbon").checked=!!r.on;$("rbc").value="#"+r.c.map(function(v){return("0"+Math.round(v).toString(16)).slice(-2)}).join("");$("rbt").value=r.tol;$("rbs").value=r.so;$("rbl").checked=!!r.all;
 $("frw").value=S.fr.w;$("frr").value=S.fr.rd;$("frc").value=S.fr.c;
 updMode();
}
/* retouch */
(function(){
 var wrap=$("cmpw"),cur=null;
 [].forEach.call($("rtools").children,function(b){b.onclick=function(){rtool=rtool===b.dataset.rt?"":b.dataset.rt;[].forEach.call($("rtools").children,function(x){x.setAttribute("aria-pressed",x.dataset.rt===rtool?"true":"false")});updMode()}});
 document.querySelectorAll(".ie-tabs .chip").forEach(function(b){b.addEventListener("click",updMode)});
 function frac(e){var r=wrap.getBoundingClientRect();return[Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))]}
 wrap.addEventListener("pointerdown",function(e){
  if(!im||e.target.dataset&&e.target.dataset.h)return;var p=frac(e);
  if(!$("pRet").hidden&&rtool){cur={m:rtool,s:+$("rsz").value/300,a:+$("rst").value,p:[p]};S.rt.push(cur);S.flt="custom"}
  else if(!$("pFoc").hidden&&S.fb.t!=="off"){cur="f";S.fb.x=p[0];S.fb.y=p[1]}
  else if(!$("pCut").hidden&&picking){
   var c=document.createElement("canvas").getContext("2d");c.canvas.width=c.canvas.height=1;c.drawImage(base,p[0]*base.width,p[1]*base.height,1,1,0,0,1,1);var d=c.getImageData(0,0,1,1).data;
   S.rb.c=[d[0],d[1],d[2]];S.rb.on=1;picking=false;$("rbp").setAttribute("aria-pressed","false");syncPro();schedule();commit();e.preventDefault();return}
  else return;
  wrap.setPointerCapture&&wrap.setPointerCapture(e.pointerId);e.preventDefault();schedule();
 });
 wrap.addEventListener("pointermove",function(e){
  if(!cur)return;var p=frac(e);
  if(cur==="f"){S.fb.x=p[0];S.fb.y=p[1]}else{var l=cur.p[cur.p.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])>.003)cur.p.push(p)}
  schedule();
 });
 function up(){if(cur){cur=null;schedule();commit()}}
 wrap.addEventListener("pointerup",up);wrap.addEventListener("pointercancel",up);
 $("rlast").onclick=function(){if(S.rt.length){S.rt.pop();schedule();commit()}};
 $("rclr").onclick=function(){if(S.rt.length){S.rt=[];schedule();commit()}};
})();
/* focus blur */
[].forEach.call($("fbt").children,function(b){b.onclick=function(){S.fb.t=b.dataset.fb;syncPro();schedule();commit()}});
[["fba","am",1],["fbr","r",.01],["fbn","an",1]].forEach(function(a){var e=$(a[0]);e.addEventListener("input",function(){S.fb[a[1]]=+e.value*a[2];schedule()});e.addEventListener("change",commit)});
/* cut-out */
function rbSet(){S.rb.on=$("rbon").checked?1:0;S.rb.tol=+$("rbt").value;S.rb.so=+$("rbs").value;S.rb.all=$("rbl").checked?1:0;schedule()}
["rbon","rbl"].forEach(function(i){$(i).onchange=function(){rbSet();commit()}});
["rbt","rbs"].forEach(function(i){$(i).addEventListener("input",rbSet);$(i).addEventListener("change",commit)});
$("rbc").addEventListener("input",function(){var n=parseInt($("rbc").value.slice(1),16);S.rb.c=[n>>16,(n>>8)&255,n&255];S.rb.on=1;$("rbon").checked=true;schedule()});$("rbc").addEventListener("change",commit);
$("rbp").onclick=function(){picking=!picking;this.setAttribute("aria-pressed",picking?"true":"false");updMode()};
$("rba").onclick=function(){
 var c=document.createElement("canvas").getContext("2d"),W=base.width,H=base.height,k=4,r=[0,0,0],n=0;c.canvas.width=c.canvas.height=1;
 [[0,0],[W-k,0],[0,H-k],[W-k,H-k]].forEach(function(q){c.drawImage(base,q[0],q[1],k,k,0,0,1,1);var d=c.getImageData(0,0,1,1).data;r[0]+=d[0];r[1]+=d[1];r[2]+=d[2];n++});
 S.rb.c=r.map(function(v){return Math.round(v/n)});S.rb.on=1;syncPro();schedule();commit();
};
/* frame */
[["frw","w"],["frr","rd"]].forEach(function(a){var e=$(a[0]);e.addEventListener("input",function(){S.fr[a[1]]=+e.value;schedule()});e.addEventListener("change",commit)});
$("frc").addEventListener("input",function(){S.fr.c=$("frc").value;schedule()});$("frc").addEventListener("change",commit);
/* fonts and stickers */
$("tfo").onchange=function(){S.t.fo=$("tfo").value;schedule();commit()};
"😀 😍 😎 🔥 ⭐ ❤️ 👍 🎉 ✅ ❌ 📍 💯".split(" ").forEach(function(e){var b=document.createElement("button");b.type="button";b.className="chip";b.textContent=e;b.setAttribute("aria-label","Sticker "+e);
 b.onclick=function(){$("atx").value=e;var t=document.querySelector('#atools [data-tool=text]');if(tool!=="text")t.click();$("atx").value=e};$("stk").appendChild(b)});
document.addEventListener("langchange",function(){schedule()});

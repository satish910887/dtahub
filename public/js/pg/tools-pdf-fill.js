var pdfjs=null,doc=null,bytes=null,file=null,tool=null,items=[],sel=null,ink="#111111",sigData=null,uid=0,PG=[],IM={},FV={},FD={},hist=[],hp=-1,hasForm=false;
var DRAG={hl:1,white:1,redact:1,box:1,oval:1,line:1,arrow:1,pen:1},SHAPE={hl:1,white:1,redact:1,box:1,oval:1},LINEY={line:1,arrow:1,pen:1},TXT={text:1,date:1,stamp:1};
function msg(id,t){var e=$(id);e.hidden=!t;if(t)e.textContent=t}
async function lib(){if(!pdfjs){pdfjs=DTApdfView}return pdfjs}
var FONTMAP={h:["Helvetica","HelveticaBold","HelveticaOblique","HelveticaBoldOblique"],t:["TimesRoman","TimesRomanBold","TimesRomanItalic","TimesRomanBoldItalic"],c:["Courier","CourierBold","CourierOblique","CourierBoldOblique"]};
var CSSF={h:"Arial,Helvetica,sans-serif",t:"'Times New Roman',Times,serif",c:"'Courier New',Courier,monospace"};
function fidx(it){return(it.b?1:0)+(it.i?2:0)}
function stdName(it){var a=FONTMAP[it.f||"h"];return a[it.b&&it.i?3:it.i?2:it.b?1:0]}
$("f").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;msg("err","");msg("ok","");
 try{
  $("dt").textContent=L("Opening...","खोल रहे हैं...");
  var P=await lib();bytes=new Uint8Array(await f.arrayBuffer());file=f;
  doc=await P.getDocument({isEvalSupported:false,data:bytes.slice()}).promise;
  items=[];sel=null;PG=[];FV={};FD={};hist=[];hp=-1;$("pages").textContent="";
  var maxW=Math.min(820,Math.max(260,($("pages").parentNode.clientWidth||340)-4)),io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);draw(+e.target.dataset.i)}})},{rootMargin:"500px"});
  var n=Math.min(doc.numPages,200);
  for(var i=1;i<=n;i++){
   var p=await doc.getPage(i),vp=p.getViewport({scale:1}),sc=maxW/vp.width,d=document.createElement("div");
   d.className="fpg";d.dataset.i=i-1;d.style.width=maxW+"px";d.style.height=Math.round(vp.height*sc)+"px";
   PG[i-1]={page:p,scale:sc,el:d,w:vp.width,h:vp.height};
   d.addEventListener("click",place);d.addEventListener("pointerdown",dstart);$("pages").appendChild(d);io.observe(d);
  }
  $("ctl").hidden=false;$("dt").textContent=f.name;
  $("info").textContent=doc.numPages+L(" page(s)"," पन्ने")+(doc.numPages>200?L(" (first 200 shown, edits still apply to the first 200)"," (पहले 200 दिख रहे हैं)"):"")+" • "+sizeOf(f.size);
  hasForm=false;$("ffi").hidden=true;
  try{var tmp=DTApdf.Doc.load(bytes.slice()),nf=tmp.getForm().getFields().length;if(nf){hasForm=true;$("ffi").hidden=false;$("ffi").textContent=L("This PDF has "+nf+" fillable fields. Tap the blue boxes on the pages to fill them.","इस PDF में "+nf+" भरने वाले फील्ड हैं। पन्नों पर नीले बॉक्स पर टैप करके भरें।")}}catch(e){}
  $("xrdw").hidden=true;commit(true);setTool(null);sync();
 }catch(e){
  $("ctl").hidden=true;$("dt").textContent=L("Tap to choose a PDF","PDF चुनने के लिए टैप करें");
  msg("err",e&&e.name==="PasswordException"?L("This PDF is password protected.","यह PDF पासवर्ड वाली है।"):L("Could not open this PDF.","यह PDF नहीं खुली।"));
 }
});
async function draw(i){
 var g=PG[i];if(!g||g.done)return;g.done=1;
 var dpr=Math.min(2,window.devicePixelRatio||1),vp=g.page.getViewport({scale:g.scale*dpr}),c=document.createElement("canvas");
 c.width=Math.round(vp.width);c.height=Math.round(vp.height);c.style.width="100%";c.style.height="100%";c.style.display="block";
 g.el.insertBefore(c,g.el.firstChild);
 try{await g.page.render({canvasContext:c.getContext("2d"),viewport:vp,annotationMode:2}).promise}catch(e){}
 if(hasForm)widgets(g,i);
}
/* ---------- on-page form fields ---------- */
async function widgets(g,pi){
 var an;try{an=await g.page.getAnnotations({intent:"display"})}catch(e){return}
 var vp=g.page.getViewport({scale:g.scale});
 an.forEach(function(a){
  if(a.subtype!=="Widget"||!a.fieldName||a.readOnly||a.pushButton||a.fieldType==="Sig"||a.hidden)return;
  var r=vp.convertToViewportRectangle(a.rect),x=Math.min(r[0],r[2]),y=Math.min(r[1],r[3]),w=Math.abs(r[2]-r[0]),h=Math.abs(r[3]-r[1]),nm=a.fieldName,e;
  if(w<6||h<6)return;
  if(a.fieldType==="Tx"){
   e=document.createElement(a.multiLine?"textarea":"input");if(!a.multiLine)e.type="text";
   var v=FV[nm]!==undefined?FV[nm]:(Array.isArray(a.fieldValue)?a.fieldValue.join(", "):(a.fieldValue||""));e.value=v;if(a.maxLen)e.maxLength=a.maxLen;
   e.style.fontSize=Math.max(8,Math.min(a.multiLine?14*g.scale:h*.68,18*g.scale+4))+"px";
   e.addEventListener("input",function(){FV[nm]=e.value;FD[nm]=1});
  }else if(a.fieldType==="Btn"){
   e=document.createElement("button");e.type="button";var rad=!!a.radioButton,bv=a.buttonValue;
   var on=function(){return rad?FV[nm]===bv:!!FV[nm]};
   if(FV[nm]===undefined){FV[nm]=rad?(a.fieldValue===bv?bv:""):(a.fieldValue&&a.fieldValue!=="Off"&&a.fieldValue!==false)}
   var paint=function(){e.textContent=on()?(rad?"●":"✓"):"";e.setAttribute("aria-pressed",on()?"true":"false")};
   e.setAttribute("role",rad?"radio":"checkbox");e.setAttribute("aria-label",nm);e.style.fontSize=Math.max(10,Math.min(h,w)*.8)+"px";paint();
   e.onclick=function(ev){ev.stopPropagation();if(rad)FV[nm]=bv;else FV[nm]=!FV[nm];FD[nm]=1;document.querySelectorAll('[data-fn="'+CSS.escape(nm)+'"]').forEach(function(q){q.__p&&q.__p()});};
   e.__p=paint;
  }else if(a.fieldType==="Ch"){
   e=document.createElement("select");var o=a.options||[];
   o.forEach(function(q){var op=document.createElement("option");op.value=q.exportValue;op.textContent=q.displayValue||q.exportValue;e.appendChild(op)});
   var fv=FV[nm]!==undefined?FV[nm]:(Array.isArray(a.fieldValue)?a.fieldValue[0]:a.fieldValue);if(fv!==undefined)e.value=fv;
   e.style.fontSize=Math.max(8,Math.min(h*.65,16))+"px";
   e.addEventListener("change",function(){FV[nm]=e.value;FD[nm]=1});
  }else return;
  e.className="fw";e.dataset.fn=nm;e.style.left=x+"px";e.style.top=y+"px";e.style.width=w+"px";e.style.height=h+"px";
  if(!e.getAttribute("aria-label"))e.setAttribute("aria-label",nm);
  e.addEventListener("click",function(ev){ev.stopPropagation()});e.addEventListener("pointerdown",function(ev){ev.stopPropagation()});
  g.el.appendChild(e);
 });
}
/* ---------- tools ---------- */
var HINT={text:["Now tap on the page where you want the text.","अब पन्ने पर जहां टेक्स्ट चाहिए वहां टैप करें।"],drag:["Drag on the page to draw it.","बनाने के लिए पन्ने पर खींचें।"],place:["Now tap on the page where you want it.","अब पन्ने पर जहां चाहिए वहां टैप करें।"]};
function setTool(t){
 tool=tool===t?null:t;
 document.querySelectorAll("[data-t]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.t===tool?"true":"false")});
 hint();
 document.querySelectorAll(".fpg").forEach(function(g){g.classList.toggle("dt",!!(tool&&DRAG[tool]))});
 if(tool==="sig"){if(!sigData)$("sigp").hidden=false;else $("sigp").hidden=true}else $("sigp").hidden=true;
 if(tool==="img"){$("imf").value="";$("imf").click()}
}
function hint(){var h=!tool?[ "Pick a tool, or tap the blue boxes to fill the form.","टूल चुनें, या फॉर्म भरने के लिए नीले बॉक्स पर टैप करें।"]:DRAG[tool]?HINT.drag:HINT.place;$("th").textContent=L(h[0],h[1])}
document.querySelectorAll("[data-t]").forEach(function(b){b.onclick=function(){setTool(b.dataset.t)}});
document.addEventListener("langchange",hint);
document.querySelectorAll("[data-ink]").forEach(function(b){b.onclick=function(){setInk(b.dataset.ink,b)}});
$("ic").addEventListener("input",function(){setInk($("ic").value,null)});
function setInk(c,b){ink=c;$("ic").value=c;document.querySelectorAll("[data-ink]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});if(sel&&sel.type!=="white"&&sel.type!=="redact"&&sel.type!=="sig"&&sel.type!=="img"){sel.ink=c;mount(sel);commit()}}
function today(){var d=new Date();return("0"+d.getDate()).slice(-2)+"/"+("0"+(d.getMonth()+1)).slice(-2)+"/"+d.getFullYear()}
function pos(g,e){var r=g.el.getBoundingClientRect();return[(e.clientX-r.left)/g.scale,(e.clientY-r.top)/g.scale]}
function hlCol(){return ink==="#111111"?"#ffe14d":ink}
/* click-to-place */
function place(e){
 if(!tool||DRAG[tool]||tool==="img"&&!IM.pick)return;
 var hit=e.target.closest&&e.target.closest(".it");if(hit&&!hit.classList.contains("shp"))return;
 if(e.target.closest&&e.target.closest(".fw"))return;
 var pi=+this.dataset.i,g=PG[pi],q=pos(g,e),x=q[0],y=q[1];
 var it={id:++uid,page:pi,type:tool,x:x,y:y,ink:ink,size:tool==="tick"||tool==="cross"?18:14,text:tool==="date"?today():"",f:"h"};
 if(tool==="sig"){if(!sigData){$("sigp").hidden=false;return}IM.sig=sigData;it.dk="sig";it.w=140;it.h=140*sigData.h/sigData.w;it.y-=it.h/2;it.x-=it.w/2}
 else if(tool==="img"){var im=IM.pick;IM[im.k]=im;it.dk=im.k;it.w=Math.min(160,g.w*.4);it.h=it.w*im.h/im.w;it.x-=it.w/2;it.y-=it.h/2}
 else if(tool==="stamp"){it.text=$("stp").value;it.b=1;it.size=18;it.box=1;if(ink==="#111111")it.ink="#d92d20";it.y-=it.size*.9;it.x-=it.size*3}
 else if(tool==="text"||tool==="date"){it.y-=it.size*.6}
 else{it.x-=it.size/2;it.y-=it.size/2}
 clamp(it);items.push(it);mount(it);select(it);commit();
 var t=tool;if(t==="sig"||t==="img"||t==="stamp"||t==="tick"||t==="cross"||t==="date"){}
 if(t==="text"){var n=PG[pi].el.querySelector('[data-id="'+it.id+'"] .tx');if(n)n.focus()}
}
/* drag-to-draw */
var cur=null;
function dstart(e){
 if(!tool||!DRAG[tool]||e.target.closest(".it")&&!e.target.closest(".it").classList.contains("shp")||e.target.closest(".fw"))return;
 if(e.target.closest(".x,.mv,.rz"))return;
 var g=PG[+this.dataset.i],q=pos(g,e),it={id:++uid,page:+this.dataset.i,type:tool,x:q[0],y:q[1],ink:tool==="hl"?hlCol():ink,w:0,h:0,lw:tool==="pen"?2.5:2};
 if(LINEY[tool]){it.x2=q[0];it.y2=q[1];if(tool==="pen")it.pts=[[q[0],q[1]]]}
 cur={it:it,g:g,sx:q[0],sy:q[1]};items.push(it);mount(it);this.setPointerCapture&&this.setPointerCapture(e.pointerId);e.preventDefault();
}
document.addEventListener("pointermove",function(e){
 if(!cur)return;var q=pos(cur.g,e),it=cur.it;
 if(SHAPE[it.type]){it.x=Math.min(cur.sx,q[0]);it.y=Math.min(cur.sy,q[1]);it.w=Math.abs(q[0]-cur.sx);it.h=Math.abs(q[1]-cur.sy)}
 else if(it.type==="pen"){var l=it.pts[it.pts.length-1];if(Math.hypot(q[0]-l[0],q[1]-l[1])>1.5)it.pts.push(q)}
 else{it.x2=q[0];it.y2=q[1]}
 mount(it);
});
function dend(){
 if(!cur)return;var it=cur.it;cur=null;
 var tiny=SHAPE[it.type]?(it.w<4||it.h<4):it.type==="pen"?it.pts.length<2:Math.hypot(it.x2-it.x,it.y2-it.y)<4;
 if(tiny){remove(it,true);return}
 select(it);commit();
}
document.addEventListener("pointerup",dend);document.addEventListener("pointercancel",dend);
function bbox(it){
 if(it.type==="pen"){var xs=it.pts.map(function(p){return p[0]}),ys=it.pts.map(function(p){return p[1]});return{x:Math.min.apply(0,xs),y:Math.min.apply(0,ys),w:Math.max.apply(0,xs)-Math.min.apply(0,xs),h:Math.max.apply(0,ys)-Math.min.apply(0,ys)}}
 if(LINEY[it.type])return{x:Math.min(it.x,it.x2),y:Math.min(it.y,it.y2),w:Math.abs(it.x2-it.x),h:Math.abs(it.y2-it.y)};
 return{x:it.x,y:it.y,w:it.w,h:it.h};
}
function clamp(it){
 var g=PG[it.page];
 if(LINEY[it.type]||SHAPE[it.type])return;
 var w=it.w||(TXT[it.type]?20:it.size),h=it.h||it.size*1.2;
 it.x=Math.max(0,Math.min(g.w-w,it.x));it.y=Math.max(0,Math.min(g.h-h,it.y));
}
function mount(it){
 var g=PG[it.page],old=g.el.querySelector('[data-id="'+it.id+'"]'),d=old||document.createElement("div"),k=g.scale,T=it.type;
 var cls="it "+(SHAPE[T]||LINEY[T]?"shp ":"txt ")+({hl:"hl",white:"wh",redact:"rd",box:"bx",oval:"ov bx"}[T]||"")+(T==="stamp"?" stp":"")+(sel===it?" sel":"");
 d.className=cls;d.dataset.id=it.id;d.style.color=it.ink;
 var focus=old&&old.querySelector(".tx")===document.activeElement;
 if(TXT[T]){
  d.style.left=it.x*k+"px";d.style.top=it.y*k+"px";
  var tx=d.querySelector(".tx");
  if(!tx){tx=document.createElement("div");tx.className="tx";tx.contentEditable="true";tx.spellcheck=false;tx.setAttribute("role","textbox");tx.setAttribute("aria-label",L("Text on the page","पन्ने पर टेक्स्ट"));tx.textContent=it.text;
   tx.addEventListener("input",function(){it.text=tx.innerText.replace(/\n$/,"")});tx.addEventListener("focus",function(){select(it);tx.__v=it.text});tx.addEventListener("blur",function(){if(tx.__v!==it.text)commit()});d.appendChild(tx)}
  tx.style.fontSize=it.size*k+"px";tx.style.fontFamily=CSSF[it.f||"h"];tx.style.fontWeight=it.b?"700":"400";tx.style.fontStyle=it.i?"italic":"normal";
 }else if(T==="sig"||T==="img"){
  d.style.left=it.x*k+"px";d.style.top=it.y*k+"px";
  var im=d.querySelector("img");if(!im){im=document.createElement("img");im.alt=T==="sig"?L("Signature","हस्ताक्षर"):L("Image","इमेज");im.draggable=false;d.appendChild(im)}
  im.src=IM[it.dk].url;im.style.width=it.w*k+"px";im.style.height=it.h*k+"px";
 }else if(T==="tick"||T==="cross"){
  d.style.left=it.x*k+"px";d.style.top=it.y*k+"px";
  d.querySelector("svg")&&d.querySelector("svg").remove();
  var s=it.size*k;d.insertAdjacentHTML("afterbegin",'<svg width="'+s+'" height="'+s+'" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(T==="tick"?'<path d="M12 55 38 82 88 18"/>':'<path d="M20 20 80 80M80 20 20 80"/>')+"</svg>");
 }else if(SHAPE[T]){
  d.style.left=it.x*k+"px";d.style.top=it.y*k+"px";d.style.width=it.w*k+"px";d.style.height=it.h*k+"px";
  if(T==="hl")d.style.background=hexA(it.ink,.4);
  if(T==="box"||T==="oval")d.style.border=Math.max(1,it.lw*k)+"px solid "+it.ink;
 }else if(LINEY[T]){
  var b=bbox(it),pad=(it.lw||2)*k+10;
  d.style.left=b.x*k-pad+"px";d.style.top=b.y*k-pad+"px";d.style.width=b.w*k+2*pad+"px";d.style.height=b.h*k+2*pad+"px";
  var ox=b.x*k-pad,oy=b.y*k-pad,pts=T==="pen"?it.pts:[[it.x,it.y],[it.x2,it.y2]],dd=pts.map(function(p,i){return(i?"L":"M")+(p[0]*k-ox).toFixed(1)+" "+(p[1]*k-oy).toFixed(1)}).join(" "),head="";
  if(T==="arrow"){var a=Math.atan2(it.y2-it.y,it.x2-it.x),hl=Math.max(8,it.lw*5)*k,X=it.x2*k-ox,Y=it.y2*k-oy;head='<path d="M'+X+" "+Y+"L"+(X-hl*Math.cos(a-.45))+" "+(Y-hl*Math.sin(a-.45))+"L"+(X-hl*Math.cos(a+.45))+" "+(Y-hl*Math.sin(a+.45))+'Z" fill="currentColor"/>'}
  d.querySelector("svg")&&d.querySelector("svg").remove();
  d.insertAdjacentHTML("afterbegin",'<svg class="ln" width="'+(b.w*k+2*pad)+'" height="'+(b.h*k+2*pad)+'" aria-hidden="true"><path d="'+dd+'" fill="none" stroke="currentColor" stroke-width="'+it.lw*k+'" stroke-linecap="round" stroke-linejoin="round"/>'+head+"</svg>");
 }
 if(!d.querySelector(".x")){
  var x=document.createElement("button");x.type="button";x.className="x";x.setAttribute("aria-label",L("Delete","हटाएं"));x.textContent="×";x.onclick=function(e){e.stopPropagation();remove(it)};d.appendChild(x);
  var m=document.createElement("b");m.className="mv";m.setAttribute("aria-hidden","true");m.textContent="✥";d.appendChild(m);
  m.addEventListener("pointerdown",function(e){e.preventDefault();e.stopPropagation();select(it);var sx=e.clientX,sy=e.clientY,o=JSON.parse(JSON.stringify(it,function(kk,v){return kk==="el"?undefined:v})),moved=false;
   var mv=function(ev){moved=true;var dx=(ev.clientX-sx)/PG[it.page].scale,dy=(ev.clientY-sy)/PG[it.page].scale;
    if(it.type==="pen")it.pts=o.pts.map(function(p){return[p[0]+dx,p[1]+dy]});
    if(LINEY[it.type]){it.x=o.x+dx;it.y=o.y+dy;it.x2=o.x2+dx;it.y2=o.y2+dy}else{it.x=o.x+dx;it.y=o.y+dy;clamp(it)}
    mount(it)};
   var up=function(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);if(moved)commit()};
   document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up);document.addEventListener("pointercancel",up)});
  d.addEventListener("pointerdown",function(){select(it)});
 }
 var rz=d.querySelector(".rz");
 if(it.w&&(SHAPE[T]||T==="sig"||T==="img")){
  if(!rz){rz=document.createElement("i");rz.className="rz";rz.setAttribute("aria-hidden","true");rz.textContent="◢";d.appendChild(rz);
   rz.addEventListener("pointerdown",function(e){e.preventDefault();e.stopPropagation();select(it);var sx=e.clientX,sy=e.clientY,w0=it.w,h0=it.h,keep=T==="sig"||T==="img";
    var mv=function(ev){var dx=(ev.clientX-sx)/PG[it.page].scale,dy=(ev.clientY-sy)/PG[it.page].scale;it.w=Math.max(8,w0+dx);it.h=keep?it.w*h0/w0:Math.max(8,h0+dy);mount(it)};
    var up=function(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);commit()};
    document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up);document.addEventListener("pointercancel",up)})}
 }
 if(!old)g.el.appendChild(d);
 if(focus){var t2=d.querySelector(".tx");t2&&t2.focus()}
}
function hexA(h,a){return"rgba("+parseInt(h.slice(1,3),16)+","+parseInt(h.slice(3,5),16)+","+parseInt(h.slice(5,7),16)+","+a+")"}
function select(it){
 if(sel===it)return;var prev=sel;sel=it;
 [prev,it].forEach(function(q){if(!q)return;var e=PG[q.page].el.querySelector('[data-id="'+q.id+'"]');if(e)e.classList.toggle("sel",q===sel)});
 sync();
}
function remove(it,quiet){var e=PG[it.page].el.querySelector('[data-id="'+it.id+'"]');if(e)e.remove();items=items.filter(function(x){return x!==it});if(sel===it)sel=null;if(!quiet)commit();sync()}
function sync(){
 var t=sel&&TXT[sel.type];
 $("sf").disabled=!t;$("sb").disabled=!t;$("si").disabled=!t;
 if(t){$("sf").value=sel.f||"h";$("sb").setAttribute("aria-pressed",sel.b?"true":"false");$("si").setAttribute("aria-pressed",sel.i?"true":"false")}
 var hasRd=items.some(function(x){return x.type==="redact"});$("xrdw").hidden=!hasRd;
 $("undo").disabled=hp<=0;$("redo").disabled=hp>=hist.length-1;
}
/* ---------- undo / redo ---------- */
function snap(){return JSON.stringify(items)}
function commit(first){var j=snap();if(hist[hp]===j)return;hist=hist.slice(0,hp+1);hist.push(j);if(hist.length>80)hist.shift();hp=hist.length-1;sync()}
function restore(j){
 items=JSON.parse(j);sel=null;document.querySelectorAll(".it").forEach(function(e){e.remove()});
 var m=0;items.forEach(function(it){if(PG[it.page]){mount(it)}if(it.id>m)m=it.id});uid=Math.max(uid,m);sync();
}
$("undo").onclick=function(){if(hp>0){hp--;restore(hist[hp])}};$("redo").onclick=function(){if(hp<hist.length-1){hp++;restore(hist[hp])}};
document.addEventListener("keydown",function(e){
 var el=e.target,typing=el&&(el.isContentEditable||el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.tagName==="SELECT");
 if(typing||!doc)return;
 if(e.key==="Delete"&&sel){remove(sel)}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?$("redo").click():$("undo").click()}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();$("redo").click()}
});
/* ---------- edit selected ---------- */
$("sf").onchange=function(){if(sel&&TXT[sel.type]){sel.f=$("sf").value;mount(sel);commit()}};
$("sb").onclick=function(){if(sel&&TXT[sel.type]){sel.b=sel.b?0:1;mount(sel);sync();commit()}};
$("si").onclick=function(){if(sel&&TXT[sel.type]){sel.i=sel.i?0:1;mount(sel);sync();commit()}};
$("ap").onclick=function(){grow(1)};$("am").onclick=function(){grow(-1)};
function grow(sg){
 if(!sel)return;var t=sel.type;
 if(t==="sig"||t==="img"||SHAPE[t]){var f=sg>0?1.12:1/1.12;sel.w*=f;sel.h*=f}
 else if(LINEY[t]){sel.lw=Math.max(1,Math.min(14,sel.lw+sg*.8))}
 else sel.size=Math.max(6,Math.min(96,sel.size+sg*2));
 clamp(sel);mount(sel);commit();
}
$("dl").onclick=function(){if(sel)remove(sel)};
$("dup").onclick=function(){
 if(!sel)return;var c=JSON.parse(JSON.stringify(sel));c.id=++uid;
 if(c.pts)c.pts=c.pts.map(function(p){return[p[0]+14,p[1]+14]});c.x+=14;c.y+=14;if(LINEY[c.type]){c.x2+=14;c.y2+=14}
 items.push(c);mount(c);select(c);commit();
};
$("all").onclick=function(){
 if(!sel)return;var base=sel,n=0;
 PG.forEach(function(g,i){if(i===base.page)return;var c=JSON.parse(JSON.stringify(base));c.id=++uid;c.page=i;if(c.x+(c.w||20)>g.w||c.y+(c.h||20)>g.h)clamp(c);items.push(c);mount(c);n++});
 commit();toast(L("Added to "+n+" more page(s).","और "+n+" पन्नों पर जोड़ा गया।"));
};
/* image upload */
$("imf").addEventListener("change",function(){
 var f=this.files[0];if(!f){tool=null;setTool(null);return}
 var r=new FileReader();r.onload=function(){var i=new Image();i.onload=function(){
  var k="im"+(++uid);IM.pick={k:k,url:r.result,w:i.naturalWidth,h:i.naturalHeight,png:/png/.test(f.type)};toast(L("Image ready. Tap on the page to place it.","इमेज तैयार। पन्ने पर टैप करके लगाएं।"));
 };i.onerror=function(){toast(L("Could not read this image.","यह इमेज नहीं खुली।"),"err")};i.src=r.result};r.readAsDataURL(f);
});
/* ---------- signature pad ---------- */
var sp=$("spad"),sx=sp.getContext("2d"),drawing=false,last=null,SK="dta_sig_v1";
sx.lineWidth=5;sx.lineCap="round";sx.lineJoin="round";sx.strokeStyle="#12206b";
function sposs(e){var r=sp.getBoundingClientRect();return[(e.clientX-r.left)*sp.width/r.width,(e.clientY-r.top)*sp.height/r.height]}
sp.addEventListener("pointerdown",function(e){drawing=true;last=sposs(e);sp.setPointerCapture(e.pointerId);sx.beginPath();sx.arc(last[0],last[1],2.5,0,7);sx.fillStyle="#12206b";sx.fill();e.preventDefault()});
sp.addEventListener("pointermove",function(e){if(!drawing)return;var q=sposs(e);sx.beginPath();sx.moveTo(last[0],last[1]);sx.lineTo(q[0],q[1]);sx.stroke();last=q});
["pointerup","pointercancel"].forEach(function(n){sp.addEventListener(n,function(){drawing=false})});
$("sclr").onclick=function(){sx.clearRect(0,0,sp.width,sp.height)};
function useSig(url,w,h){sigData={url:url,w:w,h:h};IM.sig=sigData;$("sigp").hidden=true;$("ssaved").hidden=false;toast(L("Signature ready. Tap on the page to place it.","हस्ताक्षर तैयार। पन्ने पर टैप करके लगाएं।"))}
$("suse").onclick=function(){
 var d=sx.getImageData(0,0,sp.width,sp.height).data,x0=sp.width,y0=sp.height,x1=0,y1=0;
 for(var y=0;y<sp.height;y++)for(var x=0;x<sp.width;x++){if(d[(y*sp.width+x)*4+3]>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
 if(x1<=x0||y1<=y0){toast(L("Draw your signature first.","पहले हस्ताक्षर बनाएं।"),"err");return}
 var pad=6,w=x1-x0+2*pad,h=y1-y0+2*pad,c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(sp,x0-pad,y0-pad,w,h,0,0,w,h);
 var url=c.toDataURL("image/png");
 if($("ssave").checked){try{localStorage.setItem(SK,JSON.stringify({url:url,w:w,h:h}))}catch(e){}}
 useSig(url,w,h);
};
$("sedit").onclick=function(){$("sigp").hidden=false};
$("sforget").onclick=function(){try{localStorage.removeItem(SK)}catch(e){}sigData=null;delete IM.sig;$("ssaved").hidden=true;toast(L("Saved signature removed.","सेव किया हस्ताक्षर हटाया।"))};
try{var sv=JSON.parse(localStorage.getItem(SK)||"null");if(sv&&sv.url&&/^data:image\/png;base64,/.test(sv.url)){sigData=sv;IM.sig=sv;$("ssaved").hidden=false}}catch(e){}
/* ---------- export ---------- */
function rgb(h){return DTApdf.rgb(parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255)}
function geom(pg){var cb=pg.getCropRect(),r=((pg.getRotation().angle%360)+360)%360;return{x0:cb.x,y0:cb.y,W:cb.width,H:cb.height,r:r,vw:r%180?cb.height:cb.width,vh:r%180?cb.width:cb.height}}
function PT(g,x,y){switch(g.r){case 90:return[g.x0+y,g.y0+x];case 180:return[g.x0+g.W-x,g.y0+y];case 270:return[g.x0+g.W-y,g.y0+g.H-x];default:return[g.x0+x,g.y0+g.H-y]}}
function ptsOf(g,pts){return pts.map(function(p){return PT(g,p[0],p[1])})}
function ellipsePts(x,y,w,h){var o=[],n=48,i;for(i=0;i<n;i++){var a=i/n*2*Math.PI;o.push([x+w/2+Math.cos(a)*w/2,y+h/2+Math.sin(a)*h/2])}return o}
function needsRaster(fnt,lines,size){return !fnt.canEncode(lines.join(""))}
async function drawItem(pdf,pg,g,it,fonts){
 var col=rgb(it.ink||"#111111"),T=it.type,O=DTApdf;
 async function fnt(){var n=stdName(it);if(!fonts[n])fonts[n]=await pdf.embedFont(O.StandardFonts[n]);return fonts[n]}
 if(TXT[T]){
  var lines=(it.text||"").split("\n");if(!lines.join("").trim())return;
  var font=await fnt(),sz=it.size,raster=needsRaster(font,lines,sz);
  if(!raster){
   lines.forEach(function(l,j){var q=PT(g,it.x+(it.box?8:0),it.y+(it.box?2:0)+.945*sz+j*1.2*sz);pg.drawText(l,{x:q[0],y:q[1],size:sz,font:font,color:col,rotate:O.degrees(g.r)})});
   if(it.box){var wd=0;lines.forEach(function(l){wd=Math.max(wd,font.widthOfTextAtSize(l,sz))});var bw=wd+16,bh=lines.length*1.2*sz+4;
    pg.drawPolygon(ptsOf(g,[[it.x,it.y],[it.x+bw,it.y],[it.x+bw,it.y+bh],[it.x,it.y+bh]]),{borderColor:col,borderWidth:1.6})}
  }else{
   var K=4,c=document.createElement("canvas"),c2=c.getContext("2d"),ff=(it.i?"italic ":"")+(it.b?"bold ":"")+sz*K+'px "Noto Sans Devanagari",'+CSSF[it.f||"h"];c2.font=ff;
   var wd2=0;lines.forEach(function(l){wd2=Math.max(wd2,c2.measureText(l).width)});
   c.width=Math.ceil(wd2)+4;c.height=Math.ceil(lines.length*1.2*sz*K)+4;c2.font=ff;c2.fillStyle=it.ink;c2.textBaseline="alphabetic";
   lines.forEach(function(l,j){c2.fillText(l,0,.945*sz*K+j*1.2*sz*K)});
   var png=await pdf.embedPng(c.toDataURL("image/png")),q2=PT(g,it.x,it.y+c.height/K);pg.drawImage(png,{x:q2[0],y:q2[1],width:c.width/K,height:c.height/K,rotate:O.degrees(g.r)});
  }
 }else if(T==="tick"||T==="cross"){
  var S=it.size,P=function(px,py){var q=PT(g,it.x+px*S,it.y+py*S);return{x:q[0],y:q[1]}},o={thickness:S*.13,color:col,cap:"round"};
  if(T==="tick"){pg.drawLine(Object.assign({start:P(.12,.55),end:P(.38,.82)},o));pg.drawLine(Object.assign({start:P(.38,.82),end:P(.88,.18)},o))}
  else{pg.drawLine(Object.assign({start:P(.2,.2),end:P(.8,.8)},o));pg.drawLine(Object.assign({start:P(.8,.2),end:P(.2,.8)},o))}
 }else if(T==="sig"||T==="img"){
  var rec=IM[it.dk],im=/^data:image\/jpe?g/.test(rec.url)?await pdf.embedJpg(rec.url):await pdf.embedPng(rec.url),q3=PT(g,it.x,it.y+it.h);
  pg.drawImage(im,{x:q3[0],y:q3[1],width:it.w,height:it.h,rotate:O.degrees(g.r)});
 }else if(SHAPE[T]){
  var rect=[[it.x,it.y],[it.x+it.w,it.y],[it.x+it.w,it.y+it.h],[it.x,it.y+it.h]];
  if(T==="hl")pg.drawPolygon(ptsOf(g,rect),{color:col,opacity:.4,blendMode:"Multiply"});
  else if(T==="white")pg.drawPolygon(ptsOf(g,rect),{color:O.rgb(1,1,1)});
  else if(T==="redact")pg.drawPolygon(ptsOf(g,rect),{color:O.rgb(0,0,0)});
  else if(T==="box")pg.drawPolygon(ptsOf(g,rect),{borderColor:col,borderWidth:it.lw});
  else pg.drawPolygon(ptsOf(g,ellipsePts(it.x,it.y,it.w,it.h)),{borderColor:col,borderWidth:it.lw});
 }else if(T==="pen"){
  pg.drawPolygon(ptsOf(g,it.pts),{borderColor:col,borderWidth:it.lw,round:true,close:false});
 }else if(T==="line"||T==="arrow"){
  var a=PT(g,it.x,it.y),b=PT(g,it.x2,it.y2);
  pg.drawLine({start:{x:a[0],y:a[1]},end:{x:b[0],y:b[1]},thickness:it.lw,color:col,cap:"round"});
  if(T==="arrow"){var an=Math.atan2(it.y2-it.y,it.x2-it.x),hl=Math.max(8,it.lw*5),tri=[[it.x2,it.y2],[it.x2-hl*Math.cos(an-.45),it.y2-hl*Math.sin(an-.45)],[it.x2-hl*Math.cos(an+.45),it.y2-hl*Math.sin(an+.45)]];pg.drawPolygon(ptsOf(g,tri),{color:col})}
 }
}
$("go").onclick=async function(){
 if(!doc)return;var b=$("go"),old=b.textContent;msg("err","");msg("ok","");
 var wm=$("xwm").value.trim(),pn=$("xpn").value,ti=$("xti").value.trim(),au=$("xau").value.trim(),nFill=Object.keys(FD).length;
 if(!items.length&&!nFill&&!wm&&!pn&&!ti&&!au){msg("err",L("Add something to the PDF first.","पहले PDF में कुछ जोड़ें।"));return}
 b.disabled=true;b.textContent=L("Working...","काम हो रहा है...");
 try{
  var O=DTApdf,pdf=DTApdf.Doc.load(bytes.slice()),fonts={},skipped=0,flatten=$("xfl").checked;
  var redactPages={};items.forEach(function(it){if(it.type==="redact")redactPages[it.page]=1});
  var raster=$("xrd").checked&&Object.keys(redactPages).length>0;
  if(nFill||(raster&&hasForm)){
   try{
    var form=pdf.getForm();
    Object.keys(FD).forEach(function(nm){
     try{var f=form.getField(nm),v=FV[nm];
      var kd=f.kind();
      if(kd==="text")f.setText(String(v));
      else if(kd==="checkbox"){v?f.check():f.uncheck()}
      else if(kd==="radio"){if(v)f.select(v)}
      else if(kd==="dropdown"||kd==="list"){f.select(v)}
      else skipped++;
     }catch(e){skipped++}
    });
    if(flatten||raster){try{form.updateFieldAppearances();form.flatten()}catch(e){}}
   }catch(e){}
  }
  var pgs=pdf.getPages();
  for(var i=0;i<items.length;i++){var it=items[i],pg=pgs[it.page];if(!pg)continue;await drawItem(pdf,pg,geom(pg),it,fonts)}
  if(wm||pn){
   var hf=await pdf.embedFont(O.StandardFonts.HelveticaBold),rf=await pdf.embedFont(O.StandardFonts.Helvetica),N=pgs.length,wmOk=/^[\x20-\x7e\xa0-\xff]*$/.test(wm);
   pgs.forEach(function(pg,idx){
    var g=geom(pg);
    if(wm&&wmOk){
     var sz=Math.min(g.vw/(wm.length*.42),g.vw*.16),tw=hf.widthOfTextAtSize(wm,sz),dx=Math.SQRT1_2,dy=-Math.SQRT1_2,nx=-dy,ny=dx,
      sx2=g.vw/2-dx*tw/2+nx*sz*.35,sy2=g.vh/2-dy*tw/2+ny*sz*.35,q=PT(g,sx2,sy2);
     pg.drawText(wm,{x:q[0],y:q[1],size:sz,font:hf,color:O.rgb(.5,.5,.5),opacity:+$("xwo").value/100,rotate:O.degrees(45+g.r)});
    }
    if(pn){
     var two=/2$/.test(pn),txt=two?"Page "+(idx+1)+" of "+N:""+(idx+1),ps=10,w2=rf.widthOfTextAtSize(txt,ps),vx=pn.charAt(1)==="c"?(g.vw-w2)/2:g.vw-36-w2,vy=pn.charAt(0)==="b"?g.vh-22:30,q2=PT(g,vx,vy);
     pg.drawText(txt,{x:q2[0],y:q2[1],size:ps,font:rf,color:O.rgb(.25,.25,.25),rotate:O.degrees(g.r)});
    }
   });
  }
  if(ti)pdf.setTitle(ti);if(au)pdf.setAuthor(au);
  var out=await pdf.save();
  if(raster){
   b.textContent=L("Removing hidden text...","छुपा टेक्स्ट हटा रहे हैं...");
   var P=await lib(),rd=await P.getDocument({isEvalSupported:false,data:out.slice()}).promise,src=DTApdf.Doc.load(out),fin=DTApdf.Doc.create();
   for(var i2=0;i2<src.getPageCount();i2++){
    if(redactPages[i2]){
     var rp=await rd.getPage(i2+1),v1=rp.getViewport({scale:1}),sc=Math.min(2.4,3200/Math.max(v1.width,v1.height)),v2=rp.getViewport({scale:sc}),cv=document.createElement("canvas");
     cv.width=Math.round(v2.width);cv.height=Math.round(v2.height);var cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
     await rp.render({canvasContext:cx,viewport:v2}).promise;
     var jb=await new Promise(function(r){cv.toBlob(r,"image/jpeg",.92)}),ji=await fin.embedJpg(new Uint8Array(await jb.arrayBuffer())),np=fin.addPage([v1.width,v1.height]);
     np.drawImage(ji,{x:0,y:0,width:v1.width,height:v1.height});cv.width=cv.height=1;
    }else{var cp=await fin.copyPages(src,[i2]);fin.addPage(cp[0])}
   }
   if(ti)fin.setTitle(ti);if(au)fin.setAuthor(au);
   out=await fin.save();
  }
  saveBlob(new Blob([out],{type:"application/pdf"}),baseName(file)+"-edited.pdf");
  msg("ok",L("Done ✓ ","हो गया ✓ ")+items.length+L(" item(s) and "," चीज़ें और ")+nFill+L(" form field(s)"," फॉर्म फील्ड")+(skipped?L(" ("+skipped+" field(s) could not be filled, for example Hindi text in a form field)"," ("+skipped+" फील्ड नहीं भरे जा सके, जैसे फॉर्म फील्ड में हिंदी)"):"")+" • "+sizeOf(out.length));
 }catch(e){console.error(e);msg("err",e&&e.code==="encrypted"?L("This PDF is password protected, so it cannot be edited here.","यह PDF पासवर्ड वाली है, यहाँ एडिट नहीं हो सकती।"):L("Could not save the PDF.","PDF सेव नहीं हो पाई।"))}
 b.disabled=false;b.textContent=old;
};
setTool(null);

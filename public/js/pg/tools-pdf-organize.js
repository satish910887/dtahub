var src=null,file=null,ents=[],orig=[],hist=[],cache={},pj=null,pdoc=null,tok=0,MAXT=150;
function snap(){hist.push(JSON.stringify(ents));if(hist.length>40)hist.shift();$("undo").disabled=false}
function chg(fn,focus){snap();fn();$("ok").hidden=true;draw(focus)}
function say(el,t){$("err").hidden=el!=="err";$("ok").hidden=el!=="ok";if(el){$(el).textContent=t}}
$("f").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;say(null);
 try{
  src=await DTApdf.Doc.load(await f.arrayBuffer());file=f;
  var n=src.getPageCount();ents=[];for(var i=0;i<n;i++)ents.push({s:i,r:0});orig=JSON.stringify(ents);hist=[];$("undo").disabled=true;cache={};
  $("ctl").hidden=false;$("dt").textContent=f.name;
  $("ti").value=src.getTitle()||"";$("au").value=src.getAuthor()||"";
  draw();loadThumbs(f);
 }catch(e){src=null;$("ctl").hidden=true;say("err",L("Could not open this PDF. It may be damaged or password protected.","यह PDF नहीं खुली। फाइल खराब या पासवर्ड वाली हो सकती है।"))}
});
async function loadThumbs(f){
 var t=++tok;pdoc=null;
 try{
  if(!pj){pj=DTApdfView}
  var d=await pj.getDocument({isEvalSupported:false,data:new Uint8Array(await f.arrayBuffer())}).promise;if(t!==tok)return;pdoc=d;
  pumpTok=t;thumbW=d.numPages>200?150:240;pump();
 }catch(e){}
}
var pumpTok=0,thumbW=240,pumping=false,pt=0;
function near(card){var r=card.getBoundingClientRect(),h=window.innerHeight||800;return r.bottom>-h&&r.top<2*h}
async function pump(){
 if(pumping||!pdoc)return;pumping=true;var t=pumpTok;
 try{for(;;){
  if(t!==tok||!pdoc)break;
  var card=null,cs=document.querySelectorAll(".pc");
  for(var q=0;q<cs.length;q++){var sv=+cs[q].dataset.s;if(sv>=0&&!cache[sv]&&near(cs[q])){card=cs[q];break}}
  if(!card)break;
  var i=+card.dataset.s+1;
  try{var pg=await pdoc.getPage(i),v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:thumbW/Math.max(v0.width,v0.height)});
   var c=document.createElement("canvas");c.width=Math.max(1,Math.round(vp.width));c.height=Math.max(1,Math.round(vp.height));
   await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;cache[i-1]=c;if(pg.cleanup)pg.cleanup()}
  catch(e){cache[i-1]=document.createElement("canvas")}
  if(t!==tok)break;
  [].forEach.call(document.querySelectorAll('.pc[data-s="'+(i-1)+'"]'),fill);
  await new Promise(function(r){setTimeout(r,0)});
 }}finally{pumping=false}
}
function pumpSoon(){clearTimeout(pt);pt=setTimeout(pump,80)}
window.addEventListener("scroll",pumpSoon,{passive:true});window.addEventListener("resize",pumpSoon);
function fit(w,h,bw,bh){var k=Math.min(bw/w,bh/h,1);return[w*k,h*k]}
function fill(card){
 var tb=card.querySelector(".tb"),w=card.querySelector(".tw2"),s=+card.dataset.s,r=+card.dataset.r,c=cache[s];
 w.innerHTML="";
 if(s<0){var b=document.createElement("div");b.className="bl";b.textContent=L("Blank","खाली");w.appendChild(b);w.style.transform=r?"rotate("+r+"deg)"+(r%180?" scale(.8)":""):"";return}
 if(!c){var ph=document.createElement("div");ph.className="bl";ph.textContent=s+1;w.appendChild(ph);return}
 var x=document.createElement("canvas");x.width=c.width;x.height=c.height;x.getContext("2d").drawImage(c,0,0);
 var d=fit(c.width,c.height,112,138);x.style.width=d[0]+"px";x.style.height=d[1]+"px";w.appendChild(x);
 var sc=r%180?Math.min(112/d[1],138/d[0],1):1;w.style.transform=r?"rotate("+r+"deg) scale("+sc+")":"";
}
function draw(focus){
 var g=$("pg");g.innerHTML="";var n=ents.length;
 $("info").textContent=L("Pages: ","पेज: ")+n+" • "+sizeOf(file.size);
 $("go").disabled=$("gi").disabled=!n;
 ents.forEach(function(e,i){
  var c=document.createElement("div");c.className="pc";c.dataset.s=e.s;c.dataset.r=e.r;c.draggable=true;
  c.innerHTML='<span class="nb">'+(i+1)+'</span><div class="tb"><div class="tw2"></div></div><div class="bt"></div>';
  var bt=c.querySelector(".bt");
  function B(k,txt,lab,fn,dis){var b=document.createElement("button");b.type="button";b.textContent=txt;b.title=b.ariaLabel=lab+" ("+(i+1)+")";b.dataset.k=k;if(dis)b.disabled=true;b.onclick=fn;bt.appendChild(b)}
  B("l","◀",L("Move left","बाएं ले जाएं"),function(){chg(function(){var t=ents[i];ents[i]=ents[i-1];ents[i-1]=t},[i-1,"l"])},i===0);
  B("r","▶",L("Move right","दाएं ले जाएं"),function(){chg(function(){var t=ents[i];ents[i]=ents[i+1];ents[i+1]=t},[i+1,"r"])},i===n-1);
  B("o","↻",L("Rotate","घुमाएं"),function(){chg(function(){ents[i].r=(ents[i].r+90)%360},[i,"o"])});
  B("c","⧉",L("Duplicate","कॉपी करें"),function(){chg(function(){ents.splice(i+1,0,{s:e.s,r:e.r})},[i+1,"c"])});
  B("a","+",L("Add blank page after","इसके बाद खाली पेज जोड़ें"),function(){chg(function(){ents.splice(i+1,0,{s:-1,r:0})},[i+1,"a"])});
  B("d","✕",L("Delete","हटाएं"),function(){chg(function(){ents.splice(i,1)},[Math.min(i,ents.length-1),"d"])});
  c.addEventListener("dragstart",function(ev){ev.dataTransfer.setData("text/plain",""+i);c.classList.add("drag")});
  c.addEventListener("dragend",function(){c.classList.remove("drag")});
  c.addEventListener("dragover",function(ev){ev.preventDefault();c.classList.add("over")});
  c.addEventListener("dragleave",function(){c.classList.remove("over")});
  c.addEventListener("drop",function(ev){ev.preventDefault();var from=+ev.dataTransfer.getData("text/plain");if(isNaN(from)||from===i)return;chg(function(){var m=ents.splice(from,1)[0];ents.splice(i,0,m)})});
  g.appendChild(c);fill(c);
 });
 if(focus){var cc=g.children[focus[0]];if(cc){var bb=cc.querySelector('[data-k="'+focus[1]+'"]');if(bb&&!bb.disabled)bb.focus();else{var any=cc.querySelector("button:not(:disabled)");if(any)any.focus()}}}
 pumpSoon();
}
$("undo").onclick=function(){if(!hist.length)return;ents=JSON.parse(hist.pop());$("undo").disabled=!hist.length;draw()};
$("rall").onclick=function(){chg(function(){ents.forEach(function(e){e.r=(e.r+90)%360})})};
$("rev").onclick=function(){chg(function(){ents.reverse()})};
$("oe").onclick=function(){chg(function(){var o=[],e2=[];ents.forEach(function(e,i){(i%2===0?o:e2).push(e)});ents=o.concat(e2)})};
$("blank").onclick=function(){chg(function(){ents.push({s:-1,r:0})})};
$("rst").onclick=function(){chg(function(){ents=JSON.parse(orig)})};
$("pn").onchange=function(){$("pnw").hidden=!this.checked};
$("wm").oninput=function(){$("wmw").hidden=!this.value.trim()};
function mapper(R,w,h){return R===90?function(x,y){return[w-y,x]}:R===180?function(x,y){return[w-x,h-y]}:R===270?function(x,y){return[y,h-x]}:function(x,y){return[x,y]}}
async function wmPng(text,size){
 var c=document.createElement("canvas"),x=c.getContext("2d"),fs=120;x.font="700 "+fs+"px sans-serif";var m=Math.ceil(x.measureText(text).width)+40;
 c.width=m;c.height=fs*1.5;x=c.getContext("2d");x.font="700 "+fs+"px sans-serif";x.fillStyle="#555";x.textBaseline="middle";x.textAlign="center";x.fillText(text,m/2,fs*.75);
 var b=await new Promise(function(r){c.toBlob(r,"image/png")});return{bytes:new Uint8Array(await b.arrayBuffer()),w:c.width,h:c.height};
}
async function build(){
 var out=await DTApdf.Doc.create(),n=ents.length,first=src.getPage(0).getSize();
 for(var i=0;i<n;i++){
  var e=ents[i],pg;
  if(e.s<0){var ref=null;for(var k=i-1;k>=0&&!ref;k--)if(ents[k].s>=0)ref=ents[k];for(var k2=i+1;k2<n&&!ref;k2++)if(ents[k2].s>=0)ref=ents[k2];
   var sz=ref?src.getPage(ref.s).getSize():first;pg=out.addPage([sz.width,sz.height]);
  }else{pg=(await out.copyPages(src,[e.s]))[0];out.addPage(pg)}
  var base=e.s>=0?pg.getRotation().angle:0;pg.setRotation(((base+e.r)%360+360)%360);
 }
 var pages=out.getPages();
 if($("pn").checked){
  var font=await out.embedFont("Helvetica"),st=Math.floor(+$("pns").value)||1,pos=$("pnpos").value,fm=$("pnfmt").value;
  pages.forEach(function(pg,i){
   var sz=pg.getSize(),w=sz.width,h=sz.height,R=pg.getRotation().angle%360,VW=R%180?h:w,VH=R%180?w:h,num=st+i,last=st+n-1;
   var t=fm==="n"?""+num:fm==="p"?"Page "+num:"Page "+num+" of "+last,fs=Math.max(9,Math.min(VW,VH)*.022),tw=font.widthOfTextAtSize(t,fs),mg=Math.min(VW,VH)*.04;
   var vx=pos[1]==="c"?(VW-tw)/2:pos[1]==="r"?VW-mg-tw:mg,vy=pos[0]==="b"?mg:VH-mg-fs;
   var q=mapper(R,w,h)(vx,vy);pg.drawText(t,{x:q[0],y:q[1],size:fs,font:font,color:DTApdf.rgb(.25,.25,.25),rotate:DTApdf.degrees(R)});
  });
 }
 var wt=$("wm").value.trim();
 if(wt){
  var im=await wmPng(wt),img=await out.embedPng(im.bytes),op=$("wmo").value/100,sc=+$("wms").value;
  pages.forEach(function(pg){
   var sz=pg.getSize(),w=sz.width,h=sz.height,R=pg.getRotation().angle%360,VW=R%180?h:w,VH=R%180?w:h;
   var iw=Math.min(VW,VH)*1.2*sc*(im.w/im.h>4?.75:1),ih=iw*im.h/im.w;if(iw>VW*.95){var k=VW*.95/iw;iw*=k;ih*=k}
   var a=Math.PI/4,cx=VW/2,cy=VH/2,ox=cx+(-iw/2)*Math.cos(a)-(-ih/2)*Math.sin(a),oy=cy+(-iw/2)*Math.sin(a)+(-ih/2)*Math.cos(a);
   var q=mapper(R,w,h)(ox,oy);pg.drawImage(img,{x:q[0],y:q[1],width:iw,height:ih,rotate:DTApdf.degrees(R+45),opacity:op});
  });
 }
 var ti=$("ti").value.trim(),au=$("au").value.trim();if(ti)out.setTitle(ti);if(au)out.setAuthor(au);out.setProducer("DTAhub");
 return out.save();
}
$("go").onclick=async function(){
 say(null);if(!ents.length)return;var b=$("go"),old=b.textContent;b.disabled=true;b.textContent=L("Working...","काम हो रहा है...");
 try{var bytes=await build();saveBlob(new Blob([bytes],{type:"application/pdf"}),baseName(file)+"-organized.pdf");say("ok",L("Done ✓ ","हो गया ✓ ")+ents.length+L(" pages"," पेज"))}
 catch(e){say("err",L("Something went wrong. Try again.","कुछ गड़बड़ हुई। दोबारा कोशिश करें।"))}
 b.disabled=false;b.textContent=old;
};
$("gi").onclick=async function(){
 say(null);var n=ents.length;if(!n)return;
 if(n>80){say("err",L("Too many pages for image export (max 80). Delete some pages first.","इमेज एक्सपोर्ट के लिए पेज बहुत ज़्यादा हैं (अधिकतम 80)। पहले कुछ पेज हटाएं।"));return}
 var b=$("gi"),old=b.textContent;b.disabled=true;
 try{
  if(!pdoc){if(!pj){pj=DTApdfView}pdoc=await pj.getDocument({isEvalSupported:false,data:new Uint8Array(await file.arrayBuffer())}).promise}
  var fl=[],p0=await pdoc.getPage(1),v0=p0.getViewport({scale:1}),pad=String(n).length;
  for(var i=0;i<n;i++){
   b.textContent=(i+1)+"/"+n;var e=ents[i],c=document.createElement("canvas"),x;
   if(e.s<0){var vv=p0.getViewport({scale:1.5,rotation:(p0.rotate+e.r)%360});c.width=Math.round(vv.width);c.height=Math.round(vv.height);x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)}
   else{var pg=await pdoc.getPage(e.s+1),vp=pg.getViewport({scale:Math.min(2,3000/Math.max(pg.getViewport({scale:1}).width,pg.getViewport({scale:1}).height)),rotation:(pg.rotate+e.r)%360});c.width=Math.round(vp.width);c.height=Math.round(vp.height);x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);await pg.render({canvasContext:x,viewport:vp}).promise}
   var blob=await new Promise(function(r){c.toBlob(r,"image/jpeg",.9)});
   fl.push({name:baseName(file)+"-page-"+String(i+1).padStart(pad,"0")+".jpg",data:new Uint8Array(await blob.arrayBuffer())});
  }
  saveBlob(DTAzip.build(fl),baseName(file)+"-pages.zip");say("ok",L("Done ✓ ","हो गया ✓ ")+n+L(" images"," इमेज"));
 }catch(e){say("err",L("Something went wrong. Try again.","कुछ गड़बड़ हुई। दोबारा कोशिश करें।"))}
 b.disabled=false;b.textContent=old;
};

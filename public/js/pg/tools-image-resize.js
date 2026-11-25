var items=[],ratio=1,unit="px",MAXD=8000;
var F={px:null,cm:2.54,mm:25.4,in:1};
function dpi(){return Math.min(1200,Math.max(30,+$("dpi").value||300))}
function toPx(v){return unit==="px"?v:v/F[unit]*dpi()}
function fromPx(v){return unit==="px"?Math.round(v):+(v*F[unit]/dpi()).toFixed(2)}
function load(f){return DTAcore.files.loadImage(f)}
function first(){return items.find(function(i){return i.im})}
$("f").addEventListener("change",async function(){
 var fs=[].slice.call($("f").files);if(!fs.length)return;
 items=fs.map(function(f){return{f:f}});var i=null;
 for(var q of items){var r=await load(q.f);if(r.im){q.im=r.im;i=q;break}q.bad=true}
 if(!i){$("err").hidden=false;$("err").textContent=L("Could not open this image.","यह इमेज नहीं खुल सकी।");return}
 var im=i.im,f=i.f;ratio=im.naturalWidth/im.naturalHeight;
 $("err").hidden=true;$("ctl").hidden=false;$("res").hidden=true;$("dt").textContent=fs.length>1?fs.length+L(" photos selected"," फोटो चुनी गईं"):f.name;
 $("w").value=fromPx(im.naturalWidth);$("h").value=fromPx(im.naturalHeight);
 $("orig").textContent=(fs.length>1?L("First image — ","पहली इमेज — "):"")+L("Original: ","असली: ")+im.naturalWidth+" × "+im.naturalHeight+" px • "+sizeOf(f.size);
 $("fmt").value=f.type==="image/png"?"image/png":f.type==="image/webp"?"image/webp":"image/jpeg";
});
$("w").addEventListener("input",function(){$("ps").value="";if($("lock").checked&&+$("w").value>0)$("h").value=fromPx(toPx(+$("w").value)/ratio)});
$("h").addEventListener("input",function(){$("ps").value="";if($("lock").checked&&+$("h").value>0)$("w").value=fromPx(toPx(+$("h").value)*ratio)});
$("un").onchange=function(){var w=toPx(+$("w").value),h=toPx(+$("h").value);unit=$("un").value;$("w").value=fromPx(w);$("h").value=fromPx(h)};
$("dpi").addEventListener("input",function(){if(unit!=="px"){}});
document.querySelectorAll(".p").forEach(function(b){b.onclick=function(){var i=first();if(!i)return;
 var p=+b.dataset.p/100;$("w").value=fromPx(i.im.naturalWidth*p);$("h").value=fromPx(i.im.naturalHeight*p);$("ps").value="";
}});
$("ps").onchange=function(){var v=$("ps").value;if(!v)return;var a=v.split("x");$("lock").checked=false;$("w").value=fromPx(+a[0]);$("h").value=fromPx(+a[1]);
 if($("fit").value==="stretch")$("fit").value="cover"};
function draw(im,W,H,type,fit,bg){
 var c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
 if(type!=="image/png"||fit==="contain"){x.fillStyle=bg;if(type!=="image/png"||fit==="contain")x.fillRect(0,0,W,H)}
 x.imageSmoothingQuality="high";
 var iw=im.naturalWidth,ih=im.naturalHeight;
 if(fit==="stretch")x.drawImage(im,0,0,W,H);
 else{var k=fit==="cover"?Math.max(W/iw,H/ih):Math.min(W/iw,H/ih),dw=iw*k,dh=ih*k;x.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh)}
 return new Promise(function(r){c.toBlob(r,type,Math.min(1,Math.max(.5,(+$("q").value||92)/100)))});
}
$("go").onclick=async function(){
 var w=Math.round(toPx(+$("w").value)),h=Math.round(toPx(+$("h").value)),lock=$("lock").checked;
 if(!(w>0&&h>0)||w>MAXD||h>MAXD){$("err").hidden=false;$("err").textContent=L("Enter width and height between 1 and 8000 px.","चौड़ाई और ऊंचाई 1 से 8000 px के बीच डालें।");return}
 $("err").hidden=true;var t=$("fmt").value;
 var cached=0;
 for(var it of items){
  if(!it.im&&!it.bad){var r=await load(it.f);if(r.im)it.im=r.im;else it.bad=true}
  if(!it.im)continue;
  var W=w,H=lock?Math.max(1,Math.round(w*it.im.naturalHeight/it.im.naturalWidth)):h;
  if(H>MAXD)H=MAXD;
  it.W=W;it.H=H;it.out=await draw(it.im,W,H,t,lock?"stretch":$("fit").value,$("bg").value);
  cached+=it.im.naturalWidth*it.im.naturalHeight;if(items.length>1&&cached>6e7&&it!==items[0])it.im=null}
 var ok=items.filter(function(i){return i.out}),one=ok.length===1,o=ok[0];
 $("info").textContent=one?o.W+" × "+o.H+" px • "+sizeOf(o.out.size):ok.length+L(" images resized"," इमेज रीसाइज़ हुईं");
 $("pv").hidden=!one;$("list").hidden=one;$("dl").hidden=!one;$("dz").hidden=one;
 if(one){if(items.u)URL.revokeObjectURL(items.u);items.u=URL.createObjectURL(o.out);$("pv").src=items.u}
 $("list").innerHTML="";ok.forEach(function(i){var d=document.createElement("div"),a=document.createElement("span"),b=document.createElement("b");a.textContent=i.f.name;b.textContent=i.W+"×"+i.H+" • "+sizeOf(i.out.size);d.append(a,b);$("list").append(d)});
 $("res").hidden=false;
};
function nm(i){return baseName(i.f)+"-"+i.W+"x"+i.H+"."+extOf(i.out.type)}
$("dl").onclick=function(){var i=items.find(function(x){return x.out});if(i)saveBlob(i.out,nm(i))};
$("dz").onclick=async function(){var fl=[];for(var i of items){if(i.out)fl.push({name:nm(i),data:new Uint8Array(await i.out.arrayBuffer())})}saveBlob(DTAzip.build(fl),"dtahub-resized.zip")};
function qsync(){$("qv").textContent=$("q").value;var png=$("fmt").value==="image/png";$("q").disabled=png;$("ql").style.opacity=png?".5":"1"}
$("q").addEventListener("input",qsync);$("fmt").addEventListener("change",qsync);qsync();

var files=[],dragI=-1;
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function render(){
 $("list").innerHTML=files.map(function(f,i){
  return '<li draggable="true" data-i="'+i+'"><img class="th" alt="" src="'+f.url+'" style="transform:rotate('+f.rot+'deg)"><span class="nm">'+(i+1)+'. '+esc(f.file.name)+'<small>'+sizeOf(f.file.size)+'</small></span><button class="mini" data-i="'+i+'" data-a="r" aria-label="Rotate">⟳</button><button class="mini" data-i="'+i+'" data-a="u" aria-label="Up">↑</button><button class="mini" data-i="'+i+'" data-a="d" aria-label="Down">↓</button><button class="mini" data-i="'+i+'" data-a="x" aria-label="Remove">✕</button></li>'}).join("");
}
$("list").addEventListener("click",function(e){
 var b=e.target.closest("button");if(!b)return;
 var i=+b.dataset.i,a=b.dataset.a,t;
 if(a==="x"){URL.revokeObjectURL(files[i].url);files.splice(i,1)}
 else if(a==="r")files[i].rot=(files[i].rot+90)%360;
 else if(a==="u"&&i>0){t=files[i];files[i]=files[i-1];files[i-1]=t}
 else if(a==="d"&&i<files.length-1){t=files[i];files[i]=files[i+1];files[i+1]=t}
 render();
});
$("list").addEventListener("dragstart",function(e){var li=e.target.closest("li");if(li){dragI=+li.dataset.i;try{e.dataTransfer.setData("text/plain","x")}catch(x){}}});
$("list").addEventListener("dragover",function(e){if(dragI>-1)e.preventDefault()});
$("list").addEventListener("drop",function(e){var li=e.target.closest("li");if(!li||dragI<0)return;e.preventDefault();var m=files.splice(dragI,1)[0];files.splice(+li.dataset.i,0,m);dragI=-1;render()});
$("f").addEventListener("change",function(){
 var inp=this,list=Array.prototype.slice.call(inp.files),bad=[];inp.value="";$("err").hidden=true;$("ok").hidden=true;
 if(!list.length)return;
 (async function(){for(var f of list){await new Promise(function(res){
  if(f.size>50*1024*1024){bad.push(f.name+L(" (over 50 MB)"," (50 MB से बड़ी)"));return res()}
  var u=URL.createObjectURL(f),im=new Image();
  im.onload=function(){files.push({file:f,rot:0,url:u});res()};
  im.onerror=function(){URL.revokeObjectURL(u);bad.push(f.name);res()};
  im.src=u})}})().then(function(){render();
  if(bad.length){$("err").hidden=false;$("err").textContent=L("Skipped (not a readable image): ","छोड़ी गईं (पढ़ने लायक इमेज नहीं): ")+bad.slice(0,4).join(", ")+(bad.length>4?"…":"")}});
});
$("clr").onclick=function(){files.forEach(function(f){URL.revokeObjectURL(f.url)});files=[];render();$("err").hidden=true;$("ok").hidden=true};
function load(f){
 return new Promise(function(res,rej){
  var u=URL.createObjectURL(f),im=new Image();
  im.onload=function(){URL.revokeObjectURL(u);res(im)};
  im.onerror=function(){URL.revokeObjectURL(u);rej(new Error("img"))};
  im.src=u;
 });
}
async function toJpg(o,q){
 var im=await load(o.file),w=im.naturalWidth,h=im.naturalHeight,m=Math.max(w,h);
 if(m>2400){var s=2400/m;w=Math.round(w*s);h=Math.round(h*s)}
 var sw=o.rot%180!==0,cw=sw?h:w,ch=sw?w:h,c=document.createElement("canvas");c.width=cw;c.height=ch;
 var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cw,ch);x.imageSmoothingQuality="high";
 x.translate(cw/2,ch/2);x.rotate(o.rot*Math.PI/180);x.drawImage(im,-w/2,-h/2,w,h);
 var b=await new Promise(function(r){c.toBlob(r,"image/jpeg",q)});
 return {bytes:await b.arrayBuffer(),w:cw,h:ch};
}
var SZ={a4:[595.28,841.89],letter:[612,792],a5:[419.53,595.28]};
$("go").onclick=async function(){
 var err=$("err"),ok=$("ok");err.hidden=true;ok.hidden=true;
 if(!files.length){err.hidden=false;err.textContent=L("Add at least 1 photo.","कम से कम 1 फोटो जोड़ें।");return}
 var btn=$("go"),old=btn.textContent;btn.disabled=true;btn.textContent=L("Working...","काम हो रहा है...");
 try{
  var doc=await DTApdf.Doc.create(),fit=$("ps").value==="fit",mg=+$("mg").value,fill=$("fm").value==="fill",q=+$("qq").value;
  for(var i=0;i<files.length;i++){
   var d=await toJpg(files[i],q),img=await doc.embedJpg(d.bytes),page;
   if(fit){page=doc.addPage([d.w,d.h]);page.drawImage(img,{x:0,y:0,width:d.w,height:d.h})}
   else{
    var pz=SZ[$("ps").value],PW=pz[0],PH=pz[1],o=$("or").value,land=o==="auto"?d.w>d.h:o==="l";
    if(land){var t=PW;PW=PH;PH=t}
    var aw=PW-2*mg,ah=PH-2*mg,s=fill?Math.max(aw/d.w,ah/d.h):Math.min(aw/d.w,ah/d.h),w=d.w*s,h=d.h*s;
    page=doc.addPage([PW,PH]);
    page.drawImage(img,{x:(PW-w)/2,y:(PH-h)/2,width:w,height:h,clip:fill?[mg,mg,PW-2*mg,PH-2*mg]:undefined});
   }
  }
  var bytes=await doc.save(),nm=($("on").value.trim().replace(/[\\/:*?"<>|]+/g,"")||"dtahub-images").replace(/\.pdf$/i,"");
  saveBlob(new Blob([bytes],{type:"application/pdf"}),nm+".pdf");
  ok.hidden=false;ok.textContent=L("Done ✓ ","हो गया ✓ ")+files.length+L(" pages"," पेज");
 }catch(e){
  err.hidden=false;err.textContent=L("Could not create the PDF. Try fewer or smaller photos.","PDF नहीं बनी। कम या छोटी फोटो आज़माएं।");
 }
 btn.disabled=false;btn.textContent=old;
};
document.addEventListener("langchange",render);

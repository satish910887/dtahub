var pj=null,doc=null,file=null,total=0,outs=[],MAXPX=4200,MAXPIX=24e6,job=0;
function showErr(m){$("err").hidden=!m;$("err").textContent=m||"";if(m)$("ok").hidden=true}
function parse(s){
 var idx=[],parts=s.replace(/\s/g,"").split(",");
 for(var i=0;i<parts.length;i++){var p=parts[i];if(!p)continue;var m=p.match(/^(\d+)(?:-(\d+))?$/);if(!m)return null;var a=+m[1],b=m[2]?+m[2]:a;if(a<1||b<a||b>total)return null;for(var k=a;k<=b;k++)idx.push(k)}
 var seen={};return idx.filter(function(x){return seen[x]?0:(seen[x]=1)});
}
async function engine(){if(!pj){pj=DTApdfView}return pj}
$("f").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;showErr("");
 if(f.size>150*1024*1024){showErr(L("This PDF is larger than 150 MB. Please split it first.","यह PDF 150 MB से बड़ी है। पहले इसे अलग-अलग करें।"));return}
 if(f.type&&f.type!=="application/pdf"&&!/\.pdf$/i.test(f.name)){showErr(L("Please choose a PDF file.","कृपया PDF फाइल चुनें।"));return}
 try{
  var head=await f.slice(0,1024).text();
  if(head.indexOf("%PDF-")<0)throw{name:"NotPdf"};
  $("dt").textContent=L("Opening...","खुल रही है...");
  var P=await engine(),d=await Promise.race([P.getDocument({isEvalSupported:false,data:new Uint8Array(await f.arrayBuffer())}).promise,new Promise(function(_,rej){setTimeout(function(){rej({name:"Timeout"})},40000)})]);
  if(doc)try{doc.destroy()}catch(e){}
  doc=d;file=f;total=d.numPages;clearOuts();
  $("ctl").hidden=false;$("res").hidden=true;$("dt").textContent=f.name;
  $("info").textContent=L("Total pages: ","कुल पेज: ")+total+" • "+sizeOf(f.size);$("rg").value="1-"+Math.min(total,50);
 }catch(e){
  doc=null;$("ctl").hidden=true;$("dt").textContent=L("Tap to choose a PDF","PDF चुनने के लिए टैप करें");
  showErr(e&&e.name==="PasswordException"?L("This PDF is password protected. Remove the password first, then try again.","यह PDF पासवर्ड वाली है। पहले पासवर्ड हटाएं, फिर कोशिश करें।"):L("Could not open this PDF. The file may be damaged.","यह PDF नहीं खुली। फाइल खराब हो सकती है।"));
 }
});
function clearOuts(){outs.forEach(function(o){URL.revokeObjectURL(o.u)});outs=[];$("lst").textContent=""}
$("all").onclick=function(){$("rg").value="1-"+total};
function toBlob(c,t,q){return new Promise(function(r){c.toBlob(r,t,q)})}
$("go").onclick=async function(){
 if(!doc){showErr(L("Please choose a PDF first.","पहले PDF चुनें।"));return}
 var pages=parse($("rg").value);
 if(!pages){showErr(L("Pages must look like 1-3, 5, 8-10 and stay within 1 to ","पेज ऐसे लिखें: 1-3, 5, 8-10, और 1 से इतने के बीच रहें: ")+total);return}
 if(pages.length>200){showErr(L("Please pick at most 200 pages at a time.","एक बार में अधिकतम 200 पेज चुनें।"));return}
 var fmt=$("fm").value,mime=fmt==="png"?"image/png":fmt==="webp"?"image/webp":"image/jpeg",ext=fmt==="jpg"?"jpg":fmt,q=(+$("ql").value||90)/100,scale=(+$("dp").value||150)/72;
 showErr("");clearOuts();$("res").hidden=false;$("go").disabled=true;var tok=++job,base=baseName(file),skipped=0,old=$("go").textContent;
 try{
  for(var n=0;n<pages.length;n++){
   if(tok!==job)return;
   $("go").textContent=L("Page ","पेज ")+pages[n]+" ("+(n+1)+"/"+pages.length+")";
   var pg=await doc.getPage(pages[n]),v0=pg.getViewport({scale:1}),sc=scale;
   var lim=Math.min(MAXPX/Math.max(v0.width,v0.height),Math.sqrt(MAXPIX/(v0.width*v0.height)));if(sc>lim){sc=lim;skipped++}
   var vp=pg.getViewport({scale:sc}),c=document.createElement("canvas");c.width=Math.max(1,Math.floor(vp.width));c.height=Math.max(1,Math.floor(vp.height));
   var x=c.getContext("2d");if(fmt!=="png"){x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)}
   await pg.render({canvasContext:x,viewport:vp}).promise;
   var b=await toBlob(c,mime,fmt==="png"?undefined:q);
   if(!b)throw new Error("encode");
   var name=base+"-page-"+String(pages[n]).padStart(String(total).length,"0")+"."+ext,u=URL.createObjectURL(b);
   outs.push({name:name,blob:b,u:u,w:c.width,h:c.height});pg.cleanup();
   var row=document.createElement("div");row.className="pgl";
   var im=document.createElement("img");im.src=u;im.alt=L("Page ","पेज ")+pages[n];im.loading="lazy";
   var sp=document.createElement("span");sp.textContent=L("Page ","पेज ")+pages[n]+" • "+c.width+"×"+c.height+" • "+sizeOf(b.size);
   var a=document.createElement("button");a.type="button";a.className="btn";a.textContent=L("Download","डाउनलोड");a.onclick=(function(o){return function(){saveBlob(o.blob,o.name)}})(outs[outs.length-1]);
   row.append(im,sp,a);$("lst").appendChild(row);c.width=c.height=0;
  }
  $("zipw").hidden=outs.length<2;
  $("ok").hidden=false;$("ok").textContent=L("Done: ","तैयार: ")+outs.length+L(" image(s).",
   " इमेज।")+(skipped?L(" Some large pages were scaled down to fit your device's memory."," कुछ बड़े पेज आपके डिवाइस की मेमोरी के हिसाब से छोटे किए गए।"):"");
 }catch(e){
  showErr(L("Something went wrong while converting. Try a lower quality (DPI) or fewer pages.","बदलते समय गड़बड़ हुई। कम DPI या कम पेज से कोशिश करें।"));
 }finally{$("go").disabled=false;$("go").textContent=old}
};
$("zip").onclick=function(){if(!outs.length)return;var fl=outs.map(function(o){return{name:o.name,data:null,blob:o.blob}});
 Promise.all(fl.map(function(f){return f.blob.arrayBuffer()})).then(function(a){a.forEach(function(b,i){fl[i].data=new Uint8Array(b)});saveBlob(DTAzip.build(fl),baseName(file)+"-images.zip")})};
$("fm").onchange=function(){$("qw").hidden=$("fm").value==="png"};
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){job++;clearOuts();doc=null;file=null;$("f").value="";$("ctl").hidden=true;$("res").hidden=true;showErr("");$("dt").textContent=L("Tap to choose a PDF","PDF चुनने के लिए टैप करें")});

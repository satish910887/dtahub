var src=null,file=null,total=0;
$("f").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;
 $("err").hidden=true;$("ok").hidden=true;
 try{
  src=await PDFLib.PDFDocument.load(await f.arrayBuffer());
  file=f;total=src.getPageCount();
  $("ctl").hidden=false;$("dt").textContent=f.name;
  $("info").textContent=L("Total pages: ","कुल पेज: ")+total+" • "+sizeOf(f.size);
  $("rg").value="1-"+total;
  thumbs(f);
 }catch(e){
  src=null;$("ctl").hidden=true;$("err").hidden=false;
  $("err").textContent=L("Could not open this PDF. It may be damaged or password protected.","यह PDF नहीं खुली। फाइल खराब या पासवर्ड वाली हो सकती है।");
 }
});
function parse(s){
 var idx=[],parts=s.replace(/\s/g,"").split(",");
 for(var i=0;i<parts.length;i++){
  var p=parts[i];if(!p)continue;
  var m=p.match(/^(\d+)(?:-(\d+))?$/);if(!m)return null;
  var a=+m[1],b=m[2]?+m[2]:a;
  if(a<1||b<a||b>total)return null;
  for(var k=a;k<=b;k++)idx.push(k-1);
 }
 return idx.length?idx:null;
}

var pj=null,thTok=0;
function sel(){var r=[];try{(parse($("rg").value)||[]).forEach(function(i){r[i]=1})}catch(e){}return r}
function paint(){var m=sel(),on=$("md").value==="pick"||$("md").value==="ranges";[].forEach.call($("th").children,function(b,i){b.setAttribute("aria-pressed",on&&m[i]?"true":"false")})}
function toRanges(m){var out=[],i=0;while(i<total){if(m[i]){var j=i;while(m[j+1])j++;out.push(i===j?""+(i+1):(i+1)+"-"+(j+1));i=j+1}else i++}return out.join(", ")}
async function thumbs(f){
 var tok=++thTok;$("th").innerHTML="";$("thh").hidden=true;
 try{
  if(!pj){pj=await import("/js/vendor/pdfjs/pdf.min.mjs");pj.GlobalWorkerOptions.workerSrc="/js/vendor/pdfjs/pdf.worker.min.mjs"}
  var doc=await pj.getDocument({isEvalSupported:false,data:new Uint8Array(await f.arrayBuffer())}).promise,n=Math.min(doc.numPages,120);
  $("thh").hidden=false;
  for(var i=1;i<=n;i++){
   if(tok!==thTok)return;
   var b=document.createElement("button");b.type="button";b.setAttribute("aria-pressed","false");b.setAttribute("aria-label",L("Page ","पेज ")+i);
   var c=document.createElement("canvas"),sp=document.createElement("span");sp.textContent=i;b.append(c,sp);
   b.onclick=(function(k){return function(){var m=sel();if($("md").value!=="ranges"&&$("md").value!=="pick"){$("md").value="pick";$("md").onchange();m=[]}m[k-1]=m[k-1]?0:1;$("rg").value=toRanges(m);paint()}})(i);
   $("th").appendChild(b);
   var pg=await doc.getPage(i),v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:140/v0.width});c.width=vp.width;c.height=vp.height;
   await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;paint();
  }
  if(doc.numPages>n){var m2=document.createElement("p");m2.className="hint";m2.textContent=L("Showing first 120 pages. Type ranges for the rest.","पहले 120 पेज दिखाए गए। बाकी के लिए रेंज लिखें।");$("th").appendChild(m2)}
 }catch(e){$("thh").hidden=true}
}
$("rg").addEventListener("input",paint);
function parts(str){
 var out=[],ps=str.replace(/\s/g,"").split(",");
 for(var i=0;i<ps.length;i++){var q=ps[i];if(!q)continue;var m=q.match(/^(\d+)(?:-(\d+))?$/);if(!m)return null;
  var a=+m[1],b=m[2]?+m[2]:a;if(a<1||b<a||b>total)return null;var r=[];for(var k=a;k<=b;k++)r.push(k-1);out.push({r:r,l:a===b?""+a:a+"-"+b})}
 return out.length?out:null;
}
$("md").onchange=function(){var v=$("md").value;paint();$("rgw").hidden=!(v==="pick"||v==="ranges");$("nw").hidden=v!=="n";$("rh").hidden=v!=="ranges";$("ok").hidden=true};
async function mk(idx){var o=await PDFLib.PDFDocument.create();(await o.copyPages(src,idx)).forEach(function(p){o.addPage(p)});return o.save()}
$("go").onclick=async function(){
 var err=$("err"),ok=$("ok");err.hidden=true;ok.hidden=true;
 var v=$("md").value,jobs=[],all=[];for(var i=0;i<total;i++)all.push(i);
 if(v==="pick"){var idx=parse($("rg").value);if(idx)jobs.push({r:idx,l:"pages"})}
 else if(v==="ranges"){var pr=parts($("rg").value);if(pr)jobs=pr.map(function(x){return{r:x.r,l:"pages-"+x.l}})}
 else if(v==="each")jobs=all.map(function(i){return{r:[i],l:"page-"+(i+1)}});
 else if(v==="n"){var n=Math.max(1,Math.floor(+$("nn").value)||1);for(var s0=0;s0<total;s0+=n){var r=all.slice(s0,s0+n);jobs.push({r:r,l:"pages-"+(s0+1)+"-"+(s0+r.length)})}}
 else{var r2=all.filter(function(i){return v==="odd"?i%2===0:i%2===1});if(r2.length)jobs.push({r:r2,l:v+"-pages"})}
 if(!jobs.length){err.hidden=false;err.textContent=L("Invalid pages. Use numbers between 1 and ","गलत पेज। 1 से इतने के बीच के नंबर डालें: ")+total;return}
 var btn=$("go"),old=btn.textContent;btn.disabled=true;btn.textContent=L("Working...","काम हो रहा है...");
 try{
  var base=baseName(file);
  if(jobs.length===1){saveBlob(new Blob([await mk(jobs[0].r)],{type:"application/pdf"}),base+"-"+jobs[0].l+".pdf")}
  else{var fl=[];for(var j of jobs)fl.push({name:base+"-"+j.l+".pdf",data:await mk(j.r)});saveBlob(DTAzip.build(fl),base+"-split.zip")}
  ok.hidden=false;ok.textContent=L("Done ✓ ","हो गया ✓ ")+jobs.length+L(" file(s)"," फाइल");
 }catch(e){
  err.hidden=false;err.textContent=L("Something went wrong. Try again.","कुछ गड़बड़ हुई। दोबारा कोशिश करें।");
 }
 btn.disabled=false;btn.textContent=old;
};

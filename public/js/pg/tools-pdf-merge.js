var files=[],dragI=-1;
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function render(){
 $("list").innerHTML=files.map(function(f,i){
  return '<li draggable="true" data-i="'+i+'"><span class="nm">'+esc(f.file.name)+'<small>'+sizeOf(f.file.size)+' • '+(f.err?L("cannot open","खुल नहीं सकी"):f.n==null?"…":f.n+L(" pages"," पेज"))+'</small></span><input class="rgi" data-i="'+i+'" value="'+esc(f.range)+'" placeholder="'+L("all pages","सभी पेज")+'" aria-label="'+L("Pages to include, e.g. 1-3, 5","शामिल पेज, जैसे 1-3, 5")+'" size="9"><button class="mini" data-i="'+i+'" data-a="u" aria-label="Up">↑</button><button class="mini" data-i="'+i+'" data-a="d" aria-label="Down">↓</button><button class="mini" data-i="'+i+'" data-a="x" aria-label="Remove">✕</button></li>'}).join("");
 var tot=files.reduce(function(a,f){return a+(f.n||0)},0);
 $("sum").textContent=files.length?files.length+L(" files • "," फाइलें • ")+tot+L(" pages in total (before ranges)"," पेज कुल (रेंज से पहले)"):"";
}
function parse(str,n){
 if(!str.trim())return null;var idx=[],ps=str.replace(/\s/g,"").split(",");
 for(var i=0;i<ps.length;i++){var q=ps[i];if(!q)continue;var m=q.match(/^(\d+)(?:-(\d+))?$/);if(!m)return false;
  var a=+m[1],b=m[2]?+m[2]:a;if(a<1||b<a||b>n)return false;for(var k=a;k<=b;k++)idx.push(k-1)}
 return idx.length?idx:false;
}
$("list").addEventListener("click",function(e){
 var b=e.target.closest("button");if(!b)return;
 var i=+b.dataset.i,a=b.dataset.a,t;
 if(a==="x")files.splice(i,1);
 else if(a==="u"&&i>0){t=files[i];files[i]=files[i-1];files[i-1]=t}
 else if(a==="d"&&i<files.length-1){t=files[i];files[i]=files[i+1];files[i+1]=t}
 render();
});
$("list").addEventListener("input",function(e){if(e.target.classList.contains("rgi"))files[+e.target.dataset.i].range=e.target.value});
$("list").addEventListener("dragstart",function(e){var li=e.target.closest("li");if(li){dragI=+li.dataset.i;e.dataTransfer.effectAllowed="move";try{e.dataTransfer.setData("text/plain","x")}catch(x){}}});
$("list").addEventListener("dragover",function(e){if(dragI>-1)e.preventDefault()});
$("list").addEventListener("drop",function(e){var li=e.target.closest("li");if(!li||dragI<0)return;e.preventDefault();var j=+li.dataset.i,m=files.splice(dragI,1)[0];files.splice(j,0,m);dragI=-1;render()});
$("list").addEventListener("dragend",function(){dragI=-1});
$("f").addEventListener("change",async function(){
 var added=[];for(var i=0;i<this.files.length;i++){var o={file:this.files[i],n:null,range:"",err:false};files.push(o);added.push(o)}
 this.value="";render();$("err").hidden=true;$("ok").hidden=true;
 for(var o of added){try{o.n=(await PDFLib.PDFDocument.load(await o.file.arrayBuffer())).getPageCount()}catch(e){o.err=true}render()}
});
$("sn").onchange=function(){var v=$("sn").value;if(!v)return;
 files.sort(function(a,b){return v==="s"?a.file.size-b.file.size:(v==="z"?-1:1)*a.file.name.localeCompare(b.file.name,undefined,{numeric:true})});$("sn").value="";render()};
$("clr").onclick=function(){files=[];render();$("err").hidden=true;$("ok").hidden=true};
$("go").onclick=async function(){
 var err=$("err"),ok=$("ok");err.hidden=true;ok.hidden=true;
 if(files.length<2){err.hidden=false;err.textContent=L("Add at least 2 PDF files.","कम से कम 2 PDF फाइलें जोड़ें।");return}
 var bad=files.find(function(f){return f.err});
 if(bad){err.hidden=false;err.textContent=bad.file.name+": "+L("cannot be opened (damaged or password protected). Remove it and try again.","नहीं खुल सकी (खराब या पासवर्ड वाली)। इसे हटाकर दोबारा कोशिश करें।");return}
 var btn=$("go"),old=btn.textContent;btn.disabled=true;btn.textContent=L("Working...","काम हो रहा है...");
 try{
  var out=await PDFLib.PDFDocument.create();
  for(var i=0;i<files.length;i++){
   var f=files[i],src=await PDFLib.PDFDocument.load(await f.file.arrayBuffer());
   var idx=parse(f.range,src.getPageCount());
   if(idx===false){err.hidden=false;err.textContent=f.file.name+": "+L("invalid page range. Use numbers between 1 and ","पेज रेंज गलत है। 1 से इतने के बीच: ")+src.getPageCount();btn.disabled=false;btn.textContent=old;return}
   var pages=await out.copyPages(src,idx||src.getPageIndices());
   pages.forEach(function(p){out.addPage(p)});
  }
  var bytes=await out.save(),nm=($("on").value.trim().replace(/[\\/:*?"<>|]+/g,"")||"dtahub-merged").replace(/\.pdf$/i,"");
  saveBlob(new Blob([bytes],{type:"application/pdf"}),nm+".pdf");
  ok.hidden=false;ok.textContent=L("Done ✓ ","हो गया ✓ ")+out.getPageCount()+L(" pages"," पेज");
 }catch(e){
  err.hidden=false;err.textContent=L("Could not merge. A file may be damaged or password protected.","जोड़ नहीं सके। कोई फाइल खराब या पासवर्ड वाली हो सकती है।");
 }
 btn.disabled=false;btn.textContent=old;
};
document.addEventListener("langchange",render);

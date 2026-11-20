var cur=null,out="",lastMode="fmt",view="text",MAXN=4000;
function mk(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function typ(v){return v===null?"null":Array.isArray(v)?"array":typeof v}
function sortDeep(v){
 if(Array.isArray(v))return v.map(sortDeep);
 if(v&&typeof v==="object"){var o={};Object.keys(v).sort().forEach(function(k){o[k]=sortDeep(v[k])});return o}
 return v;
}
function stat(v,d){
 var r={depth:d,keys:0,items:0};
 if(Array.isArray(v)){r.items+=v.length;v.forEach(function(x){var s=stat(x,d+1);r.depth=Math.max(r.depth,s.depth);r.keys+=s.keys;r.items+=s.items})}
 else if(v&&typeof v==="object"){var k=Object.keys(v);r.keys+=k.length;k.forEach(function(n){var s=stat(v[n],d+1);r.depth=Math.max(r.depth,s.depth);r.keys+=s.keys;r.items+=s.items})}
 return r;
}
function size(n){return n<1024?fmt(n)+" B":(n/1024).toFixed(1)+" KB"}
function indent(){var v=$("ind").value;return v==="tab"?"\t":+v}
function lc(s,p){var b=s.slice(0,p).split("\n");return{l:b.length,c:b[b.length-1].length+1}}
function showCtx(s,l,c){
 var lines=s.split("\n"),ln=(lines[l-1]||"").replace(/\t/g," "),st=Math.max(0,c-40),seg=ln.slice(st,st+100),ci=c-1-st,pre=(st>0?"…":"");
 var box=$("ctx");box.textContent="";
 box.appendChild(document.createTextNode(l+" │ "+pre+seg.slice(0,ci)));
 var m=mk("mark",null,seg.charAt(ci)||" ");box.appendChild(m);
 box.appendChild(document.createTextNode(seg.slice(ci+1)+"\n"));
 var pad=(l+" │ "+pre).replace(/./g," ")+" ".repeat(Math.max(0,ci));
 box.appendChild(mk("span","cr",pad+"^"));
 box.hidden=false;
 try{var ta=$("in"),off=0;for(var i=0;i<l-1;i++)off+=lines[i].length+1;ta.setSelectionRange(off+c-1,off+c)}catch(e){}
}
function reset(){$("err").hidden=true;$("ok").hidden=true;$("ctx").hidden=true;$("fixnote").hidden=true}
function clearOut(){cur=null;out="";$("out").value="";$("tree").textContent="";$("jf-st").hidden=true;$("csv").hidden=true;$("path").textContent=""}
function showErr(e,raw){
 clearOut();$("err").hidden=false;
 var m=e.message,l=0,c=0,a=/line (\d+) column (\d+)/.exec(m),b=/position (\d+)/.exec(m);
 if(a){l=+a[1];c=+a[2]}
 else if(b){var q=lc(raw,Math.min(+b[1],raw.length));l=q.l;c=q.c}
 else if(/end of JSON|end of data|Unexpected end/i.test(m)){var q2=lc(raw,raw.length);l=q2.l;c=q2.c}
 $("err").textContent=L("Invalid JSON: ","गलत JSON: ")+m+(l?L(" (line "+l+", column "+c+")"," (लाइन "+l+", कॉलम "+c+")"):"");
 if(l)showCtx(raw,l,c);
}
function render(mode){
 reset();lastMode=mode||lastMode;
 var raw=$("in").value;
 if(!raw.trim()){clearOut();return}
 var o;
 try{o=JSON.parse(raw)}catch(e){showErr(e,raw);return}
 if($("srt").checked)o=sortDeep(o);
 cur=o;
 out=lastMode==="min"?JSON.stringify(o):JSON.stringify(o,null,indent());
 $("out").value=out;
 $("ok").hidden=false;$("ok").textContent=L("Valid JSON ✓","सही JSON ✓");
 var s=stat(o,0),bi=new TextEncoder().encode(raw.trim()).length,bo=new TextEncoder().encode(out).length;
 $("js-b").textContent=size(bi)+(bo!==bi?" → "+size(bo):"");
 $("js-d").textContent=fmt(s.depth);$("js-k").textContent=fmt(s.keys);$("js-i").textContent=fmt(s.items);
 $("jf-st").hidden=false;
 $("csv").hidden=!csvOK(o);
 buildTree();
}
/* ---- repair ---- */
function fixJSON(s){
 var o="",i=0,n=s.length,N={};
 function str(q){
  var r='"';i++;
  while(i<n&&s[i]!==q){
   if(s[i]==="\\"&&i+1<n){var x=s[i+1];if(x==="'"){r+="'"}else r+=s[i]+x;i+=2;continue}
   if(s[i]==='"')r+='\\"';else if(s[i]==="\n")r+="\\n";else if(s[i]==="\t")r+="\\t";else if(s[i]==="\r"){}else r+=s[i];
   i++;
  }
  i++;return r+'"';
 }
 while(i<n){
  var ch=s[i];
  if(ch==='"'){o+=str('"');continue}
  if(ch==="'"){o+=str("'");N.q=1;continue}
  if(ch==="/"&&s[i+1]==="/"){while(i<n&&s[i]!=="\n")i++;N.c=1;continue}
  if(ch==="/"&&s[i+1]==="*"){var e=s.indexOf("*/",i+2);i=e<0?n:e+2;N.c=1;continue}
  if(ch==="#"){while(i<n&&s[i]!=="\n")i++;N.c=1;continue}
  if(/[A-Za-z_$]/.test(ch)){
   var j=i;while(j<n&&/[\w$]/.test(s[j]))j++;
   var id=s.slice(i,j),k=j;while(k<n&&/\s/.test(s[k]))k++;
   if(s[k]===":"){o+='"'+id+'"';N.k=1}
   else if(id==="True"||id==="False"){o+=id.toLowerCase();N.p=1}
   else if(id==="None"||id==="undefined"||id==="NaN"){o+="null";N.p=1}
   else o+=id;
   i=j;continue;
  }
  if(ch==="}"||ch==="]"){var t=o.replace(/\s+$/,"");if(t.slice(-1)===","){o=t;N.t=1}}
  o+=ch;i++;
 }
 var t2=o.replace(/\s+$/,"");if(t2.slice(-1)===","){o=t2.slice(0,-1);N.t=1}
 return{text:o,notes:N};
}
function tryFix(){
 reset();var raw=$("in").value;
 if(!raw.trim()){clearOut();return}
 try{JSON.parse(raw);render("fmt");return}catch(e){}
 var f=fixJSON(raw),nt=[];
 if(f.notes.q)nt.push(L("single quotes → double quotes","सिंगल कोट्स → डबल कोट्स"));
 if(f.notes.k)nt.push(L("unquoted keys quoted","बिना कोट वाली keys में कोट जोड़े"));
 if(f.notes.t)nt.push(L("trailing commas removed","अंत की extra कॉमा हटाई"));
 if(f.notes.c)nt.push(L("comments removed","कमेंट हटाए"));
 if(f.notes.p)nt.push(L("Python/JS values → JSON","Python/JS वैल्यू → JSON"));
 try{JSON.parse(f.text)}catch(e){showErr(e,f.text);$("in").value=f.text;showErr(e,f.text);return}
 $("in").value=f.text;render("fmt");
 var fn=$("fixnote");fn.hidden=false;fn.textContent=L("Fixed: ","ठीक किया: ")+(nt.length?nt.join(", "):L("formatting","फॉर्मेटिंग"));
}
/* ---- tree ---- */
function pth(p,k){return typeof k==="number"?p+"["+k+"]":/^[A-Za-z_$][\w$]*$/.test(k)?p+"."+k:p+"["+JSON.stringify(k)+"]"}
function preview(v,t){
 if(t==="array")return "["+v.length+"]";
 if(t==="object")return "{"+Object.keys(v).length+"}";
 var x=JSON.stringify(v);return x.length>160?x.slice(0,160)+'…"':x;
}
var cnt=0;
function node(key,val,path,open,deep){
 var w=mk("div","jf-n"),r=mk("div","jf-r"),t=typ(val),cont=t==="object"||t==="array";
 var ks=cont?(t==="array"?val.map(function(_,i){return i}):Object.keys(val)):[],box=null,tg;
 cnt++;
 if(cont&&ks.length){
  tg=mk("button","jf-tg","▸");tg.type="button";tg.setAttribute("aria-expanded","false");
  tg.setAttribute("aria-label",L("Expand ","खोलें ")+(key==null?"root":key));
 }else{tg=mk("span","jf-sp",cont?"":"·");tg.setAttribute("aria-hidden","true")}
 var pb=mk("button","jf-p");pb.type="button";pb.title=path;
 if(key!=null){pb.appendChild(mk("span","jf-k",String(key)));pb.appendChild(document.createTextNode(": "))}
 pb.appendChild(mk("span","jf-v t-"+t,preview(val,t)));
 pb.addEventListener("click",function(){$("path").textContent=path;copyText(path)});
 r.appendChild(tg);r.appendChild(pb);w.appendChild(r);
 function fill(){
  if(box)return;box=mk("div","jf-c");
  for(var i=0;i<ks.length;i++){
   if(cnt>MAXN){box.appendChild(mk("div","jf-sp",L("… more items hidden for speed","… स्पीड के लिए बाकी आइटम छिपे हैं")));break}
   box.appendChild(node(ks[i],val[ks[i]],pth(path,ks[i]),open>1||deep?1:0,deep));
  }
  w.appendChild(box);
 }
 function set(o){
  if(o)fill();if(!box)return;
  box.hidden=!o;tg.textContent=o?"▾":"▸";tg.setAttribute("aria-expanded",o?"true":"false");
 }
 if(tg.tagName==="BUTTON"){tg.addEventListener("click",function(){set(!box||box.hidden)});w._set=set;if(open>0||deep)set(true)}
 return w;
}
function buildTree(){
 var t=$("tree");t.textContent="";cnt=0;
 t.appendChild(node(null,cur,"$",2,false));
 if(cnt>MAXN)t.appendChild(mk("div","jf-sp",""));
}
function allSet(open){
 var t=$("tree");
 if(open){
  t.textContent="";cnt=0;t.appendChild(node(null,cur,"$",1,true));
  if(cnt>MAXN)toast(L("Very large JSON: showing the first "+MAXN+" nodes","बहुत बड़ा JSON: पहले "+MAXN+" नोड दिखाए"));
 }else{
  t.querySelectorAll(".jf-n").forEach(function(n){if(n._set)n._set(false)});
  var top=t.firstChild;if(top&&top._set)top._set(true);
 }
}
function setView(v){
 view=v;var tr=v==="tree";
 $("vt").classList.toggle("on",!tr);$("vr").classList.toggle("on",tr);
 $("vt").setAttribute("aria-pressed",String(!tr));$("vr").setAttribute("aria-pressed",String(tr));
 $("out").hidden=tr;$("tree").hidden=!tr;$("treeacts").hidden=!tr;
}
/* ---- csv + download ---- */
function csvOK(o){
 var a=Array.isArray(o)?o:(o&&typeof o==="object"?[o]:null);
 return !!a&&a.length>0&&a.every(function(x){return x&&typeof x==="object"&&!Array.isArray(x)});
}
function cell(v){
 if(v==null)return "";
 var s=typeof v==="object"?JSON.stringify(v):String(v);
 return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function toCSV(o){
 var a=Array.isArray(o)?o:[o],cols=[];
 a.forEach(function(r){Object.keys(r).forEach(function(k){if(cols.indexOf(k)<0)cols.push(k)})});
 var rows=[cols.map(cell).join(",")];
 a.forEach(function(r){rows.push(cols.map(function(k){return cell(r[k])}).join(","))});
 return rows.join("\r\n");
}
function save(text,name,mime){
 var u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement("a");
 a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(function(){URL.revokeObjectURL(u)},4000);
}
function loadFile(f){
 if(!f)return;
 if(f.size>10*1048576){toast(L("File is too large (max 10 MB)","फाइल बहुत बड़ी है (अधिकतम 10 MB)"),"err");return}
 f.text().then(function(t){$("in").value=t;render("fmt")},function(){toast(L("Could not read the file","फाइल पढ़ी नहीं जा सकी"),"err")});
}
$("fm").onclick=function(){render("fmt")};
$("mn").onclick=function(){render("min")};
$("fx").onclick=tryFix;
$("clr").onclick=function(){$("in").value="";reset();clearOut()};
$("cp").onclick=function(){copyText($("out").value,$("cp"))};
$("dl").onclick=function(){if(!out){toast(L("Nothing to download yet. Format first.","अभी डाउनलोड के लिए कुछ नहीं है। पहले फॉर्मेट करें।"),"err");return}save(out,"data.json","application/json")};
$("csv").onclick=function(){if(cur&&csvOK(cur))save("﻿"+toCSV(cur),"data.csv","text/csv")};
$("ind").onchange=$("srt").onchange=function(){if(cur)render()};
$("vt").onclick=function(){setView("text")};
$("vr").onclick=function(){setView("tree")};
$("exa").onclick=function(){if(cur)allSet(true)};
$("coa").onclick=function(){if(cur)allSet(false)};
$("jf-file").addEventListener("change",function(e){loadFile(e.target.files[0]);e.target.value=""});
document.addEventListener("langchange",function(){if(cur)render()});

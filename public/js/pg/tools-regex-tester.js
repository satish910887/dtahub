var fl={g:1,i:0,m:0,s:0,u:0};
document.querySelectorAll("[data-f]").forEach(function(b){b.onclick=function(){var k=b.dataset.f;fl[k]=fl[k]?0:1;b.setAttribute("aria-pressed",fl[k]?"true":"false");run()}});
function run(){
 var e=$("err"),pat=$("re").value,txt=$("tx").value,hl=$("hl"),list=$("list");
 e.hidden=true;hl.textContent="";list.textContent="";$("cnt").textContent="0";$("rwrap").hidden=true;
 if(!pat){hl.textContent=txt;return}
 var flags=Object.keys(fl).filter(function(k){return fl[k]}).join(""),re;
 try{re=new RegExp(pat,flags.indexOf("g")<0?flags+"g":flags)}catch(x){e.hidden=false;e.textContent=x.message;hl.textContent=txt;return}
 var rp0=$("rp").value;
 matchSafe(pat,flags,txt,rp0,function(r){
  if(r.timeout){e.hidden=false;e.textContent=L("This pattern is taking too long (it may backtrack badly). Simplify it, for example avoid nested repeats like (a+)+.","यह पैटर्न बहुत देर ले रहा है (शायद बहुत बैकट्रैक कर रहा है)। इसे सरल करें, जैसे (a+)+ जैसे नेस्टेड रिपीट न रखें।");hl.textContent=txt;return}
  show(r,txt,hl,list)});
}
var wk=null,wt=0,seq=0;
function matchSafe(pat,flags,txt,rp,cb){
 var my=++seq;if(wk){wk.terminate();wk=null;clearTimeout(wt)}
 try{wk=new Worker("/js/regex-worker.js")}catch(x){return cb(localMatch(pat,flags,txt,rp))}
 var w=wk;w.postMessage({pat:pat,flags:flags,txt:txt,rp:rp});
 wt=setTimeout(function(){if(my!==seq)return;w.terminate();wk=null;cb({timeout:1})},1500);
 w.onmessage=function(ev){clearTimeout(wt);if(my!==seq)return;wk=null;w.terminate();cb(ev.data)};
 w.onerror=function(){clearTimeout(wt);if(my===seq){wk=null;cb(localMatch(pat,flags,txt,rp))}};
}
function localMatch(pat,flags,txt,rp){
 var ms=[],m,g=0,re=new RegExp(pat,flags.indexOf("g")<0?flags+"g":flags),gl=flags.indexOf("g")>=0;
 while((m=re.exec(txt))&&g++<2000){ms.push({0:m[0],index:m.index,gr:[].slice.call(m,1),named:m.groups?Object.assign({},m.groups):null});if(m[0]==="")re.lastIndex++;if(!gl)break}
 var rout=null;if(rp!==""){try{rout=txt.replace(new RegExp(pat,flags),rp)}catch(x){}}
 return{ms:ms,guard:g,rout:rout};
}
function show(r,txt,hl,list){
 var ms=r.ms,guard=r.guard;
 var frag=document.createDocumentFragment(),pos=0;
 ms.forEach(function(x,k){
  if(x.index>pos)frag.appendChild(document.createTextNode(txt.slice(pos,x.index)));
  if(x[0]!==""){var mk=document.createElement("mark");if(k%2)mk.className="alt";mk.textContent=x[0];frag.appendChild(mk)}
  pos=x.index+x[0].length;
 });
 frag.appendChild(document.createTextNode(txt.slice(pos)));hl.appendChild(frag);
 $("cnt").textContent=ms.length+(guard>=2000?"+":"");
 ms.slice(0,100).forEach(function(x,k){
  var d=document.createElement("div");d.className="rxm";
  var b=document.createElement("b");b.textContent="#"+(k+1)+" ";d.appendChild(b);
  d.appendChild(document.createTextNode(JSON.stringify(x[0])));
  var sp=document.createElement("span");sp.textContent="  @"+x.index;d.appendChild(sp);
  x.gr.forEach(function(gv,gi){var gd=document.createElement("div");gd.textContent="  $"+(gi+1)+" = "+(gv===undefined?"undefined":JSON.stringify(gv));d.appendChild(gd)});
  if(x.named){Object.keys(x.named).forEach(function(n){var nd=document.createElement("div");nd.textContent="  <"+n+"> = "+JSON.stringify(x.named[n]);d.appendChild(nd)})}
  list.appendChild(d);
 });
 if(r.rout!==null){$("rout").textContent=r.rout;$("rwrap").hidden=false}
}
["re","tx","rp"].forEach(function(i){$(i).addEventListener("input",run)});
$("cp").onclick=function(){copyText($("rout").textContent,this)};
run();

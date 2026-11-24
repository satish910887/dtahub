var mode="line",opt={ic:0,iw:0,ib:0,co:0},last=[],sbs=0;
$("sb").onclick=function(){sbs=sbs?0:1;this.setAttribute("aria-pressed",sbs?"true":"false");run()};
document.querySelectorAll("[data-m]").forEach(function(b){b.onclick=function(){mode=b.dataset.m;document.querySelectorAll("[data-m]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});run()}});
["ic","iw","ib","co"].forEach(function(k){$(k).onclick=function(){opt[k]=opt[k]?0:1;this.setAttribute("aria-pressed",opt[k]?"true":"false");run()}});
function norm(s){if(opt.ic)s=s.toLowerCase();if(opt.iw)s=s.replace(/\s+/g," ").trim();return s}
function tok(t){if(mode==="line"){var a=t.replace(/\r\n?/g,"\n").split("\n");return opt.ib?a.filter(function(l){return l.trim()!==""}):a}return t.split(/(\s+)/).filter(function(x){return x!==""})}
function wops(a,b){return diff(a.split(/(\s+)/).filter(Boolean),b.split(/(\s+)/).filter(Boolean))}
/* Myers O(ND) diff for long inputs with few changes. returns [op,index] where index points into a (for = and -) or b (for +); null when too many differences */
function myers(a,b){
 var n=a.length,m=b.length,ids=new Map(),x,y,A=new Int32Array(n),B=new Int32Array(m),i;
 for(i=0;i<n;i++){var v=ids.get(a[i]);if(v===undefined){v=ids.size;ids.set(a[i],v)}A[i]=v}
 for(i=0;i<m;i++){var w=ids.get(b[i]);if(w===undefined){w=ids.size;ids.set(b[i],w)}B[i]=w}
 var MAXD=Math.min(n+m,3000),off=MAXD+1,V=new Int32Array(2*MAXD+3),trace=[],d,k;
 V[off+1]=0;
 for(d=0;d<=MAXD;d++){
  trace.push(V.slice(off-d-1,off+d+2));
  for(k=-d;k<=d;k+=2){
   if(k===-d||(k!==d&&V[off+k-1]<V[off+k+1]))x=V[off+k+1];else x=V[off+k-1]+1;
   y=x-k;
   while(x<n&&y<m&&A[x]===B[y]){x++;y++}
   V[off+k]=x;
   if(x>=n&&y>=m){
    var ops=[],cx=n,cy=m,dd,kk,vv;
    for(dd=d;dd>0;dd--){
     vv=trace[dd];kk=cx-cy;var base=dd+1; /* vv index = k+base-... see slice start off-dd-1 */
     var get=function(q){return vv[q+dd+1]};
     var pk=(kk===-dd||(kk!==dd&&get(kk-1)<get(kk+1)))?kk+1:kk-1,px=get(pk),py=px-pk;
     while(cx>px&&cy>py){cx--;cy--;ops.push(["=",cx])}
     if(cx===px){cy--;ops.push(["+",cy])}else{cx--;ops.push(["-",cx])}
    }
    while(cx>0&&cy>0){cx--;cy--;ops.push(["=",cx])}
    return ops.reverse();
   }
  }
 }
 return null;
}
function diff(A,B){
 var na=A.map(norm),nb=B.map(norm),p=0,s=0;
 while(p<na.length&&p<nb.length&&na[p]===nb[p])p++;
 while(s<na.length-p&&s<nb.length-p&&na[na.length-1-s]===nb[nb.length-1-s])s++;
 var a=na.slice(p,na.length-s),b=nb.slice(p,nb.length-s),n=a.length,m=b.length;
 if(n*m>9000000){var mo=myers(a,b);if(!mo)return null;var o2=[],k2;
  for(k2=0;k2<p;k2++)o2.push(["=",A[k2]]);
  mo.forEach(function(o){o2.push([o[0],o[0]==="+"?B[p+o[1]]:A[p+o[1]]])});
  for(k2=0;k2<s;k2++)o2.push(["=",A[A.length-s+k2]]);return o2}
 var W=m+1,T=new Uint32Array((n+1)*W),i,j;
 for(i=n-1;i>=0;i--)for(j=m-1;j>=0;j--)T[i*W+j]=a[i]===b[j]?T[(i+1)*W+j+1]+1:Math.max(T[(i+1)*W+j],T[i*W+j+1]);
 var ops=[],k;
 for(k=0;k<p;k++)ops.push(["=",A[k]]);
 i=0;j=0;
 while(i<n&&j<m){
  if(a[i]===b[j]){ops.push(["=",A[p+i]]);i++;j++}
  else if(T[(i+1)*W+j]>=T[i*W+j+1]){ops.push(["-",A[p+i]]);i++}
  else{ops.push(["+",B[p+j]]);j++}
 }
 while(i<n){ops.push(["-",A[p+i]]);i++}
 while(j<m){ops.push(["+",B[p+j]]);j++}
 for(k=0;k<s;k++)ops.push(["=",A[A.length-s+k]]);
 return ops;
}
function run(){
 var e=$("err");e.hidden=true;
 var ta=$("a").value,tb=$("b").value;
 if(!ta&&!tb){$("res").hidden=true;return}
 var ops=diff(tok(ta),tok(tb));
 if(!ops){$("res").hidden=true;e.hidden=false;e.textContent=L("These texts are too long to compare in the browser. Try comparing smaller parts.","ये टेक्स्ट ब्राउज़र में तुलना के लिए बहुत लंबे हैं। छोटे हिस्सों की तुलना करें।");return}
 last=ops;var out=$("out");out.textContent="";
 var add=0,rem=0,same=0,frag=document.createDocumentFragment();
 if(mode==="line"){
  out.className="dfo"+(sbs?" sbs":"");
  if(sbs){
   var cell=function(txt,cls){var d=document.createElement("span");d.className="l"+(cls?" "+cls:"");d.textContent=txt;frag.appendChild(d)},dl=[],al=[];
   var flush=function(){var n=Math.max(dl.length,al.length);for(var q=0;q<n;q++){q<dl.length?cell(dl[q],"rm"):cell("","sp");q<al.length?cell(al[q],"ad"):cell("","sp")}dl=[];al=[]};
   ops.forEach(function(o){
    if(o[0]==="-"){dl.push(o[1]);rem++}else if(o[0]==="+"){al.push(o[1]);add++}else{flush();cell(o[1]);cell(o[1]);same++}
   });flush();
  }else{
   var line=function(txt,cls,pre){var d=document.createElement("span");d.className="l"+(cls?" "+cls:"");d.textContent=pre+txt;frag.appendChild(d);return d};
   var segs=function(wo,side){var d=document.createElement("span");d.className="l "+(side==="-"?"rm":"ad");d.appendChild(document.createTextNode(side+" "));wo.forEach(function(w){if(w[0]==="="){d.appendChild(document.createTextNode(w[1]))}else if(w[0]===side){var e=document.createElement(side==="-"?"del":"ins");e.textContent=w[1];d.appendChild(e)}});frag.appendChild(d)};
   var gap=function(n){var g=document.createElement("span");g.className="gap";g.textContent="⋯ "+n+L(" unchanged lines"," लाइनें वैसी ही");frag.appendChild(g)};
   var i=0,CT=2;
   while(i<ops.length){
    if(ops[i][0]==="="){
     var st=i;while(i<ops.length&&ops[i][0]==="=")i++;
     var run=ops.slice(st,i);same+=run.length;
     if((opt.co||ops.length>4000)&&run.length>2*CT+1){
      var first=st===0,lastr=i===ops.length;
      var head=first?0:CT,tail=lastr?0:CT;
      if(run.length>head+tail+1){run.slice(0,head).forEach(function(o){line(o[1],"","  ")});gap(run.length-head-tail);run.slice(run.length-tail).forEach(function(o){line(o[1],"","  ")});continue}
     }
     run.forEach(function(o){line(o[1],"","  ")});continue;
    }
    var rm=[],ad=[];
    while(i<ops.length&&ops[i][0]!=="="){(ops[i][0]==="-"?rm:ad).push(ops[i][1]);i++}
    rem+=rm.length;add+=ad.length;
    if(rm.length===ad.length){
     for(var q=0;q<rm.length;q++){var wo=wops(rm[q],ad[q]),sm=0,tl=0;if(wo)wo.forEach(function(w){if(!/^\s+$/.test(w[1])){tl++;if(w[0]==="=")sm++}});
      if(wo&&tl&&sm/tl>=.3){segs(wo,"-");segs(wo,"+")}else{line(rm[q],"rm","- ");line(ad[q],"ad","+ ")}}
    }else{rm.forEach(function(x){line(x,"rm","- ")});ad.forEach(function(x){line(x,"ad","+ ")})}
   }
  }
 }else{
  ops.forEach(function(o){
   var t=o[0]==="+"?document.createElement("ins"):o[0]==="-"?document.createElement("del"):document.createElement("span");
   t.textContent=o[1];frag.appendChild(t);
   if(/^\s+$/.test(o[1]))return;
   if(o[0]==="+")add++;else if(o[0]==="-")rem++;else same++;
  });
 }
 out.appendChild(frag);
 $("sa").textContent=add;$("sr").textContent=rem;$("ss").textContent=same;var den=2*same+add+rem;$("sp").textContent=(den?Math.round(2*same/den*100):100)+"%";$("res").hidden=false;
}
$("go").onclick=run;
$("sw").onclick=function(){var t=$("a").value;$("a").value=$("b").value;$("b").value=t;run()};
$("cp").onclick=function(){
 var s=last.filter(function(o){return o[0]!=="="}).map(function(o){return o[0]+" "+o[1]}).join(mode==="line"?"\n":" ");
 copyText(s||L("No changes","कोई बदलाव नहीं"),this);
};
$("dl").onclick=function(){var t=last.map(function(o){return(o[0]==="="?"  ":o[0]+" ")+o[1]}).join(mode==="line"?"\n":"");saveBlob(new Blob([t+"\n"],{type:"text/plain;charset=utf-8"}),"changes.diff")};
$("a").addEventListener("input",run);$("b").addEventListener("input",run);

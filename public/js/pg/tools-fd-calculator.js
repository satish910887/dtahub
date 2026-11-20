var T="fd",IDS=["amt","rate","mo","cp","tr2","tl","inf"],last="",rowsData=[];
document.querySelectorAll("[data-t]").forEach(function(b){b.onclick=function(){T=b.dataset.t;document.querySelectorAll("[data-t]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});if(T==="rd"&&+$("amt").value>=50000)$("amt").value=5000;if(T==="fd"&&+$("amt").value<=20000)$("amt").value=100000;calc()}});
function lang(){$("ah").textContent=T==="fd"?L("One-time lump sum deposit.","एक बार में जमा की गई राशि।"):L("Amount deposited every month.","हर महीने जमा की जाने वाली राशि।")}
function bal(P,r,mo,n){
 if(T==="fd"){return n===0?P*(1+r*mo/12):P*Math.pow(1+r/n,n*mo/12)}
 var tot=0;
 for(var k=1;k<=mo;k++){var t=(mo-k+1)/12;tot+=n===0?P*(1+r*t):P*Math.pow(1+r/n,n*t)}
 return tot;
}
function chart(pts,inv){
 var s=$("sc"),ns="http://www.w3.org/2000/svg",W=320,H=150,l=6,b=18,t=8,n=pts.length-1,max=pts[n][1];
 while(s.firstChild)s.removeChild(s.firstChild);
 function el(tg,a,tx){var e=document.createElementNS(ns,tg);for(var k in a)e.setAttribute(k,a[k]);if(tx!=null)e.textContent=tx;s.appendChild(e);return e}
 var X=function(i){return l+(i/n)*(W-2*l)},Y=function(v){return t+(1-v/max)*(H-t-b)};
 el("line",{x1:l,y1:H-b,x2:W-l,y2:H-b,stroke:"currentColor","stroke-opacity":".25"});
 var d1="",d2="";pts.forEach(function(p,i){d1+=(i?"L":"M")+X(i).toFixed(1)+","+Y(p[1]).toFixed(1);d2+=(i?"L":"M")+X(i).toFixed(1)+","+Y(p[0]).toFixed(1)});
 el("path",{d:d1,fill:"none",stroke:"#f5d27a","stroke-width":"2.4","stroke-linejoin":"round"});
 el("path",{d:d2,fill:"none",stroke:"#8b5cf6","stroke-width":"2.4","stroke-linejoin":"round"});
 el("text",{x:l,y:H-4,fill:"currentColor","font-size":"10"},"0");
 el("text",{x:W-l,y:H-4,fill:"currentColor","font-size":"10","text-anchor":"end"},(pts.length-1)+L(" yr"," वर्ष"));
}
function calc(){
 lang();
 var P=+$("amt").value,base=+$("rate").value,sr=$("sr").checked,R=(base+(sr?.5:0))/100,M=Math.floor(+$("mo").value),N=+$("cp").value;
 if(!(P>0)||!(base>=0)||!(M>=1)||M>600){$("res").hidden=true;return}
 var inv=T==="fd"?P:P*M,tot=bal(P,R,M,N),g=tot-inv,r=function(n){return"₹ "+fmt(Math.round(n))};
 $("res").hidden=false;$("o-inv").textContent=r(inv);$("o-gain").textContent=r(g);$("o-tot").textContent=r(tot);
 $("b1").style.width=(inv/tot*100)+"%";$("b2").style.width=(g/tot*100)+"%";
 var Y=Math.ceil(M/12),rows=[],pts=[[T==="fd"?P:0,T==="fd"?P:0]],prevB=T==="fd"?P:0,tds=0,td=$("td").checked,tr=(+$("tr2").value||0)/100,tl=+$("tl").value||0;
 rowsData=[["Year","Deposited","Value","Interest in year","TDS"]];
 for(var y=1;y<=Y;y++){var m=Math.min(M,y*12),b=bal(P,R,m,N),i2=T==="fd"?P:P*m,iy=b-prevB-(T==="fd"?0:P*(m-(y-1)*12)),ty=(td&&iy>tl)?iy*tr:0;
  tds+=ty;prevB=b;pts.push([i2,b]);rowsData.push([y,i2.toFixed(2),b.toFixed(2),iy.toFixed(2),ty.toFixed(2)]);
  rows.push('<div><span>'+L("Year ","साल ")+y+'</span><span>'+r(i2)+' → <b>'+r(b)+'</b></span></div>')}
 $("yy").innerHTML=rows.join("");chart(pts);
 var F=+$("inf").value||0;
 $("xt").hidden=$("xn").hidden=!td;$("xr").hidden=!(F>0);$("xo").hidden=!(td||F>0);
 if(td){$("o-tds").textContent=r(tds);$("o-net").textContent=r(tot-tds)}
 if(F>0)$("o-real").textContent=r((tot-(td?tds:0))/Math.pow(1+F/100,M/12));
 last=(T==="fd"?"FD":"RD")+" ₹"+fmt(P)+", "+(base+(sr?.5:0))+"%, "+M+L(" months → maturity "," माह → मैच्योरिटी ")+r(tot)+(td?" ("+L("after TDS ","TDS के बाद ")+r(tot-tds)+")":"");
 try{history.replaceState(null,"","#"+IDS.map(function(i){return i+"="+encodeURIComponent($(i).value)}).join("&")+"&t="+T+"&sr="+(sr?1:0)+"&td="+(td?1:0))}catch(e){}
}
(function(){try{var h=location.hash.slice(1);if(!h)return;var o={};h.split("&").forEach(function(p){var a=p.split("=");o[a[0]]=decodeURIComponent(a[1]||"")});
 IDS.forEach(function(i){if(o[i]!==undefined&&o[i]!==""&&isFinite(+o[i]))$(i).value=o[i]});
 if(o.sr==="1")$("sr").checked=true;if(o.td==="1"){$("td").checked=true;$("adv").open=true}
 if(o.t==="rd")document.getElementById("tr").click()}catch(e){}})();
$("cpy").onclick=function(){if(last)copyText(last)};
$("lnk").onclick=function(){copyText(location.href)};
$("csv").onclick=function(){var t=rowsData.map(function(r){return r.join(",")}).join("\n");saveBlob(new Blob([t],{type:"text/csv"}),(T==="fd"?"fd":"rd")+"-schedule.csv")};
document.querySelectorAll("input,select").forEach(function(e){e.addEventListener("input",calc);e.addEventListener("change",calc)});
document.addEventListener("langchange",calc);calc();

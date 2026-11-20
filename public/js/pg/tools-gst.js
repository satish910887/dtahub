var mode="add",inter=false,last="",lines=[{n:"",q:1,p:1000,r:18}];
var inr=function(v){return"₹\u00a0"+fmt(v)};
function calc(){
 var A=+$("amt").value,R=+$("rate").value;
 document.querySelectorAll(".r").forEach(function(b){b.classList.toggle("on",+b.dataset.r===R)});
 bill();
 if(!(A>=0)||!(R>=0)||$("amt").value===""){$("res").hidden=true;return}
 var net,gst,tot;
 if(mode==="add"){net=A;gst=A*R/100;tot=A+gst}
 else{net=A*100/(100+R);gst=A-net;tot=A}
 var ro=0;if($("rnd").checked){ro=Math.round(tot)-tot;tot=Math.round(tot)}
 $("res").hidden=false;
 $("o-net").textContent=inr(net);$("o-gst").textContent=inr(gst);
 $("o-c").textContent=inr(gst/2);$("o-s").textContent=inr(gst/2);$("o-i").textContent=inr(gst);
 $("wc").hidden=$("ws").hidden=inter;$("wi").hidden=!inter;
 $("wr").hidden=!$("rnd").checked;$("o-r").textContent=(ro>=0?"+":"−")+inr(Math.abs(ro));
 $("o-tot").textContent=inr(tot);
 last=L("Net","बिना GST")+" "+inr(net)+" | GST "+R+"% "+inr(gst)+(inter?" (IGST)":" (CGST+SGST)")+" | "+L("Total","कुल")+" "+inr(tot);
}
function bill(){
 var box=$("rows");
 if(box.children.length!==lines.length){
  box.innerHTML="";
  lines.forEach(function(l,i){
   var d=document.createElement("div");d.className="irow";
   d.innerHTML='<input class="nm" aria-label="Item" placeholder="Item" value=""><input data-k="q" type="number" inputmode="decimal" min="0" aria-label="Qty" placeholder="Qty"><input data-k="p" type="number" inputmode="decimal" min="0" aria-label="Price" placeholder="Price"><select data-k="r" aria-label="GST %"><option>0</option><option>0.25</option><option>3</option><option>5</option><option>12</option><option>18</option><option>28</option></select><button class="btn" type="button" aria-label="Remove">✕</button>';
   var ins=d.querySelectorAll("input,select");
   ins[0].value=l.n;ins[1].value=l.q;ins[2].value=l.p;ins[3].value=l.r;
   ins[0].oninput=function(){l.n=ins[0].value};
   [1,2,3].forEach(function(k){ins[k].oninput=ins[k].onchange=function(){l[["","q","p","r"][k]]=+ins[k].value;bill()}});
   d.querySelector("button").onclick=function(){if(lines.length>1){lines.splice(i,1);box.innerHTML="";bill()}};
   box.appendChild(d);
  });
 }
 var by={},net=0,gst=0;
 lines.forEach(function(l){var n=(l.q||0)*(l.p||0),g=n*(l.r||0)/100;net+=n;gst+=g;by[l.r]=(by[l.r]||0)+g});
 var tot=net+gst,ro=0;if($("rnd").checked){ro=Math.round(tot)-tot;tot=Math.round(tot)}
 var h='<div class="stat"><small>'+L("Taxable value","कर योग्य मूल्य")+'</small><b>'+inr(net)+'</b></div>';
 Object.keys(by).sort(function(a,b){return a-b}).forEach(function(r){
  h+=inter?'<div class="stat"><small>IGST '+r+'%</small><b>'+inr(by[r])+'</b></div>':'<div class="stat"><small>CGST '+(r/2)+'%</small><b>'+inr(by[r]/2)+'</b></div><div class="stat"><small>SGST '+(r/2)+'%</small><b>'+inr(by[r]/2)+'</b></div>'});
 h+='<div class="stat big"><small>'+L("Invoice total","बिल कुल")+'</small><b>'+inr(tot)+'</b></div>';
 $("bt").innerHTML=h;bill.t={net:net,gst:gst,tot:tot,ro:ro};
}
$("addr").onclick=function(){lines.push({n:"",q:1,p:0,r:18});bill()};
$("csv").onclick=function(){
 var q=function(x){return'"'+String(x).replace(/"/g,'""')+'"'};
 var t="Item,Qty,Price,GST %,Taxable,GST,"+(inter?"IGST":"CGST,SGST")+",Total\n"+lines.map(function(l){var n=l.q*l.p,g=n*l.r/100;return[q(l.n),l.q,l.p,l.r,n.toFixed(2),g.toFixed(2)].concat(inter?[g.toFixed(2)]:[(g/2).toFixed(2),(g/2).toFixed(2)],[(n+g).toFixed(2)]).join(",")}).join("\n");
 var T=bill.t;t+="\nTOTAL,,,,"+T.net.toFixed(2)+","+T.gst.toFixed(2)+(inter?","+T.gst.toFixed(2):","+(T.gst/2).toFixed(2)+","+(T.gst/2).toFixed(2))+","+T.tot.toFixed(2);
 saveBlob(new Blob([t],{type:"text/csv"}),"gst-bill.csv");
};
document.querySelectorAll("#res ~ * input,input").forEach(function(i){i.addEventListener("input",calc)});
$("rnd").addEventListener("change",calc);
document.querySelectorAll(".r").forEach(function(b){b.onclick=function(){$("rate").value=b.dataset.r;calc()}});
$("madd").onclick=function(){mode="add";$("madd").classList.add("on");$("mrem").classList.remove("on");calc()};
$("mrem").onclick=function(){mode="rem";$("mrem").classList.add("on");$("madd").classList.remove("on");calc()};
$("tin").onclick=function(){inter=false;$("tin").classList.add("on");$("tout").classList.remove("on");calc()};
$("tout").onclick=function(){inter=true;$("tout").classList.add("on");$("tin").classList.remove("on");calc()};
$("cpy").onclick=function(){if(last)copyText(last)};
document.addEventListener("langchange",calc);
calc();

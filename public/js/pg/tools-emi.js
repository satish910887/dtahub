var unit="y",rows=[],last="";
var IDS=["amt","rate","ten","xtra","fee","lump","lumpm"];
function inr(x){return"₹ "+fmt(Math.round(x))}
function emiOf(P,r,n){return r===0?P/n:P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)}
function sim(P,r,n,emi,xtra,lump,lm){
 var out=[],b=P,k=0;
 while(b>0.005&&k<1200){
  k++;var i=b*r,pr=Math.min(b,Math.max(0,emi-i)),ex=0;
  if(xtra>0||(lump>0&&k===lm)){ex=Math.min(b-pr,xtra+(k===lm?lump:0))}
  if(k===n&&!(xtra>0)&&!(lump>0))pr=b;
  b=b-pr-ex;if(b<0.005)b=0;out.push([k,pr,i,ex,b]);
 }
 return out;
}
function curve(rs,n,W,H,p){
 var pts=rs.map(function(x){return[p.l+(x[0]/n)*(W-p.l-p.r),p.t+(1-x[4]/P0)*(H-p.t-p.b)]});
 return pts;
}
var P0=1;
function path(rs,n,W,H,p){
 var d="M"+p.l+","+p.t;
 rs.forEach(function(x){d+="L"+(p.l+(x[0]/n)*(W-p.l-p.r)).toFixed(1)+","+(p.t+(1-x[4]/P0)*(H-p.t-p.b)).toFixed(1)});
 return d;
}
function chart(base,pre,n,P){
 P0=P;var W=320,H=170,p={l:8,r:8,t:8,b:22},s=$("bal");
 var ns="http://www.w3.org/2000/svg";while(s.firstChild)s.removeChild(s.firstChild);
 function el(t,a,tx){var e=document.createElementNS(ns,t);for(var k in a)e.setAttribute(k,a[k]);if(tx!=null)e.textContent=tx;s.appendChild(e);return e}
 el("line",{x1:p.l,y1:H-p.b,x2:W-p.r,y2:H-p.b,stroke:"currentColor","stroke-opacity":".25"});
 var d0="M"+p.l+","+p.t,pb=path([[0,0,0,0,P]].concat(base),n,W,H,p);
 el("path",{d:pb,fill:"none",stroke:"#8b5cf6","stroke-width":"2.4","stroke-linejoin":"round"});
 if(pre){el("path",{d:path([[0,0,0,0,P]].concat(pre),n,W,H,p),fill:"none",stroke:"#f5d27a","stroke-width":"2.4","stroke-linejoin":"round"})}
 var ty=n/12;
 el("text",{x:p.l,y:H-6,fill:"currentColor","font-size":"10","fill-opacity":".7"},"0");
 el("text",{x:W-p.r,y:H-6,fill:"currentColor","font-size":"10","text-anchor":"end","fill-opacity":".7"},(ty%1===0?ty:ty.toFixed(1))+L(" yr"," वर्ष"));
 el("text",{x:p.l+2,y:p.t+10,fill:"currentColor","font-size":"10","fill-opacity":".7"},inr(P));
}
function calc(){
 var P=+$("amt").value,R=+$("rate").value,T=+$("ten").value;
 var xt=+$("xtra").value||0,fee=+$("fee").value||0,lump=+$("lump").value||0,lm=Math.floor(+$("lumpm").value)||1;
 if(!(P>0)||!(R>=0)||!(T>0)||xt<0||lump<0||fee<0){["res","sch","gr"].forEach(function(i){$(i).hidden=true});return}
 var n=Math.round(unit==="y"?T*12:T);if(n<1)n=1;
 var r=R/1200,emi=emiOf(P,r,n);
 var base=sim(P,r,n,emi,0,0,0),pre=(xt>0||lump>0)?sim(P,r,n,emi,xt,lump,lm):null;
 var cur=pre||base,intr=cur.reduce(function(a,x){return a+x[2]},0),tot=P+intr,pp=P/tot*100;
 var bint=base.reduce(function(a,x){return a+x[2]},0);
 $("res").hidden=false;
 $("o-emi").textContent=inr(emi);$("o-int").textContent=inr(intr);$("o-tot").textContent=inr(tot);
 $("arc").setAttribute("stroke-dasharray",pp.toFixed(2)+" "+(100-pp).toFixed(2));
 $("l-p").textContent=L("Principal","मूलधन")+" "+pp.toFixed(1)+"%";
 $("l-i").textContent=L("Interest","ब्याज")+" "+(100-pp).toFixed(1)+"%";
 $("sv").hidden=!pre;
 if(pre){var sm=base.length-pre.length;$("o-save").textContent=inr(Math.max(0,bint-intr));
  $("o-sooner").textContent=Math.floor(sm/12)+L(" yr "," वर्ष ")+(sm%12)+L(" mo"," माह")}
 var fv=P*fee/100;$("fe").hidden=!(fee>0);
 if(fee>0){$("o-fee").textContent=inr(fv);$("o-cost").textContent=inr(tot+fv)}
 // chart, year table
 $("gr").hidden=false;chart(base,pre,n,P);$("lg2").hidden=!pre;
 var yr="",ny=Math.ceil(cur.length/12);
 for(var y=0;y<ny;y++){var sl=cur.slice(y*12,y*12+12),pr=0,it=0;
  sl.forEach(function(x){pr+=x[1]+x[3];it+=x[2]});
  yr+="<div><span>"+L("Year ","साल ")+(y+1)+"</span><span>"+inr(pr)+" + "+inr(it)+" → <b>"+inr(sl[sl.length-1][4])+"</b></span></div>"}
 $("yr").innerHTML=yr;
 var ten=[3,5,7,10,15,20,25,30],cm="";
 ten.forEach(function(y){var e=emiOf(P,r,y*12);cm+="<div><span>"+y+L(" yr"," वर्ष")+"</span><span>EMI "+inr(e)+" · "+L("interest ","ब्याज ")+inr(e*y*12-P)+"</span></div>"});
 $("cmp").innerHTML=cm;
 rows=cur;
 $("schb").innerHTML=cur.slice(0,360).map(function(x){return"<div><span>"+L("Month ","महीना ")+x[0]+"</span><span>"+inr(x[1])+" + "+inr(x[2])+(x[3]>0?" + "+inr(x[3]):"")+" → <b>"+inr(x[4])+"</b></span></div>"}).join("")+(cur.length>360?"<div><span>…</span><span>"+L("Download CSV for the full schedule","पूरी तालिका के लिए CSV डाउनलोड करें")+"</span></div>":"");
 $("sch").hidden=false;
 last="EMI: ₹"+fmt(emi)+" | "+L("Interest","ब्याज")+": ₹"+fmt(intr)+" | "+L("Total","कुल")+": ₹"+fmt(tot)+" ("+L("Loan","लोन")+" ₹"+fmt(P)+", "+R+"%, "+cur.length+L(" months"," माह")+")";
 try{var q=IDS.map(function(i){return i+"="+encodeURIComponent($(i).value)}).join("&")+"&u="+unit;history.replaceState(null,"","#"+q)}catch(e){}
}
function load(){
 try{var h=location.hash.slice(1);if(!h)return;var o={};h.split("&").forEach(function(p){var a=p.split("=");o[a[0]]=decodeURIComponent(a[1]||"")});
  IDS.forEach(function(i){if(o[i]!==undefined&&o[i]!==""&&isFinite(+o[i]))$(i).value=o[i]});
  if(o.u==="m"){unit="m";$("um").classList.add("on");$("uy").classList.remove("on")}
  if(+o.xtra>0||+o.lump>0||+o.fee>0)$("adv").open=true}catch(e){}
}
$("csv").onclick=function(){
 if(!rows.length)return;
 var t="Month,Principal,Interest,Prepayment,Balance\n"+rows.map(function(x){return x[0]+","+x[1].toFixed(2)+","+x[2].toFixed(2)+","+x[3].toFixed(2)+","+x[4].toFixed(2)}).join("\n");
 var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([t],{type:"text/csv"}));a.download="emi-schedule.csv";document.body.appendChild(a);a.click();a.remove();
 if(window.toast)toast(L("Download started ✓","डाउनलोड शुरू ✓"));
};
$("cpy").onclick=function(){if(last)copyText(last)};
document.querySelectorAll("input").forEach(function(i){i.addEventListener("input",calc)});
$("uy").onclick=function(){unit="y";$("uy").classList.add("on");$("um").classList.remove("on");calc()};
$("um").onclick=function(){unit="m";$("um").classList.add("on");$("uy").classList.remove("on");calc()};
document.addEventListener("langchange",calc);
load();calc();

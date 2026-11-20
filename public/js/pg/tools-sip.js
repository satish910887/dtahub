var IDS=["amt","rate","yrs","step","lump","inf","goal"],last="";
function run(A,R,Y,S,Lp){
 var i=R/1200,bal=Lp,inv=Lp,amt=A,rows=[];
 for(var y=1;y<=Y;y++){for(var m=0;m<12;m++){bal=(bal+amt)*(1+i);inv+=amt}rows.push([y,inv,bal]);amt=amt*(1+S/100)}
 return{bal:bal,inv:inv,rows:rows};
}
function need(G,R,Y,S,Lp){ // bisection on starting SIP
 var lo=0,hi=G;for(var k=0;k<60;k++){var mid=(lo+hi)/2;if(run(mid,R,Y,S,Lp).bal<G)lo=mid;else hi=mid}return hi;
}
function chart(rows,inf){
 var s=$("sc"),ns="http://www.w3.org/2000/svg",W=320,H=150,l=6,b=18,t=8,max=rows[rows.length-1][2];
 while(s.firstChild)s.removeChild(s.firstChild);
 function el(tg,a,tx){var e=document.createElementNS(ns,tg);for(var k in a)e.setAttribute(k,a[k]);if(tx!=null)e.textContent=tx;s.appendChild(e);return e}
 var n=rows.length,X=function(y){return l+(y/n)*(W-2*l)},Yv=function(v){return t+(1-v/max)*(H-t-b)};
 el("line",{x1:l,y1:H-b,x2:W-l,y2:H-b,stroke:"currentColor","stroke-opacity":".25"});
 var d1="M"+X(0)+","+Yv(0),d2=d1;rows.forEach(function(r){d1+="L"+X(r[0]).toFixed(1)+","+Yv(r[2]).toFixed(1);d2+="L"+X(r[0]).toFixed(1)+","+Yv(r[1]).toFixed(1)});
 el("path",{d:d1,fill:"none",stroke:"#f5d27a","stroke-width":"2.4","stroke-linejoin":"round"});
 el("path",{d:d2,fill:"none",stroke:"#8b5cf6","stroke-width":"2.4","stroke-linejoin":"round"});
 el("text",{x:l,y:H-4,fill:"currentColor","font-size":"10"},"0");
 el("text",{x:W-l,y:H-4,fill:"currentColor","font-size":"10","text-anchor":"end"},n+L(" yr"," वर्ष"));
}
function calc(){
 var A=+$("amt").value,R=+$("rate").value,Y=Math.floor(+$("yrs").value),S=+$("step").value||0,Lp=+$("lump").value||0,F=+$("inf").value||0,G=+$("goal").value||0;
 if(!(A>=0)||!(R>=0)||!(Y>=1)||Y>50||$("amt").value===""||(A===0&&!(Lp>0))||Lp<0){$("res").hidden=true;return}
 var o=run(A,R,Y,S,Lp),g=o.bal-o.inv,r=function(n){return"₹ "+fmt(Math.round(n))};
 $("res").hidden=false;
 $("o-inv").textContent=r(o.inv);$("o-gain").textContent=r(g);$("o-tot").textContent=r(o.bal);
 $("b1").style.width=(o.inv/o.bal*100)+"%";$("b2").style.width=(g/o.bal*100)+"%";
 $("rl").hidden=!(F>0);$("gl").hidden=!(G>0);$("adv-o").hidden=!(F>0||G>0);
 var real=o.bal/Math.pow(1+F/100,Y);if(F>0)$("o-real").textContent=r(real);
 if(G>0)$("o-need").textContent=r(need(G,R,Y,S,Lp))+L(" /month"," /माह");
 chart(o.rows,F);
 $("yy").innerHTML=o.rows.map(function(x){return"<div><span>"+L("Year ","साल ")+x[0]+"</span><span>"+r(x[1])+" → <b>"+r(x[2])+"</b></span></div>"}).join("");
 last=L("SIP","SIP")+" ₹"+fmt(A)+"/"+L("month","माह")+", "+R+"%, "+Y+L(" yr"," वर्ष")+" → "+r(o.bal)+" ("+L("invested ","निवेश ")+r(o.inv)+")";
 try{history.replaceState(null,"","#"+IDS.map(function(i){return i+"="+encodeURIComponent($(i).value)}).join("&"))}catch(e){}
}
(function(){try{var h=location.hash.slice(1);if(!h)return;h.split("&").forEach(function(p){var a=p.split("=");if(IDS.indexOf(a[0])>-1&&isFinite(+decodeURIComponent(a[1])))$(a[0]).value=decodeURIComponent(a[1])});if(+$("lump").value>0||+$("inf").value>0||+$("goal").value>0)$("adv").open=true}catch(e){}})();
document.querySelectorAll("input").forEach(function(e){e.addEventListener("input",calc)});
$("cpy").onclick=function(){if(last)copyText(last)};
$("lnk").onclick=function(){copyText(location.href)};
document.addEventListener("langchange",calc);
calc();

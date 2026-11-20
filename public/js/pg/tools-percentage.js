function v(id){var s=$(id).value;return s===""?NaN:+s}
var hist=[];try{hist=JSON.parse(localStorage.getItem("dta_pct")||"[]")}catch(e){}
function out(i,r,w){$("r"+i).textContent=r;$("w"+(i<=6?i:i)).textContent=w||"";}
function calc(){
 var a=v("a1"),b=v("b1");
 if(isNaN(a)||isNaN(b))out(1,"","");else out(1,fmt(a*b/100),a+"% × "+fmt(b)+" ÷ 100");
 a=v("a2");b=v("b2");
 if(isNaN(a)||isNaN(b)||b===0)out(2,"","");else out(2,fmt(a/b*100)+" %",fmt(a)+" ÷ "+fmt(b)+" × 100");
 a=v("a3");b=v("b3");
 if(isNaN(a)||isNaN(b)||a===0)out(3,"","");
 else{var c=(b-a)/Math.abs(a)*100;out(3,(c>=0?L("Increase of ","बढ़ोतरी "):L("Decrease of ","कमी "))+fmt(Math.abs(c))+" %","("+fmt(b)+" − "+fmt(a)+") ÷ "+fmt(Math.abs(a))+" × 100")}
 a=v("a4");b=v("b4");
 if(isNaN(a)||isNaN(b))out(4,"","");
 else out(4,L("Add: ","जोड़ने पर: ")+fmt(b*(1+a/100))+"  |  "+L("Subtract: ","घटाने पर: ")+fmt(b*(1-a/100)),fmt(b)+" × (1 ± "+a+"/100)");
 a=v("a5");b=v("b5");
 if(isNaN(a)||isNaN(b)||a===0)out(5,"","");else out(5,fmt(b/a*100),fmt(b)+" ÷ "+a+" × 100");
 a=v("a6");b=v("b6");
 if(isNaN(a)||isNaN(b)||(a+b)===0)out(6,"","");else out(6,fmt(Math.abs(a-b)/((Math.abs(a)+Math.abs(b))/2)*100)+" %","|"+fmt(a)+" − "+fmt(b)+"| ÷ average("+fmt(a)+", "+fmt(b)+") × 100");
}
function save(i){
 var r=$("r"+i).textContent;if(!r)return;
 var q=$("a"+i).value+" ; "+$("b"+i).value,e=i+". "+q+" → "+r;
 if(hist[0]===e)return;hist.unshift(e);hist=hist.slice(0,8);
 try{localStorage.setItem("dta_pct",JSON.stringify(hist))}catch(x){}showH();
}
function showH(){$("hp").hidden=!hist.length;$("hl").innerHTML="";hist.forEach(function(h){var d=document.createElement("div");d.textContent=h;$("hl").appendChild(d)})}
document.querySelectorAll("input").forEach(function(i){i.addEventListener("input",calc);i.addEventListener("change",function(){save(+i.id.slice(-1))})});
$("hc").onclick=function(){hist=[];try{localStorage.removeItem("dta_pct")}catch(e){}showH()};
document.addEventListener("langchange",calc);
calc();showH();

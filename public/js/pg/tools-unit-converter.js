var U={
 length:{en:"Length",hi:"लंबाई",u:{"mm":.001,"cm":.01,"m":1,"km":1000,"inch":.0254,"foot":.3048,"yard":.9144,"mile":1609.344,"μm":1e-6,"nautical mile":1852}},
 weight:{en:"Weight",hi:"वज़न",u:{"mg":1e-6,"g":.001,"kg":1,"quintal":100,"tonne":1000,"ounce":.028349523125,"pound":.45359237,"tola":.0116638038,"carat":.0002,"stone":6.35029318}},
 area:{en:"Area",hi:"क्षेत्रफल",u:{"sq inch":.00064516,"sq ft":.09290304,"sq yard (gaj)":.83612736,"sq m":1,"acre":4046.8564224,"hectare":10000,"sq km":1e6}},
 volume:{en:"Volume",hi:"आयतन",u:{"ml":.001,"litre":1,"m³":1000,"tsp (US)":.00492892159375,"tbsp (US)":.01478676478125,"cup (US)":.2365882365,"fl oz (US)":.0295735295625,"gallon (US)":3.785411784}},
 temp:{en:"Temperature",hi:"तापमान",u:{"°C":1,"°F":1,"K":1},t:1},
 speed:{en:"Speed",hi:"गति",u:{"m/s":1,"km/h":1/3.6,"mph":.44704,"knot":1852/3600}},
 data:{en:"Data size",hi:"डेटा साइज़",u:{"bit":.125,"byte":1,"KB":1024,"MB":1048576,"GB":1073741824,"TB":1099511627776},note:["1 KB = 1024 bytes here.","यहां 1 KB = 1024 बाइट।"]},
 pressure:{en:"Pressure",hi:"दबाव",u:{"Pa":1,"kPa":1000,"bar":100000,"atm":101325,"psi":6894.757293168,"mmHg":133.322387415}},
 energy:{en:"Energy",hi:"ऊर्जा",u:{"J":1,"kJ":1000,"cal":4.184,"kcal":4184,"Wh":3600,"kWh":3600000,"BTU":1055.05585262}},
 power:{en:"Power",hi:"शक्ति",u:{"W":1,"kW":1000,"MW":1e6,"hp (mech)":745.69987158227,"BTU/h":.29307107}},
 angle:{en:"Angle",hi:"कोण",u:{"degree":1,"radian":180/Math.PI,"gradian":.9,"turn":360}},
 time:{en:"Time",hi:"समय",u:{"ms":.001,"second":1,"minute":60,"hour":3600,"day":86400,"week":604800,"month (30 d)":2592000,"year (365 d)":31536000}}
};
var cur="length";
function nf(x){if(!isFinite(x))return"–";var pr=$("pr")?$("pr").value:"a";if(pr!=="a")return x.toLocaleString("en-IN",{minimumFractionDigits:+pr,maximumFractionDigits:+pr});if(x===0)return"0";var a=Math.abs(x);if(a>=1e15||a<1e-7)return x.toExponential(4);return Number(x.toPrecision(10)).toLocaleString("en-IN",{maximumFractionDigits:10})}
function toBase(c,u,v){if(U[c].t){return u==="°C"?v:u==="°F"?(v-32)*5/9:v-273.15}return v*U[c].u[u]}
function fromBase(c,u,b){if(U[c].t){return u==="°C"?b:u==="°F"?b*9/5+32:b+273.15}return b/U[c].u[u]}
function fill(sel,c,keep){sel.innerHTML=Object.keys(U[c].u).map(function(k){return'<option>'+k+'</option>'}).join("");if(keep)sel.value=keep}
function cats(){var s=$("cat"),v=s.value||cur;s.innerHTML=Object.keys(U).map(function(k){return'<option value="'+k+'">'+U[k][L("en","hi")]+'</option>'}).join("");s.value=v}
function calc(){
 var c=cur,v=parseFloat($("val").value),f=$("from").value,t=$("to").value;
 if(isNaN(v)){$("res").hidden=true;$("tbl").innerHTML="";return}
 $("res").hidden=false;
 var b=toBase(c,f,v);
 $("o-l").textContent=nf(v)+" "+f+" =";
 $("o").textContent=nf(fromBase(c,t,b))+" "+t;
 $("note").textContent=U[c].note?L(U[c].note[0],U[c].note[1]):"";
 $("tbl").innerHTML=Object.keys(U[c].u).map(function(k){return"<div><span>"+k+"</span><b>"+nf(fromBase(c,k,b))+"</b></div>"}).join("");
}
$("cat").onchange=function(){cur=this.value;fill($("from"),cur);fill($("to"),cur);var k=Object.keys(U[cur].u);$("from").value=cur==="temp"?"°C":k[Math.min(2,k.length-1)];$("to").value=cur==="temp"?"°F":k[Math.min(3,k.length-1)];calc()};
var pins=[];try{pins=JSON.parse(localStorage.getItem("dta_upin")||"[]")}catch(e){}
function drawPins(){var b=$("pins");b.innerHTML="";b.hidden=!pins.length;pins.forEach(function(p,i){var x=document.createElement("button");x.type="button";x.className="chip";x.textContent=p.f+" → "+p.t;x.title=L("Tap to use. Long-press to remove.","इस्तेमाल के लिए टैप करें। हटाने के लिए देर तक दबाएं।");
 x.onclick=function(){cur=p.c;$("cat").value=p.c;fill($("from"),cur,p.f);fill($("to"),cur,p.t);calc()};
 var tm;x.onpointerdown=function(){tm=setTimeout(function(){pins.splice(i,1);savePins();drawPins()},700)};x.onpointerup=x.onpointerleave=function(){clearTimeout(tm)};b.appendChild(x)})}
function savePins(){try{localStorage.setItem("dta_upin",JSON.stringify(pins))}catch(e){}}
$("pin").onclick=function(){var p={c:cur,f:$("from").value,t:$("to").value};if(!pins.some(function(q){return q.c===p.c&&q.f===p.f&&q.t===p.t})){pins.unshift(p);pins=pins.slice(0,8);savePins();drawPins();if(window.toast)toast(L("Pinned ✓","पिन हो गया ✓"))}};
$("pr").onchange=calc;
$("cpa").onclick=function(){var t=[].map.call($("tbl").children,function(d){return d.children[0].textContent+": "+d.children[1].textContent}).join("\n");copyText(t)};
$("from").onchange=$("to").onchange=calc;$("val").addEventListener("input",calc);
$("swap").onclick=function(){var a=$("from").value;$("from").value=$("to").value;$("to").value=a;calc()};
$("cp").onclick=function(){copyText($("o").textContent,$("cp"))};
document.addEventListener("langchange",function(){cats();calc()});
cats();$("cat").onchange();drawPins();

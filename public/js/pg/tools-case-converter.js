var NAT=new Intl.Collator(undefined,{numeric:true});
var prev="";
function set(f){var t=$("t");prev=t.value;t.value=f(t.value);cnt()}
function cnt(){var v=$("t").value;$("cnt").textContent=v?v.length+L(" characters • "," अक्षर • ")+(v.trim().split(/\s+/).filter(Boolean).length)+L(" words • "," शब्द • ")+v.split("\n").length+L(" lines"," लाइनें"):""}
function words(s){ // split into words on spaces, _ - . and camelCase boundaries
 return s.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g,"$1 $2").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
function eachLine(f){return function(s){return s.split("\n").map(f).join("\n")}}
var cap=function(w){return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()};
var DEV=[["camelCase",function(s){return eachLine(function(l){var w=words(l);return w.map(function(x,i){return i?cap(x):x.toLowerCase()}).join("")})(s)}],
["PascalCase",eachLine(function(l){return words(l).map(cap).join("")})],
["snake_case",eachLine(function(l){return words(l).map(function(x){return x.toLowerCase()}).join("_")})],
["kebab-case",eachLine(function(l){return words(l).map(function(x){return x.toLowerCase()}).join("-")})],
["CONSTANT_CASE",eachLine(function(l){return words(l).map(function(x){return x.toUpperCase()}).join("_")})],
["dot.case",eachLine(function(l){return words(l).map(function(x){return x.toLowerCase()}).join(".")})],
["URL slug",eachLine(function(l){return l.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"")})]];
var CLN=[["Trim lines","लाइनें ट्रिम करें",eachLine(function(l){return l.trim()})],
["Remove extra spaces","फालतू स्पेस हटाएं",eachLine(function(l){return l.replace(/[ \t]+/g," ").trim()})],
["Remove line breaks","लाइन ब्रेक हटाएं",function(s){return s.replace(/\s*\n+\s*/g," ").trim()}],
["Remove blank lines","खाली लाइनें हटाएं",function(s){return s.split("\n").filter(function(l){return l.trim()}).join("\n")}],
["Remove duplicate lines","डुप्लिकेट लाइनें हटाएं",function(s){var seen={};return s.split("\n").filter(function(l){if(seen[l])return false;seen[l]=1;return true}).join("\n")}],
["Sort lines A–Z","लाइनें A–Z",function(s){return s.split("\n").sort(NAT.compare).join("\n")}],
["Reverse lines","लाइनें उलटें",function(s){return s.split("\n").reverse().join("\n")}],
["Reverse text","टेक्स्ट उलटें",function(s){return Array.from(s).reverse().join("")}]];
DEV.forEach(function(x){var b=document.createElement("button");b.className="chip";b.type="button";b.textContent=x[0];b.onclick=function(){set(x[1])};$("dev").appendChild(b)});
var cb=[];CLN.forEach(function(x){var b=document.createElement("button");b.className="chip";b.type="button";b.dataset.en=x[0];b.dataset.hi=x[1];b.textContent=x[0];b.onclick=function(){set(x[2])};$("cln").appendChild(b)});
if(window.DTAapply)DTAapply();
$("up").onclick=function(){set(function(s){return s.toUpperCase()})};
$("lo").onclick=function(){set(function(s){return s.toLowerCase()})};
$("ti").onclick=function(){set(function(s){return s.toLowerCase().replace(/(^|[\s\-])(\p{L})/gu,function(m,a,b){return a+b.toUpperCase()})})};
$("se").onclick=function(){set(function(s){return s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu,function(m,a,b){return a+b.toUpperCase()})})};
$("to").onclick=function(){set(function(s){return s.split("").map(function(c){return c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()}).join("")})};
$("al").onclick=function(){set(function(s){var i=0;return s.replace(/\p{L}/gu,function(c){return(i++%2)?c.toUpperCase():c.toLowerCase()})})};
$("cp").onclick=function(){copyText($("t").value,$("cp"))};
$("un").onclick=function(){var c=$("t").value;$("t").value=prev;prev=c;cnt()};
$("clr").onclick=function(){prev=$("t").value;$("t").value="";cnt()};
$("t").addEventListener("input",cnt);

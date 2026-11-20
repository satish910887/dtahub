var C={"chh":"छ","ksh":"क्ष","shr":"श्र","kh":"ख","gh":"घ","ch":"च","jh":"झ","Th":"ठ","Dh":"ढ","Rh":"ढ़","th":"थ","dh":"ध","ph":"फ","bh":"भ","sh":"श","gy":"ज्ञ","tr":"त्र",
"k":"क","g":"ग","j":"ज","T":"ट","D":"ड","N":"ण","R":"ड़","t":"त","d":"द","n":"न","p":"प","b":"ब","m":"म","y":"य","r":"र","l":"ल","v":"व","w":"व","s":"स","h":"ह","f":"फ","z":"ज","q":"क","c":"क","x":"क्स"};
var V={"aa":["आ","ा"],"ai":["ऐ","ै"],"au":["औ","ौ"],"ee":["ई","ी"],"ii":["ई","ी"],"oo":["ऊ","ू"],"uu":["ऊ","ू"],
"a":["अ",""],"i":["इ","ि"],"u":["उ","ु"],"e":["ए","े"],"o":["ओ","ो"]};
var X={"M":"ं","H":"ः","~":"ँ","|":"।"};
var DICT={"mein":"में","nahi":"नहीं","nahin":"नहीं","kyun":"क्यों","kyon":"क्यों","bhi":"भी","hi":"ही","ji":"जी","ki":"की","ke":"के","ko":"को","se":"से","ne":"ने","hum":"हम","tum":"तुम","ye":"ये","wo":"वो","vo":"वो","woh":"वो","kuch":"कुछ","bahut":"बहुत","accha":"अच्छा","acha":"अच्छा","theek":"ठीक","thik":"ठीक","dhanyavaad":"धन्यवाद","shukriya":"शुक्रिया","namaste":"नमस्ते","namaskar":"नमस्कार","hindi":"हिंदी","bharat":"भारत","india":"इंडिया"};
var DIG="०१२३४५६७८९";
function word(w,o){
 var key=w.toLowerCase();if(DICT[key])return DICT[key];
 var out="",i=0,pc=false,tail="";
 if(o.cap&&/^[A-Z]/.test(w)&&!/[A-Z]/.test(w.slice(1)))w=w[0].toLowerCase()+w.slice(1);
 if(/(ai|oo)n$/.test(w)){w=w.slice(0,-1);tail="ं"}
 if(o.fa&&/[^aeiouAEIOU]a$/.test(w)&&!/aa$/.test(w)){w=w.slice(0,-1)+"aa"}
 while(i<w.length){
  var hit=false;
  for(var len=3;len>=1&&!hit;len--){
   var s=w.substr(i,len);if(s.length<len)continue;
   var k=(C[s]!==undefined||V[s]!==undefined||X[s]!==undefined)?s:s.toLowerCase();
   if(len>1&&k!==s&&C[s]===undefined&&C[k]===undefined&&V[k]===undefined)continue;
   if(len===1&&i===0&&(s==="M"||s==="H")){out+=C[s.toLowerCase()];pc=true;i++;hit=true;break}
   if(X[s]!==undefined&&len===1){out+=X[s];pc=false;i++;hit=true;break}
   if(C[k]!==undefined){out+=(pc?"्":"")+C[k];pc=true;i+=len;hit=true}
   else if(V[k]!==undefined){out+=pc?V[k][1]:V[k][0];pc=false;i+=len;hit=true}
  }
  if(!hit){out+=w[i];pc=false;i++}
 }
 return out+tail;
}
function conv(t,o){
 t=t.split(/([^A-Za-z~|]+)/).map(function(p,i){return i%2?p:word(p,o)}).join("");
 if(o.dg)t=t.replace(/[0-9]/g,function(d){return DIG[+d]});
 return t;
}
function run(){
 var o={fa:$("fa").checked,dg:$("dg").checked,cap:$("cp1").checked},r=conv($("in").value,o);$("out").value=r;
 var w=r.trim()?r.trim().split(/\s+/).length:0;$("cnt").textContent=w+L(" words, "," शब्द, ")+r.length+L(" characters"," अक्षर");
 $("wa").href="https://wa.me/?text="+encodeURIComponent(r);$("wa").setAttribute("aria-disabled",r?"false":"true");
 try{localStorage.setItem("dta_typing",$("in").value)}catch(e){}
}
$("in").addEventListener("input",run);["fa","dg","cp1"].forEach(function(i){$(i).onchange=run});
$("cp").onclick=function(){copyText($("out").value,$("cp"))};
$("dl").onclick=function(){if($("out").value)saveBlob(new Blob([$("out").value+"\n"],{type:"text/plain;charset=utf-8"}),"hindi-text.txt")};
$("clr").onclick=function(){$("in").value="";run();$("in").focus()};
try{var sv=localStorage.getItem("dta_typing");if(sv&&!$("in").value)$("in").value=sv}catch(e){}
document.addEventListener("langchange",run);
run();

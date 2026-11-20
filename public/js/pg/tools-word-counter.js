var STOP=new Set("a an the and or but if of to in on at by for with from as is are was were be been it its this that these those i you he she we they me my your his her our their not no so do does did have has had will would can could should than then there here also very just about into over out up down more most some any all".split(" ").concat("है हैं था थी थे हो हूं हूँ और या का की के को में से पर ने भी तो यह वह ये वो एक कि जो इस उस कर करना कुछ नहीं हुआ हुई हुए अपने लिए साथ बहुत तक रहा रही रहे गया गई गए जा सकता सकती".split(" ")));
var seg=window.Intl&&Intl.Segmenter?new Intl.Segmenter(undefined,{granularity:"grapheme"}):null;
function glen(t){if(!seg)return Array.from(t).length;var n=0;for(var x of seg.segment(t))n++;return n}
function calc(){
 var t=$("t").value,s=t.trim();
 var ws=s?s.split(/\s+/):[];var words=ws.length;
 var sent=(t.match(/[^.!?।]+[.!?।]+|[^.!?।]+$/g)||[]).filter(function(x){return x.trim()}).length;
 var para=t.split(/\n\s*\n/).filter(function(x){return x.trim()}).length;
 var chars=glen(t),ns=glen(t.replace(/\s/g,""));
 function tm(w,wpm){var m=w/wpm;return w===0?"0":(m<1?L("< 1 min","< 1 मिनट"):Math.ceil(m)+L(" min"," मिनट"))}
 var clean=ws.map(function(w){return w.replace(/^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu,"")}).filter(Boolean);
 var freq={},uniq={},tot=0,longest="";
 clean.forEach(function(w){var k=w.toLowerCase();uniq[k]=1;tot+=glen(w);if(glen(w)>glen(longest))longest=w;if(!STOP.has(k)&&glen(w)>1)freq[k]=(freq[k]||0)+1});
 $("o-w").textContent=fmt(words);$("o-c").textContent=fmt(chars);$("o-n").textContent=fmt(ns);
 $("o-s").textContent=fmt(sent);$("o-p").textContent=fmt(para);
 $("o-r").textContent=tm(words,200);$("o-k").textContent=tm(words,130);
 $("o-l").textContent=fmt(t?t.split("\n").length:0);$("o-u").textContent=fmt(Object.keys(uniq).length);
 $("o-a").textContent=clean.length?(tot/clean.length).toFixed(1):"0";$("o-g").textContent=longest||"-";
 var top=Object.keys(freq).sort(function(a,b){return freq[b]-freq[a]||a.localeCompare(b)}).slice(0,10);
 $("kw").innerHTML="";top.forEach(function(k){var d=document.createElement("div"),a=document.createElement("span"),b=document.createElement("b");a.textContent=k;b.textContent=freq[k]+" × ("+(freq[k]/clean.length*100).toFixed(1)+"%)";d.append(a,b);$("kw").append(d)});
 var lv=$("lim").value,m=$("lm");
 if(lv==="0"){m.style.width="0";$("lt").textContent=""}
 else{var a=lv.split(":"),max=+a[1],cur=a[0]==="c"?chars:words,over=cur>max;
  m.style.width=Math.min(100,cur/max*100)+"%";m.style.background=over?"#ef4444":cur/max>.9?"#f59e0b":"#22c55e";
  $("lt").textContent=fmt(cur)+" / "+fmt(max)+(a[0]==="c"?L(" characters"," अक्षर"):L(" words"," शब्द"))+(over?" — "+fmt(cur-max)+L(" over"," ज़्यादा"):" — "+fmt(max-cur)+L(" left"," बाकी"))}
}
$("t").addEventListener("input",calc);$("lim").onchange=calc;
$("clr").onclick=function(){$("t").value="";calc()};
document.addEventListener("langchange",calc);
calc();

function esc(s){return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function jq(s){return JSON.stringify(s)}
function bar(el,n,lo,hi,max){el.style.width=Math.min(100,n/max*100)+"%";el.className=n===0?"":(n<lo||n>hi?(n>hi+20||n<lo-20?"e":"w"):"")}
function trunc(s,n){return s.length>n?s.slice(0,n-1).trimEnd()+"…":s}
function gen(){
 var v=function(i){return $(i).value.trim()},ti=v("ti"),de=v("de"),kw=v("kw"),au=v("au"),ur=v("ur"),im=v("im"),sn=v("sn"),tw=v("tw"),lc=v("lc"),ty=v("ty"),rb=v("rb"),tc=$("tc").value;
 $("ht").textContent=ti.length+" / 60 "+L("(best 30 to 60)","(बेहतर 30 से 60)");bar($("bt"),ti.length,30,60,80);
 $("hd").textContent=de.length+" / 160 "+L("(best 70 to 160)","(बेहतर 70 से 160)");bar($("bd"),de.length,70,160,200);
 var o=['<meta charset="UTF-8">','<meta name="viewport" content="width=device-width, initial-scale=1">'];
 if(ti)o.push("<title>"+esc(ti)+"</title>");
 if(de)o.push('<meta name="description" content="'+esc(de)+'">');
 if(kw)o.push('<meta name="keywords" content="'+esc(kw)+'">');
 if(au)o.push('<meta name="author" content="'+esc(au)+'">');
 o.push('<meta name="robots" content="'+rb+'">');
 o.push('<meta name="theme-color" content="'+tc+'">');
 if(ur)o.push('<link rel="canonical" href="'+esc(ur)+'">');
 o.push("");o.push('<meta property="og:type" content="'+ty+'">');
 if(sn)o.push('<meta property="og:site_name" content="'+esc(sn)+'">');
 o.push('<meta property="og:locale" content="'+lc+'">');
 if(ti)o.push('<meta property="og:title" content="'+esc(ti)+'">');
 if(de)o.push('<meta property="og:description" content="'+esc(de)+'">');
 if(ur)o.push('<meta property="og:url" content="'+esc(ur)+'">');
 if(im)o.push('<meta property="og:image" content="'+esc(im)+'">');
 o.push("");o.push('<meta name="twitter:card" content="'+(im?"summary_large_image":"summary")+'">');
 if(tw)o.push('<meta name="twitter:site" content="'+esc(tw[0]==="@"?tw:"@"+tw)+'">');
 if(ti)o.push('<meta name="twitter:title" content="'+esc(ti)+'">');
 if(de)o.push('<meta name="twitter:description" content="'+esc(de)+'">');
 if(im)o.push('<meta name="twitter:image" content="'+esc(im)+'">');
 if($("jl").checked){
  var j={"@context":"https://schema.org","@type":ty==="article"?"Article":"WebPage"};
  if(ti)j[ty==="article"?"headline":"name"]=ti;if(de)j.description=de;if(ur)j.url=ur;if(im)j.image=im;
  if(au)j.author={"@type":"Person",name:au};if(sn)j.publisher={"@type":"Organization",name:sn};
  o.push("");o.push('<script type="application/ld+json">');o.push(JSON.stringify(j,null,2).replace(/</g,"\\u003c"));o.push("<\/script>");
 }
 $("out").value=o.join("\n");
 var c=[],add=function(k,txt){c.push([k,txt])};
 if(!ti)add("e",L("Add a title.","टाइटल जोड़ें।"));else if(ti.length<30)add("w",L("Title is short. Aim for 30 to 60 characters.","टाइटल छोटा है। 30 से 60 अक्षर रखें।"));else if(ti.length>60)add("w",L("Title may be cut off in search results (over 60).","सर्च रिज़ल्ट में टाइटल कट सकता है (60 से ज़्यादा)।"));else add("",L("Title length is good.","टाइटल की लंबाई सही है।"));
 if(!de)add("e",L("Add a description.","विवरण जोड़ें।"));else if(de.length<70)add("w",L("Description is short. Aim for 70 to 160 characters.","विवरण छोटा है। 70 से 160 अक्षर रखें।"));else if(de.length>160)add("w",L("Description may be cut off (over 160).","विवरण कट सकता है (160 से ज़्यादा)।"));else add("",L("Description length is good.","विवरण की लंबाई सही है।"));
 if(!ur)add("w",L("Add the page URL so a canonical link is created.","पेज का लिंक जोड़ें ताकि canonical लिंक बने।"));else if(!/^https:\/\//.test(ur))add("w",L("Use an https:// URL.","https:// वाला लिंक इस्तेमाल करें।"));else add("",L("URL looks good.","लिंक सही है।"));
 if(!im)add("w",L("Add a share image so links look good on WhatsApp and social apps.","शेयर इमेज जोड़ें ताकि WhatsApp और सोशल ऐप में लिंक अच्छा दिखे।"));else if(!/^https:\/\//.test(im))add("w",L("Image URL should start with https://.","इमेज का लिंक https:// से शुरू होना चाहिए।"));else add("",L("Share image set.","शेयर इमेज सेट है।"));
 if(rb.indexOf("noindex")===0)add("w",L("This page is set not to appear in search.","यह पेज सर्च में न दिखने के लिए सेट है।"));
 var ul=$("chk");ul.textContent="";c.forEach(function(x){var li=document.createElement("li");li.className=x[0];li.textContent=x[1];ul.appendChild(li)});
 var host="";try{host=ur?new URL(ur).hostname+decodeURIComponent(new URL(ur).pathname).replace(/\/$/,"").replace(/\//g," › "):""}catch(e){host=ur}
 $("pu").textContent=host||"example.com";$("pt").textContent=trunc(ti||L("Your page title appears here","आपके पेज का टाइटल यहां दिखेगा"),60);$("pd").textContent=trunc(de||L("Your description appears here. Write a clear summary of the page.","आपका विवरण यहां दिखेगा। पेज का साफ सार लिखें।"),160);
 $("sd2").textContent=(sn||host.split(" ")[0]||"example.com");$("st2").textContent=ti||L("Your page title","आपके पेज का टाइटल");$("sp2").textContent=trunc(de,110);
}
document.querySelectorAll("input,textarea,select").forEach(function(i){i.addEventListener("input",gen)});
$("cp").onclick=function(){copyText($("out").value,$("cp"))};
$("dl").onclick=function(){saveBlob(new Blob(['<!doctype html>\n<html lang="'+($("lc").value.slice(0,2))+'">\n<head>\n'+$("out").value+'\n</head>\n<body></body>\n</html>\n'],{type:"text/html"}),"meta-tags.html")};
document.addEventListener("langchange",gen);
gen();

var K=window.DTAkruti;
function run(){
 var u2k=$("md").value==="u2k",v=$("in").value,o=u2k?K.toKruti(v):K.toUnicode(v,{digits:$("dg").checked});
 $("out").value=o;
 $("inl").textContent=u2k?L("Paste Hindi (Unicode) text here","हिंदी (यूनिकोड) टेक्स्ट यहां पेस्ट करें"):L("Paste Kruti Dev text here","Kruti Dev टेक्स्ट यहां पेस्ट करें");
 $("outl").textContent=u2k?L("Kruti Dev text (set the font to Kruti Dev 010 to read it)","Kruti Dev टेक्स्ट (पढ़ने के लिए फॉन्ट Kruti Dev 010 करें)"):L("Unicode Hindi","यूनिकोड हिंदी");
 $("in").placeholder=u2k?"भारत सरकार":"Hkkjr ljdkj";
 $("dg").disabled=u2k;
 var w=o.trim()?o.trim().split(/\s+/).length:0;$("cnt").textContent=w+L(" words, "," शब्द, ")+o.length+L(" characters"," अक्षर");
 try{localStorage.setItem("dta_kruti_mode",$("md").value)}catch(e){}
}
$("in").addEventListener("input",run);$("md").onchange=run;$("dg").onchange=run;
$("cp").onclick=function(){if($("out").value)copyText($("out").value,$("cp"))};
$("sw").onclick=function(){var o=$("out").value;$("md").value=$("md").value==="u2k"?"k2u":"u2k";$("in").value=o;run()};
$("dl").onclick=function(){if($("out").value)saveBlob(new Blob([$("out").value+"\n"],{type:"text/plain;charset=utf-8"}),$("md").value==="u2k"?"kruti-dev-text.txt":"unicode-hindi.txt")};
$("clr").onclick=function(){$("in").value="";run();$("in").focus()};
try{var sm=localStorage.getItem("dta_kruti_mode");if(sm==="u2k"||sm==="k2u")$("md").value=sm}catch(e){}
document.addEventListener("langchange",run);
run();

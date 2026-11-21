function render(){
 var s=$("in").value,m=$("md").value,o="";$("err").hidden=true;$("parts").textContent="";$("pw").hidden=true;
 if(!s){$("out").value="";return}
 try{o=m==="comp"?encodeURIComponent(s):m==="full"?encodeURI(s):decodeURIComponent(s.replace(/\+/g,m==="dec"?" ":"+"))}
 catch(e){$("out").value="";$("err").hidden=false;$("err").textContent=L("This text has a broken % code, so it cannot be decoded.","इस टेक्स्ट में टूटा हुआ % कोड है, इसलिए डिकोड नहीं हो सकता।");return}
 $("out").value=o;
 var u=null;try{u=new URL(m==="dec"?o:s)}catch(e){}
 if(u&&/^https?:$/.test(u.protocol)){
  var rows=[[L("Protocol","प्रोटोकॉल"),u.protocol],[L("Host","होस्ट"),u.host],[L("Path","पाथ"),u.pathname]];
  u.searchParams.forEach(function(v,k){rows.push([k,v])});if(u.hash)rows.push([L("Fragment","फ्रैगमेंट"),u.hash]);
  rows.forEach(function(r){var d=document.createElement("div");d.className="trow";var a=document.createElement("span"),b=document.createElement("b");a.textContent=r[0];b.textContent=r[1];d.append(a,b);$("parts").appendChild(d)});$("pw").hidden=false}
}
$("in").addEventListener("input",render);$("md").addEventListener("change",render);document.addEventListener("langchange",render);
$("cp").onclick=function(){var ok=function(){toast(L("Copied","कॉपी हो गया"))},no=function(){toast(L("Could not copy","कॉपी नहीं हो सका"),"err")};try{navigator.clipboard.writeText($("out").value).then(ok,no)}catch(e){no()}};
$("sw").onclick=function(){$("in").value=$("out").value;$("md").value=$("md").value==="dec"?"comp":"dec";render()};
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){$("in").value="";render()});

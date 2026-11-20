function opts(r){if($("us").checked)r=r.replace(/\+/g,"-").replace(/\//g,"_");if($("np").checked)r=r.replace(/=+$/,"");if($("wr").checked)r=r.replace(/(.{76})/g,"$1\n").replace(/\n$/,"");return r}
function bytesToB64(b){var r="",k=0x8000;for(var i=0;i<b.length;i+=k)r+=String.fromCharCode.apply(null,b.subarray(i,i+k));return btoa(r)}
function clean(s){s=s.trim();var m=s.match(/^data:[^,]*;base64,/i);if(m)s=s.slice(m[0].length);s=s.replace(/\s/g,"").replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";return s}
function b64Bytes(s){var r=atob(clean(s)),b=new Uint8Array(r.length);for(var i=0;i<r.length;i++)b[i]=r.charCodeAt(i);return b}
function enc(s){return opts(bytesToB64(new TextEncoder().encode(s)))}
function dec(s){return new TextDecoder("utf-8",{fatal:true}).decode(b64Bytes(s))}
function go(f){
 $("err").hidden=true;$("inf").textContent="";
 try{var o=f($("in").value);$("out").value=o;$("inf").textContent=L("Input ","इनपुट ")+new Blob([$("in").value]).size+" B → "+L("output ","आउटपुट ")+new Blob([o]).size+" B"}
 catch(e){$("out").value="";$("err").hidden=false;$("err").textContent=L("Invalid input for this action.","इस काम के लिए इनपुट सही नहीं है।")}
}
$("en").onclick=function(){go(enc)};
$("de").onclick=function(){go(dec)};
$("clr").onclick=function(){$("in").value="";$("out").value="";$("err").hidden=true;$("inf").textContent="";$("pv").hidden=true};
$("cp").onclick=function(){copyText($("out").value,$("cp"))};
$("sw").onclick=function(){$("in").value=$("out").value;$("out").value=""};
["us","np","wr"].forEach(function(i){$(i).addEventListener("change",function(){if($("out").value&&!$("err").hidden===false){}})});
function sniff(b){
 var h=function(a){return a.every(function(x,i){return b[i]===x})};
 if(h([137,80,78,71]))return["image/png","png"];if(h([255,216,255]))return["image/jpeg","jpg"];if(h([71,73,70,56]))return["image/gif","gif"];
 if(h([37,80,68,70]))return["application/pdf","pdf"];if(h([80,75,3,4]))return["application/zip","zip"];
 if(h([82,73,70,70])&&b[8]===87&&b[9]===69)return["image/webp","webp"];
 var t=new TextDecoder().decode(b.subarray(0,80)).trim();if(t.charAt(0)==="<"&&/<svg/i.test(t))return["image/svg+xml","svg"];
 return["application/octet-stream","bin"];
}
$("ff").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;$("fd").textContent=f.name+" • "+sizeOf(f.size);
 if(f.size>20*1048576){$("err").hidden=false;$("err").textContent=L("File is too big (limit 20 MB).","फाइल बहुत बड़ी है (सीमा 20 MB)।");return}
 $("err").hidden=true;var b=new Uint8Array(await f.arrayBuffer()),r=$("du").checked?bytesToB64(b):opts(bytesToB64(b));
 var mime=f.type||sniff(b)[0];
 $("out").value=$("du").checked?"data:"+mime+";base64,"+r:r;
 $("inf").textContent=f.name+": "+sizeOf(f.size)+" → "+sizeOf($("out").value.length);
 if(mime.indexOf("image/")===0){$("pv").src=URL.createObjectURL(f);$("pv").hidden=false}else $("pv").hidden=true;
});
$("du").onchange=function(){if($("ff").files[0])$("ff").dispatchEvent(new Event("change"))};
$("b2f").onclick=function(){
 try{var b=b64Bytes($("in").value),k=sniff(b);
  if(k[0].indexOf("image/")===0){$("pv").src=URL.createObjectURL(new Blob([b],{type:k[0]}));$("pv").hidden=false}
  saveBlob(new Blob([b],{type:k[0]}),"decoded."+k[1]);$("err").hidden=true;
 }catch(e){$("err").hidden=false;$("err").textContent=L("Invalid input for this action.","इस काम के लिए इनपुट सही नहीं है।")}
};

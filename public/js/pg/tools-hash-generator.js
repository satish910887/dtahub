var ALG=["SHA-1","SHA-256","SHA-384","SHA-512"],data=null,fname="",last=[];
function hex(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return("0"+x.toString(16)).slice(-2)}).join("")}
function b64s(b){var a=new Uint8Array(b),s="";for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}
var CT=null;function crc32(u8){if(!CT){CT=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;CT[n]=c>>>0}}var c2=0xFFFFFFFF;for(var i=0;i<u8.length;i++)c2=CT[(c2^u8[i])&255]^(c2>>>8);return((c2^0xFFFFFFFF)>>>0)}
function fmt(r){var f=$("of").value;return f==="b64"?r.b64:f==="HEX"?r.hex.toUpperCase():r.hex}
function render(){
 var host=$("hs");host.textContent="";var key=$("key").value,ex=$("exp").value.trim().replace(/[\s:]/g,""),hit=null;
 last.forEach(function(r){
  var d=document.createElement("div");d.className="hx";
  var s=document.createElement("small");s.textContent=(key&&r.n!=="CRC32"?"HMAC-":"")+r.n;
  var c=document.createElement("code");c.textContent=fmt(r);
  var m=ex&&(ex.toLowerCase()===r.hex.toLowerCase()||ex===r.b64);if(m){hit=r.n;d.style.borderColor="var(--ok)"}
  var b=document.createElement("button");b.type="button";b.className="btn";b.textContent=L("Copy","कॉपी");
  b.onclick=function(){copyText(fmt(r),b)};
  d.appendChild(s);d.appendChild(c);d.appendChild(b);host.appendChild(d);
 });
 var v=$("vr");v.className="line";
 if(!ex||!last.length)v.textContent="";
 else if(hit){v.textContent="✓ "+L("Match: ","मेल खाता है: ")+hit;v.className="line ok"}
 else{v.textContent="✗ "+L("No match with any hash below.","नीचे दिए किसी भी हैश से मेल नहीं खाता।");v.className="line err"}
}
async function calc(){
 var e=$("err");e.hidden=true;
 var buf=data||new TextEncoder().encode($("tx").value);last=[];
 if(!data&&!$("tx").value){render();$("fi").textContent="";return}
 try{
  var key=$("key").value,u8=new Uint8Array(buf);
  $("fi").textContent=(fname?fname+" • ":"")+sizeOf(u8.length);
  for(var i=0;i<ALG.length;i++){
   var h;
   if(key){var k=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:ALG[i]},false,["sign"]);h=await crypto.subtle.sign("HMAC",k,buf)}
   else h=await crypto.subtle.digest(ALG[i],buf);
   last.push({n:ALG[i],hex:hex(h),b64:b64s(h)});
  }
  if(!key){var cv=crc32(u8),ch=("00000000"+cv.toString(16)).slice(-8),cb=new Uint8Array([cv>>>24,(cv>>>16)&255,(cv>>>8)&255,cv&255]);last.push({n:"CRC32",hex:ch,b64:b64s(cb)})}
  render();
 }catch(x){e.hidden=false;e.textContent=L("Hashing is not supported in this browser.","इस ब्राउज़र में हैशिंग सपोर्ट नहीं है।")}
}
$("tx").addEventListener("input",function(){data=null;fname="";$("fl").value="";calc()});
$("key").addEventListener("input",calc);$("of").onchange=render;$("exp").addEventListener("input",render);
$("fl").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;
 if(f.size>200*1048576){$("err").hidden=false;$("err").textContent=L("File is too large (max 200 MB).","फाइल बहुत बड़ी है (अधिकतम 200 MB)।");return}
 data=await f.arrayBuffer();fname=f.name;calc();
});
document.addEventListener("langchange",render);
function rnd(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return a}
function uuid(){var a=rnd(16);a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;var h=hex(a);return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20)}
function b64(){var s=btoa(String.fromCharCode.apply(null,rnd(24)));return s.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function gen(){
 var n=Math.max(1,Math.min(50,Math.floor(+$("n").value)||1)),k=$("kind").value,o=[];
 for(var i=0;i<n;i++)o.push(k==="uuid"?uuid():k==="hex"?hex(rnd(16)):b64());
 $("gout").value=o.join("\n");
}
$("gen").onclick=gen;$("cpall").onclick=function(){copyText($("gout").value,this)};
gen();

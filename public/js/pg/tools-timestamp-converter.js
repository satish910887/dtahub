var ZONES=[["local",""],["UTC","UTC"],["IST (India)","Asia/Kolkata"],["Dubai","Asia/Dubai"],["Singapore","Asia/Singapore"],["London","Europe/London"],["New York","America/New_York"],["Los Angeles","America/Los_Angeles"],["Sydney","Australia/Sydney"]];
function zone(){return $("tz").value||undefined}
function fmt(ms,tz){try{return new Intl.DateTimeFormat("en-IN",{timeZone:tz,year:"numeric",month:"short",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZoneName:"short"}).format(new Date(ms))}catch(e){return"-"}}
function offsetMs(ms,tz){
 if(!tz)return -new Date(ms).getTimezoneOffset()*6e4;
 var p=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(ms)),o={};p.forEach(function(x){o[x.type]=+x.value});
 return Date.UTC(o.year,o.month-1,o.day,o.hour,o.minute,o.second)-Math.floor(ms/1000)*1000;
}
function parse(s){
 s=s.trim();if(!s)return null;
 if(/^-?\d{1,17}(\.\d+)?$/.test(s)){var n=+s,a=Math.abs(n);return{ms:a>=1e14?Math.round(n/1000):a>=1e11?Math.round(n):Math.round(n*1000),kind:a>=1e14?"µs":a>=1e11?"ms":"s"}}
 var m=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
 if(m){var u=Date.UTC(+m[1],m[2]-1,+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0)),tz=zone(),off=offsetMs(u,tz);var r=u-off;off=offsetMs(r,tz);r=u-off;
  var chk=new Date(u);if(chk.getUTCMonth()!==m[2]-1)return{err:1};return{ms:r,kind:"date"}}
 var t=Date.parse(s);return isNaN(t)?{err:1}:{ms:t,kind:"date"};
}
function rel(ms){var d=(ms-Date.now())/1000,a=Math.abs(d),u=a<60?[a,"second"]:a<3600?[a/60,"minute"]:a<86400?[a/3600,"hour"]:a<2592e3?[a/86400,"day"]:a<31536e3?[a/2592e3,"month"]:[a/31536e3,"year"];
 try{return new Intl.RelativeTimeFormat("en",{numeric:"auto"}).format(Math.round(d<0?-u[0]:u[0]),u[1])}catch(e){return""}}
function row(k,v){var r=document.createElement("div");r.className="trow";var a=document.createElement("span");a.textContent=k;var b=document.createElement("button");b.type="button";b.className="tcp";b.textContent=v;b.title=L("Tap to copy","कॉपी करने के लिए टैप करें");b.onclick=function(){var ok=function(){toast(L("Copied","कॉपी हो गया"))};try{navigator.clipboard.writeText(v).then(ok,function(){toast(L("Could not copy","कॉपी नहीं हो सका"),"err")})}catch(e){}};r.append(a,b);return r}
function render(){
 var s=$("in").value,o=$("out");o.textContent="";$("err").hidden=true;
 var p=parse(s);if(!p){o.hidden=true;return}
 if(p.err||!isFinite(p.ms)||Math.abs(p.ms)>8.64e15){$("err").hidden=false;$("err").textContent=L("Could not read this. Try a Unix time like 1767225600 or a date like 2026-11-21 18:30.","यह समझ नहीं आया। Unix समय जैसे 1767225600 या तारीख जैसे 2026-11-21 18:30 लिखें।");o.hidden=true;return}
 o.hidden=false;var ms=p.ms;
 if(p.kind!=="date"&&p.kind!=="s")o.appendChild(row(L("Read as","समझा गया"),L("Unix time in "+p.kind,"Unix समय ("+p.kind+")")));
 o.appendChild(row("Unix (s)",String(Math.floor(ms/1000))));o.appendChild(row("Unix (ms)",String(Math.round(ms))));
 o.appendChild(row("ISO 8601 (UTC)",new Date(ms).toISOString()));
 ZONES.forEach(function(z){o.appendChild(row(z[0]==="local"?L("Your device","आपका डिवाइस"):z[0],fmt(ms,z[1]||undefined)))});
 o.appendChild(row(L("Relative","तुलना"),rel(ms)));
}
ZONES.forEach(function(z){var op=document.createElement("option");op.value=z[1];op.textContent=z[0]==="local"?L("Your device time zone","आपके डिवाइस का टाइम ज़ोन"):z[0];$("tz").appendChild(op)});
$("tz").value="Asia/Kolkata";
$("in").addEventListener("input",render);$("tz").addEventListener("change",render);document.addEventListener("langchange",render);
$("now").onclick=function(){$("in").value=String(Math.floor(Date.now()/1000));render()};
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){$("in").value="";render()});

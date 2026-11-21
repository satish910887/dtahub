function b64u(s){s=s.replace(/-/g,"+").replace(/_/g,"/");while(s.length%4)s+="=";var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder("utf-8",{fatal:true}).decode(u)}
function tm(v){return typeof v==="number"&&isFinite(v)?new Date(v*1000).toISOString().replace("T"," ").replace(".000Z"," UTC"):null}
function render(){
 var t=$("in").value.trim().replace(/^Bearer\s+/i,"").replace(/\s+/g,"");$("err").hidden=true;$("res").hidden=true;
 if(!t)return;
 var p=t.split(".");
 if(p.length<2||p.length>3||p.some(function(x,i){return i<2&&!/^[A-Za-z0-9_-]+$/.test(x)})){return bad(L("This does not look like a JWT. It should have three parts separated by dots.","यह JWT जैसा नहीं दिखता। इसमें बिंदुओं से अलग तीन हिस्से होने चाहिए।"))}
 var h,pl;
 try{h=JSON.parse(b64u(p[0]));pl=JSON.parse(b64u(p[1]))}catch(e){return bad(L("Could not decode this token. It may be cut off or not a JWT.","यह टोकन डिकोड नहीं हुआ। यह कटा हुआ या JWT न हो सकता है।"))}
 $("h").textContent=JSON.stringify(h,null,2);$("p").textContent=JSON.stringify(pl,null,2);
 var info=[],now=Date.now()/1000;
 [["iat",L("Issued at","जारी हुआ")],["nbf",L("Not valid before","इससे पहले मान्य नहीं")],["exp",L("Expires","खत्म होता है")]].forEach(function(k){var s=tm(pl[k[0]]);if(s)info.push(k[1]+": "+s)});
 if(typeof pl.exp==="number")info.push(pl.exp<now?L("Status: expired","स्थिति: समय खत्म"):L("Status: not expired yet","स्थिति: अभी मान्य"));
 else info.push(L("No expiry time (exp) in this token.","इस टोकन में खत्म होने का समय (exp) नहीं है।"));
 if(h.alg==="none")info.push(L("Warning: alg is none, so this token is unsigned.","चेतावनी: alg none है, यानी टोकन पर कोई हस्ताक्षर नहीं।"));
 $("meta").textContent=info.join("\n");$("res").hidden=false;
}
function bad(m){$("err").hidden=false;$("err").textContent=m}
$("in").addEventListener("input",render);document.addEventListener("langchange",render);
document.querySelectorAll("[data-cp]").forEach(function(b){b.onclick=function(){var ok=function(){toast(L("Copied","कॉपी हो गया"))},no=function(){toast(L("Could not copy","कॉपी नहीं हो सका"),"err")};try{navigator.clipboard.writeText($(b.dataset.cp).textContent).then(ok,no)}catch(e){no()}}});
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){$("in").value="";render()});

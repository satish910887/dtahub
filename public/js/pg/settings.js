(function(){
 var S=DTAsettings;
 function sync(){
  var g=S.get();
  document.querySelectorAll("[data-set]").forEach(function(b){var kv=b.getAttribute("data-set").split(":");var on=g[kv[0]]===kv[1];b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
  $("n-fav").textContent=DTAfav.list().length;$("n-rec").textContent=DTArecent().length;
  var r=null;try{r=DOCS.some(function(k){return localStorage.getItem(k)})}catch(e){}
  $("n-res").textContent=r?L("Saved","सेव है"):L("None","कोई नहीं");
  if(window.caches){caches.keys().then(function(k){var n=0;return Promise.all(k.map(function(x){return caches.open(x).then(function(c){return c.keys()}).then(function(a){n+=a.length})})).then(function(){$("n-off").textContent=n?n+L(" pages"," पेज"):L("None","कोई नहीं")})}).catch(function(){})}
  else $("n-off").textContent=L("Not supported","सपोर्ट नहीं");
 }
 document.addEventListener("click",function(e){var b=e.target.closest("[data-set]");if(!b)return;var kv=b.getAttribute("data-set").split(":");
  if(kv[0]==="lang")S.setLang(kv[1]);else if(kv[0]==="theme")S.setTheme(kv[1]);else if(kv[0]==="accent")S.setAccent(kv[1]);else S.setMotion(kv[1]);sync()});
 var DOCS=["dta_resume_v1","dta_resume_versions_v1","dta_invoice_v1","dta_cover_v1"];
 function rm(k){try{localStorage.removeItem(k)}catch(e){}}
 $("c-fav").onclick=function(){rm("dta_fav");sync();DTAsync();toast(L("Favourites cleared","पसंदीदा साफ हो गए"))};
 $("c-rec").onclick=function(){rm("dta_recent");sync();toast(L("Recent list cleared","हाल की सूची साफ हो गई"))};
 $("c-res").onclick=function(){if(!DOCS.some(function(k){return localStorage.getItem(k)})){toast(L("No saved documents","कोई सेव दस्तावेज़ नहीं"));return}
  if(this.getAttribute("data-sure")!=="1"){this.setAttribute("data-sure","1");this.textContent=L("Tap again to confirm","पक्का करने के लिए फिर टैप करें");var b=this;setTimeout(function(){b.removeAttribute("data-sure");DTAapply()},3500);return}
  DOCS.forEach(rm);this.removeAttribute("data-sure");DTAapply();sync();toast(L("Documents deleted from this device","दस्तावेज़ इस डिवाइस से मिटा दिए"))};
 $("c-off").onclick=function(){
  var p=[];if(window.caches)p.push(caches.keys().then(function(k){return Promise.all(k.map(function(x){return caches.delete(x)}))}));
  if(navigator.serviceWorker)p.push(navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister()}))}));
  Promise.all(p).then(function(){sync();toast(L("Offline copy cleared. It rebuilds as you browse.","ऑफलाइन कॉपी साफ हुई। ब्राउज़ करते हुए फिर बन जाएगी।"))}).catch(function(){toast(L("Could not clear","साफ नहीं हो सका"),"err")});
 };
 document.addEventListener("langchange",sync);sync();
})();

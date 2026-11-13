(function(){
var root=document.documentElement,lang="en",theme="dark";
try{lang=localStorage.getItem("lang")||"en";theme=localStorage.getItem("theme")||"dark"}catch(e){}
window.L=function(en,hi){return lang==="hi"?hi:en};
window.fmt=function(n){return Number(n).toLocaleString("en-IN",{maximumFractionDigits:2})};
window.$=function(i){return document.getElementById(i)};
function save(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var head='<header class="nav"><a class="logo" href="/"><svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f5d27a"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><path d="M20 2 36 11v18L20 38 4 29V11z" fill="none" stroke="url(#lg)" stroke-width="2.5"/><path d="M14 12h6a8 8 0 0 1 0 16h-6z" fill="url(#lg)"/></svg><span>DTA<b>hub</b></span></a><div class="actions"><button id="langBtn" class="icon-btn" aria-label="Language">हि</button><button id="themeBtn" class="icon-btn" aria-label="Theme">☾</button></div></header>';
var foot='<footer class="foot"><p>© 2026 DTAhub. <span data-en="Made with care in India." data-hi="भारत में प्यार से बनाया गया।">Made with care in India.</span></p></footer>';
document.body.insertAdjacentHTML("afterbegin",head);
document.body.insertAdjacentHTML("beforeend",foot);
function apply(){
 root.lang=lang==="hi"?"hi":"en";root.setAttribute("data-theme",theme);
 document.querySelectorAll("[data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang)});
 document.querySelectorAll("[data-ph-en]").forEach(function(el){el.placeholder=el.getAttribute("data-ph-"+lang)});
 $("langBtn").textContent=lang==="en"?"हि":"EN";
 $("themeBtn").textContent=theme==="dark"?"☾":"☀";
 document.dispatchEvent(new Event("langchange"));
}
$("langBtn").onclick=function(){lang=lang==="en"?"hi":"en";save("lang",lang);apply()};
$("themeBtn").onclick=function(){theme=theme==="dark"?"light":"dark";save("theme",theme);apply()};
apply();
})();
window.copyText=function(text,btn){
 function done(){var o=btn.textContent;btn.textContent=L("Copied ✓","कॉपी हो गया ✓");setTimeout(function(){btn.textContent=o},1400)}
 if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(text).then(done,function(){fb()})}else fb();
 function fb(){var a=document.createElement("textarea");a.value=text;document.body.appendChild(a);a.select();try{document.execCommand("copy")}catch(e){}document.body.removeChild(a);done()}
};

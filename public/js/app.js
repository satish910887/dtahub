(function(){
var root=document.documentElement,lang="en",theme="dark",cat="all",q="";
try{lang=localStorage.getItem("lang")||"en";theme=localStorage.getItem("theme")||"dark"}catch(e){}
var grid=document.getElementById("grid"),chips=document.getElementById("chips"),empty=document.getElementById("empty"),search=document.getElementById("search");
var io="IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}})},{threshold:.1}):null;
function watch(){document.querySelectorAll(".reveal:not(.in)").forEach(function(el){io?io.observe(el):el.classList.add("in")})}
function save(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function applyStatic(){
 root.lang=lang==="hi"?"hi":"en";root.setAttribute("data-theme",theme);
 document.querySelectorAll("[data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang)});
 search.placeholder=search.getAttribute("data-ph-"+lang);
 document.getElementById("langBtn").textContent=lang==="en"?"हि":"EN";
 document.getElementById("themeBtn").textContent=theme==="dark"?"☾":"☀";
}
function renderChips(){
 var all=[{id:"all",en:"All",hi:"सभी"}].concat(window.CATS);
 chips.innerHTML=all.map(function(c){return '<button class="chip'+(c.id===cat?' on':'')+'" data-id="'+c.id+'">'+c[lang]+'</button>'}).join("");
}
function renderGrid(){
 var s=q.trim().toLowerCase();
 var list=window.TOOLS.filter(function(t){
  return (cat==="all"||t.cat===cat)&&(!s||(t.en+t.hi+t.den+t.dhi).toLowerCase().indexOf(s)>-1)});
 grid.innerHTML=list.map(function(t){
  return '<a class="card reveal" href="tools/'+t.id+'.html"><span class="soon">'+(lang==="en"?"Soon":"जल्द")+'</span><div class="ico">'+t.ico+'</div><h3>'+t[lang]+'</h3><p>'+(lang==="en"?t.den:t.dhi)+'</p></a>'}).join("");
 empty.hidden=list.length>0;watch();
}
chips.addEventListener("click",function(e){var b=e.target.closest(".chip");if(!b)return;cat=b.getAttribute("data-id");renderChips();renderGrid()});
search.addEventListener("input",function(){q=search.value;renderGrid()});
document.getElementById("langBtn").onclick=function(){lang=lang==="en"?"hi":"en";save("lang",lang);applyStatic();renderChips();renderGrid()};
document.getElementById("themeBtn").onclick=function(){theme=theme==="dark"?"light":"dark";save("theme",theme);applyStatic()};
applyStatic();renderChips();renderGrid();watch();
})();

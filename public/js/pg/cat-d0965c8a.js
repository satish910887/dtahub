(function(){var g=document.getElementById("allGrid"),q=document.getElementById("catQ"),s=document.getElementById("catSort"),em=document.getElementById("catEmpty"),orig=[].slice.call(g.children);
function run(){var v=q.value.trim().toLowerCase().split(/\s+/).filter(Boolean),a=orig.slice(),n=0;
if(s.value==="az")a.sort(function(x,y){return x.querySelector("h3").textContent.localeCompare(y.querySelector("h3").textContent)});
a.forEach(function(c){var h=c.getAttribute("data-q"),ok=v.every(function(t){return h.indexOf(t)>-1});c.hidden=!ok;if(ok)n++;g.appendChild(c)});em.hidden=n>0}
q.addEventListener("input",run);s.addEventListener("change",run)})();

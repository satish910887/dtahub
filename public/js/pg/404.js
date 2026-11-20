document.getElementById("g").innerHTML=DTA.TOOLS.filter(function(t){return t.featured}).map(function(t){return DTA.cardHTML(t)}).join("");
DTAapply();DTAsync();DTAwatch();

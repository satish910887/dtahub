var LA="lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum".split(" ");
var EN="the quick team plans a simple project and every small step helps people learn new things while the city wakes up early because good work needs time care and clear goals so we write test share and improve each day with friends near home".split(" ");
var HI={s:[["विद्यार्थी",0],["किसान",0],["शिक्षक",0],["कारीगर",0],["यात्री",0],["दुकानदार",0],["बच्चे",1],["मज़दूर",0],["कलाकार",0],["मित्र",1],["डॉक्टर",0],["खिलाड़ी",1]],
 t:["सुबह","शाम को","हर दिन","आज","धीरे-धीरे","बड़े ध्यान से","मिलकर","समय पर","रोज़ाना"],
 p:["गांव में","शहर में","बाज़ार में","स्कूल में","बाग़ में","घर पर","नदी के पास","पुस्तकालय में"],
 o:["नई किताब","पुरानी कहानी","बड़ा सपना","लंबा सफर","सरल योजना","ज़रूरी काम","अच्छा खाना","सुंदर चित्र","मीठा गीत","छोटा औज़ार"],
 v:["पढ़","देख","बना","सुन","सीख","लिख","समझ","चुन","सजा","खोज"]};
var T="p",LG="la",lastWords=[];
function rnd(n){return Math.floor(Math.random()*n)}
function pick(a){return a[rnd(a.length)]}
function sentHi(){var s=pick(HI.s),p=rnd(2)?pick(HI.t)+" ":"",pl=rnd(3)?pick(HI.p)+" ":"",v=pick(HI.v)+(s[1]?"ते हैं":"ता है");var t=s[0]+" "+p+pl+pick(HI.o)+" "+v;
 if(rnd(4)===0)t+=", और "+pick(HI.s)[0]+" "+pick(HI.v)+"ते हैं";return t+"।"}
function sentW(W){var n=6+rnd(10),a=[];for(var i=0;i<n;i++)a.push(pick(W));if(n>8)a[3+rnd(3)]+=",";var s=a.join(" ");return s[0].toUpperCase()+s.slice(1)+"."}
function sent(){return LG==="hi"?sentHi():sentW(LG==="en"?EN:LA)}
function para(){var n=LG==="hi"?3+rnd(3):3+rnd(4),a=[];for(var i=0;i<n;i++)a.push(sent());return a.join(" ")}
function wordsHi(n){var o=[],all=[];HI.s.forEach(function(x){all.push(x[0])});HI.o.forEach(function(x){x.split(" ").forEach(function(y){all.push(y)})});HI.t.concat(HI.p).forEach(function(x){all.push(x)});while(o.length<n)o.push(pick(all));return o}
function gen(){
 var n=Math.max(1,Math.min(200,Math.floor(+$("n").value)||1)),o=[],la=LG==="la",c=$("cl").checked&&la,fm=$("fm").value;
 $("clw").hidden=!la;
 var items;
 if(T==="p"){items=[];for(var i=0;i<n;i++)items.push(para());if(c)items[0]="Lorem ipsum dolor sit amet, consectetur adipiscing elit. "+items[0].split(". ").slice(1).join(". ")}
 else if(T==="s"){items=[];for(var j=0;j<n;j++)items.push(sent());if(c)items[0]="Lorem ipsum dolor sit amet, consectetur adipiscing elit."}
 else{var W=LG==="hi"?null:LG==="en"?EN:LA,k=0;if(W){while(o.length<n)o.push(c?W[k++%W.length]:pick(W))}else o=wordsHi(n);items=[o.join(" ")]}
 var out;
 if(fm==="p")out=items.map(function(x){return"<p>"+x+"</p>"}).join("\n");
 else if(fm==="li")out="<ul>\n"+items.map(function(x){return"  <li>"+x+"</li>"}).join("\n")+"\n</ul>";
 else if(fm==="md")out=items.map(function(x){return"- "+x}).join("\n");
 else out=items.join(T==="p"?"\n\n":" ");
 $("out").value=out;
 var plain=items.join(" ");$("st").textContent=(plain.trim()?plain.trim().split(/\s+/).length:0)+L(" words, "," शब्द, ")+plain.length+L(" characters"," अक्षर");
}
function grp(sel,attr,fn){document.querySelectorAll(sel).forEach(function(b){b.onclick=function(){fn(b.dataset[attr]);document.querySelectorAll(sel).forEach(function(x){var on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-pressed",on?"true":"false")});gen()}})}
grp("[data-t]","t",function(v){T=v});grp("[data-l]","l",function(v){LG=v});
$("n").addEventListener("input",gen);$("cl").onchange=gen;$("rg").onclick=gen;$("fm").onchange=gen;
$("cp").onclick=function(){copyText($("out").value,$("cp"))};
$("dl").onclick=function(){saveBlob(new Blob([$("out").value+"\n"],{type:"text/plain;charset=utf-8"}),"dummy-text.txt")};
document.addEventListener("langchange",gen);
gen();

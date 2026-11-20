var KEY="dta_cover_v1",d,E=Doc.esc;
function blank(){return{v:1,name:"",title:"",email:"",phone:"",city:"",role:"",company:"",to:"",ccity:"",why:"",strengths:"",win:"",close:"",lang:"en",tone:"std",ac:"#2563eb",font:"sans",body:"",edited:false}}
function norm(r){var b=blank();if(!r||typeof r!=="object")return b;Object.keys(b).forEach(function(k){if(k==="edited")b.edited=!!r.edited;else if(k==="v")return;else b[k]=Doc.str(r[k],k==="body"?4000:600)});if(b.lang!=="hi")b.lang="en";if(!/^#[0-9a-fA-F]{6}$/.test(b.ac))b.ac="#2563eb";if(b.font!=="serif")b.font="sans";if(["std","short","warm"].indexOf(b.tone)<0)b.tone="std";return b}
function load(){try{var s=localStorage.getItem(KEY);if(s)return norm(JSON.parse(s))}catch(e){}return null}
var tm,warned;
function flush(){try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}}
addEventListener("pagehide",function(){if(tm){clearTimeout(tm);flush()}});
function save(){clearTimeout(tm);tm=setTimeout(function(){tm=0;try{localStorage.setItem(KEY,JSON.stringify(d));var n=new Date();$("sv").textContent=L("Saved on this device at ","इस डिवाइस पर सेव हुआ: ")+("0"+n.getHours()).slice(-2)+":"+("0"+n.getMinutes()).slice(-2)}catch(e){if(!warned){warned=1;toast(L("Could not save on this device.","इस डिवाइस पर सेव नहीं हो सका।"),"err")}}},350)}
function lines(s){return String(s||"").split(/\n/).map(function(x){return x.replace(/^\s*[-•*·]\s*/,"").trim()}).filter(Boolean)}
function join(a,hi){if(a.length<2)return a.join("");var and=hi?" और ":" and ";return a.slice(0,-1).join(", ")+and+a[a.length-1]}
function lowerFirst(s){return s.charAt(0).toLowerCase()+s.slice(1)}
function endDot(s){s=s.trim();return/[.!?।]$/.test(s)?s:s+"."}
function build(){
 var x=d,hi=x.lang==="hi",role=x.role.trim()||(hi?"[पद]":"[Role]"),co=x.company.trim()||(hi?"[कंपनी]":"[Company]"),
  to=x.to.trim()||(hi?"हायरिंग मैनेजर":"Hiring Manager"),st=lines(x.strengths),why=x.why.trim(),win=x.win.trim().replace(/[.।]$/,""),p=[];
 if(hi){
  p.push("आदरणीय "+to+",");
  p.push(x.tone==="warm"?"मुझे "+co+" में "+role+" पद का अवसर देखकर बहुत खुशी हुई, और मैं इसके लिए आवेदन करना चाहता/चाहती हूं।":"मैं "+co+" में "+role+" पद के लिए अपना आवेदन प्रस्तुत करता/करती हूं।");
  if(why)p.push(endDot(why));
  if(st.length)p.push(x.tone==="short"?"मेरी मुख्य खूबियां हैं: "+join(st,1)+"।":"इस पद के लिए मेरी मुख्य खूबियां:\n"+st.map(function(s){return"- "+s}).join("\n"));
  if(win)p.push("हाल के काम में मैंने "+win+"।");
  p.push("मुझे आपसे बात करने का अवसर मिले तो मुझे खुशी होगी। "+(x.close.trim()?endDot(x.close):"आपके समय और विचार के लिए धन्यवाद।"));
  p.push("सधन्यवाद,\n"+(x.name||"[नाम]"));
 }else{
  p.push("Dear "+to+",");
  p.push(x.tone==="warm"?"I was excited to see the "+role+" opening at "+co+", and I would love to be considered for it.":"I am writing to apply for the "+role+" position at "+co+".");
  if(why)p.push(endDot(why));
  if(st.length)p.push(x.tone==="short"?"I bring "+join(st.map(lowerFirst),0)+".":"My main strengths for this role are:\n"+st.map(function(s){return"- "+s}).join("\n"));
  if(win)p.push("In my recent work, I "+lowerFirst(win)+".");
  p.push("I would welcome the chance to discuss how I can contribute to "+co+". "+(x.close.trim()?endDot(x.close):"Thank you for your time and consideration."));
  p.push((x.tone==="warm"?"Warm regards,\n":"Sincerely,\n")+(x.name||"[Your name]"));
 }
 return p.join("\n\n")}
function paras(t){return t.split(/\n{2,}/).map(function(b){var l=b.split("\n");if(l.length>1&&l.slice(1).every(function(z){return/^- /.test(z)})&&!/^- /.test(l[0]))return"<p>"+E(l[0])+"</p><ul>"+l.slice(1).map(function(z){return"<li>"+E(z.slice(2))+"</li>"}).join("")+"</ul>";return"<p>"+E(b)+"</p>"}).join("")}
function render(){
 var x=d,hi=x.lang==="hi",con=[];if(x.email)con.push(E(x.email));if(x.phone)con.push(E(x.phone));if(x.city)con.push(E(x.city));
 var to=[x.to.trim(),x.company.trim(),x.ccity.trim()].filter(Boolean).join("\n");
 var dt=new Date(),ds=dt.getDate()+" "+["January","February","March","April","May","June","July","August","September","October","November","December"][dt.getMonth()]+" "+dt.getFullYear();
 var h='<div class="cl-name">'+E(x.name||L("Your Name","आपका नाम"))+'</div>'+(x.title?'<div class="cl-sub">'+E(x.title)+'</div>':"")+'<div class="cl-con">'+con.map(function(c){return"<span>"+c+"</span>"}).join("")+'</div><div class="cl-hr"></div>';
 h+='<div class="cl-date">'+E(ds)+'</div>'+(to?'<div class="cl-to">'+E(to)+'</div>':"");
 if(x.role.trim())h+='<div class="cl-subj">'+E((hi?"विषय: ":"Subject: ")+(hi?x.role.trim()+" पद के लिए आवेदन":"Application for "+x.role.trim()))+'</div>';
 h+='<div class="cl-b">'+paras(x.body)+'</div>';
 var p=$("dpPaper");p.style.setProperty("--ac",x.ac);p.style.fontFamily=x.font==="serif"?'Georgia,"Noto Serif","Noto Serif Devanagari","Times New Roman",serif':"";p.lang=hi?"hi":"en";p.innerHTML=h;var n=Doc.fit();$("pg").textContent=n+L(n===1?" page":" pages"," पेज");var w=x.body.trim()?x.body.trim().split(/\s+/).length:0;$("wc").textContent=w+L(" words. Aim for 200 to 350 words so it fits one page."," शब्द। 200 से 350 शब्द रखें ताकि एक पेज में आए।");
}
$("cpl").onclick=function(){copyText(d.body,this)};
function fill(){document.querySelectorAll("[data-p]").forEach(function(e){e.value=d[e.dataset.p]})}
function regen(){d.body=build();d.edited=false;$("bd").value=d.body}
document.querySelector(".dk-edit").addEventListener("input",function(e){var x=e.target,k=x.dataset.p;if(!k)return;d[k]=x.value;if(k==="body")d.edited=true;render();save()});
document.querySelector(".dk-edit").addEventListener("change",function(e){var k=e.target.dataset.p;if((k==="lang"||k==="tone")&&!d.edited){regen();render();save()}});
$("gen").onclick=function(){var go=function(){regen();render();save();toast(L("Letter written. Please read and edit it.","पत्र लिख दिया। कृपया पढ़ें और बदलें।"))};if(d.edited&&d.body.trim())Doc.sure(this,L("Tap again: replaces your edited text","फिर टैप करें: आपका बदला हुआ टेक्स्ट बदल जाएगा"),go);else go()};
$("clr").onclick=function(){Doc.sure(this,L("Tap again to delete everything","सब मिटाने के लिए फिर टैप करें"),function(){d=blank();fill();render();save();toast(L("Cleared","साफ हो गया"))})};
$("pdf").onclick=function(){Doc.print(((d.name||"").trim()?d.name.trim()+" - ":"")+"Cover Letter")};
document.addEventListener("langchange",render);
Doc.watch(function(){var n=Doc.fit();$("pg").textContent=n+L(n===1?" page":" pages"," पेज")});
d=load();var fresh=!d;if(fresh)d=blank();
if(!d.name){try{var r=JSON.parse(localStorage.getItem("dta_resume_v1")||"null");if(r&&!r.sample&&r.basics){["name","title","email","phone"].forEach(function(k){if(!d[k])d[k]=Doc.str(r.basics[k],120)});if(!d.city)d.city=Doc.str(r.basics.location,120);if(d.name){$("fromResume").hidden=false;$("fromResume").textContent=L("Filled from your saved resume.","आपके सेव किए रिज़्यूमे से भरा गया।")}}}catch(e){}}
fill();if(!d.body)regen();else $("bd").value=d.body;render();

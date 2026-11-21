var T0=Date.now();
(function(){
 var C=window.DTA_CONFIG||{},key=C.web3formsKey,form=$("cf"),off=$("off"),err=$("err"),btn=$("send");
 if(location.hash==="#request")$("ty").value="Tool request";
 function gh(){var t=$("ty").value,m=$("ms").value.trim();
  $("gh").href="https://github.com/"+C.githubRepo+"/issues/new?title="+encodeURIComponent(t+": "+m.slice(0,60))+"&body="+encodeURIComponent(m)}
 form.addEventListener("input",gh);gh();
 function status(){
  if(key){off.hidden=true;btn.disabled=false;return}
  off.hidden=false;btn.disabled=true;
  off.textContent=L("The message form is not switched on yet. Please use the GitHub option below for now.","मैसेज फॉर्म अभी चालू नहीं हुआ है। फिलहाल नीचे GitHub वाला विकल्प इस्तेमाल करें।");
 }
 document.addEventListener("langchange",status);status();
 form.addEventListener("submit",function(e){
  e.preventDefault();err.hidden=true;
  var m=$("ms").value.trim(),em=$("em").value.trim();
  if($("hp").value)return;
  var now=Date.now(),RL="dta_cf_v1",hs=[];try{hs=JSON.parse(localStorage.getItem(RL)||"[]").filter(function(t){return now-t<864e5})}catch(x){}
  if(now-T0<3000||(hs.length&&now-hs[hs.length-1]<30000)||hs.length>=5){err.hidden=false;err.textContent=L("Please wait a little before sending again.","कृपया दोबारा भेजने से पहले थोड़ा रुकें।");return}
  if(m.length<5){err.hidden=false;err.textContent=L("Please write a message (at least 5 characters).","कृपया संदेश लिखें (कम से कम 5 अक्षर)।");return}
  if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){err.hidden=false;err.textContent=L("That email does not look right.","यह ईमेल सही नहीं लग रहा।");return}
  try{hs.push(now);localStorage.setItem(RL,JSON.stringify(hs))}catch(x){}
  var old=btn.textContent;btn.disabled=true;btn.textContent=L("Sending...","भेजा जा रहा है...");
  fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({access_key:key,subject:"DTAhub: "+$("ty").value,from_name:$("nm").value.trim()||"DTAhub visitor",name:$("nm").value.trim(),email:em,message:m,botcheck:""})})
  .then(function(r){return r.json()}).then(function(j){
   if(j&&j.success){toast(L("Thank you! Message sent.","धन्यवाद! संदेश भेज दिया गया।"));form.reset();gh()}
   else throw new Error("fail");
  }).catch(function(){err.hidden=false;err.textContent=L("Could not send. Please check your internet and try again.","भेज नहीं सके। इंटरनेट जांचकर दोबारा कोशिश करें।")})
  .then(function(){btn.disabled=!key;btn.textContent=old});
 });
})();

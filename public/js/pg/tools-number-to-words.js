var EN1=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],
EN10=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"],
HI=["शून्य","एक","दो","तीन","चार","पाँच","छह","सात","आठ","नौ","दस","ग्यारह","बारह","तेरह","चौदह","पंद्रह","सोलह","सत्रह","अठारह","उन्नीस","बीस","इक्कीस","बाईस","तेईस","चौबीस","पच्चीस","छब्बीस","सत्ताईस","अट्ठाईस","उनतीस","तीस","इकतीस","बत्तीस","तैंतीस","चौंतीस","पैंतीस","छत्तीस","सैंतीस","अड़तीस","उनतालीस","चालीस","इकतालीस","बयालीस","तैंतालीस","चौवालीस","पैंतालीस","छियालीस","सैंतालीस","अड़तालीस","उनचास","पचास","इक्यावन","बावन","तिरपन","चौवन","पचपन","छप्पन","सत्तावन","अट्ठावन","उनसठ","साठ","इकसठ","बासठ","तिरसठ","चौंसठ","पैंसठ","छियासठ","सड़सठ","अड़सठ","उनहत्तर","सत्तर","इकहत्तर","बहत्तर","तिहत्तर","चौहत्तर","पचहत्तर","छिहत्तर","सतहत्तर","अठहत्तर","उनासी","अस्सी","इक्यासी","बयासी","तिरासी","चौरासी","पचासी","छियासी","सत्तासी","अट्ठासी","नवासी","नब्बे","इक्यानवे","बानवे","तिरानवे","चौरानवे","पंचानवे","छियानवे","सत्तानवे","अट्ठानवे","निन्यानवे"];
var IN_EN=["","Thousand","Lakh","Crore","Arab","Kharab","Neel"],IN_HI=["","हज़ार","लाख","करोड़","अरब","खरब","नील"],INT_EN=["","Thousand","Million","Billion","Trillion"];
function en99(n){return n<20?EN1[n]:EN10[Math.floor(n/10)]+(n%10?" "+EN1[n%10]:"")}
function en999(n){var h=Math.floor(n/100),r=n%100,o=[];if(h)o.push(EN1[h]+" Hundred");if(r)o.push(en99(r));return o.join(" ")}
/* s: digits only, up to 15 digits */
function wordsEN(s,sys){
 s=s.replace(/^0+(?=\d)/,"");if(s==="0")return"Zero";var p=[],n,i;
 if(sys==="in"){
  var last=+s.slice(-3);s=s.slice(0,-3);var g=[];while(s.length){g.push(+s.slice(-2));s=s.slice(0,-2)}
  for(i=g.length-1;i>=0;i--)if(g[i])p.push(en99(g[i])+" "+IN_EN[i+1]);
  if(last)p.push(en999(last));
 }else{
  var a=[];while(s.length){a.push(+s.slice(-3));s=s.slice(0,-3)}
  for(i=a.length-1;i>=0;i--)if(a[i])p.push(en999(a[i])+(i?" "+INT_EN[i]:""));
 }
 return p.join(" ");
}
function wordsHI(s){
 s=s.replace(/^0+(?=\d)/,"");if(s==="0")return HI[0];var p=[],last=+s.slice(-3),i;s=s.slice(0,-3);var g=[];while(s.length){g.push(+s.slice(-2));s=s.slice(0,-2)}
 for(i=g.length-1;i>=0;i--)if(g[i])p.push(HI[g[i]]+" "+IN_HI[i+1]);
 if(last){var h=Math.floor(last/100),r=last%100;if(h)p.push(HI[h]+" सौ");if(r)p.push(HI[r])}
 return p.join(" ");
}
function groupNum(s,sys){
 if(s.length<=3)return s;
 if(sys==="in")return s.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,",")+","+s.slice(-3);
 return s.replace(/\B(?=(\d{3})+(?!\d))/g,",");
}
/* returns {int:"123", paise:50} or {err:"..."} */
function parseAmount(raw){
 var t=(raw||"").replace(/[₹\s]/g,"").replace(/^rs\.?/i,"").replace(/,/g,"");
 if(!t)return{empty:1};
 var neg=false;if(t[0]==="-"){neg=true;t=t.slice(1)}
 if(!/^\d*\.?\d*$/.test(t)||t==="."||t==="")return{err:L("Please type a number such as 125000 or 1,25,000.50","कृपया संख्या लिखें, जैसे 125000 या 1,25,000.50")};
 var a=t.split("."),ip=(a[0]||"0"),fr=(a[1]||"");
 var paise=BigInt(((fr+"00").slice(0,2)));if(fr.length>2&&+fr[2]>=5)paise+=1n;
 var big=BigInt(ip)*100n+paise;
 ip=(big/100n).toString();var ps=Number(big%100n);
 if(ip.length>15)return{err:L("This tool supports numbers up to 15 digits before the decimal point.","यह टूल अधिकतम 15 अंकों तक की संख्या समझता है।")};
 return{int:ip,paise:ps,neg:neg&&(ip!=="0"||ps>0)};
}
function build(a,sys){
 var en=wordsEN(a.int,sys),hi=wordsHI(a.int),pe=a.paise?en99(a.paise):"",ph=a.paise?HI[a.paise]:"";
 var cheque="Rupees "+(a.neg?"Minus ":"")+en+(a.paise?" and "+pe+" Paise":"")+" Only";
 var chequeHi=(a.neg?"ऋण ":"")+hi+(a.int==="1"?" रुपया":" रुपये")+(a.paise?" और "+ph+" पैसे":"")+" मात्र";
 return{en:cheque,hi:chequeHi,plain:(a.neg?"Minus ":"")+en+(a.paise?" point "+(a.paise<10?"Zero ":"")+en99(a.paise):""),num:(a.neg?"-":"")+groupNum(a.int,sys)+(a.paise?"."+(a.paise<10?"0":"")+a.paise:"")};
}
function render(){
 var a=parseAmount($("amt").value),sys=$("sys").value;
 $("err").hidden=true;
 if(a.empty){$("res").hidden=true;return}
 if(a.err){$("err").hidden=false;$("err").textContent=a.err;$("res").hidden=true;return}
 var r=build(a,sys);$("res").hidden=false;
 $("o-num").textContent="₹ "+r.num;$("o-en").textContent=r.en;$("o-hi").textContent=r.hi;
}
$("amt").addEventListener("input",render);$("sys").addEventListener("change",render);
document.querySelectorAll("[data-ex]").forEach(function(b){b.onclick=function(){$("amt").value=b.dataset.ex;render()}});
document.querySelectorAll("[data-cp]").forEach(function(b){b.onclick=function(){
 var t=$(b.dataset.cp).textContent;if(!t)return;
 var ok=function(){toast(L("Copied","कॉपी हो गया"))},no=function(){toast(L("Could not copy","कॉपी नहीं हो सका"),"err")};
 try{navigator.clipboard.writeText(t).then(ok,no)}catch(e){no()}}});
document.addEventListener("langchange",render);
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){$("amt").value="";render()});
render();

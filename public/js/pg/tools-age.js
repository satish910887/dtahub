function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
$("to").value=ymd(new Date());
var DAYS=[["Sunday","रविवार"],["Monday","सोमवार"],["Tuesday","मंगलवार"],["Wednesday","बुधवार"],["Thursday","गुरुवार"],["Friday","शुक्रवार"],["Saturday","शनिवार"]];
var ZOD=[[1,20,"Capricorn","मकर"],[2,19,"Aquarius","कुंभ"],[3,20,"Pisces","मीन"],[4,20,"Aries","मेष"],[5,21,"Taurus","वृषभ"],[6,21,"Gemini","मिथुन"],[7,22,"Cancer","कर्क"],[8,23,"Leo","सिंह"],[9,23,"Virgo","कन्या"],[10,23,"Libra","तुला"],[11,22,"Scorpio","वृश्चिक"],[12,22,"Sagittarius","धनु"],[13,0,"Capricorn","मकर"]];
function zod(m,d){for(var i=0;i<ZOD.length;i++){var z=ZOD[i];if(m<z[0]||(m===z[0]&&d<=z[1]))return L(z[2],z[3])}return L("Capricorn","मकर")}
function wd(d){return L(DAYS[d.getDay()][0],DAYS[d.getDay()][1])}
function diff(d1,d2){ // d1<=d2
 var y=d2.getFullYear()-d1.getFullYear(),m=d2.getMonth()-d1.getMonth(),d=d2.getDate()-d1.getDate();
 if(d<0){m--;d+=new Date(d2.getFullYear(),d2.getMonth(),0).getDate()}
 if(m<0){y--;m+=12}
 return[y,m,d];
}
function fmtA(a){return a[0]+L(" yrs ", " साल ")+a[1]+L(" mo ", " माह ")+a[2]+L(" days"," दिन")}
function calc(){
 var a=$("dob").value,b=$("to").value,err=$("err");
 err.hidden=true;
 if(!a||!b){$("res").hidden=true;$("o-c").textContent="";return}
 var d1=new Date(a+"T00:00:00"),d2=new Date(b+"T00:00:00");
 if(d2<d1){$("res").hidden=true;err.hidden=false;err.textContent=L("Date of birth must be before the other date.","जन्म तिथि दूसरी तारीख से पहले होनी चाहिए।");return}
 var A=diff(d1,d2),y=A[0],m=A[1],d=A[2];
 var days=Math.round((d2-d1)/864e5);
 var bm=d1.getMonth(),bd=d1.getDate(),leap=bm===1&&bd===29;
 function bday(yr){if(leap&&!(yr%4===0&&(yr%100!==0||yr%400===0)))return new Date(yr,2,1);return new Date(yr,bm,bd)}
 var nb=bday(d2.getFullYear());if(nb<d2)nb=bday(d2.getFullYear()+1);
 var left=Math.round((nb-d2)/864e5);
 $("res").hidden=false;
 $("o-age").textContent=fmtA(A);
 $("o-m").textContent=fmt(y*12+m);
 $("o-w").textContent=fmt(Math.floor(days/7));
 $("o-d").textContent=fmt(days);
 $("o-h").textContent=fmt(days*24);
 $("o-nb").textContent=left===0?L("Today! 🎉","आज! 🎉"):left+L(" days"," दिन");
 $("o-wd").textContent=wd(d1);$("o-nw").textContent=wd(nb);$("o-z").textContent=zod(bm+1,bd);
 $("o-f").hidden=!leap;
 var o=$("dob2").value;
 if(o){var e1=new Date(o+"T00:00:00"),lo=d1<=e1?d1:e1,hi=d1<=e1?e1:d1,D=diff(lo,hi),dd=Math.round((hi-lo)/864e5);
  $("o-c").textContent=(d1<=e1?L("You are older by ","आप बड़े हैं: "):L("The other person is older by ","दूसरा व्यक्ति बड़ा है: "))+fmtA(D)+" ("+fmt(dd)+L(" days)"," दिन)")}
 else $("o-c").textContent="";
}
document.querySelectorAll("input").forEach(function(i){i.addEventListener("input",calc)});
document.addEventListener("langchange",calc);
calc();

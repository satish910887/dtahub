var MAXC=5e6,FULL="",PREV=200000;
function showOut(o){FULL=o;$("out").value=o.length>PREV?o.slice(0,PREV)+"\n…":o}
function showErr(m){$("err").hidden=!m;$("err").textContent=m||""}
function detect(t){var l=t.split(/\r?\n/)[0]||"",c={",":0,";":0,"\t":0,"|":0},q=0;for(var i=0;i<l.length;i++){var ch=l[i];if(ch==='"')q^=1;else if(!q&&c[ch]!==undefined)c[ch]++}var b=",",m=0;for(var k in c)if(c[k]>m){m=c[k];b=k}return b}
function parseCSV(t,d){
 var rows=[],row=[],f="",i=0,n=t.length,re=new RegExp("[^"+d.replace(/[\\\]\^-]/g,"\\$&")+"\\r\\n]*","y");
 if(t.charCodeAt(0)===0xFEFF)i=1;
 while(i<n){var ch=t[i];
  if(ch==='"'&&f===""){i++;
   for(;;){var j=t.indexOf('"',i);if(j<0)throw new Error(L("A quote is not closed in your CSV.","आपके CSV में एक कोट बंद नहीं है।"));
    f+=t.slice(i,j);if(t[j+1]==='"'){f+='"';i=j+2}else{i=j+1;break}}}
  else if(ch===d){row.push(f);f="";i++}
  else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&t[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f="";i++}
  else{re.lastIndex=i;re.exec(t);f+=t.slice(i,re.lastIndex);i=re.lastIndex}}
 if(f!==""||row.length){row.push(f);rows.push(row)}
 while(rows.length&&rows[rows.length-1].length===1&&rows[rows.length-1][0]==="")rows.pop();
 return rows;
}
function conv(v){if(!$("ty").checked)return v;if(v==="")return v;if(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v)&&Math.abs(+v)<9007199254740991)return +v;if(v==="true")return true;if(v==="false")return false;if(v==="null")return null;return v}
function csvToJson(t){
 var d=$("dl").value==="auto"?detect(t):$("dl").value==="tab"?"\t":$("dl").value,rows=parseCSV(t,d);
 if(!rows.length)throw new Error(L("No rows found.","कोई पंक्ति नहीं मिली।"));
 var out;
 if($("hd").checked){var h=rows[0].map(function(x,i){return x===""?"column"+(i+1):x}),seen={};h=h.map(function(x){var b=x,k=1;while(seen[x]){k++;x=b+"_"+k}seen[x]=1;return x});
  out=rows.slice(1).map(function(r){var o={};h.forEach(function(k,i){o[k]=conv(r[i]===undefined?"":r[i])});return o})}
 else out=rows.map(function(r){return r.map(conv)});
 return JSON.stringify(out,null,2)+"";
}
function cell(v,d){if(v===null||v===undefined)return"";var s=typeof v==="object"?JSON.stringify(v):String(v);return /["\r\n]/.test(s)||s.indexOf(d)>-1||/^\s|\s$/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function jsonToCsv(t){
 var j;try{j=JSON.parse(t)}catch(e){throw new Error(L("This is not valid JSON: ","यह सही JSON नहीं है: ")+e.message)}
 if(!Array.isArray(j))j=[j];
 if(!j.length)throw new Error(L("The JSON list is empty.","JSON की सूची खाली है।"));
 var d=$("dl").value==="auto"?",":$("dl").value==="tab"?"\t":$("dl").value,lines=[];
 if(j.every(function(r){return Array.isArray(r)}))return j.map(function(r){return r.map(function(v){return cell(v,d)}).join(d)}).join("\r\n");
 var keys=[],seen={};j.forEach(function(r){if(r&&typeof r==="object"&&!Array.isArray(r))Object.keys(r).forEach(function(k){if(!seen[k]){seen[k]=1;keys.push(k)}});});
 if(!keys.length)throw new Error(L("Use a list of objects, like [{\"a\":1}].","ऑब्जेक्ट की सूची दें, जैसे [{\"a\":1}]।"));
 lines.push(keys.map(function(k){return cell(k,d)}).join(d));
 j.forEach(function(r){lines.push(keys.map(function(k){return cell(r&&typeof r==="object"?r[k]:"",d)}).join(d))});
 return lines.join("\r\n");
}
function run(){
 var t=$("in").value;showErr("");FULL="";$("out").value="";$("act").hidden=true;
 if(!t.trim())return;
 if(t.length>MAXC){showErr(L("Text is too large (over 5 MB).","टेक्स्ट बहुत बड़ा है (5 MB से ज़्यादा)।"));return}
 try{var o=$("md").value==="c2j"?csvToJson(t):jsonToCsv(t);showOut(o);$("act").hidden=false;$("st").textContent=(o.match(/\n/g)||[]).length+1+L(" lines • "," पंक्तियाँ • ")+sizeOf(new Blob([o]).size)+(o.length>PREV?L(" • showing the first part only; Copy and Save give the full result"," • सिर्फ़ शुरुआत दिख रही है; कॉपी और सेव में पूरा नतीजा मिलेगा"):"")}
 catch(e){showErr(e.message||L("Could not convert this text.","यह टेक्स्ट बदल नहीं सका।"))}
}
["in","md","dl","hd","ty"].forEach(function(id){$(id).addEventListener(id==="in"?"input":"change",run)});
$("md").addEventListener("change",function(){var c=$("md").value==="c2j";$("hdw").hidden=!c;$("tyw").hidden=!c});
$("cp").onclick=function(){var ok=function(){toast(L("Copied","कॉपी हो गया"))},no=function(){toast(L("Could not copy","कॉपी नहीं हो सका"),"err")};try{navigator.clipboard.writeText(FULL).then(ok,no)}catch(e){no()}};
$("sv").onclick=function(){var j=$("md").value==="c2j";saveBlob(new Blob([FULL],{type:j?"application/json":"text/csv"}),"converted."+(j?"json":"csv"))};
$("ld").addEventListener("change",async function(){var f=this.files[0];if(!f)return;if(f.size>MAXC){showErr(L("File is too large (over 5 MB).","फाइल बहुत बड़ी है (5 MB से ज़्यादा)।"));return}$("in").value=await f.text();this.value="";run()});
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){$("in").value="";run()});

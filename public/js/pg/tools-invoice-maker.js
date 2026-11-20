var KEY="dta_invoice_v1",d,t,E=Doc.esc;
function blank(){return{v:1,sample:false,cur:"₹",gstOn:true,split:true,round:false,ac:"#2563eb",logo:"",upi:"",from:{name:"",addr:"",gstin:"",contact:""},to:{name:"",addr:"",gstin:""},no:"INV-001",date:Doc.today(),due:"",items:[{d:"",q:"1",r:"",g:"18",h:""}],disc:"",notes:"Thank you for your business.",pay:""}}
function sample(){var x=blank();x.sample=true;x.from={name:"Sample Studio",addr:"12 Example Road\nPune, Maharashtra 411001",gstin:"27AAAAA0000A1Z5",contact:"hello@example.com"};x.to={name:"Example Traders",addr:"45 Market Street\nMumbai, Maharashtra 400001",gstin:""};x.items=[{d:"Website design",q:"1",r:"25000",g:"18",h:"998314"},{d:"Logo design",q:"1",r:"5000",g:"18",h:"998391"},{d:"Hosting setup (hours)",q:"3",r:"800",g:"18",h:"998315"}];x.disc="1000";x.pay="Bank: Example Bank, A/c 0000000000";x.upi="sample@upi";return x}
function norm(r){var b=blank();if(!r||typeof r!=="object")return b;b.sample=!!r.sample;b.cur=Doc.str(r.cur,3)||"₹";b.gstOn=r.gstOn!==false;b.split=r.split!==false;b.round=!!r.round;b.ac=/^#[0-9a-fA-F]{6}$/.test(r.ac||"")?r.ac:"#2563eb";b.logo=typeof r.logo==="string"&&/^data:image\/(png|jpeg);base64,/.test(r.logo)&&r.logo.length<400000?r.logo:"";b.upi=Doc.str(r.upi,60);
 ["from","to"].forEach(function(k){Object.keys(b[k]).forEach(function(f){b[k][f]=Doc.str(r[k]&&r[k][f],f==="addr"?400:120)})});
 ["no","date","due","disc"].forEach(function(k){b[k]=Doc.str(r[k],40)});b.notes=Doc.str(r.notes,400);b.pay=Doc.str(r.pay,400);
 if(Array.isArray(r.items))b.items=r.items.slice(0,30).map(function(i){i=i||{};return{d:Doc.str(i.d,160),q:Doc.str(String(i.q==null?"":i.q),12),r:Doc.str(String(i.r==null?"":i.r),14),g:Doc.str(String(i.g==null?"":i.g),6),h:Doc.str(String(i.h==null?"":i.h),12)}});
 if(!b.items.length)b.items=blank().items;return b}
function load(){try{var s=localStorage.getItem(KEY);if(s)return norm(JSON.parse(s))}catch(e){}return sample()}
var tm,warned;
function flush(){try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}}
addEventListener("pagehide",function(){if(tm){clearTimeout(tm);flush()}});
function save(){clearTimeout(tm);tm=setTimeout(function(){tm=0;try{localStorage.setItem(KEY,JSON.stringify(d));var n=new Date();$("sv").textContent=L("Saved on this device at ","इस डिवाइस पर सेव हुआ: ")+("0"+n.getHours()).slice(-2)+":"+("0"+n.getMinutes()).slice(-2)}catch(e){if(!warned){warned=1;toast(L("Could not save on this device.","इस डिवाइस पर सेव नहीं हो सका।"),"err")}}},350)}
function P(p,v){var k=p.split("."),o=d;for(var i=0;i<k.length-1;i++)o=o[k[i]];if(arguments.length>1)o[k[k.length-1]]=v;return o[k[k.length-1]]}
var ones="One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen".split(" "),tens="Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety".split(" ");
function two(n){return n<20?ones[n-1]:tens[(n/10|0)-2]+(n%10?" "+ones[n%10-1]:"")}
function three(n){var s="";if(n>=100){s=ones[(n/100|0)-1]+" Hundred";n%=100;if(n)s+=" "}if(n)s+=two(n);return s}
function words(n){if(n===0)return"Zero";var p=[],cr=Math.floor(n/1e7),r=n%1e7,la=Math.floor(r/1e5),th=Math.floor((r%1e5)/1e3),h=r%1e3;
 if(cr)p.push((cr>=100?words(cr):two(cr))+" Crore");if(la)p.push(two(la)+" Lakh");if(th)p.push(two(th)+" Thousand");if(h)p.push(three(h));return p.join(" ")}
function m(n){return d.cur+" "+Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}
function compute(){var rows=[],sub=0;d.items.forEach(function(i){var q=+i.q||0,r=+i.r||0;if(!i.d.trim()&&!q&&!r)return;if(!i.d.trim()&&!(+i.r))return;var a=q*r;rows.push({d:i.d,h:i.h,q:q,r:r,g:d.gstOn?(+i.g||0):0,a:a});sub+=a});
 var disc=Math.min(Math.max(+d.disc||0,0),sub),k=sub?disc/sub:0,gst=0;rows.forEach(function(x){gst+=x.a*(1-k)*x.g/100});
 var tot=sub-disc+gst,fin=d.round?Math.round(tot):tot;
 return{rows:rows,sub:sub,disc:disc,taxable:sub-disc,gst:gst,total:fin,ro:fin-tot}}
function render(){
 var c=compute(),h="",f=d.from,to=d.to,show=d.gstOn,hs=c.rows.some(function(x){return x.h});$("dpPaper").style.setProperty("--ac",d.ac);
 h+='<div class="iv-top"><div>'+(d.logo?'<img src="'+d.logo+'" alt="" style="max-height:56px;max-width:200px;display:block;margin-bottom:8px">':"")+'<div class="iv-title">'+E(L("INVOICE","इनवॉइस"))+'</div></div><div class="iv-meta"><div><b>'+E(L("Invoice no","इनवॉइस नं"))+'</b> '+E(d.no)+'</div><div><b>'+E(L("Date","तारीख"))+'</b> '+E(Doc.pretty(d.date))+'</div>'+(d.due?'<div><b>'+E(L("Due","देय"))+'</b> '+E(Doc.pretty(d.due))+'</div>':"")+'</div></div>';
 h+='<div class="iv-parties"><div><div class="h4">'+E(L("From","भेजने वाला"))+'</div><p class="nm">'+E(f.name||L("Your business","आपका व्यवसाय"))+'</p><p>'+E(f.addr)+'</p>'+(f.gstin?'<p>GSTIN: '+E(f.gstin)+'</p>':"")+(f.contact?'<p>'+E(f.contact)+'</p>':"")+'</div><div><div class="h4">'+E(L("Bill to","ग्राहक"))+'</div><p class="nm">'+E(to.name||L("Client name","ग्राहक का नाम"))+'</p><p>'+E(to.addr)+'</p>'+(to.gstin?'<p>GSTIN: '+E(to.gstin)+'</p>':"")+'</div></div>';
 h+='<table class="iv-tb"><thead><tr><th>#</th><th>'+E(L("Description","विवरण"))+'</th>'+(hs?'<th>HSN/SAC</th>':"")+'<th class="r">'+E(L("Qty","मात्रा"))+'</th><th class="r">'+E(L("Rate","दर"))+'</th>'+(show?'<th class="r">GST</th>':"")+'<th class="r">'+E(L("Amount","राशि"))+'</th></tr></thead><tbody>';
 c.rows.forEach(function(x,i){h+='<tr><td>'+(i+1)+'</td><td>'+E(x.d)+'</td>'+(hs?'<td>'+E(x.h)+'</td>':"")+'<td class="r">'+x.q+'</td><td class="r">'+E(m(x.r))+'</td>'+(show?'<td class="r">'+x.g+'%</td>':"")+'<td class="r">'+E(m(x.a))+'</td></tr>'});
 h+='</tbody></table><div class="iv-tot"><div><span>'+E(L("Subtotal","उप-योग"))+'</span><span>'+E(m(c.sub))+'</span></div>';
 if(c.disc)h+='<div><span>'+E(L("Discount","छूट"))+'</span><span>− '+E(m(c.disc))+'</span></div>';
 if(show){if(d.split)h+='<div><span>CGST</span><span>'+E(m(c.gst/2))+'</span></div><div><span>SGST</span><span>'+E(m(c.gst/2))+'</span></div>';else h+='<div><span>IGST</span><span>'+E(m(c.gst))+'</span></div>'}
 if(d.round&&Math.abs(c.ro)>0.004)h+='<div><span>'+E(L("Round off","राउंड ऑफ"))+'</span><span>'+(c.ro<0?"− ":"+ ")+E(m(Math.abs(c.ro)))+'</span></div>';
 h+='<div class="gt"><span>'+E(L("Total","कुल"))+'</span><span>'+E(m(c.total))+'</span></div></div>';
 if(d.cur==="₹"&&c.total>0){var p=Math.round(c.total*100),ru=Math.floor(p/100),ps=p%100;h+='<div class="iv-words"><b>'+E(L("Amount in words: ","राशि शब्दों में: "))+'</b>Rupees '+E(words(ru))+(ps?" and "+E(words(ps))+" Paise":"")+' Only</div>'}
 if(d.pay||d.notes)h+='<div class="iv-foot"><div>'+(d.pay?'<div class="h4">'+E(L("Payment details","भुगतान की जानकारी"))+'</div><p>'+E(d.pay)+'</p>':"")+'</div><div>'+(d.notes?'<div class="h4">'+E(L("Notes","नोट्स"))+'</div><p>'+E(d.notes)+'</p>':"")+'</div></div>';
 var upiOk=d.cur==="₹"&&/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(d.upi.trim())&&c.total>0&&window.qrcode;
 if(upiOk){try{var u="upi://pay?pa="+encodeURIComponent(d.upi.trim())+"&pn="+encodeURIComponent((f.name||"Payee").slice(0,40))+"&am="+c.total.toFixed(2)+"&cu=INR&tn="+encodeURIComponent("Invoice "+d.no),q=qrcode(0,"M");q.addData(u);q.make();h+='<div class="iv-qr" style="display:flex;align-items:center;gap:12px;margin-top:18px;break-inside:avoid"><div style="width:96px;height:96px">'+q.createSvgTag({cellSize:4,margin:0,scalable:true})+'</div><div style="font-size:12.5px;color:#444"><b style="color:#1b1b26">'+E(L("Scan to pay (UPI)","UPI से भुगतान करें"))+'</b><br>'+E(d.upi.trim())+'<br>'+E(m(c.total))+'</div></div>'}catch(e){}}
 h+='<div class="iv-sign"><span>'+E(L("Authorised signature","अधिकृत हस्ताक्षर"))+'</span></div>';
 $("dpPaper").innerHTML=h;var pages=Doc.fit();$("pg").textContent=pages+L(pages===1?" page":" pages"," पेज");
}
function items(){$("items").innerHTML=d.items.map(function(i,n){return'<div class="panel" style="margin:0 0 10px;padding:12px;background:transparent"><div><label>'+E(L("Description","विवरण"))+'</label><input data-i="'+n+'" data-f="d" value="'+E(i.d)+'" maxlength="160"></div><div><label>'+E(L("HSN/SAC (optional)","HSN/SAC (वैकल्पिक)"))+'</label><input data-i="'+n+'" data-f="h" value="'+E(i.h||"")+'" maxlength="12" inputmode="numeric"></div><div class="g2" style="grid-template-columns:repeat(3,1fr)"><div><label>'+E(L("Qty","मात्रा"))+'</label><input data-i="'+n+'" data-f="q" type="number" inputmode="decimal" min="0" step="any" value="'+E(i.q)+'"></div><div><label>'+E(L("Rate","दर"))+'</label><input data-i="'+n+'" data-f="r" type="number" inputmode="decimal" min="0" step="any" value="'+E(i.r)+'"></div><div><label>GST %</label><input data-i="'+n+'" data-f="g" type="number" inputmode="decimal" min="0" step="any" value="'+E(i.g)+'"'+(d.gstOn?"":" disabled")+'></div></div>'+(d.items.length>1?'<button class="btn" type="button" data-del="'+n+'" style="margin-top:8px;min-height:38px">'+E(L("Remove","हटाएं"))+'</button>':"")+'</div>'}).join("")}
function fill(){document.querySelectorAll("[data-p]").forEach(function(e){e.value=P(e.dataset.p)});document.querySelectorAll("[data-c]").forEach(function(e){e.checked=!!d[e.dataset.c]});$("splitw").hidden=!d.gstOn;$("lgx").hidden=!d.logo;$("sm").hidden=!d.sample;items()}
document.querySelector(".dk-edit").addEventListener("input",function(e){var x=e.target;if(x.dataset.p){P(x.dataset.p,x.value)}else if(x.dataset.i){d.items[+x.dataset.i][x.dataset.f]=x.value}else return;d.sample=false;$("sm").hidden=true;render();save()});
document.querySelector(".dk-edit").addEventListener("change",function(e){var x=e.target;if(x.dataset.c){d[x.dataset.c]=x.checked;d.sample=false;fill();render();save()}});
document.querySelector(".dk-edit").addEventListener("click",function(e){var b=e.target.closest("[data-del]");if(!b)return;d.items.splice(+b.dataset.del,1);d.sample=false;items();render();save()});
$("lg").onchange=function(){var f=this.files[0];if(!f)return;var u=URL.createObjectURL(f),im=new Image();
 im.onload=function(){URL.revokeObjectURL(u);var k=Math.min(1,120/im.naturalHeight,400/im.naturalWidth),c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.naturalWidth*k));c.height=Math.max(1,Math.round(im.naturalHeight*k));c.getContext("2d").drawImage(im,0,0,c.width,c.height);
  var du=c.toDataURL("image/png");if(du.length>300000)du=c.toDataURL("image/jpeg",.85);d.logo=du;d.sample=false;fill();render();save()};
 im.onerror=function(){URL.revokeObjectURL(u);toast(L("Could not read this image.","यह इमेज नहीं खुली।"),"err")};im.src=u};
$("lgx").onclick=function(){d.logo="";$("lg").value="";fill();render();save()};
$("nx").onclick=function(){var n=d.no||"INV-001",mm=n.match(/^(.*?)(\d+)(\D*)$/);d.no=mm?mm[1]+String(+mm[2]+1).padStart(mm[2].length,"0")+mm[3]:n+"-2";d.date=Doc.today();d.due="";d.sample=false;fill();render();save();toast(L("New invoice number: ","नया इनवॉइस नंबर: ")+d.no)};
$("addIt").onclick=function(){if(d.items.length>=30){toast(L("Limit reached","सीमा पूरी हो गई"),"err");return}d.items.push({d:"",q:"1",r:"",g:"18",h:""});d.sample=false;items();render();save();var i=document.querySelectorAll('#items [data-f="d"]');i[i.length-1].focus()};
$("clr").onclick=function(){Doc.sure(this,L("Tap again to delete everything","सब मिटाने के लिए फिर टैप करें"),function(){d=blank();d.notes="";fill();render();save();toast(L("Cleared","साफ हो गया"))})};
$("pdf").onclick=function(){Doc.print(((d.from.name||"").trim()?d.from.name.trim()+" - ":"")+"Invoice "+d.no)};
document.addEventListener("langchange",function(){items();render()});
Doc.watch(function(){var p=Doc.fit();$("pg").textContent=p+L(p===1?" page":" pages"," पेज")});
d=load();fill();render();

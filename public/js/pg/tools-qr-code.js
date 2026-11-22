var logo=null,cur=null;
function v(i){return($(i).value||"").trim()}
function esc(x){return x.replace(/([\\;,:"])/g,"\\$1")}
function payload(){
 var t=$("ty").value;
 if(t==="text")return $("t").value;
 if(t==="wifi"){if(!v("wn"))return"";return"WIFI:T:"+($("wt").value)+";S:"+esc(v("wn"))+";P:"+esc($("wp").value)+";;"}
 if(t==="upi"){if(!v("ua"))return"";var q="pa="+encodeURIComponent(v("ua"));if(v("un"))q+="&pn="+encodeURIComponent(v("un"));if(+v("um")>0)q+="&am="+(+v("um"));q+="&cu=INR";if(v("uo"))q+="&tn="+encodeURIComponent(v("uo"));return"upi://pay?"+q}
 if(t==="vcard"){if(!v("vn"))return"";return["BEGIN:VCARD","VERSION:3.0","FN:"+v("vn"),v("vo")?"ORG:"+v("vo"):"",v("vp")?"TEL:"+v("vp"):"",v("ve")?"EMAIL:"+v("ve"):"",v("vu")?"URL:"+v("vu"):"","END:VCARD"].filter(Boolean).join("\n")}
 if(t==="mail"){if(!v("mt"))return"";return"mailto:"+v("mt")+"?subject="+encodeURIComponent(v("ms"))+"&body="+encodeURIComponent($("mb").value)}
 if(t==="sms"){if(!v("sn"))return"";return"SMSTO:"+v("sn")+":"+$("sm").value}
 if(t==="wa"){var n=v("wan").replace(/\D/g,"");if(!n)return"";return"https://wa.me/"+n+($("wam").value?"?text="+encodeURIComponent($("wam").value):"")}
 if(t==="geo"){if(!isFinite(+v("gl"))||!isFinite(+v("go"))||!v("gl")||!v("go"))return"";return"geo:"+v("gl")+","+v("go")}
 return"";
}
function lum(h){var n=parseInt(h.slice(1),16),c=[n>>16&255,n>>8&255,n&255].map(function(x){x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function shape(x,y,st,fg){ // returns [canvasFn, svgString]
 if(st==="dot")return{svg:'<circle cx="'+(x+.5)+'" cy="'+(y+.5)+'" r=".5"/>',cv:function(g,k){g.beginPath();g.arc((x+.5)*k,(y+.5)*k,.5*k,0,7);g.fill()}};
 if(st==="rd")return{svg:'<rect x="'+x+'" y="'+y+'" width="1" height="1" rx=".3"/>',cv:function(g,k){g.beginPath();g.roundRect?g.roundRect(x*k,y*k,k,k,.3*k):g.rect(x*k,y*k,k,k);g.fill()}};
 return{svg:'<rect x="'+x+'" y="'+y+'" width="1" height="1"/>',cv:function(g,k){g.fillRect(x*k,y*k,k+.5,k+.5)}};
}
function draw(){
 var t=payload(),err=$("err");err.hidden=true;
 if(!t){$("res").hidden=true;return}
 try{
  var ec=logo?"H":$("ec").value;
  var q=DTAqr.create(t,{ec:ec});
  var n=q.size,mg=Math.max(0,Math.min(10,+$("mg").value||0)),tot=n+mg*2,size=+$("sz").value,k=Math.max(1,Math.floor(size/tot)),px=k*tot;
  var fg=$("fg").value,bg=$("bg").value,st=$("st").value,c=$("cv"),g=c.getContext("2d");
  c.width=px;c.height=px;g.fillStyle=bg;g.fillRect(0,0,px,px);g.fillStyle=fg;
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+tot+' '+tot+'" width="'+size+'" height="'+size+'" shape-rendering="geometricPrecision"><rect width="'+tot+'" height="'+tot+'" fill="'+bg+'"/><g fill="'+fg+'">';
  var skip=logo?Math.ceil(n*.22):0,lo=Math.floor((n-skip)/2);
  for(var r=0;r<n;r++)for(var j=0;j<n;j++){
   if(!q.isDark(r,j))continue;
   if(logo&&r>=lo-1&&r<=lo+skip&&j>=lo-1&&j<=lo+skip)continue;
   var sh=shape(j+mg,r+mg,st,fg);sh.cv(g,k);svg+=sh.svg}
  svg+="</g>";
  if(logo){var ls=(skip+2)*k,lx=(lo-1+mg)*k;g.fillStyle=bg;g.fillRect(lx,lx,ls,ls);var rr=Math.min(logo.width,logo.height),sc=(ls*.84)/Math.max(logo.width,logo.height);var lw=logo.width*sc,lh=logo.height*sc;g.drawImage(logo,lx+(ls-lw)/2,lx+(ls-lh)/2,lw,lh);
   var u=document.createElement("canvas");u.width=logo.width;u.height=logo.height;u.getContext("2d").drawImage(logo,0,0);var kk=ls/k;
   svg+='<rect x="'+(lo-1+mg)+'" y="'+(lo-1+mg)+'" width="'+kk+'" height="'+kk+'" fill="'+bg+'"/><image href="'+u.toDataURL("image/png")+'" x="'+((lo-1+mg)+(kk-lw/k)/2)+'" y="'+((lo-1+mg)+(kk-lh/k)/2)+'" width="'+(lw/k)+'" height="'+(lh/k)+'"/>'}
  svg+="</svg>";cur=svg;
  $("wn2").hidden=Math.abs(lum(bg)-lum(fg))>.35||lum(fg)>lum(bg)?Math.abs(lum(bg)-lum(fg))>.35&&lum(fg)<=lum(bg):false;
  $("wn2").hidden=!(lum(fg)>lum(bg)||Math.abs(lum(bg)-lum(fg))<.35);
  $("res").hidden=false;
 }catch(e){
  $("res").hidden=true;err.hidden=false;
  err.textContent=L("Text is too long for a QR code.","टेक्स्ट QR कोड के लिए बहुत लंबा है।");
 }
}
$("ty").onchange=function(){document.querySelectorAll("[data-ty]").forEach(function(d){d.hidden=d.dataset.ty!==$("ty").value});draw()};
document.querySelectorAll("input,textarea,select").forEach(function(e){if(e.id!=="lg"&&e.id!=="ty")e.addEventListener("input",draw)});
$("lg").onchange=function(){var f=this.files[0];if(!f){logo=null;draw();return}var u=URL.createObjectURL(f),im=new Image();im.onload=function(){logo=im;$("lgx").hidden=false;draw()};im.src=u};
$("lgx").onclick=function(){logo=null;$("lg").value="";$("lgx").hidden=true;draw()};
$("dl").onclick=function(){var a=document.createElement("a");a.href=$("cv").toDataURL("image/png");a.download="dtahub-qr.png";document.body.appendChild(a);a.click();document.body.removeChild(a)};
$("dsv").onclick=function(){if(!cur)return;var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([cur],{type:"image/svg+xml"}));a.download="dtahub-qr.svg";document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(a.href)},3000)};

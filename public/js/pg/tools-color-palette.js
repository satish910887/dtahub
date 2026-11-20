function h2r(h){return[1,3,5].map(function(i){return parseInt(h.substr(i,2),16)})}
function r2h(r){return"#"+r.map(function(x){return("0"+Math.max(0,Math.min(255,Math.round(x))).toString(16)).slice(-2)}).join("")}
function r2hsl(r){var a=r.map(function(x){return x/255}),M=Math.max.apply(0,a),m=Math.min.apply(0,a),l=(M+m)/2,s=0,h=0,d=M-m;if(d){s=d/(1-Math.abs(2*l-1));h=M===a[0]?((a[1]-a[2])/d+6)%6:M===a[1]?(a[2]-a[0])/d+2:(a[0]-a[1])/d+4;h*=60}return[h,s*100,l*100]}
function hsl2h(h,s,l){h=((h%360)+360)%360;s/=100;l/=100;var k=function(n){var q=(n+h/30)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(q-3,9-q,1))};return r2h([k(0)*255,k(8)*255,k(4)*255])}
function lum(r){var a=r.map(function(x){x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*a[0]+.7152*a[1]+.0722*a[2]}
function cr(a,b){var x=lum(a),y=lum(b),h=Math.max(x,y),l=Math.min(x,y);return(h+.05)/(l+.05)}
function sw(hex,use){var t=cr(h2r(hex),[255,255,255])>=cr(h2r(hex),[0,0,0])?"#fff":"#000";return'<button type="button" '+(use?'data-use="':'data-c="')+hex+'" style="background:'+hex+';color:'+t+'" aria-label="'+(use?L("Use ","इस्तेमाल करें "):L("Copy ","कॉपी "))+hex+'">'+hex.toUpperCase()+'</button>'}
var cur="#8b6cf6",pal={};
var STEPS=[50,100,200,300,400,500,600,700,800],LS=[95,85,75,65,55,45,35,25,15];
function gen(hex){
 cur=hex;var r=h2r(hex),c=r2hsl(r),H=c[0],S=c[1],Lx=c[2];
 var w=cr(r,[255,255,255]),b=cr(r,[0,0,0]);
 $("info").innerHTML='<div class="cinfo"><span>HEX <b>'+hex.toUpperCase()+'</b></span><span>RGB <b>'+r.join(", ")+'</b></span><span>HSL <b>'+Math.round(H)+"°, "+Math.round(S)+"%, "+Math.round(Lx)+'%</b></span></div><p class="line" style="margin-top:10px">'+L("Contrast with white: ","सफेद के साथ कंट्रास्ट: ")+'<b>'+w.toFixed(2)+':1</b> '+(w>=4.5?"✓":"✗")+' &nbsp; '+L("with black: ","काले के साथ: ")+'<b>'+b.toFixed(2)+':1</b> '+(b>=4.5?"✓":"✗")+'</p>';
 var comp=hsl2h(H+180,S,Lx),sp=[hsl2h(H+150,S,Lx),hsl2h(H+210,S,Lx)],an=[hsl2h(H-30,S,Lx),hsl2h(H+30,S,Lx)],tr=[hsl2h(H+120,S,Lx),hsl2h(H+240,S,Lx)],te=[hsl2h(H+90,S,Lx),comp,hsl2h(H+270,S,Lx)];
 $("g-comp").innerHTML=sw(hex)+sw(comp);
 $("g-split").innerHTML=sw(hex)+sw(sp[0])+sw(sp[1]);
 $("g-ana").innerHTML=sw(an[0])+sw(hex)+sw(an[1]);
 $("g-tri").innerHTML=sw(hex)+sw(tr[0])+sw(tr[1]);
 $("g-tet").innerHTML=sw(hex)+sw(te[0])+sw(te[1])+sw(te[2]);
 var mono=[20,35,50,65,80].map(function(l){return hsl2h(H,Math.min(S,70),l)});
 $("g-mono").innerHTML=mono.map(function(x){return sw(x)}).join("");
 var scale=LS.map(function(l){return hsl2h(H,S,l)});
 $("g-ts").innerHTML=scale.map(function(x){return sw(x)}).join("");
 pal={base:hex,complementary:comp,splitComplementary:sp,analogous:an,triadic:tr,tetradic:te,scale:{}};
 STEPS.forEach(function(k,i){pal.scale[k]=scale[i]});
 exp();
}
function exp(){
 var f=$("exf").value,o="",sc=pal.scale;
 if(f==="css"){o=":root {\n  --brand: "+pal.base+";\n  --accent: "+pal.complementary+";\n"+STEPS.map(function(k){return"  --brand-"+k+": "+sc[k]+";"}).join("\n")+"\n}"}
 else if(f==="scss"){o="$brand: "+pal.base+";\n$accent: "+pal.complementary+";\n"+STEPS.map(function(k){return"$brand-"+k+": "+sc[k]+";"}).join("\n")}
 else if(f==="tw"){o="// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: {\n"+STEPS.map(function(k){return"          "+k+": '"+sc[k]+"',"}).join("\n")+"\n          DEFAULT: '"+pal.base+"',\n        },\n        accent: '"+pal.complementary+"',\n      },\n    },\n  },\n};"}
 else o=JSON.stringify(pal,null,2);
 $("exo").value=o;
}
function setC(hex,fromText){$("pk").value=hex;if(!fromText)$("hx").value=hex;gen(hex)}
function chk(){
 var f=h2r($("cf").value),b=h2r($("cb").value),x=cr(f,b),ok=function(v,n){return'<span class="'+(v>=n?"pass":"fail")+'">'+(v>=n?"✓ ":"✗ ")+n+":1</span>"};
 $("cprev").style.color=$("cf").value;$("cprev").style.background=$("cb").value;
 $("cres").innerHTML='<b>'+x.toFixed(2)+':1</b><div class="crow" style="margin-top:6px"><span>'+L("Normal text AA ","सामान्य टेक्स्ट AA ")+ok(x,4.5)+'</span><span>'+L("Large text AA ","बड़ा टेक्स्ट AA ")+ok(x,3)+'</span><span>'+L("Normal AAA ","सामान्य AAA ")+ok(x,7)+'</span><span>'+L("Large AAA ","बड़ा AAA ")+ok(x,4.5)+'</span></div>';
}
["cf","cb"].forEach(function(i){$(i).addEventListener("input",chk)});
$("cuse").onclick=function(){$("cb").value=cur;chk()};
$("csw").onclick=function(){var t=$("cf").value;$("cf").value=$("cb").value;$("cb").value=t;chk()};
/* median-cut colours from a photo */
function extract(img,n){
 var c=document.createElement("canvas"),k=Math.min(1,120/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
 var x=c.getContext("2d");x.drawImage(img,0,0,c.width,c.height);var d=x.getImageData(0,0,c.width,c.height).data,px=[];
 for(var i=0;i<d.length;i+=4)if(d[i+3]>200)px.push([d[i],d[i+1],d[i+2]]);
 if(!px.length)return[];
 var boxes=[px];
 while(boxes.length<n){
  var bi=-1,br=-1;boxes.forEach(function(b,i){if(b.length<2)return;var rg=[0,1,2].map(function(ch){var mn=255,mx=0;b.forEach(function(p){if(p[ch]<mn)mn=p[ch];if(p[ch]>mx)mx=p[ch]});return mx-mn}),m=Math.max.apply(0,rg)*Math.log(b.length+1);if(m>br){br=m;bi=i}});
  if(bi<0)break;var b=boxes[bi],ch=0,best=-1;
  [0,1,2].forEach(function(q){var mn=255,mx=0;b.forEach(function(p){if(p[q]<mn)mn=p[q];if(p[q]>mx)mx=p[q]});if(mx-mn>best){best=mx-mn;ch=q}});
  b.sort(function(p,q){return p[ch]-q[ch]});var mid=b.length>>1;boxes.splice(bi,1,b.slice(0,mid),b.slice(mid));
 }
 return boxes.filter(function(b){return b.length}).map(function(b){var s=[0,0,0];b.forEach(function(p){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2]});return{h:r2h([s[0]/b.length,s[1]/b.length,s[2]/b.length]),n:b.length}}).sort(function(a,b){return b.n-a.n}).map(function(o){return o.h});
}
$("pf").addEventListener("change",function(){
 var f=this.files[0];if(!f)return;var u=URL.createObjectURL(f),im=new Image();
 im.onload=function(){URL.revokeObjectURL(u);var cs=extract(im,6);$("g-img").innerHTML=cs.map(function(x){return sw(x,true)}).join("");$("himg").hidden=!cs.length;$("pdt").textContent=f.name};
 im.onerror=function(){URL.revokeObjectURL(u);$("g-img").textContent=L("Could not read this image.","यह इमेज नहीं खुली।")};im.src=u;
});
$("pk").addEventListener("input",function(){$("err").hidden=true;setC(this.value)});
$("hx").addEventListener("input",function(){var v=this.value.trim();if(v[0]!=="#")v="#"+v;if(/^#[0-9a-f]{6}$/i.test(v)){$("err").hidden=true;setC(v.toLowerCase(),true)}else if(/^#[0-9a-f]{3}$/i.test(v)){setC("#"+v[1]+v[1]+v[2]+v[2]+v[3]+v[3],true);$("err").hidden=true}else{$("err").hidden=false;$("err").textContent=L("Enter a colour like #8b6cf6.","#8b6cf6 जैसा रंग लिखें।")}});
$("rnd").onclick=function(){var a=new Uint8Array(3);crypto.getRandomValues(a);$("err").hidden=true;setC(r2h([].slice.call(a)))};
$("exf").onchange=exp;$("excp").onclick=function(){copyText($("exo").value,$("excp"))};
$("exdl").onclick=function(){var f=$("exf").value;saveBlob(new Blob([$("exo").value+"\n"],{type:"text/plain"}),"palette."+(f==="json"?"json":f==="scss"?"scss":f==="tw"?"js":"css"))};
document.querySelector("main").addEventListener("click",function(e){var u=e.target.closest("[data-use]");if(u){setC(u.dataset.use);window.scrollTo({top:0,behavior:"smooth"});return}var b=e.target.closest("[data-c]");if(b)copyText(b.dataset.c)});
document.addEventListener("langchange",function(){gen(cur);chk()});
gen("#8b6cf6");chk();

var im=null,file=null,out=null,unit="px",MAXD=4000;
var PRESETS={
 p1:{w:200,h:230,u:"px",min:20,max:50,focus:"top"},
 p2:{w:413,h:531,u:"px",min:0,max:100,focus:"top"},
 p3:{w:413,h:531,u:"px",min:0,max:200,focus:"top"},
 s1:{w:140,h:60,u:"px",min:10,max:20,focus:"center"},
 s2:{w:413,h:177,u:"px",min:0,max:50,focus:"center"}
};
var F={px:null,cm:2.54,mm:25.4};
function dpi(){return Math.min(1200,Math.max(30,+$("dpi").value||300))}
function toPx(v){return unit==="px"?v:v/F[unit]*dpi()}
function fromPx(v){return unit==="px"?Math.round(v):+(v*F[unit]/dpi()).toFixed(2)}
function showErr(m){$("err").hidden=!m;$("err").textContent=m||""}
function toBlob(c,q){return new Promise(function(r){c.toBlob(r,"image/jpeg",q)})}
function load(f){return new Promise(function(r){var u=URL.createObjectURL(f),i=new Image();i.onload=function(){URL.revokeObjectURL(u);r(i)};i.onerror=function(){URL.revokeObjectURL(u);r(null)};i.src=u})}
$("f").addEventListener("change",async function(){
 var f=this.files[0];if(!f)return;
 if(f.size>50*1024*1024){showErr(L("File is too large (max 50 MB).","फाइल बहुत बड़ी है (अधिकतम 50 MB)।"));return}
 if(f.type&&f.type.indexOf("image/")!==0){showErr(L("Please choose an image file (JPG, PNG, WebP).","कृपया इमेज फाइल चुनें (JPG, PNG, WebP)।"));return}
 var i=await load(f);
 if(!i){showErr(L("Could not open this image. The file may be damaged or not an image.","यह इमेज नहीं खुल सकी। फाइल खराब हो सकती है या इमेज नहीं है।"));return}
 im=i;file=f;out=null;showErr("");$("ctl").hidden=false;$("res").hidden=true;$("dt").textContent=f.name;
 $("orig").textContent=L("Original: ","असली: ")+i.naturalWidth+" × "+i.naturalHeight+" px • "+sizeOf(f.size);
 if(!+$("w").value)applyPreset("p1");
});
function applyPreset(k){
 var p=PRESETS[k];if(!p)return;unit="px";$("un").value="px";
 $("w").value=p.w;$("h").value=p.h;$("mn").value=p.min||"";$("mx").value=p.max||"";$("fo").value=p.focus;$("ps").value=k;
 $("cl").checked=k[0]==="s";
}
$("ps").onchange=function(){if($("ps").value)applyPreset($("ps").value)};
$("un").onchange=function(){var w=toPx(+$("w").value),h=toPx(+$("h").value);unit=$("un").value;$("w").value=fromPx(w);$("h").value=fromPx(h);$("ps").value=""};
["w","h","mn","mx","dpi"].forEach(function(id){$(id).addEventListener("input",function(){$("ps").value=""})});
/* make writing dark on white paper: stretch levels from the image itself */
function cleanUp(x,W,H){
 var d=x.getImageData(0,0,W,H),a=d.data,n=W*H,hist=new Uint32Array(256),i,l;
 for(i=0;i<n;i++){l=(a[i*4]*.299+a[i*4+1]*.587+a[i*4+2]*.114)|0;hist[l]++}
 var c=0,lo=0,md=255;
 for(i=0;i<256;i++){c+=hist[i];if(!lo&&c>=n*.01)lo=i;if(c>=n*.5){md=i;break}}
 var hi=Math.max(lo+20,md*.92);
 for(i=0;i<n;i++){l=a[i*4]*.299+a[i*4+1]*.587+a[i*4+2]*.114;var v=Math.max(0,Math.min(1,(l-lo)/(hi-lo)));v=Math.pow(v,1.6)*255;a[i*4]=a[i*4+1]=a[i*4+2]=v;a[i*4+3]=255}
 x.putImageData(d,0,0);
}
function draw(W,H,s){
 var c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
 x.fillStyle=$("bg").value;x.fillRect(0,0,W,H);x.imageSmoothingQuality="high";
 var iw=im.naturalWidth,ih=im.naturalHeight,fit=$("fit").value;
 if(fit==="stretch")x.drawImage(im,0,0,W,H);
 else{var k=fit==="cover"?Math.max(W/iw,H/ih):Math.min(W/iw,H/ih),dw=iw*k,dh=ih*k,dx=(W-dw)/2,dy=(fit==="cover"&&$("fo").value==="top")?0:(H-dh)/2;x.drawImage(im,dx,dy,dw,dh)}
 if($("cl").checked)cleanUp(x,W,H);
 if(s<1){var t=document.createElement("canvas");t.width=Math.max(8,Math.round(W*s));t.height=Math.max(8,Math.round(H*s));var y=t.getContext("2d");y.imageSmoothingQuality="high";y.drawImage(c,0,0,t.width,t.height);x.clearRect(0,0,W,H);x.imageSmoothingQuality="high";x.drawImage(t,0,0,W,H)}
 return c;
}
/* add harmless JPEG comment bytes so the file reaches the minimum size without changing the picture */
async function padTo(blob,target){
 var buf=new Uint8Array(await blob.arrayBuffer());if(buf[0]!==0xFF||buf[1]!==0xD8||buf.length>=target)return blob;
 var need=target-buf.length,parts=[buf.subarray(0,2)];
 while(need>0){var n=Math.max(1,Math.min(need-4,65531));var seg=new Uint8Array(4+n);seg[0]=0xFF;seg[1]=0xFE;seg[2]=((n+2)>>8)&255;seg[3]=(n+2)&255;parts.push(seg);need-=seg.length}
 parts.push(buf.subarray(2));return new Blob(parts,{type:"image/jpeg"});
}
$("go").onclick=async function(){
 if(!im){showErr(L("Please choose a photo first.","पहले फोटो चुनें।"));return}
 var w=Math.round(toPx(+$("w").value)),h=Math.round(toPx(+$("h").value));
 if(!(w>=10&&h>=10)||w>MAXD||h>MAXD){showErr(L("Enter width and height so the size is between 10 and 4000 px.","चौड़ाई और ऊंचाई ऐसी डालें कि साइज़ 10 से 4000 px के बीच रहे।"));return}
 var mn=+$("mn").value||0,mx=+$("mx").value||0;
 if(mn<0||mx<0||(mx&&mn>mx)){showErr(L("Minimum size cannot be more than the maximum.","न्यूनतम साइज़ अधिकतम से ज़्यादा नहीं हो सकता।"));return}
 showErr("");var btn=$("go");btn.disabled=true;var old=btn.textContent;btn.textContent=L("Working...","हो रहा है...");
 try{
  /* KB differs between portals (1000 or 1024 bytes), so stay safely inside both */
  var maxB=mx?(mx*1000>=mn*1024?mx*1000:mx*1024):0,minB=mn?mn*1024:0,res=null,soft=[1,.85,.7,.55,.4,.3];
  for(var si=0;si<soft.length&&!res;si++){
   var c=draw(w,h,soft[si]);
   if(!maxB){res={blob:await toBlob(c,.92),q:92,s:soft[si]};break}
   var lo=.05,hi=.98,best=null,b;
   b=await toBlob(c,lo);if(b.size>maxB)continue;best={blob:b,q:lo};
   for(var k=0;k<9;k++){var m=(lo+hi)/2;b=await toBlob(c,m);if(b.size<=maxB){best={blob:b,q:m};lo=m}else hi=m}
   res={blob:best.blob,q:Math.round(best.q*100),s:soft[si]};
  }
  if(!res){showErr(L("Could not get under the maximum size at this pixel size. Try a larger maximum, or a simpler photo.","इस पिक्सेल साइज़ पर अधिकतम साइज़ तक नहीं पहुंच सके। अधिकतम बढ़ाकर या सादी फोटो से कोशिश करें।"));return}
  var blob=res.blob,padded=false;
  if(minB&&blob.size<minB){blob=await padTo(blob,minB+300);padded=true}
  out={blob:blob,w:w,h:h};
  if(out.u)URL.revokeObjectURL(out.u);out.u=URL.createObjectURL(blob);$("pv").src=out.u;
  var okMax=!maxB||blob.size<=maxB,okMin=!minB||blob.size>=minB;
  $("info").textContent=w+" × "+h+" px • "+sizeOf(blob.size)+" • JPG";
  var ck=[];
  ck.push((w+" × "+h+" px ✓"));
  if(mx||mn)ck.push((okMax&&okMin?"✓ ":"✗ ")+L("Size ","साइज़ ")+sizeOf(blob.size)+" ("+(mn?mn:"0")+"–"+(mx?mx:"∞")+" KB)");
  $("chk").textContent=ck.join("   ");
  var notes=[];
  if(res.s<1)notes.push(L("The photo was softened a little to reach the size limit.","साइज़ सीमा तक पहुंचने के लिए फोटो को थोड़ा मुलायम किया गया।"));
  if(padded)notes.push(L("Harmless filler bytes were added so the file reaches the minimum size. The picture is unchanged.","न्यूनतम साइज़ तक पहुंचने के लिए फाइल में बेअसर अतिरिक्त बाइट जोड़े गए। तस्वीर वही है।"));
  $("note").textContent=notes.join(" ");$("note").hidden=!notes.length;
  $("res").hidden=false;$("res").scrollIntoView({block:"nearest",behavior:"smooth"});
 }catch(e){showErr(L("Something went wrong. Try a smaller photo.","कुछ गड़बड़ हुई। छोटी फोटो से कोशिश करें।"))}
 finally{btn.disabled=false;btn.textContent=old}
};
$("dl").onclick=function(){if(out)saveBlob(out.blob,baseName(file)+"-"+out.w+"x"+out.h+".jpg")};
var rb=document.querySelector("[data-reset]");if(rb)rb.addEventListener("click",function(){im=null;file=null;out=null;$("ctl").hidden=true;$("res").hidden=true;$("f").value="";$("dt").textContent=L("Tap to choose a photo or signature","फोटो या सिग्नेचर चुनने के लिए टैप करें");showErr("")});

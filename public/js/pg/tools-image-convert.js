var items=[],tm=null,busy=0;
function wm(x,W,H){
 var t=$("wt").value.trim();if(!t)return;
 var fs=Math.max(12,Math.round(Math.min(W,H)*+$("ws").value)),p=$("wp").value,a=$("wo").value/100;
 x.save();x.font="700 "+fs+"px sans-serif";x.textBaseline="middle";x.globalAlpha=a;x.lineJoin="round";x.lineWidth=Math.max(2,fs/9);
 function put(px,py,al){x.textAlign=al;x.strokeStyle="rgba(0,0,0,.6)";x.strokeText(t,px,py);x.fillStyle="#fff";x.fillText(t,px,py)}
 var m=fs*.8;
 if(p==="br")put(W-m,H-m,"right");else if(p==="bl")put(m,H-m,"left");else if(p==="c")put(W/2,H/2,"center");
 else{x.translate(W/2,H/2);x.rotate(-Math.PI/6);var sx=x.measureText(t).width+fs*3,sy=fs*3.2,R=Math.hypot(W,H);for(var yy=-R;yy<R;yy+=sy){for(var xx=-R;xx<R;xx+=sx)put(xx,yy,"center")}}
 x.restore();
}
function enc(im,type,q,bg){
 var c=document.createElement("canvas");c.width=im.naturalWidth;c.height=im.naturalHeight;var x=c.getContext("2d");
 if(type!=="image/png"&&type!=="image/webp"&&type!=="image/avif"){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height)}
 x.imageSmoothingQuality="high";x.drawImage(im,0,0);wm(x,c.width,c.height);
 return new Promise(function(r){c.toBlob(r,type,q)});
}
function load(f){return new Promise(function(r){var u=URL.createObjectURL(f),im=new Image();im.onload=function(){URL.revokeObjectURL(u);r({f:f,im:im})};im.onerror=function(){URL.revokeObjectURL(u);r({f:f,im:null})};im.src=u})}
async function run(){
 if(!items.length)return;var my=++busy,t=$("fmt").value;
 $("qv").textContent=$("q").value;$("qbox").hidden=t==="image/png";$("bgbox").hidden=t!=="image/jpeg";
 for(var it of items){it.out=it.im?await enc(it.im,t,+$("q").value/100,$("bg").value):null;if(my!==busy)return}
 var ok=items.filter(function(i){return i.out&&i.out.type===t});
 if(!ok.length){$("err").hidden=false;$("err").textContent=items.some(function(i){return i.im})?L("This format is not supported on your browser.","आपके ब्राउज़र में यह फॉर्मेट सपोर्ट नहीं है।"):L("Could not open this image. The file may be damaged or not an image.","यह इमेज खुल नहीं सकी। फ़ाइल खराब हो सकती है या इमेज नहीं है।");$("res").hidden=true;return}
 $("err").hidden=true;var one=ok.length===1,o=ok[0];
 $("info").textContent=ok.length>1?ok.length+L(" images converted to "," इमेज बदली गईं → ")+extOf(t).toUpperCase():(o.f.type||"image").replace("image/","").toUpperCase()+" → "+extOf(o.out.type).toUpperCase()+" • "+sizeOf(o.f.size)+" → "+sizeOf(o.out.size);
 $("pv").hidden=!one;$("list").hidden=one;$("dl").hidden=!one;$("dz").hidden=one;
 if(one){if(items.u)URL.revokeObjectURL(items.u);items.u=URL.createObjectURL(o.out);$("pv").src=items.u}
 $("list").innerHTML="";ok.forEach(function(i){var d=document.createElement("div"),a=document.createElement("span"),b=document.createElement("b");a.textContent=i.f.name;b.textContent=sizeOf(i.f.size)+" → "+sizeOf(i.out.size);d.append(a,b);$("list").append(d)});
 $("res").hidden=false;
}
$("f").addEventListener("change",async function(){
 var fs=[].slice.call($("f").files);if(!fs.length)return;
 $("dt").textContent=fs.length>1?fs.length+L(" photos selected"," फोटो चुनी गईं"):fs[0].name;
 items=await Promise.all(fs.map(load));$("ctl").hidden=false;run();
});
["fmt","bg","wp","ws"].forEach(function(i){$(i).addEventListener("input",run)});
$("wt").addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(run,250)});
$("wo").addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(run,200)});
$("q").addEventListener("input",function(){$("qv").textContent=$("q").value;clearTimeout(tm);tm=setTimeout(run,200)});
function nm(i){return baseName(i.f)+"."+extOf(i.out.type)}
$("dl").onclick=function(){var i=items.find(function(x){return x.out});if(i)saveBlob(i.out,nm(i))};
$("dz").onclick=async function(){
 var t=$("fmt").value,fl=[];for(var i of items){if(i.out&&i.out.type===t)fl.push({name:nm(i),data:new Uint8Array(await i.out.arrayBuffer())})}
 saveBlob(DTAzip.build(fl),"dtahub-converted.zip");
};
document.addEventListener("langchange",function(){if(items.length)run()});

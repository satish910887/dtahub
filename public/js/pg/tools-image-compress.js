var items=[],tm=null,busy=0;
function enc(im,type,q,mx){
 var w=im.naturalWidth,h=im.naturalHeight,m=Math.max(w,h);
 if(mx>0&&m>mx){var k=mx/m;w=Math.max(1,Math.round(w*k));h=Math.max(1,Math.round(h*k))}
 return renderImg(im,w,h,type,q);
}
async function fit(im,type,kb,mx){
 var lo=.05,hi=.95,best=null,b;
 b=await enc(im,type,hi,mx);if(b&&b.size<=kb*1024)return b;
 for(var i=0;i<7;i++){var mid=(lo+hi)/2;b=await enc(im,type,mid,mx);if(!b)return null;
  if(b.size<=kb*1024){best=b;lo=mid}else hi=mid}
 return best||await enc(im,type,.05,mx);
}
function load(f){return DTAcore.files.loadImage(f)}
async function run(){
 if(!items.length)return;var my=++busy,type=$("fmt").value,byT=$("mt").classList.contains("on"),mx=+$("mx").value||0,kb=+$("tk").value||100;
 $("qv").textContent=$("q").value;$("err").hidden=true;
 for(var it of items){if(!it.im)continue;
  it.out=byT?await fit(it.im,type,kb,mx):await enc(it.im,type,+$("q").value/100,mx);
  if(my!==busy)return}
 show();
}
function show(){
 var ok=items.filter(function(i){return i.out}),bad=items.length-items.filter(function(i){return i.im}).length;
 if(!ok.length){$("err").hidden=false;$("err").textContent=L("Could not open this image.","यह इमेज नहीं खुल सकी।");return}
 var so=0,sn=0;ok.forEach(function(i){so+=i.f.size;sn+=i.out.size});
 var sv=(1-sn/so)*100;
 $("so").textContent=sizeOf(so);$("sn").textContent=sizeOf(sn);
 $("sv").textContent=sv>0?sv.toFixed(1)+" %":L("Already small. Try lower quality.","पहले से छोटी है। क्वालिटी कम करके देखें।");
 $("list").innerHTML="";
 ok.forEach(function(i){var d=document.createElement("div"),a=document.createElement("span"),b=document.createElement("b");a.textContent=i.f.name;b.textContent=sizeOf(i.f.size)+" → "+sizeOf(i.out.size);d.append(a,b);$("list").append(d)});
 if(bad){$("err").hidden=false;$("err").textContent=bad+L(" file(s) could not be opened."," फाइल नहीं खुल सकीं।")}
 var one=ok.length===1;$("cmpw").hidden=!one;$("list").hidden=one;$("dz").hidden=one;
 if(one){if(items.u)URL.revokeObjectURL(items.u);items.u=URL.createObjectURL(ok[0].out);$("pv").src=items.u}
 $("dl").textContent=one?L("Download","डाउनलोड करें"):L("Download first","पहली डाउनलोड करें");$("dl").hidden=!one;
 $("res").hidden=false;
}
$("f").addEventListener("change",async function(){
 var fs=[].slice.call($("f").files);if(!fs.length)return;
 $("dt").textContent=fs.length>1?fs.length+L(" photos selected"," फोटो चुनी गईं"):fs[0].name;
 items=await Promise.all(fs.map(load));$("ctl").hidden=false;run();
});
$("q").addEventListener("input",function(){$("qv").textContent=$("q").value;clearTimeout(tm);tm=setTimeout(run,200)});
["fmt","mx","tk"].forEach(function(i){$(i).addEventListener("input",function(){clearTimeout(tm);tm=setTimeout(run,300)})});
function mode(t){$("mt").classList.toggle("on",t);$("mq").classList.toggle("on",!t);$("bt").hidden=!t;$("bq").hidden=t;run()}
$("mq").onclick=function(){mode(false)};$("mt").onclick=function(){mode(true)};
function nm(i){return baseName(i.f)+"-compressed."+extOf(i.out.type)}
$("dl").onclick=function(){var i=items.find(function(x){return x.out});if(i)saveBlob(i.out,nm(i))};
$("dz").onclick=async function(){
 var fl=[];for(var i of items){if(i.out)fl.push({name:nm(i),data:new Uint8Array(await i.out.arrayBuffer())})}
 saveBlob(DTAzip.build(fl),"dtahub-compressed.zip");
};
document.addEventListener("langchange",function(){if(items.length)show()});

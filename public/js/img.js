window.pickImage=function(inp,cb){
 inp.addEventListener("change",function(){
  var f=inp.files[0];if(!f)return;
  var u=URL.createObjectURL(f),im=new Image();
  im.onload=function(){URL.revokeObjectURL(u);cb(im,f)};
  im.onerror=function(){URL.revokeObjectURL(u);cb(null,f)};
  im.src=u;
 });
};
window.renderImg=function(im,w,h,type,q){
 var c=document.createElement("canvas");c.width=w;c.height=h;
 var x=c.getContext("2d");
 if(type!=="image/png"){x.fillStyle="#fff";x.fillRect(0,0,w,h)}
 x.imageSmoothingQuality="high";x.drawImage(im,0,0,w,h);
 return new Promise(function(res){c.toBlob(res,type,q)});
};
window.extOf=function(t){return t==="image/jpeg"?"jpg":t==="image/webp"?"webp":"png"};
window.sizeOf=function(b){return b<1024?b+" B":b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(2)+" MB"};
window.saveBlob=function(blob,name){
 var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;
 document.body.appendChild(a);a.click();document.body.removeChild(a);
 setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
};
window.baseName=function(f){return f.name.replace(/\.[^.]+$/,"")};

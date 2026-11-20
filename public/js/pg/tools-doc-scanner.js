var pages=[],cur=0,MAXS=2400,filt="clean",drag=-1;
var cc=$("cc"),cx=cc.getContext("2d"),rc=$("rc"),rx=rc.getContext("2d");
function msg(id,t){var e=$(id);e.hidden=!t;if(t)e.textContent=t}
function loadFile(f){return new Promise(function(res){
 var u=URL.createObjectURL(f),im=new Image();
 im.onload=function(){URL.revokeObjectURL(u);var k=Math.min(1,MAXS/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c)};
 im.onerror=function(){URL.revokeObjectURL(u);res(null)};im.src=u})}
async function add(files){
 msg("err","");var bad=0;
 for(var i=0;i<files.length;i++){
  if(pages.length>=20){msg("err",L("Only 20 pages at a time.","एक बार में सिर्फ 20 पन्ने।"));break}
  var c=await loadFile(files[i]);if(!c){bad++;continue}
  var p={src:c,pts:autoCorners(c),rot:0,prev:null};pages.push(p);
 }
 if(bad)msg("err",L("Some files were not images.","कुछ फाइलें इमेज नहीं थीं।"));
 if(pages.length){$("ctl").hidden=false;$("dt").textContent=pages.length+L(" page(s) ready"," पन्ने तैयार");cur=pages.length-1;show()}
}
$("f").addEventListener("change",function(){add(Array.prototype.slice.call(this.files));this.value=""});
$("cam").addEventListener("change",function(){add(Array.prototype.slice.call(this.files));this.value=""});
/* ---------- edge detection (original): Otsu threshold + flood fill from the page centre ---------- */
function autoCorners(src){
 var S=220,k=S/Math.max(src.width,src.height),w=Math.max(8,Math.round(src.width*k)),h=Math.max(8,Math.round(src.height*k));
 var c=document.createElement("canvas");c.width=w;c.height=h;var x=c.getContext("2d");x.drawImage(src,0,0,w,h);
 var d=x.getImageData(0,0,w,h).data,L=new Uint8Array(w*h),hist=new Array(256).fill(0),i;
 for(i=0;i<w*h;i++){var v=Math.round(.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2]);L[i]=v;hist[v]++}
 var tot=w*h,sum=0,sB=0,wB=0,mx=0,th=128;for(i=0;i<256;i++)sum+=i*hist[i];
 for(i=0;i<256;i++){wB+=hist[i];if(!wB)continue;var wF=tot-wB;if(!wF)break;sB+=i*hist[i];var mB=sB/wB,mF=(sum-sB)/wF,bv=wB*wF*(mB-mF)*(mB-mF);if(bv>mx){mx=bv;th=i}}
 var seed=-1,best=1e9,cxx=w/2,cyy=h/2;
 for(var yy=0;yy<h;yy++)for(var xx=0;xx<w;xx++){if(L[yy*w+xx]>th){var dd=(xx-cxx)*(xx-cxx)+(yy-cyy)*(yy-cyy);if(dd<best){best=dd;seed=yy*w+xx}}}
 var def=function(){var m=.04;return[[src.width*m,src.height*m],[src.width*(1-m),src.height*m],[src.width*(1-m),src.height*(1-m)],[src.width*m,src.height*(1-m)]]};
 if(seed<0)return def();
 var seen=new Uint8Array(w*h),q=[seed],qi=0;seen[seed]=1;
 var tl=[1e9,0,0],tr=[-1e9,0,0],br=[-1e9,0,0],bl=[1e9,0,0],n=0;
 while(qi<q.length){
  var p=q[qi++],px=p%w,py=(p/w)|0;n++;
  var s1=px+py,s2=px-py;
  if(s1<tl[0])tl=[s1,px,py];if(s1>br[0])br=[s1,px,py];if(s2>tr[0])tr=[s2,px,py];if(s2<bl[0])bl=[s2,px,py];
  var nb=[p-1,p+1,p-w,p+w];
  for(var j=0;j<4;j++){var o=nb[j];if(o<0||o>=w*h||seen[o])continue;if(j===0&&px===0)continue;if(j===1&&px===w-1)continue;if(L[o]>th){seen[o]=1;q.push(o)}}
 }
 if(n<tot*.12||n>tot*.97)return def();
 var f=1/k,pad=function(a,dx,dy){return[Math.max(0,Math.min(src.width,a[1]*f+dx)),Math.max(0,Math.min(src.height,a[2]*f+dy))]};
 return[pad(tl,0,0),pad(tr,f,0),pad(br,f,f),pad(bl,0,f)];
}
/* ---------- perspective warp (original): solve homography, bilinear sampling ---------- */
function solve(A,b){
 var n=b.length,i,j,k;
 for(i=0;i<n;i++){
  var m=i;for(j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[m][i]))m=j;
  var t=A[i];A[i]=A[m];A[m]=t;var tb=b[i];b[i]=b[m];b[m]=tb;
  for(j=i+1;j<n;j++){var f=A[j][i]/A[i][i];for(k=i;k<n;k++)A[j][k]-=f*A[i][k];b[j]-=f*b[i]}
 }
 var x=new Array(n);for(i=n-1;i>=0;i--){var s=b[i];for(k=i+1;k<n;k++)s-=A[i][k]*x[k];x[i]=s/A[i][i]}return x;
}
function warp(src,pts,maxSide){
 var dist=function(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])};
 var w=Math.max(dist(pts[0],pts[1]),dist(pts[3],pts[2])),h=Math.max(dist(pts[0],pts[3]),dist(pts[1],pts[2]));
 var k=Math.min(1,maxSide/Math.max(w,h)),W=Math.max(2,Math.round(w*k)),H=Math.max(2,Math.round(h*k));
 var dst=[[0,0],[W,0],[W,H],[0,H]],A=[],b=[];
 for(var i=0;i<4;i++){var X=dst[i][0],Y=dst[i][1],u=pts[i][0],v=pts[i][1];
  A.push([X,Y,1,0,0,0,-X*u,-Y*u]);b.push(u);A.push([0,0,0,X,Y,1,-X*v,-Y*v]);b.push(v)}
 var m=solve(A,b),sw=src.width,sh=src.height,sd=src.getContext("2d").getImageData(0,0,sw,sh).data;
 var out=document.createElement("canvas");out.width=W;out.height=H;var ox=out.getContext("2d"),od=ox.createImageData(W,H),o=od.data;
 for(var y=0;y<H;y++)for(var x=0;x<W;x++){
  var dn=m[6]*x+m[7]*y+1,sx=(m[0]*x+m[1]*y+m[2])/dn,sy=(m[3]*x+m[4]*y+m[5])/dn;
  if(sx<0)sx=0;else if(sx>sw-1.001)sx=sw-1.001;if(sy<0)sy=0;else if(sy>sh-1.001)sy=sh-1.001;
  var x0=sx|0,y0=sy|0,fx=sx-x0,fy=sy-y0,i0=(y0*sw+x0)*4,i1=i0+4,i2=i0+sw*4,i3=i2+4,p=(y*W+x)*4;
  for(var c=0;c<3;c++)o[p+c]=sd[i0+c]*(1-fx)*(1-fy)+sd[i1+c]*fx*(1-fy)+sd[i2+c]*(1-fx)*fy+sd[i3+c]*fx*fy;
  o[p+3]=255;
 }
 ox.putImageData(od,0,0);return out;
}
/* ---------- looks (original): shadow removal with a local-average background, adaptive threshold ---------- */
function look(cv,mode){
 if(mode==="orig")return cv;
 var W=cv.width,H=cv.height,x=cv.getContext("2d"),id=x.getImageData(0,0,W,H),d=id.data,n=W*H,i;
 var Lm=new Float32Array(n);for(i=0;i<n;i++)Lm[i]=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];
 var iw=W+1,I=new Float64Array(iw*(H+1));
 for(var y=0;y<H;y++){var row=0;for(var xx=0;xx<W;xx++){row+=Lm[y*W+xx];I[(y+1)*iw+xx+1]=I[y*iw+xx+1]+row}}
 var r=Math.max(6,Math.round(Math.max(W,H)/18));
 for(var y2=0;y2<H;y2++){
  var y1=Math.max(0,y2-r),y3=Math.min(H,y2+r+1);
  for(var x2=0;x2<W;x2++){
   var a=Math.max(0,x2-r),b=Math.min(W,x2+r+1),area=(b-a)*(y3-y1);
   var mean=(I[y3*iw+b]-I[y1*iw+b]-I[y3*iw+a]+I[y1*iw+a])/area,p=(y2*W+x2)*4,l=Lm[y2*W+x2];
   if(mode==="bw"){var v=l<mean*.86?0:255;d[p]=d[p+1]=d[p+2]=v}
   else{
    var bg=Math.max(mean,40),s=240/bg,cr=d[p]*s,cg=d[p+1]*s,cb=d[p+2]*s;
    if(mode==="gray"){var g=.299*cr+.587*cg+.114*cb;cr=cg=cb=g}
    var f=function(v){v=v>255?255:v<0?0:v;return 255*Math.pow(v/255,1.5)};
    d[p]=f(cr);d[p+1]=f(cg);d[p+2]=f(cb);
   }
  }
 }
 x.putImageData(id,0,0);return cv;
}
function rotated(cv,q){
 if(!q)return cv;var c=document.createElement("canvas");c.width=q%2?cv.height:cv.width;c.height=q%2?cv.width:cv.height;
 var x=c.getContext("2d");x.translate(c.width/2,c.height/2);x.rotate(q*Math.PI/2);x.drawImage(cv,-cv.width/2,-cv.height/2);return c;
}
function render(p,maxSide){return rotated(look(warp(p.src,p.pts,maxSide),filt),p.rot)}
/* ---------- UI ---------- */
function drawCorners(){
 var p=pages[cur];if(!p)return;
 var k=Math.min(1,Math.min(900,innerWidth-48)/p.src.width);cc.width=Math.round(p.src.width*k);cc.height=Math.round(p.src.height*k);
 cc.style.width=cc.width+"px";cx.drawImage(p.src,0,0,cc.width,cc.height);
 cx.fillStyle="rgba(0,0,0,.45)";cx.fillRect(0,0,cc.width,cc.height);
 cx.save();cx.beginPath();p.pts.forEach(function(q,i){var X=q[0]*cc.width/p.src.width,Y=q[1]*cc.height/p.src.height;i?cx.lineTo(X,Y):cx.moveTo(X,Y)});cx.closePath();cx.clip();cx.drawImage(p.src,0,0,cc.width,cc.height);cx.restore();
 cx.beginPath();p.pts.forEach(function(q,i){var X=q[0]*cc.width/p.src.width,Y=q[1]*cc.height/p.src.height;i?cx.lineTo(X,Y):cx.moveTo(X,Y)});cx.closePath();cx.strokeStyle="#f2c969";cx.lineWidth=2;cx.stroke();
 p.pts.forEach(function(q,i){var X=q[0]*cc.width/p.src.width,Y=q[1]*cc.height/p.src.height;cx.beginPath();cx.arc(X,Y,13,0,7);cx.fillStyle="rgba(139,108,246,.85)";cx.fill();cx.strokeStyle="#fff";cx.lineWidth=2;cx.stroke()});
}
var pt=0;
function preview(){
 clearTimeout(pt);pt=setTimeout(function(){
  var p=pages[cur];if(!p)return;
  var c=render(p,700);rc.width=c.width;rc.height=c.height;rx.drawImage(c,0,0);p.prev=c;thumbs();
 },60);
}
function thumbs(){
 var s=$("strip");s.textContent="";
 pages.forEach(function(p,i){
  var b=document.createElement("button");b.type="button";b.setAttribute("role","listitem");b.setAttribute("aria-label",L("Page ","पन्ना ")+(i+1));b.setAttribute("aria-current",i===cur?"true":"false");
  var c=document.createElement("canvas");c.width=64;c.height=84;var x=c.getContext("2d"),im=p.prev||p.src;x.fillStyle="#fff";x.fillRect(0,0,64,84);
  var k=Math.min(64/im.width,84/im.height);x.drawImage(im,(64-im.width*k)/2,(84-im.height*k)/2,im.width*k,im.height*k);
  var n=document.createElement("b");n.textContent=i+1;b.appendChild(c);b.appendChild(n);b.onclick=function(){cur=i;show()};s.appendChild(b);
 });
}
function show(){drawCorners();preview();thumbs()}
function pos(e){var r=cc.getBoundingClientRect(),p=pages[cur];return[(e.clientX-r.left)*p.src.width/r.width,(e.clientY-r.top)*p.src.height/r.height]}
cc.addEventListener("pointerdown",function(e){
 var p=pages[cur];if(!p)return;var q=pos(e),r=cc.getBoundingClientRect(),k=p.src.width/r.width,best=-1,bd=44*k;
 p.pts.forEach(function(a,i){var d=Math.hypot(a[0]-q[0],a[1]-q[1]);if(d<bd){bd=d;best=i}});
 if(best>-1){drag=best;cc.setPointerCapture(e.pointerId);e.preventDefault()}
});
cc.addEventListener("pointermove",function(e){
 if(drag<0)return;var p=pages[cur],q=pos(e);p.pts[drag]=[Math.max(0,Math.min(p.src.width,q[0])),Math.max(0,Math.min(p.src.height,q[1]))];drawCorners();
});
function up(){if(drag>-1){drag=-1;preview()}}
cc.addEventListener("pointerup",up);cc.addEventListener("pointercancel",up);
$("auto").onclick=function(){var p=pages[cur];p.pts=autoCorners(p.src);show()};
$("full").onclick=function(){var p=pages[cur];p.pts=[[0,0],[p.src.width,0],[p.src.width,p.src.height],[0,p.src.height]];show()};
$("rot").onclick=function(){pages[cur].rot=(pages[cur].rot+1)%4;preview()};
document.querySelectorAll("[data-f]").forEach(function(b){b.onclick=function(){filt=b.dataset.f;document.querySelectorAll("[data-f]").forEach(function(x){x.setAttribute("aria-pressed",x===b?"true":"false")});pages.forEach(function(p){p.prev=null});preview()}});
$("pd").onclick=function(){pages.splice(cur,1);if(!pages.length){$("ctl").hidden=true;$("dt").textContent=L("Tap to choose photos of your pages","पन्नों की फोटो चुनने के लिए टैप करें");return}cur=Math.min(cur,pages.length-1);show()};
$("pl").onclick=function(){if(cur>0){var t=pages[cur];pages[cur]=pages[cur-1];pages[cur-1]=t;cur--;thumbs()}};
$("pr").onclick=function(){if(cur<pages.length-1){var t=pages[cur];pages[cur]=pages[cur+1];pages[cur+1]=t;cur++;thumbs()}};
function toBlob(c,q){return new Promise(function(r){c.toBlob(r,"image/jpeg",q)})}
$("go").onclick=async function(){
 if(!pages.length)return;var b=$("go"),old=b.textContent;b.disabled=true;msg("err","");msg("ok","");
 try{
  var out=[],q=+$("ql").value;
  for(var i=0;i<pages.length;i++){
   b.textContent=L("Page ","पन्ना ")+(i+1)+"/"+pages.length+"...";await new Promise(function(r){setTimeout(r,20)});
   var c=render(pages[i],2000),bl=await toBlob(c,q);out.push({jpeg:new Uint8Array(await bl.arrayBuffer()),w:c.width,h:c.height});
  }
  var pdf=DTApdf.build(out,{size:$("sz").value});
  saveBlob(pdf,"scan-"+new Date().toISOString().slice(0,10)+".pdf");msg("ok",L("Done ✓ ","हो गया ✓ ")+out.length+L(" page(s) • "," पन्ने • ")+sizeOf(pdf.size));
 }catch(e){msg("err",L("Could not make the PDF. Try fewer pages.","PDF नहीं बनी। कम पन्ने आज़माएं।"))}
 b.disabled=false;b.textContent=old;
};
$("jpg").onclick=async function(){
 var p=pages[cur];if(!p)return;try{var bl=await toBlob(render(p,2400),+$("ql").value);saveBlob(bl,"scan-page-"+(cur+1)+".jpg")}catch(e){msg("err",L("Could not save.","सेव नहीं हो पाया।"))}
};

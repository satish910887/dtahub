var SETS={u:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",l:"abcdefghijklmnopqrstuvwxyz",n:"0123456789",s:"!@#$%^&*()-_=+[]{};:,.?"};
var AMB="0O1lI|";
var WORDS="able acid acorn actor adapt admit adult agent agree ahead alarm album alert alien alley allow alloy alone alpha alter amber ample angle angry ankle apple apron arena argue armor arrow aside atlas attic audio avoid awake award bacon badge bagel baker balmy banjo barn basil basin batch beach beard beast bench berry bike birch bison black blade blank blast blaze blend bliss block bloom blush board boast bonus boost booth border bottle bounce brain brave bread brick bride brief bright brisk broad bronze brook broom brush bubble bucket buddy buffalo bugle build bulb bunch bunny burst butter cabin cable cactus cadet camel camp canal candle candy canoe canvas canyon cargo carpet carrot carve castle cat cedar cellar chair chalk charm chart cheek cheer chess chest chief child chili choir chunk cider cinema circle city civic clam clap clay clean clerk click cliff climb clinic clock cloud clover clown coach coast cobra cocoa coin comet comic coral corn cosmic cotton couch cove crab craft crane crate crayon cream creek crest crisp crow crown crumb crush crystal cube curry curve cycle daisy dance dandy dart dash dawn deck deer delta denim desert desk diary diner disco ditch diver dizzy dock dodge dolphin donut dove dozen draft dragon drama dream dress drift drill drum duck dune dusk eagle earth easel echo eclipse edge eel eight elbow elder elf elm ember emerald empire empty engine enjoy entry envoy epic equal error essay evening exact exit extra fable fabric face fair falcon fancy farm fawn feast fern ferry fiber field fifty finch fire first fish flag flame flask fleet flint float flock flood floor flour flute foam focus fog forest forge fork fort fox frame fresh frog frost fruit fudge galaxy garden garlic gate gear gecko gem ghost giant ginger giraffe glacier glade glass glider globe glove glow goat gold golf goose grace grain grape grass gravel green grid grove guard guest guide guitar gull habit hair half hammer harbor hare harp harvest hawk hazel heart hedge heron hill hippo hobby holly honey hood hope horizon horse hotel hound house hover humble hurry hut icon igloo image ink inlet iris iron island ivory ivy jacket jade jaguar jam jelly jewel jigsaw jolly journey joy judge juice jungle junior kayak kebab kennel kettle key kind king kiosk kitchen kite kiwi knack knee knight knot koala label lace ladder lagoon lake lamb lamp lantern lapel laser latch laugh lava lawn leaf lemon lens level lilac lily lime linen lion lizard llama lobby lodge loft logic lotus lucky lunar lunch lynx magic mango maple marble market mason meadow medal melon mercy merit meteor mild mint mirror misty model moment monkey moon moose moss motor mount mouse movie muffin mural music mystic nacho napkin navy needle nest night noble noodle north notch novel nugget nutmeg oak oasis ocean olive onion opal opera orange orbit orchid otter oval oven owl oxygen oyster paddle page paint palace palm panda panel paper parade parrot pasta patch peace peach peacock pear pebble pedal pencil penguin pepper piano picnic pigeon pillow pilot pine pioneer pizza planet plaza plum pocket poem polar pond pony poppy porch prairie prism puddle puffin pulse puma pumpkin puppy puzzle quail quartz queen quest quick quiet quill quilt rabbit radar radio rafter rain ranch raven reef relay ribbon ridge river robin robot rocket roof rose rover ruby saddle safari sage sail salad salmon salt sand sapphire satin scarf school scout seal shade shark sheep shell shore signal silk silver sketch skiff slate sleet slope smile snail snow solar spark sphinx spice spider spoon spring spruce square squid stable star stone storm straw stream summit sunny swan sweet swift table tiger timber toast tomato topaz tower trail tulip tunnel turtle twig umbrella unity valley velvet violet voyage walnut wander water wave wheat willow window winter wolf wonder yacht yarn yellow zebra zenith zephyr zinc zone".split(" ");
var mode="pw";
function rnd(n){var lim=Math.floor(4294967296/n)*n,a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=lim);return a[0]%n}
function onePw(){
 var len=+$("len").value,sets=[],pool="",ex=$("ex").checked;
 ["u","l","n","s"].forEach(function(k){if($(k).checked){var t=SETS[k];if(ex)t=t.split("").filter(function(c){return AMB.indexOf(c)<0}).join("");sets.push(t);pool+=t}});
 if(!sets.length)return null;
 var p=[];sets.forEach(function(s){if(p.length<len)p.push(s[rnd(s.length)])});
 while(p.length<len)p.push(pool[rnd(pool.length)]);
 for(var i=p.length-1;i>0;i--){var j=rnd(i+1),t=p[i];p[i]=p[j];p[j]=t}
 return{t:p.join(""),bits:len*Math.log2(pool.length)};
}
function onePh(){
 var n=+$("wc").value,w=[];
 for(var i=0;i<n;i++){var x=WORDS[rnd(WORDS.length)];if($("cap").checked)x=x[0].toUpperCase()+x.slice(1);w.push(x)}
 var bits=n*Math.log2(WORDS.length),t=w.join($("sep").value);
 if($("dg").checked){t+=$("sep").value+rnd(10);bits+=Math.log2(10)}
 return{t:t,bits:bits};
}
function crack(bits){ // 10 billion guesses/second offline, average = half the space
 var sec=Math.pow(2,bits-1)/1e10;
 if(sec<1)return L("instantly","तुरंत");
 var u=[[60,"seconds","सेकंड"],[3600,"minutes","मिनट"],[86400,"hours","घंटे"],[31557600,"days","दिन"],[31557600*1000,"years","साल"]],v=sec,nm=["seconds","सेकंड"];
 if(sec<60)return Math.round(sec)+L(" seconds"," सेकंड");
 if(sec<3600)return Math.round(sec/60)+L(" minutes"," मिनट");
 if(sec<86400)return Math.round(sec/3600)+L(" hours"," घंटे");
 if(sec<31557600)return Math.round(sec/86400)+L(" days"," दिन");
 var y=sec/31557600;if(y<1e3)return Math.round(y)+L(" years"," साल");
 if(y<1e6)return Math.round(y/1e3)+L(" thousand years"," हज़ार साल");
 if(y<1e9)return Math.round(y/1e6)+L(" million years"," मिलियन साल");
 return L("billions of years","अरबों साल");
}
function gen(){
 $("lv").textContent=$("len").value;$("wv").textContent=$("wc").value;
 var f=mode==="pw"?onePw:onePh,r=f();
 if(!r){$("err").hidden=false;$("err").textContent=L("Select at least one option.","कम से कम एक विकल्प चुनें।");$("pw").textContent="";$("st").textContent="";$("ct").textContent="";$("mt").style.width="0";$("bulk").innerHTML="";return}
 $("err").hidden=true;$("pw").textContent=r.t;var bits=r.bits;
 var lbl=bits<40?L("Weak","कमज़ोर"):bits<60?L("Fair","ठीक-ठाक"):bits<80?L("Strong","मज़बूत"):L("Very strong","बहुत मज़बूत");
 $("st").textContent=lbl+" • ~"+Math.round(bits)+" bits";
 $("ct").textContent=L("Time to crack (fast offline attack): ","तोड़ने में समय (तेज़ ऑफलाइन हमला): ")+crack(bits);
 var m=$("mt");m.style.width=Math.min(100,bits/1.28)+"%";m.style.background=bits<40?"#ef4444":bits<60?"#f59e0b":bits<80?"#22c55e":"#10b981";
 var k=+$("bk").value,h="";$("bulk").innerHTML="";
 for(var i=1;i<k;i++){var x=f(),c=document.createElement("code");c.textContent=x.t;c.title=L("Tap to copy","कॉपी के लिए टैप करें");c.onclick=(function(t){return function(){copyText(t)}})(x.t);$("bulk").appendChild(c)}
}
function setMode(m){mode=m;$("m1").classList.toggle("on",m==="pw");$("m2").classList.toggle("on",m==="ph");$("pwo").hidden=m!=="pw";$("ppo").hidden=m!=="ph";gen()}
$("m1").onclick=function(){setMode("pw")};$("m2").onclick=function(){setMode("ph")};
["len","u","l","n","s","ex","wc","sep","cap","dg","bk"].forEach(function(k){$(k).addEventListener("input",gen)});
$("rg").onclick=gen;
$("cp").onclick=function(){copyText($("pw").textContent,$("cp"))};
document.addEventListener("langchange",gen);
gen();

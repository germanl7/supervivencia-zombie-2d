(() => {
"use strict";
const $ = id => document.getElementById(id);
const canvas=$("gameCanvas"),ctx=canvas.getContext("2d");
const menu=$("menuScreen"),game=$("gameScreen"),upgradePanel=$("upgradePanel"),pausePanel=$("pausePanel"),overPanel=$("gameOverPanel");
const W=canvas.width,H=canvas.height;
let running=false,paused=false,last=0,spawnClock=0,shotClock=0,waveClock=0,toastClock=0;
let hero,enemies=[],bullets=[],gems=[],particles=[],coins=0,wave=1,level=1,xp=0,xpNeed=5,kills=0;
let bestWave=Number(localStorage.getItem("ss_bestWave")||0);
const keys=new Set();
const upgrades=[
 {icon:"⚡",name:"Botas veloces",desc:"Muévete más rápido",apply:()=>hero.speed+=35},
 {icon:"💚",name:"Botiquín",desc:"Recupera 35 de vida",apply:()=>hero.hp=Math.min(hero.maxHp,hero.hp+35)},
 {icon:"🔫",name:"Disparo potente",desc:"Más daño por bala",apply:()=>hero.damage+=8},
 {icon:"💨",name:"Disparo rápido",desc:"Dispara con más frecuencia",apply:()=>hero.fireRate=Math.max(.2,hero.fireRate-.12)},
 {icon:"🛡️",name:"Chaleco reforzado",desc:"Aumenta la vida máxima",apply:()=>{hero.maxHp+=20;hero.hp+=20}},
 {icon:"🧲",name:"Imán de gemas",desc:"Atrae experiencia desde más lejos",apply:()=>hero.magnet+=55}
];
function reset(){
 coins=0;wave=1;level=1;xp=0;xpNeed=5;kills=0;spawnClock=0;shotClock=0;waveClock=0;
 hero={x:W/2,y:H/2,r:18,hp:100,maxHp:100,speed:190,damage:22,fireRate:.58,magnet:70,face:1,invuln:0};
 enemies=[];bullets=[];gems=[];particles=[];paused=false;running=true;
 menu.classList.add("hidden");game.classList.remove("hidden");upgradePanel.classList.add("hidden");pausePanel.classList.add("hidden");overPanel.classList.add("hidden");
 updateHud();last=performance.now();requestAnimationFrame(loop);
}
function updateHud(){
 $("wave").textContent=wave;$("waveTop").textContent=wave;$("level").textContent=level;
 $("hpText").textContent=Math.max(0,Math.ceil(hero.hp))+"/"+hero.maxHp;
 $("hpBar").style.width=Math.max(0,hero.hp/hero.maxHp*100)+"%";
 $("coins").textContent=coins;$("coinCount").textContent=coins;$("enemyCount").textContent="Enemigos: "+enemies.length;
}
function announce(msg){const t=$("toast");t.textContent=msg;t.classList.remove("hidden");toastClock=1.6}
function spawnEnemy(){
 const side=Math.floor(Math.random()*4);let x=side===0?-25:side===1?W+25:Math.random()*W,y=side===2?-25:side===3?H+25:Math.random()*H;
 const boss=wave%5===0&&Math.random()<.22;
 const fast=Math.random()<.22;
 enemies.push({x,y,r:boss?28:fast?13:18,hp:(boss?170:fast?28:45)+wave*5,maxHp:(boss?170:fast?28:45)+wave*5,speed:(boss?30:fast?66:42)+wave*1.8,damage:boss?18:fast?7:9,boss,fast,hit:0});
}
function shoot(){
 if(!enemies.length)return;
 let target=null,dist=Infinity;
 for(const e of enemies){const d=Math.hypot(e.x-hero.x,e.y-hero.y);if(d<dist){dist=d;target=e}}
 if(!target)return;
 const a=Math.atan2(target.y-hero.y,target.x-hero.x);
 bullets.push({x:hero.x+Math.cos(a)*18,y:hero.y+Math.sin(a)*18,vx:Math.cos(a)*460,vy:Math.sin(a)*460,r:5,damage:hero.damage,life:1.2});
 hero.face=Math.cos(a)>=0?1:-1;
 particles.push({x:hero.x+Math.cos(a)*20,y:hero.y+Math.sin(a)*20,vx:Math.cos(a)*25,vy:Math.sin(a)*25,life:.12,color:"#ffe78a",r:4});
}
function burst(x,y,color,n=7){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*110;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.4,color,r:2+Math.random()*3})}}
function gainXp(x,y){gems.push({x,y,r:7,value:1});}
function levelUp(){
 level++;xp-=xpNeed;xpNeed=Math.ceil(xpNeed*1.32+1);running=false;upgradePanel.classList.remove("hidden");
 const choices=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);
 $("upgradeChoices").innerHTML="";
 choices.forEach(u=>{const b=document.createElement("button");b.className="upgrade-card";b.innerHTML="<span>"+u.icon+"</span><div><b>"+u.name+"</b><small>"+u.desc+"</small></div>";b.onclick=()=>{u.apply();upgradePanel.classList.add("hidden");running=true;updateHud();last=performance.now();requestAnimationFrame(loop)};$("upgradeChoices").appendChild(b)});
 updateHud();
}
function finish(){running=false;paused=false;bestWave=Math.max(bestWave,wave);localStorage.setItem("ss_bestWave",bestWave);$("resultText").textContent="Llegaste a la oleada "+wave+", derrotaste "+kills+" enemigos y reuniste "+coins+" monedas. Récord: oleada "+bestWave+".";overPanel.classList.remove("hidden");}
function loop(now){
 if(!running||paused)return;
 const dt=Math.min((now-last)/1000,.035);last=now;
 update(dt);draw();if(running&&!paused)requestAnimationFrame(loop);
}
function update(dt){
 waveClock+=dt;spawnClock+=dt;shotClock+=dt;if(hero.invuln>0)hero.invuln-=dt;if(toastClock>0&&--toastClock<=0)$("toast").classList.add("hidden");
 if(waveClock>28){wave++;waveClock=0;announce(wave%5===0?"¡CUIDADO! ¡JEFE EN CAMINO!":"¡OLEADA "+wave+"!");}
 const up=keys.has("w")||keys.has("arrowup"),down=keys.has("s")||keys.has("arrowdown"),left=keys.has("a")||keys.has("arrowleft"),right=keys.has("d")||keys.has("arrowright");
 let dx=(right?1:0)-(left?1:0),dy=(down?1:0)-(up?1:0),len=Math.hypot(dx,dy)||1;
 hero.x=Math.max(hero.r,Math.min(W-hero.r,hero.x+dx/len*hero.speed*dt));hero.y=Math.max(hero.r,Math.min(H-hero.r,hero.y+dy/len*hero.speed*dt));
 if(shotClock>=hero.fireRate){shoot();shotClock=0}
 if(spawnClock>Math.max(.28,1.05-wave*.035)){spawnEnemy();spawnClock=0}
 for(let i=enemies.length-1;i>=0;i--){
  const e=enemies[i],a=Math.atan2(hero.y-e.y,hero.x-e.x),d=Math.hypot(hero.x-e.x,hero.y-e.y);e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt;
  if(d<hero.r+e.r-3&&hero.invuln<=0){hero.hp-=e.damage;hero.invuln=.55;burst(hero.x,hero.y,"#ff7770",5);if(hero.hp<=0){updateHud();finish();return}}
 }
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let remove=b.life<=0||b.x<-20||b.x>W+20||b.y<-20||b.y>H+20;
  for(let j=enemies.length-1;j>=0&&!remove;j--){const e=enemies[j];if(Math.hypot(e.x-b.x,e.y-b.y)<e.r+b.r){e.hp-=b.damage;e.hit=.09;burst(b.x,b.y,"#ffe58a",3);remove=true;if(e.hp<=0){coins+=e.boss?10:e.fast?2:1;kills++;gainXp(e.x,e.y);burst(e.x,e.y,e.boss?"#ff9b62":"#a8db71",e.boss?20:9);if(e.boss)announce("¡JEFE DERROTADO! +10 MONEDAS");enemies.splice(j,1)}break}}
  if(remove)bullets.splice(i,1);
 }
 for(let i=gems.length-1;i>=0;i--){const g=gems[i],d=Math.hypot(hero.x-g.x,hero.y-g.y);if(d<hero.magnet){g.x+=(hero.x-g.x)*Math.min(1,dt*4);g.y+=(hero.y-g.y)*Math.min(1,dt*4)}if(d<hero.r+g.r+4){xp+=g.value;gems.splice(i,1);if(xp>=xpNeed){levelUp();break}}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 updateHud();
}
function draw(){
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle="#315b3e";ctx.fillRect(0,0,W,H);
 ctx.strokeStyle="#ffffff0c";ctx.lineWidth=1;
 for(let x=0;x<W;x+=42){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
 for(let y=0;y<H;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 // patches and tiny plants
 for(let i=0;i<38;i++){const x=(i*173+51)%W,y=(i*97+27)%H;ctx.fillStyle=i%2?"#a6d27817":"#142c1d20";ctx.beginPath();ctx.ellipse(x,y,13,5,i*.5,0,Math.PI*2);ctx.fill()}
 for(const g of gems){ctx.save();ctx.translate(g.x,g.y);ctx.rotate(Math.PI/4);ctx.fillStyle="#77e8ff";ctx.shadowColor="#5fe5ff";ctx.shadowBlur=12;ctx.fillRect(-5,-5,10,10);ctx.restore()}
 for(const b of bullets){ctx.fillStyle="#ffe68a";ctx.shadowColor="#ffe68a";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
 for(const e of enemies){
  ctx.save();ctx.translate(e.x,e.y);
  ctx.fillStyle="#12251a55";ctx.beginPath();ctx.ellipse(2,e.r*.8,e.r*1.1,e.r*.45,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=e.boss?"#9e56b6":e.fast?"#d7bd58":e.hit>0?"#ffe7c0":"#81bd72";
  ctx.beginPath();ctx.arc(0,0,e.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#d9edb8";ctx.beginPath();ctx.arc(-e.r*.35,-e.r*.2,e.r*.23,0,Math.PI*2);ctx.arc(e.r*.35,-e.r*.2,e.r*.23,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#243327";ctx.beginPath();ctx.arc(-e.r*.32,-e.r*.2,e.r*.1,0,Math.PI*2);ctx.arc(e.r*.38,-e.r*.2,e.r*.1,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#243327";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,e.r*.18,e.r*.3,0,Math.PI*.8);ctx.stroke();
  if(e.boss){ctx.fillStyle="#ffcf73";ctx.fillRect(-e.r,-e.r-12,e.r*2,4);ctx.fillStyle="#ff6262";ctx.fillRect(-e.r,-e.r-12,e.r*2*Math.max(0,e.hp/e.maxHp),4)}
  ctx.restore();
 }
 // hero shadow and stylized original survivor
 ctx.save();ctx.translate(hero.x,hero.y);
 ctx.fillStyle="#11271b80";ctx.beginPath();ctx.ellipse(2,13,20,10,0,0,Math.PI*2);ctx.fill();
 if(hero.invuln>0&&Math.floor(performance.now()/70)%2===0)ctx.globalAlpha=.45;
 ctx.fillStyle="#e3bd67";ctx.beginPath();ctx.ellipse(0,4,15,17,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#2d7a4b";ctx.beginPath();ctx.ellipse(0,2,13,15,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#f4dca0";ctx.beginPath();ctx.ellipse(0,-5,11,11,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle="#3b7544";ctx.beginPath();ctx.ellipse(0,-14,15,6,0,0,Math.PI*2);ctx.fill();ctx.fillRect(-10,-19,20,5);
 ctx.fillStyle="#263a29";ctx.beginPath();ctx.arc(-4,-6,1.8,0,Math.PI*2);ctx.arc(4,-6,1.8,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#263a29";ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(3,0);ctx.stroke();
 ctx.fillStyle="#d7a74f";ctx.fillRect(hero.face===1?7:-15,1,8,5);ctx.fillStyle="#4b5142";ctx.fillRect(hero.face===1?13:-20,2,8,3);
 ctx.restore();
 for(const p of particles){ctx.globalAlpha=Math.max(0,p.life*2);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1}
 // progress strip
 ctx.fillStyle="#102519aa";ctx.fillRect(14,H-21,190,8);ctx.fillStyle="#71d9e8";ctx.fillRect(14,H-21,190*Math.min(1,xp/xpNeed),8);
 ctx.fillStyle="#f6f0d8";ctx.font="bold 11px Nunito";ctx.fillText("XP "+xp+" / "+xpNeed,14,H-28);
}
$("playBtn").addEventListener("click",reset);
$("howBtn").addEventListener("click",()=>$("howText").classList.toggle("hidden"));
$("pauseBtn").addEventListener("click",()=>{if(!game.classList.contains("hidden")&&!overPanel.classList.contains("hidden"))return;paused=true;pausePanel.classList.remove("hidden")});
$("resumeBtn").addEventListener("click",()=>{pausePanel.classList.add("hidden");paused=false;last=performance.now();requestAnimationFrame(loop)});
$("quitBtn").addEventListener("click",()=>{running=false;paused=false;game.classList.add("hidden");pausePanel.classList.add("hidden");menu.classList.remove("hidden")});
$("againBtn").addEventListener("click",reset);
$("menuBtn").addEventListener("click",()=>{running=false;game.classList.add("hidden");overPanel.classList.add("hidden");menu.classList.remove("hidden")});
window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();keys.add(k);if(k==="escape"&&running){if(paused){paused=false;pausePanel.classList.add("hidden");last=performance.now();requestAnimationFrame(loop)}else{$("pauseBtn").click()}}});
window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
window.addEventListener("blur",()=>keys.clear());
draw();
})();
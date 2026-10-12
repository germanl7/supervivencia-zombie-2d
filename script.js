(() => {
'use strict';
const $=id=>document.getElementById(id);
const menu=$('menu'),game=$('game'),canvas=$('arena'),ctx=canvas.getContext('2d');
let W=0,H=0,dpr=1,raf=0,last=0,elapsed=0,spawnClock=0,shotClock=0,paused=false,ended=false,levelUpOpen=false,soundOn=false,audio=null;
const MAP_W=6000,MAP_H=6000,TILE=72;
let player,enemies=[],bullets=[],gems=[],particles=[],decos=[],keys={},mobile={up:false,down:false,left:false,right:false};
let coins=0,wave=1,xp=0,level=1,needXP=5,kills=0,health=100,maxHealth=100,damage=24,fireRate=.48,moveSpeed=225,magnet=90,weapon='BLÁSTER IMPROVISADO',bossSpawned=false,highWave=1;
const upgrades=[
 {icon:'✹',name:'Munición pesada',desc:'Aumenta el daño de cada disparo un 30%.',apply:()=>damage*=1.3},
 {icon:'⚡',name:'Gatillo rápido',desc:'Dispara un 22% más seguido.',apply:()=>fireRate=Math.max(.16,fireRate*.78)},
 {icon:'♥',name:'Botiquín de campaña',desc:'Recupera 35 puntos de integridad.',apply:()=>health=Math.min(maxHealth,health+35)},
 {icon:'➤',name:'Botas de escape',desc:'Muévete un 15% más rápido.',apply:()=>moveSpeed*=1.15},
 {icon:'◈',name:'Imán de suministros',desc:'Atrae experiencia desde más lejos.',apply:()=>magnet+=70},
 {icon:'⬡',name:'Blindaje reforzado',desc:'Aumenta tu integridad máxima y la recupera.',apply:()=>{maxHealth+=20;health=Math.min(maxHealth,health+20)}},
 {icon:'◎',name:'Proyectil de pulso',desc:'Potencia de disparo mejorada.',apply:()=>{damage*=1.18;fireRate=Math.max(.17,fireRate*.92)}}
];
function resize(){dpr=Math.min(window.devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
window.addEventListener('resize',resize);resize();
function reset(){elapsed=spawnClock=shotClock=0;paused=ended=levelUpOpen=false;enemies=[];bullets=[];gems=[];particles=[];coins=0;wave=1;xp=0;level=1;needXP=5;kills=0;health=maxHealth=100;damage=24;fireRate=.48;moveSpeed=225;magnet=90;weapon='BLÁSTER IMPROVISADO';bossSpawned=false;keys={};player={x:MAP_W/2,y:MAP_H/2,r:17,hit:0};decos=[];for(let i=0;i<520;i++)decos.push({x:40+Math.random()*(MAP_W-80),y:40+Math.random()*(MAP_H-80),r:3+Math.random()*13,type:Math.random()})}
function start(){menu.classList.add('hidden');game.classList.remove('hidden');resize();reset();$('pauseOverlay').classList.add('hidden');$('upgradeOverlay').classList.add('hidden');$('gameOverOverlay').classList.add('hidden');$('toast').classList.add('hidden');last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);toast('OLEADA 1 — MANTENTE EN MOVIMIENTO')}
function backToMenu(){paused=true;cancelAnimationFrame(raf);game.classList.add('hidden');menu.classList.remove('hidden');$('pauseOverlay').classList.add('hidden');$('upgradeOverlay').classList.add('hidden');$('gameOverOverlay').classList.add('hidden')}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.add('hidden'),1800)}
function togglePause(force){if(ended||levelUpOpen)return;paused=typeof force==='boolean'?force:!paused;$('pauseOverlay').classList.toggle('hidden',!paused);if(!paused){last=performance.now();raf=requestAnimationFrame(loop)}}
function spawnEnemy(boss=false){const side=Math.floor(Math.random()*4),margin=Math.max(W,H)*.58;let x=player.x+(Math.random()-.5)*W,y=player.y+(Math.random()-.5)*H;if(side===0)x=player.x-margin;if(side===1)x=player.x+margin;if(side===2)y=player.y-margin;if(side===3)y=player.y+margin;x=Math.max(24,Math.min(MAP_W-24,x));y=Math.max(24,Math.min(MAP_H-24,y));const hp=(boss?460:34+wave*7)*(1+Math.min(wave,20)*.04);enemies.push({x,y,r:boss?31:12+Math.random()*5,hp,maxHp:hp,speed:(boss?28:35+Math.random()*22)+Math.min(wave,18)*1.4,damage:boss?24:8+Math.min(wave,10),boss,hit:0,phase:Math.random()*6.28})}
function nearest(){let best=null,bd=Infinity;for(const e of enemies){const d=Math.hypot(e.x-player.x,e.y-player.y);if(d<bd){bd=d;best=e}}return best}
function shoot(){const e=nearest();if(!e)return;const a=Math.atan2(e.y-player.y,e.x-player.x);bullets.push({x:player.x+Math.cos(a)*20,y:player.y+Math.sin(a)*20,vx:Math.cos(a)*540,vy:Math.sin(a)*540,r:5,life:1.1,damage,trail:[]});burst(player.x+Math.cos(a)*20,player.y+Math.sin(a)*20,'#d7ff69',2)}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=30+Math.random()*130;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.2+Math.random()*.45,max:.65,color,r:1+Math.random()*3})}}
function gainXP(n){xp+=n;while(xp>=needXP){xp-=needXP;level++;needXP=Math.ceil(needXP*1.28+2);showUpgrades()}}
function showUpgrades(){if(ended)return;paused=true;levelUpOpen=true;$('upgradeOverlay').classList.remove('hidden');const shuffled=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);$('upgradeCards').innerHTML='';shuffled.forEach(u=>{const b=document.createElement('button');b.className='upgrade-card';b.innerHTML='<div class="upgrade-icon">'+u.icon+'</div><h3>'+u.name+'</h3><p>'+u.desc+'</p>';b.addEventListener('click',()=>{u.apply();levelUpOpen=false;$('upgradeOverlay').classList.add('hidden');updateHud();toast('MEJORA INSTALADA: '+u.name.toUpperCase());paused=false;last=performance.now();raf=requestAnimationFrame(loop)});$('upgradeCards').appendChild(b)});updateHud()}
function update(dt){elapsed+=dt;spawnClock+=dt;shotClock+=dt;const nextWave=1+Math.floor(elapsed/25);if(nextWave>wave){wave=nextWave;bossSpawned=false;toast('OLEADA '+wave+' — ¡SE ACERCA MÁS INFESTACIÓN!')}if(spawnClock>(Math.max(.34,1.05-wave*.045))){spawnClock=0;spawnEnemy(false);if(wave%4===0&&!bossSpawned&&elapsed%25<2){spawnEnemy(true);bossSpawned=true;toast('⚠ JEFE DETECTADO — PREPÁRATE')}}
let dx=(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0)+(mobile.right?1:0)-(mobile.left?1:0),dy=(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0)+(mobile.down?1:0)-(mobile.up?1:0);const len=Math.hypot(dx,dy)||1;player.x=Math.max(22,Math.min(MAP_W-22,player.x+dx/len*moveSpeed*dt));player.y=Math.max(22,Math.min(MAP_H-22,player.y+dy/len*moveSpeed*dt));player.hit=Math.max(0,player.hit-dt);
if(shotClock>=fireRate){shotClock=0;shoot()}
for(let i=enemies.length-1;i>=0;i--){const e=enemies[i],a=Math.atan2(player.y-e.y,player.x-e.x),d=Math.hypot(player.x-e.x,player.y-e.y);e.phase+=dt*3;e.hit=Math.max(0,e.hit-dt);if(d>player.r+e.r-2){e.x+=Math.cos(a)*e.speed*dt;e.y+=Math.sin(a)*e.speed*dt}if(d<player.r+e.r&&player.hit<=0){health-=e.damage;player.hit=.65;burst(player.x,player.y,'#ff624f',9);if(health<=0){health=0;gameOver();return}}}
for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let gone=b.life<=0||b.x<-20||b.x>W+20||b.y<-20||b.y>H+20;for(let j=enemies.length-1;j>=0&&!gone;j--){const e=enemies[j];if(Math.hypot(e.x-b.x,e.y-b.y)<e.r+b.r){e.hp-=b.damage;e.hit=.09;burst(b.x,b.y,'#d7ff69',3);gone=true;if(e.hp<=0){enemies.splice(j,1);kills++;coins+=e.boss?12:1+Math.floor(Math.random()*3);gems.push({x:e.x,y:e.y,r:e.boss?9:6,value:e.boss?5:1,phase:Math.random()*6});burst(e.x,e.y,e.boss?'#ff624f':'#9dbd70',e.boss?24:9);if(e.boss){coins+=15;toast('JEFE DERROTADO · +15 MONEDAS')}}}}if(gone)bullets.splice(i,1)}
for(let i=gems.length-1;i>=0;i--){const g=gems[i],d=Math.hypot(player.x-g.x,player.y-g.y);if(d<magnet||d<player.r+g.r){const a=Math.atan2(player.y-g.y,player.x-g.x),speed=d<player.r+g.r?360:Math.max(100,350*(1-d/(magnet+1)));g.x+=Math.cos(a)*speed*dt;g.y+=Math.sin(a)*speed*dt}if(d<player.r+g.r+4){gainXP(g.value);gems.splice(i,1);burst(g.x,g.y,'#80dfff',4)}}
for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
updateHud()}
function updateHud(){$('wave').textContent=String(wave).padStart(2,'0');$('waveLabel').textContent=wave%4===0?'JEFE EN LA ZONA':'INFESTACIÓN';$('kills').textContent=kills;$('coins').textContent=coins;$('level').textContent=level;$('healthText').textContent=Math.ceil(health)+' / '+maxHealth;$('healthBar').style.width=(health/maxHealth*100)+'%';$('xpText').textContent=xp+' / '+needXP;$('xpBar').style.width=(xp/needXP*100)+'%';$('weaponName').textContent=weapon}
function gameOver(){ended=true;paused=true;cancelAnimationFrame(raf);$('finalStats').textContent='Oleada '+wave+' · '+kills+' infectados neutralizados · '+coins+' monedas recuperadas · nivel '+level;$('gameOverOverlay').classList.remove('hidden')}
function roundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawFloor(){
 const camX=player.x-W/2,camY=player.y-H/2;
 // Piso piedra gris neutro: sin verde neón ni cuadriculado brillante.
 ctx.fillStyle='#51524d';ctx.fillRect(0,0,W,H);
 const tile=120,ox=-(camX%tile),oy=-(camY%tile);
 for(let y=oy-tile;y<H+tile;y+=tile)for(let x=ox-tile;x<W+tile;x+=tile){
  const wx=x+camX,wy=y+camY,alt=(Math.floor(wx/tile)+Math.floor(wy/tile))%2===0;
  ctx.fillStyle=alt?'#555650':'#50514c';ctx.fillRect(x,y,tile-2,tile-2);
  ctx.strokeStyle='#5c5d57';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,tile-2,tile-2);
 }
 // Avenidas anchas, con marcas discretas para que se note que el mundo es grande.
 ctx.fillStyle='#41423d';
 for(let road=900;road<MAP_W;road+=1200){const sx=road-camX,sy=road-camY;ctx.fillRect(sx-90,0,180,H);ctx.fillRect(0,sy-76,W,152)}
 ctx.strokeStyle='#686960';ctx.lineWidth=2;ctx.setLineDash([30,34]);
 for(let road=900;road<MAP_W;road+=1200){const sx=road-camX,sy=road-camY;ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,sy);ctx.lineTo(W,sy);ctx.stroke()}
 ctx.setLineDash([]);
 for(const d of decos){const x=d.x-camX,y=d.y-camY;if(x<-40||x>W+40||y<-40||y>H+40)continue;
  if(d.type<.42){ctx.fillStyle='#393a35';ctx.beginPath();ctx.ellipse(x,y,d.r*1.5,d.r*.85,Math.sin(d.type*30),0,Math.PI*2);ctx.fill();ctx.strokeStyle='#686960';ctx.stroke()}
  else if(d.type<.72){ctx.fillStyle='#696a62';ctx.fillRect(x-7,y-6,15,12);ctx.fillStyle='#77786f';ctx.fillRect(x-4,y-8,8,3)}
  else{ctx.strokeStyle='#73746b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-6,y-6);ctx.lineTo(x+6,y+6);ctx.moveTo(x+6,y-6);ctx.lineTo(x-6,y+6);ctx.stroke()}
 }
 ctx.strokeStyle='#b4b5a8';ctx.lineWidth=7;ctx.strokeRect(-camX,-camY,MAP_W,MAP_H);
 const vignette=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.78);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#17181430');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function drawMiniMap(){
 const mw=132,mh=132,x=W-mw-18,y=82,scale=(mw-14)/MAP_W;
 ctx.save();ctx.fillStyle='#20211dcc';ctx.fillRect(x,y,mw,mh);ctx.strokeStyle='#b8b9ad';ctx.lineWidth=1.5;ctx.strokeRect(x,y,mw,mh);
 ctx.fillStyle='#41423d';for(let road=900;road<MAP_W;road+=1200){const p=7+road*scale;ctx.fillRect(p-1,y+7,2,mh-14);ctx.fillRect(x+7,p-1,mw-14,2)}
 ctx.fillStyle='#c7c8bc';for(const d of decos){const px=x+7+d.x*scale,py=y+7+d.y*scale;ctx.fillRect(px,py,1.4,1.4)}
 ctx.fillStyle='#ff7465';for(const e of enemies){ctx.beginPath();ctx.arc(x+7+e.x*scale,y+7+e.y*scale,e.boss?3:1.6,0,Math.PI*2);ctx.fill()}
 ctx.fillStyle='#d7ff69';ctx.shadowColor='#d7ff69';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(x+7+player.x*scale,y+7+player.y*scale,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle='#f1f0e7';ctx.font='800 9px Inter';ctx.fillText('MAPA 6 × 6 KM',x+8,y+mh+13);ctx.restore();
}
function drawEnemy(e){const x=W/2+(e.x-player.x),y=H/2+(e.y-player.y),bob=Math.sin(e.phase)*2;ctx.save();ctx.translate(x,y+bob);ctx.fillStyle='#0c100b77';ctx.beginPath();ctx.ellipse(3,e.r*.7,e.r*1.25,e.r*.65,0,0,Math.PI*2);ctx.fill();if(e.boss){ctx.shadowColor='#ff624f';ctx.shadowBlur=20;ctx.fillStyle='#4e2824';ctx.beginPath();ctx.arc(0,0,e.r+3,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#ff8069';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#8e4939';ctx.beginPath();ctx.arc(0,0,e.r-5,0,Math.PI*2);ctx.fill()}else{ctx.fillStyle=e.hit?'#f5ffd9':'#607f43';ctx.beginPath();ctx.ellipse(0,2,e.r*.8,e.r,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9cbb67';ctx.beginPath();ctx.arc(-2,-e.r*.48,e.r*.65,0,Math.PI*2);ctx.fill();ctx.fillStyle='#202c1c';ctx.fillRect(-e.r*.5,-e.r*.55,4,3);ctx.fillRect(e.r*.2,-e.r*.55,4,3);ctx.fillStyle='#d7ff69';ctx.fillRect(-e.r*.42,-e.r*.52,2,2);ctx.fillRect(e.r*.28,-e.r*.52,2,2);ctx.strokeStyle='#32482b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-e.r*.6,0);ctx.lineTo(-e.r-4,5);ctx.moveTo(e.r*.6,0);ctx.lineTo(e.r+4,3);ctx.stroke()}if(e.boss||e.hp<e.maxHp){const bw=e.boss?65:34;ctx.fillStyle='#10140e';ctx.fillRect(-bw/2,-e.r-13,bw,4);ctx.fillStyle=e.boss?'#ff624f':'#d7ff69';ctx.fillRect(-bw/2,-e.r-13,bw*Math.max(0,e.hp/e.maxHp),4)}ctx.restore()}
function drawPlayer(){const x=W/2,y=H/2;ctx.save();ctx.translate(x,y);ctx.fillStyle='#0a0d0977';ctx.beginPath();ctx.ellipse(3,16,19,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#405a30';roundRect(-15,-12,30,34,9);ctx.fill();ctx.strokeStyle='#8aaa53';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#d7ff69';roundRect(-11,-9,22,12,4);ctx.fill();ctx.fillStyle='#d9ae7e';ctx.beginPath();ctx.arc(0,-17,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#303b25';ctx.beginPath();ctx.arc(0,-21,12,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-12,-21,24,5);ctx.fillStyle='#eaf5cf';ctx.fillRect(-6,-17,4,3);ctx.fillRect(3,-17,4,3);const e=nearest();if(e){const a=Math.atan2(e.y-player.y,e.x-player.x);ctx.rotate(a);ctx.fillStyle='#1b2119';roundRect(8,-4,24,9,3);ctx.fill();ctx.fillStyle='#a7bd7d';ctx.fillRect(23,-2,12,4);ctx.fillStyle='#d7ff69';ctx.fillRect(33,-1,5,2)}ctx.restore();if(player.hit>0){ctx.strokeStyle='#ff624f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,28,0,Math.PI*2);ctx.stroke()}}
function draw(){drawFloor();for(const g of gems){const x=W/2+g.x-player.x,y=H/2+g.y-player.y;ctx.save();ctx.translate(x,y);ctx.rotate(performance.now()/400+g.phase);ctx.fillStyle='#74d8ff';ctx.shadowColor='#74d8ff';ctx.shadowBlur=12;ctx.beginPath();ctx.moveTo(0,-g.r);ctx.lineTo(g.r*.8,0);ctx.lineTo(0,g.r);ctx.lineTo(-g.r*.8,0);ctx.closePath();ctx.fill();ctx.restore()}for(const b of bullets){const x=W/2+b.x-player.x,y=H/2+b.y-player.y;ctx.fillStyle='#d7ff69';ctx.shadowColor='#d7ff69';ctx.shadowBlur=13;ctx.beginPath();ctx.arc(x,y,b.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}for(const e of enemies)drawEnemy(e);drawPlayer();for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/.65);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(W/2+p.x-player.x,H/2+p.y-player.y,p.r,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;const count=enemies.length;ctx.fillStyle='#d9e4c2';ctx.font='800 10px Inter';ctx.fillText('INFECTADOS EN ZONA: '+count,20,H-68);drawMiniMap()}
function loop(now){if(paused||ended)return;const dt=Math.min(.035,(now-last)/1000||0);last=now;update(dt);draw();if(!paused&&!ended)raf=requestAnimationFrame(loop)}
document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys[e.key]=true;if(e.key===' '&&!menu.classList.contains('hidden'))return;if(e.key===' '&&!game.classList.contains('hidden'))togglePause();if(e.key==='Escape'&&!game.classList.contains('hidden'))togglePause()});
document.addEventListener('keyup',e=>keys[e.key]=false);
$('startBtn').addEventListener('click',start);$('retryBtn').addEventListener('click',start);$('menuBtn').addEventListener('click',backToMenu);$('overMenuBtn').addEventListener('click',backToMenu);$('pauseMenuBtn').addEventListener('click',backToMenu);$('pauseBtn').addEventListener('click',()=>togglePause());$('resumeBtn').addEventListener('click',()=>togglePause(false));$('howBtn').addEventListener('click',()=>$('controlsHint').classList.toggle('hidden'));
$('soundMenu').addEventListener('click',()=>{soundOn=!soundOn;$('soundMenu').innerHTML=soundOn?'♫ <span>ACTIVO</span>':'♫ <span>SONIDO</span>';if(soundOn){try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume()}catch(_){}}});
document.querySelectorAll('[data-move]').forEach(b=>{const k=b.dataset.move;const down=e=>{e.preventDefault();mobile[k]=true};const up=e=>{e.preventDefault();mobile[k]=false};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)});
updateHud();
})();
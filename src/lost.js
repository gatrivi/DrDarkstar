import { LostWorld, TILE, WIDTH, HEIGHT, WOODLAND_PLATFORMS, MEMORIES } from './game/lost/World.js';
import { prepareFoliage, SCENERY, GROUND_COVER } from './game/lost/Foliage.js';
import { loadImage } from './game/night/Atlas.js';

export const world = new LostWorld();
const canvas = document.querySelector('#lost-game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const held = new Set(), pressed = new Set(), keyboard = new Set(), pointers = new Map();
let paused = false, mapVisible = false, ready = false, tiles, poses, foliage, last = 0, accumulator = 0, cameraX = 0, cameraY = 65;
const ZONES = ['01 / THE ROOT GATE', '02 / THE SUNKEN ENGINE', '03 / THE MEMORY VAULT'];
const keyMap = { KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyS:'down',ArrowDown:'down',Space:'jump',KeyW:'jump',ArrowUp:'jump',KeyJ:'whip',KeyE:'interact' };
function syncHeld() { held.clear(); for (const code of keyboard) held.add(keyMap[code]); for (const key of pointers.values()) held.add(key); }
function clearInput() { held.clear(); pressed.clear(); keyboard.clear(); pointers.clear(); }
function setPause(value) { paused = value; clearInput(); $('pause').textContent = paused ? 'RESUME' : 'PAUSE'; }
function toggleMap() { mapVisible = !mapVisible; $('map').setAttribute('aria-pressed', String(mapVisible)); }
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
  if (keyMap[e.code]) { e.preventDefault(); if (!e.repeat) pressed.add(keyMap[e.code]); keyboard.add(e.code); syncHeld(); }
  if (!e.repeat && e.code === 'KeyP') setPause(!paused);
  if (!e.repeat && e.code === 'KeyM') toggleMap();
  if (e.code === 'Escape') location.href = './games.html';
});
window.addEventListener('keyup', e => { keyboard.delete(e.code); syncHeld(); });
window.addEventListener('blur', () => { if (ready) setPause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && ready) setPause(true); });
$('pause').onclick = () => { setPause(!paused); canvas.focus({preventScroll:true}); };
$('map').onclick = () => { toggleMap(); canvas.focus({preventScroll:true}); };
$('restart').onclick = () => { world.reset(); cameraX = 0; cameraY = 65; setPause(false); canvas.focus({preventScroll:true}); };
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', e => {
    e.preventDefault(); button.setPointerCapture(e.pointerId); canvas.focus({preventScroll:true});
    pointers.set(e.pointerId, button.dataset.key); pressed.add(button.dataset.key); syncHeld();
  });
  const release = e => { pointers.delete(e.pointerId); syncHeld(); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}

function prepareTiles(image) {
  // Generated rows are slightly irregular. Trim the painted dividers explicitly.
  const xs = [0, 314, 628, 941, 1254], ys = [0, 313, 628, 918, 1254];
  return Array.from({ length: 16 }, (_, i) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const x = i % 4, y = Math.floor(i / 4), sx = image.width / 1254, sy = image.height / 1254;
    g.drawImage(image, (xs[x] + 3) * sx, (ys[y] + 3) * sy, (xs[x + 1] - xs[x] - 6) * sx, (ys[y + 1] - ys[y] - 6) * sy, 0, 0, 64, 64);
    return c;
  });
}
function preparePoses(image) {
  // Individual bounds and foot anchors preserve crouch height and body scale.
  const crops = [
    [65,30,170,296,150,322], [368,32,205,296,465,322], [671,35,222,293,777,322], [961,80,278,248,1100,322],
    [45,336,222,297,150,628], [343,410,240,223,465,628], [699,460,169,173,781,628], [976,460,222,173,1095,628],
    [32,636,205,298,135,928], [288,682,325,251,409,928], [610,720,390,214,739,928], [1020,680,233,254,1118,928],
    [36,1067,365,168,142,1218], [394,937,256,290,485,1218], [672,978,215,247,777,1218], [1017,971,203,254,1125,1218],
  ];
  return crops.map(([sx,sy,sw,sh,ax,ay]) => {
    const c = document.createElement('canvas'); c.width = 180; c.height = 90;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(image,sx,sy,sw,sh,70+(sx-ax)*.19,83+(sy-ay)*.19,sw*.19,sh*.19);
    return c;
  });
}
function tile(id,x,y,w=TILE,h=w) { ctx.drawImage(tiles[id],Math.round(x),Math.round(y),w,h); }
function prop(name,x,y,w,h) {
  if(x+w<cameraX-20||x>cameraX+980)return;
  ctx.drawImage(foliage[name],Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
function label(text,x,y,color='#b6b88f',size=10) { ctx.font=`${size}px "Courier New", monospace`;ctx.fillStyle=color;ctx.fillText(text,Math.round(x),Math.round(y)); }
function drawBackdrop() {
  ctx.fillStyle='#071719'; ctx.fillRect(0,0,960,540);
  // The same atlas supplies distant architecture, midground walls and foreground.
  ctx.globalAlpha=.37;
  const start = Math.floor(cameraX*.25/384)*384;
  for(let x=start;x<cameraX*.25+1344;x+=384) tile(13,x-cameraX*.25,15-cameraY*.14,384,384);
  ctx.globalAlpha=.42;
  for(let x=Math.floor(cameraX*.38/277)*277-277;x<cameraX*.38+1100;x+=277) {
    ctx.drawImage(foliage.distant,Math.round(x-cameraX*.38),Math.round(110-cameraY*.25),252,346);
  }
  ctx.globalAlpha=.2;
  for(let x=Math.floor(cameraX*.6/96)*96;x<cameraX*.6+1056;x+=96) {
    if(Math.floor(x/96)%4===0) tile(6,x-cameraX*.6,165-cameraY*.4,64,288);
    else for(let y=260;y<452;y+=96) tile(4,x-cameraX*.6,y-cameraY*.4,96,96);
    tile(12,x-cameraX*.6,410-cameraY*.4,96,128);
  }
  ctx.globalAlpha=1;
  // Subtle floating spores, frozen with the simulation when paused.
  ctx.fillStyle='#8ab49d';
  for(let i=0;i<45;i++) {
    const x=((i*157+Math.sin(world.time*.3+i)*18-cameraX*.12)%1000+1000)%1000;
    const y=((i*71-world.time*(3+i%3))%540+540)%540;
    ctx.globalAlpha=.12+(i%3)*.08;ctx.fillRect(x,y,1+(i%2),1);
  }
  ctx.globalAlpha=1;
}
function drawScene() {
  drawBackdrop();ctx.save();ctx.translate(-Math.round(cameraX),-Math.round(cameraY));
  ctx.globalAlpha=.86;
  for(const item of SCENERY)prop(...item);
  ctx.globalAlpha=1;
  for(const x of [480,1888,3072]) { tile(14,x-40,400,80,96);label('E · READ',x-27,392); }
  for(const [x,y] of [[64,448],[1152,448],[2304,448]]) {
    tile(6,x,y,32,64);ctx.fillStyle='#8affe0';ctx.fillRect(x+14,y+8,4,15);
  }
  const first=Math.max(0,Math.floor(cameraX/TILE)),end=Math.min(110,Math.ceil((cameraX+960)/TILE));
  for(let r=0;r<20;r++) for(let c=first;c<end;c++) if(world.tiles[r][c]>=0) tile(world.tiles[r][c],c*TILE,r*TILE);
  for(let c=59;c<62;c++) { tile(15,c*TILE,560,32,80); }
  for(const platform of WOODLAND_PLATFORMS)prop(platform.art,...platform.bounds);
  for(const memory of MEMORIES) {
    const found=world.memories.has(memory.id), y=memory.y-27;
    ctx.fillStyle=found?'#9eb781':'#c9fce0';
    ctx.globalAlpha=found?.6:.75+.2*Math.sin(world.time*2);
    ctx.fillRect(memory.x-2,y-2,4,4);ctx.globalAlpha=1;
    const close=Math.abs(world.player.x-memory.x)<80&&Math.abs(world.player.y-memory.y)<55;
    if(close)label(found?'E · REMEMBER':'E · LISTEN',memory.x-28,y-12,'#c4deac',9);
  }
  for(const relay of world.relays) {
    tile(relay.on?11:10,relay.x-25,relay.y-25,50,50);
    if(relay.on) {ctx.globalAlpha=.1+.04*Math.sin(world.time*3);ctx.fillStyle='#74ffe0';ctx.fillRect(relay.x-29,relay.y-29,58,58);ctx.globalAlpha=1;}
    label(relay.on?'AWAKE':'J · WHIP',relay.x-23,relay.y-34,relay.on?'#7dfbd9':'#b6b88f',9);
  }
  tile(world.powered===3?9:8,104*TILE,12*TILE,96,128);
  label(world.powered===3?'E · ENTER':'THE ARCHIVE',104*TILE,12*TILE-12);
  label('S / ↓ · CROUCH',23*TILE,11*TILE-13);
  label('↑ FOLLOW THE CONDUITS',37*TILE,420);
  label('↑ THE LAST RELAY',73*TILE,420);
  const p=world.player;
  let pose=p.crouch?(p.vx?7:6):!p.grounded?(p.vy<0?4:5):p.vx?(Math.floor(world.time*8)%2+1):0;
  if(p.attack>0) pose=p.crouch?12:[8,9,10,11][Math.min(3,Math.floor((.42-p.attack)/.105))];
  ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(p.facing,1);
  ctx.fillStyle='#020a0b66';ctx.beginPath();ctx.ellipse(0,1,19,3,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(poses[pose],-70,-83);
  // A thin live extension makes the gameplay reach legible beyond the source cel.
  if(p.attack>0&&p.attack<.29&&p.attack>.1) {
    const y=p.crouch?-16:-32,phase=(.29-p.attack)/.19;
    ctx.beginPath();ctx.moveTo(15,y);ctx.bezierCurveTo(55,y-20*Math.sin(phase*5),100,y+14,136,y);
    ctx.strokeStyle='#20d6ca88';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#c7ffef';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.restore();
  for(const item of GROUND_COVER) {
    const [,x,,w]=item;
    ctx.globalAlpha=world.player.x>x-12&&world.player.x<x+w+12?.35:.9;
    prop(...item);
  }
  ctx.globalAlpha=1;ctx.restore();
  // Delicate shade at the frame edge, leaving terrain and silhouette readable.
  const shade=ctx.createLinearGradient(0,0,0,540);shade.addColorStop(0,'#01080888');shade.addColorStop(.22,'#01080800');shade.addColorStop(.83,'#01080800');shade.addColorStop(1,'#01080888');ctx.fillStyle=shade;ctx.fillRect(0,0,960,540);
  if(mapVisible) drawMap();
  if(paused||world.complete) {
    ctx.fillStyle='#04110fde';ctx.fillRect(0,0,960,540);ctx.textAlign='center';
    label(world.complete?'THE ARCHIVE REMEMBERS':'EXPEDITION PAUSED',480,235,'#e1e7cc',26);
    label(world.complete?'Three relays. One recovered memory.':'P or RESUME to return to the ruins.',480,273,'#a0c4ad',14);
    if(world.complete)label('NEW EXPEDITION to explore again.',480,307,'#82b99f',12);
    ctx.textAlign='left';
  }
}
function drawMap() {
  const scale=.23,ox=75,oy=25;
  ctx.fillStyle='#04110ff2';ctx.fillRect(55,10,850,183);
  label('THE ROOT ARCHIVE / EXPEDITION MAP',75,30,'#c7d3ab');
  for(let r=0;r<20;r++)for(let c=0;c<110;c++)if(world.tiles[r][c]>=0){ctx.fillStyle='#637158';ctx.fillRect(ox+c*TILE*scale,oy+18+r*TILE*scale,7.4,7.4);}
  ctx.fillStyle='#acd086';
  for(const p of WOODLAND_PLATFORMS)ctx.fillRect(ox+p.x*scale,oy+18+p.y*scale,p.w*scale,2);
  for(const m of MEMORIES){ctx.fillStyle=world.memories.has(m.id)?'#637158':'#f0df9c';ctx.fillRect(ox+m.x*scale-2,oy+18+(m.y-28)*scale,4,4);}
  for(const relay of world.relays){ctx.fillStyle=relay.on?'#7fffe0':'#d6a55b';ctx.fillRect(ox+relay.x*scale-3,oy+18+relay.y*scale-3,6,6);}
  ctx.fillStyle='#fff6d3';ctx.fillRect(ox+world.player.x*scale-2,oy+18+world.player.y*scale-7,4,7);
}
function updateUI() {
  const zone=Math.min(2,Math.floor(world.player.x/1152));
  $('zone').textContent=ZONES[zone];$('relays').textContent=`RELAYS ${world.powered} / 3`;
  $('memories').textContent=`MEMORIES ${world.memories.size} / ${MEMORIES.length}`;
  const message=world.messageTime>0?world.message:'Explore the ruins. J awakens relays · E reads engraved walls · M shows the map.';
  if($('status').textContent!==message)$('status').textContent=message;
}
export function step(dt, input) { world.update(dt,input); }
function frame(now) {
  const dt=Math.min((now-last)/1000||0,.05);last=now;
  if(ready) {
    if(!paused) {
      accumulator+=dt;
      while(accumulator>=1/60){world.update(1/60,{left:held.has('left'),right:held.has('right'),down:held.has('down'),jump:pressed.has('jump'),whip:pressed.has('whip'),interact:pressed.has('interact')});pressed.clear();accumulator-=1/60;}
      cameraX+=(Math.max(0,Math.min(WIDTH-960,world.player.x-350))-cameraX)*Math.min(1,dt*6);
      cameraY+=(Math.max(0,Math.min(HEIGHT-540,world.player.y-400))-cameraY)*Math.min(1,dt*4);
    }
    drawScene();updateUI();
  }
  requestAnimationFrame(frame);
}
try {
  const [terrain,hunter,plants]=await Promise.all([loadImage(new URL('../assets/lost-area/tileset-v1.png',import.meta.url)),loadImage(new URL('../assets/night-hunters/relic-hunter/relic-hunter-spritesheet-v1.png',import.meta.url)),loadImage(new URL('../assets/lost-area/foliage-props-v1.png',import.meta.url))]);
  tiles=prepareTiles(terrain);poses=preparePoses(hunter);foliage=prepareFoliage(plants);ctx.imageSmoothingEnabled=false;
  ready=true;$('loading').hidden=true;canvas.focus({preventScroll:true});updateUI();requestAnimationFrame(frame);
} catch(error) {$('loading').textContent='The artwork could not load. Reload to try again.';$('status').textContent=error.message;console.error(error);}

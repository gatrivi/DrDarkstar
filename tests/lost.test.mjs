import test from 'node:test';
import assert from 'node:assert/strict';
import { LostWorld } from '../src/game/lost/World.js';

function tick(w,n,keys={}) { for(let i=0;i<n;i++)w.update(1/60,{...keys,jump:keys.jump&&i===0,whip:keys.whip&&i===0,interact:keys.interact&&i===0}); }
function walk(w,x,down=false) {
  for(let i=0;i<1500&&Math.abs(w.player.x-x)>3;i++)w.update(1/60,{right:w.player.x<x,left:w.player.x>x,down});
  assert.ok(Math.abs(w.player.x-x)<=3,`reach x ${x}, got ${w.player.x}, y ${w.player.y}`);
}
function hop(w,x) { tick(w,37,{right:true,jump:true});walk(w,x);tick(w,25); }

test('complete expedition is traversable from spawn with ordinary movement',()=>{
  const w=new LostWorld();
  walk(w,560);tick(w,30,{whip:true});assert.equal(w.powered,1);
  walk(w,720);walk(w,970,true);walk(w,1138);tick(w,10);
  hop(w,1265);assert.equal(w.player.y,448);
  walk(w,1300);hop(w,1425);assert.equal(w.player.y,384);
  walk(w,1460);hop(w,1590);assert.equal(w.player.y,320);
  tick(w,30,{whip:true});assert.equal(w.powered,2);
  walk(w,1808);tick(w,70);hop(w,1925);assert.equal(w.player.y,448);
  walk(w,2050);tick(w,70);walk(w,2290);
  hop(w,2420);assert.equal(w.player.y,448);
  walk(w,2452);hop(w,2575);assert.equal(w.player.y,384);
  walk(w,2612);hop(w,2730);assert.equal(w.player.y,320);
  tick(w,30,{whip:true});assert.equal(w.powered,3);
  walk(w,3360);tick(w,90);tick(w,1,{interact:true});assert.equal(w.complete,true);
});

test('low tunnel blocks standing and prevents uncrouching beneath its ceiling',()=>{
  const w=new LostWorld();w.player.x=710;
  tick(w,60,{right:true});assert.ok(w.player.x<=725);
  tick(w,100,{right:true,down:true});assert.ok(w.player.x>800);
  tick(w,1);assert.equal(w.player.crouch,true);assert.equal(w.blocked(w.body()),false);
  walk(w,985,true);tick(w,1);assert.equal(w.player.crouch,false);
});

test('whip respects facing, height and solid walls; relays activate once',()=>{
  const w=new LostWorld();w.player.x=560;w.player.facing=-1;
  tick(w,30,{whip:true});assert.equal(w.powered,0);
  w.player.facing=1;w.relays[0].y=350;tick(w,30,{whip:true});assert.equal(w.powered,0);
  w.relays[0].y=480;w.tiles[14][19]=2;w.tiles[15][19]=2;
  tick(w,30,{whip:true});assert.equal(w.powered,0);
  w.tiles[14][19]=-1;w.tiles[15][19]=-1;
  tick(w,30,{whip:true});tick(w,30,{whip:true});assert.equal(w.powered,1);
});

test('water returns to a beacon without clearing relays, and sealed archive stays locked',()=>{
  const w=new LostWorld();w.relays[0].on=true;w.player.x=1940;w.player.y=650;
  tick(w,90);assert.equal(w.player.x,112);assert.equal(w.powered,1);
  w.player.x=3310;tick(w,60,{right:true});assert.ok(w.player.x<=3317);
  tick(w,1,{interact:true});assert.equal(w.complete,false);
});

test('woodland route reaches the canopy memory, which cannot be read from below',()=>{
  const w=new LostWorld();walk(w,549);tick(w,1,{interact:true});assert.equal(w.memories.size,0);
  walk(w,244);hop(w,369);assert.equal(w.player.y,448);
  walk(w,418);hop(w,549);assert.equal(w.player.y,384);
  tick(w,1,{interact:true});assert.ok(w.memories.has('canopy'));
  tick(w,1,{interact:true});assert.equal(w.memories.size,1);
  walk(w,660);tick(w,70);assert.equal(w.player.y,512);
  w.respawn();assert.equal(w.memories.size,1);
  w.reset();assert.equal(w.memories.size,0);
});

test('log platforms allow jumping from below and catch falling feet',()=>{
  const w=new LostWorld();w.player.x=355;
  tick(w,13,{jump:true});assert.ok(w.player.y<448);
  tick(w,55);assert.equal(w.player.y,448);assert.equal(w.player.grounded,true);
  walk(w,459);tick(w,60);assert.equal(w.player.y,512);
});

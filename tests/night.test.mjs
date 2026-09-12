import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_MOVES, hitTarget, blockHit, projectileSweep, overlaps } from '../src/game/night/Combat.js';
import { NightFighter } from '../src/game/night/NightFighter.js';

const attacker = { team: 'hunter', facing: 1 };
const target = extra => ({ team:'hostile', percent:0, invulnerable:0, respawnTimer:0, dead:false, action:null, ...extra });
test('damage launches enemies and charged hits increase damage and knockback', () => {
  const a=target(),b=target();
  assert.ok(hitTarget(attacker,a,NIGHT_MOVES.golfswing));
  assert.ok(hitTarget(attacker,b,NIGHT_MOVES.golfswing,1.1));
  assert.ok(b.percent>a.percent && b.vx>a.vx && b.vy<0);
});
test('rolls, spawn protection and friendly teams reject hits', () => {
  for(const patch of [{action:{name:'roll'}},{respawnTimer:.3},{invulnerable:.4},{dead:true},{team:'hunter'}]){
    const f=target(patch);
    assert.equal(hitTarget(attacker,f,NIGHT_MOVES.punch),false);
    assert.equal(f.percent,0);
  }
});
test('projectile direction is preserved even when the shooter turns around', () => {
  const f=target();
  assert.ok(hitTarget({...attacker,facing:-1},f,NIGHT_MOVES.serve,0,1));
  assert.ok(f.vx>0);
});
test('projectile sweep detects a target crossed between frames in both directions', () => {
  const hurt={x:55,y:20,w:12,h:90};
  assert.ok(overlaps(projectileSweep({x:0,y:50},120),hurt));
  assert.ok(overlaps(projectileSweep({x:120,y:50},0),hurt));
  assert.equal(overlaps(projectileSweep({x:0,y:5},120),hurt),false);
});
test('charge releases into an attack and prevents unrelated move cancellation', () => {
  const f=Object.assign(Object.create(NightFighter.prototype),{
    action:{name:'windup',charge:.8},dead:false,hitstun:0,moveTable:NIGHT_MOVES,setFrame:()=>{},vx:0,
  });
  assert.equal(f.startMove('punch'),false);
  assert.equal(f.startMove('golfswing',{charge:.8}),true);
  assert.equal(f.action.charge,.8);
  assert.equal(f.startMove('serve'),false);
});

test('front guard absorbs attacks, spends guard and keeps the defensive pose', () => {
  const defender=target({facing:1,guard:100,guardBroken:0,action:{name:'block'}});
  assert.equal(blockHit({...attacker,facing:-1},defender,NIGHT_MOVES.claw),true);
  assert.equal(defender.percent,0);assert.ok(defender.guard<100);
  assert.equal(defender.action.name,'block');assert.ok(defender.blockFlash>0);
});
test('blocking leaves the rear vulnerable and cannot absorb friendly fire', () => {
  const defender=target({facing:1,guard:100,guardBroken:0,action:{name:'block'}});
  assert.equal(blockHit(attacker,defender,NIGHT_MOVES.claw),false);
  assert.equal(hitTarget(attacker,defender,NIGHT_MOVES.claw),true);
  assert.ok(defender.percent>0);
  assert.equal(blockHit(attacker,{...defender,team:'hunter'},NIGHT_MOVES.claw),false);
});
test('guard breaks when depleted and cannot block again during recovery', () => {
  const defender=target({facing:1,guard:8,guardBroken:0,action:{name:'block'}});
  assert.ok(blockHit({...attacker,facing:-1},defender,NIGHT_MOVES.claw));
  assert.equal(defender.guard,0);assert.equal(defender.action,null);
  assert.ok(defender.guardBroken>0 && defender.hitstun>0);
  assert.equal(blockHit({...attacker,facing:-1},defender,NIGHT_MOVES.claw),false);
});

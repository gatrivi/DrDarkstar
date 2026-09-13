import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NIGHT_MOVES, hitTarget, blockHit, projectileSweep, overlaps, aimShot, LAYOUTS, WORLD,
  SCORE, scoreForHit, scoreForKO, comboMult, BOUNTIES, bountyIdValid,
  bountyPayout, boardRank, boardInsert, decodeChallenge, encodeChallenge,
} from '../src/game/night/Combat.js';
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

test('sweep covers vertical travel so angled shots connect', () => {
  const hurt = { x: 55, y: 60, w: 12, h: 30 };
  assert.ok(overlaps(projectileSweep({ x: 60, y: 20 }, 60, 80), hurt));
  assert.equal(overlaps(projectileSweep({ x: 60, y: 20 }, 60, 40), hurt), false);
  // legacy horizontal callers still work (nextY defaults to start height)
  assert.ok(overlaps(projectileSweep({ x: 0, y: 70 }, 120), hurt));
});

test('aimShot points at the target within the deflection cap', () => {
  const flat = aimShot(0, 0, 300, 0, 330);
  assert.ok(Math.abs(flat.vy) < 1e-9 && flat.vx === 330);
  const down = aimShot(0, 0, 300, 200, 330);
  assert.ok(down.vx > 0 && down.vy > 0);
  const speed = Math.hypot(down.vx, down.vy);
  assert.ok(Math.abs(speed - 330) < 1e-6);
  assert.ok(Math.abs(Math.asin(down.vy / speed)) <= 0.38 + 1e-9);
  const left = aimShot(300, 0, 0, 50, 330);
  assert.ok(left.vx < 0 && left.vy > 0);
  const steep = aimShot(0, 0, 10, 500, 330, 0.38);
  assert.ok(Math.abs(Math.asin(steep.vy / 330) - 0.38) < 1e-9);
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

test('hits score damage times ten, KOs pay by species plus charged bonus', () => {
  assert.equal(scoreForHit(14), 140);
  assert.equal(scoreForHit(0), 0);
  assert.ok(scoreForKO('replicant') > scoreForKO('vampire'));
  assert.equal(scoreForKO('vampire', true) - scoreForKO('vampire'), SCORE.chargedKoBonus);
});

test('combo multiplier climbs every two hits and caps at five', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 7, 8, 99].map(comboMult), [1, 1, 2, 2, 3, 4, 5, 5]);
});

test('bounty table has three valid specialties with honest payouts', () => {
  assert.equal(BOUNTIES.length, 3);
  for (const b of BOUNTIES) assert.ok(bountyIdValid(b.id));
  assert.equal(bountyIdValid('nope'), false);
  assert.equal(bountyPayout('nightowl', { projKOs: 4 }), 4 * SCORE.nightOwlPerKo);
  assert.equal(bountyPayout('untouchable', { wave2Damage: 0 }), SCORE.untouchableBonus);
  assert.equal(bountyPayout('untouchable', { wave2Damage: 3 }), 0);
  assert.equal(bountyPayout('speedtrap', { wave2Time: 41 }), SCORE.speedTrapBonus);
  assert.equal(bountyPayout('speedtrap', { wave2Time: 90 }), 0);
  assert.equal(bountyPayout('bogus', {}), 0);
});

test('best board ranks and keeps the top five shared runs', () => {
  const board = [{ score: 9000 }, { score: 4000 }];
  assert.equal(boardRank(board, 9500), 0);
  assert.equal(boardRank(board, 5000), 1);
  assert.equal(boardRank(board, 100), 2);
  const full = boardInsert([{ score: 1 }, { score: 2 }, { score: 3 }, { score: 4 }, { score: 5 }], { score: 0 });
  assert.equal(full.length, 5);
  assert.ok(!full.some((e) => e.score === 0));
  assert.equal(boardInsert([], { score: 777 })[0].score, 777);
});

test('challenge links round-trip and reject garbage', () => {
  const code = encodeChallenge(15000, 'PRIMO');
  const back = decodeChallenge(code);
  assert.equal(back.target, 15000);
  assert.equal(back.label, 'PRIMO');
  assert.equal(decodeChallenge(null), null);
  assert.equal(decodeChallenge('!!!not-base64!!!'), null);
  assert.equal(decodeChallenge(encodeChallenge(-5)), null);
});

test('crouching shrinks the hurtbox so level bolts sail overhead', () => {
  const f = Object.create(NightFighter.prototype);
  Object.defineProperty(f, 'feet', { value: 450, writable: true }); // shadow the getter
  f.x = 300; f.crouching = false;
  const stand = f.hurtbox;
  f.crouching = true;
  const duck = f.hurtbox;
  assert.ok(duck.h < stand.h, 'ducking lowers the profile');
  assert.ok(duck.y > stand.y, 'ducking drops the top of the hurtbox');
  const boltY = stand.y + 20; // bolt through the standing chest
  assert.ok(boltY < duck.y, 'that bolt line clears the crouched hunter');
});

test('rooftop layout is one-way, inside the arena, and climbs by steps', () => {
  assert.deepEqual(LAYOUTS.street, []);
  const roofs = LAYOUTS.rooftops;
  assert.ok(roofs.length >= 4);
  for (const l of roofs) {
    assert.equal(l.oneWay, true);
    assert.ok(l.x0 < l.x1);
    assert.ok(l.x0 >= 0 && l.x1 <= WORLD.width);
    assert.ok(l.y < WORLD.ground, 'ledges sit above the street');
  }
  const heights = roofs.map((l) => WORLD.ground - l.y);
  assert.ok(Math.min(...heights) <= 135, 'a low roof is one jump away');
  assert.ok(Math.max(...heights) <= 245, 'even the perch is double-jumpable');
});

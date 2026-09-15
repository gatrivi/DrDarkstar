import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROSTER, NIGHT_MOVES, hitTarget, blockHit, projectileSweep, overlaps, aimShot, LAYOUTS, WORLD,
  SCORE, scoreForHit, scoreForKO, comboMult, BOUNTIES, bountyIdValid,
  bountyPayout, boardRank, boardInsert, decodeChallenge, encodeChallenge,
} from '../src/game/night/Combat.js';
import { NightFighter } from '../src/game/night/NightFighter.js';
import { NightStage } from '../src/game/night/NightStage.js';
import { ZEN, zoneOf, pastGate, inNoodleBar, photoLog, filmStrip, PHOTO_LOGS, mellowLevel, atBreach } from '../src/game/night/ZenZone.js';
import { RELIC_RELAY_X, RUINS_EXIT_X } from '../src/game/night/RelicVista.js';
import { CANTEEN, GlassRain } from '../src/game/night/Canteen.js';

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

test('uptown sanctuary sits left of the sector gate with the noodle bar inside it', () => {
  assert.ok(ZEN.gate > 205 && ZEN.gate < WORLD.width, 'gate splits the arena');
  assert.ok(ZEN.noodleX < ZEN.gate - ZEN.noodleRadius, 'noodle bar stays uptown');
  assert.equal(zoneOf(108), 'uptown');
  assert.equal(zoneOf(ZEN.gate - 1), 'uptown');
  assert.equal(zoneOf(ZEN.gate + 1), 'downtown');
  assert.ok(!pastGate(600) && pastGate(660));
  assert.ok(inNoodleBar(108) && inNoodleBar(150) && !inNoodleBar(205));
});

test('walking past the sector gate is the only way to start the hunt', () => {
  const s = Object.assign(Object.create(NightStage.prototype), {
    state: 'strolling', time: 10, wave: 0, zone: 'uptown', callouts: [],
    spawnWave() { this.enemies = [1, 2, 3]; },
  });
  assert.equal(s.startHunt(), true);
  assert.equal(s.state, 'playing');
  assert.equal(s.zone, 'downtown');
  assert.equal(s.wave, 1);
  assert.equal(s.enemies.length, 3);
  assert.equal(s.startHunt(), false, 'the hunt cannot restart from playing');
  const done = Object.assign(Object.create(NightStage.prototype), { state: 'won' });
  assert.equal(done.startHunt(), false);
});

test('esper film strip keeps the newest six exposures and cycles the log lines', () => {
  const shots = [];
  for (let i = 0; i < 9; i++) shots.push({ n: i });
  const strip = shots.reduce((acc, shot) => filmStrip(acc, shot), []);
  assert.equal(strip.length, ZEN.photoCap);
  assert.deepEqual(strip.map((p) => p.n), [3, 4, 5, 6, 7, 8], 'oldest shots fall off');
  assert.match(photoLog(0), /RAIN|ENHANCE|VOIGHT/);
  assert.equal(photoLog(-1), photoLog(PHOTO_LOGS.length - 1));
});

test('the canteen door only opens from the noodle bar while strolling', () => {
  const s = Object.assign(Object.create(NightStage.prototype), {
    state: 'strolling', canteen: false, viewer: null,
    player: { x: ZEN.noodleX }, sfx: { play() {} },
    announce() {}, callouts: [],
  });
  assert.equal(s.toggleCanteen(), true);
  assert.equal(s.canteen, true);
  assert.equal(s.toggleCanteen(), true, 'B steps back out into the rain');
  assert.equal(s.canteen, false);
  const outside = Object.assign(Object.create(NightStage.prototype), {
    state: 'strolling', canteen: false, viewer: null,
    player: { x: ZEN.gate - 40 }, sfx: { play() {} }, announce() {},
  });
  assert.equal(outside.toggleCanteen(), false, 'no door mid-street');
  const hunting = Object.assign(Object.create(NightStage.prototype), {
    state: 'playing', canteen: false, viewer: null,
    player: { x: ZEN.noodleX }, sfx: { play() {} }, announce() {},
  });
  assert.equal(hunting.toggleCanteen(), false, 'no shelter mid-hunt');
});

test('glass rain droplets slide down the pane and never leave it', () => {
  const glass = new GlassRain(CANTEEN.pane.w, CANTEEN.pane.h, 40);
  for (let i = 0; i < 600; i++) glass.update(1 / 60);
  for (const d of glass.drops) {
    assert.ok(d.y >= -20 && d.y <= CANTEEN.pane.h + 12, 'drops stay on the pane');
    assert.ok(d.x >= 0 && d.x <= CANTEEN.pane.w);
    assert.ok(d.hold > 0 || d.vy > 0, 'gravity always wins on vertical glass');
  }
  // A held drop breaks loose; a moving drop accelerates.
  const free = glass.drops[0];
  free.hold = 0; free.vy = 10;
  const before = free.vy;
  glass.update(1 / 60);
  assert.ok(free.vy > before, 'release accelerates down the glass');
});

test('the relic hunter is a full cast member with an e-rad whip', () => {
  const relic = ROSTER.relic;
  assert.ok(relic, 'relic in the roster');
  assert.equal(relic.name, 'RELIC HUNTER');
  assert.ok(Number.isInteger(relic.row) && relic.row >= 0, 'sheet row assigned');
  assert.equal(relic.weapon, 'E-RAD / WHIP');
  const whip = NIGHT_MOVES.relicWhip;
  assert.ok(whip, 'relicWhip move defined');
  assert.ok(whip.reach > NIGHT_MOVES.punch.reach, 'the whip outreaches the sword');
  assert.ok(whip.active[0] < whip.active[1] && whip.duration > whip.active[1]);
});

test('the west breach damps the storm and opens onto the archive', () => {
  assert.equal(atBreach(ZEN.relicGate), true, 'the breach line opens the ruins');
  assert.equal(atBreach(ZEN.relicGate + 1), false);
  const near = mellowLevel(ZEN.relicGate + 6), far = mellowLevel(ZEN.relicGate + 220);
  assert.ok(near < .32 && far >= 1, `rain mellows toward the breach (${near.toFixed(2)} < 0.32, far ${far})`);
  const sample = [];
  for (let x = ZEN.relicGate; x <= ZEN.relicGate + 240; x += 12) sample.push(mellowLevel(x));
  for (let i = 1; i < sample.length; i++) assert.ok(sample[i] >= sample[i - 1], 'mellowing is monotonic');
  assert.ok(RUINS_EXIT_X > ZEN.relicGate && RUINS_EXIT_X < ZEN.gate, 'exit hysteresis sits inside uptown');
  assert.ok(ROSTER.relic.row !== ROSTER.vampire.row && ROSTER.relic.row !== ROSTER.replicant.row,
    'relic sheet does not collide with enemy rows');
});

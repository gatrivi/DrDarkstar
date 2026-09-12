import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  knockback, isOutOfBounds, shieldCost, blockedByShield, dodgedByInvuln, boxesOverlap,
} from '../src/game/smash/SmashStage.js';
import { ELISEO_MOVES, ELISEO_POSES } from '../src/game/smash/Eliseo.js';
import { ANDY_POSES } from '../src/game/smash/AndyFighter.js';
import { MOVES as ANDY_MOVES, SHIELD, shieldstun, chargeBonus } from '../src/game/smash/Moveset.js';

// Full melee-inspired kit both fighters must answer to.
const KIT = ['jab', 'ftilt', 'utilt', 'dtilt', 'windup', 'fsmash', 'usmash', 'dsmash',
  'roll', 'spot', 'airdodge', 'retriever', 'super'];

test('Eliseo move table covers every control input', () => {
  // AndyFighter.controls starts moves by these keys regardless of character.
  for (const key of [...KIT, 'punch', 'golfswing', 'serve']) {
    assert.ok(key in ELISEO_MOVES, `missing move: ${key}`);
  }
});

test('Andy move table covers the full kit', () => {
  for (const key of [...KIT, 'punch', 'golfswing', 'serve']) {
    assert.ok(key in ANDY_MOVES, `missing move: ${key}`);
  }
});

test('every Eliseo move pose exists in her spritesheet', () => {
  for (const [name, move] of Object.entries(ELISEO_MOVES)) {
    assert.ok(ELISEO_POSES.includes(move.pose), `move ${name} uses unknown pose ${move.pose}`);
  }
});

test('Eliseo has the full requested frame set', () => {
  for (const pose of ['idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'guard', 'aa',
    'ftilt', 'utilt', 'dtilt', 'smash', 'usmash', 'dsmash', 'tilt']) {
    assert.ok(ELISEO_POSES.includes(pose), `missing pose: ${pose}`);
  }
});

test('Andy has locomotion frames and all his move poses exist', () => {
  for (const pose of ['idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'guard']) {
    assert.ok(ANDY_POSES.includes(pose), `missing pose: ${pose}`);
  }
  for (const [name, move] of Object.entries(ANDY_MOVES)) {
    assert.ok(ANDY_POSES.includes(move.pose), `move ${name} uses unknown pose ${move.pose}`);
  }
});

test('attack hierarchy: jab < tilt < smash damage', () => {
  for (const table of [ANDY_MOVES, ELISEO_MOVES]) {
    assert.ok(table.jab.damage < table.ftilt.damage, 'tilt should out-damage jab');
    assert.ok(table.ftilt.damage < table.fsmash.damage, 'smash should out-damage tilt');
    assert.ok(table.fsmash.chargeable, 'forward smash must be chargeable');
    assert.ok(table.usmash.chargeable && table.dsmash.chargeable, 'all smashes charge');
  }
});

test('directional boxes: up moves hit above, down-smash hits both sides', () => {
  for (const table of [ANDY_MOVES, ELISEO_MOVES]) {
    assert.equal(table.utilt.box, 'up');
    assert.equal(table.usmash.box, 'up');
    assert.equal(table.dsmash.box, 'both');
    assert.equal(table.dtilt.box, 'low');
    assert.ok(!table.jab.box || table.jab.box === 'forward');
  }
});

test('dodges have startup before intangibility (melee-style)', () => {
  for (const table of [ANDY_MOVES, ELISEO_MOVES]) {
    for (const name of ['roll', 'spot', 'airdodge']) {
      const [a, b] = table[name].invuln;
      assert.ok(a > 0, `${name} should have startup frames`);
      assert.ok(b > a, `${name} intangibility window must be non-empty`);
      assert.ok(table[name].duration > b, `${name} has vulnerable end frames`);
    }
  }
});

test('knockback grows with percent', () => {
  const low = knockback(20, 240, 2.1);
  const high = knockback(120, 240, 2.1);
  assert.ok(high > low * 1.5);
});

test('vegan power multiplies knockback by 1.5', () => {
  const plain = knockback(50, 240, 2.1);
  const vegan = knockback(50, 240, 2.1, true);
  assert.ok(Math.abs(vegan - plain * 1.5) < 1e-6);
});

test('charge adds to base knockback', () => {
  assert.ok(knockback(0, 520, 2) > knockback(0, 240, 2));
});

test('charge bonus caps at full 1.1s hold', () => {
  const full = chargeBonus(1.1);
  const over = chargeBonus(5);
  assert.deepEqual(over, full);
  assert.ok(full.damage > chargeBonus(0.2).damage);
});

test('shield takes 0.7x damage (melee density)', () => {
  assert.ok(Math.abs(shieldCost(10) - 7) < 1e-9);
  assert.equal(SHIELD.max, 60);
  assert.ok(SHIELD.drain > 0 && SHIELD.regen > 0 && SHIELD.breakStun > 0);
});

test('shieldstun grows with damage', () => {
  assert.ok(shieldstun(14) > shieldstun(4));
  assert.ok(shieldstun(4) > 0 && shieldstun(14) < 0.5);
});

test('blockedByShield only while the bubble is up', () => {
  assert.equal(blockedByShield({ shielding: true, shieldHP: 30, shieldstun: 0 }), true);
  assert.equal(blockedByShield({ shielding: true, shieldHP: 0, shieldstun: 0 }), false);
  assert.equal(blockedByShield({ shielding: false, shieldHP: 60, shieldstun: 0 }), false);
  assert.equal(blockedByShield({ shielding: true, shieldHP: 60, shieldstun: 0.2 }), false);
});

test('dodgedByInvuln covers rolls, spots and air-dodges', () => {
  assert.equal(dodgedByInvuln({ invuln: 0.1, action: null }), true);
  assert.equal(dodgedByInvuln({ invuln: 0, action: { name: 'roll' } }), true);
  assert.equal(dodgedByInvuln({ invuln: 0, action: { name: 'spot' } }), true);
  assert.equal(dodgedByInvuln({ invuln: 0, action: { name: 'airdodge' } }), true);
  assert.equal(dodgedByInvuln({ invuln: 0, action: { name: 'jab' } }), false);
  assert.equal(dodgedByInvuln({ invuln: 0, action: null }), false);
});

test('boxesOverlap detects touches and misses', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  assert.equal(boxesOverlap(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(boxesOverlap(a, { x: 11, y: 0, w: 10, h: 10 }), false);
});

test('blast zones trigger only past the margin', () => {
  const f = { x: 400, y: 300 };
  assert.equal(isOutOfBounds(f, 800, 600), false);
  assert.equal(isOutOfBounds({ x: -100, y: 300 }, 800, 600), true);
  assert.equal(isOutOfBounds({ x: 400, y: 700 }, 800, 600), true);
  assert.equal(isOutOfBounds({ x: 950, y: 300 }, 800, 600), true);
});

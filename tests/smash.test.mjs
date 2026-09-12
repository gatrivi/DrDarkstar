import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knockback, isOutOfBounds } from '../src/game/smash/SmashStage.js';
import { ELISEO_MOVES, ELISEO_POSES } from '../src/game/smash/Eliseo.js';
import { ANDY_POSES } from '../src/game/smash/AndyFighter.js';
import { MOVES as ANDY_MOVES } from '../src/game/smash/Moveset.js';

test('Eliseo move table covers every control input', () => {
  // AndyFighter.controls starts moves by these keys regardless of character.
  for (const key of ['punch', 'windup', 'golfswing', 'serve', 'retriever', 'super']) {
    assert.ok(key in ELISEO_MOVES, `missing move: ${key}`);
  }
});

test('every Eliseo move pose exists in her spritesheet', () => {
  for (const [name, move] of Object.entries(ELISEO_MOVES)) {
    assert.ok(ELISEO_POSES.includes(move.pose), `move ${name} uses unknown pose ${move.pose}`);
  }
});

test('Eliseo has the full requested frame set', () => {
  for (const pose of ['idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'aa', 'smash', 'tilt']) {
    assert.ok(ELISEO_POSES.includes(pose), `missing pose: ${pose}`);
  }
});

test('Andy has locomotion frames and all his move poses exist', () => {
  for (const pose of ['idle', 'walk1', 'walk2', 'dash', 'jump']) {
    assert.ok(ANDY_POSES.includes(pose), `missing pose: ${pose}`);
  }
  for (const [name, move] of Object.entries(ANDY_MOVES)) {
    assert.ok(ANDY_POSES.includes(move.pose), `move ${name} uses unknown pose ${move.pose}`);
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

test('blast zones trigger only past the margin', () => {
  const f = { x: 400, y: 300 };
  assert.equal(isOutOfBounds(f, 800, 600), false);
  assert.equal(isOutOfBounds({ x: -100, y: 300 }, 800, 600), true);
  assert.equal(isOutOfBounds({ x: 400, y: 700 }, 800, 600), true);
  assert.equal(isOutOfBounds({ x: 950, y: 300 }, 800, 600), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimatedSprite } from '../src/game/AnimatedSprite.js';
import { CollisionRain } from '../src/effects/CollisionRain.js';
import { bandLevel, AudioField } from '../src/audio/AudioField.js';
import { keyBlack, blendMasks } from '../src/game/CapeSprite.js';

test('pose blending fades transparent pixels without darkening their color', () => {
  const a = { data: new Uint8ClampedArray([255, 80, 20, 255, 0, 0, 0, 0]) };
  const b = { data: new Uint8ClampedArray([0, 0, 0, 0, 20, 80, 255, 255]) };
  const middle = blendMasks(a, b, 0.5).data;
  assert.deepEqual([...middle], [255, 80, 20, 128, 20, 80, 255, 128]);
  assert.deepEqual(blendMasks(a, b, 0).data, a.data);
  assert.deepEqual(blendMasks(a, b, 1).data, b.data);
});

test('JPEG background key removes dark noise while preserving blue outlines and white body', () => {
  const pixels = new Uint8ClampedArray([5, 7, 12, 255, 10, 30, 200, 255, 245, 245, 245, 255, 35, 35, 35, 255]);
  keyBlack(pixels);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[7], 255);
  assert.equal(pixels[11], 255);
  assert.ok(pixels[15] > 0 && pixels[15] < 255);
  assert.equal(pixels[6], 200);
});

test('pixel sampling preserves black, alpha, transparent holes and mirrored frame colors', () => {
  const actor = Object.create(AnimatedSprite.prototype);
  Object.assign(actor, { x: 2, y: 1, scale: 1, facing: 1, frameWidth: 4, frameHeight: 2,
    mask: { data: new Uint8ClampedArray(32) } });
  actor.mask.data.set([0,0,0,255, 200,80,20,128, 255,255,255,0]);
  assert.equal(actor.sampleWorld(0,0).brightness, 0);
  assert.equal(actor.sampleWorld(1,0).r, 200);
  assert.equal(actor.sampleWorld(1,0).alpha, 128 / 255);
  assert.equal(actor.sampleWorld(2,0), null);
  assert.equal(actor.sampleWorld(-1,0), null);
  actor.facing = -1;
  assert.equal(actor.sampleWorld(2,0).r, 200);
  assert.equal(actor.sampleWorld(3,0).brightness, 0);
});

test('drops traverse a bright interior and exit; brightness slows without reflecting', () => {
  const white = { r:255, g:255, b:255, alpha:1, brightness:1 };
  const actor = { x:50, y:50, sampleWorld: (x,y) => y >= 20 && y < 80 ? white : null };
  const rain = new CollisionRain({ width:100, height:100, actor, count:1 });
  const drop = rain.drops[0];
  Object.assign(drop, { x:50, y:19, speed:100 });
  const silence = { bass:0, mid:0, treble:0, effect:0 };
  let reachedInterior = false, exited = false;
  for (let i=0; i<360; i++) {
    rain.update(1/60, silence);
    assert.ok(drop.vy > 0);
    if (drop.y > 40 && drop.y < 70) { reachedInterior = true; assert.equal(drop.pixel, white); assert.ok(drop.vy < 100); }
    if (drop.y >= 80) { exited = true; assert.equal(drop.pixel, null); break; }
  }
  assert.ok(reachedInterior && exited);
  assert.equal(rain.hits, 1);
});

test('frequency bands distinguish bass from treble at both common sample rates', () => {
  for (const rate of [44100,48000]) {
    const bins = new Uint8Array(1024);
    bins[Math.round(100 * 2048 / rate)] = 255;
    assert.ok(bandLevel(bins,rate,2048,40,250) > 0);
    assert.equal(bandLevel(bins,rate,2048,2000,12000), 0);
  }
});

test('effect analysis responds to measured audio and releases to silence', () => {
  const field = new AudioField(null);
  Object.assign(field, { context: { state:'running', sampleRate:48000 }, spectrum: new Uint8Array(1024),
    effectWave: new Float32Array(256), analyser: { getByteFrequencyData: data => data.fill(0) },
    effectAnalyser: { getFloatTimeDomainData: data => data.fill(0.2) } });
  field.update(0.1);
  assert.ok(field.levels.effect > 0.8);
  field.effectAnalyser.getFloatTimeDomainData = data => data.fill(0);
  for (let i=0; i<120; i++) field.update(1/60);
  assert.ok(field.levels.effect < 0.001);
});

test('dense sampling covers transparent space and follows movement without attaching to solid pixels', () => {
  const actor = { x:100, y:100, renderWidth:64, renderHeight:96, sampleWorld: () => null };
  const field = new CollisionRain({ width:1000, height:800, actor, count:100, focused:true });
  const bounds = field.bounds;
  assert.ok(field.drops.every(p => p.x >= bounds.x && p.x <= bounds.x + bounds.width && p.y >= bounds.y && p.y <= bounds.y + bounds.height));
  const before = field.drops.map(p => ({ x:p.x, y:p.y }));
  actor.x += 200; actor.y += 30;
  field.update(0);
  field.drops.forEach((p,i) => {
    assert.ok(Math.abs(p.x - before[i].x - 200) < 0.0001);
    assert.ok(Math.abs(p.y - before[i].y - 30) < 0.0001);
    assert.equal(p.pixel, null);
  });
});

test('sampling cache changes with animation masks rather than reusing prior frame colors', () => {
  const actor = Object.create(AnimatedSprite.prototype);
  Object.assign(actor, { x:0.5, y:0.5, scale:1, facing:1, frameWidth:1, frameHeight:1,
    mask: { data:new Uint8ClampedArray([255,0,0,255]) } });
  const red = actor.sampleWorld(0,0);
  actor.mask = { data:new Uint8ClampedArray([0,255,0,255]) };
  const green = actor.sampleWorld(0,0);
  assert.equal(red.r,255); assert.equal(green.r,0); assert.equal(green.g,255);
});

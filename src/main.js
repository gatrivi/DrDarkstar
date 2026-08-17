import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { AnimatedSprite } from './game/AnimatedSprite.js';
import { CollisionRain } from './effects/CollisionRain.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const input = new Input();

let width = window.innerWidth;
let height = window.innerHeight;
let dpr = 1;
let paused = false;
let debugMask = false;
let stars = [];

const actor = new AnimatedSprite({ input, width, height, scale: 6 });
await actor.load('./assets/player.png');
const rain = new CollisionRain({ width, height, actor, count: 420 });

function rebuildStars() {
  stars = Array.from({ length: Math.max(50, Math.floor(width * height / 16000)) }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    a: 0.1 + Math.random() * 0.35,
  }));
}

function resize() {
  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  actor.resize(width, height);
  rain.resize(width, height);
  rebuildStars();
}

function drawBackground() {
  ctx.fillStyle = '#02040a';
  ctx.fillRect(0, 0, width, height);
  for (const star of stars) {
    ctx.fillStyle = `rgba(185, 215, 255, ${star.a})`;
    ctx.fillRect(star.x, star.y, 1, 1);
  }
}

resize();
window.addEventListener('resize', resize, { passive: true });

const loop = new GameLoop({
  update(delta) {
    if (input.consume('KeyP')) paused = !paused;
    if (input.consume('KeyM')) debugMask = !debugMask;
    if (input.consume('KeyR')) {
      rain.drops = rain.drops.map(() => rain.makeDrop(true));
      rain.hits = 0;
    }

    if (!paused) {
      actor.update(delta, { width, height });
      rain.update(delta);
    }

    status.textContent = `frame ${actor.frame + 1}/${actor.frames} · rain hits ${rain.hits}${debugMask ? ' · MASK' : ''}`;
    input.endFrame();
  },

  render() {
    drawBackground();
    actor.draw(ctx);
    if (debugMask) actor.drawMaskDebug(ctx);
    rain.draw(ctx);

    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#d7e8ff';
      ctx.textAlign = 'center';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText('PAUSED', width / 2, height / 2);
    }
  },
});

loop.start();

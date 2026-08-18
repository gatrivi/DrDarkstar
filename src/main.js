import { GameLoop } from './engine/GameLoop.js';

const SHEET_SRC = 'data:image/jpeg;base64,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';
const CELL_W = 72;
const CELL_H = 108;
const IMAGE_COUNT = 3;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const mapCanvas = document.createElement('canvas');
const mapCtx = mapCanvas.getContext('2d', { willReadFrequently: true });
const sheet = new Image();
await new Promise((resolve, reject) => { sheet.onload = resolve; sheet.onerror = reject; sheet.src = SHEET_SRC; });

let width = 1;
let height = 1;
let dpr = 1;
let current = 0;
let paused = false;
let showBase = true;
let colorMode = true;
let imageRect = { x: 0, y: 0, w: 1, h: 1 };
let brightness = new Float32Array(1);
let colors = new Uint8ClampedArray(4);
let particles = [];

function fitContain(w, h) {
  const scale = Math.min(width / w, height / h);
  const rw = w * scale;
  const rh = h * scale;
  return { x: (width - rw) / 2, y: (height - rh) / 2, w: rw, h: rh };
}

function drawCurrent(target, rect) {
  target.drawImage(sheet, current * CELL_W, 0, CELL_W, CELL_H, rect.x, rect.y, rect.w, rect.h);
}

function rebuildMap() {
  mapCanvas.width = width;
  mapCanvas.height = height;
  mapCtx.clearRect(0, 0, width, height);
  imageRect = fitContain(CELL_W, CELL_H);
  drawCurrent(mapCtx, imageRect);
  const data = mapCtx.getImageData(0, 0, width, height).data;
  colors = data;
  brightness = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    brightness[p] = Math.sqrt(r * r * 0.299 + g * g * 0.587 + b * b * 0.114) / 100;
  }
}

function makeParticle(anywhere = true) {
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -Math.random() * height * 0.18,
    velocity: 0.35 + Math.random() * 2.8,
    size: 0.7 + Math.random() * 1.6,
  };
}

function rebuildParticles() {
  const count = Math.max(900, Math.min(3200, Math.floor(width * height / 520)));
  particles = Array.from({ length: count }, () => makeParticle(true));
}

function resize() {
  width = Math.max(1, innerWidth | 0);
  height = Math.max(1, innerHeight | 0);
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rebuildMap();
  rebuildParticles();
}

function setImage(index) {
  current = (index + IMAGE_COUNT) % IMAGE_COUNT;
  rebuildMap();
  rebuildParticles();
}

function updateParticles(delta) {
  const frameScale = Math.min(2, delta * 60);
  for (const particle of particles) {
    const x = Math.max(0, Math.min(width - 1, particle.x | 0));
    const y = Math.max(0, Math.min(height - 1, particle.y | 0));
    const value = brightness[y * width + x] || 0;
    const movement = Math.max(0.12, (2.5 - value) + particle.velocity);
    particle.y += movement * frameScale;
    if (particle.y > height + 4) Object.assign(particle, makeParticle(false));
  }
}

function drawParticles() {
  for (const particle of particles) {
    const x = Math.max(0, Math.min(width - 1, particle.x | 0));
    const y = Math.max(0, Math.min(height - 1, particle.y | 0));
    const value = brightness[y * width + x] || 0;
    if (colorMode) {
      const k = (y * width + x) * 4;
      ctx.fillStyle = `rgba(${colors[k] || 225}, ${colors[k + 1] || 235}, ${colors[k + 2] || 255}, ${0.25 + Math.min(1, value / 2.55) * 0.75})`;
    } else {
      ctx.fillStyle = `rgba(235, 242, 255, ${0.22 + Math.min(1, value / 2.55) * 0.78})`;
    }
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size * 2.2);
  }
}

addEventListener('keydown', (event) => {
  if (event.code === 'Digit1') setImage(0);
  if (event.code === 'Digit2') setImage(1);
  if (event.code === 'Digit3') setImage(2);
  if (event.code === 'KeyC') colorMode = !colorMode;
  if (event.code === 'KeyB') showBase = !showBase;
  if (event.code === 'KeyR') rebuildParticles();
  if (event.code === 'KeyP') paused = !paused;
});
addEventListener('resize', resize, { passive: true });
resize();

const loop = new GameLoop({
  update(delta) {
    if (!paused) updateParticles(delta);
    status.textContent = `image ${current + 1}/3 · ${particles.length} particles · ${colorMode ? 'color' : 'white'}`;
  },
  render() {
    ctx.fillStyle = 'rgba(2, 3, 7, 0.24)';
    ctx.fillRect(0, 0, width, height);
    if (showBase) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      drawCurrent(ctx, imageRect);
      ctx.restore();
    }
    drawParticles();
    if (paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#d7e8ff';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', width / 2, height / 2);
    }
  },
});
loop.start();

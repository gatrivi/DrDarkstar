import { GameLoop } from './engine/GameLoop.js';
import { Input } from './engine/Input.js';
import { CapeSprite } from './game/CapeSprite.js';
import { CollisionRain } from './effects/CollisionRain.js';
import { AudioField } from './audio/AudioField.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const input = new Input();
let width = innerWidth, height = innerHeight;
const actor = new CapeSprite({ input, width, height, scale: 2 });
try { await actor.load(); }
catch (error) {
  document.querySelector('#status').textContent = 'Could not load the sprite sheets. Reload to retry.';
  throw error;
}
const rain = new CollisionRain({ width, height, actor, count: 1600 });
const detailRain = new CollisionRain({ width, height, actor, count: 10000, focused: true });
const rainSettings = detailRain.settings;
const detailCanvas = document.createElement('canvas');
const detailCtx = detailCanvas.getContext('2d');
let paused = false, peek = false, elapsed = 0, hudTime = 0;
let objectUrl;
const audio = document.querySelector('#audio');
const sound = new AudioField(audio);
const demoButton = document.querySelector('#demo');
const pulseButton = document.querySelector('#pulse');
const audioButton = document.querySelector('#audio-toggle');
const track = document.querySelector('#track');
const pauseButton = document.querySelector('#pause');
const peekButton = document.querySelector('#peek');
const animateButton = document.querySelector('#animate');
const toolbox = document.querySelector('.toolbox');
document.querySelector('#toolbox-toggle').onclick = event => {
  const collapsed = toolbox.classList.toggle('collapsed');
  event.currentTarget.textContent = collapsed ? 'Show' : 'Hide';
  event.currentTarget.setAttribute('aria-expanded', !collapsed);
};
const preview = document.querySelector('#animation-preview');
preview.onchange = () => { actor.preview = preview.value; actor.action = null; actor.airTime = null; };
function action(name) {
  if (paused) return;
  const started = actor.trigger(name); preview.value = 'auto'; return started;
}
document.querySelector('#jump').onclick = () => action('jump');
document.querySelector('#roll').onclick = () => action('roll');
document.querySelector('#airroll').onclick = () => action('airroll');
document.querySelector('#shield').onclick = () => action('shield');
let autoattack = false, attackTimer = 0;
const attackButton = document.querySelector('#autoattack');
attackButton.onclick = () => {
  autoattack = !autoattack; attackTimer = 0;
  attackButton.setAttribute('aria-pressed', autoattack);
  attackButton.textContent = autoattack ? 'Autoattack on' : 'Autoattack off';
  if (autoattack) sound.enable().catch(() => { track.textContent = 'Audio unavailable; attack preview remains active.'; });
};
const controls = {
  density: document.querySelector('#density'), size: document.querySelector('#particle-size'),
  fade: document.querySelector('#fade'), smoothing: document.querySelector('#smoothing'),
  reveal: document.querySelector('#reveal'), drift: document.querySelector('#drift'),
};
const defaults = { density: 10000, size: 1, fade: 3.08, smoothing: 7, reveal: 1, drift: 1 };
function showControl(key, value) {
  controls[key].nextElementSibling.value = Number(value).toFixed(key === 'density' || key === 'smoothing' ? 0 : 2);
}
function setDensity(value) {
  const count = Number(value);
  detailRain.drops = Array.from({ length: count }, () => detailRain.makeDrop(true));
  detailRain.lastX = actor.x; detailRain.lastY = actor.y;
}
for (const [key, control] of Object.entries(controls)) {
  control.addEventListener('input', () => {
    showControl(key, control.value);
    if (key === 'density') setDensity(control.value);
    else if (key === 'fade') detailFade = Number(control.value);
    else rainSettings[key === 'size' ? 'size' : key] = Number(control.value);
  });
}
document.querySelector('#toolbox-reset').onclick = () => {
  for (const [key, value] of Object.entries(defaults)) {
    controls[key].value = value; showControl(key, value);
    if (key === 'density') setDensity(value);
    else if (key === 'fade') detailFade = value;
    else rainSettings[key] = value;
  }
};
let detailFade = defaults.fade;
animateButton.onclick = () => {
  actor.animate = !actor.animate;
  animateButton.textContent = actor.animate ? 'Stop animation' : 'Animate sprite';
  animateButton.setAttribute('aria-pressed', actor.animate);
};

function resize() {
  const previousWidth = width, previousHeight = height;
  width = innerWidth; height = innerHeight;
  actor.x *= width / previousWidth; actor.groundY *= height / previousHeight;
  actor.y = actor.groundY - actor.jumpOffset;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  actor.scale = Math.min(2.5, width / 170, height / 310);
  actor.groundY = Math.max(actor.renderHeight / 2, Math.min(height - actor.renderHeight / 2, actor.groundY));
  actor.resize(width, height);
  rain.resize(width, height);
  detailRain.resize(width, height);
  detailRain.drops = detailRain.drops.map(() => detailRain.makeDrop(true));
  detailRain.lastX = actor.x; detailRain.lastY = actor.y;
  detailCanvas.width = detailRain.bounds.width;
  detailCanvas.height = detailRain.bounds.height;
}
function togglePause() {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-pressed', paused);
}
function togglePeek() {
  peek = !peek;
  peekButton.setAttribute('aria-pressed', peek);
}
pauseButton.onclick = togglePause;
peekButton.onclick = togglePeek;
async function play() {
  try {
    await sound.enable();
    sound.stopDemo();
    demoButton.textContent = 'Demo music';
    demoButton.setAttribute('aria-pressed', false);
    await audio.play();
  } catch { track.textContent = 'Could not play this file. Try another audio track.'; }
}
audio.onplay = () => { audioButton.textContent = 'Pause music'; };
audio.onpause = () => { audioButton.textContent = 'Play music'; };
audio.onerror = () => { track.textContent = 'Could not decode this track. Try another file.'; };
audioButton.onclick = () => { if (audio.paused) play(); else audio.pause(); };
document.querySelector('#music').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  audio.pause();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  audio.src = objectUrl;
  audio.volume = 0.45;
  track.textContent = file.name;
  audioButton.disabled = false;
  await play();
};
demoButton.onclick = async () => {
  try {
    if (sound.demoTimer !== null) sound.stopDemo();
    else await sound.startDemo();
    const active = sound.demoTimer !== null;
    demoButton.textContent = active ? 'Stop demo' : 'Demo music';
    demoButton.setAttribute('aria-pressed', active);
  } catch { track.textContent = 'Audio unavailable. Try enabling sound again.'; }
};
async function pulse() {
  if (paused) return;
  if (!action('cast')) return;
  try { await sound.pulse(); }
  catch { track.textContent = 'Audio unavailable. Try enabling sound again.'; }
}
pulseButton.onclick = pulse;
let dragging = false;
function move(event) {
  if (!dragging || paused) return;
  actor.facing = event.clientX < actor.x ? -1 : 1;
  actor.x = event.clientX; actor.y = event.clientY; actor.groundY = event.clientY;
  actor.resize(width, height);
}
canvas.onpointerdown = event => { dragging = true; canvas.setPointerCapture(event.pointerId); move(event); };
canvas.onpointermove = move;
canvas.onpointerup = canvas.onpointercancel = () => { dragging = false; };
addEventListener('resize', resize);
resize();
new GameLoop({
  update(delta) {
    if (input.consume('KeyP')) togglePause();
    if (input.consume('KeyM')) togglePeek();
    if (input.consume('Space')) pulse();
    if (input.consume('KeyW') || input.consume('ArrowUp')) action('jump');
    if (input.consume('ShiftLeft') || input.consume('ShiftRight')) action('roll');
    if (input.consume('KeyE')) action('shield');
    if (input.consume('KeyR')) {
      for (const field of [rain, detailRain]) {
        field.drops = field.drops.map(() => field.makeDrop(true)); field.hits = 0;
      }
      detailCtx.clearRect(0, 0, detailCanvas.width, detailCanvas.height);
    }
    if (!paused) {
      elapsed += delta;
      const levels = sound.update(delta);
      if (!dragging) actor.update(delta, { width, height });
      else actor.advanceBlend(delta);
      attackTimer = Math.max(0, attackTimer - delta);
      if (autoattack && !dragging && actor.preview === 'auto' && !actor.action && actor.clip === 'idle' && attackTimer === 0) {
        pulse(); attackTimer = 1.5;
      }
      rain.update(delta, levels);
      detailRain.update(delta, levels);
    }
    hudTime += delta;
    if (hudTime > 0.25) {
      document.querySelector('#status').textContent = `${paused ? 'PAUSED' : actor.clip.toUpperCase()} / frame ${actor.frame + 1} of ${actor.frames}`;
      hudTime = 0;
    }
    input.endFrame();
  },
  render(delta) {
    if (paused) return;
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, width, height);
    rain.draw(ctx);
    // Let marks decay across cape poses instead of flashing the buffer empty.
    detailCtx.globalCompositeOperation = 'destination-out';
    detailCtx.fillStyle = `rgba(0, 0, 0, ${1 - Math.exp(-delta * detailFade)})`;
    detailCtx.fillRect(0, 0, detailCanvas.width, detailCanvas.height);
    detailCtx.globalCompositeOperation = 'source-over';
    const bounds = detailRain.bounds;
    detailCtx.save();
    detailCtx.translate(-bounds.x, -bounds.y);
    detailRain.draw(detailCtx);
    detailCtx.restore();
    ctx.drawImage(detailCanvas, bounds.x, bounds.y);
    if (peek) actor.drawMaskDebug(ctx);
    if (sound.spectrum) {
      const barWidth = width / 64;
      for (let i = 0; i < 64; i++) {
        ctx.fillStyle = `hsla(${180 + i * 1.5}, 80%, 68%, 0.45)`;
        ctx.fillRect(i * barWidth, height - 65, Math.max(1, barWidth - 3), -sound.spectrum[Math.floor(i * sound.spectrum.length / 64)] / 255 * 45);
      }
    }
  },
}).start();

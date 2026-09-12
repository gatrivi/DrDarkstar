import { AnimatedSprite } from './AnimatedSprite.js';

// Coordinates refer to the 1456 x 1080 reference view, scaled to the JPEG size.
const CHARACTER = './WhatsApp Image 2026-09-06 at 3.19.01 PM.jpeg';
const EFFECTS = './WhatsApp Image 2026-09-06 at 3.19.01 PM (1).jpeg';
const row = (edges, y, h) => edges.slice(0, -1).map((x, i) => [x, y, edges[i + 1] - x, h]);
export const CAPE_CLIPS = {
  // Full hand-extension / staff-materialization cycle; keep the tall staff tip.
  idle: { crops: row([24,174,326,485,640,807,974,1125,1280,1450], 515,280), fps: 2 },
  run: { crops: row([20,195,350,500,657,817,965,1110,1270,1450], 315,185), fps: 9 },
  roll: { crops: row([15,180,335,485,650,800,950,1105,1270,1450], 120,160), fps: 13 },
  // Provisional airborne sequence inferred from the run/leap poses.
  jump: { crops: [[500,315,157,185], [657,315,160,185], [817,315,148,185]], fps: 5 },
  cast: { crops: [[24,825,100,225], [176,825,95,225], [335,825,95,225], [495,825,98,225]], fps: 7 },
};

export function blendMasks(from, to, amount) {
  const data = new Uint8ClampedArray(to.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = from.data[i + 3] * (1 - amount), b = to.data[i + 3] * amount;
    const alpha = a + b;
    data[i + 3] = alpha;
    if (alpha) for (let channel = 0; channel < 3; channel++) {
      data[i + channel] = (from.data[i + channel] * a + to.data[i + channel] * b) / alpha;
    }
  }
  return { data, width: to.width, height: to.height };
}

export function keyBlack(data) {
  for (let i = 0; i < data.length; i += 4) {
    const value = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = Math.round(Math.min(1, Math.max(0, (value - 24) / 36)) * 255);
  }
}

function cut(image, rect) {
  const canvas = document.createElement('canvas');
  canvas.width = rect[2]; canvas.height = rect[3];
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, rect[0] * image.width / 1456, rect[1] * image.height / 1080,
    rect[2] * image.width / 1456, rect[3] * image.height / 1080,
    0, 0, rect[2], rect[3]);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  keyBlack(pixels.data);
  ctx.putImageData(pixels, 0, 0);
  let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (pixels.data[(y * canvas.width + x) * 4 + 3] > 128) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
  }
  if (right <= left) throw new Error('Empty sprite crop');
  let mass = 0, center = 0;
  for (let y = top + Math.floor((bottom - top) * 0.25); y < top + (bottom - top) * 0.75; y++) {
    for (let x = left; x < right; x++) {
      const k = (y * canvas.width + x) * 4;
      if (Math.min(pixels.data[k], pixels.data[k + 1], pixels.data[k + 2]) > 150) { mass++; center += x; }
    }
  }
  return { canvas, left, top, width: right - left, height: bottom - top, anchorX: mass ? center / mass - left : (right - left) / 2 };
}

export class CapeSprite extends AnimatedSprite {
  constructor(options) {
    super(options);
    this.frameWidth = 128; this.frameHeight = 144;
    this.clip = 'idle'; this.preview = 'auto'; this.action = null;
    this.actionTime = 0; this.jumpOffset = 0; this.y = options.height * 0.44; this.groundY = this.y;
    this.clips = {}; this.sourceReady = false;
    this.transitionDuration = 0.1; this.transitionTime = 0; this.airTime = null;
  }

  async load() {
    const images = await Promise.all([CHARACTER, EFFECTS].map(src => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load ' + src));
      image.src = src;
    })));
    const effects = [[75,35,58,57], [142,16,52,57], [132,75,61,53]].map(rect => cut(images[1], rect));
    for (const [name, definition] of Object.entries(CAPE_CLIPS)) {
      this.clips[name] = definition.crops.map((rect, i) => {
        const source = cut(images[0], rect);
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 144;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const w = source.width * 0.48, h = source.height * 0.48;
        ctx.drawImage(source.canvas, source.left, source.top, source.width, source.height,
          Math.round(58 - source.anchorX * 0.48), Math.round(136 - h), Math.round(w), Math.round(h));
        if (name === 'cast') {
          const effect = effects[i % effects.length];
          ctx.drawImage(effect.canvas, effect.left, effect.top, effect.width, effect.height, 91, 73, 28, 28);
        }
        return { canvas, mask: ctx.getImageData(0, 0, 128, 144) };
      });
    }
    // Reuse the tumble poses in the air; retain the existing flight clock.
    this.clips.airroll = this.clips.roll;
    const shield = cut(images[1], [1115,330,300,310]);
    this.clips.shield = this.clips.idle.map(frame => {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 144;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.globalAlpha = 0.65;
      ctx.drawImage(shield.canvas, shield.left, shield.top, shield.width, shield.height, 5, 21, 117, 117);
      ctx.globalAlpha = 1; ctx.drawImage(frame.canvas, 0, 0);
      return { canvas, mask: ctx.getImageData(0, 0, 128, 144) };
    });
    this.sourceReady = true; this.setClip('idle', true);
  }

  setClip(name, force = false) {
    if (!force && name === this.clip) return;
    this.clip = name; this.frames = this.clips[name].length;
    this.frameDuration = 1 / (CAPE_CLIPS[name]?.fps || (name === 'airroll' ? 13 : 2)); this.frameTime = 0;
    this.setFrame(0);
  }

  setFrame(index) {
    if (!this.clips[this.clip]) return;
    this.frame = ((index % this.frames) + this.frames) % this.frames;
    const next = this.clips[this.clip][this.frame].mask;
    if (this.mask && this.mask !== next) {
      this.previousMask = this.mask; this.targetMask = next;
      this.transitionTime = 0;
    } else { this.mask = next; this.targetMask = next; }
  }

  advanceBlend(delta) {
    if (!this.previousMask) return;
    this.transitionTime += delta;
    const t = Math.min(1, this.transitionTime / this.transitionDuration);
    this.mask = t === 1 ? this.targetMask : blendMasks(this.previousMask, this.targetMask, t * t * (3 - 2 * t));
    if (t === 1) this.previousMask = null;
  }

  trigger(name) {
    if (name === 'roll' && this.airTime !== null) name = 'airroll';
    if (!['jump', 'roll', 'airroll', 'cast', 'shield'].includes(name)) return false;
    if (this.action && !(name === 'airroll' && this.action === 'jump')) return false;
    if (name === 'jump' || (name === 'airroll' && this.airTime === null)) this.airTime = 0;
    this.preview = 'auto'; this.action = name; this.actionTime = 0;
    this.setClip(name);
    return true;
  }

  update(delta, bounds) {
    const dx = Number(this.input.isDown('KeyD', 'ArrowRight')) - Number(this.input.isDown('KeyA', 'ArrowLeft'));
    if (dx) this.facing = Math.sign(dx);
    if (this.airTime !== null) {
      this.airTime += delta;
      if (this.airTime >= 0.85) { this.airTime = null; this.action = null; }
    }
    if (this.action) {
      this.actionTime += delta;
      const duration = this.action === 'jump' || this.action === 'airroll' ? Infinity : this.action === 'shield' ? 1.2 : this.action === 'roll' ? 9 / 13 : 4 / 7;
      if (this.actionTime >= duration) this.action = null;
    }
    const name = this.action || (this.preview !== 'auto' ? this.preview : dx ? 'run' : 'idle');
    this.setClip(name);
    this.x += (this.action === 'roll' || this.action === 'airroll' ? this.facing * 220 : dx * this.speed) * delta;
    this.jumpOffset = this.airTime !== null ? Math.sin(this.airTime / 0.85 * Math.PI) * Math.min(95, bounds.height * 0.15) : 0;
    this.y = this.groundY - this.jumpOffset;
    this.resize(bounds.width, bounds.height);
    if (this.animate || dx || this.action) {
      this.frameTime += delta;
      while (this.frameTime >= this.frameDuration) {
        this.frameTime -= this.frameDuration; this.setFrame(this.frame + 1);
      }
    }
    this.advanceBlend(delta);
  }

  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.facing, 1);
    ctx.drawImage(this.clips[this.clip][this.frame].canvas,
      -this.renderWidth / 2, -this.renderHeight / 2, this.renderWidth, this.renderHeight);
    ctx.restore();
  }
}

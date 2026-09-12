import { AnimatedSprite } from '../AnimatedSprite.js';
import { MOVES } from './Moveset.js';

// Hand-drawn Game Boy era spritesheet: 24 x 32 pixel frames, one per pose.
// Andy's likeness comes from the palette: skin/hair are sampled from andy.jpeg
// at load time; the wardrobe is his — Akatsuki-style cloud jacket + Link cap.
const POSES = ['idle', 'walk1', 'walk2', 'dash', 'jump', 'punch1', 'punch2', 'punch3', 'windup', 'swing', 'serve', 'super', 'whistle'];
export const ANDY_POSES = POSES;
const FRAME_INDEX = Object.fromEntries(POSES.map((name, i) => [name, i]));
const PW = 24, PH = 32;

const PALETTES = {
  andy: {
    skin: '#e8b98a', skinShade: '#cf9a6b', hair: '#33241a',
    cap: '#3f9e4d', capDark: '#2f7a3a',
    jacket: '#1d1d24', jacketHi: '#34343f', cloud: '#c93038', cloudEdge: '#e8e2d8',
    pants: '#2a2f3a', shoe: '#4a3b2a', eye: '#1c1c1c',
  },
  dummy: {
    skin: '#e8c9c0', skinShade: '#d1a89e', hair: '#59323e',
    cap: '#b03a5b', capDark: '#8a2c47',
    jacket: '#241d24', jacketHi: '#3f3440', cloud: '#7d4bab', cloudEdge: '#e8e2d8',
    pants: '#3a2a3a', shoe: '#5a3a4a', eye: '#1c1c1c',
  },
};
const SWORD = { blade: '#d9e4ea', edge: '#f4faff', hilt: '#c9a227' };
const SHIELD = { body: '#2b5fd9', rim: '#c9a227', emblem: '#9aa7b0' };

function drawBase(ctx, ox, p, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };

  // Link cap, flopping back-left; brim forward.
  R(8, 1, 8, 1, p.cap);
  R(7, 2, 10, 1, p.cap);
  R(2, 3, 5, 1, p.capDark);
  R(3, 4, 3, 1, p.capDark);

  // Hair + face (sprite faces right).
  R(7, 3, 10, 2, p.hair);
  R(15, 5, 2, 1, p.hair);
  R(8, 5, 8, 4, p.skin);
  R(8, 7, 1, 2, p.skinShade);      // shaded ear/cheek
  R(13, 6, 2, 1, p.eye);           // eye toward the front

  // Neck + Akatsuki-style jacket: black with red cloud.
  R(10, 9, 4, 1, p.skinShade);
  R(8, 10, 8, 9, p.jacket);
  R(8, 10, 1, 9, p.jacketHi);      // rim light
  R(12, 10, 1, 9, p.jacketHi);     // zipper
  R(10, 11, 2, 2, p.cloud); R(10, 11, 1, 1, p.cloudEdge);
  R(13, 15, 2, 2, p.cloud); R(14, 16, 1, 1, p.cloudEdge);

  // Legs: standing by default; stride/lunge/tuck for locomotion frames.
  if (pose === 'walk1') {
    R(7, 19, 3, 5, p.pants); R(4, 23, 4, 2, p.shoe);       // back leg
    R(14, 19, 3, 5, p.pants); R(16, 23, 5, 2, p.shoe);     // front leg
  } else if (pose === 'walk2' || pose === 'serve') {
    R(9, 19, 3, 6, p.pants); R(13, 19, 3, 6, p.pants);
    R(9, 25, 4, 2, p.shoe); R(13, 25, 4, 2, p.shoe);
  } else if (pose === 'dash') {
    R(4, 21, 5, 2, p.pants); R(1, 22, 4, 2, p.shoe);       // trailing leg
    R(15, 21, 5, 2, p.pants); R(19, 22, 4, 2, p.shoe);     // driving leg
    R(2, 11, 4, 1, '#1e3a5f'); R(1, 14, 5, 1, '#1e3a5f'); R(3, 17, 3, 1, '#1e3a5f');
  } else if (pose === 'jump') {
    R(8, 19, 3, 4, p.pants); R(13, 19, 3, 4, p.pants);
    R(8, 22, 3, 2, p.shoe); R(14, 22, 3, 2, p.shoe);
  } else {
    R(8, 19, 3, 6, p.pants);
    R(13, 19, 3, 6, p.pants);
    R(7, 25, 4, 2, p.shoe);
    R(13, 25, 5, 2, p.shoe);         // front toe
  }

  // Arms: swinging on locomotion, idle stance otherwise (attack poses overlay their own).
  if (pose === 'idle') {
    R(6, 11, 2, 6, p.jacket); R(6, 17, 2, 2, p.skin);
    R(16, 11, 2, 6, p.jacket); R(16, 17, 2, 2, p.skin);
  } else if (pose === 'walk1') {
    R(5, 12, 2, 5, p.jacket); R(5, 17, 2, 2, p.skin);
    R(17, 10, 2, 5, p.jacket); R(17, 15, 2, 2, p.skin);
  } else if (pose === 'walk2') {
    R(6, 11, 2, 5, p.jacket); R(6, 16, 2, 2, p.skin);
    R(16, 11, 2, 5, p.jacket); R(16, 16, 2, 2, p.skin);
  } else if (pose === 'dash') {
    R(5, 13, 2, 4, p.jacket); R(5, 17, 2, 2, p.skin);
    R(17, 9, 2, 4, p.jacket); R(17, 13, 2, 2, p.skin);
  } else if (pose === 'jump') {
    R(6, 7, 2, 4, p.jacket); R(6, 6, 2, 2, p.skin);
    R(16, 7, 2, 4, p.jacket); R(16, 6, 2, 2, p.skin);
  }

  // Hylian shield on the back except during sword work.
  if (pose !== 'windup' && pose !== 'swing') {
    R(4, 10, 3, 8, SHIELD.body);
    R(4, 10, 3, 1, SHIELD.rim); R(4, 17, 3, 1, SHIELD.rim);
    R(5, 13, 1, 2, SHIELD.emblem);
  }
}

function drawPose(ctx, ox, p, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
  switch (pose) {
    case 'punch1': // straight punch, high line
      R(16, 11, 5, 2, p.jacket); R(21, 11, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket); R(6, 17, 2, 2, p.skin);
      break;
    case 'punch2': // chain punch, mid line
      R(16, 13, 5, 2, p.jacket); R(21, 13, 2, 2, p.skin);
      R(6, 11, 2, 5, p.jacket); R(6, 16, 2, 2, p.skin);
      break;
    case 'punch3': // double straight blast
      R(16, 10, 4, 2, p.jacket); R(20, 10, 2, 2, p.skin);
      R(16, 14, 4, 2, p.jacket); R(20, 14, 2, 2, p.skin);
      break;
    case 'windup': // Master Sword raised behind — golf backswing
      R(3, 3, 2, 9, SWORD.blade); R(3, 3, 1, 9, SWORD.edge);
      R(2, 12, 4, 1, SWORD.hilt); R(3, 13, 2, 2, SWORD.hilt);
      R(5, 10, 3, 2, p.jacket);
      R(6, 13, 2, 4, p.jacket);
      break;
    case 'swing': // full drive — blade swept through in front
      R(14, 10, 8, 2, SWORD.blade); R(14, 10, 8, 1, SWORD.edge);
      R(22, 10, 1, 1, SWORD.edge); R(13, 9, 1, 4, SWORD.hilt);
      R(11, 11, 3, 2, p.jacket);
      break;
    case 'serve': // ping-pong serve, paddle up
      R(16, 6, 2, 5, p.jacket);
      R(15, 3, 4, 3, '#e33'); R(15, 3, 1, 1, '#f66');
      R(6, 12, 2, 5, p.jacket); R(6, 17, 2, 2, p.skin);
      break;
    case 'super': // Todd the Vegan power stance, green energy arms
      R(3, 11, 4, 2, '#7de08a'); R(17, 11, 4, 2, '#7de08a');
      R(2, 8, 1, 1, '#7de08a'); R(21, 8, 1, 1, '#7de08a');
      R(5, 6, 1, 1, '#7de08a'); R(18, 6, 1, 1, '#7de08a');
      break;
    case 'whistle': // retriever summon — fingers to mouth
      R(16, 10, 2, 3, p.jacket);
      R(14, 8, 3, 2, p.jacket); R(13, 7, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket);
      break;
  }
}

function buildSpriteSheet(palette) {
  const sheet = document.createElement('canvas');
  sheet.width = PW * POSES.length; sheet.height = PH;
  const ctx = sheet.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  POSES.forEach((pose, i) => {
    drawBase(ctx, i * PW, palette, pose);
    drawPose(ctx, i * PW, palette, pose);
  });
  return { sheet, pw: PW, ph: PH, frames: POSES.length };
}

// Sample skin/hair tones from the reference photo so the sprite reads as Andy.
async function sampleTones() {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no photo'));
    img.src = './andy.jpeg';
  });
  const c = document.createElement('canvas');
  c.width = 24; c.height = 40;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(image, 0, 0, 24, 40);
  const avg = (x0, y0, x1, y1) => {
    const d = cx.getImageData(0, 0, 24, 40).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = (y * 24 + x) * 4;
      r += d[k]; g += d[k + 1]; b += d[k + 2]; n++;
    }
    return n ? `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})` : null;
  };
  const skin = avg(8, 9, 16, 15) || '#e8b98a';   // face region of the portrait
  const hair = avg(8, 2, 16, 7) || '#33241a';    // top of head
  const shade = (color, k = 0.85) => {
    const m = color.match(/\d+/g).map(Number);
    return `rgb(${m.slice(0, 3).map(v => Math.round(v * k)).join(', ')})`;
  };
  return { skin, skinShade: shade(skin), hair };
}

export class AndyFighter extends AnimatedSprite {
  constructor({ input, width, height, name = 'ANDY', tint = null, spawnX = width * 0.35, sheetInfo }) {
    super({ input, width, height, scale: 3 });
    this.name = name;
    this.moveTable = MOVES;          // per-character override hook
    this.frameIndex = FRAME_INDEX;   // per-character frame set
    this.walkFlip = false;
    this.tint = tint;
    this.sheetInfo = sheetInfo;
    if (sheetInfo) this.applySheet(sheetInfo);
    this.x = spawnX;
    this.percent = 0;
    this.stocks = 3;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.jumpsLeft = 2;
    this.facing = 1;
    this.hitstun = 0;
    this.action = null;      // { name, time, duration, hitDone, ... }
    this.charge = 0;         // golf swing charge, seconds held
    this.dashTimer = 0;
    this.veganGlow = 0;      // seconds of Todd-power remaining
    this.tapTimer = 0; this.tapDir = 0; // double-tap dash detection
    this.respawnTimer = 0;
    this.moveSeed = Math.random() * 10;
  }

  applySheet({ sheet, pw, ph, frames }) {
    this.sheet = sheet;
    this.frameWidth = pw; this.frameHeight = ph; this.frames = frames;
    this.maskCache.clear();
    this.maskCanvas.width = pw; this.maskCanvas.height = ph;
    this.setFrame(0, true);
  }

  async load() {
    const palette = { ...(this.tint ? PALETTES.dummy : PALETTES.andy) };
    if (!this.tint) {
      try { Object.assign(palette, await sampleTones()); } catch { /* keep defaults */ }
    }
    this.applySheet(buildSpriteSheet(palette));
  }

  get hurtbox() {
    const w = this.renderWidth * 0.6, h = this.renderHeight * 0.85;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  startMove(name, extra = {}) {
    if (this.action || this.hitstun > 0) return false;
    const move = this.moveTable[name];
    this.action = { name, time: 0, hitDone: false, charge: 0, ...extra };
    this.frameDuration = move.animRate;
    this.setFrame(FRAME_INDEX[move.pose]);
    return true;
  }

  hitbox() {
    const move = this.moveTable[this.action?.name];
    if (!move || this.action.hitDone || !move.reach) return null;
    const t = this.action.time;
    if (t < move.active[0] || t > move.active[1]) return null;
    const w = move.reach, h = this.renderHeight * (move.heightRatio ?? 0.5);
    return {
      x: this.facing > 0 ? this.x + this.renderWidth * 0.2 : this.x - this.renderWidth * 0.2 - w,
      y: this.y - h / 2, w, h,
    };
  }

  controls(delta, stage) {
    const input = this.input;
    if (!input) return;
    if (input.consume('Escape')) return;

    const dx = Number(input.isDown('KeyD', 'ArrowRight')) - Number(input.isDown('KeyA', 'ArrowLeft'));
    const speed = 260;
    if (this.dashTimer > 0) {
      this.vx = this.tapDir * 620;
    } else if (!this.action) {
      this.vx = dx * speed;
      if (dx) this.facing = Math.sign(dx);
    }

    // Double-tap a direction to dash.
    this.tapTimer = Math.max(0, this.tapTimer - delta);
    for (const [code, dir] of [['KeyA', -1], ['KeyD', 1], ['ArrowLeft', -1], ['ArrowRight', 1]]) {
      if (input.consume(code) && !this.action) {
        if (this.tapTimer > 0 && this.tapDir === dir) {
          this.dashTimer = 0.22; this.tapDir = dir; this.facing = dir;
          stage.onDash?.(this);
        } else {
          this.tapTimer = 0.28; this.tapDir = dir;
        }
      }
    }

    if ((input.consume('KeyW') || input.consume('ArrowUp') || input.consume('Space')) && !this.action) {
      if (this.onGround || this.jumpsLeft > 0) {
        const grounded = this.onGround;
        stage.sfx?.play(grounded ? 'jump' : 'doubleJump');
        this.vy = grounded ? -760 : -680;
        this.jumpsLeft = this.onGround ? 1 : this.jumpsLeft - 1;
        this.onGround = false;
      }
    }

    if (input.isDown('KeyS', 'ArrowDown') && !this.onGround && this.vy > 0) this.vy += 1400 * delta;

    // Shift: roll (fighters whose sheet has one).
    if ((input.consume('ShiftLeft') || input.consume('ShiftRight')) && this.moveTable.roll && !this.action && this.hitstun <= 0) {
      if (this.startMove('roll')) {
        this.dashTimer = 0.32; this.tapDir = this.facing;
        stage.sfx?.play('roll');
      }
    }

    // J: Wing Tsun chain punch. Chain while the key is re-pressed during recovery.
    if (input.consume('KeyJ') && !this.action && this.hitstun <= 0) {
      this.startMove('punch');
      stage.sfx?.play('attack');
    }

    // K hold/release: charged Master Sword drive.
    if (input.isDown('KeyK') && !this.action && this.onGround && this.hitstun <= 0) {
      this.startMove('windup');
      stage.sfx?.play('smashCharge');
    }
    if (this.action?.name === 'windup') {
      if (input.isDown('KeyK')) {
        this.action.charge = Math.min(1.1, this.action.charge + delta);
      } else {
        this.startMove('golfswing', { charge: this.action.charge });
        stage.sfx?.play('smashRelease');
      }
    }

    // L: ping-pong serve projectile.
    if (input.consume('KeyL') && !this.action && this.hitstun <= 0) {
      this.startMove('serve');
      stage.sfx?.play('tilt');
    }

    // I: summon the black retriever with the red collar.
    if (input.consume('KeyI') && !this.action && this.hitstun <= 0) {
      this.startMove('retriever');
      stage.sfx?.play('summon');
    }

    // U: Todd the Vegan power.
    if (input.consume('KeyU') && this.veganGlow <= 0 && this.hitstun <= 0) {
      this.veganGlow = 5;
      this.startMove('super');
      stage.onSuper?.(this);
    }
  }

  physics(delta, stage) {
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    const gravity = 2100;
    this.vy += gravity * delta;
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    // Land with the FEET on the slab surface (y is the sprite's center).
    const ground = stage.platform;
    const fallSpeed = this.vy;
    this.onGround = false;
    const footY = this.y + this.renderHeight / 2;
    if (footY >= ground.y && this.vy >= 0 && this.x >= ground.x0 && this.x <= ground.x1) {
      this.y = ground.y - this.renderHeight / 2;
      this.vy = 0; this.onGround = true; this.jumpsLeft = 2;
      if (fallSpeed > 500) stage.sfx?.play('land');
      // Keep slide momentum while in hitstun; friction only when in control.
      if (!this.action && this.hitstun <= 0) this.vx *= Math.pow(0.001, delta);
    }
    // Soft screen walls keep fighters under the blast zones but never hard-clamp:
    // knockback can still carry a fighter off the top, sides, or through the pit.
    const minX = this.renderWidth * 0.35, maxX = stage.width - this.renderWidth * 0.35;
    if (this.x < minX || this.x > maxX) {
      if (this.hitstun <= 0) this.x = Math.max(minX, Math.min(maxX, this.x));
    }
  }

  advance(delta) {
    this.hitstun = Math.max(0, this.hitstun - delta);
    this.veganGlow = Math.max(0, this.veganGlow - delta);
    if (this.action) {
      const move = this.moveTable[this.action.name];
      this.action.time += delta;
      // Punch flurry chains three quick poses when the sheet has them.
      if (this.action.name === 'punch' && this.frameIndex.punch1) {
        const phase = Math.floor(this.action.time / move.animRate) % 3;
        this.setFrame(this.frameIndex[['punch1', 'punch2', 'punch3'][phase]]);
      } else if (this.action.name === 'windup' && this.frameIndex.windup) {
        this.setFrame(this.frameIndex.windup);
      }
      if (this.action.time >= move.duration) {
        this.action = null;
        this.setFrame(this.frameIndex.idle ?? 0);
      }
    } else if (this.dashTimer > 0 && this.frameIndex.dash) {
      this.setFrame(this.frameIndex.dash);
    } else if (!this.onGround && this.frameIndex.jump) {
      this.setFrame(this.frameIndex.jump);
    } else if (this.onGround && this.frameIndex.walk1 && Math.abs(this.vx) > 20) {
      // Walk cycle when the sheet provides stride frames.
      this.frameTime += delta;
      if (this.frameTime >= 0.15) {
        this.frameTime = 0;
        this.walkFlip = !this.walkFlip;
        this.setFrame(this.walkFlip ? this.frameIndex.walk2 : this.frameIndex.walk1);
      }
    } else if (this.onGround) {
      this.frameTime += delta;
      if (this.frameTime >= 0.5) { this.frameTime = 0; this.setFrame(this.frameIndex.idle ?? 0); }
    }
  }

  respawn(stage) {
    this.percent = 0;
    this.x = stage.width / 2;
    this.y = stage.height * 0.3;
    this.vx = 0; this.vy = 0;
    this.hitstun = 0; this.action = null;
    this.respawnTimer = 1;
  }

  update(delta, stage) {
    if (this.respawnTimer > 0) { this.respawnTimer -= delta; }
    if (this.hitstun <= 0) this.controls(delta, stage);
    this.physics(delta, stage);
    this.advance(delta);
  }
}

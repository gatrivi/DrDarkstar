import { AnimatedSprite } from '../AnimatedSprite.js';
import { MOVES, SHIELD, MAX_CHARGE } from './Moveset.js';
import { ENGINE_POSES, loadAndySheet } from './AndySheet.js';

// Dual control schemes so two cousins can fool around on one keyboard.
// P1 (left side): A/D move · W jump · S shield/fast-fall · J jab+tilts ·
//   K hold/release smash · L tilt · Shift roll/spot/airdodge.
// P2 (right side): Arrows move/jump/shield · Comma jab · Period tilt ·
//   Slash hold/release smash · RightShift roll. Numpad 1/2/3/0 mirror P2.
export const P1_BINDINGS = {
  left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'],
  shield: ['KeyS'], jab: ['KeyJ'], tilt: ['KeyL'],
  smash: ['KeyK'], roll: ['ShiftLeft'], up: ['KeyW'], down: ['KeyS'],
};
export const P2_BINDINGS = {
  left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'],
  shield: ['ArrowDown'], jab: ['Comma', 'Numpad1'], tilt: ['Period', 'Numpad2'],
  smash: ['Slash', 'Numpad3'], roll: ['ShiftRight', 'Numpad0', 'Quote'],
  up: ['ArrowUp'], down: ['ArrowDown'],
};

// Frame order shared by the procedural fallback sheet and the generated art
// strip (AndySheet composes the art in this exact order).
const POSES = ENGINE_POSES;
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
const HYLIAN = { body: '#2b5fd9', rim: '#c9a227', emblem: '#9aa7b0' };

function drawBase(ctx, ox, p, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };

  // Roll: tucked ball — cap shell outside, cloud jacket wrapping the core.
  if (pose === 'roll') {
    R(6, 10, 12, 12, p.jacket);
    R(6, 10, 12, 2, p.cap); R(6, 10, 2, 12, p.capDark);
    R(4, 12, 2, 2, p.capDark); R(18, 12, 2, 2, p.capDark);
    R(8, 20, 4, 2, p.pants); R(13, 20, 3, 2, p.pants);
    R(10, 13, 4, 3, p.skin); R(12, 14, 2, 1, p.eye);
    R(10, 12, 2, 1, p.cloud); R(14, 17, 2, 1, p.cloudEdge);
    R(2, 12, 2, 1, '#1e3a5f'); R(2, 18, 2, 1, '#1e3a5f');
    return;
  }

  // Guard: crouched shield stance, Hylian shield swung to the front.
  if (pose === 'guard') {
    R(8, 5, 8, 1, p.cap); R(7, 6, 10, 1, p.cap);
    R(7, 7, 10, 2, p.hair);
    R(8, 9, 8, 4, p.skin); R(13, 10, 2, 1, p.eye);
    R(10, 13, 4, 1, p.skinShade);
    R(8, 14, 8, 6, p.jacket); R(8, 14, 1, 6, p.jacketHi);
    R(10, 15, 2, 2, p.cloud);
    R(9, 20, 3, 4, p.pants); R(13, 20, 3, 4, p.pants);
    R(8, 24, 4, 2, p.shoe); R(14, 24, 4, 2, p.shoe);
    R(16, 12, 4, 9, HYLIAN.body);
    R(16, 12, 4, 1, HYLIAN.rim); R(16, 20, 4, 1, HYLIAN.rim);
    R(17, 15, 1, 3, HYLIAN.emblem);
    R(6, 15, 2, 4, p.jacket);
    return;
  }

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

  // Hylian shield on the back except during sword work and dodges.
  if (pose !== 'windup' && pose !== 'swing' && pose !== 'usmash' && pose !== 'roll' && pose !== 'guard') {
    R(4, 10, 3, 8, HYLIAN.body);
    R(4, 10, 3, 1, HYLIAN.rim); R(4, 17, 3, 1, HYLIAN.rim);
    R(5, 13, 1, 2, HYLIAN.emblem);
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
    case 'ftilt': // lunging side kick + straight, weight forward
      R(16, 12, 5, 2, p.jacket); R(21, 12, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket); R(6, 17, 2, 2, p.skin);
      R(16, 20, 5, 2, p.pants); R(21, 20, 2, 2, p.shoe);
      break;
    case 'utilt': // rising uppercut, blade held skyward
      R(16, 4, 2, 7, SWORD.blade); R(16, 4, 1, 7, SWORD.edge);
      R(16, 11, 2, 3, p.jacket); R(16, 14, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket); R(6, 17, 2, 2, p.skin);
      break;
    case 'dtilt': // crouched leg sweep
      R(15, 20, 7, 2, p.pants); R(21, 20, 3, 2, p.shoe);
      R(16, 11, 4, 2, p.jacket); R(20, 11, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket);
      break;
    case 'usmash': // overhead Master Sword arc
      R(10, 0, 2, 10, SWORD.blade); R(10, 0, 1, 10, SWORD.edge);
      R(9, 10, 4, 1, SWORD.hilt); R(10, 11, 2, 2, SWORD.hilt);
      R(5, 10, 3, 2, p.jacket); R(16, 10, 3, 2, p.jacket);
      break;
    case 'dsmash': // spinning low sweep, blade out both sides
      R(0, 14, 5, 2, SWORD.blade); R(0, 14, 5, 1, SWORD.edge);
      R(19, 14, 5, 2, SWORD.blade); R(19, 14, 5, 1, SWORD.edge);
      R(5, 11, 3, 2, p.jacket); R(16, 11, 3, 2, p.jacket);
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
    case 'hurt': // recoil — arms flung back, impact ticks
      R(4, 11, 2, 5, p.jacket); R(4, 16, 2, 2, p.skin);
      R(18, 11, 2, 5, p.jacket); R(18, 16, 2, 2, p.skin);
      R(1, 6, 1, 1, '#fff'); R(22, 8, 1, 1, '#fff'); R(20, 4, 1, 1, '#fff');
      break;
    case 'victory': // triumphant fist up with sparks
      R(16, 2, 2, 9, p.jacket); R(16, 0, 2, 2, p.skin);
      R(6, 12, 2, 5, p.jacket); R(6, 17, 2, 2, p.skin);
      R(13, 2, 1, 1, '#ffd34d'); R(20, 4, 1, 1, '#ffd34d'); R(14, 6, 1, 1, '#fff');
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
  constructor({ input, width, height, name = 'ANDY', tint = null, spawnX = width * 0.35, sheetInfo, bindings = null }) {
    super({ input, width, height, scale: 3 });
    this.name = name;
    this.moveTable = MOVES;          // per-character override hook
    this.frameIndex = FRAME_INDEX;   // per-character frame set
    this.bindings = bindings || P1_BINDINGS; // P1 or P2 key map
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
    this.charge = 0;         // smash charge, seconds held
    this.dashTimer = 0;
    this.veganGlow = 0;      // seconds of Todd-power remaining
    this.tapTimer = 0; this.tapDir = 0; // double-tap dash detection
    this.respawnTimer = 0;
    this.moveSeed = Math.random() * 10;
    this.unitScale = 1;    // art sheets normalize world size through this
    this.celebrating = false; // victory pose when the match is won
    // Melee defense kit.
    this.shieldHP = SHIELD.max;
    this.shielding = false;
    this.shieldstun = 0;
    this.shieldBreakStun = 0;
    this.dropLag = 0;
    this.invuln = 0;         // roll / spot / air-dodge intangibility
    this.dodgeDir = 0;
    this.lastMoveName = null;// HUD combat label
    this.lastMoveTime = 9;
  }

  applySheet({ sheet, pw, ph, frames, unitScale }) {
    this.sheet = sheet;
    this.frameWidth = pw; this.frameHeight = ph; this.frames = frames;
    this.unitScale = unitScale ?? 1;
    this.maskCache.clear();
    this.maskCanvas.width = pw; this.maskCanvas.height = ph;
    this.setFrame(0, true);
  }

  async load() {
    const palette = { ...(this.tint ? PALETTES.dummy : PALETTES.andy) };
    if (!this.tint) {
      try { Object.assign(palette, await sampleTones()); } catch { /* keep defaults */ }
    }
    // Generated art first (falls back to the procedural sheet offline).
    try {
      this.applySheet(await loadAndySheet({ tint: !!this.tint }));
    } catch {
      this.applySheet(buildSpriteSheet(palette));
    }
  }

  get hurtbox() {
    const w = this.renderWidth * 0.6, h = this.renderHeight * 0.85;
    return { x: this.x - w / 2, y: this.y - h / 2, w, h };
  }

  startMove(name, extra = {}) {
    if (this.action || this.hitstun > 0 || this.shieldBreakStun > 0) return false;
    const move = this.moveTable[name];
    if (!move) return false;
    this.action = { name, time: 0, hitDone: false, charge: 0, ...extra };
    this.frameDuration = move.animRate ?? 0.15;
    const pose = move.pose;
    if (pose != null && this.frameIndex[pose] != null) this.setFrame(this.frameIndex[pose]);
    this.shielding = false;
    this.lastMoveName = move.label || name;
    this.lastMoveTime = 0;
    return true;
  }

  dodgeActive() {
    const move = this.moveTable[this.action?.name];
    if (!move?.invuln || !this.action) return false;
    const t = this.action.time;
    return t >= move.invuln[0] && t <= move.invuln[1];
  }

  isInvulnerable() {
    return this.invuln > 0;
  }

  // Directional hitboxes: forward / up / low / both (down-smash).
  hitboxes() {
    const move = this.moveTable[this.action?.name];
    if (!move || this.action.hitDone || !move.reach) return [];
    const t = this.action.time;
    if (t < move.active[0] || t > move.active[1]) return [];
    const w = move.reach, h = this.renderHeight * (move.heightRatio ?? 0.5);
    const kind = move.box || 'forward';
    if (kind === 'up') {
      const bw = this.renderWidth * 0.7;
      return [{
        x: this.x - bw / 2, y: this.y - this.renderHeight * 0.5 - h * 0.45,
        w: bw, h: h * 1.1,
      }];
    }
    if (kind === 'low') {
      return [{
        x: this.facing > 0 ? this.x + this.renderWidth * 0.1 : this.x - this.renderWidth * 0.1 - w,
        y: this.y + this.renderHeight * 0.05, w, h: h * 0.9,
      }];
    }
    if (kind === 'both') {
      return [
        { x: this.x + this.renderWidth * 0.15, y: this.y - h / 2 + 8, w, h },
        { x: this.x - this.renderWidth * 0.15 - w, y: this.y - h / 2 + 8, w, h },
      ];
    }
    return [{
      x: this.facing > 0 ? this.x + this.renderWidth * 0.2 : this.x - this.renderWidth * 0.2 - w,
      y: this.y - h / 2, w, h,
    }];
  }

  hitbox() {
    const boxes = this.hitboxes();
    return boxes[0] || null;
  }

  // Which tilt/smash variant does the held direction pick?
  tiltVariant(input, B) {
    if (input.isDown(...B.up)) return 'utilt';
    if (input.isDown(...B.down)) return 'dtilt';
    return 'ftilt';
  }

  smashVariant(input, B) {
    if (input.isDown(...B.up)) return 'usmash';
    if (input.isDown(...B.down)) return 'dsmash';
    return 'fsmash';
  }

  // Legacy tables (Night Hunters) only know roll + punch/golfswing: fall back
  // to those so the older game keeps its exact feel.
  get modernKit() {
    return !!(this.moveTable?.spot && this.moveTable?.ftilt && this.moveTable?.fsmash);
  }

  tryDodge(input, B, stage) {
    const dir = Number(input.isDown(...B.right)) - Number(input.isDown(...B.left));
    if (!this.onGround) {
      if (this.moveTable.airdodge && this.startMove('airdodge')) {
        this.dodgeDir = dir || this.facing;
        this.facing = this.dodgeDir || this.facing;
        this.vx = this.dodgeDir * 340;
        this.vy = Math.min(this.vy, -60);
        stage.sfx?.play('dodge');
        return true;
      }
      // Legacy fallback (Night Hunters): air roll when there is no air-dodge.
      if (!this.modernKit && this.moveTable.roll && this.startMove('roll')) {
        this.dodgeDir = dir || this.facing;
        stage.sfx?.play('roll');
        return true;
      }
      return false;
    }
    if (dir !== 0) {
      if (this.startMove('roll')) {
        this.facing = dir;
        this.dodgeDir = dir;
        this.dashTimer = 0;
        stage.sfx?.play('roll');
        return true;
      }
    } else if (this.moveTable.spot && this.startMove('spot')) {
      this.dodgeDir = 0;
      this.vx = 0;
      stage.sfx?.play('spot');
      return true;
    } else if (this.startMove('roll')) {
      // Legacy fallback: neutral Shift still rolls when there is no spot dodge.
      this.dodgeDir = this.facing;
      this.dashTimer = 0;
      stage.sfx?.play('roll');
      return true;
    }
    return false;
  }

  controls(delta, stage) {
    const input = this.input;
    if (!input) return;
    if (input.consume('Escape')) return;
    const B = this.bindings || P1_BINDINGS;

    // Shield-break / hitstun: no control.
    if (this.shieldBreakStun > 0 || this.hitstun > 0 || this.shieldstun > 0) {
      this.shielding = false;
      return;
    }

    const left = input.isDown(...B.left), right = input.isDown(...B.right);
    const dx = Number(right) - Number(left);
    const speed = 260;

    // Peek attack presses before shield so S+L / S+K / W-out-of-shield read as
    // down-tilt, down-smash, and jump — no hidden inputs while shielding.
    const jabPeek = B.jab.some((c) => input.pressed?.has(c));
    const tiltPeek = B.tilt.some((c) => input.pressed?.has(c));
    const smashPeek = input.isDown(...B.smash);
    const jumpPeek = B.jump.some((c) => input.pressed?.has(c));
    const attackOut = this.shielding && (jabPeek || tiltPeek || smashPeek || jumpPeek);
    if (attackOut) {
      this.shielding = false; // attack/jump out of shield: no drop lag
      this.dropLag = 0;
    }

    // Dodge / roll / spot / air-dodge on the roll key (also out of shield).
    const rollPressed = B.roll.some((c) => input.consume(c));
    if (rollPressed && !this.action && this.dropLag <= 0) {
      if (this.onGround && this.shielding) this.shielding = false;
      this.tryDodge(input, B, stage);
      if (this.action) return;
    }

    // Hold shield on the ground (S / ArrowDown). Legacy tables without a spot
    // dodge keep S as pure fast-fall so Night Hunters feels unchanged.
    // A fresh attack press beats the bubble so down-tilt/down-smash stay reachable.
    const wantShield = this.modernKit && this.onGround && input.isDown(...B.shield)
      && !this.action && this.dropLag <= 0 && this.shieldHP > 0
      && !jabPeek && !tiltPeek && !smashPeek;
    if (wantShield) {
      if (!this.shielding) {
        this.shielding = true;
        this.vx = 0;
        if (this.frameIndex.guard != null) this.setFrame(this.frameIndex.guard);
        stage.sfx?.play('shieldUp');
      }
      if (dx) this.facing = Math.sign(dx);
      this.vx = 0;
      // Rolling out of shield with a direction double-tap still works via dash below.
    } else if (this.shielding) {
      this.shielding = false;
      this.dropLag = SHIELD.dropLag;
    }
    if (this.shielding) return;

    if (this.dashTimer > 0) {
      this.vx = this.tapDir * 620;
    } else if (!this.action) {
      this.vx = dx * speed;
      if (dx) this.facing = Math.sign(dx);
    }

    // Double-tap a direction to dash.
    this.tapTimer = Math.max(0, this.tapTimer - delta);
    for (const code of [...B.left, ...B.right]) {
      if (input.consume(code) && !this.action && this.dropLag <= 0) {
        const dir = B.left.includes(code) ? -1 : 1;
        if (this.tapTimer > 0 && this.tapDir === dir) {
          this.dashTimer = 0.22; this.tapDir = dir; this.facing = dir;
          stage.onDash?.(this);
        } else {
          this.tapTimer = 0.28; this.tapDir = dir;
        }
      }
    }

    // Jump.
    let jumped = false;
    for (const code of B.jump) {
      if (input.consume(code) && !this.action && this.dropLag <= 0) { jumped = true; break; }
    }
    if (jumped) {
      if (this.onGround || this.jumpsLeft > 0) {
        const grounded = this.onGround;
        stage.sfx?.play(grounded ? 'jump' : 'doubleJump');
        this.vy = grounded ? -760 : -680;
        this.jumpsLeft = this.onGround ? 1 : this.jumpsLeft - 1;
        this.onGround = false;
      }
    }

    // Fast-fall in air.
    if (input.isDown(...B.shield) && !this.onGround && this.vy > 0) this.vy += 1400 * delta;

    // Jab (neutral) vs tilt (with a direction held) — melee stick logic.
    let jabPressed = false;
    for (const code of B.jab) if (input.consume(code)) { jabPressed = true; break; }
    if (jabPressed && !this.action && this.dropLag <= 0) {
      const held = input.isDown(...B.left, ...B.right, ...B.up, ...B.down);
      if (held && this.moveTable.ftilt) {
        const variant = this.tiltVariant(input, B);
        if (input.isDown(...B.left, ...B.right)) {
          const s = Number(input.isDown(...B.right)) - Number(input.isDown(...B.left));
          if (s) this.facing = s;
        }
        this.startMove(variant);
        stage.sfx?.play('tilt');
      } else {
        this.startMove(this.moveTable.jab ? 'jab' : 'punch');
        stage.sfx?.play('attack');
      }
    }

    // Dedicated tilt key (L / Period): direction picks f/up/down tilt.
    let tiltPressed = false;
    for (const code of B.tilt) if (input.consume(code)) { tiltPressed = true; break; }
    if (tiltPressed && !this.action && this.dropLag <= 0) {
      const variant = this.tiltVariant(input, B);
      if (variant === 'ftilt' && input.isDown(...B.left, ...B.right)) {
        const s = Number(input.isDown(...B.right)) - Number(input.isDown(...B.left));
        if (s) this.facing = s;
      }
      if (this.moveTable[variant]) {
        this.startMove(variant);
        stage.sfx?.play('tilt');
      } else if (this.moveTable.serve) {
        // Legacy fallback (Night Hunters shuriken / old serve): the tilt key
        // fires the spawn move when there is no tilt kit.
        this.startMove('serve');
        stage.sfx?.play('tilt');
      }
    }

    // Smash: hold to charge (windup), release to fire. Direction picks variant.
    const smashHeld = input.isDown(...B.smash);
    if (smashHeld && !this.action && this.onGround && this.dropLag <= 0) {
      this.startMove('windup');
      this.action.smashKind = this.smashVariant(input, B);
      const pose = this.moveTable[this.action.smashKind]?.pose;
      void pose;
      stage.sfx?.play('smashCharge');
    }
    if (this.action?.name === 'windup') {
      if (smashHeld) {
        this.action.charge = Math.min(MAX_CHARGE, this.action.charge + delta);
        const kind = this.smashVariant(input, B);
        this.action.smashKind = kind;
        const mv = this.moveTable[kind];
        if (mv && this.frameIndex[mv.pose] != null) this.setFrame(this.frameIndex[mv.pose]);
        if (input.isDown(...B.left, ...B.right)) {
          const s = Number(input.isDown(...B.right)) - Number(input.isDown(...B.left));
          if (s) this.facing = s;
        }
      } else {
        let kind = this.action.smashKind || 'fsmash';
        if (!this.moveTable[kind] && this.moveTable.golfswing) kind = 'golfswing';
        const charge = this.action.charge;
        this.action = null;
        // Smash attacks are grounded moves: releasing mid-air cancels.
        if (!this.onGround) {
          this.setFrame(this.frameIndex.idle ?? 0);
        } else if (this.moveTable[kind]) {
          this.startMove(kind, { charge });
          stage.sfx?.play('smashRelease');
        }
      }
    }

    // Cousins specials stay on the dummy-friendly legacy keys for P1 only.
    const isP1 = B === P1_BINDINGS || this.bindings === P1_BINDINGS;
    if (isP1) {
      // I: summon the black retriever with the red collar.
      if (input.consume('KeyI') && !this.action && this.dropLag <= 0) {
        this.startMove('retriever');
        stage.sfx?.play('summon');
      }
      // U: Todd the Vegan power.
      if (input.consume('KeyU') && this.veganGlow <= 0) {
        this.veganGlow = 5;
        this.startMove('super');
        stage.onSuper?.(this);
      }
    }
  }

  physics(delta, stage) {
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    // Dodge locomotion overrides normal run physics.
    if (this.action?.name === 'roll') {
      this.vx = this.dodgeDir * 520;
    } else if (this.action?.name === 'spot') {
      this.vx = 0;
    } else if (this.action?.name === 'airdodge') {
      this.vx = this.dodgeDir * 340;
    }
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
      if (!this.action && this.hitstun <= 0 && !this.shielding) this.vx *= Math.pow(0.001, delta);
      if (this.shielding) this.vx = 0;
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
    this.shieldstun = Math.max(0, this.shieldstun - delta);
    this.shieldBreakStun = Math.max(0, this.shieldBreakStun - delta);
    this.dropLag = Math.max(0, this.dropLag - delta);
    this.invuln = Math.max(0, this.invuln - delta);
    this.veganGlow = Math.max(0, this.veganGlow - delta);
    this.lastMoveTime += delta;
    // Shield drain while held, regen otherwise (melee-inspired).
    if (this.shielding) {
      this.shieldHP = Math.max(0, this.shieldHP - SHIELD.drain * delta);
      if (this.shieldHP <= 0) {
        this.shielding = false;
        this.shieldBreakStun = SHIELD.breakStun;
        this.hitstun = 0;
        this.vx = 0;
      }
    } else if (this.shieldBreakStun <= 0) {
      this.shieldHP = Math.min(SHIELD.max, this.shieldHP + SHIELD.regen * delta);
    }
    if (this.action) {
      const move = this.moveTable[this.action.name];
      if (!move) { this.action = null; }
      else {
        this.action.time += delta;
        // Roll / spot / air-dodge intangibility windows (melee 4-19f style).
        if (move.invuln) {
          const t = this.action.time;
          if (t >= move.invuln[0] && t <= move.invuln[1]) this.invuln = Math.max(this.invuln, 0.06);
        }
        // Punch flurry chains three quick poses when the sheet has them.
        if ((this.action.name === 'jab' || this.action.name === 'punch') && this.frameIndex.punch1) {
          const phase = Math.floor(this.action.time / move.animRate) % 3;
          this.setFrame(this.frameIndex[['punch1', 'punch2', 'punch3'][phase]]);
        } else if (this.action.name === 'windup') {
          const kind = this.action.smashKind || 'fsmash';
          const mv = this.moveTable[kind];
          if (mv && this.frameIndex[mv.pose] != null) this.setFrame(this.frameIndex[mv.pose]);
        }
        if (this.action.time >= move.duration) {
          this.action = null;
          this.setFrame(this.frameIndex.idle ?? 0);
        }
      }
    } else if (this.shieldBreakStun > 0) {
      // Dizzy: wobble on the guard frame if we have one.
      if (this.frameIndex.guard != null && Math.floor(this.shieldBreakStun * 8) % 2 === 0) {
        this.setFrame(this.frameIndex.guard);
      } else {
        this.setFrame(this.frameIndex.idle ?? 0);
      }
    } else if (this.hitstun > 0 && this.frameIndex.hurt != null) {
      this.setFrame(this.frameIndex.hurt);
    } else if (this.celebrating && this.frameIndex.victory != null) {
      this.setFrame(this.frameIndex.victory);
    } else if (this.shielding) {
      if (this.frameIndex.guard != null) this.setFrame(this.frameIndex.guard);
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
    // Dodge flicker: blink during intangibility so whiffs read clearly.
    if (this.invuln > 0 && this.action && (this.action.name === 'spot' || this.action.name === 'airdodge')) {
      void 0;
    }
  }

  respawn(stage) {
    this.percent = 0;
    this.x = stage.width / 2;
    this.y = stage.height * 0.3;
    this.vx = 0; this.vy = 0;
    this.hitstun = 0; this.action = null;
    this.shieldHP = SHIELD.max;
    this.shielding = false;
    this.shieldstun = 0;
    this.shieldBreakStun = 0;
    this.dropLag = 0;
    this.invuln = 1.2; // spawn protection: drops in blinking, can't be spawn-camped
    this.respawnTimer = 1;
  }

  update(delta, stage) {
    if (this.respawnTimer > 0) { this.respawnTimer -= delta; }
    else if (this.hitstun <= 0 && this.shieldstun <= 0 && this.shieldBreakStun <= 0) this.controls(delta, stage);
    else this.shielding = false;
    this.physics(delta, stage);
    this.advance(delta);
  }
}

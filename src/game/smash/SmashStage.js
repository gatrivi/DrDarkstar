import { AndyFighter, P1_BINDINGS, P2_BINDINGS } from './AndyFighter.js';
import { EliseoFighter } from './Eliseo.js';
import { Projectile } from './Projectile.js';
import { Retriever } from './Retriever.js';
import { SnakeSummon } from './SnakeSummon.js';
import { CollisionRain } from '../../effects/CollisionRain.js';
import { SmashSfx } from './Sfx.js';
import { SHIELD, chargeBonus, shieldstun } from './Moveset.js';

// Pure helpers (unit-tested in tests/smash.test.mjs)
export function knockback(percent, base, scaling, vegan = false) {
  const kb = (base + percent * scaling) * (vegan ? 1.5 : 1);
  return kb;
}

export function isOutOfBounds(fighter, width, height, margin = 90) {
  return (
    fighter.x < -margin || fighter.x > width + margin ||
    fighter.y < -margin || fighter.y > height + margin
  );
}

// Melee-inspired shield math, kept pure for tests.
export function shieldCost(damage) {
  return damage * SHIELD.damageMult;
}

export function blockedByShield(target) {
  return !!target?.shielding && (target.shieldHP ?? 0) > 0 && (target.shieldstun ?? 0) <= 0;
}

export function dodgedByInvuln(target) {
  return (target?.invuln ?? 0) > 0 || target?.action?.name === 'roll'
    || target?.action?.name === 'spot' || target?.action?.name === 'airdodge';
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class SmashStage {
  constructor({ input, width, height, sound, player = 'andy', mode = 'cpu' }) {
    this.width = width; this.height = height;
    this.input = input;
    this.sound = sound;
    this.sfx = new SmashSfx(sound);
    this.player = player;
    this.mode = mode; // 'cpu' (P1 vs dummy AI) | 'versus' (P1 vs P2, same keyboard)
    this.projectiles = [];
    this.dogs = [];
    this.koFlashes = []; // { x, y, time }
    this.popups = [];    // { x, y, text, color, time }
    this.ghosts = [];    // roll afterimages { x, y, facing, frame, w, h, time, tint }
    this.time = 0;
    this.ai = { timer: 0, plan: 'chase', shieldT: 0, chargeT: 0 };

    const PlayerClass = player === 'eliseo' ? EliseoFighter : AndyFighter;
    this.andy = new PlayerClass({
      input, width, height, bindings: P1_BINDINGS,
      name: player === 'eliseo' ? 'ELISEO' : 'ANDY',
      spawnX: width * 0.3,
    });
    this.dummy = new AndyFighter({
      input: mode === 'versus' ? input : null, width, height,
      bindings: P2_BINDINGS, name: mode === 'versus' ? 'P2 · DUMMY' : 'DUMMY',
      spawnX: width * 0.7,
      tint: { r: 200, g: 60, b: 90 }, // hue-shifted cousin recolor
    });

    this.ambientRain = new CollisionRain({ width, height, actor: this.andy, count: 500 });
    this.rains = [
      new CollisionRain({ width, height, actor: this.andy, count: 8000, focused: true }),
      new CollisionRain({ width, height, actor: this.dummy, count: 8000, focused: true }),
    ];
    // Rain forms the fighters' bodies: bigger, brighter drops read as a character.
    for (const rain of this.rains) Object.assign(rain.settings, { size: 1.5, reveal: 1.5, smoothing: 8 });
    this.cam = { x: width / 2, y: height * 0.45, zoom: 1.4 };
    // Fighter action hooks (called from AndyFighter.controls).
    this.onDash = () => this.sfx.play('dash');
    this.onSuper = () => this.sfx.play('super');
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'versus') {
      this.dummy.input = this.input;
      this.dummy.bindings = P2_BINDINGS;
      this.dummy.name = 'P2 · DUMMY';
    } else {
      this.dummy.input = null;
      this.dummy.name = 'DUMMY';
    }
  }

  // Floating battlefield slab, raised clear of the bottom UI, with open edges
  // a fighter can be knocked or walk off.
  get platform() {
    return { x0: this.width * 0.12, x1: this.width * 0.88, y: this.height * 0.62 };
  }

  async load() {
    await Promise.all([this.andy.load(), this.dummy.load()]);
    this.andy.scale = this.dummy.scale = this.fighterScale();
  }

  fighterScale() {
    return Math.min(5.5, this.height / 190, this.width / 140);
  }

  resize(width, height) {
    const sx = width / this.width, sy = height / this.height;
    this.width = width; this.height = height;
    for (const f of [this.andy, this.dummy]) {
      f.x *= sx; f.y *= sy;
      f.scale = this.fighterScale();
    }
    this.ambientRain.resize(width, height);
    for (const rain of this.rains) {
      rain.resize(width, height);
      rain.drops = rain.drops.map(() => rain.makeDrop(true));
    }
  }

  popup(x, y, text, color = '#fff') {
    if (this.popups.length > 24) this.popups.shift();
    this.popups.push({ x, y, text, color, time: 0 });
  }

  // Dummy "AI": chase, space, and use the full kit — jabs, tilts, charged
  // smashes, shields, and rolls — while staying on the slab.
  driveDummy(delta) {
    const d = this.dummy;
    if (this.mode !== 'cpu') return;
    if (d.hitstun > 0 || d.action || d.respawnTimer > 0 || d.shieldBreakStun > 0 || d.shieldstun > 0) return;
    const p = this.platform;
    const minX = p.x0 + 70, maxX = p.x1 - 70;
    // Never stroll off the edge; steer back to center when past the safe band.
    if (d.x < minX) { d.vx = 200; d.facing = 1; return; }
    if (d.x > maxX) { d.vx = -200; d.facing = -1; return; }

    d.moveSeed += delta;
    this.ai.timer -= delta;
    const a = this.andy;
    const dist = a.x - d.x;
    const adist = Math.abs(dist);
    const dir = Math.sign(dist) || 1;

    // React to the player's incoming attack: shield or roll away.
    const aAttacking = a.action && ['jab', 'punch', 'ftilt', 'utilt', 'dtilt', 'fsmash', 'golfswing', 'usmash', 'dsmash'].includes(a.action.name);
    if (aAttacking && adist < 190 && d.onGround && Math.random() < 0.035) {
      if (Math.random() < 0.55 && d.shieldHP > 15) {
        d.shielding = true;
        d.vx = 0;
        if (d.frameIndex.guard != null) d.setFrame(d.frameIndex.guard);
        this.ai.shieldT = 0.45 + Math.random() * 0.3;
        this.ai.plan = 'shield';
        this.ai.timer = this.ai.shieldT;
        return;
      }
      d.facing = -dir;
      d.startMove('roll');
      d.dodgeDir = -dir;
      this.sfx.play('roll');
      return;
    }
    if (this.ai.plan === 'shield') {
      d.shielding = true;
      d.vx = 0;
      if (this.ai.timer <= 0) { d.shielding = false; this.ai.plan = 'chase'; }
      return;
    }

    // Finish a started smash charge, then let controls release handle it.
    if (this.ai.plan === 'charge' && d.action?.name === 'windup') {
      this.ai.chargeT -= delta;
      d.action.charge = Math.min(1.1, (d.action.charge || 0) + delta);
      if (this.ai.chargeT <= 0) {
        const kind = d.action.smashKind || 'fsmash';
        const charge = d.action.charge;
        d.action = null;
        d.startMove(kind, { charge });
        this.sfx.play('smashRelease');
        this.ai.plan = 'chase';
      }
      return;
    }

    if (this.ai.timer > 0) {
      // Keep carrying out the current plan: drift toward the player.
      if (this.ai.plan === 'chase') {
        d.vx = dir * 190;
        d.facing = dir;
      }
      return;
    }

    // New plan every beat.
    if (adist > 150) {
      this.ai.plan = Math.random() < 0.12 ? 'jump' : 'chase';
      if (this.ai.plan === 'jump' && d.onGround) {
        d.vy = -720; d.onGround = false; d.jumpsLeft = 1;
        this.sfx.play('jump');
      }
      this.ai.timer = 0.35 + Math.random() * 0.3;
      d.vx = dir * 190;
      d.facing = dir;
      return;
    }
    // In range: pick from the kit. Up-tilt when the player is above,
    // low/down moves when they shield, smash sometimes for the pop.
    d.facing = dir;
    const r = Math.random();
    if (a.y < d.y - 60 && r < 0.3) {
      d.startMove('utilt'); this.sfx.play('tilt');
    } else if ((a.shielding || r < 0.12) && d.onGround) {
      d.startMove(r < 0.06 ? 'dsmash' : 'dtilt', r < 0.06 ? { charge: 0.2 } : undefined);
      this.sfx.play(r < 0.06 ? 'smashRelease' : 'tilt');
    } else if (r < 0.3) {
      d.startMove('windup');
      d.action.smashKind = 'fsmash';
      this.ai.plan = 'charge';
      this.ai.chargeT = 0.35 + Math.random() * 0.5;
      this.sfx.play('smashCharge');
    } else if (r < 0.55) {
      d.startMove('ftilt'); this.sfx.play('tilt');
    } else if (r < 0.8) {
      d.startMove('jab'); this.sfx.play('attack');
    } else {
      // Whiff a roll behind them to stay slippery.
      d.facing = dir;
      d.startMove('roll');
      d.dodgeDir = Math.random() < 0.5 ? dir : -dir;
      d.facing = d.dodgeDir;
      this.sfx.play('roll');
    }
    this.ai.timer = 0.4 + Math.random() * 0.35;
  }

  // Returns 'hit' | 'block' | 'dodge' | 'ignore'.
  applyHit(attacker, target, move, charge = 0) {
    if (!target || target.respawnTimer > 0) return 'ignore';
    if ((target.invuln ?? 0) > 0) {
      if (attacker.action && !attacker.action.dodgeShown) {
        attacker.action.dodgeShown = true;
        this.popup(target.x, target.y - target.renderHeight * 0.6, 'DODGE!', '#9adcff');
        this.sfx.play('dodge');
      }
      return 'dodge';
    }
    if (blockedByShield(target)) {
      const cost = shieldCost(move.damage + chargeBonus(charge).damage);
      target.shieldHP = Math.max(0, target.shieldHP - cost);
      target.shieldstun = Math.max(target.shieldstun, shieldstun(move.damage));
      // Shield pushback for both (melee-style), defender slides more.
      const push = 60 + move.damage * 9;
      const dir = attacker.facing || 1;
      target.vx = dir * push;
      attacker.vx = -dir * push * 0.35;
      target.blockFlash = 0.18;
      this.sfx.play('shieldHit');
      this.koFlashes.push({ x: target.x + dir * -10, y: target.y - 20, time: 0, kind: 'block' });
      if (target.shieldHP <= 0) {
        target.shielding = false;
        target.shieldBreakStun = SHIELD.breakStun;
        target.vy = -320;
        target.onGround = false;
        this.popup(target.x, target.y - target.renderHeight * 0.7, 'SHIELD BREAK!', '#ff5a5a');
        this.sfx.play('shieldBreak');
      } else {
        this.popup(target.x, target.y - target.renderHeight * 0.7, 'BLOCK', '#7db8ff');
      }
      return 'block';
    }
    const bonus = chargeBonus(charge);
    const damage = move.damage + (move.damage ? bonus.damage : 0);
    target.percent = Math.min(999, target.percent + damage);
    const kb = knockback(target.percent, move.base + (move.chargeable ? bonus.base : 0), move.scaling, attacker.veganGlow > 0);
    const angle = move.angle ?? -0.3;
    const dirSign = move.box === 'up' ? 1 : (attacker.facing || 1);
    const hDir = move.box === 'both' ? Math.sign(target.x - attacker.x) || (attacker.facing || 1) : dirSign;
    target.vx = hDir * kb * Math.cos(angle);
    target.vy = kb * Math.sin(angle);
    target.hitstun = Math.min(0.9, 0.15 + kb / 1400);
    target.action = null;
    target.shielding = false;
    target.onGround = false;
    target.lastMoveTime = 9;
    this.sfx.play('hit');
    this.koFlashes.push({ x: target.x, y: target.y - target.renderHeight * 0.2, time: 0, kind: 'hit' });
    const label = move.label || attacker.action?.name || 'HIT';
    const short = label.split('—')[0].split('(')[0].trim().toUpperCase().slice(0, 14);
    this.popup(target.x, target.y - target.renderHeight * 0.7, `${short} ${Math.round(damage)}%`, '#ffd34d');
    return 'hit';
  }

  update(delta, audioLevels) {
    this.time += delta;
    // Couch join: any P2 attack key drops a second human in.
    if (this.mode === 'cpu' && this.input) {
      const join = ['Comma', 'Period', 'Slash', 'Numpad1', 'Numpad2', 'Numpad3', 'ShiftRight', 'Numpad0']
        .some((c) => this.input.consume(c));
      if (join) {
        this.setMode('versus');
        this.popup(this.width / 2, this.height * 0.3, 'P2 JOINED!', '#7de08a');
      }
    }
    this.andy.update(delta, this);
    this.driveDummy(delta);
    this.dummy.update(delta, this);

    // Melee hitboxes vs the other fighter (supports multi-box down-smash).
    for (const [a, b] of [[this.andy, this.dummy], [this.dummy, this.andy]]) {
      if (!a.action || a.action.hitDone) continue;
      const boxes = typeof a.hitboxes === 'function' ? a.hitboxes() : (a.hitbox() ? [a.hitbox()] : []);
      if (!boxes.length) continue;
      const hurt = b.hurtbox;
      const touching = boxes.some((box) => boxesOverlap(box, hurt));
      if (!touching) continue;
      const move = a.moveTable[a.action.name];
      const isDodge = (b.invuln ?? 0) > 0;
      const isBlock = !isDodge && blockedByShield(b);
      a.action.hitDone = true;
      this.applyHit(a, b, move, a.action.charge || 0);
      if (!isDodge && !isBlock) void 0;
    }

    // Serve / summon spawn windows.
    for (const f of [this.andy, this.dummy]) {
      const move = f.moveTable[f.action?.name];
      if (move?.spawn && !f.action.spawned && f.action.time >= move.active[0]) {
        f.action.spawned = true;
        if (move.spawn === 'retriever') {
          const dog = new Retriever({
            x: f.x - f.facing * f.renderWidth,
            groundY: this.platform.y,
            dir: f.facing,
          });
          dog.owner = f;
          this.dogs.push(dog);
        } else if (move.spawn === 'snake') {
          const snake = new SnakeSummon({
            x: f.x - f.facing * f.renderWidth,
            groundY: this.platform.y,
            dir: f.facing,
          });
          snake.owner = f;
          this.dogs.push(snake);
        } else {
          const ball = new Projectile({
            x: f.x + f.facing * f.renderWidth * 0.5,
            y: f.y - f.renderHeight * 0.25,
            vx: f.facing * 520,
          });
          ball.owner = f;
          this.projectiles.push(ball);
        }
      }
    }

    for (const p of this.projectiles) {
      p.update(delta, this.platform, this);
      for (const f of [this.andy, this.dummy]) {
        if (f === p.owner || !p.alive || f.respawnTimer > 0) continue;
        if ((f.invuln ?? 0) > 0) continue;
        if (Math.abs(p.x - f.x) < f.renderWidth * 0.35 && Math.abs(p.y - f.y) < f.renderHeight * 0.5) {
          if (blockedByShield(f)) {
            p.alive = false;
            f.shieldHP = Math.max(0, f.shieldHP - shieldCost(5));
            f.shieldstun = Math.max(f.shieldstun, shieldstun(5));
            this.sfx.play('shieldHit');
            this.popup(f.x, f.y - f.renderHeight * 0.7, 'BLOCK', '#7db8ff');
          } else {
            p.alive = false;
            this.applyHit(p.owner ?? this.andy, f, { damage: 5, base: 180, scaling: 0.8, angle: -0.35 }, 0);
          }
        }
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);

    // Good dog: sprints the stage, bowls over anyone in the way (once each).
    for (const dog of this.dogs) {
      dog.update(delta, this);
      const box = dog.hurtbox();
      for (const f of [this.andy, this.dummy]) {
        if (dog.hit.has(f) || f === dog.owner || f.respawnTimer > 0) continue;
        if ((f.invuln ?? 0) > 0) continue;
        const hurt = f.hurtbox;
        if (boxesOverlap(box, hurt)) {
          if (blockedByShield(f)) {
            dog.hit.add(f);
            f.shieldHP = Math.max(0, f.shieldHP - shieldCost(7));
            f.shieldstun = Math.max(f.shieldstun, shieldstun(7));
            this.sfx.play('shieldHit');
            this.popup(f.x, f.y - f.renderHeight * 0.7, 'BLOCK', '#7db8ff');
          } else {
            dog.hit.add(f);
            this.applyHit(dog.owner ?? this.andy, f, dog.hitMove, 0);
          }
        }
      }
    }
    this.dogs = this.dogs.filter(d => d.alive);

    // Roll afterimages.
    for (const f of [this.andy, this.dummy]) {
      if (f.action?.name === 'roll' && f.dodgeActive()) {
        f.ghostT = (f.ghostT ?? 0) - delta;
        if (f.ghostT <= 0) {
          f.ghostT = 0.05;
          this.ghosts.push({
            x: f.x, y: f.y, facing: f.facing, frame: f.frame,
            w: f.renderWidth, h: f.renderHeight, time: 0,
            sheet: f.sheet, fw: f.frameWidth, fh: f.frameHeight,
          });
        }
      }
    }
    for (const g of this.ghosts) g.time += delta;
    this.ghosts = this.ghosts.filter(g => g.time < 0.25);

    // Blast zones → KO, lose a stock, respawn.
    for (const f of [this.andy, this.dummy]) {
      if (isOutOfBounds(f, this.width, this.height) && f.respawnTimer <= 0.01) {
        f.stocks -= 1;
        this.koFlashes.push({ x: Math.max(20, Math.min(this.width - 20, f.x)), y: Math.max(20, Math.min(this.height - 20, f.y)), time: 0, kind: 'ko' });
        this.sfx.play('ko');
        f.respawn(this);
      }
    }
    for (const flash of this.koFlashes) flash.time += delta;
    this.koFlashes = this.koFlashes.filter(f => f.time < 0.6);
    for (const pop of this.popups) pop.time += delta;
    this.popups = this.popups.filter(p => p.time < 0.9);

    this.ambientRain.update(delta, audioLevels);
    for (const rain of this.rains) rain.update(delta, audioLevels);
  }

  drawHud(ctx) {
    ctx.textAlign = 'center';
    const rows = [
      { f: this.andy, x: this.width * 0.25, color: '#7de08a', tag: this.mode === 'versus' ? 'P1' : 'P1' },
      { f: this.dummy, x: this.width * 0.75, color: '#e0708a', tag: this.mode === 'versus' ? 'P2' : 'CPU' },
    ];
    for (const { f, x, color, tag } of rows) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = color;
      ctx.fillText(`${tag} · ${f.name}`, x, 64);
      ctx.font = 'bold 34px monospace';
      const shake = f.hitstun > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.fillStyle = f.percent > 100 ? '#ff5a5a' : '#fff';
      ctx.fillText(`${Math.round(f.percent)}%`, x + shake, 100);
      ctx.font = '12px monospace';
      ctx.fillStyle = color;
      ctx.fillText('♥'.repeat(Math.max(0, f.stocks)), x, 120);
      // Shield bar (melee 60HP bubble meter).
      ctx.fillStyle = '#1a2433';
      ctx.fillRect(x - 60, 128, 120, 6);
      const shp = Math.max(0, f.shieldHP ?? SHIELD.max) / SHIELD.max;
      ctx.fillStyle = f.shieldBreakStun > 0 ? '#ff5a5a' : shp > 0.35 ? '#49bcd3' : '#e0a53c';
      ctx.fillRect(x - 60, 128, 120 * shp, 6);
      // Last move label.
      if (f.lastMoveTime < 1.2 && f.lastMoveName) {
        ctx.fillStyle = '#8aa7b5';
        ctx.fillText(f.lastMoveName.toUpperCase().slice(0, 26), x, 146);
      }
      if (f.shieldBreakStun > 0) {
        ctx.fillStyle = '#ff5a5a';
        ctx.fillText('DIZZY!', x, 160);
      }
    }
    // Smash charge bars for whichever fighter is winding up.
    for (const [f, x] of [[this.andy, this.width * 0.25], [this.dummy, this.width * 0.75]]) {
      const charge = f.action?.name === 'windup' ? (f.action.charge ?? 0) / 1.1 : 0;
      if (charge > 0) {
        const kind = (f.action.smashKind || 'fsmash').toUpperCase();
        ctx.font = '11px monospace';
        ctx.fillStyle = '#ffd34d';
        ctx.fillText(`${kind} ${Math.round(charge * 100)}%`, x, 174);
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 60, 180, 120, 8);
        ctx.fillStyle = charge >= 1 ? '#ffd34d' : '#7de08a';
        ctx.fillRect(x - 60, 180, 120 * Math.min(1, charge), 8);
      }
    }
    if (this.andy.veganGlow > 0) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#7de08a';
      ctx.fillText(`VEGAN POWER ${this.andy.veganGlow.toFixed(1)}s`, this.width * 0.25, 202);
    }
    if (this.mode === 'cpu') {
      ctx.font = '11px monospace';
      ctx.fillStyle = '#5b7183';
      ctx.fillText('P2: press , . / to join', this.width * 0.75, 202);
    }
    ctx.textAlign = 'left';
  }

  // Camera: follow the fighters, zoom in when they engage, out when they split.
  updateCamera(delta) {
    const a = this.andy, d = this.dummy;
    const dist = Math.abs(a.x - d.x);
    const targetZoom = Math.max(1.25, Math.min(1.8, this.width / (dist + 640)));
    const viewW = this.width / targetZoom, viewH = this.height / targetZoom;
    let tx = (a.x + d.x) / 2;
    tx = Math.max(viewW / 2, Math.min(this.width - viewW / 2, tx));
    let ty = this.platform.y - viewH * 0.30;
    ty = Math.max(viewH / 2 - 80, Math.min(this.height - viewH / 2 + 60, ty));
    const k = 1 - Math.exp(-delta * 5);
    this.cam.zoom += (targetZoom - this.cam.zoom) * k;
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
  }

  // Pixel-stepped pointer + name above each fighter.
  drawTag(ctx, f, color) {
    const bob = Math.sin(this.time * 3 + (f === this.andy ? 0 : 2)) * 3;
    const hx = Math.round(f.x), hy = Math.round(f.y - f.renderHeight / 2 - 30 + bob);
    ctx.fillStyle = color;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.name, hx, hy);
    ctx.fillRect(hx - 9, hy + 5, 18, 4);
    ctx.fillRect(hx - 5, hy + 9, 10, 4);
    ctx.fillRect(hx - 2, hy + 13, 4, 4);
    ctx.textAlign = 'left';
  }

  drawShieldBubble(ctx, f) {
    if (!f.shielding && (f.blockFlash ?? 0) <= 0) return;
    f.blockFlash = Math.max(0, (f.blockFlash ?? 0) - 0.016);
    const hp = Math.max(0, f.shieldHP ?? SHIELD.max) / SHIELD.max;
    const r = (f.renderHeight * 0.55) * (0.55 + hp * 0.45);
    ctx.save();
    ctx.globalAlpha = f.shielding ? 0.35 + hp * 0.25 : 0.5;
    ctx.fillStyle = f.blockFlash > 0 ? '#eafcff' : '#49bcd3';
    ctx.beginPath();
    ctx.arc(f.x, f.y - 6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = f.blockFlash > 0 ? '#ffffff' : '#9adcff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 6, r, 0, Math.PI * 2);
    ctx.stroke();
    // Bubble shine + low-HP crack hint.
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#eafcff';
    ctx.fillRect(f.x - r * 0.45, f.y - 6 - r * 0.55, r * 0.3, 3);
    if (hp < 0.35 && f.shielding) {
      ctx.strokeStyle = '#e0a53c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x - r * 0.3, f.y - 6 - r * 0.4);
      ctx.lineTo(f.x, f.y - 6);
      ctx.lineTo(f.x - r * 0.1, f.y - 6 + r * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  render(ctx, delta = 0.016) {
    this.updateCamera(delta);
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    this.ambientRain.draw(ctx);

    // Floating battlefield: chunky slab with a lit top surface and stepped underside.
    const p = this.platform;
    ctx.fillStyle = '#101b2e';
    ctx.fillRect(p.x0, p.y, p.x1 - p.x0, 18);
    ctx.fillStyle = '#0b1420';
    ctx.fillRect(p.x0 + 30, p.y + 18, (p.x1 - p.x0) - 60, 10);
    ctx.fillRect(p.x0 + 90, p.y + 28, (p.x1 - p.x0) - 180, 8);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(p.x0, p.y, p.x1 - p.x0, 4);
    ctx.fillStyle = '#49bcd3';
    ctx.fillRect(p.x0, p.y, 26, 2);
    ctx.fillRect(p.x1 - 26, p.y, 26, 2);

    // Contact shadows: a dark strip on the slab under whoever stands over it.
    for (const f of [this.andy, this.dummy]) {
      if (f.x > p.x0 && f.x < p.x1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(f.x - f.renderWidth * 0.28, p.y - 3, f.renderWidth * 0.56, 4);
      }
    }

    // Roll afterimages.
    for (const g of this.ghosts) {
      ctx.save();
      ctx.globalAlpha = 0.3 * (1 - g.time / 0.25);
      ctx.translate(g.x, g.y);
      ctx.scale(g.facing, 1);
      if (g.sheet) ctx.drawImage(g.sheet, g.frame * g.fw, 0, g.fw, g.fh, -g.w / 2, -g.h / 2, g.w, g.h);
      ctx.restore();
    }

    // The fighters: translucent pixel base with the rain forming their body.
    // Invulnerable dodgers blink.
    for (const f of [this.andy, this.dummy]) {
      if (f.respawnTimer > 0) continue;
      ctx.save();
      const blink = (f.invuln > 0 && f.action) ? (Math.floor(this.time * 24) % 2 === 0 ? 0.25 : 0.6) : 0.5;
      ctx.globalAlpha = blink;
      f.draw(ctx);
      ctx.restore();
    }

    for (const rain of this.rains) rain.draw(ctx);

    // Shield bubbles above the rain so they read clearly.
    for (const f of [this.andy, this.dummy]) {
      if (f.respawnTimer > 0) continue;
      this.drawShieldBubble(ctx, f);
    }

    // Who is who: pixel arrow + name over each head.
    this.drawTag(ctx, this.andy, '#7de08a');
    this.drawTag(ctx, this.dummy, '#e0708a');

    // Vegan glow aura.
    if (this.andy.veganGlow > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(this.time * 10) * 0.1;
      ctx.fillStyle = '#7de08a';
      ctx.fillRect(this.andy.x - this.andy.renderWidth / 2 - 6, this.andy.y - this.andy.renderHeight / 2 - 6,
        this.andy.renderWidth + 12, this.andy.renderHeight + 12);
      ctx.restore();
    }

    for (const p of this.projectiles) p.draw(ctx);

    for (const dog of this.dogs) dog.draw(ctx);

    // Attack arcs: forward slash, rising slash, low sweep, double spin.
    for (const f of [this.andy, this.dummy]) {
      const name = f.action?.name;
      if (!name || !f.action) continue;
      const move = f.moveTable[name];
      if (!move?.reach) continue;
      const t = f.action.time;
      if (t < move.active[0] || t > move.active[1] + 0.08) continue;
      const k = Math.min(1, (t - move.active[0]) / 0.16);
      const isEliseo = f.name.includes('ELISEO');
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.globalAlpha = 1 - k * 0.8;
      ctx.strokeStyle = name.includes('smash') || name === 'golfswing'
        ? (isEliseo ? '#54e6b4' : '#ffd34d')
        : name.includes('tilt') ? (isEliseo ? '#b8ffe4' : '#9adcff')
        : (isEliseo ? '#b8ffe4' : '#eafcff');
      ctx.lineWidth = (name.includes('smash') || name === 'golfswing' ? 6 : 4) - k * 3;
      ctx.beginPath();
      if (move.box === 'up' || name === 'utilt' || name === 'usmash') {
        ctx.arc(0, -20, 45 + k * 22, -2.6 + k * 1.2, -0.5 + k * 1.2);
      } else if (move.box === 'both' || name === 'dsmash') {
        ctx.arc(0, 6, 62 + k * 20, 0.15, Math.PI - 0.15);
      } else if (move.box === 'low' || name === 'dtilt') {
        ctx.scale(f.facing, 1);
        ctx.arc(24, 14, 44 + k * 18, -0.7 + k * 0.9, 0.5 + k * 0.9);
      } else {
        ctx.scale(f.facing, 1);
        ctx.arc(20, -10, 55 + k * 25, -1.5 + k * 1.6, 0.5 + k * 1.6);
      }
      ctx.stroke();
      ctx.restore();
      // Smash charge aura while winding up.
      if (f.action?.name === 'windup') {
        const c = Math.min(1, (f.action.charge || 0) / 1.1);
        ctx.save();
        ctx.globalAlpha = 0.15 + c * 0.35 + Math.sin(this.time * 14) * 0.06;
        ctx.fillStyle = c >= 1 ? '#ffd34d' : '#eafcff';
        const r = f.renderWidth * (0.6 + c * 0.25);
        ctx.fillRect(f.x - r / 2, f.y - f.renderHeight / 2 - 8, r, f.renderHeight + 16);
        ctx.restore();
      }
    }

    // Hit / KO / block flashes.
    for (const flash of this.koFlashes) {
      const k = flash.time / 0.6;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = flash.kind === 'ko' ? '#fff' : flash.kind === 'block' ? '#7db8ff' : '#ffd34d';
      ctx.lineWidth = 3;
      const r = flash.kind === 'ko' ? 40 + k * 140 : 8 + k * 40;
      for (let i = 0; i < (flash.kind === 'ko' ? 8 : 6); i++) {
        const a = (i / 8) * Math.PI * 2 + flash.time * 4;
        ctx.beginPath();
        ctx.moveTo(flash.x + Math.cos(a) * r * 0.4, flash.y + Math.sin(a) * r * 0.4);
        ctx.lineTo(flash.x + Math.cos(a) * r, flash.y + Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Combat popups.
    ctx.textAlign = 'center';
    for (const pop of this.popups) {
      const k = pop.time / 0.9;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y - k * 46);
      ctx.restore();
    }
    ctx.textAlign = 'left';

    ctx.restore();
    this.drawHud(ctx);
  }
}

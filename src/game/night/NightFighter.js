import { AndyFighter, NIGHT_BINDINGS } from '../smash/AndyFighter.js';
import { NIGHT_MOVES, ROSTER } from './Combat.js';

export class NightFighter extends AndyFighter {
  constructor({ kind, input = null, atlas, x, ground, team = 'hostile' }) {
    super({ input, width: 960, height: 600, spawnX: x, bindings: NIGHT_BINDINGS });
    this.atlas = atlas;
    this.kind = kind;
    this.team = team;
    this.moveTable = NIGHT_MOVES;
    this.invulnerable = 0;
    this.dead = false;
    this.deathTime = 0;
    this.guard = 100; this.guardBroken = 0; this.guardCooldown = 0; this.blockFlash = 0;
    this.crouching = false; // hold Down on the ground: low profile, ducks bolts
    this.cooldown = 1.3 + Math.random() * .8;
    this.setKind(kind);
    this.y = ground - this.renderHeight / 2;
    this.onGround = true;
  }

  setKind(kind) {
    this.kind = kind;
    this.name = ROSTER[kind].name;
    this.limit = ROSTER[kind].limit;
    this.color = ROSTER[kind].color;
    this.scale = 1.8;
    this.applySheet(this.atlas.sheets[ROSTER[kind].row]);
    this.frameIndex = kind === 'relic'
      ? { idle: 0, walk1: 4, walk2: 5, dash: 7, jump: 8, windup: 1 }
      : { idle: 0, walk1: 4, walk2: 5, dash: 4, jump: 0, windup: 1 };
    this.action = null;
    this.dashTimer = 0;
    this.heavyOn = false;
  }

  get feet() { return this.y + this.renderHeight / 2; }
  get hurtbox() {
    if (this.crouching) {
      // Ducked: bolts at head height whistle overhead.
      return { x: this.x - 23, y: this.feet - 57, w: 46, h: 54 };
    }
    return { x: this.x - 23, y: this.feet - 99, w: 46, h: 96 };
  }

  draw(ctx) {
    if (this.crouching && this.kind === 'relic') {
      // The relic sheet has a true crouch cel — no squash needed.
      this.setFrame(6);
      super.draw(ctx);
    } else if (!this.crouching) { super.draw(ctx); }
    else {
      // Squashed duck, feet planted.
      ctx.save();
      ctx.translate(this.x, this.feet);
      ctx.scale(this.facing * 1.12, 0.72);
      ctx.drawImage(this.sheet,
        this.frame * this.frameWidth, 0, this.frameWidth, this.frameHeight,
        -this.renderWidth / 2, -this.renderHeight, this.renderWidth, this.renderHeight);
      ctx.restore();
    }
    // E-rad whip: a live energy line extends the cast beyond the cel.
    if (this.kind === 'relic' && this.action?.name === 'relicWhip') {
      const t = this.action.time;
      if (t > .26 && t < .44) {
        const phase = Math.min(1, (t - .26) / .14);
        ctx.save(); ctx.translate(this.x, this.feet); ctx.scale(this.facing, 1);
        ctx.beginPath(); ctx.moveTo(16, -52);
        ctx.bezierCurveTo(60, -70 - 26 * Math.sin(phase * 5), 120, -30, 116 * (0.55 + 0.45 * phase), -60);
        ctx.strokeStyle = 'rgba(32,214,202,.55)'; ctx.lineWidth = 5; ctx.stroke();
        ctx.strokeStyle = '#c7ffef'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
    }
  }
  actionPose() {
    const a = this.action;
    if (!a) return 0;
    if (this.kind === 'relic') {
      if (a.name === 'relicWhip') return a.time < .14 ? 1 : a.time < .30 ? 2 : a.time < .46 ? 10 : 11;
      if (a.name === 'block') return this.blockFlash > 0 ? 3 : 9;
    }
    if (a.name === 'serve' && this.kind === 'blade') return a.time < .14 ? 6 : a.time < .27 ? 7 : 8;
    if (a.name === 'block') return this.blockFlash > 0 ? 11 : a.time < .10 ? 9 : 10;
    return this.moveTable[a.name].pose;
  }
  startMove(name, extra = {}) {
    if (this.dead || this.hitstun > 0 || (this.action && !(this.action.name === 'windup' && name === 'golfswing'))) return false;
    const move = this.moveTable[name];
    if (!move) return false;
    if (name !== 'windup') this.heavyOn = false;
    this.action = { name, time: 0, charge: 0, hitDone: false, targets: new Set(), ...extra };
    this.setFrame(this.actionPose());
    this.vx = 0;
    this.crouching = false;
    return true;
  }

  controls(delta, stage) {
    // Keep Cousins' double-tap dash, double-jump, fast-fall, charge/release and
    // roll control logic. NIGHT_BINDINGS: J attack (tap/hold), H fire,
    // K jump, L shield; H drives the projectile move for every hunter.
    if (!this.input) return;
    const source = this.input;
    if (source.isDown('KeyL', 'KeyE') && this.guardBroken <= 0 && (this.action?.name === 'block' || this.guard >= 12)) {
      if (!this.action) this.startMove('block');
      if (this.action?.name === 'block') {
        const direction = Number(source.isDown('KeyD','ArrowRight'))-Number(source.isDown('KeyA','ArrowLeft'));
        if (direction) this.facing = direction;
        this.vx = 0; this.dashTimer = 0;
        return;
      }
    } else if (this.action?.name === 'block') this.action = null;
    // Duck: hold Down on the ground while free. Low profile dodges level
    // bolts; jump, roll or attack to come back up.
    this.crouching = !!(this.onGround && !this.action && this.hitstun <= 0 &&
      source.isDown('KeyS', 'ArrowDown'));
    const whip = this.kind === 'relic';
    // NIGHT_BINDINGS: J attack (tap punch / hold heavy), H fire, K jump,
    // L shield, A/D move, S crouch, Shift roll. H drives the tilt key, whose
    // legacy fallback spawns the projectile move: shuriken, blaster bolt, or
    // (via the hook below) the relic hunter's e-rad whip.
    this.input = {
      isDown: (...codes) => source.isDown(...codes),
      consume: code => (code === 'KeyI' || code === 'KeyU') ? false : source.consume(code),
      pressed: source.pressed,
    };
    try { super.controls(delta, stage); } finally { this.input = source; }
    // Retarget the serve projectile the shared controls fired into the whip.
    if (whip && this.action?.name === 'serve') {
      this.action = { name: 'relicWhip', time: 0, charge: 0, hitDone: false, targets: new Set() };
      this.setFrame(this.actionPose());
    }
    // Leaving the duck: airborne or acting means standing.
    if (!this.onGround || this.action) this.crouching = false;
    else if (this.crouching) {
      const dx = Number(source.isDown('KeyD', 'ArrowRight')) - Number(source.isDown('KeyA', 'ArrowLeft'));
      this.vx = 0;
      if (dx) this.facing = dx;
    }
  }

  hitbox() {
    const a = this.action, move = this.moveTable[a?.name];
    if (!move?.reach || a.time < move.active[0] || a.time > move.active[1]) return null;
    if (this.kind === 'deckard' && a.name === 'golfswing') return null;
    return { x: this.facing > 0 ? this.x + 12 : this.x - 12 - move.reach, y: this.feet - 100, w: move.reach, h: 87 };
  }

  advance(delta) {
    this.hitstun = Math.max(0, this.hitstun - delta);
    this.invulnerable = Math.max(0, this.invulnerable - delta);
    this.cooldown = Math.max(0, this.cooldown - delta);
    this.blockFlash = Math.max(0,this.blockFlash-delta);
    this.guardBroken = Math.max(0,this.guardBroken-delta);
    this.guardCooldown = Math.max(0,this.guardCooldown-delta);
    if (this.action?.name === 'block') {
      this.guard = Math.max(0,this.guard-delta*12);
      if (!this.guard) { this.action=null;this.guardBroken=.9;this.hitstun=.55; }
    } else if (this.guardCooldown===0 && this.guardBroken===0) this.guard=Math.min(100,this.guard+delta*28);
    if (this.action) {
      this.action.time += delta;
      if (this.action.time >= this.moveTable[this.action.name].duration) this.action = null;
    }
    if (this.action) this.setFrame(this.actionPose());
    else if (this.hitstun > 0) this.setFrame(this.kind === 'blade' ? 3 : this.kind === 'deckard' ? 3 : 2);
    else if (this.onGround && Math.abs(this.vx) > 18) {
      this.frameTime += delta;
      if (this.kind === 'relic') {
        // The relic sheet's Walk A/B barely differ, which reads as sliding.
        // Fold the distinct dash cel into a four-beat gait for visible strides.
        const gait = [4, 5, 7, 5];
        this.setFrame(gait[Math.floor(this.frameTime / .12) % gait.length]);
      } else this.setFrame(4 + Math.floor(this.frameTime / .14) % 2);
    } else this.setFrame(0);
  }

  update(delta, stage) {
    if (this.dead) { this.deathTime += delta; this.setFrame(3); return; }
    this.respawnTimer = Math.max(0, this.respawnTimer - delta);
    if (this.hitstun <= 0 && this.respawnTimer <= 0) this.controls(delta, stage);
    if (this.action?.name === 'roll') this.vx = this.facing * 470;
    this.physics(delta, stage);
    this.advance(delta);
  }

  // Mirrors the shared fighter's physics with one addition: `stage.surfaces`
  // (topmost first) lets fighters land on one-way rooftop ledges. Kept local
  // so Smash's physics stays byte-for-byte untouched.
  physics(delta, stage) {
    this.dashTimer = Math.max(0, this.dashTimer - delta);
    const gravity = 2100;
    this.vy += gravity * delta;
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    const fallSpeed = this.vy;
    this.onGround = false;
    const footY = this.y + this.renderHeight / 2;
    const prevFootY = footY - this.vy * delta;
    const surfaces = stage.surfaces || [stage.platform];
    for (const ground of surfaces) {
      if (this.x < ground.x0 || this.x > ground.x1) continue;
      if (footY < ground.y || this.vy < 0) continue;
      // One-way ledges only catch a faller from above; jumps pass through.
      if (ground.oneWay && prevFootY > ground.y + 4) continue;
      this.y = ground.y - this.renderHeight / 2;
      this.vy = 0; this.onGround = true; this.jumpsLeft = 2;
      if (fallSpeed > 500) stage.sfx?.play('land');
      if (!this.action && this.hitstun <= 0) this.vx *= Math.pow(0.001, delta);
      break;
    }
    const minX = this.renderWidth * 0.35, maxX = stage.width - this.renderWidth * 0.35;
    if (this.x < minX || this.x > maxX) {
      if (this.hitstun <= 0) this.x = Math.max(minX, Math.min(maxX, this.x));
    }
  }

  respawn(stage) {
    super.respawn(stage);
    this.x = 180;
    this.y = stage.platform.y - this.renderHeight / 2;
    this.respawnTimer = .65;
    this.invulnerable = 1.8;
    this.invuln = 0; // Cousins dodge timer unused here; keep it cleared.
    this.dashTimer = 0;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.guard = 100; this.guardBroken = 0; this.guardCooldown = 0; this.blockFlash = 0;
    this.crouching = false;
    this.setFrame(0);
  }
}

import { AndyFighter } from '../smash/AndyFighter.js';
import { NIGHT_MOVES, ROSTER } from './Combat.js';

export class NightFighter extends AndyFighter {
  constructor({ kind, input = null, atlas, x, ground, team = 'hostile' }) {
    super({ input, width: 960, height: 600, spawnX: x });
    this.atlas = atlas;
    this.kind = kind;
    this.team = team;
    this.moveTable = NIGHT_MOVES;
    this.invulnerable = 0;
    this.dead = false;
    this.deathTime = 0;
    this.guard = 100; this.guardBroken = 0; this.guardCooldown = 0; this.blockFlash = 0;
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
    this.frameIndex = { idle: 0, walk1: 4, walk2: 5, dash: 4, jump: 0, windup: 1 };
    this.action = null;
    this.dashTimer = 0;
  }

  get feet() { return this.y + this.renderHeight / 2; }
  get hurtbox() {
    return { x: this.x - 23, y: this.feet - 99, w: 46, h: 96 };
  }
  actionPose() {
    const a = this.action;
    if (!a) return 0;
    if (a.name === 'serve' && this.kind === 'blade') return a.time < .14 ? 6 : a.time < .27 ? 7 : 8;
    if (a.name === 'block') return this.blockFlash > 0 ? 11 : a.time < .10 ? 9 : 10;
    return this.moveTable[a.name].pose;
  }
  startMove(name, extra = {}) {
    if (this.dead || this.hitstun > 0 || (this.action && !(this.action.name === 'windup' && name === 'golfswing'))) return false;
    const move = this.moveTable[name];
    if (!move) return false;
    this.action = { name, time: 0, charge: 0, hitDone: false, targets: new Set(), ...extra };
    this.setFrame(this.actionPose());
    this.vx = 0;
    return true;
  }

  controls(delta, stage) {
    // Keep Cousins' double-tap dash, double-jump, fast-fall, charge/release and
    // roll control logic. Deckard's primary button is routed to his blaster.
    if (!this.input) return;
    const source = this.input;
    if (source.isDown('KeyE') && this.guardBroken <= 0 && (this.action?.name === 'block' || this.guard >= 12)) {
      if (!this.action) this.startMove('block');
      if (this.action?.name === 'block') {
        const direction = Number(source.isDown('KeyD','ArrowRight'))-Number(source.isDown('KeyA','ArrowLeft'));
        if (direction) this.facing = direction;
        this.vx = 0; this.dashTimer = 0;
        return;
      }
    } else if (this.action?.name === 'block') this.action = null;
    const gun = this.kind === 'deckard';
    this.input = {
      isDown: (...codes) => source.isDown(...codes),
      consume: code => {
        if (code === 'KeyI' || code === 'KeyU') return false;
        if (gun && code === 'KeyJ') return false;
        if (gun && code === 'KeyL') return source.consume('KeyJ') || source.consume('KeyL');
        return source.consume(code);
      },
    };
    try { super.controls(delta, stage); } finally { this.input = source; }
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
      this.setFrame(4 + Math.floor(this.frameTime / .14) % 2);
    } else this.setFrame(0);
  }

  update(delta, stage) {
    if (this.dead) { this.deathTime += delta; this.setFrame(3); return; }
    this.respawnTimer = Math.max(0, this.respawnTimer - delta);
    if (this.hitstun <= 0 && this.respawnTimer <= 0) this.controls(delta, stage);
    if (this.action?.name === 'roll') this.vx = this.facing * 470;
    super.physics(delta, stage);
    this.advance(delta);
  }

  respawn(stage) {
    super.respawn(stage);
    this.x = 180;
    this.y = stage.platform.y - this.renderHeight / 2;
    this.respawnTimer = .65;
    this.invulnerable = 1.8;
    this.dashTimer = 0;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.guard = 100; this.guardBroken = 0; this.guardCooldown = 0; this.blockFlash = 0;
    this.setFrame(0);
  }
}

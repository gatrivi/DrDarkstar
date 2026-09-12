import { AndyFighter } from './AndyFighter.js';
import { EliseoFighter } from './Eliseo.js';
import { Projectile } from './Projectile.js';
import { Retriever } from './Retriever.js';
import { SnakeSummon } from './SnakeSummon.js';
import { CollisionRain } from '../../effects/CollisionRain.js';
import { SmashSfx } from './Sfx.js';

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

export class SmashStage {
  constructor({ input, width, height, sound, player = 'andy' }) {
    this.width = width; this.height = height;
    this.input = input;
    this.sound = sound;
    this.sfx = new SmashSfx(sound);
    this.player = player;
    this.projectiles = [];
    this.dogs = [];
    this.koFlashes = []; // { x, y, time }
    this.time = 0;

    const PlayerClass = player === 'eliseo' ? EliseoFighter : AndyFighter;
    this.andy = new PlayerClass({
      input, width, height,
      name: player === 'eliseo' ? 'ELISEO' : 'ANDY',
      spawnX: width * 0.3,
    });
    this.dummy = new AndyFighter({
      input: null, width, height, name: 'DUMMY', spawnX: width * 0.7,
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

  // Dummy "AI": amble back and forth on the platform, sometimes toward Andy.
  driveDummy(delta) {
    const d = this.dummy;
    if (d.hitstun > 0 || d.action || d.respawnTimer > 0) return;
    d.moveSeed += delta;
    const p = this.platform;
    // Never stroll off the edge; steer back to center when past the safe band.
    const minX = p.x0 + 70, maxX = p.x1 - 70;
    let wander;
    if (d.x < minX) wander = 1;
    else if (d.x > maxX) wander = -1;
    else wander = Math.sin(d.moveSeed * 0.7) > 0.2 ? Math.sign(this.andy.x - d.x) : -Math.sign(this.andy.x - d.x);
    d.vx = wander * 90;
    if (wander) d.facing = Math.sign(wander);
  }

  applyHit(attacker, target, move, charge = 0) {
    if (!target || target.respawnTimer > 0) return;
    const damage = move.damage + (move.damage ? charge * 12 : 0);
    target.percent = Math.min(999, target.percent + damage);
    const kb = knockback(target.percent, move.base + charge * 280, move.scaling, attacker.veganGlow > 0);
    const angle = move.angle;
    target.vx = attacker.facing * kb * Math.cos(angle);
    target.vy = kb * Math.sin(angle);
    target.hitstun = Math.min(0.9, 0.15 + kb / 1400);
    target.action = null;
    target.onGround = false;
    this.sfx.play('hit');
    this.koFlashes.push({ x: target.x, y: target.y - target.renderHeight * 0.2, time: 0, kind: 'hit' });
  }

  update(delta, audioLevels) {
    this.time += delta;
    this.andy.update(delta, this);
    this.driveDummy(delta);
    this.dummy.update(delta, this);

    // Melee hitboxes vs the other fighter.
    for (const [a, b] of [[this.andy, this.dummy], [this.dummy, this.andy]]) {
      const box = a.hitbox();
      if (!box) continue;
      const hurt = b.hurtbox;
      if (box.x < hurt.x + hurt.w && box.x + box.w > hurt.x && box.y < hurt.y + hurt.h && box.y + box.h > hurt.y) {
        a.action.hitDone = true;
        this.applyHit(a, b, a.moveTable[a.action.name], a.action.charge || 0);
      }
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
        if (p.alive && f.respawnTimer <= 0 && Math.abs(p.x - f.x) < f.renderWidth * 0.35 && Math.abs(p.y - f.y) < f.renderHeight * 0.5) {
          p.alive = false;
          this.applyHit(p.owner ?? this.andy, f, { damage: 5, base: 180, scaling: 0.8, angle: -0.35 }, 0);
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
        const hurt = f.hurtbox;
        if (box.x < hurt.x + hurt.w && box.x + box.w > hurt.x && box.y < hurt.y + hurt.h && box.y + box.h > hurt.y) {
          dog.hit.add(f);
          this.applyHit(dog.owner ?? this.andy, f, dog.hitMove, 0);
        }
      }
    }
    this.dogs = this.dogs.filter(d => d.alive);

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

    this.ambientRain.update(delta, audioLevels);
    for (const rain of this.rains) rain.update(delta, audioLevels);
  }

  drawHud(ctx) {
    ctx.textAlign = 'center';
    const rows = [
      { f: this.andy, x: this.width * 0.25, color: '#7de08a' },
      { f: this.dummy, x: this.width * 0.75, color: '#e0708a' },
    ];
    for (const { f, x, color } of rows) {
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = color;
      ctx.fillText(f.name, x, 64);
      ctx.font = 'bold 34px monospace';
      const shake = f.hitstun > 0 ? (Math.random() - 0.5) * 6 : 0;
      ctx.fillStyle = f.percent > 100 ? '#ff5a5a' : '#fff';
      ctx.fillText(`${Math.round(f.percent)}%`, x + shake, 100);
      ctx.font = '12px monospace';
      ctx.fillStyle = color;
      ctx.fillText('♥'.repeat(Math.max(0, f.stocks)), x, 120);
    }
    // Golf charge bar.
    const charge = this.andy.action?.name === 'windup' ? this.andy.action.charge / 1.1 : 0;
    if (charge > 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(this.width * 0.25 - 60, 132, 120, 8);
      ctx.fillStyle = charge >= 1 ? '#ffd34d' : '#7de08a';
      ctx.fillRect(this.width * 0.25 - 60, 132, 120 * Math.min(1, charge), 8);
    }
    if (this.andy.veganGlow > 0) {
      ctx.font = '12px monospace';
      ctx.fillStyle = '#7de08a';
      ctx.fillText(`VEGAN POWER ${this.andy.veganGlow.toFixed(1)}s`, this.width * 0.25, 152);
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

    // The fighters: translucent pixel base with the rain forming their body.
    for (const f of [this.andy, this.dummy]) {
      if (f.respawnTimer > 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.5;
      f.draw(ctx);
      ctx.restore();
    }

    for (const rain of this.rains) rain.draw(ctx);

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

    // Sword slash arc while the player's drive is in its active window.
    const swing = this.andy.action?.name === 'golfswing';
    if (swing) {
      const t = this.andy.action.time, move = this.andy.moveTable.golfswing;
      if (t >= move.active[0] && t <= move.active[1] + 0.08) {
        const k = Math.min(1, (t - move.active[0]) / 0.16);
        ctx.save();
        ctx.translate(this.andy.x, this.andy.y);
        ctx.scale(this.andy.facing, 1);
        ctx.globalAlpha = 1 - k * 0.8;
        ctx.strokeStyle = this.player === 'eliseo' ? '#b8ffe4' : '#eafcff';
        ctx.lineWidth = 5 - k * 3;
        ctx.beginPath();
        ctx.arc(20, -10, 55 + k * 25, -1.5 + k * 1.6, 0.5 + k * 1.6);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Hit / KO flashes.
    for (const flash of this.koFlashes) {
      const k = flash.time / 0.6;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = flash.kind === 'ko' ? '#fff' : '#ffd34d';
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

    ctx.restore();
    this.drawHud(ctx);
  }
}

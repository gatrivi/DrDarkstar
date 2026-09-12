import { CollisionRain } from '../../effects/CollisionRain.js';
import { SmashSfx } from '../smash/Sfx.js';
import { isOutOfBounds } from '../smash/SmashStage.js';
import { NightFighter } from './NightFighter.js';
import { loadAtlas } from './Atlas.js';
import { WorldRain } from './WorldRain.js';
import { shurikenRain } from './ProjectileRain.js';
import { WORLD, NIGHT_MOVES, overlaps, hitTarget, blockHit, projectileSweep, vulnerable } from './Combat.js';

export class NightStage {
  constructor({ input, sound }) {
    Object.assign(this, WORLD);
    this.input = input; this.sound = sound;
    this.sfx = new SmashSfx(sound);
    this.state = 'loading'; this.time = 0;
    this.kind = 'blade'; this.particleBodies = true;
    this.worldRainEnabled=true;this.visualFrame=0;this.visualDelta=1/60;
    this.visualAudio={bass:0,mid:0,treble:0,effect:0};
    this.fx = []; this.projectiles = []; this.enemies = []; this.rains = [];
    this.stats = { kills: 0, hits: 0, shots: 0, swaps: 0, blocks: 0 };
    this.onDash = () => this.sfx.play('dash');
    this.trails = document.createElement('canvas');
    this.trails.width = this.width; this.trails.height = this.height;
    this.trailCtx = this.trails.getContext('2d');
    this.scene=document.createElement('canvas');this.scene.width=this.width/2;this.scene.height=this.height/2;
    this.sceneCtx=this.scene.getContext('2d',{willReadFrequently:true});
    this.sceneCtx.setTransform(.5,0,0,.5,0,0);
  }
  get platform() { return { x0: 24, x1: this.width - 24, y: WORLD.ground }; }
  get actors() { return this.player ? [this.player, ...this.enemies] : []; }

  async load() {
    this.atlas = await loadAtlas();
    this.background = document.createElement('canvas');
    this.background.width = 480; this.background.height = 300;
    const ctx = this.background.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.atlas.city, 0, 0, 480, 300);
    this.worldRain=new WorldRain(this.width,this.height);
    this.reset(false);
  }
  makeRain(actor, count) {
    return new CollisionRain({ width: this.width, height: this.height, actor, count, focused: true,
      settings: { size: 1.35, reveal: 2.8, smoothing: 12, drift: .75 } });
  }
  reset(play = true) {
    this.player = new NightFighter({ kind: this.kind, input: this.input, atlas: this.atlas, x: 205, ground: WORLD.ground, team: 'hunter' });
    this.stats = { kills: 0, hits: 0, shots: 0, swaps: 0, blocks: 0 };
    this.wave = 1; this.waveDelay = 0;
    this.fx = []; this.projectiles = [];
    this.trailCtx.clearRect(0, 0, this.width, this.height);
    this.worldRain?.reset();
    this.ambientRain = new CollisionRain({ width: this.width, height: this.height, actor: this.player, count: 900,
      settings: { size: 1.1, reveal: 1.5 } });
    this.spawnWave();
    this.state = play ? 'playing' : 'ready';
  }
  spawnWave() {
    const kinds = this.wave === 1 ? ['vampire', 'replicant', 'vampire'] : ['replicant', 'vampire', 'replicant'];
    this.enemies = kinds.map((kind, i) => new NightFighter({ kind, atlas: this.atlas, x: [480, 705, 845][i], ground: WORLD.ground }));
    this.rains = [this.makeRain(this.player, 4700), ...this.enemies.map(f => this.makeRain(f, 2300))];
    this.enemies.forEach(f => { f.facing = Math.sign(this.player.x - f.x) || -1; });
    if (this.wave > 1) this.player.invulnerable = Math.max(this.player.invulnerable, 1.1);
  }
  swap(kind = this.kind === 'blade' ? 'deckard' : 'blade') {
    if (!['blade', 'deckard'].includes(kind) || kind === this.kind || !this.player) return false;
    if (this.state === 'playing' && (this.player.dead || this.player.hitstun > 0 || this.player.action?.name === 'roll')) return false;
    this.kind = kind;
    this.player.setKind(kind);
    this.stats.swaps++;
    this.rains[0].drops.forEach(d => { d.pixel = null; d.intensity = 0; });
    return true;
  }
  driveEnemy(enemy) {
    if (enemy.dead || enemy.hitstun > 0 || enemy.action) return;
    const dx = this.player.x - enemy.x, distance = Math.abs(dx);
    enemy.facing = Math.sign(dx) || enemy.facing;
    const vertical = Math.abs(this.player.feet - enemy.feet);
    if (enemy.kind === 'vampire') {
      enemy.vx = distance > 69 ? enemy.facing * 90 : 0;
      if (distance < 94 && vertical < 75 && enemy.cooldown <= 0) {
        enemy.startMove('claw'); enemy.cooldown = 1.9 + Math.random() * .5;
      }
    } else {
      enemy.vx = distance > 350 ? enemy.facing * 65 : distance < 145 ? -enemy.facing * 42 : 0;
      if (enemy.x < 70 && enemy.vx < 0 || enemy.x > 890 && enemy.vx > 0) enemy.vx = 0;
      if (distance < 460 && vertical < 115 && enemy.cooldown <= 0) {
        enemy.startMove('enemyShot'); enemy.cooldown = 2.7 + Math.random() * .6;
      }
    }
  }
  hit(attacker, target, move, charge = 0, direction) {
    if(blockHit(attacker,target,move,charge,direction)){
      this.stats.blocks++;this.sfx.play('tilt');
      this.burst(target.x+target.facing*32,target.feet-69,'#b3f6ff',12);
      return true;
    }
    if (!hitTarget(attacker, target, move, charge, direction)) return false;
    this.stats.hits++;
    this.sfx.play('hit');
    this.burst(target.x, target.feet - 57, target.kind === 'vampire' ? '#ff9361' : '#a1f5ff', 18);
    if (target.percent >= target.limit) this.defeat(target);
    return true;
  }
  defeat(target) {
    if (target.dead) return;
    this.sfx.play('ko');
    this.burst(target.x, target.feet - 45, target.kind === 'vampire' ? '#ef7352' : '#8fe6f0', 50);
    if (target.team === 'hunter') {
      target.stocks--;
      if (target.stocks > 0) target.respawn(this);
      else { target.dead = true; this.state = 'lost'; }
    } else {
      target.dead = true; target.deathTime = 0; target.action = null;
      this.stats.kills++;
      if (this.stats.kills === 6) this.state = 'won';
    }
  }
  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 170;
      this.fx.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: .35+Math.random()*.5, color });
    }
  }
  fire(owner, move, charge = 0) {
    const enemy = owner.team !== 'hunter';
    const kind = !enemy && owner.kind === 'blade' ? 'shuriken' : 'bolt';
    const shot={ x: owner.x + owner.facing * 34, y: owner.feet - 69, vx: owner.facing * (enemy ? 330 : 780),
      owner, direction: owner.facing, move, charge, kind, angle:0,cos:1,sin:0, life: 1.8, color: enemy ? '#ff727b' : kind === 'shuriken' ? '#c2f8ff' : '#ffd9a0' };
    if(kind==='shuriken')shot.rain=shurikenRain(shot,this.atlas.shurikenSamples,this.width,this.height);
    this.projectiles.push(shot);
    this.stats.shots++;
    this.sfx.play(enemy ? 'tilt' : 'smashRelease', .16);
  }
  updateCombat(delta) {
    this.player.update(delta, this);
    for (const enemy of this.enemies) {
      this.driveEnemy(enemy);
      if (enemy.action?.name === 'claw' && enemy.action.time > .29 && enemy.action.time < .42) enemy.vx = enemy.facing * 150;
      enemy.update(delta, this);
    }
    for (const attacker of this.actors) {
      if (attacker.dead || attacker.respawnTimer > 0) continue;
      const box = attacker.hitbox();
      if (box) for (const target of this.actors) {
        if (attacker.team === target.team || attacker.action.targets.has(target) || !overlaps(box, target.hurtbox)) continue;
        const action = attacker.action;
        if (this.hit(attacker, target, NIGHT_MOVES[action.name], action.charge)) action.targets.add(target);
      }
      const a = attacker.action, move = NIGHT_MOVES[a?.name];
      if (move?.active && !a.spawned && a.time >= move.active[0] &&
        (move.projectile || attacker.kind === 'deckard' && a.name === 'golfswing')) {
        a.spawned = true; this.fire(attacker, move, a.charge);
      }
    }
    for (const shot of this.projectiles) {
      const next = shot.x + shot.vx * delta, sweep = projectileSweep(shot, next);
      const targets = this.actors.filter(f => f.team !== shot.owner.team && vulnerable(f) && overlaps(sweep, f.hurtbox))
        .sort((a,b) => Math.abs(a.x - shot.x) - Math.abs(b.x - shot.x));
      if (targets[0] && this.hit(shot.owner, targets[0], shot.move, shot.charge, shot.direction)) shot.life = 0;
      shot.x = next; shot.life -= delta;
      shot.angle += delta*shot.direction*25;
      shot.cos=Math.cos(shot.angle);shot.sin=Math.sin(shot.angle);
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x > -40 && p.x < this.width + 40);
    for (const fighter of this.actors) {
      if (!fighter.dead && fighter.respawnTimer <= 0 && isOutOfBounds(fighter, this.width, this.height)) this.defeat(fighter);
    }
    if (this.state === 'playing' && this.enemies.every(f => f.dead)) {
      this.waveDelay += delta;
      if (this.waveDelay > 1.1 && this.wave < 2) { this.wave++; this.waveDelay = 0; this.spawnWave(); }
    }
  }
  update(delta, audio) {
    if (!this.player || this.state === 'paused') return;
    this.time += delta;
    this.visualFrame++;this.visualDelta=delta;
    if (this.state === 'playing') this.updateCombat(delta);
    else this.actors.filter(f => f.dead).forEach(f => { f.deathTime += delta; f.setFrame(3); });
    const effects = this.fx.length ? Math.min(.5, this.fx.length / 110) : 0;
    const levels = { ...audio, effect: Math.max(audio.effect, effects) };
    this.visualAudio=levels;
    if(this.worldRainEnabled)for(const shot of this.projectiles)shot.rain?.update(delta,levels);
    this.ambientRain.update(delta, levels);
    for (const rain of this.rains) if (!rain.actor.dead) {
      rain.settings.maxDrops=this.worldRainEnabled ? (rain.actor===this.player?2400:1100) : rain.drops.length;
      rain.update(delta, levels);
    }
    for (const p of this.fx) { p.x += p.vx * delta; p.y += p.vy * delta; p.vy += delta * 160; p.life -= delta; }
    this.fx = this.fx.filter(p => p.life > 0);
    const ctx = this.trailCtx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1-Math.exp(-delta*23)})`; ctx.fillRect(0,0,this.width,this.height);
    ctx.globalCompositeOperation = 'source-over';
    this.rains.forEach(rain => { if (!rain.actor.dead && rain.actor.respawnTimer <= 0) rain.draw(ctx); });
  }
  render(ctx) {
    if(!this.background){ctx.fillStyle='#060b16';ctx.fillRect(0,0,this.width,this.height);return;}
    ctx.imageSmoothingEnabled=false;
    if(this.worldRainEnabled){
      this.drawWorld(this.sceneCtx,true);
      this.worldRain.step(this.scene,this.visualDelta,this.visualAudio,this.visualFrame);
      this.worldRain.draw(ctx);
      // Dense local streams retain readable moving bodies within the world field.
      ctx.drawImage(this.trails,0,0);
      for(const shot of this.projectiles)shot.rain?.draw(ctx);
    }else this.drawWorld(ctx,false);
    this.drawCombatHud(ctx);
  }
  drawWorld(ctx,solid=false) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#060b16'; ctx.fillRect(0,0,this.width,this.height);
    if (!this.background) return;
    ctx.drawImage(this.background,0,0,this.width,this.height);
    ctx.fillStyle = 'rgba(2,8,18,.17)'; ctx.fillRect(0,0,this.width,this.height);
    // A slow patrol light, sign flicker, and low mist keep the city alive.
    const spinner = this.width - this.time * 24 % (this.width + 100);
    ctx.fillStyle = 'rgba(95,168,189,.045)';
    ctx.beginPath(); ctx.moveTo(spinner,160); ctx.lineTo(spinner-35,350); ctx.lineTo(spinner+20,350); ctx.fill();
    ctx.fillStyle = '#0b1622'; ctx.fillRect(spinner-14,156,28,6);
    ctx.fillStyle = '#efa66e'; ctx.fillRect(spinner-11,162,3,2); ctx.fillStyle = '#9fdef0'; ctx.fillRect(spinner+8,162,3,2);
    if (Math.sin(this.time * 8) > .96) { ctx.fillStyle='rgba(2,10,18,.33)'; ctx.fillRect(690,110,108,250); }
    if(!solid)this.ambientRain.draw(ctx);
    for (const f of this.actors) {
      if (f.dead && f.deathTime > .75 || f.respawnTimer > 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(f.x-28, this.platform.y-1,56,3);
      ctx.save();
      const deathFade = f.dead ? Math.max(0,1-f.deathTime/.75) : 1;
      ctx.globalAlpha = (f.dead ? .75 : solid ? .95 : this.particleBodies ? .34 : .88) * deathFade * (f.invulnerable > 0 && Math.floor(this.time*12)%2 ? .45 : 1);
      f.draw(ctx);
      ctx.restore();
      // Broken reflections retain the figure's outline in the wet pavement.
      ctx.save(); ctx.beginPath(); ctx.rect(0,this.platform.y,this.width,19); ctx.clip();
      ctx.translate(0,this.platform.y*1.23); ctx.scale(1,-.23); ctx.globalAlpha = .14*deathFade; f.draw(ctx); ctx.restore();
    }
    if(!solid)ctx.drawImage(this.trails,0,0);
    for (const shot of this.projectiles) this.drawProjectile(ctx,shot);
    for (const p of this.fx) { ctx.globalAlpha=Math.min(1,p.life*3);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,3,3); }
    ctx.globalAlpha=1;
  }
  drawProjectile(ctx,shot){
    if(shot.kind==='shuriken'){
      ctx.save();ctx.translate(Math.round(shot.x),Math.round(shot.y));ctx.rotate(shot.angle);
      ctx.drawImage(this.atlas.shuriken,-12,-12,24,24);ctx.restore();
      for(let i=1;i<4;i++){
        ctx.globalAlpha=.35/i;ctx.fillStyle=shot.color;
        ctx.fillRect(Math.round(shot.x-shot.direction*i*8),Math.round(shot.y+Math.sin(shot.angle-i)*3),2,2);
      }
      ctx.globalAlpha=1;return;
    }
    ctx.fillStyle=shot.color;ctx.fillRect(shot.x-(shot.vx>0?17:0),shot.y-2,17+shot.charge*12,4);
    ctx.globalAlpha=.24;ctx.fillRect(shot.x-8,shot.y-6,20,12);ctx.globalAlpha=1;
  }
  drawCombatHud(ctx){
    for (const f of this.actors) {
      if (f.dead || f.respawnTimer > 0) continue;
      const x = f.x, y = f.feet - 118;
      ctx.textAlign = 'center'; ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#020811'; ctx.fillRect(x-40,y-10,80,15);
      ctx.fillStyle = f.color; ctx.fillText(f.name, x,y);
      if (f === this.player) {
        ctx.fillRect(x-6,y+5,12,3);ctx.fillRect(x-3,y+8,6,3);
      } else {
        ctx.fillStyle = '#253245'; ctx.fillRect(x-20,y+5,40,3);
        ctx.fillStyle = f.color; ctx.fillRect(x-20,y+5,40*Math.max(0,1-f.percent/f.limit),3);
      }
      if (f.action?.name === 'enemyShot' && f.action.time < .72) {
        ctx.strokeStyle = `rgba(255,103,117,${.15+f.action.time*.5})`; ctx.setLineDash([5,7]);
        ctx.beginPath(); ctx.moveTo(x,f.feet-69);ctx.lineTo(x+f.facing*430,f.feet-69);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle='#ff9299';ctx.fillText('!',x,y-17);
      }
      if (f.action?.name === 'claw' && f.action.time < .38) {
        ctx.fillStyle='rgba(255,108,129,.6)';ctx.fillRect(x+f.facing*28-14,this.platform.y-3,28,3);
      }
      if (f.action?.name === 'windup') {
        ctx.fillStyle='#142334';ctx.fillRect(x-28,f.feet+12,56,4);
        ctx.fillStyle='#e9d3a0';ctx.fillRect(x-28,f.feet+12,56*f.action.charge/1.1,4);
      }
      if(f.team==='hunter' && (f.action?.name==='block' || f.guard<99)){
        ctx.fillStyle='#142334';ctx.fillRect(x-28,f.feet+13,56,4);
        ctx.fillStyle=f.guardBroken>0?'#fa697c':'#8ee8f2';ctx.fillRect(x-28,f.feet+13,56*f.guard/100,4);
        ctx.font='8px monospace';ctx.fillText(f.guardBroken>0?'GUARD BROKEN':'GUARD',x,f.feet+27);
      }
    }
    ctx.globalAlpha=1;
    ctx.textAlign='left';
    // Keep UI outside the battle's silhouettes.
    ctx.fillStyle='rgba(2,8,16,.78)';ctx.fillRect(18,18,165,38);
    ctx.font='11px monospace';ctx.fillStyle='#83b8c6';ctx.fillText('LOS ANGELES / 2019',30,35);
    ctx.font='9px monospace';ctx.fillStyle='#647e8d';ctx.fillText('SECTOR 09   /   NIGHT SHIFT',30,48);
  }
}

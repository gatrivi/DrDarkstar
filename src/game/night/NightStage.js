import { CollisionRain } from '../../effects/CollisionRain.js';
import { SmashSfx } from '../smash/Sfx.js';
import { isOutOfBounds } from '../smash/SmashStage.js';
import { NightFighter } from './NightFighter.js';
import { loadAtlas } from './Atlas.js';
import { WorldRain } from './WorldRain.js';
import { shurikenRain } from './ProjectileRain.js';
import { WORLD, NIGHT_MOVES, overlaps, hitTarget, blockHit, projectileSweep, vulnerable,
  SCORE, scoreForHit, scoreForKO, comboMult, bountyIdValid, bountyPayout, boardRank, boardInsert } from './Combat.js';

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
    // Demolition-style run economy (reset per hunt).
    this.callouts = [];   // DMD jackpot banners {text, sub, color, time}
    this.frenzyT = 0;     // HUNT FRENZY seconds left (2x score)
    this.koTimes = [];    // recent KO timestamps (double KO + frenzy)
    this.lastBlow = null; // {projectile, charged} — set on hunter hits
    this.challenge = null;// {target, label} from ?challenge= (set by night.js)
    this.board = this.loadBoard();
    this.lastSummary = null;
    this.onDash = () => this.sfx.play('dash');
    this.trails = document.createElement('canvas');
    this.trails.width = this.width; this.trails.height = this.height;
    this.trailCtx = this.trails.getContext('2d');
    this.scene=document.createElement('canvas');this.scene.width=this.width/2;this.scene.height=this.height/2;
    this.sceneCtx=this.scene.getContext('2d',{willReadFrequently:true});
    this.sceneCtx.setTransform(.5,0,0,.5,0,0);
  }
  loadBoard() {
    try {
      const raw = localStorage.getItem('nh-best-v1');
      const board = raw ? JSON.parse(raw) : [];
      return Array.isArray(board) ? board.filter((e) => Number.isFinite(e?.score)).slice(0, 5) : [];
    } catch { return []; }
  }

  saveBoard() {
    try { localStorage.setItem('nh-best-v1', JSON.stringify(this.board)); } catch { /* private mode */ }
  }

  // DMD jackpot banner: big pixel text over the city, ~1.4s life.
  announce(text, sub = '', color = '#ffd34d') {
    if (this.callouts.length > 3) this.callouts.shift();
    this.callouts.push({ text, sub, color, time: 0 });
  }

  fmtTime(seconds) {
    const s = Math.max(0, seconds);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
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
    this.stats = { kills: 0, hits: 0, shots: 0, swaps: 0, blocks: 0,
      score: 0, combo: 0, comboT: 0, bestCombo: 0, projKOs: 0,
      waveDamage: 0, runDamage: 0, bounty: null };
    this.runStart = this.time;
    this.waveStart = this.time;
    this.callouts = []; this.frenzyT = 0; this.koTimes = []; this.lastBlow = null;
    this.lastSummary = null;
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
  setBounty(id) {
    if (this.state !== 'bounty' || !bountyIdValid(id)) return false;
    this.stats.bounty = id;
    this.wave = 2;
    this.stats.waveDamage = 0;
    this.waveStart = this.time;
    this.waveDelay = 0;
    this.spawnWave();
    this.state = 'playing';
    return true;
  }

  // Combo-aware score add. Returns the points banked.
  bank(base) {
    const mult = comboMult(this.stats.combo) * (this.frenzyT > 0 ? SCORE.frenzyMult : 1);
    const pts = Math.round(base * mult);
    this.stats.score += pts;
    return pts;
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
    const damage = move.damage + Math.min(1.1, charge) * 18;
    if (attacker.team === 'hunter') {
      this.stats.hits++;
      this.stats.combo++;
      this.stats.comboT = SCORE.comboWindow;
      this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
      this.lastBlow = { projectile: !!move.projectile, charged: charge > 0.3 };
      this.bank(scoreForHit(damage));
    } else if (target.team === 'hunter') {
      this.stats.waveDamage += damage;
      this.stats.runDamage += damage;
      this.stats.combo = 0; // taking a hit drops the streak
    }
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
      this.stats.combo = 0;
      if (target.stocks > 0) target.respawn(this);
      else { target.dead = true; this.finishRun(false); }
    } else {
      target.dead = true; target.deathTime = 0; target.action = null;
      this.stats.kills++;
      const blow = this.lastBlow || {};
      if (blow.projectile) this.stats.projKOs++;
      const comboNow = comboMult(this.stats.combo);
      this.bank(scoreForKO(target.kind, blow.charged));
      // DOUBLE KO: two kills inside a short window.
      this.koTimes.push(this.time);
      this.koTimes = this.koTimes.filter((t) => this.time - t <= SCORE.doubleWindow);
      if (this.koTimes.length >= 2) {
        this.koTimes = [];
        this.bank(SCORE.doubleKoBonus);
        this.announce('DOUBLE KO', `+${SCORE.doubleKoBonus}`, '#ffb35a');
      }
      // SUPER JACKPOT: frenzy kill at max combo.
      if (this.frenzyT > 0 && comboNow >= SCORE.comboCap) {
        this.bank(SCORE.superJackpotBonus);
        this.announce('SUPER JACKPOT', `+${SCORE.superJackpotBonus}`, '#ffe95a');
      }
      // HUNT FRENZY: enough KOs inside the frenzy window.
      this.frenzyClock = this.frenzyClock || [];
      this.frenzyClock.push(this.time);
      this.frenzyClock = this.frenzyClock.filter((t) => this.time - t <= SCORE.frenzyWindow);
      if (this.frenzyT <= 0 && this.frenzyClock.length >= SCORE.frenzyKills) {
        this.frenzyT = SCORE.frenzyTime;
        this.frenzyClock = [];
        this.announce('HUNT FRENZY', '2X SCORE — 10S', '#ff5a7a');
        this.sfx.play('super');
      }
      if (this.stats.kills === 6) this.finishRun(true);
      else if (this.enemies.every((f) => f.dead)) this.clearWave();
    }
  }

  // Wave 1 cleared but the night isn't over: flawless bonus, then bounty pick.
  clearWave() {
    if (this.stats.waveDamage <= 0) {
      this.bank(SCORE.flawlessWaveBonus);
      this.announce('FLAWLESS WAVE', `+${SCORE.flawlessWaveBonus}`, '#8ee8f2');
    }
    this.state = 'bounty';
  }

  // Mission end (won or lost): bounty + demolition payouts, best board.
  finishRun(won) {
    if (won && this.wave >= 2) {
      if (this.stats.waveDamage <= 0) {
        this.bank(SCORE.flawlessWaveBonus);
        this.announce('FLAWLESS WAVE', `+${SCORE.flawlessWaveBonus}`, '#8ee8f2');
      }
      const ctx = {
        projKOs: this.stats.projKOs,
        wave2Time: this.time - this.waveStart,
        wave2Damage: this.stats.waveDamage,
      };
      const bountyPts = bountyPayout(this.stats.bounty, ctx);
      if (bountyPts > 0) {
        this.bank(bountyPts);
        const name = (this.stats.bounty || 'bounty').toUpperCase().replace('NIGHTOWL', 'NIGHT OWL');
        this.announce(name, `+${bountyPts}`, '#b8ffe4');
      }
      if (this.player.stocks >= 3) {
        this.bank(SCORE.demolitionBonus);
        this.announce('DEMOLITION BONUS', `NO LIVES LOST +${SCORE.demolitionBonus}`, '#ffe95a');
      }
    }
    const score = this.stats.score;
    const rank = boardRank(this.board, score);
    const record = rank === 0 && score > 0;
    this.board = boardInsert(this.board, {
      score, hunter: this.player.kind, won,
      date: new Date().toISOString().slice(0, 10),
    });
    this.saveBoard();
    this.lastSummary = { score, won, rank, record, kills: this.stats.kills,
      time: this.time - this.runStart, bestCombo: this.stats.bestCombo,
      damage: Math.round(this.stats.runDamage) };
    this.state = won ? 'won' : 'lost';
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
    // Streak and frenzy clocks tick down while hunting.
    this.stats.comboT = Math.max(0, this.stats.comboT - delta);
    if (this.stats.comboT <= 0) this.stats.combo = 0;
    this.frenzyT = Math.max(0, this.frenzyT - delta);
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
    // Wave 2 arrives only through the bounty pick (setBounty) — never auto.
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
    for (const c of this.callouts) c.time += delta;
    this.callouts = this.callouts.filter(c => c.time < 1.4);
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
    ctx.fillStyle='rgba(2,8,16,.78)';ctx.fillRect(18,18,165,52);
    ctx.font='11px monospace';ctx.fillStyle='#83b8c6';ctx.fillText('LOS ANGELES / 2019',30,35);
    ctx.font='9px monospace';ctx.fillStyle='#647e8d';ctx.fillText('SECTOR 09   /   NIGHT SHIFT',30,48);
    ctx.fillStyle = this.frenzyT > 0 ? '#ff5a7a' : '#d4e9ed';
    ctx.font = 'bold 13px monospace';
    const runLine = `${this.stats.score.toLocaleString('en-US')} PTS   ${this.fmtTime(this.time - (this.runStart ?? this.time))}`;
    ctx.fillText(runLine, 30, 63);
    if (this.challenge) {
      ctx.font = '9px monospace';ctx.fillStyle = '#e9d3a0';
      ctx.fillText(`${this.challenge.label} ${this.challenge.target.toLocaleString('en-US')}`, 188, 63);
    }
    // Live combo meter over the hunter.
    if (this.stats.combo >= 2 && this.player && !this.player.dead) {
      const mult = comboMult(this.stats.combo);
      ctx.textAlign = 'center';ctx.font = 'bold 13px monospace';
      ctx.fillStyle = this.frenzyT > 0 ? '#ff5a7a' : '#ffd34d';
      ctx.fillText(`x${mult} COMBO ${this.stats.combo}`, this.player.x, this.player.feet - 132);
      ctx.textAlign = 'left';
    }
    // DMD jackpot banners, center ice.
    ctx.textAlign = 'center';
    this.callouts.forEach((c, i) => {
      const k = c.time / 1.4, pop = c.time < 0.12 ? 0.6 + (c.time / 0.12) * 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(this.width / 2, 190 + i * 52);
      ctx.scale(pop, pop);
      ctx.font = 'bold 30px monospace';
      ctx.fillStyle = '#020811';
      ctx.fillText(c.text, 2, 2);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);
      if (c.sub) { ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#eafcff'; ctx.fillText(c.sub, 0, 24); }
      ctx.restore();
    });
    ctx.textAlign = 'left';
    // End card on canvas: the victory PNG carries the whole story.
    if ((this.state === 'won' || this.state === 'lost') && this.lastSummary) {
      const s = this.lastSummary;
      ctx.save();
      ctx.fillStyle = 'rgba(2,6,14,.72)';ctx.fillRect(0, 0, this.width, this.height);
      ctx.textAlign = 'center';
      ctx.font = 'bold 44px monospace';
      ctx.fillStyle = this.state === 'won' ? '#ffd34d' : '#ff768b';
      ctx.fillText(this.state === 'won' ? 'CASE CLOSED' : 'SIGNAL LOST', this.width / 2, 240);
      ctx.font = 'bold 22px monospace';ctx.fillStyle = '#eafcff';
      ctx.fillText(`${s.score.toLocaleString('en-US')} PTS`, this.width / 2, 282);
      ctx.font = '13px monospace';ctx.fillStyle = '#8aa7b5';
      const acc = s.kills + this.stats.shots > 0 ? Math.round(100 * s.kills / Math.max(1, this.stats.shots)) : 0;
      ctx.fillText(`${this.player.name} · ${this.fmtTime(s.time)} · ${s.kills}/6 RETIRED · BEST COMBO x${s.bestCombo} · ${s.damage}% TAKEN · ${acc}% LETHAL`, this.width / 2, 310);
      if (s.record) {
        ctx.font = 'bold 16px monospace';ctx.fillStyle = '#ffe95a';
        ctx.fillText('★ NEW DISTRICT BEST ★', this.width / 2, 340);
      } else if (this.board[0]) {
        ctx.font = '13px monospace';ctx.fillStyle = '#647e8d';
        ctx.fillText(`DISTRICT BEST ${this.board[0].score.toLocaleString('en-US')} · ${this.challenge ? `${this.challenge.label} ${this.challenge.target.toLocaleString('en-US')}` : 'BEAT IT'}`, this.width / 2, 340);
      }
      ctx.restore();
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha=1;
  }
}

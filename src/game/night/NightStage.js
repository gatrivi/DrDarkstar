import { CollisionRain } from '../../effects/CollisionRain.js';
import { SmashSfx } from '../smash/Sfx.js';
import { isOutOfBounds } from '../smash/SmashStage.js';
import { NightFighter } from './NightFighter.js';
import { loadAtlas } from './Atlas.js';
import { WorldRain } from './WorldRain.js';
import { shurikenRain } from './ProjectileRain.js';
import { WORLD, NIGHT_MOVES, overlaps, hitTarget, blockHit, projectileSweep, vulnerable, aimShot, LAYOUTS,
  SCORE, scoreForHit, scoreForKO, comboMult, bountyIdValid, bountyPayout, boardRank, boardInsert } from './Combat.js';
import { ZEN, inNoodleBar, pastGate, photoLog, filmStrip, mellowLevel, atBreach } from './ZenZone.js';
import { CANTEEN, CANTEEN_LOGS, GlassRain } from './Canteen.js';
import { RelicVista, RELIC_RELAY_X, RELIC_MURAL_X, RELIC_MEMORY_X, RUINS_EXIT_X, RUINS_ENTRY_X } from './RelicVista.js';

export class NightStage {
  constructor({ input, sound }) {
    Object.assign(this, WORLD);
    this.input = input; this.sound = sound;
    this.sfx = new SmashSfx(sound);
    this.state = 'loading'; this.time = 0;
    this.kind = 'blade'; this.particleBodies = true;
    this.layout = 'street';
    this.ledges = LAYOUTS.street.map((l) => ({ ...l }));
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
    // Uptown stroll kit: Esper photos, noodle-bar warmth, sector gate.
    this.photos = [];      // [{canvas, log}] — film strip, survives hunts
    this.viewer = null;    // Esper viewer {index, x, y, zoom} while open
    this.photoFlash = 0;
    this.noodleT = 0; this.noodleToastT = 0;
    this.resumeState = 'strolling';
    // The canteen: an interior off the noodle bar where the rain becomes
    // droplets sliding down the window glass.
    this.canteen = false;
    this.glass = new GlassRain();
    // The west breach: strolling past the west edge crossfades the city into
    // the Root Archive vista, and the relic hunter takes the walk.
    this.ruins = false; this.ruinsBlend = 0; this.streetKind = 'blade';
    this.relic = { relay: false, mural: false, memory: false, eT: 0, toastT: 0 };
    this.vista = new RelicVista();
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
  // Landing surfaces, topmost first, so a falling fighter lands on the
  // highest ledge they cross before reaching the street.
  get surfaces() {
    return [...this.ledges].sort((a, b) => a.y - b.y).concat(this.platform);
  }

  setLayout(name = 'rooftops') {
    if (!(name in LAYOUTS) || name === this.layout) return false;
    this.layout = name;
    this.ledges = LAYOUTS[name].map((l) => ({ ...l }));
    // Anyone standing on a removed ledge simply falls once physics runs.
    return true;
  }

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
    // Uptown starts quiet: no wave, only rain. The gate to Sector 10 is a
    // walk, not a button — spawnWave happens when the hunter crosses it.
    this.enemies = [];
    this.rains = [this.makeRain(this.player, 4700)];
    this.trailCtx.clearRect(0, 0, this.width, this.height);
    this.worldRain?.reset();
    this.ambientRain = new CollisionRain({ width: this.width, height: this.height, actor: this.player, count: 900,
      settings: { size: 1.1, reveal: 1.5 } });
    this.zone = 'uptown'; this.noodleT = 0; this.noodleToastT = 0;
    this.canteen = false;
    this.ruins = false; this.ruinsBlend = 0;
    this.relic = { relay: false, mural: false, memory: false, eT: 0, toastT: 0 };
    this.viewer = null;
    this.state = play ? 'strolling' : 'ready';
  }
  startHunt() {
    if (this.state !== 'strolling') return false;
    this.state = 'playing'; this.zone = 'downtown';
    this.wave = 1; this.waveStart = this.time; this.runStart = this.time;
    this.spawnWave();
    this.announce('SECTOR 10', 'HUNTING GROUNDS', '#ff768b');
    return true;
  }
  spawnWave() {
    const kinds = this.wave === 1 ? ['vampire', 'replicant', 'vampire'] : ['replicant', 'vampire', 'replicant'];
    this.enemies = kinds.map((kind, i) => new NightFighter({ kind, atlas: this.atlas, x: [700, 790, 872][i], ground: WORLD.ground }));
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

  // ---- Uptown stroll -------------------------------------------------------
  // No enemies, no score. Rain, photos, noodles. Crossing the sector gate is
  // the only way downtown.
  updateStroll(delta) {
    if (this.viewer) { this.updateViewer(delta); return; }
    // Inside the canteen the hunter sits still: the world waits outside.
    if (this.canteen) return;
    this.player.update(delta, this);
    // The noodle bar: steam, guard and a slow breath back.
    if (this.player.onGround && inNoodleBar(this.player.x)) {
      this.noodleT += delta;
      this.player.guard = Math.min(100, this.player.guard + delta * 26);
      this.player.percent = Math.max(0, this.player.percent - delta * 9);
      if (this.noodleT > .5 && this.noodleToastT <= 0) {
        this.announce('TWO, PLEASE', 'NOODLES · STEAM · NO MONSTERS', '#ffd9a0');
        this.noodleToastT = 10;
      }
    } else this.noodleT = 0;
    this.noodleToastT = Math.max(0, this.noodleToastT - delta);
    // The west breach: crossing into the Root Archive. The world's native
    // hunter takes over; walking back east hands the street back.
    if (!this.ruins && atBreach(this.player.x)) {
      this.ruins = true;
      this.streetKind = this.kind;
      if (this.kind !== 'relic') { this.kind = 'relic'; this.player.setKind('relic'); }
      // Enter the woods at its east edge so the round trip reads as one
      // continuous walk instead of teleporting deeper into the ruins.
      this.player.x = RUINS_ENTRY_X;
      this.announce('THE WEST BREACH', 'THE RAIN THINS. OLD STONE LISTENS.', '#7fffe0');
    } else if (this.ruins && this.player.x > RUINS_EXIT_X) {
      this.ruins = false;
      if (this.kind !== this.streetKind) { this.kind = this.streetKind; this.player.setKind(this.streetKind); }
      this.announce('BACK IN UPTOWN', 'THE STORM TAKES YOU BACK', '#8ee8f2');
    }
    if (this.ruins) this.updateRuins(delta);
    if (pastGate(this.player.x)) this.startHunt();
  }
  // Root Archive interactions: the e-rad wakes the relay; E reads stone.
  updateRuins(delta) {
    const r = this.relic, px = this.player.x;
    r.toastT = Math.max(0, r.toastT - delta); r.eT = Math.max(0, r.eT - delta);
    const a = this.player.action;
    if (!r.relay && a?.name === 'relicWhip' && a.time > .26 && a.time < .44 &&
        Math.abs(px - RELIC_RELAY_X) < 140 && Math.sign(RELIC_RELAY_X - px) === this.player.facing) {
      r.relay = true;
      this.announce('RELAY AWAKE', 'THE ROOTS REMEMBER THE RAIN', '#7fffe0');
    }
    if (r.eT <= 0 && this.input.isDown('KeyE')) {
      r.eT = 1.2;
      if (Math.abs(px - RELIC_MEMORY_X) < 80 && !r.memory) {
        r.memory = true;
        this.announce('MEMORY: THE CANOPY', '“WE PLANTED THESE TREES FOR SOMEONE WE WOULD NEVER MEET.”', '#c9fce0');
      } else if (Math.abs(px - RELIC_MURAL_X) < 110) {
        this.announce('ENGRAVED WALL', '“A GENERATION IS LOST ONLY WHEN NO ONE RETURNS TO LISTEN.”', '#c4deac');
      } else if (r.toastT <= 0) {
        r.toastT = 6;
        this.announce('THE ROOT ARCHIVE', 'THE WHIP WAKES OLD MACHINES. E READS THE STONE.', '#a0c4ad');
      }
    }
  }

  // The canteen is a door in the noodle bar's glow — uptown only. B steps
  // in and out; the hunt never starts from inside.
  toggleCanteen() {
    if (this.canteen) {
      this.canteen = false;
      this.sfx.play('dash');
      this.announce('BACK INTO THE RAIN', 'THE STALL KEEPS YOUR SEAT', '#8ee8f2');
      return true;
    }
    if (this.state !== 'strolling' || this.viewer || !inNoodleBar(this.player.x)) return false;
    this.canteen = true;
    this.sfx.play('dash');
    this.announce(CANTEEN_LOGS[0], CANTEEN_LOGS[1], '#ffd9a0');
    return true;
  }

  // Esper photo mode: snap the live frame, keep the last six exposures.
  snapPhoto() {
    if (this.state !== 'strolling' || this.viewer || !this.view) return false;
    const c = document.createElement('canvas'); c.width = 240; c.height = 150;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(this.view.canvas, 0, 0, 240, 150);
    const shot = { canvas: c, log: photoLog(this.photos.length) };
    this.photos = filmStrip(this.photos, shot);
    this.photoFlash = .14;
    this.announce(`PHOTO ${String(this.photos.length).padStart(2, '0')}`, shot.log, '#9fe8d8');
    return true;
  }

  toggleViewer() {
    if (this.viewer) { this.viewer = null; return true; }
    if (this.state !== 'strolling' || !this.photos.length) return false;
    this.viewer = { index: this.photos.length - 1, x: .5, y: .5, zoom: 2 };
    return true;
  }

  updateViewer(delta) {
    const v = this.viewer; if (!v) return;
    const pan = .45 * delta, i = this.input;
    if (i.isDown('ArrowLeft')) v.x -= pan;
    if (i.isDown('ArrowRight')) v.x += pan;
    if (i.isDown('ArrowUp')) v.y -= pan;
    if (i.isDown('ArrowDown')) v.y += pan;
    if (i.isDown('KeyE')) v.zoom = Math.min(6, v.zoom * (1 + delta * 1.6));
    if (i.isDown('KeyQ')) v.zoom = Math.max(1.2, v.zoom / (1 + delta * 1.6));
    v.x = Math.max(0, Math.min(1, v.x)); v.y = Math.max(0, Math.min(1, v.y));
  }

  // Combo-aware score add. Returns the points banked.
  bank(base) {
    const mult = comboMult(this.stats.combo) * (this.frenzyT > 0 ? SCORE.frenzyMult : 1);
    const pts = Math.round(base * mult);
    this.stats.score += pts;
    return pts;
  }

  swap(kind) {
    const cast = ['blade', 'deckard', 'relic'];
    if (!kind) kind = cast[(cast.indexOf(this.kind) + 1) % cast.length]; // C cycles the cast
    if (!cast.includes(kind) || kind === this.kind || !this.player) return false;
    if (this.state === 'playing' && (this.player.dead || this.player.hitstun > 0 || this.player.action?.name === 'roll')) return false;
    this.kind = kind;
    this.player.setKind(kind);
    this.stats.swaps++;
    this.rains[0].drops.forEach(d => { d.pixel = null; d.intensity = 0; });
    return true;
  }
  driveEnemy(enemy, delta = 1 / 60) {
    if (enemy.dead || enemy.hitstun > 0 || enemy.action) return;
    enemy.jumpCd = Math.max(0, (enemy.jumpCd || 0) - delta);
    // Hostiles will not pursue across the sector gate: uptown is neutral
    // ground. They hold the line (and keep shooting) from downtown side.
    if (this.player.x <= ZEN.gate && enemy.x > ZEN.gate + 24) { enemy.vx = 0; return; }
    const dx = this.player.x - enemy.x, distance = Math.abs(dx);
    enemy.facing = Math.sign(dx) || enemy.facing;
    const vertical = Math.abs(this.player.feet - enemy.feet);
    if (enemy.kind === 'vampire') {
      enemy.vx = distance > 69 ? enemy.facing * 90 : 0;
      // Ledges are a tactical perch, not a cheese spot: vampires leap after
      // a hunter standing well above them.
      const above = enemy.feet - this.player.feet;
      if (above > 70 && distance < 300 && enemy.onGround && enemy.jumpCd <= 0) {
        enemy.vy = -760; enemy.onGround = false; enemy.jumpsLeft = 1;
        enemy.jumpCd = .9;
      }
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
    const muzzleX = owner.x + owner.facing * 34, muzzleY = owner.feet - 69;
    let vx, vy = 0;
    if (enemy) {
      // Bolt guns track the hunter's chest line: ducking under a fired shot
      // works, standing still does not, and ledges turn shots into rising
      // arcs you beat by jumping or dropping off.
      const aim = aimShot(muzzleX, muzzleY, this.player.x, this.player.feet - 85, 330, 0.42);
      vx = aim.vx; vy = aim.vy;
    } else {
      vx = owner.facing * 780;
    }
    const shot={ x: muzzleX, y: muzzleY, vx, vy,
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
      this.driveEnemy(enemy, delta);
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
      const next = shot.x + shot.vx * delta, nextY = shot.y + (shot.vy || 0) * delta;
      const sweep = projectileSweep(shot, next, nextY);
      const targets = this.actors.filter(f => f.team !== shot.owner.team && vulnerable(f) && overlaps(sweep, f.hurtbox))
        .sort((a,b) => Math.abs(a.x - shot.x) - Math.abs(b.x - shot.x));
      if (targets[0] && this.hit(shot.owner, targets[0], shot.move, shot.charge, shot.direction)) shot.life = 0;
      shot.x = next; shot.y = nextY; shot.life -= delta;
      shot.angle += delta*shot.direction*25;
      shot.cos=Math.cos(shot.angle);shot.sin=Math.sin(shot.angle);
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0 && p.x > -40 && p.x < this.width + 40 && p.y > -60 && p.y < this.height + 60);
    for (const fighter of this.actors) {
      if (!fighter.dead && fighter.respawnTimer <= 0 && isOutOfBounds(fighter, this.width, this.height)) this.defeat(fighter);
    }
    // The noodle bar is neutral ground even mid-hunt: retreat left, breathe.
    if (this.player.onGround && inNoodleBar(this.player.x)) {
      this.player.percent = Math.max(0, this.player.percent - delta * 5);
      if (this.noodleToastT <= 0) { this.announce('TWO, PLEASE', 'STEADY NOW', '#ffd9a0'); this.noodleToastT = 10; }
    }
    this.noodleToastT = Math.max(0, this.noodleToastT - delta);
    // Wave 2 arrives only through the bounty pick (setBounty) — never auto.
  }
  update(delta, audio) {
    if (!this.player || this.state === 'paused') return;
    this.time += delta;
    this.visualFrame++;this.visualDelta=delta;
    if (this.state === 'strolling') this.updateStroll(delta);
    else if (this.state === 'playing') this.updateCombat(delta);
    else this.actors.filter(f => f.dead).forEach(f => { f.deathTime += delta; f.setFrame(3); });
    const effects = this.fx.length ? Math.min(.5, this.fx.length / 110) : 0;
    // Uptown is calmer; the west breach calmer still. The audio field damps,
    // so the rain visibly softens as the hunter nears (and crosses) the breach.
    const calm = this.state === 'playing' ? 1
      : this.ruins ? .2
      : .5 * (.4 + .6 * mellowLevel(this.player?.x ?? 480));
    this.ruinsBlend += ((this.ruins ? 1 : 0) - this.ruinsBlend) * Math.min(1, delta * 2.4);
    const levels = { bass: audio.bass * calm, mid: audio.mid * calm, treble: audio.treble * calm,
      effect: Math.max(audio.effect * calm, effects) };
    this.visualAudio=levels;
    // The canteen's window: the same storm, reduced to sliding droplets.
    if (this.canteen) this.glass.update(delta);
    if(this.worldRainEnabled)for(const shot of this.projectiles)shot.rain?.update(delta,levels);
    this.ambientRain.update(delta, levels);
    for (const rain of this.rains) if (!rain.actor.dead) {
      rain.settings.maxDrops=this.worldRainEnabled ? (rain.actor===this.player?2400:1100) : rain.drops.length;
      rain.update(delta, levels);
    }
    for (const p of this.fx) { p.x += p.vx * delta; p.y += p.vy * delta; p.vy += delta * 160; p.life -= delta; }
    this.fx = this.fx.filter(p => p.life > 0);
    this.photoFlash = Math.max(0, this.photoFlash - delta);
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
    this.view = ctx; // Esper photos capture the live frame.
    ctx.imageSmoothingEnabled=false;
    if (this.canteen) { this.drawCanteen(ctx); this.drawEsper(ctx); this.drawFlash(ctx); return; }
    if (this.ruinsBlend < .995) {
      if(this.worldRainEnabled){
        this.drawWorld(this.sceneCtx,true);
        this.worldRain.step(this.scene,this.visualDelta,this.visualAudio,this.visualFrame);
        this.worldRain.draw(ctx);
        // Dense local streams retain readable moving bodies within the world field.
        ctx.drawImage(this.trails,0,0);
        for(const shot of this.projectiles)shot.rain?.draw(ctx);
      }else this.drawWorld(ctx,false);
    }
    // The west breach: the lost world fades in over the city; the hunter and
    // the ambient drizzle walk with it.
    if (this.ruinsBlend > .005) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.ruinsBlend);
      this.vista.draw(ctx, this.time, this.player?.x ?? 480, this.platform.y, this.relic);
      const f = this.player;
      if (f && !f.dead) {
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(f.x - 28, this.platform.y - 1, 56, 3);
        f.draw(ctx);
      }
      ctx.restore();
    }
    this.drawCombatHud(ctx);
    this.drawEsper(ctx);
    this.drawFlash(ctx);
  }
  drawFlash(ctx) {
    if (this.photoFlash > 0) {
      ctx.fillStyle = `rgba(223,244,240,${Math.min(1, this.photoFlash * 4)})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }
  // The canteen: warm room, cold window. The city stays out there; the rain
  // becomes droplets gripping, sliding and trailing down the glass.
  drawCanteen(ctx) {
    const P = CANTEEN.pane;
    ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, this.width, this.height);
    // Ceiling shadow and a warm spill from the counter lamps.
    ctx.fillStyle = '#080a0e'; ctx.fillRect(0, 0, this.width, 130);
    ctx.fillStyle = 'rgba(255,176,96,.045)';
    ctx.fillRect(0, 300, this.width, 300);
    // --- The window. The city beyond, dimmed; the storm reduced to glass. ---
    ctx.save();
    ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    ctx.globalAlpha = .5;
    ctx.drawImage(this.background, P.x - 130, P.y - 34, P.w + 210, P.h + 120);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(4,10,20,.42)'; ctx.fillRect(P.x, P.y, P.w, P.h);
    // Far signage smears through the wet pane.
    ctx.fillStyle = 'rgba(255,110,130,.10)';
    ctx.fillRect(P.x + 40, P.y + 60, 60, 90);
    ctx.fillStyle = 'rgba(120,230,210,.09)';
    ctx.fillRect(P.x + 220, P.y + 90, 48, 70);
    // Condensation haze and the sliding droplets, then the frame back in.
    this.glass.paint(this.visualDelta);
    this.glass.haze(ctx, P);
    ctx.drawImage(this.glass.layer, P.x, P.y, P.w, P.h);
    // Reversed neon reads on the glass: the stall's sign behind you.
    ctx.save();
    ctx.translate(P.x + P.w - 46, P.y + 250); ctx.scale(-.55, .55);
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,120,90,.13)';
    ctx.fillText('NOODLES', 0, 0);
    ctx.restore();
    ctx.restore();
    // Mullions and frame.
    ctx.fillStyle = '#1a222c';
    ctx.fillRect(P.x - 8, P.y - 8, P.w + 16, 8); ctx.fillRect(P.x - 8, P.y + P.h, P.w + 16, 8);
    ctx.fillRect(P.x - 8, P.y - 8, 8, P.h + 16); ctx.fillRect(P.x + P.w, P.y - 8, 8, P.h + 16);
    ctx.fillRect(P.x + P.w / 3 - 3, P.y, 6, P.h); ctx.fillRect(P.x + 2 * P.w / 3 - 3, P.y, 6, P.h);
    // --- The counter: wood, stools, steam, warm pools of light. ---
    const counter = 468;
    ctx.fillStyle = '#241812'; ctx.fillRect(0, counter, this.width, this.height - counter);
    ctx.fillStyle = '#33221a'; ctx.fillRect(0, counter, this.width, 8);
    ctx.fillStyle = 'rgba(255,190,110,.06)'; ctx.fillRect(0, counter + 8, this.width, 3);
    // Stools.
    for (let sx = 140; sx < 520; sx += 110) {
      ctx.fillStyle = '#191218'; ctx.fillRect(sx - 3, counter - 52, 6, 52);
      ctx.fillStyle = '#2a1c22'; ctx.fillRect(sx - 16, counter - 60, 32, 9);
    }
    // The hunter's seat: silhouette and a steaming cup.
    const hx = 250;
    ctx.fillStyle = '#131017'; ctx.fillRect(hx - 14, counter - 74, 28, 74);
    ctx.fillStyle = '#17131c'; ctx.fillRect(hx - 10, counter - 96, 20, 24);
    ctx.fillStyle = '#3a2a1e'; ctx.fillRect(hx + 26, counter - 26, 10, 10);
    ctx.fillStyle = '#54371f'; ctx.fillRect(hx + 26, counter - 30, 14, 4);
    for (let s = 0; s < 3; s++) {
      const t = this.time * .8 + s * 1.7;
      ctx.fillStyle = 'rgba(230,240,246,.14)';
      ctx.fillRect(hx + 31 + Math.sin(t * 2) * 3, counter - 38 - ((t * 16) % 34), 2, 2);
    }
    // Two hanging lamps, cones of warm light down to the counter.
    for (const lx of [250, 470]) {
      ctx.strokeStyle = '#1a1410'; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 108); ctx.stroke();
      ctx.fillStyle = '#2a2018'; ctx.fillRect(lx - 14, 108, 28, 12);
      const on = Math.sin(this.time * 7 + lx) > -.96;
      ctx.fillStyle = on ? '#ffd9a0' : '#4a3a28';
      ctx.beginPath(); ctx.arc(lx, 122, 5, 0, Math.PI * 2); ctx.fill();
      if (on) {
        const cone = ctx.createLinearGradient(0, 122, 0, counter);
        cone.addColorStop(0, 'rgba(255,190,110,.16)'); cone.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = cone;
        ctx.beginPath(); ctx.moveTo(lx - 6, 122); ctx.lineTo(lx + 6, 122);
        ctx.lineTo(lx + 46, counter); ctx.lineTo(lx - 46, counter); ctx.closePath(); ctx.fill();
      }
    }
    // Interior HUD: where you are, and how to leave.
    ctx.fillStyle = 'rgba(2,8,16,.78)'; ctx.fillRect(18, 18, 200, 52);
    ctx.font = '11px monospace'; ctx.fillStyle = '#e9c9a0'; ctx.fillText('THE CANTEEN', 30, 35);
    ctx.font = '9px monospace'; ctx.fillStyle = '#8a7460'; ctx.fillText('LOS ANGELES / 2019 · RAIN ON GLASS', 30, 48);
    ctx.fillStyle = '#e9d3a0'; ctx.font = 'bold 11px monospace';
    ctx.fillText('TWO, PLEASE — SIT A WHILE', 30, 63);
    ctx.font = '9px monospace'; ctx.fillStyle = '#6a7e8d';
    ctx.fillText('B BACK TO THE STREET · F PHOTO · G ESPER', 30, 77);
  }
  // Film strip bottom-right; while open, the Esper viewer owns the frame.
  drawEsper(ctx) {
    if (!this.photos.length) return;
    const w = 48, h = 30, gap = 6;
    const x0 = this.width - 18 - this.photos.length * (w + gap), y0 = this.height - h - 14;
    this.photos.forEach((p, i) => {
      ctx.drawImage(p.canvas, x0 + i * (w + gap), y0, w, h);
      ctx.strokeStyle = this.viewer?.index === i ? '#9fe8d8' : '#3a5462';
      ctx.strokeRect(x0 + i * (w + gap) + .5, y0 + .5, w - 1, h - 1);
    });
    const v = this.viewer;
    if (!v) return;
    const p = this.photos[v.index];
    const sw = 240 / v.zoom, sh = 150 / v.zoom;
    const sx = Math.max(0, Math.min(240 - sw, v.x * 240 - sw / 2));
    const sy = Math.max(0, Math.min(150 - sh, v.y * 150 - sh / 2));
    const dw = 480, dh = 300, dx = (this.width - dw) / 2, dy = 118;
    ctx.fillStyle = 'rgba(3,10,16,.88)'; ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#02131a'; ctx.fillRect(dx - 8, dy - 8, dw + 16, dh + 16);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(p.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.fillStyle = 'rgba(120,255,214,.06)';
    for (let ly = dy; ly < dy + dh; ly += 4) ctx.fillRect(dx, ly, dw, 1);
    ctx.strokeStyle = 'rgba(140,255,220,.45)';
    ctx.strokeRect(dx + dw / 2 - 30, dy + dh / 2 - 30, 60, 60);
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = '#7dffc9';
    ctx.fillText(`ESPER ${String(v.index + 1).padStart(2, '0')} / ${String(this.photos.length).padStart(2, '0')}  ZOOM ${v.zoom.toFixed(1)}x`, dx, dy - 14);
    ctx.fillStyle = '#c9fff0'; ctx.font = '10px monospace';
    ctx.fillText(p.log, dx, dy + dh + 18);
    ctx.font = '9px monospace'; ctx.fillStyle = '#5f8a7f';
    ctx.fillText('ARROWS PAN · Q/E ZOOM · WHEEL ZOOM · G CLOSE', dx, dy + dh + 32);
    ctx.textAlign = 'left';
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
    // Rooftop slabs: dark concrete, lit lip, a spark of neon on the corner.
    for (const l of this.ledges) {
      const w = l.x1 - l.x0;
      ctx.fillStyle = '#0b1522';
      ctx.fillRect(l.x0, l.y, w, 9);
      ctx.fillStyle = '#091019';
      ctx.fillRect(l.x0 + 5, l.y + 9, w - 10, 7);
      ctx.fillStyle = l.oneWay ? '#2c4a60' : '#1e3a5f';
      ctx.fillRect(l.x0, l.y, w, 3);
      ctx.fillStyle = '#5fd0e0';
      ctx.fillRect(l.x0 + 4, l.y, Math.min(20, w / 3), 2);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.fillRect(l.x0 + 8, l.y + 16, w - 16, 3);
    }
    // Uptown sanctuary: a noodle stall, warm light against all the cyan.
    const nx = ZEN.noodleX, ny = this.platform.y;
    ctx.fillStyle = '#0c1219'; ctx.fillRect(nx - 44, ny - 78, 88, 78);
    ctx.fillStyle = '#131b26'; ctx.fillRect(nx - 46, ny - 86, 92, 10);
    const flick = Math.sin(this.time * 11) > -.92;
    ctx.fillStyle = flick ? '#ffd9a0' : '#5a4a38'; // window light
    ctx.fillRect(nx - 34, ny - 62, 68, 30);
    ctx.fillStyle = '#1a1210';
    for (let bx = nx - 30; bx < nx + 34; bx += 12) ctx.fillRect(bx, ny - 62, 3, 30);
    ctx.fillStyle = '#0c1219'; ctx.fillRect(nx - 40, ny - 58, 6, 58); ctx.fillRect(nx + 34, ny - 58, 6, 58);
    ctx.fillStyle = 'rgba(255,196,120,.07)'; ctx.fillRect(nx - 52, ny - 2, 104, 3);
    if (flick) {
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#ff9d6b'; ctx.fillText('NOODLES', nx, ny - 92);
      ctx.textAlign = 'left';
    }
    for (let s = 0; s < 3; s++) {
      const t = this.time * .9 + s * 2.1;
      ctx.fillStyle = 'rgba(226,238,244,.16)';
      ctx.fillRect(nx - 10 + Math.sin(t) * 9 + s * 9, ny - 70 - ((t * 14) % 40), 3, 3);
    }
    // Sector gate: the line between the stroll and the hunt.
    const gate = ZEN.gate, pulse = .5 + .5 * Math.sin(this.time * 2.2);
    ctx.save();
    ctx.globalAlpha = .5 + pulse * .5;
    ctx.fillStyle = '#ff5a7a';
    for (let gy = 120; gy < ny; gy += 12) ctx.fillRect(gate - 1, gy, 2, 7);
    ctx.globalAlpha = .12 + pulse * .1;
    ctx.fillRect(gate - 7, 120, 14, ny - 120);
    ctx.restore();
    ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255,122,139,${.55 + pulse * .45})`;
    ctx.fillText('SECTOR 10', gate, 112);
    if (this.state === 'strolling') {
      ctx.font = '8px monospace';
      ctx.fillStyle = `rgba(255,164,178,${.35 + pulse * .3})`;
      ctx.fillText('WALK THROUGH TO HUNT', gate, 102);
    }
    ctx.textAlign = 'left';
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
    ctx.fillStyle=shot.color;
    if (shot.vy) {
      // Angled bolt: draw along its flight path.
      ctx.save();
      ctx.translate(Math.round(shot.x), Math.round(shot.y));
      ctx.rotate(Math.atan2(shot.vy, shot.vx));
      ctx.fillRect(shot.vx>0?-17:0,-2,17+shot.charge*12,4);
      ctx.globalAlpha=.24;ctx.fillRect(-8,-6,20,12);ctx.globalAlpha=1;
      ctx.restore();
      return;
    }
    ctx.fillRect(shot.x-(shot.vx>0?17:0),shot.y-2,17+shot.charge*12,4);
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
    const strolling = this.state === 'strolling';
    const runLine = strolling
      ? 'UPTOWN STROLL · RAIN · NOODLES · NO CASES'
      : `${this.stats.score.toLocaleString('en-US')} PTS   ${this.fmtTime(this.time - (this.runStart ?? this.time))}`;
    ctx.fillStyle = strolling ? '#8ee8f2' : (this.frenzyT > 0 ? '#ff5a7a' : '#d4e9ed');
    ctx.fillText(runLine, 30, 63);
    if (strolling) {
      ctx.font = '9px monospace'; ctx.fillStyle = '#647e8d';
      ctx.fillText('F PHOTO · G ESPER · B CANTEEN · WALK RIGHT PAST THE GATE TO HUNT', 30, 77);
    }
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

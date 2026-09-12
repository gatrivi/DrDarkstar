// Procedural Smash-style sound effects, synthesized on the shared AudioField's
// effects bus — no audio files, just oscillators and filtered noise bursts.
export class SmashSfx {
  constructor(field) {
    this.field = field;
    this.noise = null;   // one second of white noise, reused by every burst
    this.last = {};      // per-sound cooldown so spammy keys don't stack up
  }

  // Cooldown keys off game time via the audio clock; silently no-op before the
  // AudioContext exists (created by AudioField.enable at startup).
  play(name, minGap = 0.04) {
    const ctx = this.field?.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - (this.last[name] ?? -1) < minGap) return;
    this.last[name] = now;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    try { this[name](ctx, now); } catch { /* audio is decorative */ }
  }

  // Pitched blip with an exponential drop-off envelope.
  blip(ctx, now, { f0, f1 = f0, dur, vol, type = 'sine', delay = 0 }) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now + delay);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + delay + dur);
    env.gain.setValueAtTime(vol, now + delay);
    env.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
    osc.connect(env); env.connect(this.field.effects);
    osc.start(now + delay); osc.stop(now + delay + dur + 0.02);
  }

  // Filtered noise burst; the band sweep is what turns noise into whoosh/thud/boom.
  burst(ctx, now, { dur, vol, f0, f1, q = 1, type = 'bandpass' }) {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), now + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter); filter.connect(env); env.connect(this.field.effects);
    src.start(now); src.stop(now + dur + 0.02);
  }

  dash(ctx, now)      { this.burst(ctx, now, { dur: 0.18, vol: 0.28, f0: 500, f1: 2400, q: 1.5 }); }
  roll(ctx, now)      { this.burst(ctx, now, { dur: 0.24, vol: 0.18, f0: 280, f1: 900, q: 2 }); }
  dodge(ctx, now)     { this.burst(ctx, now, { dur: 0.2, vol: 0.16, f0: 900, f1: 300, q: 2 }); }
  spot(ctx, now)      { this.burst(ctx, now, { dur: 0.1, vol: 0.14, f0: 1200, f1: 500, q: 2 }); }
  land(ctx, now)      { this.blip(ctx, now, { f0: 150, f1: 65, dur: 0.09, vol: 0.22, type: 'sine' }); }
  shieldUp(ctx, now)  { this.blip(ctx, now, { f0: 380, f1: 520, dur: 0.08, vol: 0.1, type: 'triangle' }); }

  // Shield block: bright metallic "ting" over a low thud.
  shieldHit(ctx, now) {
    this.blip(ctx, now, { f0: 980, f1: 640, dur: 0.09, vol: 0.28, type: 'triangle' });
    this.blip(ctx, now, { f0: 200, f1: 120, dur: 0.1, vol: 0.25, type: 'sine' });
  }

  // Shield break: glass shatter + dizzy wobble.
  shieldBreak(ctx, now) {
    this.burst(ctx, now, { dur: 0.35, vol: 0.45, f0: 3200, f1: 500, q: 0.8 });
    this.blip(ctx, now, { f0: 700, f1: 90, dur: 0.5, vol: 0.3, type: 'sawtooth' });
  }

  jump(ctx, now) {
    this.blip(ctx, now, { f0: 260, f1: 560, dur: 0.14, vol: 0.16, type: 'square' });
  }
  doubleJump(ctx, now) {
    this.blip(ctx, now, { f0: 420, f1: 760, dur: 0.1, vol: 0.15, type: 'square' });
    this.blip(ctx, now, { f0: 560, f1: 980, dur: 0.1, vol: 0.13, type: 'square', delay: 0.06 });
  }

  // J — quick auto-attack: a snap of noise over a low thump.
  attack(ctx, now) {
    this.burst(ctx, now, { dur: 0.07, vol: 0.3, f0: 1800, f1: 600, q: 0.8 });
    this.blip(ctx, now, { f0: 190, f1: 90, dur: 0.08, vol: 0.3, type: 'sine' });
  }

  // L — tilt poke: the ping-pong "tok".
  tilt(ctx, now) {
    this.blip(ctx, now, { f0: 660, f1: 320, dur: 0.07, vol: 0.25, type: 'triangle' });
    this.burst(ctx, now, { dur: 0.04, vol: 0.15, f0: 2600, f1: 1400, q: 2 });
  }

  // K press — smash charge starts: rising metallic whine.
  smashCharge(ctx, now) {
    this.blip(ctx, now, { f0: 220, f1: 620, dur: 0.35, vol: 0.12, type: 'sawtooth' });
    this.blip(ctx, now, { f0: 900, f1: 1500, dur: 0.3, vol: 0.06, type: 'triangle' });
  }

  // K release — the smash: big descending swoosh plus a blade ring.
  smashRelease(ctx, now) {
    this.burst(ctx, now, { dur: 0.28, vol: 0.4, f0: 2600, f1: 260, q: 1.2 });
    this.blip(ctx, now, { f0: 1500, f1: 520, dur: 0.2, vol: 0.14, type: 'triangle' });
    this.blip(ctx, now, { f0: 110, f1: 55, dur: 0.22, vol: 0.3, type: 'sine' });
  }

  // I — whistle summons: two-note trill.
  summon(ctx, now) {
    this.blip(ctx, now, { f0: 1400, f1: 2000, dur: 0.12, vol: 0.14, type: 'sine' });
    this.blip(ctx, now, { f0: 1900, f1: 1300, dur: 0.16, vol: 0.12, type: 'sine', delay: 0.13 });
  }

  // U — super: rising power chord.
  super(ctx, now) {
    for (const [f, d] of [[220, 0], [330, 0.04], [440, 0.08]]) {
      this.blip(ctx, now, { f0: f * 0.75, f1: f * 1.5, dur: 0.4, vol: 0.12, type: 'sawtooth', delay: d });
    }
  }

  // Connect — impact: crunchy snap plus a low body thud.
  hit(ctx, now) {
    this.burst(ctx, now, { dur: 0.12, vol: 0.5, f0: 2200, f1: 400, q: 0.7 });
    this.blip(ctx, now, { f0: 210, f1: 50, dur: 0.2, vol: 0.55, type: 'sine' });
  }

  // Blast zone — KO explosion: long boom with a falling saw.
  ko(ctx, now) {
    this.burst(ctx, now, { dur: 0.6, vol: 0.55, f0: 900, f1: 60, q: 0.5 });
    this.blip(ctx, now, { f0: 420, f1: 40, dur: 0.5, vol: 0.4, type: 'sawtooth' });
    this.blip(ctx, now, { f0: 1200, f1: 200, dur: 0.3, vol: 0.15, type: 'square', delay: 0.05 });
  }
}

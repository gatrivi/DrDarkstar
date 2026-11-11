// CPU opponent: presses keys on a virtual pad instead of poking fighter
// state, so it plays through the exact same move code as a human and can
// never do anything a player can't.

// Same surface the fighters read from Input: isDown / consume / pressed.
export class VirtualPad {
  constructor() { this.down = new Set(); this.pressed = new Set(); }
  isDown(...codes) { return codes.some((code) => this.down.has(code)); }
  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }
  // Make exactly `codes` held; newly held keys count as fresh presses.
  hold(codes) {
    for (const code of [...this.down]) if (!codes.includes(code)) this.down.delete(code);
    for (const code of codes) {
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    }
  }
  tap(code) { if (code) this.pressed.add(code); }
  endFrame() { this.pressed.clear(); }
  clear() { this.down.clear(); this.pressed.clear(); }
}

export class CpuBrain {
  constructor(random = Math.random) {
    this.pad = new VirtualPad();
    this.random = random;
    this.reset();
  }

  reset() {
    this.pad.clear();
    this.think = 0;     // reaction delay before the next decision
    this.cooldown = 0.8; // breather between attacks so the CPU stays beatable
    this.move = 0;      // -1 / 0 / 1 walk direction
    this.plan = null;   // { kind, time, dir } multi-frame inputs (smash charge, shield, aerial)
  }

  update(delta, me, foe, stage) {
    const B = me.bindings;
    const key = (action) => B[action]?.[0];
    const held = [];
    const toward = (dir) => key(dir < 0 ? 'left' : 'right');
    this.think -= delta;
    this.cooldown -= delta;

    if (me.respawnTimer > 0 || stage.matchOver || me.hitstun > 0 || me.shieldBreakStun > 0) {
      this.pad.hold([]);
      this.plan = null;
      return;
    }

    const plat = stage.platform;
    const dx = foe.x - me.x, adx = Math.abs(dx), dir = Math.sign(dx) || me.facing;
    const reach = me.renderWidth * 0.85;

    // Off the slab: drift home and spend jumps on the way down.
    if (me.x < plat.x0 || me.x > plat.x1) {
      if (!me.onGround) {
        held.push(toward(Math.sign(stage.width / 2 - me.x)));
        if (me.vy > 0 && me.jumpsLeft > 0 && me.y > plat.y - me.renderHeight) this.pad.tap(key('jump'));
        this.pad.hold(held.filter(Boolean));
        this.plan = null;
        return;
      }
    }

    // Multi-frame plans: keep holding until their time runs out.
    if (this.plan) {
      this.plan.time -= delta;
      const p = this.plan;
      if (p.kind === 'smash') held.push(key('smash'), p.dir && toward(p.dir));
      if (p.kind === 'shield') held.push(key('shield'));
      if (p.kind === 'aerial' && p.time <= 0 && !me.onGround) {
        held.push(toward(dir));
        this.pad.tap(key('jab'));
      }
      if (p.time <= 0) this.plan = null;
      this.pad.hold(held.filter(Boolean));
      return;
    }

    const foeBusy = foe.respawnTimer > 0 || (foe.invuln ?? 0) > 0.3;
    if (this.think <= 0) {
      this.think = 0.12 + this.random() * 0.16;
      const r = this.random();
      // Read an incoming swing: shield or roll out of some of them.
      if (foe.action && foe.action.name !== 'windup' && adx < reach * 1.6 && me.onGround && r < 0.3) {
        if (r < 0.2) this.plan = { kind: 'shield', time: 0.3 + this.random() * 0.2 };
        else { this.pad.tap(key('roll')); this.pad.hold([toward(-dir)].filter(Boolean)); }
        return;
      }
      if (foeBusy) this.move = Math.abs(stage.width / 2 - me.x) > 40 ? Math.sign(stage.width / 2 - me.x) : 0;
      else if (adx > reach) this.move = dir;
      else {
        this.move = 0;
        if (this.cooldown <= 0 && !me.action) held.push(...this.attack(me, foe, dir, key));
      }
    }
    // Never walk off the edge after a foe that is out over the blast zone.
    const nextX = me.x + this.move * 40;
    if (nextX < plat.x0 + 10 || nextX > plat.x1 - 10) this.move = 0;
    if (this.move) held.push(toward(this.move));
    if (this.plan?.kind === 'smash') held.push(key('smash'), toward(this.plan.dir));
    this.pad.hold(held.filter(Boolean));
  }

  // Taps the attack key(s); returns the direction keys to hold this frame.
  attack(me, foe, dir, key) {
    const r = this.random();
    me.facing = dir;
    this.cooldown = 0.5 + this.random() * 0.7;
    const above = foe.y < me.y - me.renderHeight * 0.45;
    if (above && me.onGround) {
      // Up-tilt: tilt key with up held (up doubles as jump, the tilt cancels the squat).
      this.pad.tap(key('tilt'));
      return [key('up')];
    } else if (foe.percent > 70 && r < 0.4 && me.onGround) {
      this.plan = { kind: 'smash', time: 0.2 + this.random() * 0.45, dir };
    } else if (r < 0.15 && me.onGround) {
      this.pad.tap(key('jump'));
      this.plan = { kind: 'aerial', time: 0.2, dir };
    } else if (r < 0.6) {
      this.pad.tap(key('jab'));
    } else {
      this.pad.tap(key('tilt'));
      return [key(dir < 0 ? 'left' : 'right')];
    }
    return [];
  }
}

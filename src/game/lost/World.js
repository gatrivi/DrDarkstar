export const TILE = 32, COLS = 110, ROWS = 20;
export const WIDTH = COLS * TILE, HEIGHT = ROWS * TILE;
export const WOODLAND_PLATFORMS = [
  { x: 288, y: 448, w: 144, art: 'log', bounds: [278, 404, 166, 106] },
  { x: 480, y: 384, w: 128, art: 'ledge', bounds: [471, 382, 147, 100] },
  { x: 1856, y: 448, w: 160, art: 'log', bounds: [1844, 399, 184, 118] },
];
export const MEMORIES = [
  { id: 'canopy', x: 549, y: 384, name: 'THE CANOPY', text: 'Above the path, the leaves hide a voice: “We planted these trees for someone we would never meet.”' },
  { id: 'arch', x: 2192, y: 512, name: 'THE ROOTBOUND ARCH', text: 'Under the roots, a carving reads: “The forest did not bury us. It kept us.”' },
  { id: 'watch', x: 2736, y: 320, name: 'THE OLD WATCH', text: 'A quiet perch above the machines: “If you have found this place, our story is not over.”' },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function makeLevel() {
  const tiles = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  const fill = (x, y, w, h, top = 0) => {
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) tiles[r][c] = r === y ? top : ((c + r) % 5 === 0 ? 3 : 2);
  };
  fill(0, 16, COLS, 4);
  // A low passage: 32 px clearance, versus 56 px standing / 29 px crouched.
  fill(23, 11, 7, 4, 1);
  // Optional upper paths and stepping stones to elevated relays.
  fill(37, 14, 4, 1, 1); fill(42, 12, 4, 1, 1);
  fill(47, 10, 7, 1, 1);
  fill(73, 14, 4, 1, 1); fill(78, 12, 4, 1, 1);
  fill(83, 10, 7, 1, 1); fill(94, 13, 5, 1, 1);
  // One short water gap, with a safe upper crossing.
  for (let r = 16; r < ROWS; r++) for (let c = 59; c < 62; c++) tiles[r][c] = -1;
  return tiles;
}

export class LostWorld {
  constructor() { this.tiles = makeLevel(); this.reset(); }
  reset() {
    this.player = { x: 112, y: 512, vx: 0, vy: 0, facing: 1, crouch: false, grounded: true, coyote: .1, jumpBuffer: 0, attack: 0, struck: false };
    this.relays = [{ x: 656, y: 480, on: false }, { x: 1680, y: 288, on: false }, { x: 2832, y: 288, on: false }];
    this.checkpoint = { x: 112, y: 512, zone: 0 };
    this.visited = new Set([0]); this.time = 0; this.complete = false;
    this.memories = new Set();
    this.message = 'Follow the old conduits. Wake three relays with your whip.'; this.messageTime = 6;
  }
  get powered() { return this.relays.filter(r => r.on).length; }
  body(x = this.player.x, y = this.player.y, crouch = this.player.crouch) { return { x: x - 11, y: y - (crouch ? 29 : 56), w: 22, h: crouch ? 29 : 56 }; }
  solids(box) {
    const result = [];
    const left = clamp(Math.floor(box.x / TILE), 0, COLS - 1), right = clamp(Math.floor((box.x + box.w) / TILE), 0, COLS - 1);
    const top = clamp(Math.floor(box.y / TILE), 0, ROWS - 1), bottom = clamp(Math.floor((box.y + box.h) / TILE), 0, ROWS - 1);
    for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) if (this.tiles[r][c] >= 0) result.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });
    if (this.powered < 3) result.push({ x: 104 * TILE, y: 12 * TILE, w: TILE, h: 4 * TILE });
    return result;
  }
  blocked(box) { return this.solids(box).some(s => overlap(box, s)); }
  say(message, duration = 4) { this.message = message; this.messageTime = duration; }
  respawn() {
    Object.assign(this.player, { x: this.checkpoint.x, y: this.checkpoint.y, vx: 0, vy: 0, grounded: true, crouch: false, attack: 0 });
    this.say('The water carries you back to the last beacon.');
  }
  update(dt, keys = {}) {
    dt = Math.min(dt, .05);
    if (this.complete) return;
    this.time += dt; this.messageTime = Math.max(0, this.messageTime - dt);
    const p = this.player;
    p.attack = Math.max(0, p.attack - dt);
    p.coyote = p.grounded ? .1 : Math.max(0, p.coyote - dt);
    p.jumpBuffer = keys.jump ? .12 : Math.max(0, p.jumpBuffer - dt);
    p.crouch = !!keys.down || (p.crouch && this.blocked(this.body(p.x, p.y, false)));
    if (p.jumpBuffer > 0 && p.coyote > 0 && !p.crouch) {
      p.vy = -470; p.grounded = false; p.coyote = 0; p.jumpBuffer = 0;
    }
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (direction) p.facing = direction;
    p.vx = direction * (p.crouch ? 82 : 176);
    if (keys.whip && p.attack === 0) { p.attack = .42; p.struck = false; }
    // Substeps keep collision stable even during an occasional slow frame.
    const steps = Math.ceil(dt / (1 / 120)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      p.x = clamp(p.x + p.vx * step, 12, WIDTH - 12);
      for (const s of this.solids(this.body())) if (overlap(this.body(), s)) p.x = p.vx > 0 ? s.x - 11 : s.x + s.w + 11;
      const previousFeet = p.y;
      p.vy = Math.min(680, p.vy + 1150 * step); p.y += p.vy * step; p.grounded = false;
      for (const s of this.solids(this.body())) if (overlap(this.body(), s)) {
        if (p.vy >= 0) { p.y = s.y; p.grounded = true; } else p.y = s.y + s.h + this.body().h;
        p.vy = 0;
      }
      // Branches and logs catch falling feet while permitting jumps from below.
      for (const s of WOODLAND_PLATFORMS) {
        if (p.vy >= 0 && previousFeet <= s.y && p.y >= s.y && p.x + 11 > s.x && p.x - 11 < s.x + s.w) {
          p.y = s.y; p.vy = 0; p.grounded = true;
        }
      }
    }
    if (p.attack > 0 && p.attack < .27 && !p.struck) {
      p.struck = true;
      const y = p.y - (p.crouch ? 16 : 32);
      for (const r of this.relays) {
        const d = (r.x - p.x) * p.facing;
        if (r.on || d < 0 || d > 136 || Math.abs(r.y - y) > 27) continue;
        const beam = { x: Math.min(p.x, r.x), y: y - 1, w: Math.abs(r.x - p.x), h: 2 };
        if (!this.blocked(beam)) { r.on = true; this.say(this.powered === 3 ? 'All three relays awake. The archive door is open.' : `Relay ${this.powered} / 3 awake. Follow the conduit onward.`); }
      }
    }
    const zone = clamp(Math.floor(p.x / 1152), 0, 2);
    if (!this.visited.has(zone) && p.grounded && p.y === 512) {
      this.visited.add(zone); this.checkpoint = { x: p.x, y: 512, zone };
      this.say('Beacon reached. Your progress is safe for this expedition.');
    }
    if (p.y > HEIGHT + 60) this.respawn();
    if (keys.interact) {
      const memory = MEMORIES.find(m => Math.abs(m.x - p.x) < 52 && Math.abs(m.y - p.y) < 24 && p.grounded);
      if (memory) {
        this.memories.add(memory.id); this.say(`${memory.text} (${this.memories.size} / ${MEMORIES.length} memories)`, 9);
      } else if (p.x > 102 * TILE) {
        if (this.powered === 3) { this.complete = true; this.say('The archive remembers. Expedition complete.', 999); }
        else this.say(`The archive sleeps. ${3 - this.powered} more relays need energy.`);
      } else {
        const murals = [{ x: 480, text: '“We built below the roots, believing stone would outlast memory.”' }, { x: 1888, text: '“Carry the light upward. The old machines still listen.”' }, { x: 3072, text: '“A generation is lost only when no one returns to listen.”' }];
        const mural = murals.find(m => Math.abs(m.x - p.x) < 100);
        this.say(mural?.text || 'Find the engraved walls. Use your whip on circular relays.');
      }
    }
  }
}

// Eliseo's summon — a little green snake that slithers across the platform
// and bites the first thing it reaches. Same interface as the retriever.
const P_HEAD = '#2f8f3f';

export class SnakeSummon {
  constructor({ x, groundY, dir, scale = 2.5 }) {
    this.x = x;
    this.dir = dir;
    this.groundY = groundY;
    this.scale = scale;
    this.speed = 500;
    this.alive = true;
    this.time = 0;
    this.hit = new Set();
    this.hitMove = { damage: 6, base: 260, scaling: 1.4, angle: -0.3 };
    this.segments = 9;
    this.w = this.segments * 3 * scale;
    this.h = 7 * scale;
  }

  hurtbox() {
    return { x: this.dir > 0 ? this.x : this.x - this.w, y: this.groundY - this.h, w: this.w, h: this.h };
  }

  update(delta, stage) {
    this.time += delta;
    this.x += this.dir * this.speed * delta;
    const p = stage.platform;
    if (this.x + this.w < p.x0 - 40 || this.x > p.x1 + 40) this.alive = false;
  }

  draw(ctx) {
    const s = this.scale;
    for (let i = 0; i < this.segments; i++) {
      const forward = this.dir > 0
        ? this.x + this.w - (i + 1) * 3 * s   // head leads to the right
        : this.x + i * 3 * s;                 // head leads to the left
      const lift = Math.sin(this.time * 12 - i * 0.9) * 2 * s;
      const y = this.groundY - 3 * s - lift;
      if (i === 0) {                          // head
        ctx.fillStyle = P_HEAD;
        ctx.fillRect(forward, y - s, 3 * s, 3 * s);
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(this.dir > 0 ? forward + 2 * s : forward, y - s, s, s);
      } else {
        ctx.fillStyle = i % 2 ? '#4cd964' : '#3bb455';
        ctx.fillRect(forward, y, 2 * s, 2 * s);
      }
    }
  }
}

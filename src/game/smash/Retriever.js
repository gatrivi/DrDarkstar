// Summoned dogs: Andy's black retriever with the red collar, and Simon's
// gray pitbull with the gold collar. Same gallop, different coats.
const VARIANTS = {
  retriever: { body: '#1a1a1c', ear: '#141416', snout: '#2c2c30', collar: '#d92b2b', collarHi: '#f05555' },
  pitbull: { body: '#7a7f88', ear: '#5c6068', snout: '#3a3d44', collar: '#c9a227', collarHi: '#e8c95a' },
};

// Andy's black retriever with the red collar — summoned, sprints across the stage.
export class Retriever {
  constructor({ x, groundY, dir, scale = 3, variant = 'retriever' }) {
    this.x = x;
    this.dir = dir;
    this.groundY = groundY;
    this.scale = scale;
    this.variant = variant;
    this.coat = VARIANTS[variant] ?? VARIANTS.retriever;
    this.speed = 640;
    this.alive = true;
    this.time = 0;
    this.fall = 0; this.fallSpeed = 0;
    this.hit = new Set();
    this.hitMove = { damage: 7, base: 300, scaling: 1.7, angle: -0.3 };
    this.w = 22 * scale;
    this.h = 14 * scale;
  }

  get y() { return this.groundY - this.h + this.fall; }

  hurtbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(delta, stage) {
    this.time += delta;
    this.x += this.dir * this.speed * delta;
    // Past a slab edge the dog drops into the void.
    const p = stage.platform;
    const overStage = !p || (this.x + this.w > p.x0 && this.x < p.x1);
    if (!overStage) {
      this.fallSpeed += 2400 * delta;
      this.fall += this.fallSpeed * delta;
    }
    if (this.fall > 600 || this.x < -this.w - 60 || this.x > stage.width + 60) this.alive = false;
  }

  draw(ctx) {
    const s = this.scale;
    const c = this.coat;
    const R = (px, py, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(this.x + px * s, this.y + py * s, w * s, h * s); };
    const gallop = Math.floor(this.time / 0.08) % 2;
    // Body, head, flopping ear, snout, tail.
    R(2, 4, 13, 5, c.body);
    R(15, 2, 5, 5, c.body);
    R(15, 0, 2, 3, c.ear);
    R(20, 4, 2, 2, c.snout);
    R(19, 3, 1, 1, '#ffd34d');     // eye
    R(0, 3 + (gallop ? 1 : 0), 2, 2, c.body); // tail bob
    R(14, 5, 2, 2, c.collar);      // collar
    R(14, 5, 2, 1, c.collarHi);
    // Galloping legs.
    if (gallop) {
      R(3, 9, 2, 4, c.body); R(11, 9, 2, 4, c.body);
      R(6, 9, 2, 3, c.ear); R(14, 7, 2, 5, c.ear);
    } else {
      R(5, 9, 2, 4, c.body); R(13, 9, 2, 4, c.body);
      R(3, 9, 2, 3, c.ear); R(15, 7, 2, 5, c.ear);
    }
  }
}

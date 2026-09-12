// Andy's black retriever with the red collar — summoned, sprints across the stage.
export class Retriever {
  constructor({ x, groundY, dir, scale = 3 }) {
    this.x = x;
    this.dir = dir;
    this.groundY = groundY;
    this.scale = scale;
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
    const R = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(this.x + px * s, this.y + py * s, w * s, h * s); };
    const gallop = Math.floor(this.time / 0.08) % 2;
    // Body, head, flopping ear, snout, tail.
    R(2, 4, 13, 5, '#1a1a1c');
    R(15, 2, 5, 5, '#1a1a1c');
    R(15, 0, 2, 3, '#141416');
    R(20, 4, 2, 2, '#2c2c30');
    R(19, 3, 1, 1, '#ffd34d');     // eye
    R(0, 3 + (gallop ? 1 : 0), 2, 2, '#1a1a1c'); // tail bob
    R(14, 5, 2, 2, '#d92b2b');     // red collar
    R(14, 5, 2, 1, '#f05555');
    // Galloping legs.
    if (gallop) {
      R(3, 9, 2, 4, '#1a1a1c'); R(11, 9, 2, 4, '#1a1a1c');
      R(6, 9, 2, 3, '#141416'); R(14, 7, 2, 5, '#141416');
    } else {
      R(5, 9, 2, 4, '#1a1a1c'); R(13, 9, 2, 4, '#1a1a1c');
      R(3, 9, 2, 3, '#141416'); R(15, 7, 2, 5, '#141416');
    }
  }
}

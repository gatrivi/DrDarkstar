export class Projectile {
  constructor({ x, y, vx, vy = -260 }) {
    Object.assign(this, { x, y, vx, vy, alive: true, bounces: 1, radius: 5, trail: [] });
  }

  update(delta, platform, bounds) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.vy += 1500 * delta;
    this.x += this.vx * delta;
    this.y += this.vy * delta;
    // Bounce only on the slab; off the edges the ball just keeps falling.
    if (this.y > platform.y - this.radius && this.x >= platform.x0 && this.x <= platform.x1) {
      this.y = platform.y - this.radius;
      if (this.bounces-- > 0) this.vy = -Math.abs(this.vy) * 0.75;
      else this.alive = false;
    }
    if (this.x < -40 || this.x > bounds.width + 40 || this.y < -200 || this.y > bounds.height + 60) this.alive = false;
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(240, 240, 255, 0.35)';
    for (const t of this.trail) ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
    ctx.fillStyle = '#f4f4ff';
    ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
  }
}

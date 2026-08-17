export class CollisionRain {
  constructor({ width, height, actor, count = 420 }) {
    this.width = width;
    this.height = height;
    this.actor = actor;
    this.hits = 0;
    this.drops = Array.from({ length: count }, () => this.makeDrop(true));
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  makeDrop(anywhere = false) {
    return {
      x: Math.random() * this.width,
      y: anywhere ? Math.random() * this.height : -20 - Math.random() * 100,
      vx: -12 + Math.random() * 24,
      vy: 260 + Math.random() * 200,
      length: 5 + Math.random() * 8,
      cooldown: 0,
    };
  }

  reset(drop) {
    Object.assign(drop, this.makeDrop(false));
  }

  update(delta) {
    for (const drop of this.drops) {
      drop.cooldown = Math.max(0, drop.cooldown - delta);
      drop.vy += 36 * delta;
      const travel = Math.hypot(drop.vx, drop.vy) * delta;
      const steps = Math.max(1, Math.ceil(travel / 2.5));
      const stepDelta = delta / steps;

      for (let i = 0; i < steps; i += 1) {
        const nextX = drop.x + drop.vx * stepDelta;
        const nextY = drop.y + drop.vy * stepDelta;

        if (drop.cooldown <= 0 && this.actor.isSolidWorld(nextX, nextY)) {
          const normal = this.actor.normalAtWorld(nextX, nextY, drop.vx, drop.vy);
          const dot = drop.vx * normal.x + drop.vy * normal.y;
          if (dot < 0) {
            const restitution = 0.42;
            drop.vx -= (1 + restitution) * dot * normal.x;
            drop.vy -= (1 + restitution) * dot * normal.y;
            drop.vx *= 0.8;
            drop.vy *= 0.8;
            drop.x += normal.x * 2.5;
            drop.y += normal.y * 2.5;
            drop.cooldown = 0.025;
            this.hits += 1;
          }
          break;
        }

        drop.x = nextX;
        drop.y = nextY;
      }

      if (drop.y > this.height + 30 || drop.x < -50 || drop.x > this.width + 50) {
        this.reset(drop);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 230, 255, 0.76)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of this.drops) {
      const speed = Math.hypot(drop.vx, drop.vy) || 1;
      const nx = drop.vx / speed;
      const ny = drop.vy / speed;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - nx * drop.length, drop.y - ny * drop.length);
    }
    ctx.stroke();
    ctx.restore();
  }
}

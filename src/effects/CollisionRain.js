export class CollisionRain {
  constructor({ width, height, actor, count = 6000, focused = false, settings = {} }) {
    Object.assign(this, {
      width, height, actor, focused, hits: 0, time: 0,
      settings: { size: 1, smoothing: 7, reveal: 1, drift: 1, ...settings },
    });
    this.lastX = actor.x; this.lastY = actor.y;
    this.audio = { bass: 0, mid: 0, treble: 0, effect: 0 };
    this.drops = Array.from({ length: count }, () => this.makeDrop(true));
  }

  resize(width, height) {
    this.width = width; this.height = height;
    for (const drop of this.drops) {
      if (drop.x > width || drop.y > height) Object.assign(drop, this.makeDrop(true));
    }
  }

  makeDrop(anywhere = false) {
    const bounds = this.bounds;
    return {
      x: bounds.x + Math.random() * bounds.width,
      y: bounds.y + (anywhere ? Math.random() * bounds.height : -Math.random() * 20),
      speed: 100 + Math.random() * 180,
      size: 0.7 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      inside: false, pixel: null, vx: 0, vy: 0,
      life: 0.8 + Math.random() * 1.2,
      intensity: 0,
    };
  }

  get bounds() {
    if (!this.focused) return { x: 0, y: 0, width: this.width, height: this.height };
    return { x: this.actor.x - this.actor.renderWidth / 2 - 16,
      y: this.actor.y - this.actor.renderHeight / 2 - 16,
      width: this.actor.renderWidth + 32, height: this.actor.renderHeight + 32 };
  }

  update(delta, audio = this.audio) {
    this.audio = audio;
    this.time += delta;
    const { bass, mid, effect } = audio;
    const bounds = this.bounds;
    for (const drop of this.drops) {
      if (this.focused) {
        // The sampling window follows the actor, but particles flow through its
        // entire rectangle independently of opaque pixels and animation poses.
        drop.x += this.actor.x - this.lastX;
        drop.y += this.actor.y - this.lastY;
        drop.life -= delta;
        // Renew throughout the rectangular field so bright upper pixels cannot
        // starve lower limbs of samples during continuous animation or music.
        if (drop.life <= 0) Object.assign(drop, this.makeDrop(true));
      }
      // A brightness field, not a wall. Even white pixels allow forward travel.
      const pixel = this.actor.sampleWorld(drop.x, drop.y);
      const grip = pixel ? 1 - pixel.brightness * pixel.alpha * 0.86 : 1;
      const drift = Math.sin(this.time * 2 + drop.phase + drop.y * 0.015) * this.settings.drift;
      const dx = drop.x - this.actor.x, dy = drop.y - this.actor.y;
      const distance = Math.hypot(dx, dy) || 1;
      const impulse = effect * 220 * Math.max(0, 1 - distance / 350);
      drop.vx = drift * (4 + mid * (this.focused ? 25 : 100)) + dx / distance * impulse;
      drop.vy = Math.max(12, drop.speed * grip * (1 + bass * (this.focused ? 0.6 : 1.8)) + dy / distance * impulse);
      drop.x += drop.vx * delta;
      drop.y += drop.vy * delta;
      if (drop.y > bounds.y + bounds.height || drop.x < bounds.x || drop.x > bounds.x + bounds.width) {
        Object.assign(drop, this.makeDrop(false));
      }
      // Sample at the rendered position: no stale colors outside the silhouette.
      drop.pixel = this.actor.sampleWorld(drop.x, drop.y);
      const targetIntensity = drop.pixel ? this.settings.reveal * (0.2 + drop.pixel.brightness * 0.8) : 0.12;
      drop.intensity += (targetIntensity - drop.intensity) * (1 - Math.exp(-delta * this.settings.smoothing));
      if (drop.pixel && !drop.inside) this.hits++;
      drop.inside = !!drop.pixel;
    }
    this.lastX = this.actor.x; this.lastY = this.actor.y;
  }

  draw(ctx) {
    const { bass, treble, effect } = this.audio;
    for (const drop of this.drops) {
      const p = drop.pixel;
      if (this.focused && !p) continue;
      const shimmer = 1 + treble * (0.5 + Math.sin(drop.phase + this.time * 18) * 0.5);
      const size = drop.size * this.settings.size * (1 + treble * 0.3 + effect * 0.3);
      if (p) {
        const light = (0.15 + p.brightness * 0.6) * p.alpha * drop.intensity;
        ctx.fillStyle = `rgba(${Math.min(255, p.r * shimmer)}, ${Math.min(255, p.g * shimmer)}, ${Math.min(255, p.b * shimmer)}, ${light})`;
      } else {
        ctx.fillStyle = `rgba(105, 161, 185, ${(0.07 + bass * 0.06 + effect * 0.15) * Math.max(0.3, drop.intensity)})`;
      }
      ctx.fillRect(drop.x, drop.y, size, size * (this.focused ? 1.2 : 2.5));
    }
  }
}

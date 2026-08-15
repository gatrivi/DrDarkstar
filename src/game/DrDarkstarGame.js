const TAU = Math.PI * 2;

export class DrDarkstarGame {
  constructor({ width, height, input, assets, onStatus }) {
    this.width = width;
    this.height = height;
    this.input = input;
    this.assets = assets;
    this.onStatus = onStatus;
    this.player = { x: width * 0.5, y: height * 0.62, radius: 12, speed: 210 };
    this.score = 0;
    this.targetCount = 7;
    this.time = 0;
    this.stars = [];
    this.signals = [];
    this.resetWorld();
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.player.x = Math.min(this.player.x, width - this.player.radius);
    this.player.y = Math.min(this.player.y, height - this.player.radius);
    this.resetStars();
  }

  resetWorld() {
    this.score = 0;
    this.resetStars();
    this.signals = Array.from({ length: this.targetCount }, () => this.spawnSignal());
    this.report();
  }

  resetStars() {
    const count = Math.max(80, Math.floor((this.width * this.height) / 8200));
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      size: Math.random() < 0.88 ? 1 : 2,
      pulse: Math.random() * TAU,
    }));
  }

  spawnSignal() {
    return {
      x: 30 + Math.random() * Math.max(1, this.width - 60),
      y: 55 + Math.random() * Math.max(1, this.height - 110),
      radius: 7 + Math.random() * 4,
      pulse: Math.random() * TAU,
    };
  }

  update(delta) {
    this.time += delta;
    const x = Number(this.input.isDown('KeyD', 'ArrowRight')) - Number(this.input.isDown('KeyA', 'ArrowLeft'));
    const y = Number(this.input.isDown('KeyS', 'ArrowDown')) - Number(this.input.isDown('KeyW', 'ArrowUp'));
    const magnitude = Math.hypot(x, y) || 1;
    this.player.x += (x / magnitude) * this.player.speed * delta;
    this.player.y += (y / magnitude) * this.player.speed * delta;
    this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
    this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

    this.signals = this.signals.filter((signal) => {
      const distance = Math.hypot(signal.x - this.player.x, signal.y - this.player.y);
      if (distance > signal.radius + this.player.radius) return true;
      this.score += 1;
      this.report();
      return false;
    });

    if (this.signals.length === 0) {
      this.signals = Array.from({ length: this.targetCount }, () => this.spawnSignal());
    }
  }

  report() {
    this.onStatus?.(`signals ${this.score} · drift until bored`);
  }

  render(ctx) {
    const { width, height } = this;
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.58, 20, width * 0.5, height * 0.58, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, '#151d39');
    gradient.addColorStop(0.42, '#080d1c');
    gradient.addColorStop(1, '#010208');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (const star of this.stars) {
      const alpha = 0.24 + Math.sin(this.time * 1.4 + star.pulse) * 0.17;
      ctx.fillStyle = `rgba(190, 218, 255, ${alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.strokeStyle = 'rgba(78, 110, 160, 0.1)';
    ctx.lineWidth = 1;
    const horizon = height * 0.73;
    for (let y = horizon; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (const signal of this.signals) {
      const pulse = 1 + Math.sin(this.time * 3 + signal.pulse) * 0.22;
      ctx.beginPath();
      ctx.arc(signal.x, signal.y, signal.radius * pulse, 0, TAU);
      ctx.fillStyle = '#c76cff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(signal.x, signal.y, signal.radius * (2.3 + pulse), 0, TAU);
      ctx.strokeStyle = 'rgba(199, 108, 255, 0.18)';
      ctx.stroke();
    }

    const sprite = this.assets.get('player');
    if (sprite) {
      const size = 56;
      ctx.drawImage(sprite, this.player.x - size / 2, this.player.y - size / 2, size, size);
    } else {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(Math.sin(this.time * 1.5) * 0.06);
      ctx.fillStyle = '#d9f3ff';
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(11, 13);
      ctx.lineTo(0, 8);
      ctx.lineTo(-11, 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4ce3ff';
      ctx.fillRect(-2, 9, 4, 8 + Math.sin(this.time * 12) * 3);
      ctx.restore();
    }
  }
}

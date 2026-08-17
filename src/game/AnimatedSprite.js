function makeFallbackSheet() {
  const frameWidth = 16;
  const frameHeight = 24;
  const frames = 4;
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frames;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const poses = [
    { armL: 0, armR: 0, legL: -1, legR: 1 },
    { armL: -2, armR: 2, legL: 1, legR: -1 },
    { armL: 0, armR: 0, legL: 2, legR: -2 },
    { armL: 2, armR: -2, legL: -1, legR: 1 },
  ];

  poses.forEach((pose, frame) => {
    const ox = frame * frameWidth;
    ctx.fillStyle = '#d7efff';
    ctx.fillRect(ox + 6, 2, 4, 4);          // head
    ctx.fillRect(ox + 5, 6, 6, 9);          // torso
    ctx.fillRect(ox + 3 + pose.armL, 7, 2, 8);
    ctx.fillRect(ox + 11 + pose.armR, 7, 2, 8);
    ctx.fillRect(ox + 5 + pose.legL, 15, 2, 7);
    ctx.fillRect(ox + 9 + pose.legR, 15, 2, 7);
    ctx.fillStyle = '#6ce7ff';
    ctx.fillRect(ox + 7, 3, 2, 1);
  });

  return { source: canvas, frameWidth, frameHeight, frames };
}

export class AnimatedSprite {
  constructor({ input, width, height, scale = 6 }) {
    this.input = input;
    this.x = width * 0.5;
    this.y = height * 0.62;
    this.scale = scale;
    this.speed = 180;
    this.frame = 0;
    this.frameTime = 0;
    this.frameDuration = 0.1;
    this.sheet = null;
    this.frameWidth = 16;
    this.frameHeight = 24;
    this.frames = 4;
    this.maskCache = new Map();
    this.mask = null;
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d', { willReadFrequently: true });
  }

  async load(src = './assets/player.png') {
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      await image.decode();
      this.sheet = image;

      // Prototype convention: one horizontal row, square-ish frames.
      // If your real sheet differs, set these 3 values explicitly here.
      this.frameHeight = image.height;
      this.frameWidth = image.height;
      this.frames = Math.max(1, Math.floor(image.width / this.frameWidth));
    } catch {
      const fallback = makeFallbackSheet();
      this.sheet = fallback.source;
      this.frameWidth = fallback.frameWidth;
      this.frameHeight = fallback.frameHeight;
      this.frames = fallback.frames;
    }

    this.maskCanvas.width = this.frameWidth;
    this.maskCanvas.height = this.frameHeight;
    this.setFrame(0, true);
  }

  resize(width, height) {
    this.x = Math.max(this.renderWidth / 2, Math.min(width - this.renderWidth / 2, this.x));
    this.y = Math.max(this.renderHeight / 2, Math.min(height - this.renderHeight / 2, this.y));
  }

  get renderWidth() {
    return this.frameWidth * this.scale;
  }

  get renderHeight() {
    return this.frameHeight * this.scale;
  }

  setFrame(frame, force = false) {
    const next = ((frame % this.frames) + this.frames) % this.frames;
    if (!force && next === this.frame && this.mask) return;
    this.frame = next;

    if (this.maskCache.has(next)) {
      this.mask = this.maskCache.get(next);
      return;
    }

    this.maskCtx.clearRect(0, 0, this.frameWidth, this.frameHeight);
    this.maskCtx.drawImage(
      this.sheet,
      next * this.frameWidth, 0, this.frameWidth, this.frameHeight,
      0, 0, this.frameWidth, this.frameHeight,
    );
    const imageData = this.maskCtx.getImageData(0, 0, this.frameWidth, this.frameHeight);
    this.maskCache.set(next, imageData);
    this.mask = imageData;
  }

  update(delta, bounds) {
    const dx = Number(this.input.isDown('KeyD', 'ArrowRight')) - Number(this.input.isDown('KeyA', 'ArrowLeft'));
    const dy = Number(this.input.isDown('KeyS', 'ArrowDown')) - Number(this.input.isDown('KeyW', 'ArrowUp'));
    const moving = dx !== 0 || dy !== 0;
    const length = Math.hypot(dx, dy) || 1;

    this.x += (dx / length) * this.speed * delta;
    this.y += (dy / length) * this.speed * delta;
    this.x = Math.max(this.renderWidth / 2, Math.min(bounds.width - this.renderWidth / 2, this.x));
    this.y = Math.max(this.renderHeight / 2, Math.min(bounds.height - this.renderHeight / 2, this.y));

    if (moving) {
      this.frameTime += delta;
      if (this.frameTime >= this.frameDuration) {
        this.frameTime %= this.frameDuration;
        this.setFrame(this.frame + 1);
      }
    } else {
      this.frameTime = 0;
      this.setFrame(0);
    }
  }

  worldToLocal(worldX, worldY) {
    const left = this.x - this.renderWidth / 2;
    const top = this.y - this.renderHeight / 2;
    return {
      x: Math.floor((worldX - left) / this.scale),
      y: Math.floor((worldY - top) / this.scale),
    };
  }

  alphaAtLocal(x, y) {
    if (!this.mask || x < 0 || y < 0 || x >= this.frameWidth || y >= this.frameHeight) return 0;
    return this.mask.data[(y * this.frameWidth + x) * 4 + 3];
  }

  isSolidWorld(worldX, worldY, threshold = 24) {
    const p = this.worldToLocal(worldX, worldY);
    return this.alphaAtLocal(p.x, p.y) > threshold;
  }

  normalAtWorld(worldX, worldY, fallbackVx = 0, fallbackVy = 1) {
    const p = this.worldToLocal(worldX, worldY);
    const left = this.alphaAtLocal(p.x - 1, p.y) / 255;
    const right = this.alphaAtLocal(p.x + 1, p.y) / 255;
    const up = this.alphaAtLocal(p.x, p.y - 1) / 255;
    const down = this.alphaAtLocal(p.x, p.y + 1) / 255;

    // Alpha rises as we move into the sprite. Negative gradient points outward.
    let nx = -(right - left);
    let ny = -(down - up);
    let length = Math.hypot(nx, ny);

    if (length < 0.001) {
      nx = -fallbackVx;
      ny = -fallbackVy;
      length = Math.hypot(nx, ny) || 1;
    }

    return { x: nx / length, y: ny / length };
  }

  draw(ctx) {
    ctx.drawImage(
      this.sheet,
      this.frame * this.frameWidth, 0, this.frameWidth, this.frameHeight,
      Math.round(this.x - this.renderWidth / 2),
      Math.round(this.y - this.renderHeight / 2),
      this.renderWidth,
      this.renderHeight,
    );
  }

  drawMaskDebug(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#ff3b7a';
    const left = this.x - this.renderWidth / 2;
    const top = this.y - this.renderHeight / 2;
    for (let y = 0; y < this.frameHeight; y += 1) {
      for (let x = 0; x < this.frameWidth; x += 1) {
        if (this.alphaAtLocal(x, y) > 24) {
          ctx.fillRect(left + x * this.scale, top + y * this.scale, this.scale, this.scale);
        }
      }
    }
    ctx.restore();
  }
}

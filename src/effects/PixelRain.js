const MODES = ['hybrid', 'rain', 'clean'];

export class PixelRain {
  constructor(width, height, options = {}) {
    this.cell = options.cell ?? 5;
    this.fade = options.fade ?? 0.17;
    this.density = options.density ?? 0.42;
    this.modeIndex = 0;
    this.width = width;
    this.height = height;
    this.columns = [];
    this.resize(width, height);
  }

  get mode() {
    return MODES[this.modeIndex];
  }

  cycleMode() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
    return this.mode;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const count = Math.ceil(width / this.cell);
    this.columns = Array.from({ length: count }, (_, index) => ({
      x: index * this.cell,
      y: Math.random() * height,
      speed: 34 + Math.random() * 125,
      length: 2 + Math.floor(Math.random() * 8),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  render(target, sourceCanvas, delta, time) {
    if (this.mode === 'clean') {
      target.clearRect(0, 0, this.width, this.height);
      target.drawImage(sourceCanvas, 0, 0, this.width, this.height);
      return;
    }

    if (this.mode === 'hybrid') {
      target.fillStyle = `rgba(2, 3, 10, ${this.fade})`;
      target.fillRect(0, 0, this.width, this.height);
      target.globalAlpha = 0.22;
      target.drawImage(sourceCanvas, 0, 0, this.width, this.height);
      target.globalAlpha = 1;
    } else {
      target.fillStyle = `rgba(0, 0, 4, ${Math.min(0.34, this.fade * 1.6)})`;
      target.fillRect(0, 0, this.width, this.height);
    }

    const sampleWidth = Math.max(1, Math.ceil(this.width / this.cell));
    const sampleHeight = Math.max(1, Math.ceil(this.height / this.cell));
    const sampleCanvas = PixelRain.sampleCanvas ??= document.createElement('canvas');
    if (sampleCanvas.width !== sampleWidth) sampleCanvas.width = sampleWidth;
    if (sampleCanvas.height !== sampleHeight) sampleCanvas.height = sampleHeight;
    const sample = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sample.imageSmoothingEnabled = false;
    sample.clearRect(0, 0, sampleWidth, sampleHeight);
    sample.drawImage(sourceCanvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sample.getImageData(0, 0, sampleWidth, sampleHeight).data;

    for (const column of this.columns) {
      column.y += column.speed * delta;
      if (column.y > this.height + column.length * this.cell) {
        column.y = -Math.random() * this.height * 0.2;
        column.speed = 34 + Math.random() * 125;
      }

      if (Math.sin(time * 0.0015 + column.phase) < 1 - this.density * 2) continue;

      const sx = Math.min(sampleWidth - 1, Math.floor(column.x / this.cell));
      for (let i = 0; i < column.length; i += 1) {
        const y = column.y - i * this.cell;
        if (y < 0 || y >= this.height) continue;
        const sy = Math.min(sampleHeight - 1, Math.floor(y / this.cell));
        const offset = (sy * sampleWidth + sx) * 4;
        const r = pixels[offset];
        const g = pixels[offset + 1];
        const b = pixels[offset + 2];
        const brightness = (r + g + b) / 765;
        if (brightness < 0.045) continue;

        const alpha = Math.max(0.08, brightness) * (1 - i / (column.length + 1));
        target.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        target.fillRect(column.x, Math.floor(y), this.cell, this.cell * (1 + brightness * 2.5));
      }
    }
  }
}

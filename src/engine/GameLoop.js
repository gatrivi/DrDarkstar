export class GameLoop {
  constructor({ update, render, maxDelta = 0.05 }) {
    this.update = update;
    this.render = render;
    this.maxDelta = maxDelta;
    this.running = false;
    this.last = 0;
    this.mode = 'raf'; // 'raf' | 'timeout' — some embedded webviews never fire rAF
    this.frame = this.frame.bind(this);
    this.tick = this.tick.bind(this);
    this.watchdog = this.watchdog.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
    // If no frame arrives shortly, fall back to a timer-driven loop.
    this.watchdogTimer = setTimeout(this.watchdog, 500);
  }

  stop() {
    this.running = false;
    clearTimeout(this.watchdogTimer);
    clearTimeout(this.timeoutId);
  }

  watchdog() {
    if (!this.running || this.mode === 'timeout') return;
    if (!this.frames) {
      this.mode = 'timeout';
      this.timeoutId = setTimeout(this.tick, 16);
    }
  }

  tick() {
    if (!this.running || this.mode !== 'timeout') return;
    this.step();
    this.timeoutId = setTimeout(this.tick, 16);
  }

  frame(now) {
    if (!this.running) return;
    if (this.mode === 'timeout') return;
    this.frames = (this.frames || 0) + 1;
    clearTimeout(this.watchdogTimer);
    this.step(now);
    requestAnimationFrame(this.frame);
  }

  step(now = performance.now()) {
    const delta = Math.min((now - this.last) / 1000, this.maxDelta);
    this.last = now;
    this.update(delta);
    this.render(delta);
  }
}

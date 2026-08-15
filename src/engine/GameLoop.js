export class GameLoop {
  constructor({ update, render, maxDelta = 0.05 }) {
    this.update = update;
    this.render = render;
    this.maxDelta = maxDelta;
    this.running = false;
    this.last = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  frame(now) {
    if (!this.running) return;
    const delta = Math.min((now - this.last) / 1000, this.maxDelta);
    this.last = now;
    this.update(delta);
    this.render(delta);
    requestAnimationFrame(this.frame);
  }
}

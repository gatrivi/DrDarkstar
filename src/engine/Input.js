export class Input {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set();

    target.addEventListener('keydown', (event) => {
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });

    target.addEventListener('keyup', (event) => this.down.delete(event.code));
    target.addEventListener('blur', () => {
      this.down.clear();
      this.pressed.clear();
    });
  }

  isDown(...codes) {
    return codes.some((code) => this.down.has(code));
  }

  consume(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  endFrame() {
    this.pressed.clear();
  }
}

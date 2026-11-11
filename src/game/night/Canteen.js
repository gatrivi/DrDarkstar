// The canteen: a warm interior reachable from the noodle bar (B while inside
// its light). The storm stays with you — but as Blade Runner windshield rain:
// droplets that land, hold, and slide down the glass, leaving thin trails.
export const CANTEEN = {
  pane: { x: 540, y: 92, w: 340, h: 340 }, // the window over the city
  drops: 130,        // sliding droplets on the pane
  mist: .05,         // condensation haze strength
};

export const CANTEEN_LOGS = [
  'ONE MORE FOR THE ROAD',
  'RAIN ON GLASS · THE CITY OUT THERE, SOMEONE ELSE IN HERE',
  'TWO, PLEASE. AND A SEAT BY THE WINDOW',
];

// Droplets on a vertical pane: gravity with stiction (drops hold, then break
// loose), lateral wander, and trails accumulated on a fading offscreen layer.
export class GlassRain {
  constructor(width = CANTEEN.pane.w, height = CANTEEN.pane.h, count = CANTEEN.drops) {
    this.w = width; this.h = height;
    // The trail layer is DOM-dependent, so it is created lazily — the sim
    // itself stays pure and testable in node.
    this.layer = null; this.g = null;
    this.time = 0;
    this.drops = Array.from({ length: count }, () => this.spawn(true));
  }
  ensureLayer() {
    if (this.layer) return;
    this.layer = document.createElement('canvas');
    this.layer.width = this.w; this.layer.height = this.h;
    this.g = this.layer.getContext('2d');
  }
  spawn(anywhere = false) {
    const big = Math.random() < .14;
    return {
      x: Math.random() * this.w,
      y: anywhere ? Math.random() * this.h : -Math.random() * 20,
      vy: big ? 0 : 4 + Math.random() * 10,
      r: big ? 2.4 : 1 + Math.random() * 1.3,
      seed: Math.random() * 100,
      hold: big ? 1 + Math.random() * 2.4 : 0, // seconds gripping the glass
    };
  }
  // Pure simulation: gravity, stiction, wander. No DOM touched.
  update(delta) {
    this.time += delta;
    for (const d of this.drops) {
      d.y += d.vy * delta;
      d.x = Math.max(0, Math.min(this.w, d.x + Math.sin(this.time * 1.7 + d.seed) * 6 * delta));
      if (d.hold > 0) { // surface tension: hold, then let go
        d.hold -= delta;
        if (d.hold <= 0) d.vy = 30 + d.r * 26;
      } else d.vy = Math.min(150 + d.r * 40, d.vy + 120 * delta);
      if (d.y > this.h + 12) Object.assign(d, this.spawn());
    }
  }
  // Paint the drops onto the trail layer at render time. No clear: the fade
  // pass erodes old trails, so each frame leaves a decaying smear behind it.
  paint(delta) {
    this.ensureLayer();
    const g = this.g;
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = `rgba(0,0,0,${Math.min(1, delta * .8)})`;
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'source-over';
    g.lineCap = 'round';
    for (const d of this.drops) {
      const tail = Math.min(34, d.vy * .3 + 3);
      const grad = g.createLinearGradient(d.x, d.y - tail, d.x, d.y);
      grad.addColorStop(0, 'rgba(168,214,232,0)');
      grad.addColorStop(1, `rgba(190,228,244,${.16 + d.r * .06})`);
      g.strokeStyle = grad; g.lineWidth = d.r * .9;
      g.beginPath(); g.moveTo(d.x, d.y - tail); g.lineTo(d.x, d.y); g.stroke();
      g.fillStyle = `rgba(226,246,255,${.3 + d.r * .1})`;
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
      // A faint highlight where the pane bows the city light.
      g.fillStyle = 'rgba(255,255,255,.05)';
      g.fillRect(d.x - d.r, d.y - d.r * 2.2, d.r * 2, d.r * .8);
    }
  }
  // The pane's own darkening so the city behind reads through the wet glass.
  haze(ctx, pane) {
    ctx.fillStyle = `rgba(120,168,196,${CANTEEN.mist})`;
    ctx.fillRect(pane.x, pane.y, pane.w, pane.h);
  }
}

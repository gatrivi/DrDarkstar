// The Root Archive breach: when the hunter walks to the west edge of uptown,
// the city crossfades into a still of the lost world — same tiles, same
// foliage atlas as the Root Archive demo, laid out as a walkable vista.
import { loadImage } from './Atlas.js';

const TILE_XS = [0, 314, 628, 941, 1254], TILE_YS = [0, 313, 628, 918, 1254];
const FOLIAGE = {
  distant: [976,49,1254,425], trunk: [76,436,240,725], fern: [9,740,347,984],
  fungi: [361,757,644,978], log: [9,993,395,1240], arch: [397,984,640,1244],
  vines: [654,735,883,1047],
};
export const RELIC_RELAY_X = 210, RELIC_MURAL_X = 430, RELIC_MEMORY_X = 545;
export const RUINS_EXIT_X = 210; // hysteresis: walk back east past this to return

export class RelicVista {
  constructor() {
    this.ready = false;
    this.load = (async () => {
      const [terrain, plants] = await Promise.all([
        loadImage(new URL('../../../assets/lost-area/tileset-v1.png', import.meta.url)),
        loadImage(new URL('../../../assets/lost-area/foliage-props-v1.png', import.meta.url)),
      ]);
      this.tiles = Array.from({ length: 16 }, (_, i) => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        const x = i % 4, y = Math.floor(i / 4);
        g.drawImage(terrain, (TILE_XS[x] + 3), (TILE_YS[y] + 3),
          (TILE_XS[x + 1] - TILE_XS[x] - 6), (TILE_YS[y + 1] - TILE_YS[y] - 6), 0, 0, 64, 64);
        return c;
      });
      this.props = Object.fromEntries(Object.entries(FOLIAGE).map(([name, [x0, y0, x1, y1]]) => {
        const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        g.drawImage(terrain, 0, 0, 1254, 1254, -x0, -y0, 1254, 1254);
        return [name, c];
      }));
      this.plants = plants;
      this.ready = true;
    })().catch(() => { this.ready = false; });
  }
  tile(ctx, id, x, y, w = 64, h = w) { if (this.ready) ctx.drawImage(this.tiles[id], Math.round(x), Math.round(y), w, h); }
  prop(ctx, name, x, y, w, h) {
    if (!this.ready) return;
    const [x0, y0, x1, y1] = FOLIAGE[name];
    ctx.drawImage(this.plants, x0, y0, x1 - x0, y1 - y0, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  draw(ctx, time, px = 480, floorY = 500, state = {}) {
    if (!this.ready) { ctx.fillStyle = '#071719'; ctx.fillRect(0, 0, 960, 540); return; }
    const drift = (px - 480) * .08;
    ctx.fillStyle = '#071719'; ctx.fillRect(0, 0, 960, 540);
    ctx.globalAlpha = .37;
    for (let x = -96 + drift * .3; x < 1000; x += 384) this.tile(ctx, 13, x, 15, 384, 384);
    ctx.globalAlpha = .42;
    for (let x = -140 + drift * .6; x < 1000; x += 277) this.prop(ctx, 'distant', x, 110, 252, 346);
    ctx.globalAlpha = .2;
    for (let x = -48 + drift; x < 1000; x += 96) {
      if (Math.floor((x - drift) / 96) % 4 === 0) this.tile(ctx, 6, x, 165, 64, 288);
      else for (let y = 260; y < 452; y += 96) this.tile(ctx, 4, x, y, 96, 96);
      this.tile(ctx, 12, x, 410, 96, 128);
    }
    ctx.globalAlpha = 1;
    for (let x = -32; x < 1000; x += 64) {
      this.tile(ctx, 0, x, floorY, 64, 32);
      for (let y = floorY + 32; y < 540; y += 32) this.tile(ctx, (x / 64 + y / 32) % 5 === 0 ? 3 : 2, x, y, 64, 32);
    }
    this.prop(ctx, 'trunk', 40, floorY - 225, 111, 225);
    this.prop(ctx, 'log', 640, floorY - 96, 166, 100);
    this.prop(ctx, 'fern', 130, floorY - 59, 82, 59);
    this.prop(ctx, 'fern', 730, floorY - 56, 77, 56);
    this.prop(ctx, 'fungi', 350, floorY - 52, 94, 52);
    this.prop(ctx, 'fungi', 850, floorY - 48, 87, 48);
    this.prop(ctx, 'vines', 880, 120, 108, 147);
    this.prop(ctx, 'arch', 250, floorY - 181, 207, 181);
    this.drawLandmarks(ctx, time, floorY, state);
    this.drawFrame(ctx, time);
  }
  drawLandmarks(ctx, time, floorY, state) {
    this.tile(ctx, state.relay ? 11 : 10, RELIC_RELAY_X - 25, floorY - 25, 50, 50);
    if (state.relay) {
      ctx.globalAlpha = .1 + .04 * Math.sin(time * 3);
      ctx.fillStyle = '#74ffe0'; ctx.fillRect(RELIC_RELAY_X - 29, floorY - 29, 58, 58);
      ctx.globalAlpha = 1;
    }
    ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = state.relay ? '#7dfbd9' : '#b6b88f';
    ctx.fillText(state.relay ? 'AWAKE' : 'J · WHIP', RELIC_RELAY_X - 23, floorY - 34);
    this.tile(ctx, 14, RELIC_MURAL_X - 40, floorY - 96, 80, 96);
    ctx.fillStyle = '#8affe0'; ctx.fillText('E · READ', RELIC_MURAL_X - 27, floorY - 104);
    const my = floorY - 27;
    ctx.fillStyle = state.memory ? '#9eb781' : '#c9fce0';
    ctx.globalAlpha = state.memory ? .6 : .75 + .2 * Math.sin(time * 2);
    ctx.fillRect(RELIC_MEMORY_X - 2, my - 2, 4, 4); ctx.globalAlpha = 1;
    ctx.fillStyle = '#c4deac';
    ctx.fillText(state.memory ? 'REMEMBERED' : 'E · LISTEN', RELIC_MEMORY_X - 28, my - 12);
  }
  drawFrame(ctx, time) {
    ctx.fillStyle = '#8ab49d';
    for (let i = 0; i < 45; i++) {
      const x = ((i * 157 + Math.sin(time * .3 + i) * 18) % 1000 + 1000) % 1000;
      const y = ((i * 71 - time * (3 + i % 3)) % 540 + 540) % 540;
      ctx.globalAlpha = .12 + (i % 3) * .08; ctx.fillRect(x, y, 1 + (i % 2), 1);
    }
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, 0, 0, 540);
    shade.addColorStop(0, '#01080888'); shade.addColorStop(.22, '#01080800');
    shade.addColorStop(.83, '#01080800'); shade.addColorStop(1, '#01080888');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = 'rgba(2,8,16,.78)'; ctx.fillRect(18, 18, 250, 52);
    ctx.font = '11px monospace'; ctx.fillStyle = '#e1e7cc'; ctx.fillText('THE ROOT ARCHIVE', 30, 35);
    ctx.font = '9px monospace'; ctx.fillStyle = '#a0c4ad'; ctx.fillText('WEST BREACH · WHERE THE RAIN THINS', 30, 48);
    ctx.fillStyle = '#6a7e8d'; ctx.fillText('WALK RIGHT · BACK INTO THE STORM', 30, 62);
  }
}

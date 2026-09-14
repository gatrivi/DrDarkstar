// Andy's generated art sheet (assets/andy/andy-spritesheet-v1.png).
// 4x4 grid, 16 poses in README order. The generator baked in a checkered
// background, so the loader keys it out at runtime: dual-phase flood fill
// from the sheet borders (the checker's two grays both match), morphological
// closing to seal pinholes, feathered alpha on silhouette edges, per-cell
// connected components (drops weapon bleed from neighboring cells), and
// baseline-aligned composing into the engine's horizontal strip format.
// World sizes stay identical to the procedural sheet, so physics, reaches
// and knockback are untouched — only the texture changes.
export const ANDY_SHEET_CELLS = [
  'idle', 'walk1', 'walk2', 'dash',
  'jump', 'punch1', 'punch2', 'punch3',
  'windup', 'swing', 'serve', 'super',
  'whistle', 'block', 'hurt', 'victory',
];

// Engine strip order: the full kit plus hurt/victory. Poses the sheet lacks
// reuse the closest art pose (roll reads as a dash-lean with dust ghosts).
export const ENGINE_POSES = [
  'idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'guard',
  'punch1', 'punch2', 'punch3', 'ftilt', 'utilt', 'dtilt',
  'windup', 'swing', 'usmash', 'dsmash',
  'serve', 'super', 'whistle', 'hurt', 'victory',
];

export const ANDY_POSE_CELL = {
  idle: 0, walk1: 1, walk2: 2, dash: 3, jump: 4, roll: 3, guard: 13,
  punch1: 5, punch2: 6, punch3: 7, ftilt: 6, utilt: 5, dtilt: 7,
  windup: 8, swing: 9, usmash: 9, dsmash: 9,
  serve: 10, super: 11, whistle: 12, hurt: 14, victory: 15,
};

const SHEET_URL = './assets/andy/andy-spritesheet-v1.png';
const BG_TOL = 35;    // brightness distance to either checker gray
const CLOSE_R = 6;    // morphological closing radius (seals pinholes)
const COMP_MIN = 0.02;// drop border-touching components smaller than this share
const FEATHER_IN = 30, FEATHER_OUT = 138; // silhouette edge alpha ramp

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('andy sheet missing'));
    img.src = src;
  });
}

function integralOf(data, w, h) {
  const sat = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
    }
  }
  return sat;
}

function boxSum(sat, w, h, x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
  return (sat[(y1 + 1) * (w + 1) + x1 + 1] - sat[y0 * (w + 1) + x1 + 1]
    - sat[(y1 + 1) * (w + 1) + x0] + sat[y0 * (w + 1) + x0]);
}

// 4-connected components of `mask` inside a slice rect.
function components(mask, W, x0, y0, x1, y1) {
  const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
  const seen = new Uint8Array(sw * sh);
  const comps = [];
  const qx = new Int32Array(sw * sh);
  const qy = new Int32Array(sw * sh);
  const at = (x, y) => (y - y0) * sw + (x - x0);
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      if (seen[at(xx, yy)] || !mask[yy * W + xx]) continue;
      let qh = 0, qt = 0;
      qx[qt] = xx; qy[qt] = yy; qt++;
      seen[at(xx, yy)] = 1;
      const comp = { size: 0, touches: false, minx: xx, miny: yy, maxx: xx, maxy: yy, pixels: [] };
      while (qh < qt) {
        const ax = qx[qh], ay = qy[qh];
        qh++; comp.size++;
        comp.pixels.push(ay * W + ax);
        if (ax < comp.minx) comp.minx = ax; if (ax > comp.maxx) comp.maxx = ax;
        if (ay < comp.miny) comp.miny = ay; if (ay > comp.maxy) comp.maxy = ay;
        if (ax === x0 || ax === x1 || ay === y0 || ay === y1) comp.touches = true;
        if (ax > x0 && !seen[at(ax - 1, ay)] && mask[ay * W + ax - 1]) { seen[at(ax - 1, ay)] = 1; qx[qt] = ax - 1; qy[qt] = ay; qt++; }
        if (ax < x1 && !seen[at(ax + 1, ay)] && mask[ay * W + ax + 1]) { seen[at(ax + 1, ay)] = 1; qx[qt] = ax + 1; qy[qt] = ay; qt++; }
        if (ay > y0 && !seen[at(ax, ay - 1)] && mask[(ay - 1) * W + ax]) { seen[at(ax, ay - 1)] = 1; qx[qt] = ax; qy[qt] = ay - 1; qt++; }
        if (ay < y1 && !seen[at(ax, ay + 1)] && mask[(ay + 1) * W + ax]) { seen[at(ax, ay + 1)] = 1; qx[qt] = ax; qy[qt] = ay + 1; qt++; }
      }
      comps.push(comp);
    }
  }
  comps.sort((a, b) => b.size - a.size);
  return comps;
}

export async function loadAndySheet({ tint = false } = {}) {
  const img = await loadImage(SHEET_URL);
  const src = document.createElement('canvas');
  src.width = img.naturalWidth || img.width;
  src.height = img.naturalHeight || img.height;
  const W = src.width, H = src.height;
  if (!W || !H || W < 100 || H < 100) throw new Error('andy sheet too small');
  const sctx = src.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const { data } = sctx.getImageData(0, 0, W, H);

  const bright = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) {
    bright[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  }
  const isBg = (i) => Math.abs(bright[i] - 219) < BG_TOL || Math.abs(bright[i] - 155) < BG_TOL;

  // Flood fill from the sheet borders through bg-colored pixels.
  const removed = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let head = 0;
  for (let x = 0; x < W; x++) { stack[head++] = x; stack[head++] = (H - 1) * W + x; }
  for (let y = 0; y < H; y++) { stack[head++] = y * W; stack[head++] = y * W + W - 1; }
  let cursor = 0;
  while (cursor < head) {
    const i = stack[cursor++];
    if (removed[i] || !isBg(i)) continue;
    removed[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack[head++] = i - 1;
    if (x < W - 1) stack[head++] = i + 1;
    if (y > 0) stack[head++] = i - W;
    if (y < H - 1) stack[head++] = i + W;
  }

  // Morphological closing on the kept mask (dilate then erode).
  const kept = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) kept[i] = removed[i] ? 0 : 1;
  const sat = integralOf(kept, W, H);
  const dil = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      dil[y * W + x] = boxSum(sat, W, H, x - CLOSE_R, y - CLOSE_R, x + CLOSE_R, y + CLOSE_R) > 0 ? 1 : 0;
    }
  }
  const sat2 = integralOf(dil, W, H);
  const closed = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ex0 = Math.max(0, x - CLOSE_R), ey0 = Math.max(0, y - CLOSE_R);
      const ex1 = Math.min(W - 1, x + CLOSE_R), ey1 = Math.min(H - 1, y + CLOSE_R);
      const full = (ex1 - ex0 + 1) * (ey1 - ey0 + 1);
      closed[y * W + x] = boxSum(sat2, W, H, ex0, ey0, ex1, ey1) === full ? 1 : 0;
    }
  }

  // Keyed RGBA with feathered silhouette edges.
  const rgba = new ImageData(W, H);
  const out = rgba.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, k = i * 4;
      if (!closed[i]) {
        out[k + 3] = 0;
        continue;
      }
      out[k] = data[k]; out[k + 1] = data[k + 1]; out[k + 2] = data[k + 2];
      let rs = 0, n = 0;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(H - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(W - 1, x + 1); nx++) {
          if (!closed[ny * W + nx]) { rs += bright[ny * W + nx]; n++; }
        }
      }
      if (n === 0) {
        out[k + 3] = 255;
      } else {
        const d = Math.abs(bright[i] - rs / n) * 3;
        out[k + 3] = d < FEATHER_IN ? 0 : d > FEATHER_OUT ? 255 : Math.round(255 * (d - FEATHER_IN) / (FEATHER_OUT - FEATHER_IN));
      }
    }
  }

  // Slice the 4x4 grid (with overlap), drop weapon-bleed slivers, autobbox.
  const cw = W / 4, ch = H / 4;
  const keepMask = new Uint8Array(W * H);
  const bboxes = [];
  let maxW = 0, maxH = 0;
  for (let ci = 0; ci < 16; ci++) {
    const cx = ci % 4, cy = (ci / 4) | 0;
    const x0 = Math.max(0, Math.round(cx * cw) - 2);
    const y0 = Math.max(0, Math.round(cy * ch) - 2);
    const x1 = Math.min(W - 1, Math.round((cx + 1) * cw) + 2);
    const y1 = Math.min(H - 1, Math.round((cy + 1) * ch) + 2);
    const comps = components(closed, W, x0, y0, x1, y1);
    const biggest = comps.length ? comps[0].size : 0;
    if (!biggest) throw new Error(`andy sheet cell ${ci} is empty`);
    let minx = Infinity, miny = Infinity, maxx = -1, maxy = -1;
    for (const c of comps) {
      if (c.touches && c.size < biggest * COMP_MIN) continue; // neighbor's weapon tip
      for (const p of c.pixels) keepMask[p] = 1;
      if (c.minx < minx) minx = c.minx; if (c.miny < miny) miny = c.miny;
      if (c.maxx > maxx) maxx = c.maxx; if (c.maxy > maxy) maxy = c.maxy;
    }
    bboxes.push({ minx, miny, maxx, maxy });
    if (maxx - minx + 1 > maxW) maxW = maxx - minx + 1;
    if (maxy - miny + 1 > maxH) maxH = maxy - miny + 1;
  }
  const maxContentH = maxH;

  // Compose the engine strip in ENGINE_POSES order, baseline-aligned.
  // (Re-mark kept pixels through the same drop rule while blitting.)
  const PAD = 8;
  const pw = maxW + PAD * 2, ph = maxH + PAD * 2;
  const strip = document.createElement('canvas');
  strip.width = pw * ENGINE_POSES.length;
  strip.height = ph;
  const sctx2 = strip.getContext('2d');
  sctx2.imageSmoothingEnabled = false;
  ENGINE_POSES.forEach((pose, fi) => {
    const cell = ANDY_POSE_CELL[pose];
    if (cell == null) throw new Error(`no art cell for pose ${pose}`);
    const bb = bboxes[cell];
    const fw = bb.maxx - bb.minx + 1, fh = bb.maxy - bb.miny + 1;
    const frame = sctx2.createImageData(fw, fh);
    for (let yy = 0; yy < fh; yy++) {
      for (let xx = 0; xx < fw; xx++) {
        const sx = bb.minx + xx, sy = bb.miny + yy;
        const di = (yy * fw + xx) * 4;
        if (keepMask[sy * W + sx]) {
          const si = (sy * W + sx) * 4;
          frame.data[di] = out[si]; frame.data[di + 1] = out[si + 1];
          frame.data[di + 2] = out[si + 2]; frame.data[di + 3] = out[si + 3];
        }
      }
    }
    sctx2.putImageData(frame, fi * pw + ((pw - fw) >> 1), ph - PAD - fh);
  });

  // Dummy recolor: a translucent team tint over the art (procedural sheets
  // bake the palette swap; the generated sheet gets a glaze instead).
  if (tint) {
    sctx2.save();
    sctx2.globalCompositeOperation = 'source-atop';
    sctx2.globalAlpha = 0.28;
    sctx2.fillStyle = '#b03a5b';
    sctx2.fillRect(0, 0, strip.width, strip.height);
    sctx2.restore();
  }

  return { sheet: strip, pw, ph, frames: ENGINE_POSES.length, unitScale: 32 / maxContentH };
}

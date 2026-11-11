/* ============================================================
   Dr Darkstar - SPRITE FORGE  (sprites.js)
   Sprite sheet workbench for the little Smash-style game.
   Plain browser JS, no dependencies, no build step.

   Pipeline: LOAD -> KEY (drop the checkerboard) -> SLICE (grid)
             -> TRIM + ALIGN (baseline / centre) -> PREVIEW -> EXPORT

   Works best served:  node server.mjs   ->  http://localhost:8080/sprites.html
   ============================================================ */

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const pad2 = (n) => String(n).padStart(2, '0');
const baseName = (p) => String(p).split(/[\\/]/).pop();

/* ---------------- state ---------------- */
const state = {
  source: null,        // { name, w, h, canvas }
  sheet: null,         // ImageData after keying
  keyedCanvas: null,   // canvas holding the keyed sheet
  key: { on: true, despill: true, tolerance: 24, softness: 20, colors: [] },
  grid: { cols: 4, rows: 4, margin: 0, spacing: 0, offX: 0, offY: 0, forceW: 0, forceH: 0, auto: true },
  frames: [],
  align: { trim: true, baseline: true, centerX: true, pivotX: 0, pivotY: 0 },
  anim: { fps: 8, index: 0, playing: false, loop: 'loop', dir: 1, acc: 0 },
  view: { zoom: 1, mode: 'stage', grid: true, onion: false, pivot: true, rain: true, panX: 0, panY: 0 },
  export: { mode: 'normalized', scale: 1, name: 'frames' },
  pendingPreset: null,
};
const ghostCache = new Map();

let dirty = true;
let hover = null;
const mark = () => { dirty = true; };

/* ---------------- toast ---------------- */
let toastTimer = 0;
function toast(msg, kind = 'info') {
  const el = $('#toast');
  el.textContent = msg; el.dataset.kind = kind; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3000);
}

/* ---------------- sheets / presets ---------------- */
const PRESETS = [
  { id: 'andy', label: 'ANDY', path: './assets/andy/andy-spritesheet-v1.png', cols: 4, rows: 4 },
  { id: 'eliseo', label: 'ELISEO', path: './assets/eliseo/eliseo-spritesheet-v1.png', cols: 4, rows: 4 },
  { id: 'simon', label: 'SIMON', path: './assets/simon/simon-spritesheet-v1.png', cols: 4, rows: 2 },
  { id: 'relic', label: 'RELIC H.', path: './assets/night-hunters/relic-hunter/relic-hunter-spritesheet-v1.png', cols: 4, rows: 4 },
  { id: 'night', label: 'NIGHT', path: './assets/night-hunters/sprites.png', cols: 4, rows: 4 },
  { id: 'throw', label: 'THROW', path: './assets/night-hunters/throw-guard-v2.png', cols: 3, rows: 3 },
  { id: 'ddstar', label: 'DARKSTAR', path: './assets/drdarkstar/preview-v1.png', cols: 1, rows: 1 },
  { id: 'idle', label: 'IDLE INV', path: './assets/drdarkstar/idle-inbetweens-v1.png', cols: 1, rows: 1 },
  { id: 'tiles', label: 'TILESET', path: './assets/lost-area/tileset-v1.png', cols: 4, rows: 4 },
  { id: 'foliage', label: 'FOLIAGE', path: './assets/lost-area/foliage-props-v1.png', cols: 4, rows: 4 },
];

/* ---------------- image loading ---------------- */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

async function loadFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    setSource({ name: file.name, w: img.naturalWidth, h: img.naturalHeight, img });
  } catch (e) { toast(e.message, 'warn'); }
  finally { URL.revokeObjectURL(url); }
}

async function loadFromPath(path, label) {
  try {
    const img = await loadImage(new URL(path, location.href).href);
    setSource({ name: label || baseName(path), w: img.naturalWidth, h: img.naturalHeight, img });
  } catch (e) {
    toast('Not found: ' + path + ' - is the dev server running?', 'warn');
  }
}

function setSource(src) {
  const canvas = document.createElement('canvas');
  canvas.width = src.w; canvas.height = src.h;
  let tainted = false;
  try { canvas.getContext('2d', { willReadFrequently: true }).drawImage(src.img, 0, 0); }
  catch (e) { tainted = true; }
  state.source = { name: src.name, w: src.w, h: src.h, canvas, tainted };
  state.frames = [];
  state.anim.index = 0; state.anim.playing = false;
  state.view.zoom = 1; state.view.panX = 0; state.view.panY = 0;
  $('#srcChip').textContent = state.source.name;
  $('#srcChip').title = state.source.name + ' - ' + src.w + '\u00d7' + src.h;
  rebuildKey(false, true);
  if (!tainted) toast('Loaded ' + state.source.name + ' \u00b7 ' + src.w + '\u00d7' + src.h, 'ok');
  syncControls(); syncTransport(); mark();
}

function applyPreset(p) {
  $('#pathInput').value = p.path;
  state.grid.auto = true;
  state.pendingPreset = p;   // preset grid wins over auto-detection for this load
  loadFromPath(p.path, p.label);
}

/* Read the alpha projection, then score candidate grids by how empty their dividing
   lines are. Generated sheets carry no drawn grid, and poses drift across nominal
   cells, so equal quarters cannot be trusted. */
function projection() {
  const s = state.sheet;
  if (!s) return null;
  const { width: W, height: H, data } = s;
  const colProj = new Int32Array(W), rowProj = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    let p = y * W * 4 + 3;
    for (let x = 0; x < W; x++, p += 4) if (data[p] > 24) { colProj[x]++; rowProj[y]++; }
  }
  return { W, H, colProj, rowProj };
}

/* 0 = every dividing line lands on empty space, 1 = lines run through art */
function gridScore(proj, cols, rows) {
  const { W, H, colProj, rowProj } = proj;
  let e = 0, n = 0;
  for (let k = 1; k < cols; k++) {
    const x = Math.round(W * k / cols);
    for (let t = -1; t <= 1; t++) { e += colProj[clamp(x + t, 0, W - 1)] / H; n++; }
  }
  for (let k = 1; k < rows; k++) {
    const y = Math.round(H * k / rows);
    for (let t = -1; t <= 1; t++) { e += rowProj[clamp(y + t, 0, H - 1)] / W; n++; }
  }
  return n ? e / n : 1;
}

function squareish(W, H, cols, rows) {
  const ratio = (W / cols) / (H / rows);
  return ratio >= 0.78 && ratio <= 1.28;
}

function detectGrid() {
  const proj = projection();
  if (!proj) return null;
  const cand = [];
  for (let cols = 2; cols <= 10; cols++) for (let rows = 2; rows <= 10; rows++) {
    if (!squareish(proj.W, proj.H, cols, rows)) continue;
    cand.push({ cols, rows, score: gridScore(proj, cols, rows), cells: cols * rows });
  }
  cand.sort((a, b) => a.score - b.score || b.cells - a.cells);
  if (cand.length && cand[0].score < 0.08) return { cols: cand[0].cols, rows: cand[0].rows };
  return null;
}

/* confident detection failed: pick the best of a few sane layouts, else a plain guess */
function guessGrid() {
  const proj = projection();
  const set = [[4, 4], [4, 2], [2, 4], [3, 3], [2, 2]];
  let best = { cols: 1, rows: 1, score: 1 };
  if (proj) {
    for (const pair of set) {
      if (!squareish(proj.W, proj.H, pair[0], pair[1])) continue;
      const score = gridScore(proj, pair[0], pair[1]);
      if (score < best.score) best = { cols: pair[0], rows: pair[1], score };
    }
  }
  if (best.score <= 0.30) return { cols: best.cols, rows: best.rows };
  const square = state.source && Math.abs(state.source.w - state.source.h) < Math.max(state.source.w, state.source.h) * 0.08;
  return square ? { cols: 4, rows: 4 } : { cols: 1, rows: 1 };
}

/* ---------------- demo sheet (so the tool is alive with zero assets) ---------------- */
function buildDemoSheet() {
  const S = 128, COLS = 4, ROWS = 4;
  const cv = document.createElement('canvas');
  cv.width = S * COLS; cv.height = S * ROWS;
  const c = cv.getContext('2d');
  // checkerboard background (the thing the key has to eat)
  for (let y = 0; y < cv.height; y += 16)
    for (let x = 0; x < cv.width; x += 16) {
      c.fillStyle = ((x / 16 + y / 16) % 2) ? '#c8c8c8' : '#ffffff';
      c.fillRect(x, y, 16, 16);
    }
  const skin = '#e8b48a', suit = '#2b6cff', dark = '#101a2e', trim = '#ffb43a', blade = '#dff5ff';
  const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const i = r * COLS + col;
    const cx = col * S + S / 2, base = r * S + S - 26;
    const bob = [0, 2, 1, 3][i % 4];
    // legs
    px(cx - 12, base - 26 + bob, 8, 26, dark); px(cx + 4, base - 26 - bob, 8, 26, dark);
    // torso
    px(cx - 16, base - 60 + bob, 32, 36, suit);
    px(cx - 16, base - 60 + bob, 32, 6, trim);
    // head
    px(cx - 10, base - 84 + bob, 20, 20, skin);
    px(cx - 12, base - 88 + bob, 24, 8, dark);
    px(cx + 2, base - 76 + bob, 4, 4, dark);
    // arms
    const swing = [0, 6, -6, 10][i % 4];
    px(cx + 16, base - 56 + bob + swing, 16, 7, skin);
    px(cx - 32, base - 56 + bob - swing, 16, 7, skin);
    // prop every few frames - deliberately spills past the cell edge
    if (i % 4 === 2) px(cx + 30, base - 96, 6, 90, blade);       // sword above
    if (i % 4 === 3) { px(cx + 30, base - 44, 22, 10, trim); px(cx + 48, base - 44, 12, 10, '#c8c8c8'); } // paddle out right
    if (i === 8) px(cx - 22, base - 100, 44, 10, '#58ffa8');      // a wide frame that breaks equal cells
  }
  setSource({ name: 'demo-sheet.png', w: cv.width, h: cv.height, img: cv });
}

/* ---------------- background keying ---------------- */
function rebuildKey(showToast = false, detect = false) {
  if (!state.source) return;
  const { canvas, w: W, h: H } = state.source;
  let img;
  try { img = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H); }
  catch (e) {
    state.source.tainted = true;
    if (showToast) toast('Pixel access blocked. Run "node server.mjs" and reload, or drop the file in.', 'warn');
    return;
  }
  state.source.tainted = false;
  const d = img.data;

  // 1. most common border colours = background candidates
  const hist = new Map();
  const ring = Math.max(1, Math.round(Math.min(W, H) * 0.012));
  const add = (x, y) => {
    const p = (y * W + x) * 4;
    const k = ((d[p] >> 3) << 10) | ((d[p + 1] >> 3) << 5) | (d[p + 2] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  };
  for (let x = 0; x < W; x++) for (let t = 0; t < ring; t++) { add(x, t); add(x, H - 1 - t); }
  for (let y = 0; y < H; y++) for (let t = 0; t < ring; t++) { add(t, y); add(W - 1 - t, y); }
  const colors = Array.from(hist.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k]) => [((k >> 10) & 31) << 3 | 4, ((k >> 5) & 31) << 3 | 4, (k & 31) << 3 | 4]);
  state.key.colors = colors;

  // 2. key it out, with a soft edge and despill so PNG edges stay clean
  const tol = state.key.tolerance, soft = state.key.softness, on = state.key.on, despill = state.key.despill;
  const out = new Uint8ClampedArray(d.length);
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    let a = 255, near = null;
    if (on) {
      let best = 1e9, bc = null;
      for (let i = 0; i < colors.length; i++) {
        const col = colors[i];
        const dd = Math.max(Math.abs(r - col[0]), Math.abs(g - col[1]), Math.abs(b - col[2]));
        if (dd < best) { best = dd; bc = col; }
      }
      if (best <= tol) { a = 0; near = bc; }
      else if (best < tol + soft && soft > 0) { a = Math.round(255 * (best - tol) / soft); near = bc; }
    }
    if (a <= 8) { out[p + 3] = 0; out[p] = r; out[p + 1] = g; out[p + 2] = b; continue; }
    if (near && a < 250 && despill) {
      const f = a / 255, inv = 1 - f;
      out[p] = clamp((r - near[0] * inv) / f, 0, 255);
      out[p + 1] = clamp((g - near[1] * inv) / f, 0, 255);
      out[p + 2] = clamp((b - near[2] * inv) / f, 0, 255);
    } else { out[p] = r; out[p + 1] = g; out[p + 2] = b; }
    out[p + 3] = Math.min(d[p + 3], a);
  }
  state.sheet = new ImageData(out, W, H);

  const kc = document.createElement('canvas');
  kc.width = W; kc.height = H;
  kc.getContext('2d').putImageData(state.sheet, 0, 0);
  state.keyedCanvas = kc;

  if (detect) {
    const p = state.pendingPreset;
    const g = p ? { cols: p.cols, rows: p.rows } : (detectGrid() || guessGrid());
    state.grid.cols = g.cols; state.grid.rows = g.rows;
    state.grid.forceW = 0; state.grid.forceH = 0;
    state.grid.margin = 0; state.grid.spacing = 0; state.grid.offX = 0; state.grid.offY = 0;
    state.pendingPreset = null;
    syncControls();
  }
  ghostCache.clear();
  renderSwatches();
  rebuildFrames();
  if (showToast) toast('Sheet keyed \u00b7 ' + colors.length + ' background colour(s)' + (detect ? ' \u00b7 grid ' + state.grid.cols + '\u00d7' + state.grid.rows : ''), 'ok');
}

function renderSwatches() {
  const box = $('#bgSwatches');
  box.innerHTML = '';
  if (!state.key.colors.length) { const i = document.createElement('i'); i.dataset.none = '1'; box.appendChild(i); return; }
  for (const c of state.key.colors) {
    const i = document.createElement('i');
    i.style.background = 'rgb(' + c.join(',') + ')';
    i.title = 'rgb(' + c.join(', ') + ')';
    box.appendChild(i);
  }
}

/* ---------------- grid slicing + frames ---------------- */
function cellSize() {
  const { cols, rows, margin, spacing, forceW, forceH } = state.grid;
  const W = state.source ? state.source.w : 0, H = state.source ? state.source.h : 0;
  const cw = forceW || Math.floor((W - margin * 2 - spacing * (cols - 1)) / cols);
  const ch = forceH || Math.floor((H - margin * 2 - spacing * (rows - 1)) / rows);
  return [Math.max(1, cw || 1), Math.max(1, ch || 1)];
}

function contentBounds(cell) {
  const sheet = state.sheet;
  if (!sheet) return { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
  const { width: W, height: H, data } = sheet;
  const x0 = clamp(Math.round(cell.x), 0, W), y0 = clamp(Math.round(cell.y), 0, H);
  const x1 = clamp(Math.round(cell.x + cell.w), 0, W), y1 = clamp(Math.round(cell.y + cell.h), 0, H);
  let minX = x1, minY = y1, maxX = x0 - 1, maxY = y0 - 1;
  for (let y = y0; y < y1; y++) {
    let p = (y * W + x0) * 4 + 3;
    for (let x = x0; x < x1; x++, p += 4) {
      if (data[p] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return { x: x0, y: y0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function rebuildFrames() {
  if (!state.source) { state.frames = []; renderFrameList(); syncTransport(); mark(); return; }
  const prevOn = state.frames.map(f => f.on);
  const { cols, rows, margin, spacing, offX, offY } = state.grid;
  const [cw, ch] = cellSize();
  const W = state.source.w, H = state.source.h;
  const next = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = margin + offX + c * (cw + spacing);
    const y = margin + offY + r * (ch + spacing);
    const cell = { x, y, w: Math.min(cw, Math.max(0, W - x)), h: Math.min(ch, Math.max(0, H - y)) };
    const i = next.length;
    next.push({ i, r, c, cell, content: contentBounds(cell), on: prevOn[i] !== undefined ? prevOn[i] : true });
  }
  state.frames = next;
  ghostCache.clear();
  computePivot();
  state.anim.index = clamp(state.anim.index, 0, Math.max(0, next.length - 1));
  renderFrameList(); syncTransport(); updateReadout(); mark();
}

function computePivot() {
  const on = state.frames.filter(f => f.on && f.content.w > 0);
  if (!on.length) { state.align.pivotX = 0; state.align.pivotY = 0; return; }
  const cxs = on.map(f => f.content.x - f.cell.x + f.content.w / 2).sort((a, b) => a - b);
  state.align.pivotX = cxs[Math.floor(cxs.length / 2)];
  state.align.pivotY = Math.max.apply(null, on.map(f => f.content.y - f.cell.y + f.content.h));
}

function visibleFrames() { return state.frames.filter(f => f.on && f.content.w > 0); }
function currentFrame() { return state.frames[state.anim.index] || null; }

/* ---------------- frame strip ---------------- */
function renderFrameList() {
  const host = $('#frameList');
  host.innerHTML = '';
  $('#frameCount').textContent = state.frames.length;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  for (const f of state.frames) {
    const el = document.createElement('div');
    el.className = 'frame' + (f.i === state.anim.index ? ' sel' : '') + (f.on ? '' : ' off');
    el.title = 'Frame ' + f.i + ' \u00b7 cell ' + Math.round(f.cell.w) + '\u00d7' + Math.round(f.cell.h) + (f.content.w ? ' \u00b7 content ' + f.content.w + '\u00d7' + f.content.h : ' \u00b7 empty');
    const cv = document.createElement('canvas');
    cv.width = Math.round(58 * dpr); cv.height = Math.round(46 * dpr);
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    if (state.keyedCanvas && f.content.w) {
      const src = f.content;
      const s = Math.min(cv.width / src.w, cv.height / src.h);
      const dw = src.w * s, dh = src.h * s;
      c.drawImage(state.keyedCanvas, src.x, src.y, src.w, src.h, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
    }
    const n = document.createElement('span'); n.className = 'n'; n.textContent = pad2(f.i);
    const eye = document.createElement('span'); eye.className = 'eye'; eye.textContent = f.on ? '\u25c9' : '\u25cb';
    eye.title = 'Include in playback / export';
    eye.addEventListener('click', (e) => { e.stopPropagation(); f.on = !f.on; computePivot(); renderFrameList(); mark(); });
    el.append(cv, n, eye);
    el.addEventListener('click', () => { state.anim.index = f.i; syncTransport(); mark(); renderFrameList(); });
    host.appendChild(el);
  }
}

/* ---------------- playback ---------------- */
function advance() {
  const list = state.frames, a = state.anim;
  if (!list.length) return;
  const usable = list.some(f => f.on && f.content.w > 0);
  if (!usable) { a.playing = false; syncTransport(); return; }
  let i = a.index, guard = 0;
  do {
    if (a.loop === 'pingpong') {
      i += a.dir;
      if (i >= list.length) { i = Math.max(0, list.length - 2); a.dir = -1; }
      else if (i < 0) { i = Math.min(list.length - 1, 1); a.dir = 1; }
    } else {
      i += 1;
      if (i >= list.length) {
        if (a.loop === 'once') { i = list.length - 1; a.playing = false; syncTransport(); break; }
        i = 0;
      }
    }
    guard++;
  } while ((!list[i] || !list[i].on || list[i].content.w === 0) && guard < list.length * 3 + 4);
  a.index = clamp(i, 0, list.length - 1);
}

function stepFrame(d) {
  const list = state.frames; if (!list.length) return;
  state.anim.playing = false;
  let i = state.anim.index + d;
  i = (i % list.length + list.length) % list.length;
  state.anim.index = i;
  syncTransport(); mark(); renderFrameList();
}

/* ---------------- stage rendering ---------------- */
const stage = $('#stage');
const sctx = stage.getContext('2d');
let stageW = 0, stageH = 0;
let rain = [], sky = [], skyKey = '';

function ensureRain(W, H) {
  rain = [];
  const n = Math.round(W * H / 9000);
  for (let i = 0; i < n; i++) rain.push({ x: Math.random() * W, y: Math.random() * H, l: 5 + Math.random() * 20, v: 110 + Math.random() * 190, a: .05 + Math.random() * .16 });
}
function ensureSky(W, H) {
  const key = W + 'x' + H; if (key === skyKey) return;
  skyKey = key; sky = [];
  let x = -24, i = 0;
  while (x < W + 24) {
    const r1 = rnd(i++), r2 = rnd(i++), r3 = rnd(i++);
    const w = 12 + r1 * 42, h = 26 + r2 * 150;
    sky.push({ x, w, h, hue: r3, lit: r1 + r2 });
    x += w + 2 + r2 * 12;
  }
}

function drawStage() {
  const W = stage.clientWidth, H = stage.clientHeight;
  if (!W || !H) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (stage.width !== Math.round(W * dpr) || stage.height !== Math.round(H * dpr)) {
    stage.width = Math.round(W * dpr); stage.height = Math.round(H * dpr);
    ensureRain(W, H); mark();
  }
  stageW = W; stageH = H;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, W, H);
  ensureSky(W, H);
  if (state.view.mode === 'sheet') drawSheetView(W, H); else drawStageView(W, H);
  drawScan(W, H);
}

/* --- Final-Destination-style stage --- */
function drawStageView(W, H) {
  const t = performance.now() / 1000;
  const g = sctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04060d'); g.addColorStop(.42, '#070d1e');
  g.addColorStop(.66, '#0d0a22'); g.addColorStop(1, '#05060f');
  sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);

  drawSkyline(W, H, t);

  // horizon bloom
  const hb = sctx.createLinearGradient(0, H * .40, 0, H * .70);
  hb.addColorStop(0, 'rgba(255,67,164,0)');
  hb.addColorStop(.55, 'rgba(255,67,164,.10)');
  hb.addColorStop(1, 'rgba(79,240,255,0)');
  sctx.fillStyle = hb; sctx.fillRect(0, H * .40, W, H * .30);

  if (state.view.rain) drawRain(W, H);

  const deckY = H * .70 + state.view.panY;
  const half = Math.min(W * .40, 340);
  const cx = W / 2 + state.view.panX;

  drawPlatform(cx, deckY, half, W, H, t);

  const f = currentFrame();
  if (f && f.content.w) {
    const useContent = state.align.trim && f.content.w > 0;
    const r = useContent ? f.content : f.cell;
    const base = Math.min((H * .40) / r.h, (W * .30) / r.w);
    const s = base * state.view.zoom;
    const aX = state.view.panX + W / 2, aY = deckY - 2;
    // aligned => every frame's trimmed body sits bottom-centre on the deck;
    // unaligned => the nominal cell sits on the deck and art keeps its own offset
    const dstX = state.align.centerX ? aX - r.w * s / 2 : aX - f.cell.w * s / 2 + (r.x - f.cell.x) * s;
    const dstY = state.align.baseline ? aY - r.h * s : aY - f.cell.h * s + (r.y - f.cell.y) * s;

    if (state.view.onion) {
      const list = visibleFrames(); const k = list.indexOf(f);
      if (k > 0) ghost(list[k - 1], aX, aY, s, 'rgba(79,240,255,.85)');
      if (k >= 0 && k < list.length - 1) ghost(list[k + 1], aX, aY, s, 'rgba(255,67,164,.85)');
    }

    // contact shadow under the feet
    sctx.save();
    sctx.globalAlpha = .5;
    sctx.fillStyle = '#000';
    sctx.beginPath();
    sctx.ellipse(dstX + r.w * s / 2, aY + 2, Math.min(r.w * s * .42, 90), 6, 0, 0, Math.PI * 2);
    sctx.filter = 'blur(4px)';
    sctx.fill();
    sctx.restore();

    // mirrored reflection below the deck
    sctx.save();
    sctx.globalAlpha = .16;
    sctx.imageSmoothingEnabled = false;
    sctx.translate(dstX + r.w * s / 2, aY);
    sctx.scale(1, -1);
    sctx.drawImage(state.keyedCanvas, r.x, r.y, r.w, r.h, -r.w * s / 2, -r.h * s, r.w * s, r.h * s);
    sctx.restore();

    // the frame itself
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(state.keyedCanvas, r.x, r.y, r.w, r.h, dstX, dstY, r.w * s, r.h * s);

    if (state.view.grid) {
      sctx.save();
      sctx.lineWidth = 1;
      sctx.setLineDash([3, 3]);
      sctx.strokeStyle = 'rgba(255,180,58,.75)';
      sctx.strokeRect(dstX + .5, dstY + .5, r.w * s - 1, r.h * s - 1);
      sctx.setLineDash([]);
      sctx.strokeStyle = 'rgba(79,240,255,.35)';
      sctx.strokeRect(aX - f.cell.w * s / 2 + .5, aY - f.cell.h * s + .5, f.cell.w * s - 1, f.cell.h * s - 1);
      sctx.restore();
    }
    if (state.view.pivot) {
      sctx.save();
      sctx.strokeStyle = 'rgba(255,67,164,.9)'; sctx.lineWidth = 1;
      sctx.beginPath();
      sctx.moveTo(aX - 8, aY + .5); sctx.lineTo(aX + 8, aY + .5);
      sctx.moveTo(aX + .5, aY - 8); sctx.lineTo(aX + .5, aY + 8);
      sctx.stroke();
      sctx.restore();
    }
  } else if (!state.source) {
    sctx.save();
    sctx.fillStyle = 'rgba(207,233,245,.5)';
    sctx.font = '700 12px ui-monospace, monospace';
    sctx.textAlign = 'center';
    sctx.fillText('DROP A SPRITESHEET TO BEGIN', W / 2, H * .42);
    sctx.restore();
  }

  $('#hudFrame').textContent = f
    ? ('FRAME ' + pad2(f.i) + ' / ' + (state.frames.length - 1) + ' \u00b7 ' + (f.content.w || 0) + '\u00d7' + (f.content.h || 0))
    : 'NO FRAME';
  $('#hudState').textContent = (state.anim.playing ? 'RUNNING ' : 'PAUSED ') + state.anim.fps + 'fps';
}

/* a tinted copy of one frame, cached (tinting must happen on its own canvas,
   otherwise source-atop would flood the whole stage) */
function ghostSprite(fr, color, useContent) {
  const key = fr.i + '|' + color + '|' + (useContent ? 1 : 0);
  if (ghostCache.has(key)) return ghostCache.get(key);
  const r = useContent ? fr.content : fr.cell;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, r.w); cv.height = Math.max(1, r.h);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(state.keyedCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  ghostCache.set(key, cv);
  return cv;
}

function ghost(fr, aX, aY, s, color) {
  const useContent = state.align.trim && fr.content.w > 0;
  const r = useContent ? fr.content : fr.cell;
  if (!r.w) return;
  const dx = state.align.centerX ? aX - r.w * s / 2 : aX - fr.cell.w * s / 2 + (r.x - fr.cell.x) * s;
  const dy = state.align.baseline ? aY - r.h * s : aY - fr.cell.h * s + (r.y - fr.cell.y) * s;
  sctx.save();
  sctx.globalAlpha = .5;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(ghostSprite(fr, color, useContent), 0, 0, r.w, r.h, dx, dy, r.w * s, r.h * s);
  sctx.restore();
}

function drawSkyline(W, H, t) {
  const base = H * .62;
  for (const b of sky) {
    const h = b.h;
    sctx.fillStyle = b.hue > .5 ? '#0a1020' : '#080d1a';
    sctx.fillRect(b.x, base - h, b.w, h);
    sctx.fillStyle = 'rgba(79,240,255,.10)';
    sctx.fillRect(b.x, base - h, b.w, 1);
    // windows
    const cols = Math.max(1, Math.floor(b.w / 7));
    const rows = Math.max(1, Math.floor(h / 9));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const s = rnd(b.x * 3.7 + r * 11.3 + c * 5.1 + Math.floor(t / 3));
      if (s > .78) {
        sctx.fillStyle = s > .93 ? 'rgba(255,180,58,.55)' : (s > .86 ? 'rgba(79,240,255,.45)' : 'rgba(154,107,255,.35)');
        sctx.fillRect(b.x + 3 + c * 7, base - h + 5 + r * 9, 3, 4);
      }
    }
    if (b.lit > 1.25) { // neon sign
      sctx.fillStyle = b.hue > .5 ? 'rgba(255,67,164,.55)' : 'rgba(79,240,255,.5)';
      sctx.fillRect(b.x + 2, base - h + 10, Math.max(4, b.w - 4), 3);
    }
  }
  sctx.fillStyle = 'rgba(4,6,13,.55)';
  sctx.fillRect(0, base, W, H - base);
}

function drawRain(W, H) {
  sctx.save();
  sctx.lineCap = 'round';
  for (const d of rain) {
    sctx.strokeStyle = 'rgba(180,235,255,' + d.a + ')';
    sctx.lineWidth = 1;
    sctx.beginPath();
    sctx.moveTo(d.x, d.y);
    sctx.lineTo(d.x + d.l * .22, d.y + d.l);
    sctx.stroke();
  }
  sctx.restore();
}
function updateRain(dt) {
  if (!state.view.rain || state.view.mode !== 'stage') return;
  for (const d of rain) {
    d.y += d.v * dt; d.x += d.v * dt * .22;
    if (d.y > stageH) { d.y = -d.l; d.x = Math.random() * stageW; }
    if (d.x > stageW) d.x = -10;
  }
}

function drawPlatform(cx, deckY, half, W, H, t) {
  // under-glow
  const ug = sctx.createRadialGradient(cx, deckY + 26, 10, cx, deckY + 26, half * 1.5);
  ug.addColorStop(0, 'rgba(255,67,164,.30)');
  ug.addColorStop(.5, 'rgba(154,107,255,.12)');
  ug.addColorStop(1, 'rgba(255,67,164,0)');
  sctx.fillStyle = ug;
  sctx.fillRect(cx - half * 1.6, deckY - 20, half * 3.2, 220);

  // support pylon
  sctx.beginPath();
  sctx.moveTo(cx - half * .18, deckY + 16);
  sctx.lineTo(cx + half * .18, deckY + 16);
  sctx.lineTo(cx + half * .06, H + 20);
  sctx.lineTo(cx - half * .06, H + 20);
  sctx.closePath();
  const pg = sctx.createLinearGradient(0, deckY, 0, H);
  pg.addColorStop(0, '#0d1730'); pg.addColorStop(1, '#05070f');
  sctx.fillStyle = pg; sctx.fill();
  sctx.strokeStyle = 'rgba(79,240,255,.35)'; sctx.lineWidth = 1; sctx.stroke();

  // side wings
  for (const s of [-1, 1]) {
    const wx = cx + s * (half + 54), wy = deckY + 12, ww = 60;
    sctx.fillStyle = '#0a1428';
    sctx.fillRect(wx - ww / 2, wy, ww, 10);
    sctx.save();
    sctx.shadowColor = 'rgba(79,240,255,.7)'; sctx.shadowBlur = 12;
    sctx.fillStyle = 'rgba(79,240,255,.85)';
    sctx.fillRect(wx - ww / 2, wy, ww, 2);
    sctx.restore();
  }

  // main deck
  const dh = 18;
  sctx.save();
  sctx.shadowColor = 'rgba(79,240,255,.85)'; sctx.shadowBlur = 18;
  sctx.fillStyle = 'rgba(79,240,255,.9)';
  sctx.fillRect(cx - half, deckY, half * 2, 2);
  sctx.restore();
  const dg = sctx.createLinearGradient(0, deckY, 0, deckY + dh);
  dg.addColorStop(0, '#16233f'); dg.addColorStop(.5, '#0c1426'); dg.addColorStop(1, '#070b16');
  sctx.fillStyle = dg;
  sctx.fillRect(cx - half, deckY + 2, half * 2, dh);
  // deck dither lines
  sctx.strokeStyle = 'rgba(79,240,255,.10)';
  sctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = cx - half + (half * 2) * i / 8;
    sctx.beginPath(); sctx.moveTo(x, deckY + 3); sctx.lineTo(x - 10, deckY + dh); sctx.stroke();
  }
  sctx.strokeStyle = 'rgba(255,67,164,.55)';
  sctx.beginPath(); sctx.moveTo(cx - half, deckY + dh); sctx.lineTo(cx + half, deckY + dh); sctx.stroke();

  // slow scan light on the deck
  const sx = cx - half + ((t * 90) % (half * 2));
  const sg = sctx.createRadialGradient(sx, deckY + 4, 2, sx, deckY + 4, 90);
  sg.addColorStop(0, 'rgba(79,240,255,.22)'); sg.addColorStop(1, 'rgba(79,240,255,0)');
  sctx.fillStyle = sg; sctx.fillRect(sx - 90, deckY, 180, dh + 6);
}

/* --- flat sheet view with slicing overlay --- */
let sheetFit = { s: 1, ox: 0, oy: 0 };
function drawSheetView(W, H) {
  sctx.fillStyle = '#05070f'; sctx.fillRect(0, 0, W, H);
  if (!state.source || !state.keyedCanvas) return;
  const pad = 26;
  const s = Math.min((W - pad * 2) / state.source.w, (H - pad * 2) / state.source.h);
  const ox = (W - state.source.w * s) / 2, oy = (H - state.source.h * s) / 2;
  sheetFit = { s, ox, oy };
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(state.keyedCanvas, ox, oy, state.source.w * s, state.source.h * s);

  sctx.save();
  sctx.lineWidth = 1;
  for (const f of state.frames) {
    const x = ox + f.cell.x * s, y = oy + f.cell.y * s, w = f.cell.w * s, h = f.cell.h * s;
    const empty = !f.content.w;
    sctx.strokeStyle = f.i === state.anim.index ? 'rgba(79,240,255,.95)'
      : (hover === f.i ? 'rgba(255,180,58,.8)' : 'rgba(79,240,255,.28)');
    sctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    if (f.content.w) {
      sctx.setLineDash([3, 3]);
      sctx.strokeStyle = f.on ? 'rgba(255,180,58,.85)' : 'rgba(255,180,58,.3)';
      sctx.strokeRect(ox + f.content.x * s + .5, oy + f.content.y * s + .5, f.content.w * s - 1, f.content.h * s - 1);
      sctx.setLineDash([]);
    } else if (!empty) { /* noop */ }
    sctx.fillStyle = f.on ? 'rgba(79,240,255,.85)' : 'rgba(111,139,160,.55)';
    sctx.font = '700 9px ui-monospace, monospace';
    sctx.fillText(pad2(f.i), x + 4, y + 12);
  }
  sctx.restore();
  $('#hudFrame').textContent = hover !== null ? ('HOVER ' + pad2(hover)) : ('SHEET ' + state.source.w + '\u00d7' + state.source.h + ' \u00b7 CLICK A CELL');
  $('#hudState').textContent = state.grid.cols + '\u00d7' + state.grid.rows + ' GRID';
}

function drawScan(W, H) {
  sctx.save();
  sctx.globalAlpha = .16;
  sctx.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) sctx.fillRect(0, y, W, 1);
  sctx.restore();
}

/* ---------------- export ---------------- */
function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
}
const CRC = crcTable();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(entries) { // [{name, data:Uint8Array}] - method 0 (stored), no dependency
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const nameB = enc.encode(e.name), crc = crc32(e.data);
    const lh = new Uint8Array(30 + nameB.length), dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true); dv.setUint16(10, dosTime, true); dv.setUint16(12, dosDate, true);
    dv.setUint32(14, crc, true); dv.setUint32(18, e.data.length, true); dv.setUint32(22, e.data.length, true);
    dv.setUint16(26, nameB.length, true); dv.setUint16(28, 0, true);
    lh.set(nameB, 30);
    parts.push(lh, e.data);
    central.push({ nameB, crc, size: e.data.length, offset });
    offset += lh.length + e.data.length;
  }
  const cStart = offset; let cSize = 0;
  for (const c of central) {
    const ch = new Uint8Array(46 + c.nameB.length), dv = new DataView(ch.buffer);
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true);
    dv.setUint16(8, 0x0800, true); dv.setUint16(10, 0, true);
    dv.setUint16(12, dosTime, true); dv.setUint16(14, dosDate, true);
    dv.setUint32(16, c.crc, true); dv.setUint32(20, c.size, true); dv.setUint32(24, c.size, true);
    dv.setUint16(28, c.nameB.length, true); dv.setUint16(30, 0, true); dv.setUint16(32, 0, true);
    dv.setUint16(34, 0, true); dv.setUint16(36, 0, true); dv.setUint32(38, 0, true);
    dv.setUint32(42, c.offset, true);
    ch.set(c.nameB, 46);
    parts.push(ch); cSize += ch.length;
  }
  const end = new Uint8Array(22), dv = new DataView(end.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(8, central.length, true); dv.setUint16(10, central.length, true);
  dv.setUint32(12, cSize, true); dv.setUint32(16, cStart, true);
  parts.push(end);
  return new Blob(parts, { type: 'application/zip' });
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function scaleCanvas(source, sw, sh, scale) {
  if (scale === 1) return source;
  const cv = document.createElement('canvas');
  cv.width = Math.round(sw * scale); cv.height = Math.round(sh * scale);
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(source, 0, 0, sw, sh, 0, 0, cv.width, cv.height);
  return cv;
}

function frameCanvas(f, scale) { // trimmed single frame
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(f.content.w * scale));
  cv.height = Math.max(1, Math.round(f.content.h * scale));
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(state.keyedCanvas, f.content.x, f.content.y, f.content.w, f.content.h, 0, 0, cv.width, cv.height);
  return cv;
}

function normalizedSheet(frames, scale) {
  const cw = Math.max.apply(null, frames.map(f => f.content.w));
  const ch = Math.max.apply(null, frames.map(f => f.content.h));
  const cols = Math.max(1, Math.min(frames.length, state.grid.cols));
  const rows = Math.ceil(frames.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cw * cols * scale; cv.height = ch * rows * scale;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  frames.forEach((f, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const dx = (col * cw + (cw - f.content.w) / 2) * scale;
    const dy = (row * ch + (ch - f.content.h)) * scale;
    c.drawImage(state.keyedCanvas, f.content.x, f.content.y, f.content.w, f.content.h,
      dx, dy, f.content.w * scale, f.content.h * scale);
  });
  return { canvas: cv, cellW: cw, cellH: ch, cols, rows };
}

function buildAtlas(mode) {
  const frames = visibleFrames();
  const scale = state.export.scale;
  const grid = { cols: state.grid.cols, rows: state.grid.rows, cellW: cellSize()[0], cellH: cellSize()[1], margin: state.grid.margin, spacing: state.grid.spacing };
  const base = {
    tool: 'Dr Darkstar Sprite Forge',
    source: state.source ? state.source.name : null,
    sheet: state.source ? { w: state.source.w, h: state.source.h } : null,
    keyed: state.key.on,
    mode,
    grid,
    align: { pivotX: +state.align.pivotX.toFixed(2), pivotY: +state.align.pivotY.toFixed(2) },
    frames: [],
  };
  if (mode === 'normalized') {
    const cw = Math.max.apply(null, frames.map(f => f.content.w));
    const ch = Math.max.apply(null, frames.map(f => f.content.h));
    base.cell = { w: cw, h: ch };
    base.frameCount = frames.length;
    base.frames = frames.map((f, i) => ({
      name: state.export.name + '_' + pad2(i),
      cell: { x: (i % grid.cols) * cw, y: Math.floor(i / grid.cols) * ch, w: cw, h: ch },
      pivot: { x: +(cw / 2).toFixed(2), y: ch },
      source: { cell: f.cell, trim: { w: f.content.w, h: f.content.h } },
    }));
  } else {
    base.frames = frames.map((f, i) => ({
      name: state.export.name + '_' + pad2(i),
      sheet: { x: f.content.x, y: f.content.y, w: f.content.w, h: f.content.h },
      sourceSize: { w: f.cell.w, h: f.cell.h },
      trim: { x: f.content.x - f.cell.x, y: f.content.y - f.cell.y, w: f.content.w, h: f.content.h },
      pivot: { x: +(f.content.w / 2).toFixed(2), y: f.content.h },
      align: { x: +state.align.pivotX.toFixed(2), y: +state.align.pivotY.toFixed(2) },
    }));
  }
  return base;
}

async function exportCurrent() {
  const f = currentFrame();
  if (!f || !f.content.w) return toast('Nothing selected to export', 'warn');
  const cv = frameCanvas(f, state.export.scale);
  download(await canvasToBlob(cv), state.export.name + '_' + pad2(f.i) + '.png');
  toast('Exported frame ' + pad2(f.i), 'ok');
}

async function exportSheet() {
  const frames = visibleFrames();
  if (!frames.length) return toast('No visible frames', 'warn');
  const n = normalizedSheet(frames, state.export.scale);
  download(await canvasToBlob(n.canvas), state.export.name + '-sheet.png');
  download(new Blob([JSON.stringify(buildAtlas('normalized'), null, 2)], { type: 'application/json' }), state.export.name + '.atlas.json');
  toast('Normalized ' + n.cols + '\u00d7' + n.rows + ' sheet + atlas exported', 'ok');
}

async function exportZip() {
  const frames = visibleFrames();
  if (!frames.length) return toast('No visible frames', 'warn');
  const entries = [];
  const enc = new TextEncoder();
  for (let i = 0; i < frames.length; i++) {
    const cv = frameCanvas(frames[i], state.export.scale);
    const blob = await canvasToBlob(cv);
    entries.push({ name: state.export.name + '/' + state.export.name + '_' + pad2(i) + '.png', data: new Uint8Array(await blob.arrayBuffer()) });
  }
  entries.push({ name: state.export.name + '.atlas.json', data: enc.encode(JSON.stringify(buildAtlas('trimmed'), null, 2)) });
  entries.push({
    name: 'README.txt', data: enc.encode(
      'Dr Darkstar Sprite Forge export\n' +
      'source: ' + (state.source ? state.source.name : '-') + '\n' +
      'frames: ' + frames.length + ' (trimmed, scale ' + state.export.scale + 'x)\n' +
      'background keyed: ' + state.key.on + '\n\n' +
      'pivot = { x: width/2, y: height } -> bottom-centre. Draw a frame at\n' +
      '  (bodyX - pivot.x * scale, feetY - pivot.y * scale).\n' +
      'Use the .atlas.json sheet/trim records for source-sheet slicing instead.\n')
  });
  download(zipStore(entries), state.export.name + '-frames.zip');
  toast(frames.length + ' frames + atlas packaged', 'ok');
}

async function exportKeyed() {
  if (!state.keyedCanvas) return toast('Load a sheet first', 'warn');
  const cv = scaleCanvas(state.keyedCanvas, state.source.w, state.source.h, state.export.scale);
  download(await canvasToBlob(cv), state.export.name + '-keyed.png');
  toast('Keyed sheet exported (transparent PNG)', 'ok');
}

function exportJson() {
  if (!visibleFrames().length) return toast('No visible frames', 'warn');
  const text = JSON.stringify(buildAtlas(state.export.mode), null, 2);
  download(new Blob([text], { type: 'application/json' }), state.export.name + '.atlas.json');
  toast('Atlas JSON exported', 'ok');
}

function updateJsonPreview() {
  const el = $('#jsonPreview');
  if (!state.source || !state.frames.length) { el.textContent = '// no sheet loaded'; return; }
  el.textContent = JSON.stringify(buildAtlas(state.export.mode), null, 1);
}

/* ---------------- readouts ---------------- */
function updateReadout() {
  const [cw, ch] = cellSize();
  $('#hudRead').textContent = state.source
    ? (state.frames.length + ' FRAMES \u00b7 CELL ' + cw + '\u00d7' + ch)
    : 'NO SHEET';
  $('#srcMeta').innerHTML = state.source
    ? ('<b>FILE</b> ' + state.source.name + '<br><b>SIZE</b> ' + state.source.w + '\u00d7' + state.source.h +
      '<br><b>GRID</b> ' + state.grid.cols + '\u00d7' + state.grid.rows + ' \u00b7 cell ' + cw + '\u00d7' + ch +
      '<br><b>FRAMES</b> ' + visibleFrames().length + ' visible / ' + state.frames.length +
      '<br><b>BASELINE</b> y=' + state.align.pivotY + ' \u00b7 centre x=' + state.align.pivotX +
      (state.source.tainted ? '<br><span class="warn">PIXEL ACCESS BLOCKED - use the dev server</span>' : ''))
    : 'No sheet loaded.';
}

function syncTransport() {
  const n = state.frames.length;
  $('#scrub').max = String(Math.max(0, n - 1));
  $('#scrub').value = String(state.anim.index);
  $('#frameCounter').textContent = (n ? state.anim.index : 0) + ' / ' + Math.max(0, n - 1);
  const b = $('#btnPlay');
  b.dataset.on = state.anim.playing ? '1' : '0';
  b.innerHTML = state.anim.playing ? '&#10073;&#10073; PAUSE' : '&#9654; PLAY';
  updateJsonPreview();
  updateReadout();
}

function syncControls() {
  const g = state.grid;
  $('#cols').value = g.cols; $('#rows').value = g.rows;
  $('#cellW').value = g.auto ? 0 : g.forceW; $('#cellH').value = g.auto ? 0 : g.forceH;
  $('#margin').value = g.margin; $('#spacing').value = g.spacing;
  $('#offX').value = g.offX; $('#offY').value = g.offY;
  $('#autoSize').checked = g.auto;
  $('#cellW').disabled = g.auto; $('#cellH').disabled = g.auto;
}

/* ---------------- animation loop ---------------- */
let last = 0;
function tick(t) {
  requestAnimationFrame(tick);
  const dt = Math.min(.1, (t - last) / 1000) || 0;
  last = t;
  const moving = state.anim.playing;
  if (moving) {
    state.anim.acc += dt;
    const step = 1 / Math.max(1, state.anim.fps);
    let guard = 0;
    while (state.anim.acc >= step && guard < 8) { state.anim.acc -= step; advance(); guard++; }
    if (guard) { syncTransport(); renderFrameList(); }
  }
  updateRain(dt);
  if (dirty || state.anim.playing || (state.view.rain && state.view.mode === 'stage')) { drawStage(); dirty = false; }
}

/* ---------------- wiring ---------------- */
function wire() {
  // presets
  const host = $('#presets');
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.className = 'btn ghost sm'; b.type = 'button'; b.textContent = p.label;
    b.title = p.path + ' \u00b7 ' + p.cols + '\u00d7' + p.rows;
    b.addEventListener('click', () => applyPreset(p));
    host.appendChild(b);
  }

  // load
  const dz = $('#dropzone');
  dz.addEventListener('click', () => $('#fileInput').click());
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } });
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) loadFromFile(f); });
  $('#browseBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#fileInput').click(); });
  $('#fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) loadFromFile(f); e.target.value = ''; });
  $('#loadPathBtn').addEventListener('click', () => { const v = $('#pathInput').value.trim(); if (v) loadFromPath(v); });
  $('#pathInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) loadFromPath(v); } });
  $('#btnDemo').addEventListener('click', buildDemoSheet);
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) loadFromFile(f);
  });

  // key
  $('#keyToggle').addEventListener('change', (e) => { state.key.on = e.target.checked; rebuildKey(false); mark(); });
  $('#despillToggle').addEventListener('change', (e) => { state.key.despill = e.target.checked; rebuildKey(false); mark(); });
  $('#tolRange').addEventListener('input', (e) => { state.key.tolerance = +e.target.value; $('#tolVal').textContent = e.target.value; rebuildKey(false); mark(); });
  $('#softRange').addEventListener('input', (e) => { state.key.softness = +e.target.value; $('#softVal').textContent = e.target.value; rebuildKey(false); mark(); });
  $('#rekeyBtn').addEventListener('click', () => rebuildKey(true));

  // grid
  const num = (id, fn) => $(id).addEventListener('input', (e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) { fn(v); rebuildFrames(); syncControls(); } });
  num('#cols', v => { state.grid.cols = clamp(v, 1, 64); state.grid.forceW = 0; state.grid.auto = true; });
  num('#rows', v => { state.grid.rows = clamp(v, 1, 64); state.grid.forceH = 0; state.grid.auto = true; });
  num('#cellW', v => { state.grid.forceW = Math.max(0, v); state.grid.auto = !v && !state.grid.forceH; });
  num('#cellH', v => { state.grid.forceH = Math.max(0, v); state.grid.auto = !v && !state.grid.forceW; });
  num('#margin', v => { state.grid.margin = Math.max(0, v); });
  num('#spacing', v => { state.grid.spacing = Math.max(0, v); });
  num('#offX', v => { state.grid.offX = v; });
  num('#offY', v => { state.grid.offY = v; });
  $('#autoSize').addEventListener('change', (e) => {
    state.grid.auto = e.target.checked;
    if (state.grid.auto) { state.grid.forceW = 0; state.grid.forceH = 0; }
    rebuildFrames(); syncControls();
  });

  // align
  $('#trimToggle').addEventListener('change', (e) => { state.align.trim = e.target.checked; mark(); });
  $('#baselineToggle').addEventListener('change', (e) => { state.align.baseline = e.target.checked; mark(); });
  $('#centerXToggle').addEventListener('change', (e) => { state.align.centerX = e.target.checked; mark(); });

  // frame selection helpers
  $('#selAll').addEventListener('click', () => { state.frames.forEach(f => f.on = true); computePivot(); renderFrameList(); mark(); });
  $('#selNone').addEventListener('click', () => { state.frames.forEach(f => f.on = false); computePivot(); renderFrameList(); mark(); });
  $('#selInv').addEventListener('click', () => { state.frames.forEach(f => f.on = !f.on); computePivot(); renderFrameList(); mark(); });

  // view
  $('#modeStage').addEventListener('click', () => setMode('stage'));
  $('#modeSheet').addEventListener('click', () => setMode('sheet'));
  const toggle = (id, key, btn) => $(id).addEventListener('click', () => {
    state.view[key] = !state.view[key];
    $(btn).setAttribute('aria-pressed', String(state.view[key]));
    $(btn).classList.toggle('on', state.view[key]);
    mark();
  });
  toggle('#gridToggle', 'grid', '#gridToggle');
  toggle('#onionToggle', 'onion', '#onionToggle');
  toggle('#pivotToggle', 'pivot', '#pivotToggle');
  toggle('#rainToggle', 'rain', '#rainToggle');
  $('#zoomFitBtn').addEventListener('click', () => { state.view.zoom = 1; state.view.panX = 0; state.view.panY = 0; $('#zoomRange').value = 100; $('#zoomVal').textContent = '1.00\u00d7'; mark(); });
  $('#zoomRange').addEventListener('input', (e) => { state.view.zoom = +e.target.value / 100; $('#zoomVal').textContent = state.view.zoom.toFixed(2) + '\u00d7'; mark(); });

  // stage pointer: pan (stage) / select (sheet)
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    drag = { x: e.offsetX, y: e.offsetY, px: state.view.panX, py: state.view.panY, moved: false };
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag && state.view.mode === 'stage') {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      state.view.panX = drag.px + dx; state.view.panY = drag.py + dy; mark();
    } else if (state.view.mode === 'sheet') {
      const f = hitTest(e.offsetX, e.offsetY);
      const id = f ? f.i : null;
      if (id !== hover) { hover = id; mark(); }
    }
  });
  stage.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved && state.view.mode === 'sheet') {
      const f = hitTest(e.offsetX, e.offsetY);
      if (f) { state.anim.index = f.i; syncTransport(); renderFrameList(); }
    }
    drag = null; mark();
  });
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.view.zoom = clamp(state.view.zoom * Math.exp(-e.deltaY * 0.0012), .2, 6);
    $('#zoomRange').value = Math.round(state.view.zoom * 100);
    $('#zoomVal').textContent = state.view.zoom.toFixed(2) + '\u00d7';
    mark();
  }, { passive: false });
  stage.addEventListener('pointerleave', () => { if (hover !== null) { hover = null; mark(); } });

  // transport
  $('#btnPlay').addEventListener('click', () => { state.anim.playing = !state.anim.playing; state.anim.acc = 0; syncTransport(); mark(); });
  $('#btnPrev').addEventListener('click', () => stepFrame(-1));
  $('#btnNext').addEventListener('click', () => stepFrame(1));
  $('#btnFirst').addEventListener('click', () => { state.anim.index = 0; state.anim.playing = false; syncTransport(); renderFrameList(); mark(); });
  $('#btnLast').addEventListener('click', () => { state.anim.index = Math.max(0, state.frames.length - 1); state.anim.playing = false; syncTransport(); renderFrameList(); mark(); });
  $('#scrub').addEventListener('input', (e) => { state.anim.index = +e.target.value; state.anim.playing = false; syncTransport(); renderFrameList(); mark(); });
  $('#fps').addEventListener('input', (e) => { const v = clamp(parseInt(e.target.value, 10) || 8, 1, 60); state.anim.fps = v; syncTransport(); mark(); });
  $('#loopMode').addEventListener('change', (e) => { state.anim.loop = e.target.value; state.anim.dir = 1; });

  // export
  $('#expMode').addEventListener('change', (e) => { state.export.mode = e.target.value; updateJsonPreview(); });
  $('#expScale').addEventListener('change', (e) => { state.export.scale = +e.target.value; updateJsonPreview(); });
  $('#expName').addEventListener('input', (e) => { state.export.name = (e.target.value || 'frames').replace(/[^\w\-]+/g, '_'); updateJsonPreview(); });
  $('#expCurrent').addEventListener('click', exportCurrent);
  $('#expSheet').addEventListener('click', exportSheet);
  $('#expZip').addEventListener('click', exportZip);
  $('#expKeyed').addEventListener('click', exportKeyed);
  $('#expJson').addEventListener('click', exportJson);
  $('#copyJson').addEventListener('click', async () => {
    const text = JSON.stringify(buildAtlas(state.export.mode), null, 2);
    try { await navigator.clipboard.writeText(text); toast('Atlas copied to clipboard', 'ok'); }
    catch { toast('Clipboard blocked - use JSON to download', 'warn'); }
  });

  // keyboard
  window.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    switch (e.key) {
      case ' ': e.preventDefault(); state.anim.playing = !state.anim.playing; state.anim.acc = 0; syncTransport(); mark(); break;
      case 'ArrowLeft': e.preventDefault(); stepFrame(-1); break;
      case 'ArrowRight': e.preventDefault(); stepFrame(1); break;
      case 'g': case 'G': $('#gridToggle').click(); break;
      case 'o': case 'O': $('#onionToggle').click(); break;
      case 'p': case 'P': $('#pivotToggle').click(); break;
      case 'n': case 'N': $('#rainToggle').click(); break;
      case 'f': case 'F': $('#zoomFitBtn').click(); break;
      case 's': case 'S': setMode(state.view.mode === 'stage' ? 'sheet' : 'stage'); break;
    }
  });

  new ResizeObserver(() => { ensureRain(stage.clientWidth, stage.clientHeight); mark(); }).observe(stage);
}

function setMode(m) {
  state.view.mode = m;
  $('#modeStage').classList.toggle('on', m === 'stage');
  $('#modeSheet').classList.toggle('on', m === 'sheet');
  $('#modeStage').setAttribute('aria-pressed', String(m === 'stage'));
  $('#modeSheet').setAttribute('aria-pressed', String(m === 'sheet'));
  mark();
}

function hitTest(x, y) {
  if (!state.source) return null;
  const { s, ox, oy } = sheetFit;
  for (const f of state.frames) {
    const fx = ox + f.cell.x * s, fy = oy + f.cell.y * s;
    if (x >= fx && x <= fx + f.cell.w * s && y >= fy && y <= fy + f.cell.h * s) return f;
  }
  return null;
}

/* ---------------- init ---------------- */
function init() {
  wire();
  syncControls();
  syncTransport();
  renderFrameList();
  mark();
  // debug handle: SpriteForge.state.frames.length, SpriteForge.detectGrid()
  window.SpriteForge = { state, detectGrid, guessGrid, gridScore, rebuildKey, buildAtlas };
  requestAnimationFrame(tick);
  // friendly first sheet: works when the project is served from its own root
  loadFromPath('./assets/andy/andy-spritesheet-v1.png', 'ANDY');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

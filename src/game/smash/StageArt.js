// Stage art for Super Smash Cousins: a neon night city plate and the floating
// metal battle slab, both painted once onto offscreen canvases (build/load and
// resize) and blitted each frame. fillRect on a 2px grid keeps the chunky
// pixel look; the world rain samples the whole composed scene.

export function buildBackground(width = 480, height = 270) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Deterministic PRNG so both fighters see the same city.
  let seed = 20260919;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

  // Sky bands, top → horizon.
  const horizon = Math.floor(height * 0.74);
  const bands = ['#04070f', '#050a14', '#060d1a', '#081020', '#0a1426', '#0c182c', '#0e1c30'];
  bands.forEach((color, i) => {
    const y0 = Math.floor((horizon * i) / bands.length);
    const y1 = Math.floor((horizon * (i + 1)) / bands.length);
    ctx.fillStyle = color;
    ctx.fillRect(0, y0, width, y1 - y0);
  });
  ctx.fillStyle = '#060b16';
  ctx.fillRect(0, horizon, width, height - horizon);

  // Moon: pixel disc by row spans, craters, lower-left rim shade. Kept in the
  // mid-sky, clear of the top HUD meters — bright pixels bunch the rain up.
  const moon = { x: Math.floor(width * 0.6), y: Math.floor(height * 0.4), r: 11 };
  for (let dy = -moon.r; dy <= moon.r; dy += 2) {
    const span = Math.floor(Math.sqrt(moon.r * moon.r - dy * dy));
    ctx.fillStyle = '#dde3ec';
    ctx.fillRect(moon.x - span, moon.y + dy, span * 2, 2);
  }
  ctx.fillStyle = '#bcc4d2';
  [[-5, -4, 4, 4], [3, 1, 5, 3], [-2, 5, 3, 3], [4, -5, 3, 3]].forEach(([x, y, w, h]) =>
    ctx.fillRect(moon.x + x, moon.y + y, w, h));
  ctx.fillStyle = '#aeb6c6';
  ctx.fillRect(moon.x - moon.r, moon.y + 4, 5, 2);
  ctx.fillRect(moon.x - moon.r + 2, moon.y + 7, 8, 2);

  // Stars (kept clear of the moon).
  for (let i = 0; i < 36; i++) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height * 0.55);
    if (Math.hypot(x - moon.x, y - moon.y) < moon.r + 6) continue;
    ctx.fillStyle = rand() > 0.35 ? '#cfe8f2' : '#8fb8c8';
    const s = rand() > 0.85 ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }

  // One tower: silhouette + window grid.
  const tower = (x, top, w, color, windows, density) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, height - top);
    for (let wy = top + 4; wy < height - 4; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 7) {
        if (rand() < density) {
          ctx.fillStyle = windows[Math.floor(rand() * windows.length)];
          ctx.fillRect(wx, wy, 2, 2);
        }
      }
    }
  };

  // Far skyline: dim, tall, sparse windows.
  for (let i = 0; i < 14; i++) {
    const w = 24 + Math.floor(rand() * 36);
    const x = Math.floor((i / 14) * width + rand() * 12) - 6;
    const top = Math.floor(height * (0.33 + rand() * 0.29));
    tower(x, top, w, '#0a1322', ['#6f7f8f', '#6f7f8f', '#ffd9a0'], 0.18);
  }

  // Near skyline: darker, denser warm/cool windows, antennas, neon signs.
  const signs = ['#ff4fa3', '#49e0d8', '#ffb347'];
  for (let i = 0; i < 10; i++) {
    const w = 40 + Math.floor(rand() * 50);
    const x = Math.floor((i / 10) * width + rand() * 20) - 10;
    const top = Math.floor(height * (0.5 + rand() * 0.28));
    tower(x, top, w, '#060b16', ['#ffd9a0', '#ffd9a0', '#7fd8e8'], 0.3);
    if (rand() > 0.45) {
      const ax = x + Math.floor(w / 2);
      ctx.fillStyle = '#060b16';
      ctx.fillRect(ax, top - 8, 2, 8);
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(ax, top - 10, 2, 2);
    }
    if (i % 3 === 1) {
      ctx.fillStyle = signs[i % signs.length];
      ctx.fillRect(x + 6, top + 10 + Math.floor(rand() * 20), 4, 6);
    }
  }

  // Low haze over the tower bases.
  ctx.fillStyle = 'rgba(20, 40, 60, 0.35)';
  ctx.fillRect(0, Math.floor(height * 0.7), width, 8);
  ctx.fillRect(0, Math.floor(height * 0.84), width, 8);
  return canvas;
}

// A handful of world-space stars that twinkle live over the static plate.
export function twinkles(width, height, count = 14) {
  let seed = 911;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: count }, () => ({
    x: Math.floor(rand() * width),
    y: Math.floor(rand() * height * 0.4),
    phase: rand() * Math.PI * 2,
  }));
}

// Floating metal battle slab, side view: lit top edge, riveted plating, hazard
// stripes at the ends, stepped underside with glowing vents.
export function buildPlatformArt(width) {
  const height = 46;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(96, Math.round(width));
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;

  ctx.fillStyle = '#49e0d8';                       // lit top surface
  ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = '#1b2735';                       // main steel body
  ctx.fillRect(0, 3, W, 14);
  for (let x = 64; x < W - 8; x += 64) {           // panel seams + rivets
    ctx.fillStyle = '#121a26';
    ctx.fillRect(x, 3, 2, 14);
    ctx.fillStyle = '#0e1622';
    ctx.fillRect(x - 8, 5, 2, 2);
    ctx.fillRect(x + 4, 5, 2, 2);
    ctx.fillRect(x - 8, 12, 2, 2);
    ctx.fillRect(x + 4, 12, 2, 2);
  }

  const stripes = (x0, x1) => {                    // hazard chevrons
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 3, x1 - x0, 6); ctx.clip();
    ctx.fillStyle = '#141a24';
    ctx.fillRect(x0, 3, x1 - x0, 6);
    ctx.fillStyle = '#d9a13b';
    for (let x = x0 - 8; x < x1 + 8; x += 10) {
      for (let s = 0; s < 6; s++) ctx.fillRect(x + s, 4 + s, 4, 1);
    }
    ctx.restore();
  };
  stripes(0, 90);
  stripes(W - 90, W);

  ctx.fillStyle = '#101823';                       // lower lip
  ctx.fillRect(0, 17, W, 4);
  ctx.fillStyle = '#0c141f';                       // stepped underside
  ctx.fillRect(40, 21, W - 80, 8);
  ctx.fillStyle = '#080e17';
  ctx.fillRect(110, 29, W - 220, 6);
  ctx.fillStyle = '#49e0d8';                       // glowing vents
  for (let x = 100; x < W - 110; x += 140) ctx.fillRect(x, 23, 4, 2);

  ctx.fillStyle = '#0d1522';                       // end caps
  ctx.fillRect(0, 3, 6, 18);
  ctx.fillRect(W - 6, 3, 6, 18);
  ctx.fillStyle = '#49e0d8';
  ctx.fillRect(0, 3, 2, 18);
  ctx.fillRect(W - 2, 3, 2, 18);
  return canvas;
}

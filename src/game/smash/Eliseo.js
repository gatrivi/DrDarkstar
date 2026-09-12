import { AndyFighter } from './AndyFighter.js';

// Eliseo: the curl-headed cousin. Huge curly hair, dark jacket with spectral
// green trim (Viego), a tiny snake familiar on his shoulder, and a green
// spectral blade for the smash. Hand-drawn 24 x 32 pixel frames.
export const ELISEO_POSES = ['idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'guard', 'aa', 'ftilt', 'utilt', 'dtilt', 'smash', 'usmash', 'dsmash', 'tilt'];
export const ELISEO_FRAME_INDEX = Object.fromEntries(ELISEO_POSES.map((name, i) => [name, i]));

const P = {
  skin: '#c98d5f', skinShade: '#a87148', hair: '#241a12', hairHi: '#3a2a1c',
  jacket: '#17202a', jacketHi: '#232f3b', trim: '#3fbf7f',
  pants: '#232b33', shoe: '#3a3f46', eye: '#14100c',
  blade: '#54e6b4', edge: '#b8ffe4', mist: '#2c8f6a',
  snake: '#4cd964', snakeDark: '#2f8f3f', streak: '#1e3a5f',
};

function drawEliseo(ctx, ox, pose) {
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };

  // ---- Curl helmet: a cloud of 2-3px ringlets around the skull. ----
  const curls = (lean = 0) => {
    R(7 + lean, 0, 7, 2, P.hair);                 // crown
    R(5 + lean, 2, 2, 2, P.hair); R(7 + lean, 2, 2, 1, P.hairHi);
    R(10 + lean, 1, 2, 2, P.hairHi);              // highlighted coil
    R(16 + lean, 2, 3, 2, P.hair); R(15 + lean, 1, 2, 1, P.hair);
    R(4 + lean, 4, 2, 3, P.hair); R(18 + lean, 4, 2, 3, P.hair); // side puffs
    R(3 + lean, 6, 2, 2, P.hair); R(19 + lean, 6, 2, 2, P.hair);
    R(5 + lean, 8, 2, 2, P.hair); R(18 + lean, 8, 1, 2, P.hair);
    R(8 + lean, 4, 8, 1, P.hair);                 // fringe line
    R(10 + lean, 5, 1, 1, P.hair); R(13 + lean, 5, 1, 1, P.hair); // fringe curls
  };

  // ---- Head + face (facing right). ----
  const head = (lean = 0) => {
    curls(lean);
    R(9 + lean, 5, 7, 4, P.skin);
    R(9 + lean, 7, 1, 2, P.skinShade);
    R(13 + lean, 6, 2, 1, P.eye);
    R(11 + lean, 9, 3, 1, P.skinShade);           // neck
  };

  // ---- Torso: dark jacket, spectral trim, snake familiar on the back shoulder. ----
  const torso = (lean = 0) => {
    R(8 + lean, 10, 8, 9, P.jacket);
    R(8 + lean, 10, 1, 9, P.jacketHi);
    R(12 + lean, 10, 1, 9, P.jacketHi);           // zip
    R(8 + lean, 13, 8, 1, P.trim);                // Viego-green chest line
    R(6 + lean, 10, 2, 1, P.snake);               // shoulder snake…
    R(5 + lean, 9, 1, 1, P.snakeDark);            // …head peeking up
  };

  const legsStand = (lean = 0) => {
    R(8 + lean, 19, 3, 6, P.pants); R(13 + lean, 19, 3, 6, P.pants);
    R(7 + lean, 25, 4, 2, P.shoe); R(13 + lean, 25, 5, 2, P.shoe);
  };

  const armL = (x, y, len = 6) => { R(x, y, 2, len, P.jacket); R(x, y + len, 2, 2, P.skin); };
  const armR = armL;

  switch (pose) {
    case 'idle':
      head(); torso(); legsStand();
      armL(6, 11); armR(16, 11);
      break;
    case 'walk1': // stride: left leg back, right forward, arms swinging
      head(1); torso(1);
      R(7, 19, 3, 5, P.pants); R(4, 23, 4, 2, P.shoe);
      R(14, 19, 3, 5, P.pants); R(16, 23, 5, 2, P.shoe);
      armL(5, 12, 5); armR(16, 10, 5);
      break;
    case 'walk2': // passing pose: legs together
      head(); torso();
      R(9, 19, 3, 6, P.pants); R(13, 19, 3, 6, P.pants);
      R(9, 25, 4, 2, P.shoe); R(13, 25, 4, 2, P.shoe);
      armL(6, 11, 5); armR(16, 11, 5);
      break;
    case 'dash': // lunge with speed streaks
      head(2); torso(2);
      R(4, 21, 5, 2, P.pants); R(1, 22, 4, 2, P.shoe);   // trailing leg
      R(15, 21, 5, 2, P.pants); R(19, 22, 4, 2, P.shoe); // driving leg
      armL(5, 13, 4); armR(16, 9, 4);
      R(2, 11, 4, 1, P.streak); R(1, 14, 5, 1, P.streak); R(3, 17, 3, 1, P.streak);
      break;
    case 'jump': // tucked legs, arms up
      head(); torso();
      R(8, 19, 3, 4, P.pants); R(13, 19, 3, 4, P.pants);
      R(8, 22, 3, 2, P.shoe); R(14, 22, 3, 2, P.shoe);
      armL(6, 7, 4); armR(17, 7, 4);
      break;
    case 'roll': // curled into a ball, curls out
      R(6, 8, 12, 12, P.jacket);
      R(4, 6, 3, 3, P.hair); R(8, 4, 4, 3, P.hair); R(14, 5, 4, 3, P.hair);
      R(4, 14, 3, 3, P.hair); R(17, 13, 3, 3, P.hair);
      R(8, 19, 4, 2, P.hair); R(13, 19, 3, 2, P.hair);
      R(10, 9, 4, 2, P.hairHi);
      R(10, 12, 4, 3, P.skin); R(12, 13, 2, 1, P.eye);
      R(2, 10, 2, 1, P.streak); R(2, 16, 2, 1, P.streak);
      break;
    case 'aa': // quick spectral dagger jab
      head(); torso(); legsStand();
      armL(6, 12, 5);
      R(16, 12, 4, 2, P.jacket);
      R(20, 12, 3, 1, P.blade); R(19, 13, 1, 1, P.mist);
      break;
    case 'guard': // crouched shield stance, blade crossed low
      head(); torso();
      R(9, 21, 3, 4, P.pants); R(13, 21, 3, 4, P.pants);
      R(8, 25, 4, 2, P.shoe); R(14, 25, 4, 2, P.shoe);
      R(15, 16, 4, 2, P.jacket);
      R(19, 15, 3, 1, P.blade); R(19, 17, 3, 1, P.blade);
      R(6, 12, 2, 5, P.jacket); R(6, 17, 2, 2, P.skin);
      break;
    case 'ftilt': // extended spectral poke, leaned in
      head(1); torso(1); legsStand(1);
      armL(5, 12, 5);
      R(16, 12, 5, 2, P.jacket);
      R(21, 12, 4, 1, P.blade); R(21, 13, 4, 1, P.mist);
      break;
    case 'utilt': // rising claw, blade overhead
      head(); torso(); legsStand();
      R(6, 12, 2, 5, P.jacket); R(6, 17, 2, 2, P.skin);
      R(16, 4, 2, 7, P.blade); R(16, 4, 1, 7, P.edge);
      R(16, 11, 2, 3, P.jacket);
      break;
    case 'dtilt': // crouched sweep, blade skimming the slab
      R(9, 21, 3, 4, P.pants); R(13, 21, 3, 4, P.pants);
      R(8, 25, 4, 2, P.shoe); R(14, 25, 4, 2, P.shoe);
      head(0); torso(0);
      armL(6, 12, 5);
      R(15, 19, 3, 2, P.jacket);
      R(18, 20, 4, 1, P.blade); R(22, 20, 2, 1, P.edge);
      break;
    case 'usmash': // spectral blade thrust skyward, mist bursting
      R(10, 0, 3, 11, P.blade); R(10, 0, 1, 11, P.edge);
      R(8, 11, 6, 1, P.mist); R(6, 3, 1, 1, P.mist); R(15, 5, 1, 1, P.mist);
      head(1); torso(1); legsStand(1);
      R(5, 10, 3, 2, P.jacket); R(16, 10, 2, 4, P.jacket);
      break;
    case 'dsmash': // spinning sweep, mist on both sides
      head(); torso(); legsStand();
      R(2, 19, 4, 2, P.blade); R(0, 19, 2, 1, P.edge);
      R(18, 19, 4, 2, P.blade); R(22, 19, 2, 1, P.edge);
      R(5, 10, 3, 2, P.jacket); R(16, 10, 3, 2, P.jacket);
      R(2, 21, 2, 1, P.mist); R(20, 21, 2, 1, P.mist);
      break;
    case 'smash': // spectral blade raised behind, mist rising
      R(3, 1, 3, 11, P.blade); R(3, 1, 1, 11, P.edge);
      R(2, 12, 5, 1, P.mist); R(4, 13, 1, 2, P.pants);
      R(6, 2, 1, 1, P.mist); R(7, 4, 1, 1, P.mist); R(2, 6, 1, 1, P.mist);
      head(1); torso(1); legsStand(1);
      R(5, 10, 3, 2, P.jacket); R(16, 10, 2, 4, P.jacket);
      break;
    case 'tilt': // low angled poke
      head(); torso();
      R(8, 19, 3, 6, P.pants); R(13, 19, 3, 6, P.pants);
      R(7, 25, 4, 2, P.shoe); R(13, 25, 5, 2, P.shoe);
      armL(6, 12, 5);
      R(15, 14, 3, 2, P.jacket);
      R(18, 15, 2, 2, P.blade); R(20, 16, 2, 2, P.blade); R(22, 17, 2, 1, P.edge);
      break;
  }
}

export function buildEliseoSheet() {
  const pw = 24, ph = 32;
  const sheet = document.createElement('canvas');
  sheet.width = pw * ELISEO_POSES.length; sheet.height = ph;
  const ctx = sheet.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ELISEO_POSES.forEach((pose, i) => drawEliseo(ctx, i * pw, pose));
  return { sheet, pw, ph, frames: ELISEO_POSES.length };
}

// Same move keys as AndyFighter's controls (jab/tilt/smash + Shift dodges),
// remapped to Eliseo's frame set and LoL flavor. Numbers mirror Andy's kit
// so the matchup stays fair; only poses and labels differ.
export const ELISEO_MOVES = {
  jab: {
    label: 'Spectral jab',
    pose: 'aa', duration: 0.28, animRate: 0.09,
    active: [0.03, 0.16], reach: 48, heightRatio: 0.3,
    damage: 4, base: 130, scaling: 0.55, angle: -0.15,
  },
  punch: {
    label: 'Spectral jab',
    pose: 'aa', duration: 0.28, animRate: 0.09,
    active: [0.03, 0.16], reach: 48, heightRatio: 0.3,
    damage: 4, base: 130, scaling: 0.55, angle: -0.15,
  },
  ftilt: {
    label: 'Mist fang (forward tilt)',
    pose: 'ftilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.18], reach: 62, heightRatio: 0.4,
    damage: 7, base: 180, scaling: 1.1, angle: -0.28,
  },
  utilt: {
    label: 'Ruined rising (up tilt)',
    pose: 'utilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.2], reach: 50, heightRatio: 0.55,
    damage: 8, base: 205, scaling: 1.3, angle: -1.25, box: 'up',
  },
  dtilt: {
    label: 'Serpent sweep (down tilt)',
    pose: 'dtilt', duration: 0.36, animRate: 0.12,
    active: [0.06, 0.16], reach: 60, heightRatio: 0.3,
    damage: 6, base: 170, scaling: 1.0, angle: -0.18, box: 'low',
  },
  windup: {
    label: 'Ruined charge',
    pose: 'smash', duration: Infinity, animRate: 0.3,
  },
  fsmash: {
    label: 'Ruined King smash',
    pose: 'smash', duration: 0.55, animRate: 0.2,
    active: [0.12, 0.24], reach: 78, heightRatio: 0.65,
    damage: 14, base: 310, scaling: 2.2, angle: -0.4, chargeable: true,
  },
  golfswing: {
    label: 'Ruined King smash',
    pose: 'smash', duration: 0.55, animRate: 0.2,
    active: [0.12, 0.24], reach: 78, heightRatio: 0.65,
    damage: 14, base: 310, scaling: 2.2, angle: -0.4, chargeable: true,
  },
  usmash: {
    label: 'Mistcaller (up smash)',
    pose: 'usmash', duration: 0.55, animRate: 0.2,
    active: [0.1, 0.24], reach: 56, heightRatio: 0.7,
    damage: 13, base: 290, scaling: 2.0, angle: -1.35, box: 'up', chargeable: true,
  },
  dsmash: {
    label: 'Coil burst (down smash, both sides)',
    pose: 'dsmash', duration: 0.55, animRate: 0.15,
    active: [0.08, 0.22], reach: 66, heightRatio: 0.35,
    damage: 11, base: 280, scaling: 1.9, angle: -0.35, box: 'both', chargeable: true,
  },
  serve: {                       // kept for legacy saves; L is tilt now
    label: 'Tilt poke',
    pose: 'tilt', duration: 0.35, animRate: 0.2,
    active: [0.04, 0.16], reach: 52, heightRatio: 0.4,
    damage: 5, base: 170, scaling: 1.0, angle: -0.25,
  },
  retriever: {                   // I — snake summon
    label: 'Snake summon',
    pose: 'tilt', duration: 0.5, animRate: 0.2,
    active: [0.15, 0.17], spawn: 'snake',
  },
  super: {                       // U — possession (reuses the vegan-buff hook)
    label: 'Possession',
    pose: 'smash', duration: 0.5, animRate: 0.3,
  },
  roll: {
    label: 'Roll (invulnerable)',
    pose: 'roll', duration: 0.42, animRate: 0.1,
    invuln: [0.04, 0.3],
  },
  spot: {
    label: 'Spot dodge (invulnerable)',
    pose: 'guard', duration: 0.28, animRate: 0.1,
    invuln: [0.02, 0.22],
  },
  airdodge: {
    label: 'Air dodge (invulnerable)',
    pose: 'roll', duration: 0.45, animRate: 0.1,
    invuln: [0.04, 0.32],
  },
};

export class EliseoFighter extends AndyFighter {
  constructor(options) {
    super({ ...options, name: 'ELISEO' });
    this.moveTable = ELISEO_MOVES;
    this.frameIndex = ELISEO_FRAME_INDEX;
    this.walkFlip = false;
  }

  async load() {
    this.applySheet(buildEliseoSheet());
  }
}

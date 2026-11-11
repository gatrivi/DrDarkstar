import { AndyFighter, PALETTES, buildSpriteSheet } from './AndyFighter.js';
import { loadCousinSheet } from './SheetLoader.js';

// Simon: the scrappiest cousin. Rust-orange work vest, faded jeans, a red
// ping-pong paddle and a bent rusted iron bar. His recovery rides a human
// ladder, his summon is a gray pitbull, and his buff is a full power siesta.
// Generated sheet: assets/simon, 4 columns x 2 rows, README slot order.
export const SIMON_SHEET_CELLS = [
  'idle', 'punch', 'tilt', 'smash',
  'jump', 'summon', 'super', 'serve',
];

// Engine strip order: the full melee kit, every pose mapped to his eight art
// cells (the low sweep doubles as roll/guard/dtilt, the iron windup covers
// the up-hits, the siesta is his victory nap).
export const SIMON_ENGINE_POSES = [
  'idle', 'walk1', 'walk2', 'dash', 'jump', 'roll', 'guard',
  'punch', 'ftilt', 'utilt', 'dtilt', 'smash', 'usmash', 'dsmash',
  'tilt', 'serve', 'super', 'summon', 'hurt', 'victory',
];

export const SIMON_POSE_CELL = {
  idle: 0, walk1: 0, walk2: 0, dash: 1, jump: 4, roll: 2, guard: 2,
  punch: 1, ftilt: 1, utilt: 3, dtilt: 2, smash: 3, usmash: 3, dsmash: 2,
  tilt: 1, serve: 7, super: 6, summon: 5, hurt: 0, victory: 6,
};

const SIMON_SHEET_URL = './assets/simon/simon-spritesheet-v1.png';

export const SIMON_POSES = SIMON_ENGINE_POSES;
export const SIMON_FRAME_INDEX = Object.fromEntries(SIMON_ENGINE_POSES.map((name, i) => [name, i]));

// Full kit, numbers mirroring the cousins so the matchup stays fair.
export const SIMON_MOVES = {
  jab: {
    label: 'Paddle jab',
    pose: 'punch', duration: 0.28, animRate: 0.09,
    active: [0.03, 0.16], reach: 48, heightRatio: 0.35,
    damage: 4, base: 120, scaling: 0.5, angle: -0.15,
  },
  ftilt: {
    label: 'Paddle push (forward tilt)',
    pose: 'ftilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.18], reach: 62, heightRatio: 0.4,
    damage: 7, base: 175, scaling: 1.1, angle: -0.3,
  },
  utilt: {
    label: 'Iron hook (up tilt)',
    pose: 'utilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.2], reach: 50, heightRatio: 0.55,
    damage: 8, base: 200, scaling: 1.3, angle: -1.25, box: 'up',
  },
  dtilt: {
    label: 'Low sweep (down tilt)',
    pose: 'dtilt', duration: 0.36, animRate: 0.12,
    active: [0.06, 0.16], reach: 60, heightRatio: 0.3,
    damage: 6, base: 165, scaling: 1.0, angle: -0.18, box: 'low',
  },
  dashatk: {
    label: 'Rusty rush (dash attack)',
    pose: 'dash', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.2], reach: 54, heightRatio: 0.45,
    damage: 6, base: 200, scaling: 0.9, angle: -0.3,
  },
  nair: {
    label: 'Paddle twirl (neutral air)',
    pose: 'tilt', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.22], reach: 52, heightRatio: 0.5,
    damage: 6, base: 150, scaling: 0.8, angle: -0.45, box: 'both',
  },
  fair: {
    label: 'Paddle swat (forward air)',
    pose: 'tilt', duration: 0.36, animRate: 0.12,
    active: [0.05, 0.2], reach: 60, heightRatio: 0.45,
    damage: 8, base: 190, scaling: 1.2, angle: -0.4,
  },
  uair: {
    label: 'Ladder lift (up air)',
    pose: 'usmash', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.2], reach: 50, heightRatio: 0.6,
    damage: 8, base: 190, scaling: 1.1, angle: -1.2, box: 'up',
  },
  windup: {
    label: 'Iron windup',
    pose: 'smash', duration: Infinity, animRate: 0.3,
  },
  fsmash: {
    label: 'Rusted iron slam',
    pose: 'smash', duration: 0.55, animRate: 0.2,
    active: [0.12, 0.24], reach: 78, heightRatio: 0.6,
    damage: 14, base: 300, scaling: 2.2, angle: -0.4, chargeable: true,
  },
  usmash: {
    label: 'Ladder launch (up smash)',
    pose: 'usmash', duration: 0.55, animRate: 0.2,
    active: [0.1, 0.24], reach: 56, heightRatio: 0.7,
    damage: 13, base: 280, scaling: 2.0, angle: -1.35, box: 'up', chargeable: true,
  },
  dsmash: {
    label: 'Sweep spin (down smash, both sides)',
    pose: 'dsmash', duration: 0.55, animRate: 0.15,
    active: [0.08, 0.22], reach: 66, heightRatio: 0.35,
    damage: 11, base: 270, scaling: 1.9, angle: -0.35, box: 'both', chargeable: true,
  },
  retriever: {
    label: 'Pitbull rush',
    pose: 'summon', duration: 0.5, animRate: 0.2,
    active: [0.15, 0.17], spawn: 'pitbull',
  },
  super: {
    label: 'Power siesta',
    pose: 'super', duration: 0.6, animRate: 0.3,
  },
  roll: {
    label: 'Roll (invulnerable)',
    pose: 'roll', duration: 0.42, animRate: 0.1,
    invuln: [0.04, 0.3],
  },
  airdodge: {
    label: 'Air dodge (invulnerable)',
    pose: 'roll', duration: 0.45, animRate: 0.1,
    invuln: [0.04, 0.32],
  },
};

export class SimonFighter extends AndyFighter {
  constructor(options) {
    super(options);
    this.name = options.name ?? 'SIMON';
    this.moveTable = SIMON_MOVES;
    this.frameIndex = SIMON_FRAME_INDEX;
    this.buffLabel = 'SIESTA POWER';
  }

  async load() {
    // Generated art first; a recolored hand-drawn sheet stays as the fallback.
    try {
      this.applySheet(await loadCousinSheet({
        url: SIMON_SHEET_URL,
        cols: 4, rows: 2,
        cells: SIMON_SHEET_CELLS,
        enginePoses: SIMON_ENGINE_POSES,
        poseCell: SIMON_POSE_CELL,
      }));
    } catch {
      this.applySheet(buildSpriteSheet(PALETTES.simon));
    }
  }
}

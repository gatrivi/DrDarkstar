// Super Smash Cousins — minimal N64-tier kit (arcade-tuned).
// Every move the original Smash 64 shipped, nothing else:
//   jab      neutral attack button      (J / Comma / Numpad1)
//   ftilt    tilt + sideways            (direction + J, or L / Period)
//   utilt    tilt + up                  (W/Up + L, or up + J)
//   dtilt    tilt + down                (S/Down + L, or down + J)
//   dashatk  attack while dash-dancing  (double-tap + J on the ground)
//   fsmash   smash + sideways (charge)  (hold K / Slash, release or auto-fire)
//   usmash   smash + up (charge)
//   dsmash   smash + down (charge, hits BOTH sides)
//   windup   charging stance (internal, releases into *smash)
//   nair / fair / uair   attack in the air (held direction picks)
//   roll     directional dodge (Shift + direction, invulnerable)
//   airdodge air dodge (Shift in air, invulnerable + drift)
//   retriever / super — Cousins flavor specials (I and U), not N64.
// No spot dodge, no projectile ball: trimmed for the minimal kit.
// Shield: 60HP bubble, drains while held, break dizzy. Charge caps at 1s and
// auto-fires (N64 behavior) so a stuck charge is impossible.

export const SHIELD = {
  max: 60,
  damageMult: 0.7, // portion of an attack's damage dealt to the shield
  drain: 8,        // HP lost per second while held (melee: 16.8, softened)
  regen: 9,        // HP regained per second while not shielding
  dropLag: 0.12,   // seconds of lag on release (melee: ~7-15f)
  breakStun: 2.0,  // dizzy seconds on shield break
};

// Melee shieldstun, in seconds: 200/201 * (dmg * 0.45 + 2) frames at 60fps.
export function shieldstun(damage) {
  return ((damage * 0.45 + 2) * (200 / 201)) / 60;
}

// Game-feel freeze on connect (melee-style hitstop), in seconds. Smashes and
// full charges freeze longest so KOs read clearly.
export function hitstopFor(move = {}, charge = 0) {
  if (move.spawn) return 0.02;
  if (move.chargeable) {
    return Math.min(0.14, 0.07 + Math.max(0, Math.min(MAX_CHARGE, charge)) * 0.05);
  }
  if ((move.damage ?? 0) >= 6) return 0.045;
  return 0.03;
}

export const KO_HITSTOP = 0.3;

// Screen-shake magnitude in pixels for a hit dealing `damage` percent.
export function shakeFor(damage = 0) {
  return Math.min(16, 4 + damage * 0.6);
}

// Melee smash-charge spec (ssbwiki.com/Smash_attack): a smash may be charged
// for up to 60 frames (1 second); a fully-charged smash deals 1.3671x damage.
// Charging is a commitment: releasing fires, getting hit drops it, and the
// move only fires grounded. Hitting a charging fighter deals 1.2x knockback
// (pre-Ultimate counter-hit rule).
export const MAX_CHARGE = 1.0;
export const CHARGE_DAMAGE_MULT = 1.3671;
export const COUNTER_HIT_MULT = 1.2;

// Charge bonus for a move with base `damage`, held `charge` seconds.
// Damage scales up to CHARGE_DAMAGE_MULT at full charge; base knockback
// gains a flat bonus so charged smashes also KO earlier, as in Melee.
export function chargeBonus(charge = 0, damage = 0) {
  const frac = Math.max(0, Math.min(MAX_CHARGE, charge)) / MAX_CHARGE;
  return { damage: damage * (CHARGE_DAMAGE_MULT - 1) * frac, base: 180 * frac };
}

const DEF = (over) => ({
  duration: 0.35, animRate: 0.2, active: [0.05, 0.2], reach: 50,
  heightRatio: 0.45, damage: 4, base: 130, scaling: 0.7, angle: -0.2,
  ...over,
});

// Andy's moveset — Wing Tsun hands, Master Sword smashes, ping-pong footwork.
export const MOVES = {
  jab: DEF({
    label: 'Jab — Wing Tsun straight',
    pose: 'punch1', duration: 0.28, animRate: 0.09,
    active: [0.03, 0.16], reach: 48, heightRatio: 0.35,
    damage: 4, base: 120, scaling: 0.5, angle: -0.15,
  }),
  ftilt: DEF({
    label: 'Forward tilt — chain punch',
    pose: 'ftilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.18], reach: 62, heightRatio: 0.4,
    damage: 7, base: 175, scaling: 1.1, angle: -0.3,
  }),
  utilt: DEF({
    label: 'Up tilt — rising guard',
    pose: 'utilt', duration: 0.38, animRate: 0.12,
    active: [0.06, 0.2], reach: 50, heightRatio: 0.55,
    damage: 8, base: 200, scaling: 1.3, angle: -1.25, box: 'up',
  }),
  dtilt: DEF({
    label: 'Down tilt — low sweep',
    pose: 'dtilt', duration: 0.36, animRate: 0.12,
    active: [0.06, 0.16], reach: 60, heightRatio: 0.3,
    damage: 6, base: 165, scaling: 1.0, angle: -0.18, box: 'low',
  }),
  dashatk: DEF({
    label: 'Dash attack — shoulder check',
    pose: 'dash', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.2], reach: 54, heightRatio: 0.45,
    damage: 6, base: 200, scaling: 0.9, angle: -0.3,
  }),
  nair: DEF({
    label: 'Neutral air — spin slash',
    pose: 'swing', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.22], reach: 52, heightRatio: 0.5,
    damage: 6, base: 150, scaling: 0.8, angle: -0.45, box: 'both',
  }),
  fair: DEF({
    label: 'Forward air — sky drive',
    pose: 'swing', duration: 0.36, animRate: 0.12,
    active: [0.05, 0.2], reach: 60, heightRatio: 0.45,
    damage: 8, base: 190, scaling: 1.2, angle: -0.4,
  }),
  uair: DEF({
    label: 'Up air — rising arc',
    pose: 'usmash', duration: 0.34, animRate: 0.12,
    active: [0.04, 0.2], reach: 50, heightRatio: 0.6,
    damage: 8, base: 190, scaling: 1.1, angle: -1.2, box: 'up',
  }),
  windup: {
    label: 'Smash charge',
    pose: 'windup', duration: Infinity, animRate: 0.3,
  },
  fsmash: DEF({
    label: 'Forward smash — Master Sword drive',
    pose: 'swing', duration: 0.55, animRate: 0.2,
    active: [0.12, 0.24], reach: 78, heightRatio: 0.6,
    damage: 14, base: 300, scaling: 2.2, angle: -0.4, chargeable: true,
  }),
  usmash: DEF({
    label: 'Up smash — rising slash',
    pose: 'usmash', duration: 0.55, animRate: 0.2,
    active: [0.1, 0.24], reach: 56, heightRatio: 0.7,
    damage: 13, base: 280, scaling: 2.0, angle: -1.35, box: 'up', chargeable: true,
  }),
  dsmash: DEF({
    label: 'Down smash — spinning sweep (both sides)',
    pose: 'dsmash', duration: 0.55, animRate: 0.15,
    active: [0.08, 0.22], reach: 66, heightRatio: 0.35,
    damage: 11, base: 270, scaling: 1.9, angle: -0.35, box: 'both', chargeable: true,
  }),
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
  // Cousins specials (kept for couch chaos).
  retriever: {
    label: 'Retriever summon',
    pose: 'whistle', duration: 0.5, animRate: 0.2,
    active: [0.15, 0.17], spawn: 'retriever',
  },
  super: {
    label: 'Todd the Vegan power',
    pose: 'super', duration: 0.6, animRate: 0.3,
  },
};

import { knockback } from '../smash/SmashStage.js';

export const WORLD = { width: 960, height: 600, ground: 468 };
export const ROSTER = {
  blade: { name: 'BLADE', row: 0, limit: 150, color: '#ff647b', weapon: 'SILVER / SWORD' },
  deckard: { name: 'DECKARD', row: 1, limit: 150, color: '#f5bd78', weapon: 'PK-D / BLASTER' },
  vampire: { name: 'VAMPIRE', row: 2, limit: 52, color: '#e86d93' },
  replicant: { name: 'REPLICANT', row: 3, limit: 66, color: '#79dbe5' },
};
export const NIGHT_MOVES = {
  punch: { pose: 2, duration: .36, active: [.10, .22], reach: 78, damage: 15, base: 170, scaling: 1.5, angle: -.28 },
  windup: { pose: 1, duration: Infinity },
  golfswing: { pose: 2, duration: .52, active: [.12, .25], reach: 104, damage: 23, base: 240, scaling: 2.1, angle: -.43 },
  serve: { pose: 2, duration: .40, active: [.14, .20], projectile: true, damage: 14, base: 120, scaling: 1.0, angle: -.2 },
  roll: { pose: 3, duration: .34 },
  block: { pose: 9, duration: Infinity },
  claw: { pose: 1, duration: .72, active: [.38, .51], reach: 54, damage: 10, base: 165, scaling: .6, angle: -.28 },
  enemyShot: { pose: 0, duration: 1.02, active: [.72, .82], projectile: true, damage: 9, base: 130, scaling: .65, angle: -.2 },
};
export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function vulnerable(target) {
  return !target.dead && target.respawnTimer <= 0 && target.invulnerable <= 0 && target.action?.name !== 'roll';
}
export function blocksAttack(target, direction) {
  return target.action?.name === 'block' && target.guard > 0 && target.guardBroken <= 0 && direction * target.facing < 0;
}
export function blockHit(attacker, target, move, charge = 0, direction = attacker.facing) {
  if (attacker.team === target.team || !vulnerable(target) || !blocksAttack(target,direction)) return false;
  target.guard = Math.max(0,target.guard-(move.damage+Math.min(1.1,charge)*18)*1.6-7);
  target.blockFlash = .2;
  target.guardCooldown = .7;
  if (target.guard === 0) {
    target.action = null; target.guardBroken = .9; target.hitstun = .55;
  }
  return true;
}
export function hitTarget(attacker, target, move, charge = 0, direction = attacker.facing) {
  if (attacker.team === target.team || !vulnerable(target) || blocksAttack(target,direction)) return false;
  const damage = move.damage + Math.min(1.1, charge) * 18;
  target.percent += damage;
  const force = knockback(target.percent, move.base + charge * 190, move.scaling);
  target.vx = direction * force * Math.cos(move.angle);
  target.vy = force * Math.sin(move.angle);
  target.hitstun = Math.min(.65, .14 + force / 1500);
  target.action = null;
  target.dashTimer = 0;
  target.onGround = false;
  target.invulnerable = target.team === 'hunter' ? .65 : .12;
  return true;
}
export function projectileSweep(projectile, nextX) {
  return { x: Math.min(projectile.x, nextX) - 4, y: projectile.y - 4, w: Math.abs(nextX - projectile.x) + 8, h: 8 };
}

// Demolition-style run economy (pure; unit-tested). Hunters earn for every
// landed hit, more for KOs, multiplied by combo and frenzy. Bounties pay at
// mission end for a chosen specialty.
export const SCORE = {
  hitPoint: 10,            // per damage percent dealt
  koBonus: { vampire: 250, replicant: 350 },
  chargedKoBonus: 150,     // killing blow was a charged (charge > 0.3) hit
  doubleKoBonus: 500,      // two KOs within DOUBLE_WINDOW
  doubleWindow: 3,
  superJackpotBonus: 1000, // KO during frenzy at max combo
  flawlessWaveBonus: 750,  // cleared a wave taking no damage
  demolitionBonus: 2000,   // cleared both waves without losing a life
  comboWindow: 2.5,        // seconds between hits to keep the streak
  comboCap: 5,             // combo multiplier caps at x5
  frenzyKills: 3,          // KOs inside frenzyWindow trigger HUNT FRENZY
  frenzyWindow: 8,
  frenzyTime: 10,
  frenzyMult: 2,
  speedTrapTime: 60,       // SPEED TRAP bounty: clear wave 2 faster than this
  speedTrapBonus: 1000,
  untouchableBonus: 1500,  // UNTOUCHABLE bounty: wave 2 with no damage taken
  nightOwlPerKo: 150,      // NIGHT OWL bounty: per projectile KO
};

export function scoreForHit(damage) {
  return Math.max(0, Math.round(damage * SCORE.hitPoint));
}

export function scoreForKO(kind, charged = false) {
  return (SCORE.koBonus[kind] ?? 200) + (charged ? SCORE.chargedKoBonus : 0);
}

// Combo multiplier from the current streak: x1 under 2 hits, +1 every 2.
export function comboMult(streak) {
  return Math.min(SCORE.comboCap, 1 + Math.floor(Math.max(0, streak) / 2));
}

export const BOUNTIES = [
  { id: 'nightowl', name: 'NIGHT OWL', desc: '+150 per shuriken / bolt KO' },
  { id: 'untouchable', name: 'UNTOUCHABLE', desc: 'Wave 2, no damage: +1,500' },
  { id: 'speedtrap', name: 'SPEED TRAP', desc: 'Clear wave 2 under 60s: +1,000' },
];

export function bountyIdValid(id) {
  return BOUNTIES.some((b) => b.id === id);
}

// Bounty payout at mission end. ctx: { projKOs, wave2Time, wave2Damage }.
export function bountyPayout(id, ctx = {}) {
  const { projKOs = 0, wave2Time = Infinity, wave2Damage = Infinity } = ctx;
  if (id === 'nightowl') return Math.max(0, projKOs) * SCORE.nightOwlPerKo;
  if (id === 'untouchable') return wave2Damage <= 0 ? SCORE.untouchableBonus : 0;
  if (id === 'speedtrap') return wave2Time < SCORE.speedTrapTime ? SCORE.speedTrapBonus : 0;
  return 0;
}

// Best-board helpers (localStorage JSON: [{score,hunter,won,date}]).
export function boardRank(board, score) {
  return board.filter((e) => e.score > score).length;
}

export function boardInsert(board, entry, cap = 5) {
  return [...board, entry].sort((a, b) => b.score - a.score).slice(0, cap);
}

// Challenge links: ?challenge=<base64url JSON {target, label?>.
// Uses only universal base64 (btoa/atob exist in browsers and Node).
function b64urlEncode(text) {
  const bin = unescape(encodeURIComponent(text));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(raw) {
  const padded = String(raw).replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(padded)));
}

export function decodeChallenge(raw) {
  if (!raw) return null;
  try {
    const json = JSON.parse(b64urlDecode(raw));
    if (json && Number.isFinite(json.target) && json.target > 0) {
      return { target: Math.floor(json.target), label: String(json.label || 'RIVAL HUNT').slice(0, 24) };
    }
  } catch { /* malformed challenge: ignore */ }
  return null;
}

export function encodeChallenge(target, label = '') {
  return b64urlEncode(JSON.stringify({ target: Math.floor(target), label: String(label).slice(0, 24) }));
}

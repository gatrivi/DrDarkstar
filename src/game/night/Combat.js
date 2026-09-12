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

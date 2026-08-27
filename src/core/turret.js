import { angleDelta, distanceSquared } from './math.js';

export function stepTurretAim(vehicle, enemies, input, dt) {
  if (input.manualAimActive) vehicle.manualAimGrace = input.manualAimHold ?? 0.45;
  else vehicle.manualAimGrace = Math.max(0, (vehicle.manualAimGrace ?? 0) - dt);
  const desired = resolveTurretAim(vehicle, enemies, input);
  if (desired == null) return vehicle.turretHeading;
  const maxTurn = 8 * dt;
  const delta = angleDelta(vehicle.turretHeading, desired);
  vehicle.turretHeading += Math.max(-maxTurn, Math.min(maxTurn, delta));
  return vehicle.turretHeading;
}

export function resolveTurretAim(vehicle, enemies, input) {
  if (input.aimWorld) return Math.atan2(input.aimWorld.y - vehicle.y, input.aimWorld.x - vehicle.x);
  if (Math.hypot(input.aimX ?? 0, input.aimY ?? 0) > 0.2) {
    return Math.atan2(input.aimY, input.aimX);
  }
  if (input.gunnerEnabled === false) return vehicle.turretHeading;
  if ((vehicle.manualAimGrace ?? 0) > 0) return vehicle.turretHeading;
  return gunnerAim(vehicle, enemies);
}

export function gunnerAim(vehicle, enemies) {
  const target = nearestEnemy(vehicle, enemies);
  if (!target) return vehicle.turretHeading;
  const projectileSpeed = 430;
  const dx = target.x - vehicle.x;
  const dy = target.y - vehicle.y;
  const distance = Math.hypot(dx, dy);
  const leadTime = Math.min(0.75, distance / projectileSpeed);
  const leadX = target.x + (target.vx ?? 0) * leadTime;
  const leadY = target.y + (target.vy ?? 0) * leadTime;
  return Math.atan2(leadY - vehicle.y, leadX - vehicle.x);
}

function nearestEnemy(vehicle, enemies) {
  return enemies.reduce((nearest, enemy) => {
    if (!nearest) return enemy;
    return distanceSquared(vehicle, enemy) < distanceSquared(vehicle, nearest) ? enemy : nearest;
  }, null);
}

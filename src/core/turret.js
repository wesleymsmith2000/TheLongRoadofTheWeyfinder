import { angleDelta, distanceSquared } from './math.js';
import { gunMuzzleWorld } from './vehicle.js';

export const PRIMARY_PROJECTILE_SPEED = 430;

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
  if (input.aimWorld) {
    return input.compensatedAim === false
      ? directAimHeading(vehicle, input.aimWorld)
      : compensatedAimHeading(vehicle, input.aimWorld, input.aimProjectileSpeed ?? PRIMARY_PROJECTILE_SPEED);
  }
  if (Math.hypot(input.aimX ?? 0, input.aimY ?? 0) > 0.2) {
    return Math.atan2(input.aimY, input.aimX);
  }
  if (input.gunnerEnabled === false) return vehicle.turretHeading;
  if ((vehicle.manualAimGrace ?? 0) > 0) return vehicle.turretHeading;
  return gunnerAim(vehicle, enemies);
}

export function directAimHeading(vehicle, target) {
  return Math.atan2(target.y - vehicle.y, target.x - vehicle.x);
}

export function compensatedAimHeading(vehicle, target, projectileSpeed = PRIMARY_PROJECTILE_SPEED) {
  let heading = directAimHeading(vehicle, target);
  for (let i = 0; i < 12; i += 1) heading = compensatedAimFromMuzzle(vehicle, target, projectileSpeed, heading);
  return heading;
}

function compensatedAimFromMuzzle(vehicle, target, projectileSpeed, currentHeading) {
  const muzzle = gunMuzzleWorld(vehicle, currentHeading) ?? vehicle;
  const dx = target.x - muzzle.x;
  const dy = target.y - muzzle.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || projectileSpeed <= 0) return directAimHeading(vehicle, target);

  const ux = dx / distance;
  const uy = dy / distance;
  const sidewaysVehicleSpeed = vehicle.vx * uy - vehicle.vy * ux;
  const requiredSideways = Math.max(-1, Math.min(1, sidewaysVehicleSpeed / projectileSpeed));
  const forward = Math.sqrt(Math.max(0, 1 - requiredSideways * requiredSideways));
  const aimX = ux * forward - uy * requiredSideways;
  const aimY = uy * forward + ux * requiredSideways;
  return Math.atan2(aimY, aimX);
}

export function gunnerAim(vehicle, enemies) {
  const target = nearestEnemy(vehicle, enemies);
  if (!target) return vehicle.turretHeading;
  const projectileSpeed = PRIMARY_PROJECTILE_SPEED;
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

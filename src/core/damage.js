import { applyVehicleDamage } from './vehicle.js';

export function hitVehicleWithProjectile(vehicle, projectile) {
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const direction = { x: projectile.vx / speed, y: projectile.vy / speed };
  return applyVehicleDamage(
    vehicle,
    { x: projectile.x, y: projectile.y },
    projectile.radius * 3.2,
    projectile.damage,
    projectile.impulse,
    direction,
  );
}

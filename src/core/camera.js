import { angleDelta, clamp, lerp, rotatePoint } from './math.js';

export function createRoadCamera(vehicle) {
  return {
    x: vehicle.x,
    y: vehicle.y,
    heading: vehicle.heading,
    halfWidth: 180,
    halfHeight: 125,
  };
}

export function stepRoadCamera(camera, vehicle, dt) {
  camera.heading += angleDelta(camera.heading, vehicle.heading) * Math.min(1, dt * 5.5);

  const dx = vehicle.x - camera.x;
  const dy = vehicle.y - camera.y;
  const local = rotatePoint(dx, dy, -camera.heading);
  const overflowX = local.x - clamp(local.x, -camera.halfWidth, camera.halfWidth);
  const overflowY = local.y - clamp(local.y, -camera.halfHeight, camera.halfHeight);
  const correction = rotatePoint(overflowX, overflowY, camera.heading);

  const targetX = camera.x + correction.x + vehicle.vx * 0.18;
  const targetY = camera.y + correction.y + vehicle.vy * 0.18;
  const follow = Math.min(1, dt * 4.2);
  camera.x = lerp(camera.x, targetX, follow);
  camera.y = lerp(camera.y, targetY, follow);
}

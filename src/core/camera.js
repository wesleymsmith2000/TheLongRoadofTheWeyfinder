import { angleDelta, clamp, lerp, rotatePoint } from './math.js';

export function createRoadFrame(vehicle) {
  return {
    x: vehicle.x,
    y: vehicle.y,
    heading: vehicle.heading,
    speed: 120,
  };
}

export function stepRoadFrame(road, dt) {
  const direction = roadForward(road);
  const dx = direction.x * road.speed * dt;
  const dy = direction.y * road.speed * dt;
  road.x += dx;
  road.y += dy;
  return { dx, dy };
}

export function roadForward(road) {
  return rotatePoint(0, -1, road.heading);
}

export function createRoadCamera(road) {
  return {
    x: road.x,
    y: road.y,
    heading: road.heading,
    halfWidth: 180,
    halfHeight: 125,
  };
}

export function stepRoadCamera(camera, road, vehicle, dt) {
  camera.heading += angleDelta(camera.heading, road.heading) * Math.min(1, dt * 5.5);

  const dx = vehicle.x - camera.x;
  const dy = vehicle.y - camera.y;
  const local = rotatePoint(dx, dy, -camera.heading);
  const overflowX = local.x - clamp(local.x, -camera.halfWidth, camera.halfWidth);
  const overflowY = local.y - clamp(local.y, -camera.halfHeight, camera.halfHeight);
  const correction = rotatePoint(overflowX, overflowY, camera.heading);

  const targetX = road.x + correction.x;
  const targetY = road.y + correction.y;
  const follow = Math.min(1, dt * 4.2);
  camera.x = lerp(camera.x, targetX, follow);
  camera.y = lerp(camera.y, targetY, follow);
}

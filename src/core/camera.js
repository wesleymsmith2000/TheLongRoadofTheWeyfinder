import { angleDelta, clamp, lerp, rotatePoint } from './math.js';

export function createRoadFrame(vehicle) {
  return {
    x: vehicle.x,
    y: vehicle.y,
    heading: vehicle.heading,
    speed: 120,
    halfWidth: 210,
    halfHeight: 145,
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

export function configureRoadLaneForViewport(road, width, height) {
  road.halfWidth = Math.max(230, width * 0.43);
  road.halfHeight = Math.max(155, height * 0.36);
}

export function createRoadCamera(road) {
  return {
    x: road.x,
    y: road.y,
    heading: road.heading,
  };
}

export function stepRoadCamera(camera, road, vehicle, dt) {
  camera.heading += angleDelta(camera.heading, road.heading) * Math.min(1, dt * 5.5);
  const follow = Math.min(1, dt * 4.2);
  camera.x = lerp(camera.x, road.x, follow);
  camera.y = lerp(camera.y, road.y, follow);
}

export function containVehicleInRoadFrame(vehicle, road) {
  const offset = worldToRoadOffset(vehicle, road);
  const clampedX = clamp(offset.x, -road.halfWidth, road.halfWidth);
  const clampedY = clamp(offset.y, -road.halfHeight, road.halfHeight);
  if (clampedX === offset.x && clampedY === offset.y) return false;

  const correctedWorld = roadOffsetToWorld({ x: clampedX, y: clampedY }, road);
  vehicle.x = correctedWorld.x;
  vehicle.y = correctedWorld.y;

  const localVelocity = rotatePoint(vehicle.vx, vehicle.vy, -road.heading);
  if ((offset.x < -road.halfWidth && localVelocity.x < 0) || (offset.x > road.halfWidth && localVelocity.x > 0)) {
    localVelocity.x *= -0.18;
  }
  if ((offset.y < -road.halfHeight && localVelocity.y < 0) || (offset.y > road.halfHeight && localVelocity.y > 0)) {
    localVelocity.y *= -0.18;
  }
  const worldVelocity = rotatePoint(localVelocity.x, localVelocity.y, road.heading);
  vehicle.vx = worldVelocity.x;
  vehicle.vy = worldVelocity.y;
  return true;
}

export function worldToRoadOffset(point, road) {
  return rotatePoint(point.x - road.x, point.y - road.y, -road.heading);
}

export function roadOffsetToWorld(offset, road) {
  const world = rotatePoint(offset.x, offset.y, road.heading);
  return { x: road.x + world.x, y: road.y + world.y };
}

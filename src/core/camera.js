import { angleDelta, clamp, lerp, rotatePoint } from './math.js';
import { DEFAULT_ROAD_ROUTE, isRouteTurnSegment, sampleRoadRoute } from './roadRoute.js';

export function createRoadFrame(vehicle, options = {}) {
  const route = options.route ?? DEFAULT_ROAD_ROUTE;
  const pose = sampleRoadRoute(route, 0);
  return {
    x: pose.x,
    y: pose.y,
    heading: pose.heading,
    speed: 30,
    halfWidth: 120,
    halfHeight: 92,
    route,
    routeDistance: 0,
    routeSegmentIndex: pose.segmentIndex,
    lastTurnAngle: 0,
  };
}

export function stepRoadFrame(road, dt) {
  const previous = { x: road.x, y: road.y, heading: road.heading, routeSegmentIndex: road.routeSegmentIndex };
  road.routeDistance = Math.max(0, (road.routeDistance ?? 0) + road.speed * dt);
  const pose = sampleRoadRoute(road.route ?? DEFAULT_ROAD_ROUTE, road.routeDistance);
  road.x = pose.x;
  road.y = pose.y;
  road.heading = pose.heading;
  road.routeSegmentIndex = pose.segmentIndex;
  const enteredCurve = pose.segmentIndex !== previous.routeSegmentIndex && isRouteTurnSegment(pose.segment);
  const turnAngle = enteredCurve ? pose.segment.turnRadians : 0;
  const dx = road.x - previous.x;
  const dy = road.y - previous.y;
  road.lastTurnAngle = turnAngle;
  return { dx, dy, turnAngle };
}

export function roadForward(road) {
  return rotatePoint(0, -1, road.heading);
}

export function configureRoadLaneForViewport(road, width, height) {
  road.halfWidth = clamp(width * 0.34, 110, 360);
  road.halfHeight = clamp(height * 0.24, 84, 230);
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

export function containVehicleInRoadFrame(vehicle, road, dt = 0) {
  const offset = worldToRoadOffset(vehicle, road);
  const localVelocity = rotatePoint(vehicle.vx, vehicle.vy, -road.heading);
  applyLaneEdgeCorrection(localVelocity, offset.x, road.halfWidth, dt, 'x');
  applyLaneEdgeCorrection(localVelocity, offset.y, road.halfHeight, dt, 'y');

  const clampedX = clamp(offset.x, -road.halfWidth, road.halfWidth);
  const clampedY = clamp(offset.y, -road.halfHeight, road.halfHeight);
  const clamped = clampedX !== offset.x || clampedY !== offset.y;

  if (clamped) {
    const correctedWorld = roadOffsetToWorld({ x: clampedX, y: clampedY }, road);
    vehicle.x = correctedWorld.x;
    vehicle.y = correctedWorld.y;

    if ((offset.x < -road.halfWidth && localVelocity.x < 0) || (offset.x > road.halfWidth && localVelocity.x > 0)) {
      localVelocity.x = 0;
    }
    if ((offset.y < -road.halfHeight && localVelocity.y < 0) || (offset.y > road.halfHeight && localVelocity.y > 0)) {
      localVelocity.y = 0;
    }
  }
  const worldVelocity = rotatePoint(localVelocity.x, localVelocity.y, road.heading);
  vehicle.vx = worldVelocity.x;
  vehicle.vy = worldVelocity.y;
  return clamped;
}

function applyLaneEdgeCorrection(localVelocity, value, halfSize, dt, axis) {
  const softLimit = halfSize * 0.82;
  const distance = Math.abs(value);
  if (dt <= 0 || distance <= softLimit) return;
  const pressure = clamp((distance - softLimit) / Math.max(1, halfSize - softLimit), 0, 1);
  localVelocity[axis] -= Math.sign(value) * pressure * 52.5 * dt;
}

export function worldToRoadOffset(point, road) {
  return rotatePoint(point.x - road.x, point.y - road.y, -road.heading);
}

export function roadOffsetToWorld(offset, road) {
  const world = rotatePoint(offset.x, offset.y, road.heading);
  return { x: road.x + world.x, y: road.y + world.y };
}

export function screenToWorld(screen, camera, viewport) {
  const dx = screen.x - viewport.width / 2;
  const dy = screen.y - viewport.height * 0.58;
  return { x: camera.x + dx, y: camera.y + dy };
}

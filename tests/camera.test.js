import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';
import {
  cameraViewScale,
  configureRoadLaneForViewport,
  containVehicleInRoadFrame,
  createRoadCamera,
  createRoadFrame,
  screenToWorld,
  stepRoadCamera,
  stepRoadFrame,
  worldToRoadOffset,
} from '../src/core/camera.js';

test('road camera lags vehicle movement so screen position remains readable', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  const camera = createRoadCamera(road);
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 0.25);
  stepRoadCamera(camera, road, vehicle, 0.25);
  assert.equal(Math.abs(vehicle.y - camera.y) > 1, true);
});

test('road frame advances constantly in its forward direction', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  const delta = stepRoadFrame(road, 1);
  assert.equal(road.y < vehicle.y, true);
  assert.equal(delta.dy < 0, true);
});

test('road frame follows route curves and emits turn events when entering bends', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle, {
    route: {
      startX: 0,
      startY: 0,
      startHeading: 0,
      segments: [
        { id: 'straight', length: 60, turnRadians: 0 },
        { id: 'bend', length: 120, turnRadians: Math.PI / 2 },
      ],
    },
  });
  road.speed = 60;
  const beforeHeading = road.heading;
  const straightDelta = stepRoadFrame(road, 1);
  assert.equal(road.heading, beforeHeading);
  assert.equal(straightDelta.turnAngle, 0);

  const curveDelta = stepRoadFrame(road, 0.25);
  assert.equal(curveDelta.turnAngle, Math.PI / 2);
  assert.equal(road.heading > beforeHeading, true);
  assert.equal(road.lastTurnAngle, Math.PI / 2);
});

test('road frame follows bezier route curves smoothly', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle, {
    route: {
      startX: 0,
      startY: 0,
      startHeading: 0,
      segments: [
        { id: 'spline-bend', length: 240, turnRadians: Math.PI / 3, curve: 'bezier' },
      ],
    },
  });
  road.speed = 120;
  const first = stepRoadFrame(road, 1);
  const firstHeading = road.heading;
  const second = stepRoadFrame(road, 1);
  assert.equal(first.turnAngle, 0);
  assert.equal(second.turnAngle, 0);
  assert.equal(firstHeading > 0, true);
  assert.equal(road.heading > firstHeading, true);
  assert.equal(Math.abs(road.heading - Math.PI / 3) < 0.02, true);
});

test('road camera rotates toward road heading', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  const camera = createRoadCamera(road);
  road.heading = Math.PI / 2;
  stepRoadCamera(camera, road, vehicle, 0.1);
  assert.equal(camera.heading > 0, true);
  assert.equal(camera.heading < road.heading, true);
});

test('screen aiming uses a fixed view plane even when road camera heading changes', () => {
  const camera = { x: 100, y: 200, heading: Math.PI / 2 };
  const world = screenToWorld({ x: 430, y: 280 }, camera, { width: 800, height: 500 });
  assert.deepEqual(world, { x: 130, y: 190 });
});

test('mobile view scale zooms the world out while preserving screen aim mapping', () => {
  const camera = { x: 100, y: 200, heading: 0 };
  const viewport = { width: 390, height: 844 };
  assert.equal(cameraViewScale(viewport), 0.5);
  const world = screenToWorld({ x: 245, y: 489.52 }, camera, viewport);
  assert.deepEqual(world, { x: 200, y: 200 });
});

test('vehicle is contained inside the road play lane', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  vehicle.x = road.x + road.halfWidth + 80;
  vehicle.vx = 120;
  containVehicleInRoadFrame(vehicle, road);
  const offset = worldToRoadOffset(vehicle, road);
  assert.equal(offset.x <= road.halfWidth, true);
  assert.equal(vehicle.vx <= 0, true);
});

test('lane containment kills downward edge drift without pinning the craft', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  vehicle.y = road.y + road.halfHeight + 60;
  vehicle.vy = 140;
  containVehicleInRoadFrame(vehicle, road, 1 / 60);
  const offset = worldToRoadOffset(vehicle, road);
  assert.equal(offset.y <= road.halfHeight, true);
  assert.equal(vehicle.vy <= 0, true);
});

test('road play lane scales to fill most of the viewport', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  configureRoadLaneForViewport(road, 1000, 700);
  assert.equal(road.halfWidth, 340);
  assert.equal(road.halfHeight, 168);
});

test('mobile road play lane keeps its previous screen footprint after zooming out', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  const viewport = { width: 390, height: 844 };
  const scale = cameraViewScale(viewport);
  configureRoadLaneForViewport(road, viewport.width, viewport.height);
  assert.equal(scale, 0.5);
  assert.equal((road.halfWidth * scale).toFixed(2), (viewport.width * 0.34).toFixed(2));
  assert.equal((road.halfHeight * scale).toFixed(2), (viewport.height * 0.24).toFixed(2));
});

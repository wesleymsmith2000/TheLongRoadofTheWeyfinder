import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';
import { createRoadCamera, createRoadFrame, stepRoadCamera, stepRoadFrame } from '../src/core/camera.js';

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

test('road camera rotates toward road heading', () => {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  const camera = createRoadCamera(road);
  road.heading = Math.PI / 2;
  stepRoadCamera(camera, road, vehicle, 0.1);
  assert.equal(camera.heading > 0, true);
  assert.equal(camera.heading < road.heading, true);
});

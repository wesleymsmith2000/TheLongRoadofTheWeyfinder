import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';
import { createRoadCamera, stepRoadCamera } from '../src/core/camera.js';

test('road camera lags vehicle movement so screen position remains readable', () => {
  const vehicle = createStartingVehicle();
  const camera = createRoadCamera(vehicle);
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 0.25);
  stepRoadCamera(camera, vehicle, 0.25);
  assert.equal(Math.abs(vehicle.y - camera.y) > 1, true);
});

test('road camera rotates toward vehicle heading', () => {
  const vehicle = createStartingVehicle();
  const camera = createRoadCamera(vehicle);
  vehicle.heading = Math.PI / 2;
  stepRoadCamera(camera, vehicle, 0.1);
  assert.equal(camera.heading > 0, true);
  assert.equal(camera.heading < vehicle.heading, true);
});

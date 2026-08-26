import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';

test('keyboard-style movement input produces visible vehicle motion', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10);
  assert.equal(vehicle.y < -1, true);
  assert.equal(Math.abs(vehicle.vy) > 10, true);
});

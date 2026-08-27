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

test('movement input is relative to the road frame, not craft spin', () => {
  const vehicle = createStartingVehicle();
  vehicle.heading = Math.PI / 2;
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10, 0);
  assert.equal(vehicle.y < -1, true);
  assert.equal(Math.abs(vehicle.x) < 1, true);
});

test('vehicle physics tolerates partial input snapshots', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, {}, 1 / 60, 0);
  assert.equal(Number.isFinite(vehicle.x), true);
  assert.equal(Number.isFinite(vehicle.heading), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';

test('keyboard-style movement input produces visible vehicle motion', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10);
  assert.equal(vehicle.y < -0.5, true);
  assert.equal(Math.abs(vehicle.vy) > 5, true);
});

test('movement input is relative to the road frame, not craft spin', () => {
  const vehicle = createStartingVehicle();
  vehicle.heading = Math.PI / 2;
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10, 0);
  assert.equal(vehicle.y < -0.5, true);
  assert.equal(Math.abs(vehicle.x) < 1, true);
});

test('vehicle physics tolerates partial input snapshots', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, {}, 1 / 60, 0);
  assert.equal(Number.isFinite(vehicle.x), true);
  assert.equal(Number.isFinite(vehicle.heading), true);
});

test('engine acceleration upgrade increases movement response', () => {
  const base = createStartingVehicle();
  const upgraded = createStartingVehicle();
  stepVehicle(base, { x: 0, y: -1 }, 1 / 10, 0);
  stepVehicle(upgraded, { x: 0, y: -1 }, 1 / 10, 0, { engineAcceleration: 2 });
  assert.equal(Math.abs(upgraded.vy) > Math.abs(base.vy), true);
});

test('wheel inertia compensation improves release deceleration', () => {
  const base = createStartingVehicle();
  const upgraded = createStartingVehicle();
  base.vx = 100;
  upgraded.vx = 100;
  stepVehicle(base, {}, 0.5, 0);
  stepVehicle(upgraded, {}, 0.5, 0, { wheelInertiaCompensation: 3 });
  assert.equal(Math.abs(upgraded.vx) < Math.abs(base.vx), true);
});

test('low-traction terrain reduces vehicle acceleration response', () => {
  const normal = createStartingVehicle();
  const slippery = createStartingVehicle();
  stepVehicle(normal, { x: 0, y: -1 }, 1 / 10, 0, {}, { traction: 1, rollingResistance: 0.05 });
  stepVehicle(slippery, { x: 0, y: -1 }, 1 / 10, 0, {}, { traction: 0.42, rollingResistance: 0.02 });
  assert.equal(Math.abs(slippery.vy) < Math.abs(normal.vy), true);
});

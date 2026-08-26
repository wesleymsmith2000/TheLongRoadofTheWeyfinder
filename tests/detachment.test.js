import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle, applyVehicleDamage, hasFunctionalGun } from '../src/core/vehicle.js';
import { localToWorld } from '../src/core/math.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('a component detached from the core stops contributing weapon fire', () => {
  const vehicle = createStartingVehicle();
  assert.equal(hasFunctionalGun(vehicle), true);
  const mount = localToWorld({ x: 0, y: -CELL_SIZE / 2 }, vehicle);
  const hit = applyVehicleDamage(vehicle, mount, 15, 100, 0, { x: 0, y: -1 });
  assert.equal(hit.detached.some((cell) => cell.id === 'gun'), true);
  assert.equal(hasFunctionalGun(vehicle), false);
});

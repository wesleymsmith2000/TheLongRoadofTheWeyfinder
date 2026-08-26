import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle, applyVehicleDamage } from '../src/core/vehicle.js';
import { localToWorld } from '../src/core/math.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('center of mass recalculates when a module detaches', () => {
  const vehicle = createStartingVehicle();
  const before = { ...vehicle.centerOfMass };
  const mount = localToWorld({ x: -CELL_SIZE / 2, y: 0 }, vehicle);
  applyVehicleDamage(vehicle, mount, 15, 100, 0, { x: -1, y: 0 });
  assert.notEqual(vehicle.centerOfMass.x.toFixed(3), before.x.toFixed(3));
});

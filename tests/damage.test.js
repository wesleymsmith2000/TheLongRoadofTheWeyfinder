import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle, applyVehicleDamage } from '../src/core/vehicle.js';
import { localToWorld } from '../src/core/math.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('anchor severing invalidates the structural connection', () => {
  const vehicle = createStartingVehicle();
  const mount = localToWorld({ x: 0, y: -CELL_SIZE / 2 }, vehicle);
  applyVehicleDamage(vehicle, mount, 15, 100, 0, { x: 0, y: -1 });
  const edge = vehicle.connections.find((connection) => connection.a === 'core' && connection.b === 'gun');
  assert.equal(edge.valid, false);
});

test('vehicle cell contact damages nearest live voxel when the impact pocket is empty', () => {
  const vehicle = createStartingVehicle();
  const core = vehicle.cells.find((cell) => cell.id === 'core');
  for (const voxel of core.mask.flat()) voxel.hp = 0;
  core.mask[0][0].hp = core.mask[0][0].maxHp;
  const before = core.mask[0][0].hp;
  const hit = applyVehicleDamage(vehicle, vehicle, 0.01, 4, 0, { x: 0, y: -1 });
  assert.equal(hit.hit, true);
  assert.equal(core.mask[0][0].hp < before, true);
});

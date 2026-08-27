import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, traceEnemyVoxelRay } from '../src/core/enemy.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('beam ray trace stops at the first live enemy voxel', () => {
  const enemy = createEnemy(60, 0);
  const hit = traceEnemyVoxelRay([enemy], { x: 0, y: 0 }, 0, 200);
  assert.equal(hit.enemy, enemy);
  assert.equal(hit.distance < 60, true);
  assert.equal(hit.x < enemy.x, true);
});

test('beam ray trace passes through destroyed voxels to the next live voxel', () => {
  const enemy = createEnemy(CELL_SIZE, 0);
  const first = traceEnemyVoxelRay([enemy], { x: 0, y: 0 }, 0, 200);
  first.voxel.hp = 0;
  const second = traceEnemyVoxelRay([enemy], { x: 0, y: 0 }, 0, 200);
  assert.equal(second.enemy, enemy);
  assert.equal(second.distance > first.distance, true);
});

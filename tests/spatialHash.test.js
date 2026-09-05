import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialHash } from '../src/core/spatialHash.js';

test('spatial hash queries nearby circles by category', () => {
  const grid = createSpatialHash({ cellSize: 16 });
  const out = [];

  grid.insertCircle('player-shot', 8, 8, 2, 'playerProjectile');
  grid.insertCircle('enemy-shot', 40, 8, 2, 'enemyProjectile');
  grid.insertCircle('enemy-core', 10, 10, 4, 'enemy');

  const hits = grid.queryAabb(0, 0, 20, 20, new Set(['enemy']), out);
  assert.equal(hits, out);
  assert.deepEqual(hits.map((entry) => entry.id), ['enemy-core']);
});

test('spatial hash returns swept circles without duplicate entries', () => {
  const grid = createSpatialHash({ cellSize: 8 });

  grid.insertSweptCircle('fast-shot', 0, 0, 40, 0, 2, 'projectile');
  grid.insertCircle('far-shot', 80, 80, 2, 'projectile');

  const hits = grid.queryAabb(14, -4, 18, 4, 'projectile');
  assert.deepEqual(hits.map((entry) => entry.id), ['fast-shot']);
  assert.equal(new Set(hits.map((entry) => entry.id)).size, hits.length);
});

test('spatial hash query order is stable insertion order', () => {
  const grid = createSpatialHash({ cellSize: 16 });

  grid.insertCircle('third', 5, 5, 1, 'enemy');
  grid.insertCircle('first', -5, -5, 1, 'enemy');
  grid.insertCircle('second', 20, 0, 1, 'enemy');

  const hits = grid.queryAabb(-10, -10, 24, 10, 'enemy');
  assert.deepEqual(hits.map((entry) => entry.id), ['third', 'first', 'second']);
});

test('spatial hash circle queries filter candidate boxes and clear resets stats', () => {
  const grid = createSpatialHash({ cellSize: 12 });

  grid.insertCircle('near', 0, 0, 2, 'enemy');
  grid.insertCircle('box-overlap', 9, 0, 3, 'enemy');
  grid.insertCircle('corner-miss', 9, 9, 1, 'enemy');

  const hits = grid.queryCircle(0, 0, 7, 'enemy');
  assert.deepEqual(hits.map((entry) => entry.id), ['near', 'box-overlap']);
  assert.equal(grid.stats().lastQueryCandidates > 0, true);

  grid.clear();
  assert.equal(grid.stats().bucketCount, 0);
  assert.equal(grid.stats().entryCount, 0);
  assert.deepEqual(grid.queryAabb(-100, -100, 100, 100), []);
});

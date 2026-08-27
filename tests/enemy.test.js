import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnemyBlastDamage, applyEnemyDamage, createEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createGame, stepGame } from '../src/core/game.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('enemy takes voxel damage and records score damage', () => {
  const enemy = createEnemy(0, 0);
  const projectile = createProjectile(0, 0, 0, 0, { damage: 20, radius: 8, team: 'player' });
  const hit = applyEnemyDamage(enemy, projectile);
  assert.equal(hit.hit, true);
  assert.equal(enemy.damageTaken > 0, true);
});

test('enemy destruction is detected when core is shredded', () => {
  const enemy = createEnemy(0, 0);
  for (let i = 0; i < 6; i += 1) {
    applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 100, radius: 12, team: 'player' }));
  }
  assert.equal(enemy.destroyed, true);
});

test('destroyed enemies no longer block beam ray tracing', () => {
  const destroyed = createEnemy(40, 0);
  const live = createEnemy(90, 0);
  destroyed.destroyed = true;
  const hit = traceEnemyVoxelRay([destroyed, live], { x: 0, y: 0 }, 0, 160);
  assert.equal(hit.enemy, live);
});

test('destroyed enemies explode and knock nearby enemies back', () => {
  const game = createGame();
  game.road.halfWidth = 1000;
  game.road.halfHeight = 1000;
  game.enemies = [createEnemy(0, 0), createEnemy(80, 0), createEnemy(260, 0)];
  game.playerProjectiles = [createProjectile(0, 0, 0, 0, { team: 'player', damage: 1000, radius: 12 })];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.enemies[0].destroyed, true);
  assert.equal(game.enemies[0].explosionStart, game.time);
  assert.equal(game.enemies[1].vx > 0, true);
  assert.equal(game.enemies[1].vx < 220, true);
  assert.equal(game.enemies[2].vx, 0);
});

test('cannon-style blast strips nearby outer shell voxels with shallow penetration', () => {
  const enemy = createEnemy(0, 0);
  const result = applyEnemyBlastDamage(enemy, { x: -CELL_SIZE * 1.7, y: 0 }, { damage: 24 });
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const coreRemoved = core.mask.flat().filter((voxel) => voxel.hp <= 0).length;
  assert.equal(result.hit, true);
  assert.equal(result.removed > 0, true);
  assert.equal(coreRemoved, 0);
});

test('destroyed enemy remaining voxels become collectible scrap', () => {
  const enemy = createEnemy(0, 0);
  enemy.destroyed = true;
  const pickups = harvestEnemyScrap(enemy);
  assert.equal(pickups.length > 0, true);
  assert.equal(enemy.cells.every((cell) => cell.mask.flat().every((voxel) => voxel.hp <= 0)), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnemyDamage, createEnemy } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, stepProjectiles } from '../src/core/projectile.js';

test('homing projectile turns toward nearest target with inertia', () => {
  const rocket = createProjectile(0, 0, 200, 0, {
    behavior: 'homing',
    angle: 0,
    turnRate: 1,
    acceleration: 0,
    lifetime: 5,
  });
  stepProjectiles([rocket], 0.5, [{ x: 0, y: 100 }]);
  assert.equal(rocket.angle > 0, true);
  assert.equal(rocket.angle < Math.PI / 2, true);
});

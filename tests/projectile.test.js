import test from 'node:test';
import assert from 'node:assert/strict';
import rocketDefinition from '../content/weapons/rocket.json' with { type: 'json' };
import { applyRocketHullDamage, createProjectile, stepProjectiles } from '../src/core/projectile.js';

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

test('destructible rocket hull takes section voxel damage', () => {
  const rocket = createProjectile(0, 0, 0, 0, {
    weapon: 'rocket',
    behavior: 'homing',
    angle: 0,
    radius: 3,
    destructible: true,
    shape: rocketDefinition.projectile.shape,
  });
  const impact = createProjectile(6.5, 0, 0, 0, { team: 'enemy', radius: 3, damage: 200 });
  const hit = applyRocketHullDamage(rocket, impact);
  assert.equal(hit.hit, true);
  assert.equal(hit.destroyed, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import rocketDefinition from '../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../content/weapons/cannon.json' with { type: 'json' };
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

test('delayed acceleration aims at the live target position when it launches', () => {
  const target = { x: 0, y: 100 };
  const projectile = createProjectile(0, 0, 80, 0, {
    delayBeforeAcceleration: 0.5,
    stopBeforeAcceleration: true,
    acceleration: 100,
    accelerationDuration: 1,
    accelerationTarget: target,
    accelerationJitter: 0,
  });
  stepProjectiles([projectile], 0.25);
  target.x = 100;
  target.y = 0;
  stepProjectiles([projectile], 0.26);
  assert.equal(projectile.accelerationLocked, true);
  assert.equal(projectile.vx > 0, true);
  assert.equal(Math.abs(projectile.vy) < 0.001, true);
});

test('arc projectile lands after vertical motion resolves', () => {
  const projectile = createProjectile(0, 0, 10, 0, {
    behavior: 'arc',
    verticalVelocity: 20,
    gravity: 40,
    maxArcHeight: 5,
    lifetime: 2,
  });
  stepProjectiles([projectile], 0.25);
  assert.equal(projectile.arcLanded, false);
  assert.equal(projectile.z > 0, true);
  stepProjectiles([projectile], 0.8);
  assert.equal(projectile.arcLanded, true);
  assert.equal(projectile.readyToExplode, true);
  assert.equal(projectile.z, 0);
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

test('destructible cannon hull takes section voxel damage', () => {
  const cannon = createProjectile(0, 0, 0, 0, {
    weapon: 'cannon',
    behavior: 'ballistic',
    angle: 0,
    radius: 4,
    destructible: true,
    shape: cannonDefinition.projectile.shape,
  });
  const impact = createProjectile(5, 0, 0, 0, { team: 'enemy', radius: 3, damage: 240 });
  const hit = applyRocketHullDamage(cannon, impact);
  assert.equal(hit.hit, true);
  assert.equal(hit.destroyed, true);
});

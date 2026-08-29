import test from 'node:test';
import assert from 'node:assert/strict';
import rocketDefinition from '../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../content/weapons/cannon.json' with { type: 'json' };
import beamDefinition from '../content/weapons/beam.json' with { type: 'json' };
import aimedPatternDefinition from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import { createPatternState, firePattern, validatePatternDefinition } from '../src/core/patternDefinition.js';
import { runtimeWeaponDefinition, validateWeaponDefinition } from '../src/core/weaponDefinition.js';
import { Rng } from '../src/core/rng.js';

test('canon secondary weapon assets validate and normalize for runtime use', () => {
  for (const definition of [rocketDefinition, cannonDefinition, beamDefinition]) {
    const report = validateWeaponDefinition(definition);
    assert.equal(report.valid, true);
    const runtime = runtimeWeaponDefinition(definition);
    assert.equal(runtime.id, definition.assetId);
    assert.equal(runtime.damage, definition.projectile.damage);
    assert.equal(runtime.radius, definition.projectile.radius);
  }
});

test('weapon validation rejects unavailable projectile behavior', () => {
  const report = validateWeaponDefinition({
    ...rocketDefinition,
    projectile: { ...rocketDefinition.projectile, behavior: 'teleporting' },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('projectile.behavior')), true);
});

test('weapon validation rejects invalid destructible projectile shape data', () => {
  const report = validateWeaponDefinition({
    ...rocketDefinition,
    projectile: {
      ...rocketDefinition.projectile,
      destructible: true,
      shape: { ...rocketDefinition.projectile.shape, kind: 'blob', bodyVoxels: { columns: 0, rows: 3 } },
    },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('projectile.shape.kind')), true);
  assert.equal(report.errors.some((error) => error.includes('projectile.shape.bodyVoxels.columns')), true);
});

test('canon enemy pattern assets validate and create timed pattern state', () => {
  for (const definition of [aimedPatternDefinition, radialPatternDefinition]) {
    const report = validatePatternDefinition(definition);
    assert.equal(report.valid, true);
    const state = createPatternState(definition);
    assert.equal(state.timer, definition.initialDelay);
  }
});

test('aimed pattern emits projectile toward target with deterministic spread', () => {
  const projectiles = firePattern(aimedPatternDefinition, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  assert.equal(projectiles.length, 1);
  assert.equal(projectiles[0].team, 'enemy');
  assert.equal(projectiles[0].damage, 10);
  assert.equal(projectiles[0].vx > 100, true);
});

test('radial pattern emits configured projectile count', () => {
  const projectiles = firePattern(radialPatternDefinition, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  assert.equal(projectiles.length, 12);
  assert.equal(projectiles.every((projectile) => projectile.radius === 2), true);
});

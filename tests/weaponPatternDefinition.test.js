import test from 'node:test';
import assert from 'node:assert/strict';
import rocketDefinition from '../content/weapons/rocket.json' with { type: 'json' };
import cannonDefinition from '../content/weapons/cannon.json' with { type: 'json' };
import beamDefinition from '../content/weapons/beam.json' with { type: 'json' };
import trackingFlechetteDefinition from '../content/weapons/tracking_flechette.json' with { type: 'json' };
import mortarDefinition from '../content/weapons/mortar.json' with { type: 'json' };
import miniBeamDefinition from '../content/weapons/mini_beam.json' with { type: 'json' };
import tractorBeamDefinition from '../content/weapons/tractor_beam.json' with { type: 'json' };
import repulsorBeamDefinition from '../content/weapons/repulsor_beam.json' with { type: 'json' };
import staMissileDefinition from '../content/weapons/sta_missile.json' with { type: 'json' };
import orbOfBladesDefinition from '../content/weapons/orb_of_blades.json' with { type: 'json' };
import aimedPatternDefinition from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import mortarLinePatternDefinition from '../content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json' with { type: 'json' };
import { createPatternState, firePattern, validatePatternDefinition } from '../src/core/patternDefinition.js';
import { runtimeWeaponDefinition, validateWeaponDefinition } from '../src/core/weaponDefinition.js';
import { Rng } from '../src/core/rng.js';

test('canon secondary weapon assets validate and normalize for runtime use', () => {
  for (const definition of [
    rocketDefinition,
    cannonDefinition,
    beamDefinition,
    trackingFlechetteDefinition,
    mortarDefinition,
    miniBeamDefinition,
    tractorBeamDefinition,
    repulsorBeamDefinition,
    staMissileDefinition,
    orbOfBladesDefinition,
  ]) {
    const report = validateWeaponDefinition(definition);
    assert.equal(report.valid, true);
    const runtime = runtimeWeaponDefinition(definition);
    assert.equal(runtime.id, definition.assetId);
    assert.equal(runtime.damage, definition.projectile.damage);
    assert.equal(runtime.radius, definition.projectile.radius);
    assert.equal(runtime.pierceDamageScale, definition.projectile.pierceDamageScale ?? 0.7);
    assert.equal(runtime.pierceDamageFalloff, definition.projectile.pierceDamageFalloff ?? 0.68);
    assert.deepEqual(runtime.sprite, definition.projectile.sprite ?? null);
    assert.deepEqual(runtime.landingMarkerSprite, definition.projectile.landingMarkerSprite ?? null);
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
  assert.equal(projectiles[0].vx > 50, true);
});

test('radial pattern emits configured projectile count', () => {
  const radial = { ...radialPatternDefinition, emitter: { ...radialPatternDefinition.emitter, kind: 'radial' } };
  const projectiles = firePattern(radial, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  assert.equal(projectiles.length, 12);
  assert.equal(projectiles.every((projectile) => projectile.radius === 3), true);
});

test('pattern projectiles preserve sprite metadata for renderer handoff', () => {
  const projectiles = firePattern(mortarLinePatternDefinition, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  assert.equal(projectiles.length, 7);
  assert.equal(projectiles[0].sprite.assetId, 'sprite.weapon.mortar_enemy_shell');
  assert.equal(projectiles[0].landingMarkerSprite.assetId, 'sprite.weapon.mortar_enemy_marker');
});

test('sequential radial pattern emits one spoke at a time with delayed acceleration', () => {
  const state = createPatternState(radialPatternDefinition);
  const projectiles = firePattern(state, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  assert.equal(projectiles.length, 1);
  assert.equal(state.sequenceIndex, 1);
  assert.equal(projectiles[0].delayBeforeAcceleration > 0, true);
  assert.equal(projectiles[0].explodeAfterAcceleration, true);
  assert.equal(projectiles[0].color, '#3d6f8f');
  assert.equal(projectiles[0].absorbsPlayerProjectiles, true);
  assert.equal(projectiles[0].absorbHp, 18);
});

test('sequential radial pattern wraps after the full ring', () => {
  const state = createPatternState(radialPatternDefinition);
  for (let index = 0; index < radialPatternDefinition.emitter.count; index += 1) {
    firePattern(state, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(index + 1));
  }
  assert.equal(state.sequenceIndex, 0);
});

test('delayed acceleration projectile stops then locks toward target', async () => {
  const projectiles = firePattern(radialPatternDefinition, { x: 0, y: 0 }, { x: 100, y: 0 }, new Rng(1));
  const projectile = projectiles[0];
  const { stepProjectiles } = await import('../src/core/projectile.js');
  stepProjectiles([projectile], 20 / 60, [{ x: 100, y: 0 }]);
  assert.equal(projectile.accelerationLocked, true);
  assert.equal(projectile.vx > 0, true);
});

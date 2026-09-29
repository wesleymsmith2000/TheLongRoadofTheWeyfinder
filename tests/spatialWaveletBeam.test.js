import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVELET_FIELD_STATES,
  createSpatialWaveletField,
  resolveWaveletTier,
  stepSpatialFields,
  waveletBeamCoordinates,
} from '../src/core/spatialWaveletBeam.js';
import { createEnemy } from '../src/core/enemy.js';

const EFFECT = {
  chargePulseHz: 5,
  chargeRampPower: 1,
  convergenceDamping: 5,
  pulseWidthScale: 0.32,
  shockwaveLagSeconds: 0.05,
  shockwaveMaxRadiusScale: 2.8,
  postFireGlobalLockoutSeconds: 0.9,
  gameplay: { chargePullAcceleration: 190, shockwaveImpulse: 320, frontPierceVoxels: 24 },
  tiers: [{ chargeDurationMs: 1000, beamWidthPixels: 100, frontSpeedPps: 200, rippleSpeedPps: 100 }],
};

function gameWithField(field, enemies = [], enemyProjectiles = []) {
  return {
    vehicle: { cells: [{ id: 'gun', attached: true, state: { destroyed: false } }] },
    secondary: { cooldown: 0, waveletCommitment: field.id },
    spatialFields: [field],
    enemies,
    enemyProjectiles,
    playerProjectiles: [],
    score: { damageDone: 0 },
  };
}

test('wavelet locks world-space origin target and beam-local coordinates', () => {
  const field = createSpatialWaveletField({ origin: { x: 10, y: 20 }, target: { x: 110, y: 20 }, length: 200, effect: EFFECT });
  const coordinates = waveletBeamCoordinates(field, 50, 35);
  assert.deepEqual(field.lockedOrigin, { x: 10, y: 20 });
  assert.deepEqual(field.lockedTarget, { x: 110, y: 20 });
  assert.equal(coordinates.s, 40);
  assert.equal(coordinates.p, 15);
});

test('wavelet tier resolver separates capture and pulse widths', () => {
  const tier = resolveWaveletTier(EFFECT, 0);
  assert.equal(tier.chargeDurationSeconds, 1);
  assert.equal(tier.captureHalfWidth, 50);
  assert.equal(tier.pulseHalfWidth, 16);
});

test('charge pulls targets on both sides inward and damps lateral overshoot', () => {
  const field = createSpatialWaveletField({ origin: { x: 0, y: 0 }, target: { x: 100, y: 0 }, length: 200, effect: EFFECT, sourceCellId: 'gun' });
  const above = { x: 50, y: 30, vx: 0, vy: 30, radius: 2, destroyed: false };
  const below = { x: 50, y: -30, vx: 0, vy: -30, radius: 2, destroyed: false };
  const outside = { x: 50, y: 100, vx: 0, vy: 0, radius: 2, destroyed: false };
  const game = gameWithField(field, [above, below, outside]);
  stepSpatialFields(game, 0.5);
  assert.equal(above.vy < 30, true);
  assert.equal(below.vy > -30, true);
  assert.equal(outside.vy, 0);
});

test('discharge applies interlock and each object receives one shock impulse', () => {
  const effect = { ...EFFECT, convergenceDamping: 0, gameplay: { ...EFFECT.gameplay, chargePullAcceleration: 0 } };
  const field = createSpatialWaveletField({ origin: { x: 0, y: 0 }, target: { x: 100, y: 0 }, length: 100, effect, sourceCellId: 'gun' });
  const target = { x: 10, y: 20, vx: 0, vy: 0, radius: 2, lifetime: 5, behavior: 'ballistic' };
  const game = gameWithField(field, [], [target]);
  stepSpatialFields(game, 1);
  assert.equal(field.state, WAVELET_FIELD_STATES.DISCHARGING);
  assert.equal(game.weaponInterlock.remaining, 0.9);
  stepSpatialFields(game, 0.5);
  const firstVelocity = target.vy;
  stepSpatialFields(game, 0.5);
  assert.equal(firstVelocity > 0, true);
  assert.equal(target.vy, firstVelocity);
});

test('destroying the source during charge cancels without interlock', () => {
  const field = createSpatialWaveletField({ origin: { x: 0, y: 0 }, target: { x: 100, y: 0 }, effect: EFFECT, sourceCellId: 'gun' });
  const game = gameWithField(field);
  game.vehicle.cells[0].state.destroyed = true;
  stepSpatialFields(game, 0.25);
  assert.equal(game.spatialFields.length, 0);
  assert.equal(game.weaponInterlock, undefined);
});

test('pulse damages only newly traversed beam segments', () => {
  const effect = { ...EFFECT, tiers: [{ ...EFFECT.tiers[0], chargeDurationMs: 10, frontSpeedPps: 200 }] };
  const field = createSpatialWaveletField({
    origin: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
    length: 100,
    effect,
    sourceCellId: 'gun',
    frontDamage: 7,
  });
  const enemy = createEnemy(50, 0);
  const game = gameWithField(field, [enemy]);
  stepSpatialFields(game, 0.01);
  stepSpatialFields(game, 0.25);
  const damageAfterFront = enemy.damageTaken;
  stepSpatialFields(game, 0.25);
  assert.equal(damageAfterFront > 0, true);
  assert.equal(enemy.damageTaken >= damageAfterFront, true);
  assert.equal(field.previousFrontDistance, 100);
  assert.equal(field.pulseHitVoxels.size > 0, true);
});

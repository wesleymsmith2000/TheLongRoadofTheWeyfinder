import test from 'node:test';
import assert from 'node:assert/strict';

import { collectDynamicLights, normalizeDynamicLight, prioritizeDynamicLights } from '../src/core/dynamicLighting.js';

test('dynamic light normalization rejects unusable lights', () => {
  assert.equal(normalizeDynamicLight({ x: 0, y: 0, radius: 0, intensity: 1 }), null);
  assert.equal(normalizeDynamicLight({ x: 0, y: 0, radius: 12, intensity: 1 })?.radius, 12);
});

test('dynamic light budget prioritizes semantic and nearby lights', () => {
  const lights = [
    { x: 1000, y: 0, radius: 10, intensity: 1, priority: 5 },
    { x: 5, y: 0, radius: 10, intensity: 1, priority: 5 },
    { x: 600, y: 0, radius: 10, intensity: 1, priority: 100 },
  ];
  const selected = prioritizeDynamicLights(lights, { x: 0, y: 0 }, { maxLights: 2 });
  assert.deepEqual(
    selected.map((light) => light.x),
    [600, 5],
  );
});

test('game dynamic light collection includes player headlight and projectile glows', () => {
  const game = {
    environmentLighting: 'NIGHT',
    camera: { x: 0, y: 0 },
    vehicle: { x: 0, y: 0, heading: 0 },
    boost: { activeTime: 0 },
    playerProjectiles: [{ x: 5, y: 5, radius: 3, weapon: 'sta_missile', damage: 20, lifetime: 1, color: '#83f7ff' }],
    enemyProjectiles: [],
    smokeParticles: [],
  };
  const lights = collectDynamicLights(game, { maxLights: 4 });
  assert.equal(lights.some((light) => light.type === 'spot'), true);
  assert.equal(lights.some((light) => light.color === '#83f7ff'), true);
});

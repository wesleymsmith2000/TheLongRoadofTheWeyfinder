import test from 'node:test';
import assert from 'node:assert/strict';
import canonEnemyArchetypes from '../content/enemies/prototype0_enemy_archetypes.json' with { type: 'json' };
import {
  ENEMY_AGGREGATE_KINDS,
  ENEMY_CELL_ANIMATION_KINDS,
  ENEMY_MOVEMENT_KINDS,
  editableEnemyKnobs,
  getEnemyArchetype,
  listEnemyArchetypes,
  validateEnemyArchetypePack,
} from '../src/core/enemyArchetypeDefinition.js';

test('canon enemy archetype pack validates', () => {
  const report = validateEnemyArchetypePack(canonEnemyArchetypes);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
  assert.equal(ENEMY_MOVEMENT_KINDS.includes('weave'), true);
  assert.equal(ENEMY_AGGREGATE_KINDS.includes('multiPartBoss'), true);
  assert.equal(ENEMY_CELL_ANIMATION_KINDS.includes('fabricWeave'), true);
});

test('enemy archetype helpers expose editor-facing enemy models', () => {
  const archetypes = listEnemyArchetypes();
  assert.equal(archetypes.length, 6);
  assert.deepEqual(
    archetypes.map((archetype) => archetype.id),
    ['standard', 'enhanced_charger', 'pirate_ship.prototype0', 'pirate_ram_ship.prototype0', 'ghost_fabric.prototype0', 'boss.octagon.prototype0'],
  );
  assert.equal(getEnemyArchetype('pirate_ram_ship.prototype0').silhouette.kind, 'pirateShip');
  assert.equal(getEnemyArchetype('ghost_fabric.prototype0').cellAnimations[0].kind, 'fabricWeave');
  assert.equal(getEnemyArchetype('boss.octopus.prototype0').displayName, 'Octagon Boss Prototype');
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.attackMix.some((entry) => entry.id === 'trackingLaser'), true);
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.attackMix.find((entry) => entry.id === 'trackingLaser').telegraphSeconds, 3);
  assert.deepEqual(editableEnemyKnobs('enhanced_charger'), ['construct', 'patterns', 'entry', 'charge', 'palette']);
});

test('enemy archetype validation rejects unavailable runtime factories', () => {
  const report = validateEnemyArchetypePack({
    ...canonEnemyArchetypes,
    archetypes: [{ ...canonEnemyArchetypes.archetypes[0], runtimeFactory: 'spawnUnknownEnemy' }],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('runtimeFactory')), true);
});

test('enemy archetype validation rejects unknown movement and animation primitives', () => {
  const report = validateEnemyArchetypePack({
    ...canonEnemyArchetypes,
    archetypes: [
      {
        ...canonEnemyArchetypes.archetypes[0],
        movementProfiles: [{ id: 'bad-move', kind: 'teleportBehindPlayer' }],
        cellAnimations: [{ selector: 'type:armor', kind: 'meltIntoFog' }],
      },
    ],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('movementProfiles[0].kind')), true);
  assert.equal(report.errors.some((error) => error.includes('cellAnimations[0].kind')), true);
});

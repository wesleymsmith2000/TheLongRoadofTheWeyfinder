import test from 'node:test';
import assert from 'node:assert/strict';
import canonEnemyArchetypes from '../content/enemies/prototype0_enemy_archetypes.json' with { type: 'json' };
import { editableEnemyKnobs, getEnemyArchetype, listEnemyArchetypes, validateEnemyArchetypePack } from '../src/core/enemyArchetypeDefinition.js';

test('canon enemy archetype pack validates', () => {
  const report = validateEnemyArchetypePack(canonEnemyArchetypes);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('enemy archetype helpers expose editor-facing enemy models', () => {
  const archetypes = listEnemyArchetypes();
  assert.equal(archetypes.length, 3);
  assert.deepEqual(
    archetypes.map((archetype) => archetype.id),
    ['standard', 'enhanced_charger', 'boss.octagon.prototype0'],
  );
  assert.equal(getEnemyArchetype('boss.octopus.prototype0').displayName, 'Octagon Boss Prototype');
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

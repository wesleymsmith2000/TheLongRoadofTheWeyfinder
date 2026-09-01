import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIAL_DEFEAT_HOOKS,
  TARGET_CONDITIONS,
  createCombatEventStats,
  recordEnemyDefeat,
  recordSpecialDefeat,
  targetMatchesCondition,
} from '../src/core/combatEvents.js';

test('combat event stats expose enemy and special defeat counters', () => {
  const score = createCombatEventStats();
  recordEnemyDefeat(score, { archetypeId: 'heavy_mortar_boat.pirates_road' });
  recordSpecialDefeat(score, SPECIAL_DEFEAT_HOOKS.buzzardLandedForScrap);
  assert.equal(score.enemyDefeats['heavy_mortar_boat.pirates_road'], 1);
  assert.equal(score.specialDefeats.buzzardLandedForScrap, 1);
});

test('target conditions match outward-facing activity flags', () => {
  const target = {
    damageTaken: 12,
    activityFlags: {
      distractedByEnemy: true,
      collectingScrap: true,
      landedForScrap: false,
    },
  };
  assert.equal(targetMatchesCondition(target, TARGET_CONDITIONS.targetIsDistracted), true);
  assert.equal(targetMatchesCondition(target, TARGET_CONDITIONS.targetIsCollectingScrap), true);
  assert.equal(targetMatchesCondition(target, TARGET_CONDITIONS.targetIsLandedForScrap), false);
  assert.equal(targetMatchesCondition(target, TARGET_CONDITIONS.targetIsDamaged), true);
});

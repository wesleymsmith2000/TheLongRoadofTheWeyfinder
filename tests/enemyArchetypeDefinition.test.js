import test from 'node:test';
import assert from 'node:assert/strict';
import canonEnemyArchetypes from '../content/enemies/prototype0_enemy_archetypes.json' with { type: 'json' };
import {
  ENEMY_AGGREGATE_KINDS,
  ENEMY_CELL_ANIMATION_KINDS,
  ENEMY_MOVEMENT_KINDS,
  ENEMY_PRESENTATION_VARIANTS,
  ENEMY_TARGET_CONDITIONS,
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
  assert.equal(ENEMY_MOVEMENT_KINDS.includes('phase'), true);
  assert.equal(ENEMY_MOVEMENT_KINDS.includes('hop'), true);
  assert.equal(ENEMY_MOVEMENT_KINDS.includes('flyStrafe'), true);
  assert.equal(ENEMY_MOVEMENT_KINDS.includes('walkerLegs'), true);
  assert.equal(ENEMY_AGGREGATE_KINDS.includes('multiPartBoss'), true);
  assert.equal(ENEMY_CELL_ANIMATION_KINDS.includes('fabricWeave'), true);
  assert.equal(ENEMY_CELL_ANIMATION_KINDS.includes('phaseFade'), true);
  assert.equal(ENEMY_PRESENTATION_VARIANTS.includes('ghostWraith'), true);
  assert.equal(ENEMY_TARGET_CONDITIONS.includes('targetIsDistracted'), true);
  assert.equal(ENEMY_TARGET_CONDITIONS.includes('targetIsCollectingScrap'), true);
});

test('enemy archetype validation rejects malformed presentation sprite descriptors', () => {
  const report = validateEnemyArchetypePack({
    ...canonEnemyArchetypes,
    archetypes: [
      {
        ...canonEnemyArchetypes.archetypes[0],
        presentation: {
          variant: 'ghostWraith',
          sprite: { assetId: '', path: '', nativeSize: [128], displaySize: [64, 0], anchor: [0.5] },
        },
      },
    ],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('presentation.sprite.assetId')), true);
  assert.equal(report.errors.some((error) => error.includes('presentation.sprite.nativeSize')), true);
  assert.equal(report.errors.some((error) => error.includes('presentation.sprite.displaySize')), true);
  assert.equal(report.errors.some((error) => error.includes('presentation.sprite.anchor')), true);
});

test('enemy archetype helpers expose editor-facing enemy models', () => {
  const archetypes = listEnemyArchetypes();
  assert.equal(archetypes.length, 14);
  assert.deepEqual(
    archetypes.slice(0, 6).map((archetype) => archetype.id),
    ['standard', 'enhanced_charger', 'pirate_ship.prototype0', 'pirate_ram_ship.prototype0', 'ghost_fabric.prototype0', 'ghost_phaser.ghost_forrest'],
  );
  assert.equal(getEnemyArchetype('pirate_ram_ship.prototype0').silhouette.kind, 'pirateShip');
  assert.equal(getEnemyArchetype('ghost_fabric.prototype0').cellAnimations[0].kind, 'fabricWeave');
  assert.equal(getEnemyArchetype('ghost_phaser.ghost_forrest').phase.intangibleWhenOutOfPhase, true);
  assert.equal(getEnemyArchetype('ghost_phaser.ghost_forrest').presentation.variant, 'ghostWraith');
  assert.equal(getEnemyArchetype('hopping_stream_mob.digitized_stream').movementProfiles[0].kind, 'hop');
  assert.equal(getEnemyArchetype('hopping_stream_mob.digitized_stream').presentation.variant, 'tractorFrog');
  assert.equal(getEnemyArchetype('hopping_stream_mob.digitized_stream').presentation.sprite, undefined);
  assert.equal(getEnemyArchetype('hopping_stream_mob.digitized_stream').targeting.preferConditions.includes('targetIsDistracted'), true);
  assert.equal(getEnemyArchetype('heavy_mortar_boat.pirates_road').artillery.weapon, 'mortar');
  assert.equal(getEnemyArchetype('heavy_mortar_boat.pirates_road').presentation.variant, 'heavyMortarBoat');
  assert.equal(getEnemyArchetype('starlight_walker.prototype0').fallWhenSupportsDestroyed.landedBehavior, 'stationaryTurret');
  assert.equal(getEnemyArchetype('starlight_walker.prototype0').presentation.variant, 'spiderWalker');
  assert.equal(getEnemyArchetype('scrap_buzzard.shadowed_desert').elevation.arcCollision, true);
  assert.equal(getEnemyArchetype('scrap_buzzard.shadowed_desert').presentation.variant, 'scrapBuzzard');
  assert.deepEqual(getEnemyArchetype('scrap_buzzard.shadowed_desert').zoneAliases, ['ShadowedDessert']);
  assert.equal(getEnemyArchetype('inchworm_carrier.freedoms_pass').spawns.archetype, 'moth_bomber.freedoms_pass');
  assert.equal(getEnemyArchetype('inchworm_carrier.freedoms_pass').presentation.variant, 'inchwormCarrier');
  assert.equal(listEnemyArchetypes().every((archetype) => archetype.presentation?.sprite == null), true);
  assert.equal(getEnemyArchetype('boss.octopus.prototype0').displayName, 'Octagon Boss Prototype');
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.attackMix.some((entry) => entry.id === 'trackingLaser'), true);
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.attackMix.find((entry) => entry.id === 'trackingLaser').telegraphSeconds, 3);
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.beamSource.shutoffWhenDestroyed, true);
  assert.equal(getEnemyArchetype('boss.octagon.prototype0').arms.noduleShots.source, 'liveArmGun');
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

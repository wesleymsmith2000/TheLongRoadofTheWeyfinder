import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json' with { type: 'json' };
import ghostPhaseHomingRadial from '../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json' with { type: 'json' };
import frogTractorBeam from '../content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json' with { type: 'json' };
import frogShortLaser from '../content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json' with { type: 'json' };
import mortarLine7 from '../content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json' with { type: 'json' };
import buzzardTrailingMortar from '../content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json' with { type: 'json' };
import inchwormRepulsorEye from '../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json' with { type: 'json' };
import inchwormEyeMiniBeam from '../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json' with { type: 'json' };
import ghostPhaserConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import tractorFrogConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json' with { type: 'json' };
import heavyMortarBoatConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json' with { type: 'json' };
import spiderWalkerConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json' with { type: 'json' };
import spideryWalkerConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spidery_walker_sculpted.json' with { type: 'json' };
import burlyWalkerBossBodyConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.burly_walker_boss_body_sculpted.json' with { type: 'json' };
import rotatableBossCannonConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.rotatable_boss_cannon_sculpted.json' with { type: 'json' };
import scrapBuzzardConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormHeadConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_head_sculpted.json' with { type: 'json' };
import inchwormBodySegmentConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_body_segment_sculpted.json' with { type: 'json' };
import mothBomberConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };
import zoneEnemyArchetypes from '../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import behaviorContracts from '../content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json' with { type: 'json' };
import { loadContentBundle, validateContentPack } from '../src/core/contentRegistry.js';
import { validateConstructDefinition } from '../src/core/constructDefinition.js';
import { validateEnemyArchetypePack } from '../src/core/enemyArchetypeDefinition.js';
import { validatePatternDefinition } from '../src/core/patternDefinition.js';

const patterns = [
  ghostPhaseHomingRadial,
  frogTractorBeam,
  frogShortLaser,
  mortarLine7,
  buzzardTrailingMortar,
  inchwormRepulsorEye,
  inchwormEyeMiniBeam,
];
const constructs = [
  ghostPhaserConstruct,
  tractorFrogConstruct,
  heavyMortarBoatConstruct,
  spiderWalkerConstruct,
  spideryWalkerConstruct,
  burlyWalkerBossBodyConstruct,
  rotatableBossCannonConstruct,
  scrapBuzzardConstruct,
  inchwormHeadConstruct,
  inchwormBodySegmentConstruct,
  mothBomberConstruct,
];

test('zone enemy example content pack validates for editor import', () => {
  assert.equal(validateContentPack(manifest).valid, true);
  for (const construct of constructs) assert.equal(validateConstructDefinition(construct).valid, true, construct.assetId);
  for (const pattern of patterns) assert.equal(validatePatternDefinition(pattern).valid, true, pattern.assetId);
  const archetypeReport = validateEnemyArchetypePack(zoneEnemyArchetypes);
  assert.equal(archetypeReport.valid, true);

  const bundle = {
    manifests: [manifest],
    assets: [
      ...constructs.map((definition) => ({ kind: 'construct', definition, sourcePack: manifest.packId })),
      ...patterns.map((definition) => ({ kind: 'pattern', definition, sourcePack: manifest.packId })),
      { kind: 'enemyArchetype', definition: zoneEnemyArchetypes, sourcePack: manifest.packId },
      { kind: 'behavior', definition: behaviorContracts, sourcePack: manifest.packId },
    ],
  };
  const report = loadContentBundle(bundle);
  assert.equal(report.valid, true);
  assert.equal(report.registry.assets.get('construct').size, constructs.length);
  assert.equal(report.registry.assets.get('pattern').size, patterns.length);
  assert.equal(report.registry.assets.get('image').size, 0);
  assert.equal(report.registry.assets.get('enemyArchetype').has('example.zone_enemy_archetypes'), true);
});

test('zone enemy examples preserve requested advanced behavior descriptors', () => {
  const byId = new Map(zoneEnemyArchetypes.archetypes.map((archetype) => [archetype.id, archetype]));
  assert.equal(byId.get('example.ghost_phase_mob.ghost_forrest').phase.onHit.cancelFireSequence, true);
  assert.equal(byId.get('example.ghost_phase_mob.ghost_forrest').fireSequence.shots, 16);
  assert.equal(byId.get('example.tractor_frog.digitized_stream').tractorBeam.scrapHealPerPiece, 8);
  assert.equal(byId.get('example.heavy_mortar_boat.pirates_road').artillery.shots, 7);
  assert.equal(byId.get('example.elevated_walker.starlight_road').fallWhenSupportsDestroyed.requiredDestroyedCount, 4);
  assert.equal(byId.get('example.scrap_buzzard.shadowed_desert').scrapFeeding.landWhenScrapPresent, true);
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').segments.maxCount, 12);
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').segments.destroyedSegmentRelease.kind, 'scrapSpray');
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').segments.destroyedSegmentRelease.shrapnel, false);
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').construct, 'example.construct.inchworm_head_sculpted');
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').aggregate.parts[1].construct, 'example.construct.inchworm_body_segment_sculpted');
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').eyeGuns.repelsIncomingProjectiles, true);
  assert.equal(byId.get('example.moth_bomber.freedoms_pass').detonation.trigger, 'contactPlayerOrConstruct');
  assert.equal(byId.get('example.walker_cannon_boss.twilight_crossroads').construct, 'example.construct.burly_walker_boss_body_sculpted');
  assert.equal(byId.get('example.walker_cannon_boss.twilight_crossroads').aggregate.kind, 'multiPartBoss');
  assert.equal(byId.get('example.walker_cannon_boss.twilight_crossroads').aggregate.parts.filter((part) => part.role === 'rotatableCannon').length, 3);
  assert.deepEqual(
    byId
      .get('example.walker_cannon_boss.twilight_crossroads')
      .aggregate.parts.filter((part) => part.role === 'rotatableCannon')
      .map((part) => part.attachment)
      .sort(),
    ['slot:leftCannonMount', 'slot:rightCannonMount', 'slot:topCannonMount'],
  );
  assert.equal(byId.get('example.ghost_phase_mob.ghost_forrest').construct, 'example.construct.ghost_phaser_sculpted');
  assert.equal(byId.get('example.tractor_frog.digitized_stream').presentation.variant, 'tractorFrog');
  assert.equal(byId.get('example.tractor_frog.digitized_stream').presentation.sprite, undefined);
  assert.equal(byId.get('example.tractor_frog.digitized_stream').construct, 'example.construct.tractor_frog_sculpted');
  assert.equal(byId.get('example.elevated_walker.starlight_road').presentation.variant, 'spiderWalker');
  assert.equal(zoneEnemyArchetypes.archetypes.every((archetype) => archetype.presentation?.sprite == null), true);
});

test('zone enemy sculpted constructs use enlarged editable module counts', () => {
  const byId = new Map(constructs.map((construct) => [construct.assetId, construct]));
  const spiderWalker = byId.get('example.construct.spider_walker_sculpted');
  const spideryWalker = byId.get('example.construct.spidery_walker_sculpted');
  const bossWalkerBody = byId.get('example.construct.burly_walker_boss_body_sculpted');
  const rotatableBossCannon = byId.get('example.construct.rotatable_boss_cannon_sculpted');
  const walkerSupportLegs = spiderWalker.cells.filter((cell) => cell.role === 'supportLeg');
  const walkerLegJoints = spiderWalker.cells.filter((cell) => cell.role === 'legJoint');
  const walkerLegArmor = spiderWalker.cells.filter((cell) => cell.role === 'legArmor');
  const walkerElevatedBody = spiderWalker.cells.filter((cell) => cell.role === 'elevatedBody');
  const walkerSupportLegLayers = [...new Set(walkerSupportLegs.map((cell) => cell.gridZ ?? 0))].sort((a, b) => a - b);
  const walkerVerticalConnections = spiderWalker.connections.filter(
    (connection) => connection.aSide === 'above' || connection.aSide === 'below' || connection.bSide === 'above' || connection.bSide === 'below',
  );
  assert.equal(byId.get('example.construct.ghost_phaser_sculpted').cells.length >= 32, true);
  assert.equal(byId.get('example.construct.tractor_frog_sculpted').cells.length >= 32, true);
  assert.equal(byId.get('example.construct.heavy_mortar_boat_sculpted').cells.length >= 32, true);
  assert.equal(walkerSupportLegs.length, 96);
  assert.equal(walkerSupportLegs.every((cell) => cell.type === 'wheel'), true);
  assert.deepEqual(walkerSupportLegLayers, [0, 1, 2, 3, 4, 5]);
  assert.equal(walkerLegArmor.length, 192);
  assert.equal(walkerLegArmor.every((cell) => cell.type === 'armor' && (cell.gridZ ?? 0) < 6), true);
  assert.equal(walkerLegJoints.length, 16);
  assert.equal(walkerLegJoints.every((cell) => cell.type === 'engine' && cell.gridZ === 6), true);
  assert.equal(walkerElevatedBody.every((cell) => cell.gridZ >= 6), true);
  assert.equal(walkerVerticalConnections.length > 0, true);
  assert.equal(spiderWalker.tags.includes('dev-lookup:walker-burly-four-leg'), true);
  assert.equal(spiderWalker.tags.includes('runtime-hook:walkerLegs'), true);
  assert.equal(spideryWalker.cells.filter((cell) => cell.role === 'supportLeg' && cell.type === 'wheel').length, 48);
  assert.equal(spideryWalker.cells.filter((cell) => cell.role === 'legArmor' && cell.type === 'armor' && (cell.gridZ ?? 0) < 6).length, 192);
  assert.equal(spideryWalker.cells.filter((cell) => cell.role === 'legJoint' && cell.type === 'engine' && cell.gridZ === 6).length, 8);
  assert.equal(spideryWalker.tags.includes('dev-lookup:walker-spidery-eight-leg'), true);
  assert.equal(spideryWalker.tags.includes('runtime-hook:walkerLegs'), true);
  assert.equal(bossWalkerBody.cells.filter((cell) => cell.role === 'supportLeg' && cell.type === 'wheel').length, 120);
  assert.equal(bossWalkerBody.cells.filter((cell) => cell.role === 'legArmor' && cell.type === 'armor' && (cell.gridZ ?? 0) < 6).length, 384);
  assert.equal(bossWalkerBody.cells.filter((cell) => cell.role === 'legJoint' && cell.type === 'engine' && cell.gridZ === 6).length, 4);
  assert.equal(bossWalkerBody.cells.filter((cell) => cell.role === 'cannonMount' && cell.type === 'utility').length >= 3, true);
  assert.equal(bossWalkerBody.tags.includes('dev-lookup:walker-boss-body-burly'), true);
  assert.equal(bossWalkerBody.tags.includes('runtime-hook:aggregateBoss'), true);
  assert.equal(rotatableBossCannon.cells.filter((cell) => cell.role === 'cannonBarrel' && cell.type === 'gun').length, 12);
  assert.equal(rotatableBossCannon.cells.filter((cell) => cell.role === 'rotationJoint' && cell.type === 'engine').length, 18);
  assert.equal(rotatableBossCannon.cells.filter((cell) => cell.role === 'mountSocket' && cell.type === 'utility').length, 5);
  assert.equal(rotatableBossCannon.tags.includes('dev-lookup:boss-rotatable-cannon'), true);
  assert.equal(rotatableBossCannon.tags.includes('runtime-hook:rotatableCannon'), true);
  assert.equal(byId.get('example.construct.scrap_buzzard_sculpted').cells.filter((cell) => cell.role === 'wing').length >= 8, true);
  assert.equal(byId.get('example.construct.inchworm_head_sculpted').cells.length >= 55, true);
  assert.equal(byId.get('example.construct.inchworm_body_segment_sculpted').cells.length >= 35, true);
  assert.equal(byId.get('example.construct.inchworm_head_sculpted').presentation.relativeScale, 1.25);
  assert.equal(byId.get('example.construct.inchworm_head_sculpted').cells.filter((cell) => cell.role === 'mandible').length >= 6, true);
  assert.deepEqual(
    byId
      .get('example.construct.inchworm_head_sculpted')
      .cells.filter((cell) => cell.role === 'eyeGun')
      .map((cell) => cell.appearance.tint)
      .sort(),
    ['#ff2d1a', '#ff8a1f'],
  );
  assert.equal(byId.get('example.construct.inchworm_body_segment_sculpted').cells.filter((cell) => cell.role === 'nubbyLeg').length >= 2, true);
  assert.equal(byId.get('example.construct.inchworm_body_segment_sculpted').cells.filter((cell) => cell.role === 'mothLaunchNode').length, 1);
  for (const construct of constructs) {
    assert.equal(construct.cells.filter((cell) => cell.type === 'core').length, 1, construct.assetId);
    assert.equal(construct.connections.length, construct.cells.length - 1, construct.assetId);
  }
});

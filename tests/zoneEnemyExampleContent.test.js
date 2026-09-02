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
import scrapBuzzardConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormCarrierConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_carrier_sculpted.json' with { type: 'json' };
import mothBomberConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };
import zoneEnemyArchetypes from '../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import behaviorContracts from '../content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json' with { type: 'json' };
import ghostPhaserSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.ghost_phaser.json' with { type: 'json' };
import spiderWalkerSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.spider_walker.json' with { type: 'json' };
import heavyMortarBoatSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.heavy_mortar_boat.json' with { type: 'json' };
import scrapBuzzardSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.scrap_buzzard.json' with { type: 'json' };
import inchwormCarrierSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.inchworm_carrier.json' with { type: 'json' };
import mothBomberSprite from '../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.moth_bomber.json' with { type: 'json' };
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
  scrapBuzzardConstruct,
  inchwormCarrierConstruct,
  mothBomberConstruct,
];
const imageResources = [ghostPhaserSprite, spiderWalkerSprite, heavyMortarBoatSprite, scrapBuzzardSprite, inchwormCarrierSprite, mothBomberSprite];

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
      ...imageResources.map((definition) => ({ kind: 'image', definition, sourcePack: manifest.packId })),
    ],
  };
  const report = loadContentBundle(bundle);
  assert.equal(report.valid, true);
  assert.equal(report.registry.assets.get('construct').size, constructs.length);
  assert.equal(report.registry.assets.get('pattern').size, patterns.length);
  assert.equal(report.registry.assets.get('image').size, imageResources.length);
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
  assert.equal(byId.get('example.inchworm_carrier.freedoms_pass').eyeGuns.repelsIncomingProjectiles, true);
  assert.equal(byId.get('example.moth_bomber.freedoms_pass').detonation.trigger, 'contactPlayerOrConstruct');
  assert.equal(byId.get('example.ghost_phase_mob.ghost_forrest').presentation.sprite.assetId, 'sprite.enemy.ghost_phaser');
  assert.equal(byId.get('example.ghost_phase_mob.ghost_forrest').construct, 'example.construct.ghost_phaser_sculpted');
  assert.equal(byId.get('example.tractor_frog.digitized_stream').presentation.variant, 'tractorFrog');
  assert.equal(byId.get('example.tractor_frog.digitized_stream').presentation.sprite, undefined);
  assert.equal(byId.get('example.tractor_frog.digitized_stream').construct, 'example.construct.tractor_frog_sculpted');
  assert.equal(byId.get('example.elevated_walker.starlight_road').presentation.variant, 'spiderWalker');
  assert.equal(byId.get('example.scrap_buzzard.shadowed_desert').presentation.sprite.assetId, 'sprite.enemy.scrap_buzzard');
});

test('zone enemy sculpted constructs use enlarged editable module counts', () => {
  const byId = new Map(constructs.map((construct) => [construct.assetId, construct]));
  assert.equal(byId.get('example.construct.ghost_phaser_sculpted').cells.length >= 32, true);
  assert.equal(byId.get('example.construct.tractor_frog_sculpted').cells.length >= 32, true);
  assert.equal(byId.get('example.construct.heavy_mortar_boat_sculpted').cells.length >= 32, true);
  assert.equal(byId.get('example.construct.spider_walker_sculpted').cells.filter((cell) => cell.role === 'supportLeg').length, 8);
  assert.equal(byId.get('example.construct.scrap_buzzard_sculpted').cells.filter((cell) => cell.role === 'wing').length >= 8, true);
  assert.equal(byId.get('example.construct.inchworm_carrier_sculpted').cells.length >= 40, true);
  for (const construct of constructs) {
    assert.equal(construct.cells.filter((cell) => cell.type === 'core').length, 1, construct.assetId);
    assert.equal(construct.connections.length, construct.cells.length - 1, construct.assetId);
  }
});

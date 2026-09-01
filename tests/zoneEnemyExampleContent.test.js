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
import zoneEnemyArchetypes from '../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import behaviorContracts from '../content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json' with { type: 'json' };
import { loadContentBundle, validateContentPack } from '../src/core/contentRegistry.js';
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

test('zone enemy example content pack validates for editor import', () => {
  assert.equal(validateContentPack(manifest).valid, true);
  for (const pattern of patterns) assert.equal(validatePatternDefinition(pattern).valid, true, pattern.assetId);
  const archetypeReport = validateEnemyArchetypePack(zoneEnemyArchetypes);
  assert.equal(archetypeReport.valid, true);

  const bundle = {
    manifests: [manifest],
    assets: [
      ...patterns.map((definition) => ({ kind: 'pattern', definition, sourcePack: manifest.packId })),
      { kind: 'enemyArchetype', definition: zoneEnemyArchetypes, sourcePack: manifest.packId },
      { kind: 'behavior', definition: behaviorContracts, sourcePack: manifest.packId },
    ],
  };
  const report = loadContentBundle(bundle);
  assert.equal(report.valid, true);
  assert.equal(report.registry.assets.get('pattern').size, patterns.length);
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
});

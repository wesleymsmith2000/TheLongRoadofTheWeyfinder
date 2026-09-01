import manifest from '../../content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json' with { type: 'json' };
import ghostPhaseHomingRadial from '../../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json' with { type: 'json' };
import frogTractorBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json' with { type: 'json' };
import frogShortLaser from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json' with { type: 'json' };
import mortarLine7 from '../../content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json' with { type: 'json' };
import buzzardTrailingMortar from '../../content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json' with { type: 'json' };
import inchwormRepulsorEye from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json' with { type: 'json' };
import inchwormEyeMiniBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json' with { type: 'json' };
import zoneEnemyArchetypes from '../../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import behaviorContracts from '../../content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json' with { type: 'json' };

export const EXAMPLE_ZONE_ENEMY_SET_BUNDLE = Object.freeze({
  manifests: [manifest],
  assets: [
    { kind: 'pattern', definition: ghostPhaseHomingRadial, sourcePack: manifest.packId },
    { kind: 'pattern', definition: frogTractorBeam, sourcePack: manifest.packId },
    { kind: 'pattern', definition: frogShortLaser, sourcePack: manifest.packId },
    { kind: 'pattern', definition: mortarLine7, sourcePack: manifest.packId },
    { kind: 'pattern', definition: buzzardTrailingMortar, sourcePack: manifest.packId },
    { kind: 'pattern', definition: inchwormRepulsorEye, sourcePack: manifest.packId },
    { kind: 'pattern', definition: inchwormEyeMiniBeam, sourcePack: manifest.packId },
    { kind: 'enemyArchetype', definition: zoneEnemyArchetypes, sourcePack: manifest.packId },
    { kind: 'behavior', definition: behaviorContracts, sourcePack: manifest.packId },
  ],
  files: [
    { path: 'content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json', name: 'example.prototype0_zone_enemy_set.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json', name: 'example.ghost_phase_homing_radial.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json', name: 'example.frog_tractor_beam.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json', name: 'example.frog_short_laser.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json', name: 'example.mortar_line_7.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json', name: 'example.buzzard_trailing_mortar.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json', name: 'example.inchworm_repulsor_eye.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json', name: 'example.inchworm_eye_mini_beam.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json', name: 'example.zone_enemy_archetypes.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json', name: 'example.zone_enemy_behavior_contracts.json' },
  ],
  errors: [],
  warnings: [],
});

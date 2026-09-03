import manifest from '../../content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json' with { type: 'json' };
import ghostPhaseHomingRadial from '../../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json' with { type: 'json' };
import frogTractorBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json' with { type: 'json' };
import frogShortLaser from '../../content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json' with { type: 'json' };
import mortarLine7 from '../../content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json' with { type: 'json' };
import buzzardTrailingMortar from '../../content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json' with { type: 'json' };
import inchwormRepulsorEye from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json' with { type: 'json' };
import inchwormEyeMiniBeam from '../../content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json' with { type: 'json' };
import ghostPhaserConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import tractorFrogConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json' with { type: 'json' };
import heavyMortarBoatConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json' with { type: 'json' };
import spiderWalkerConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json' with { type: 'json' };
import scrapBuzzardConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormCarrierConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_carrier_sculpted.json' with { type: 'json' };
import mothBomberConstruct from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };
import zoneEnemyArchetypes from '../../content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json' with { type: 'json' };
import behaviorContracts from '../../content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json' with { type: 'json' };

export const EXAMPLE_ZONE_ENEMY_SET_BUNDLE = Object.freeze({
  manifests: [manifest],
  assets: [
    { kind: 'construct', definition: ghostPhaserConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: tractorFrogConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: heavyMortarBoatConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: spiderWalkerConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: scrapBuzzardConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: inchwormCarrierConstruct, sourcePack: manifest.packId },
    { kind: 'construct', definition: mothBomberConstruct, sourcePack: manifest.packId },
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
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json', name: 'example.construct.ghost_phaser_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json', name: 'example.construct.tractor_frog_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json', name: 'example.construct.heavy_mortar_boat_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json', name: 'example.construct.spider_walker_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json', name: 'example.construct.scrap_buzzard_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_carrier_sculpted.json', name: 'example.construct.inchworm_carrier_sculpted.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json', name: 'example.construct.moth_bomber_sculpted.json' },
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

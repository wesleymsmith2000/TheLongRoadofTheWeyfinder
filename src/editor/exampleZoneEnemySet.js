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
import ghostPhaserSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.ghost_phaser.json' with { type: 'json' };
import spiderWalkerSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.spider_walker.json' with { type: 'json' };
import heavyMortarBoatSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.heavy_mortar_boat.json' with { type: 'json' };
import tractorFrogSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.tractor_frog.json' with { type: 'json' };
import scrapBuzzardSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.scrap_buzzard.json' with { type: 'json' };
import inchwormCarrierSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.inchworm_carrier.json' with { type: 'json' };
import mothBomberSprite from '../../content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.moth_bomber.json' with { type: 'json' };

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
    { kind: 'image', definition: ghostPhaserSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: spiderWalkerSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: heavyMortarBoatSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: tractorFrogSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: scrapBuzzardSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: inchwormCarrierSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: mothBomberSprite, sourcePack: manifest.packId },
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
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.ghost_phaser.json', name: 'sprite.enemy.ghost_phaser.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.spider_walker.json', name: 'sprite.enemy.spider_walker.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.heavy_mortar_boat.json', name: 'sprite.enemy.heavy_mortar_boat.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.tractor_frog.json', name: 'sprite.enemy.tractor_frog.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.scrap_buzzard.json', name: 'sprite.enemy.scrap_buzzard.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.inchworm_carrier.json', name: 'sprite.enemy.inchworm_carrier.json' },
    { path: 'content/examples/prototype0-zone-enemy-set/resources/enemies/sprite.enemy.moth_bomber.json', name: 'sprite.enemy.moth_bomber.json' },
  ],
  errors: [],
  warnings: [],
});

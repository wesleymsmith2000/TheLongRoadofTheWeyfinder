import manifest from '../../content/examples/prototype0-module-set/packs/example.prototype0_module_set.json' with { type: 'json' };
import basicTurret from '../../content/examples/prototype0-module-set/constructs/example.basic_turret.json' with { type: 'json' };
import startingVehicle from '../../content/examples/prototype0-module-set/constructs/example.starting_vehicle.json' with { type: 'json' };
import rocket from '../../content/examples/prototype0-module-set/weapons/example.rocket.json' with { type: 'json' };
import cannon from '../../content/examples/prototype0-module-set/weapons/example.cannon.json' with { type: 'json' };
import beam from '../../content/examples/prototype0-module-set/weapons/example.beam.json' with { type: 'json' };
import trackingFlechette from '../../content/examples/prototype0-module-set/weapons/example.tracking_flechette.json' with { type: 'json' };
import staMissile from '../../content/examples/prototype0-module-set/weapons/example.sta_missile.json' with { type: 'json' };
import orbOfBlades from '../../content/examples/prototype0-module-set/weapons/example.orb_of_blades.json' with { type: 'json' };
import aimedShot from '../../content/examples/prototype0-module-set/patterns/example.enemy_aimed_shot.json' with { type: 'json' };
import radialBurst from '../../content/examples/prototype0-module-set/patterns/example.enemy_radial_burst.json' with { type: 'json' };
import acidSplash from '../../content/examples/prototype0-module-set/status_effects/example.acid_splash.json' with { type: 'json' };
import enemyArchetypes from '../../content/examples/prototype0-module-set/enemies/example.prototype0_enemy_archetypes.json' with { type: 'json' };
import roadTrial from '../../content/examples/prototype0-module-set/levels/example.prototype0_road_trial.json' with { type: 'json' };
import introVoiceover from '../../content/examples/prototype0-module-set/resources/example.voiceover_intro.json' with { type: 'json' };
import trackingFlechetteSprite from '../../content/examples/prototype0-module-set/resources/weapons/sprite.weapon.tracking_flechette.json' with { type: 'json' };
import orbOfBladesCoreSprite from '../../content/examples/prototype0-module-set/resources/weapons/sprite.weapon.orb_of_blades_core.json' with { type: 'json' };
import orbBladeShardSprite from '../../content/examples/prototype0-module-set/resources/weapons/sprite.weapon.orb_blade_shard.json' with { type: 'json' };

export const EXAMPLE_PROTOTYPE0_MODULE_SET_BUNDLE = Object.freeze({
  manifests: [manifest],
  assets: [
    { kind: 'construct', definition: basicTurret, sourcePack: manifest.packId },
    { kind: 'construct', definition: startingVehicle, sourcePack: manifest.packId },
    { kind: 'weapon', definition: rocket, sourcePack: manifest.packId },
    { kind: 'weapon', definition: cannon, sourcePack: manifest.packId },
    { kind: 'weapon', definition: beam, sourcePack: manifest.packId },
    { kind: 'weapon', definition: trackingFlechette, sourcePack: manifest.packId },
    { kind: 'weapon', definition: staMissile, sourcePack: manifest.packId },
    { kind: 'weapon', definition: orbOfBlades, sourcePack: manifest.packId },
    { kind: 'pattern', definition: aimedShot, sourcePack: manifest.packId },
    { kind: 'pattern', definition: radialBurst, sourcePack: manifest.packId },
    { kind: 'statusEffect', definition: acidSplash, sourcePack: manifest.packId },
    { kind: 'enemyArchetype', definition: enemyArchetypes, sourcePack: manifest.packId },
    { kind: 'level', definition: roadTrial, sourcePack: manifest.packId },
    { kind: 'sound', definition: introVoiceover, sourcePack: manifest.packId },
    { kind: 'image', definition: trackingFlechetteSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: orbOfBladesCoreSprite, sourcePack: manifest.packId },
    { kind: 'image', definition: orbBladeShardSprite, sourcePack: manifest.packId },
  ],
  files: [
    { path: 'content/examples/prototype0-module-set/packs/example.prototype0_module_set.json', name: 'example.prototype0_module_set.json' },
    { path: 'content/examples/prototype0-module-set/constructs/example.basic_turret.json', name: 'example.basic_turret.json' },
    { path: 'content/examples/prototype0-module-set/constructs/example.starting_vehicle.json', name: 'example.starting_vehicle.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.rocket.json', name: 'example.rocket.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.cannon.json', name: 'example.cannon.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.beam.json', name: 'example.beam.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.tracking_flechette.json', name: 'example.tracking_flechette.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.sta_missile.json', name: 'example.sta_missile.json' },
    { path: 'content/examples/prototype0-module-set/weapons/example.orb_of_blades.json', name: 'example.orb_of_blades.json' },
    { path: 'content/examples/prototype0-module-set/patterns/example.enemy_aimed_shot.json', name: 'example.enemy_aimed_shot.json' },
    { path: 'content/examples/prototype0-module-set/patterns/example.enemy_radial_burst.json', name: 'example.enemy_radial_burst.json' },
    { path: 'content/examples/prototype0-module-set/status_effects/example.acid_splash.json', name: 'example.acid_splash.json' },
    { path: 'content/examples/prototype0-module-set/enemies/example.prototype0_enemy_archetypes.json', name: 'example.prototype0_enemy_archetypes.json' },
    { path: 'content/examples/prototype0-module-set/levels/example.prototype0_road_trial.json', name: 'example.prototype0_road_trial.json' },
    { path: 'content/examples/prototype0-module-set/resources/example.voiceover_intro.json', name: 'example.voiceover_intro.json' },
    { path: 'content/examples/prototype0-module-set/resources/weapons/sprite.weapon.tracking_flechette.json', name: 'sprite.weapon.tracking_flechette.json' },
    { path: 'content/examples/prototype0-module-set/resources/weapons/sprite.weapon.orb_of_blades_core.json', name: 'sprite.weapon.orb_of_blades_core.json' },
    { path: 'content/examples/prototype0-module-set/resources/weapons/sprite.weapon.orb_blade_shard.json', name: 'sprite.weapon.orb_blade_shard.json' },
  ],
  errors: [],
  warnings: [],
});

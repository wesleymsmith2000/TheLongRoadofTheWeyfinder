# Sound Effect Editor Resources Handoff

Runtime version target: `v1.0.8.42+`

## Summary

The sound files in `assets/sounds` are now exposed to editor/content tooling as first-party sound resource descriptors. The explicitly requested sounds from `new_sound_effects.md` keep curated usage metadata, and any additional `.mp3` files are auto-declared so editor tooling can still find them.

Generated assets:

- one sound resource descriptor for every `.mp3` in `assets/sounds`
- dedicated sound pack manifest: `content/packs/canon.prototype0_sound_effects.json`
- canon manifest `sounds` entries in `content/packs/canon.prototype0.json`

Editor wiring:

- Creator Suite now has an `Install Sounds` button.
- The button installs `canon.prototype0_sound_effects` into browser-local content storage.
- Installed local modules should report the current number of bundled sound descriptors.
- Editor code can import `SOUND_EFFECT_RESOURCE_BUNDLE` or `SOUND_EFFECT_RESOURCES_BY_ID` from `src/editor/soundEffectResourceSet.js`.

## Resource Ids

The generated ids use stable prefixes:

- sound effects: `sound.effect.<filename_without_extension>`
- ambient loops/chains: `sound.ambient.<filename_without_extension>`

Examples:

- `sound.effect.bullet_ricochet_1`
- `sound.effect.harpoon_powerup`
- `sound.effect.ghost_enemy_start`
- `sound.effect.ghost_enemy_defeat`
- `sound.effect.player_mortar_fire`
- `sound.effect.enemy_mortar_fire`
- `sound.effect.laser_scorch_constant`
- `sound.effect.button_chirp`
- `sound.effect.kraken_enter`
- `sound.ambient.ocean_waves_1`
- `sound.ambient.night_forrest_1`
- `sound.ambient.rolling_thunder_1`
- `sound.ambient.storm_wind_1`

## Usage Metadata

Every descriptor has a `usage` object so editors can group and suggest sounds:

- grouped random variants carry `usage.group` and `usage.variant`
- bullet ricochets carry `usage.chance.bulletImpact: 0.25`
- `laser_scorch_constant` carries `usage.loop: true`
- ambient descriptors carry:
  - `usage.ambientChain.minLength: 1`
  - `usage.ambientChain.maxLength: 10`
  - `usage.ambientChain.meanIntervalSoundSetLengthMultiplier: 5`
  - `usage.ambientChain.levelMatchers`
- auto-declared legacy/runtime sounds carry best-effort tags and `usage.events` hints such as `playerMainGun`, `playerBeam`, `stageVictory`, `bossInternalExplosion`, `pirateEnemyBark`, or `krakenEntrance`

## Runtime Wiring

The main game thread maps these asset ids into `SOUND_EVENTS` and live playback hooks:

- `bullet_ricochet_#`: glaive bounce and 25% bullet impact chance
- `buzzard_start_#`: buzzard entrance
- `car_start_#`: wheeled enemy entrance
- `car_skidding_#`: car enemy skid start
- `crash_and_jangle_#`: default construct destruction
- `crash_and_splash_#`: water construct destruction except octopus
- `ghost_enemy_start`: ghost enemy entrance
- `ghost_enemy_defeat`: ghost enemy destruction
- `harpoon_powerup`: harpoon collection
- `inchworm_defeated`: inchworm head destruction
- `inchworm_segment_destroyed`: inchworm segment destruction
- `insect_chittering_#`: inchworm/moth entrance
- `laser_scorch_pulsed_#`: ground laser charge start
- `laser_scorch_constant`: looping ground laser smoke/fire area
- `metal_slash`: glaive construct collision
- `player_mortar_fire`: player mortar launch
- `enemy_mortar_fire`: enemy mortar launch
- `enemy_beam_powerup`: enemy beam charge start
- `power_down_#`: powerup end or enemy beam stop

Ambient groups are ready for zone-aware chain playback:

- `ocean_waves_#`: `DigitizedStream`, `PiratesRoad`
- `night_forrest_#`: `GhostForrestPathway`, `GhostForrestBanshee`
- `rolling_thunder_#`: storm/boss tracks named in the descriptors
- `storm_wind_#`: storm tracks plus Shadowed Desert journeys and Freedoms Pass darkening tracks

## Verification

Passed:

```powershell
npm.cmd test -- tests\soundResources.test.js tests\contentRegistry.test.js
npm.cmd run build
```

# Creator Extension API

This document is the working contract for editor authors, content-pack builders, and future extension developers.

It is descriptive, not a command script. Treat examples here as the architecture target for this repo and for companion editor work.

## North Star

Players and developers should speak the same construction language. Developers may add new simulation verbs in code; once a verb exists, creators should be able to use it through data assets and editors without changing core simulation code.

## Repository Roles

The canonical game repo owns:

- runtime schemas and validators
- pure simulation primitives
- first-party canon content
- small vanilla editor prototypes that emit runtime assets
- in-game editor surfaces that mutate runtime-compatible player assets
- tests proving bundled content is valid

Companion editor repos may own:

- richer UI shells
- asset browsers
- publishing workflows
- collaboration features
- creator account integration
- packaging and import/export flows

Companion repos must not invent private formats for constructs, weapons, patterns, behaviors, encounters, or routes. Their export should be directly consumable by this runtime after validation.

## Content Flow

```text
editor or hand-written JSON
  -> content pack manifest
  -> asset validators
  -> content registry
  -> runtime instantiation
  -> simulation
```

Editors may keep temporary UI state, but exported assets should not require an editor-only conversion pass.

## Content Kinds

Initial content kinds:

- `constructs`: voxel/cell layouts, anchors, explicit connections, metadata
- `weapons`: weapon definitions built from known projectile and beam primitives
- `patterns`: bullet and firing patterns
- `statusEffects`: named effect descriptors for hazards, bullets, weapons, biomes, shields, and future module states
- `enemyArchetypes`: editor-facing enemy model descriptors that bind constructs, patterns, entry behavior, palette, and known runtime factories
- `behaviors`: declarative movement/targeting/state primitives
- `encounters`: enemy groups, spawn timing, route-relative placement
- `routes`: road topology and stage flow
- `levels`: scenario-level coordination of backgrounds, route turns, obstacles, waves, and triggers
- `playerAccount`: player-owned unlock and saved-loadout data, provided by the game account/profile layer

`constructs`, `weapons`, `patterns`, and `levels` are partially implemented today. Other kinds are reserved so file layouts and manifests do not need to be redesigned later.
`enemyArchetypes` is implemented as a descriptor layer in Prototype 0; some enemy runtime behavior is still code-owned until encounter and behavior assets mature.

## Metadata

All assets should allow these fields where practical:

```json
{
  "schemaVersion": "0.1",
  "assetId": "example_asset",
  "author": "creator name",
  "provenance": "short source note",
  "canonStatus": "COMMUNITY",
  "dependencies": [],
  "derivedFrom": [],
  "tags": []
}
```

Valid `canonStatus` values:

- `CANON`
- `EXPERIMENTAL`
- `COMMUNITY`
- `VARIANT`
- `TOTAL_CONVERSION`

Canon status is a designation, not a loading restriction.

## Extension Levels

### Data Packs

Data packs are the first supported extension layer. They contain JSON assets plus optional images/audio. They may combine existing verbs, but they do not add new simulation code.

Examples:

- new enemy constructs
- new encounter lists
- new bullet patterns using existing primitives
- route variants

### Trusted Code Extensions

Trusted code extensions are a later layer. They may register new verbs, validators, runtime factories, or render helpers. They should expose their new verbs to the same data-pack system so editors can discover and use them.

Examples:

- `chain_lightning`
- `teleport`
- `magnetic_adhesion`
- new damage channels
- new propulsion models
- new behavior nodes

Do not add arbitrary community JavaScript execution to Prototype 0.

## Editor Best Practices

Editors should:

- load schemas and allowed primitive names from the runtime or docs generated from runtime constants
- export canonical JSON assets, not editor snapshots
- preserve unknown optional metadata when round-tripping assets
- validate on every meaningful edit
- show errors for impossible assets
- show warnings for legal but weak assets
- avoid mutating simulation modules directly
- include the schema version in every export
- include provenance and derivation metadata when available

Editors should warn about:

- no core cell
- no explicit connections
- disconnected modules
- weapons with no usable power path
- missing dependencies
- unknown schema versions
- use of verbs not available in the current runtime

## Runtime Best Practices

Runtime loaders should:

- reject incompatible major schema versions clearly
- validate all bundled content in tests
- instantiate runtime objects from data rather than sharing mutable definition objects
- keep seeded RNG behavior deterministic where practical
- preserve pure simulation boundaries
- keep Canvas, DOM, and editor concerns out of `src/core`

## Import And Bundle Resolution

Level and scenario imports should resolve dependent content jointly. A level may reference simulation assets such as constructs, weapons, patterns, behaviors, encounters, and routes, and resource assets such as images, voxel models, sound effects, and music.

The runtime should not allow a level to enter a half-installed state. Missing required simulation assets should be hard errors. Missing optional resources, such as voiceover or alternate background art, may be warnings when the level can still run.

This is the target import flow:

```text
select level or pack
  -> validate manifest and root assets
  -> collect explicit and implied dependencies
  -> resolve dependent packs/resources/assets together
  -> register immutable definitions
  -> make playable levels available to the game
```

## Current Construct Contract

Current construct assets live under:

```text
content/constructs/
```

Current runtime entry points:

```text
src/core/constructDefinition.js
src/core/enemy.js
src/editor/constructWorkshop.js
```

A minimal construct:

```json
{
  "schemaVersion": "0.1",
  "assetId": "basic_turret",
  "canonStatus": "CANON",
  "tags": ["enemy"],
  "cells": [
    { "id": "core", "type": "core", "gridX": 0, "gridY": 0 }
  ],
  "connections": [],
  "modules": []
}
```

Grid adjacency is not structural truth. Structural connectivity is defined by explicit connection edges.

Constructs may also include optional `presentation.sprite` metadata for renderer overlays and editor previews. Runtime damage, connectivity, hit checks, and repair continue to use `cells` and `connections`; sprites are presentation only and should always fall back to voxel rendering.

## Current Player Vehicle Contract

The default player vehicle is now a construct asset:

```text
content/constructs/starting_vehicle.json
```

Current runtime entry points:

```text
src/core/playerVehicleEditor.js
src/core/playerAccount.js
src/core/vehicle.js
src/editor/playerVehicleLaunchEditor.js
```

The launch-screen vehicle editor edits a construct definition before deployment. Prototype 0 only allows adding, removing, and connecting equipment types already present in the starter vehicle:

- `armor`
- `gun`
- `wheel`
- `engine`

The editor does not allow adding or removing `core`. Player vehicles must contain exactly one core.

Player/construct definitions may carry per-gun weapon loadouts:

```json
{
  "gunLoadouts": [
    {
      "cellId": "gun",
      "primary": ["main.basic", null],
      "secondary": ["rocket", "cannon", "beam"]
    }
  ]
}
```

Current primary ids are `main.basic`, `tracking_flechette`, `mortar`, `blade_launcher`, `mini_beam`, and `repulsor_beam`. Current secondary ids are `rocket`, `cannon`, `beam`, `tractor_beam`, `sta_missile`, and `orb_of_blades`. Duplicate installed weapons use the square-root stack multiplier exposed by `src/core/weaponLoadout.js`. Secondary ammo capacity uses `ceil((baseCapacity + ammoBonus) * sqrt(N + 1))`, where `N` is the number of mounted copies of that secondary weapon on the player's craft.

Available equipment is read from player account data rather than hard-coded into the editor. Prototype 0 uses local in-memory account data:

```json
{
  "schemaVersion": "0.1",
  "accountId": "local.prototype0",
  "displayName": "Local Pilot",
  "equipment": {
    "armor": { "unlocked": true, "quantity": 14 },
    "gun": { "unlocked": true, "quantity": 3 },
    "wheel": { "unlocked": true, "quantity": 4 },
    "engine": { "unlocked": true, "quantity": 3 }
  },
  "weaponUnlocks": {
    "primary": ["main.basic", "mini_beam"],
    "secondary": ["rocket", "cannon", "beam"]
  },
  "moduleUnlocks": [],
  "modules": {},
  "savedVehicle": null
}
```

A future account service should send and receive this shape or a versioned superset of it. Keep that service outside pure simulation code. The runtime/editor boundary should continue to accept plain account data objects so local play, tests, and future online profiles all feed the same vehicle editor rules.

## Current Weapon Contract

Current weapon assets live under:

```text
content/weapons/
```

Current runtime entry points:

```text
src/core/weaponDefinition.js
src/core/secondaryWeapon.js
src/editor/weaponPatternLab.js
```

A minimal weapon:

```json
{
  "schemaVersion": "0.1",
  "assetId": "rocket",
  "canonStatus": "CANON",
  "tags": ["secondary"],
  "ammo": 12,
  "heat": 28,
  "cooldown": 0.9,
  "projectile": {
    "team": "player",
    "weapon": "rocket",
    "behavior": "homing",
    "projectileSpeed": 130,
    "radius": 3,
    "damage": 36,
    "impulse": 210,
    "lifetime": 5.8,
    "turnRate": 2.5,
    "acceleration": 90,
    "maxSpeed": 130,
    "usesVehicleVelocityOnly": true,
    "targetHint": "aimReticle",
    "destructible": true,
    "shape": {
      "kind": "cylinderCone",
      "armorVoxelHp": 10,
      "bodyLength": 12,
      "coneLength": 5,
      "halfWidth": 3,
      "bodyVoxels": { "columns": 6, "rows": 3 },
      "coneVoxels": { "columns": 3, "rows": 3 }
    },
    "contrail": {
      "emissionMeanPerSevenFrames": 2,
      "maxParticlesPerStep": 5,
      "particleLifetimeFrames": [4, 5],
      "colors": ["#8a8a86", "#1f2020", "#df6f2e"]
    }
  }
}
```

Available projectile behaviors in Prototype 0:

- `ballistic`
- `homing`
- `beam`
- `blast`
- `arc`

Arc projectile fields:

- `verticalVelocity`: initial upward velocity.
- `gravity`: downward acceleration.
- `maxArcHeight`: visual height cap.
- `shadowRadius`: ground tell / landing-shadow size.
- `targetHint`: optional targeting hint such as `aimReticle`.
- `detonateAtTarget`: if true, landing/target arrival triggers blast handling.
- `zCollision`: if true, future z-aware collision should use projectile height.

Pierce fields:

- `pierce`: follow-through voxel hits after the first impact.
- `pierceDamageScale`: fraction of impact damage available to the first pierced voxel.
- `pierceDamageFalloff`: remaining pierce damage multiplier after each voxel.
- `damagePiercesUntilSpent`: if true, the projectile uses its visible radius as a swept hit box and continues through hit voxels until its damage budget is depleted.
- `maxRicochets`: number of times a damage-budget projectile can retarget after leaving enemy contact.
- `ricochetFactor`: remaining damage multiplier applied each time a projectile ricochets.
- `ricochetOnEnemyExit`: if true, a damage-budget projectile marks the enemy it is touching and retargets after it exits contact.
- `projectileDeflectionProbability`: chance that an overlapping enemy shot is converted into a player-owned projectile instead of being destroyed.

Particle beams are width-aware at the voxel layer. Runtime sampling follows the animated beam width, damages the first damageable voxel on each sampled lane, and continues through additional voxels only according to `pierce`. Wide low-pierce beams strip surface area; narrow high-pierce beams drill deeper.

Optional projectile presentation/simulation fields:

- `sprite`: optional image descriptor for drawing the projectile.
- `landingMarkerSprite`: optional image descriptor for arc/telegraph ground markers.
- `destructible`: when true, the projectile has a damageable hull.
- `shape`: currently supports `{ "kind": "cylinderCone" }` for rockets, with body/cone dimensions and voxel grid counts.
- `contrail`: optional short-lived visual particle settings. This is render-facing metadata carried by the projectile definition, not editor UI state.
- `emitsProjectiles`: optional moving-emitter payload, currently used by `orb_of_blades`.
- `detonationBurst`: optional instant radial projectile payload emitted when a player projectile detonates at its target or on impact. It may be a single payload or `{ "groups": [...] }` for concurrent mixed bursts.
- `launchAngleMode`: optional player-weapon launch mode. `orthogonal` starts the projectile perpendicular to the aim direction.
- `launchAngleSpreadRadians`: random launch-angle spread applied to `launchAngleMode`.
- `launchWhenFacingTarget`: if true on a delayed-acceleration projectile, it turns toward its selected target before locking the acceleration vector.
- `tracksReticleInArc`: if true on an arc player weapon, the projectile continuously updates its target point and horizontal velocity from the live aim reticle.
- `absorbsEnemyProjectiles`: if true on a player projectile payload, it destroys overlapping enemy shots and loses damage equal to the absorbed projectile's damage unless the shot is deflected.

Sprite descriptors are render-facing JSON and should not change simulation results. A minimal descriptor:

```json
{
  "assetId": "sprite.weapon.tracking_flechette",
  "path": "assets/images/weapons/tracking_flechette.png",
  "nativeSize": [66, 25],
  "displaySize": [22, 8],
  "anchor": [0.5, 0.5],
  "alignToVelocity": true
}
```

`assetId` is required. `path` or `uri` should resolve to an `image` resource in the active content pack when available. `sourceSheet` may point back to the editable or annotated source art. `anchor`, `nativeSize`, and `displaySize` are two-number arrays. `alignToVelocity` lets the renderer rotate missile, flechette, and blade sprites along the current projectile heading.

Destructible projectile data must still validate through `src/core/weaponDefinition.js`; editors should not emit private rocket-shape fields outside this contract.

Pattern projectiles may also use these delayed-acceleration fields:

- `color`: optional renderer-facing projectile color.
- `absorbsPlayerProjectiles`: if true, the projectile can intercept player bullets and beams while it has absorption HP.
- `absorbHp`: durability pool for absorbing player projectiles.
- `delayBeforeAcceleration`: seconds to coast before selecting the acceleration vector.
- `stopBeforeAcceleration`: if true, velocity is zeroed when the acceleration vector is selected.
- `acceleration`: thrust applied after the delay.
- `accelerationDuration`: duration of the acceleration phase.
- `accelerationSpreadRadians`: random aim offset applied once when the vector is selected.
- `launchWhenFacingTarget`: if true, turn toward the target before accelerating on the locked vector.
- `explodeAfterAcceleration`: if true, the projectile emits `blastOnExpire` after the acceleration window.
- `blastOnExpire`: small blast payload with `radius`, `damage`, and optional `impulse`.
- `contrail.particleRadiusScale`: optional contrail particle-size multiplier.

## Current Pattern Contract

Current pattern assets live under:

```text
content/patterns/
```

Current runtime entry points:

```text
src/core/patternDefinition.js
src/core/game.js
src/editor/weaponPatternLab.js
```

A minimal enemy pattern:

```json
{
  "schemaVersion": "0.1",
  "assetId": "enemy_aimed_shot",
  "canonStatus": "CANON",
  "tags": ["enemy", "aimed"],
  "initialDelay": 0.4,
  "interval": 0.75,
  "emitter": {
    "kind": "aimed",
    "target": "player",
    "count": 1,
    "speed": 105,
    "spreadRadians": 0.12,
    "projectile": {
      "team": "enemy",
      "weapon": "bullet",
      "behavior": "ballistic",
      "radius": 5,
      "damage": 10,
      "impulse": 175,
      "lifetime": 4
    }
  }
}
```

Available pattern emitters in Prototype 0:

- `aimed`
- `radial`
- `sequentialRadial`

`sequentialRadial` fires one spoke per interval and keeps sequence state in the runtime pattern state. It may provide `sequenceRest` to pause after a full ring.

Pattern projectile payloads may also use `behavior: "arc"` with the same `verticalVelocity`, `gravity`, `maxArcHeight`, and `shadowRadius` fields used by weapon projectiles. Enemy arcing shells can use `blastOnExpire` as their landing payload.

## Current Status Effect Contract

Current runtime/editor entry points:

```text
src/core/statusEffects.js
src/core/contentRegistry.js
src/core/localContentLibrary.js
```

A minimal status effect:

```json
{
  "schemaVersion": "0.1",
  "id": "example.acid_splash",
  "type": "acid",
  "intensity": 1.2,
  "duration": 5,
  "materialRules": {
    "metal": 1,
    "ceramic": 0.4,
    "gold": 0
  }
}
```

Current `type` values:

- `fire`
- `acid`
- `frost`
- `ionSurge`
- `shield`
- `refractive`
- `reflective`

Status effects are schema and editor-contract primitives in this prototype. Full runtime simulation for spreading fire, armor erosion, frost/ion failures, shielding, refraction, and reflection is still follow-up work.

## Current Enemy Archetype Contract

Current enemy archetype assets live under:

```text
content/enemies/
```

Current runtime/editor entry points:

```text
src/core/enemyArchetypeDefinition.js
src/core/enemy.js
src/core/game.js
docs/enemy-pattern-editor-handoff.md
```

Enemy archetype packs are descriptor assets. They expose stable enemy ids and editable knobs to companion editors while the current runtime factories continue to own some Prototype 0 behavior.

A minimal archetype pack:

```json
{
  "schemaVersion": "0.1",
  "assetId": "prototype0_enemy_archetypes",
  "canonStatus": "CANON",
  "archetypes": [
    {
      "id": "standard",
      "displayName": "Standard Turret",
      "runtimeFactory": "createEnemy",
      "construct": "basic_turret",
      "patterns": ["enemy_aimed_shot", "enemy_radial_burst"],
      "entry": { "kind": "aheadDrift", "speed": 35 },
      "movementProfiles": [{ "id": "drift", "kind": "drift", "target": "roadCenter", "speed": 35 }],
      "aggregate": { "kind": "singleBody" },
      "cellAnimations": [],
      "editable": ["construct", "patterns", "entry", "palette", "movementProfiles", "aggregate", "cellAnimations"]
    }
  ]
}
```

Current helper API:

```js
validateEnemyArchetypePack(definition)
listEnemyArchetypes(pack, filters)
getEnemyArchetype(id, pack)
editableEnemyKnobs(archetypeOrId, pack)
```

Current `runtimeFactory` values:

- `createEnemy`
- `createEnhancedEnemy`
- `createPirateShipEnemy`
- `createEnhancedPirateShipEnemy`
- `createBossEnemy`

Current `entry.kind` values:

- `aheadDrift`
- `behindCharge`
- `aheadBoss`
- `airStrafe`
- `zoneAmbush`

Current `movementProfiles[].kind` values:

- `drift`
- `charge`
- `returnToView`
- `orbitTarget`
- `strafeBroadside`
- `weave`
- `bossTentacleSwarm`
- `phase`
- `hop`
- `flyStrafe`
- `walkerLegs`
- `circleArtillery`
- `carrierRelease`

Current `aggregate.kind` values:

- `singleBody`
- `limbArray`
- `multiPartBoss`

Current `cellAnimations[].kind` values:

- `none`
- `opacityPulse`
- `sineWave`
- `swirl`
- `fabricWeave`
- `phaseFade`
- `legStride`
- `wingBeat`

Editors should update archetype descriptors when changing enemy art, patterns, palettes, entry behavior, or balance knobs. If a change needs a new simulation verb, add a named runtime primitive and then expose it in this descriptor layer.

## Current Combat Event And Targeting Hook Contract

Current runtime/editor entry point:

```text
src/core/combatEvents.js
```

The public defeat counters are:

```json
{
  "score": {
    "enemyDefeats": {
      "heavy_mortar_boat.pirates_road": 4
    },
    "specialDefeats": {
      "inchwormAllSegmentsFirst": 1,
      "frogDistractedByConstruct": 1,
      "buzzardLandedForScrap": 1
    }
  }
}
```

Editors and runtime enemy behaviors should prefer these stable hook names over one-off local flags. Current special defeat hooks:

- `inchwormAllSegmentsFirst`
- `frogDistractedByConstruct`
- `buzzardLandedForScrap`

Constructs/enemies may expose transient activity flags for other enemies to reason about:

- `distractedByEnemy`
- `distractedByConstruct`
- `collectingScrap`
- `landedForScrap`
- `phasedIn`
- `phasedOut`
- `firingSequence`

Enemy targeting descriptors may use these condition ids:

- `targetIsDistracted`
- `targetIsCollectingScrap`
- `targetIsLandedForScrap`
- `targetIsPhasedIn`
- `targetIsDamaged`

Example thief/jackal-style targeting:

```json
{
  "targeting": {
    "targetTeams": ["player", "construct"],
    "preferConditions": ["targetIsDistracted", "targetIsCollectingScrap"],
    "ignoreConditions": ["targetIsPhasedIn"]
  }
}
```

These hooks are outward-facing architecture. A behavior runner may implement them with utility scoring, hard filters, or state-machine transitions, but exported content should continue to use these names.

`movementProfiles`, `aggregate`, and `cellAnimations` are validated editor-facing descriptors in this prototype. They let editors describe authored movement patterns, multi-part enemies such as the octopus boss, and animateable voxel/module behavior such as transparent fabric-like enemies. Runtime execution of these descriptors should enter through named behavior primitives or a level runner rather than ad hoc editor state.

Prototype 0 boss descriptors may also include `arms.attackMix` entries for standard shots, delayed drifting shots, protective absorbing shots, and laser telegraphs. These are descriptor-facing notes for editors today; the current runtime implementation still lives in `src/core/game.js`.

Boss arm descriptors may also include `arms.beamSource` and `arms.noduleShots` metadata:

```json
{
  "beamSource": {
    "bind": "sourceCell",
    "selector": "type:gun",
    "shutoffWhenDestroyed": true
  },
  "noduleShots": {
    "enabled": true,
    "source": "liveArmGun",
    "chancePerSecond": 0.08
  }
}
```

These fields mirror the current runtime behavior where boss beams are tied to a live source cell and independent arm nodules may fire at the player.

Enhanced enemy palettes can currently be selected from the active level music through:

```text
src/core/levelStyle.js
assets/stylesheets/
```

Terrain texture sheets can also be selected from the active level music/biome name. The current runtime uses bundled image assets named like `assets/stylesheets/terrain__BiomeA_BiomeB__textures.png` and maps each listed biome to the same scrolling sheet in `src/render/canvasRenderer.js`. Editors should treat these as resource-backed level/background layers now, with a future route runner stitching procedural road segments, turns, scenery, and obstacle layers from level `route` data.

Prototype terrain ingest now supports first-class content pack entries for:

- `terrainMaterial`: validated by `src/core/terrainMaterial.js`.
- `terrainTile`: validated by `src/core/terrainTileDefinition.js`.

These assets are data-only for now. They are intended to become the shared content language for procedural road/path generation, semantic material queries, future obstacles/scenery sockets, and biome-specific creator packs.

Runtime road travel is represented by the pure simulation road frame in `src/core/camera.js`: `x`, `y`, `heading`, `speed`, `halfWidth`, and `halfHeight`. Spawn directions such as ahead, behind, left, and right should be expressed relative to that road frame. Discrete road turns are heading changes in 22.5-degree steps up to 90 degrees, so level editors should export turn events in road-frame degrees/radians rather than screen-space directions.

## Current Level Contract

Current level assets live under:

```text
content/levels/
```

Current runtime/editor entry points:

```text
src/core/levelDefinition.js
src/core/contentRegistry.js
src/editor/levelEditor.js
tools/level-editor.html
```

A minimal level:

```json
{
  "schemaVersion": "0.1",
  "assetId": "prototype0_road_trial",
  "canonStatus": "CANON",
  "dependencies": [
    { "kind": "construct", "assetId": "basic_turret" },
    { "kind": "pattern", "assetId": "enemy_aimed_shot" }
  ],
  "background": {
    "mode": "mixed",
    "layers": [
      {
        "id": "road-grid",
        "source": "procedural",
        "generator": "road_grid",
        "parallax": 0.2,
        "seedOffset": 0
      }
    ]
  },
  "route": {
    "startHeading": -1.5707963267948966,
    "segments": [
      { "id": "opening", "length": 480, "turnRadians": 0 }
    ]
  },
  "obstacles": [],
  "waves": [],
  "triggers": []
}
```

Current background modes:

- `procedural`
- `prebaked`
- `mixed`

Current dependency kinds:

- `pack`
- `construct`
- `weapon`
- `pattern`
- `enemyArchetype`
- `behavior`
- `encounter`
- `route`
- `level`
- `terrainMaterial`
- `terrainTile`
- `image`
- `sound`
- `music`
- `voxelModel`

Level triggers currently validate as data only. Runtime event dispatch, voiceover playback, and trigger UX are future work.

The first content registry slice is implemented in `src/core/contentRegistry.js`. It validates pack manifests, registers immutable construct/weapon/pattern/level/resource definitions, lists available content by kind, resolves level dependencies, and refuses to instantiate a level package while required dependencies are missing. It is not a full runtime level runner yet.

For main-game coordination details, see:

```text
docs/level-editor-main-game-handoff.md
docs/editor-runtime-seams.md
```

## Near-Term Implementation Plan

Recommended next runtime architecture cuts:

1. Add a small browser loader that reads bundled pack manifests into `src/core/contentRegistry.js`.
2. Validate every bundled asset in tests.
3. Resolve level dependency bundles before level import/playtest.
4. Route enemy construction through registered construct ids.
5. Persist and reload player account/loadout data through a small adapter around the existing account object shape.
6. Add encounter manifests so new enemies can be playtested without changing `game.js`.

Recommended next editor cuts:

1. Expand Construct Workshop into a construct import/export loop.
2. Add inventory-aware placement and richer attachment feedback to the in-game player vehicle editor.
3. Expand Level Editor controls for background layers, route turns, obstacles, waves, and trigger events.
4. Add a Behavior Composer that emits declarative behavior assets.
5. Add an Encounter Composer that references constructs, behaviors, and patterns by id.

## Non-Goals For Now

Do not build these yet:

- community publishing backend
- accounts
- ratings
- marketplace
- automated mod installation
- live collaboration
- full dependency resolver
- total-conversion launcher

Keep the current work focused on runtime-compatible assets, validation, and editor output discipline.

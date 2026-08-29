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
- `behaviors`: declarative movement/targeting/state primitives
- `encounters`: enemy groups, spawn timing, route-relative placement
- `routes`: road topology and stage flow
- `levels`: scenario-level coordination of backgrounds, route turns, obstacles, waves, and triggers
- `playerAccount`: player-owned unlock and saved-loadout data, provided by the game account/profile layer

`constructs`, `weapons`, `patterns`, and `levels` are partially implemented today. Other kinds are reserved so file layouts and manifests do not need to be redesigned later.

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

Optional projectile presentation/simulation fields:

- `destructible`: when true, the projectile has a damageable hull.
- `shape`: currently supports `{ "kind": "cylinderCone" }` for rockets, with body/cone dimensions and voxel grid counts.
- `contrail`: optional short-lived visual particle settings. This is render-facing metadata carried by the projectile definition, not editor UI state.

Destructible projectile data must still validate through `src/core/weaponDefinition.js`; editors should not emit private rocket-shape fields outside this contract.

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
- `behavior`
- `encounter`
- `route`
- `level`
- `image`
- `sound`
- `music`
- `voxelModel`

Level triggers currently validate as data only. Runtime event dispatch, voiceover playback, and trigger UX are future work.

The first content registry slice is implemented in `src/core/contentRegistry.js`. It validates pack manifests, registers immutable construct/weapon/pattern/level/resource definitions, lists available content by kind, resolves level dependencies, and refuses to instantiate a level package while required dependencies are missing. It is not a full runtime level runner yet.

For main-game coordination details, see:

```text
docs/level-editor-main-game-handoff.md
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

# Level Editor Main Game Handoff

This handoff is for the main game development thread. It describes the level-editor framework now being added here and the game-facing API surface needed so both first-party developers and outside creators can build playable levels from the same modular content language.

## Goal

The level editor should create the same assets the runtime consumes. It should support first-party canon levels, community scenarios, and future campaign/total-conversion content without private editor-only formats.

Levels need to coordinate:

- backgrounds, including procedural layers, prebaked art/video/canvas layers, and mixed stacks
- obstacles and hazards
- enemy waves
- route/travel direction turns
- future crew voiceover and scripted trigger events
- dependencies on constructs, weapons, patterns, behaviors, voxel models, art, sound effects, and music

## Files Added By Editor Thread

Current level framework files:

```text
content/levels/prototype0_road_trial.json
src/core/levelDefinition.js
src/editor/levelEditor.js
tools/level-editor.html
tests/levelDefinition.test.js
```

The level editor is available during local development at:

```text
http://127.0.0.1:5173/tools/level-editor.html
```

## Current Level Asset Shape

Prototype 0 level assets live under:

```text
content/levels/
```

Minimal shape:

```json
{
  "schemaVersion": "0.1",
  "assetId": "prototype0_road_trial",
  "displayName": "Prototype 0 Road Trial",
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
  "waves": [
    {
      "id": "opening-turret",
      "atDistance": 190,
      "spawn": [
        {
          "construct": "basic_turret",
          "count": 1,
          "laneOffset": 0,
          "spacing": 90,
          "patterns": ["enemy_aimed_shot"]
        }
      ]
    }
  ],
  "triggers": []
}
```

## Dependency Model

Levels declare dependencies directly and also imply dependencies through references in waves, obstacles, backgrounds, and triggers.

Current dependency kinds:

```text
pack
construct
weapon
pattern
behavior
encounter
route
level
image
sound
music
voxelModel
```

`src/core/levelDefinition.js` exposes:

```text
validateLevelDefinition(definition)
collectLevelDependencies(definition)
createLevelPackagePlan(definition)
```

The package plan separates dependency kinds into:

- simulation assets: construct, weapon, pattern, behavior, encounter, route, level
- resources: image, sound, music, voxelModel
- packs: pack

This is the beginning of a joint-import model like separate behavior/resource packs: importing a level should identify all dependent simulation and resource content before the runtime allows it to be played.

`src/core/contentRegistry.js` now provides the first pure-runtime registry slice:

```text
createContentRegistry()
validateContentPack(manifest, assetResolver)
loadContentBundle(bundle, options)
registerContentAsset(registry, kind, definition, sourcePack)
getAvailableContent(registry, kind, filters)
resolveContentDependencies(rootAssetRefs, registry)
instantiateLevel(levelId, registry, seed)
```

This is intentionally still a data/validation layer. It does not run route segments, spawn waves, load media, or touch editor UI.

## Main Game API Needed

Please continue building on the pure registry interface now present in `src/core/contentRegistry.js`:

```js
validateContentPack(manifest, assetResolver)
resolveContentDependencies(rootAssetRefs, registry)
loadContentBundle(bundle, options)
registerContentAsset(kind, definition, sourcePack)
getAvailableContent(kind, filters)
instantiateLevel(levelId, registry, seed)
```

The important guarantees:

- a level import either resolves all required dependencies or reports exactly what is missing
- importing a behavior/simulation pack can require resource packs and vice versa
- editors can query available assets by kind without knowing internal runtime module paths
- runtime systems instantiate from immutable definitions and do not mutate asset definitions directly
- external creator content uses the same validators as bundled canon content
- missing optional assets, such as an absent voiceover file, should be warnings when gameplay can continue
- missing required simulation assets, such as an enemy construct referenced by a wave, should be hard errors

## Runtime Integration Needed

The current `game.js` loop still creates level enemies from a count-based progression. The next integration cut should provide a level runner that can:

- advance along route segments and apply `turnRadians` over distance or time
- resolve `waves[].spawn[].construct` to construct definitions
- resolve `waves[].spawn[].patterns` to pattern definitions
- spawn enemies at route-relative `atDistance` and `laneOffset`
- expose background layer data to the renderer without tying the schema to Canvas
- surface trigger events to an event bus or queue
- ignore unknown future trigger kinds with a clear warning unless a level marks them required

Suggested runtime shape:

```js
createLevelRunState(levelDefinition, registry, seed)
stepLevelRun(levelState, game, dt)
consumeLevelEvents(levelState)
```

Keep this separate from editor UI. The editor should only emit JSON and preview it.

## Resource Handling Needed

The editor and runtime need a resource registry that can describe assets without loading everything eagerly:

```json
{
  "kind": "music",
  "assetId": "music.twilight_crossroads",
  "path": "../music/TwilightCrossroads.mp3",
  "mimeType": "audio/mpeg",
  "tags": ["road", "canon"]
}
```

Please reserve manifest support for resource declarations or resource asset lists. Level background layers and trigger events currently use `assetRef` placeholders so the editor can reference future art/audio without inventing another schema.

## Editor Thread Responsibilities

This editor thread will continue to:

- keep the level editor output as runtime JSON
- add UI affordances for route turns, waves, background layers, obstacles, and triggers
- keep docs aligned with schema changes
- add validation tests for new level fields
- avoid backend/community-publishing work

## Main Game Thread Responsibilities

The main game thread should own:

- content registry and import resolution APIs
- level-runner integration with `game.js`
- renderer-facing background/resource interfaces
- resource loading/cache policy
- pack import UX and missing-dependency reporting
- future account/cloud adapter boundaries

## Near-Term Coordination Contract

Before either thread adds a new creator-facing field:

1. Add or update the validator in `src/core/*Definition.js`.
2. Add a sample asset under `content/`.
3. Add tests proving bundled assets validate.
4. Update `docs/creator-extension-api.md`.
5. If the field creates a new dependency, update `collectLevelDependencies`.

Do not add editor-only fields to exported level JSON unless they are namespaced as temporary UI metadata and stripped before runtime import.

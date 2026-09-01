# Content Pack Manifest

Content packs group related assets so the runtime and editors can validate, list, and playtest them consistently.

The manifest format is intentionally small for Prototype 0. It is meant to grow alongside real editor/runtime needs.

## File Location

Bundled pack manifests should live under:

```text
content/packs/
```

Suggested file name:

```text
<packId>.json
```

Example:

```text
content/packs/canon.prototype0.json
```

## Manifest Shape

```json
{
  "schemaVersion": "0.1",
  "packId": "canon.prototype0",
  "displayName": "Prototype 0 Canon Content",
  "author": "Weyfinder prototype",
  "provenance": "Bundled with the canonical game repo.",
  "canonStatus": "CANON",
  "description": "First-party content used by the Prototype 0 play loop.",
  "tags": ["canon", "prototype"],
  "dependencies": [],
  "assets": {
    "constructs": ["../constructs/basic_turret.json", "../constructs/starting_vehicle.json"],
    "weapons": ["../weapons/rocket.json", "../weapons/cannon.json", "../weapons/beam.json"],
    "patterns": ["../patterns/enemy_aimed_shot.json", "../patterns/enemy_radial_burst.json"],
    "statusEffects": ["../status_effects/acid_splash.json"],
    "enemyArchetypes": ["../enemies/prototype0_enemy_archetypes.json"],
    "behaviors": [],
    "encounters": [],
    "routes": [],
    "levels": ["../levels/prototype0_road_trial.json"],
    "terrainMaterials": ["../terrain/materials/ghost_forest_ground.json"],
    "terrainTiles": ["../terrain/tiles/ghost_forest_path_straight.json"]
  }
}
```

## Required Fields

- `schemaVersion`: manifest schema version. Prototype 0 expects `0.x`.
- `packId`: stable unique id for this pack.
- `displayName`: human-readable name.
- `canonStatus`: content designation.
- `assets`: object listing asset paths by kind.

## Optional Fields

- `author`
- `provenance`
- `description`
- `tags`
- `dependencies`
- `derivedFrom`

Tools should preserve optional metadata when possible.

## Asset Paths

Asset paths are relative to the manifest file unless a future loader explicitly supports another URI scheme.

Prototype 0 should prefer local bundled assets and local imported files. Remote dependency resolution is a later concern.

## Pack Validation Rules

Prototype 0 pack validation starts in:

```text
src/core/contentRegistry.js
```

Hard errors:

- manifest is not an object
- incompatible `schemaVersion`
- missing or blank `packId`
- invalid `canonStatus`
- missing `assets`
- asset list is not an array
- an asset path is not a string

Level imports should be resolved jointly with dependencies declared inside the level asset. If a level depends on a construct, pattern, terrain material, terrain tile, behavior, image, music track, or another pack, the importing runtime should load or prompt for the dependent pieces together rather than letting the level enter a half-installed state.

Warnings:

- empty pack
- missing optional attribution metadata
- dependencies declared but unavailable in the current runtime
- asset kind reserved but not implemented by the current runtime

Current manifest asset keys:

- `constructs`
- `weapons`
- `patterns`
- `statusEffects`
- `enemyArchetypes`
- `behaviors`
- `encounters`
- `routes`
- `levels`
- `terrainMaterials`
- `terrainTiles`
- `images`
- `sounds`
- `music`
- `voxelModels`

Resource entries may be paths to resource JSON files or inline descriptors. Image resource descriptors should include an `assetId` and either `path` or `uri`. Weapon and pattern projectile `sprite.assetId` values should match entries in `assets.images` when the image is packaged with the content pack.

Terrain material and tile entries may also be paths or inline descriptors. Levels can refer to a terrain pack with `terrain.packId`, or to explicit material/tile assets through `terrain.materials` and `terrain.tiles`.

## Canon And Community

`CANON` means the pack is part of the canonical repo or an accepted first-party release.

`COMMUNITY`, `VARIANT`, and `TOTAL_CONVERSION` packs should use the same manifest and asset formats. Runtime and editor code should not assume only canon packs are valid.

## Playtest Rule

The ideal playtest flow:

```text
open editor
  -> export content pack
  -> validate pack
  -> load pack in local runtime
  -> choose encounter or route
  -> playtest immediately
```

Do not require hand-coded glue for every new construct or encounter. If new glue is required, it is a sign the schema/registry needs another small primitive.

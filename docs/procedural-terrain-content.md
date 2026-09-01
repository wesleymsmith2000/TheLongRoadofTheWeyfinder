# Procedural Terrain Content

Prototype 0 terrain is world-fixed and data-driven. The runtime generates route tiles first, fills surrounding terrain second, and samples semantic terrain data through `sampleTerrain(worldX, worldY)`.

## Runtime Defaults

Terrain sizing lives in `src/core/terrainConfig.js`:

- chunk size: `512` world pixels
- tile size: `32` world pixels
- semantic subcells: `4x4` per tile
- active stream window: `3x3` chunks plus a small ahead buffer

Do not duplicate these numbers in creator tooling. Import or mirror the config schema deliberately.

## Material Assets

Terrain material JSON lives under `content/terrain/materials/`.

Required fields:

- `schemaVersion`
- `assetId`
- `materialId`
- `physics.traction`
- `physics.rollingResistance`
- `physics.roughness`

Optional system fields include `thermalFlux`, `ignitionRisk`, `conductivity`, and `hazardTags`. These are validated now so later gameplay systems can consume them without changing the asset shape.

## Tile Assets

Terrain tile JSON lives under `content/terrain/tiles/`.

Required fields:

- `schemaVersion`
- `assetId`
- `biome`
- `allowedRotations`
- `sockets.north/east/south/west`
- `semantic.materialGrid`

Socket vocabulary is intentionally small:

- road: `closed`, `standard`, `wide`
- height: `-1`, `0`, `1`, `2`
- fluid: `none` or `open:<channel>`

The runtime rotates sockets and semantic grids for legal `allowedRotations`; creators do not need to duplicate metadata for simple rotated variants.

## Atlas Metadata

The first terrain source sheets live in `assets/images/` and are described by atlas metadata files in `content/resources/terrain/`:

- `atlas.terrain_1_core_ground_sets.json`
- `atlas.terrain_2_paths_edges_transitions.json`

Tile definitions use atlas sprite references in `render.baseAsset`:

```json
"baseAsset": "atlas:terrain.atlas.paths_edges_transitions.v0#ghost_forest.path_straight"
```

The v0.1 renderer crops the referenced source rectangle from the presentation sheet, scales it into the configured terrain tile size, and rotates it according to the tile variant. Gameplay materials still come from `semantic.materialGrid`.

## Level Terrain Field

Levels may declare procedural terrain:

```json
{
  "terrain": {
    "mode": "procedural",
    "packId": "canon.prototype0",
    "seed": 1147
  }
}
```

The first runtime slice uses bundled Ghost Forest terrain content by default. Pack-aware terrain selection is intentionally minimal until the level picker and local-content flow need a richer UI.

## Current Limits

- no global Wave Function Collapse
- no height gameplay yet
- no fluids yet
- no terrain event sockets yet
- no per-biome editor polish yet

The current proof is material sampling: normal path/ground returns baseline traction, and slippery moss lowers vehicle handling through `sampleTerrain()`.

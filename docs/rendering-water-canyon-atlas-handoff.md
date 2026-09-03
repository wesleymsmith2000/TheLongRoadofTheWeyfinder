# Rendering Handoff: Water, Roads, Ravines, and Canyons Atlas Metadata

## Goal

Prepare terrain spritesheets so the runtime can procedurally place multicell roads, rivers, streams, beaches, ocean edges, ravines, and canyons using the same tile/socket system that currently drives road pieces.

## Atlas Metadata Needed

Each atlas frame should have stable IDs rather than relying on sheet position. Suggested IDs:

```json
{
  "assetId": "terrain.tile.ghost_forest.stream_turn_ne",
  "source": "assets/stylesheets/terrain__water_canyons_v0.png",
  "rect": { "x": 96, "y": 32, "width": 32, "height": 32 },
  "nativeSize": [32, 32],
  "allowedRotations": [0, 90, 180, 270],
  "tags": ["stream", "water", "turn"],
  "variantWeight": 1
}
```

Runtime can rotate tiles, so only mark rotations valid when lighting, shadows, flow marks, and cliff faces still read correctly after rotation.

## Tile Definition Fields

Each terrain tile needs edge sockets for all four sides:

```json
{
  "road": "closed|standard|wide",
  "fluid": "none|open:stream|open:river|open:ocean",
  "height": -2|-1|0|1|2,
  "wall": "none|ravine|canyon|cliff",
  "shore": "none|sand|mud|stone"
}
```

The existing schema already supports `road`, `fluid`, and `height`; `wall` and `shore` are recommended next extensions.

## Masks Required

For each visual tile or tile family, please provide masks as separate frames or packed grayscale channels:

- `blendMask`: alpha used to blend road/water/canyon art into the base ground.
- `travelMask`: white where ground is traversable, black where blocked or void.
- `fluidMask`: water coverage, with intensity treated as depth for streams/rivers/ocean shallows.
- `heightMask`: local elevation/depression. Ravine floors should be lower than rims.
- `edgeMask`: shoreline, cliff rim, ravine wall, or road shoulder pixels used for decals and collision affordance.
- `flowMask`: optional 2D direction field for animated water foam/particles.

Keep masks at the same logical tile size as the source art for v0.1, currently `32x32`, with the same gutters/padding as the color atlas.

## Minimum Tile Vocabulary

Roads:
- straight, gentle bend, 90 degree turn, T-junction, cross, end cap, widening/narrowing, wide road center, wide road edge.

Streams and rivers:
- straight, turn, fork, merge, source cap, sink cap, narrow-to-wide transition, bank left/right, bridge/ford placeholder.

Beaches and ocean:
- shore straight, shore corner, inner/outer sand edge, wet sand strip, shallow water, deep water, beach-to-road transition.

Ravines and canyons:
- rim straight, rim corner, wall straight, wall corner, floor, narrow crossing, bridge placeholder, slope/ramp transition.

## Runtime Contract

The renderer should be able to resolve `render.baseAsset` in tile JSON to atlas frames and should not need to infer semantics from pixels. Tile JSON remains the source of truth for traversal, height, material, water, and hazards.

The terrain generator will request pieces by sockets and tags, then choose among weighted variants using seeded RNG. Atlas metadata should therefore include variant tags like `calm`, `fast_flow`, `eroded`, `rocky`, `wide`, and `narrow` only when the runtime can swap them without changing gameplay.

## Notes for Current Road Work

Road turns are now expected to come from a deterministic road route rather than a random camera rotation timer. Future river/ravine paths should follow the same shape: a route/path definition produces semantic sockets, then the renderer picks matching atlas tiles and masks.

# Procedural Terrain Atlas Handoff

Runtime now has metadata stubs for the two new terrain sheets:

- `terrain.atlas.wide_roads_paths.v0` from `assets/images/terrain__wide_roads_and_paths__spritesheet.png`
- `terrain.atlas.environment_landforms_water.v0` from `assets/images/terrain__environment_landforms_and_water__spritesheet.png`

The sheets are viable, but they are presentation atlases at `1448 x 1086`, not clean uniform 32/64px grids. Renderer/editor code should treat their JSON atlas rects as the source of truth.

Renderer thread next needs:

- Explicit `sprite` rects for every road, river, shoreline, ocean, ravine, bridge, and hazard module the generators will consume.
- Optional per-sprite semantic masks using the atlas `semanticMasks` keys: `wet`, `void`, `rough`, `hazardous`, and `height_drop`.
- Assembly tags for wide roads: `edgeContinuity`, `repeatableFill`, `connectors`, `endCap`, and `damaged`.
- Assembly tags for rivers/ravines: `center`, `bank`, `corner`, `bend`, `split`, `crossing`, `gap`, `hazard`, and `bridge`.
- Mask conventions where blue/wet affects fluid and traction, void blocks ground traversal unless bridged, rough lowers traction, hazardous deals terrain damage, and height_drop marks cliff/ravine edges.

The current gameplay renderer can load and resolve these atlases, but terrain tile definitions still reference the older Ghost Forest v0 path sprites until the arbitrary-width road/water/ravine assembler is ready.

# Codex Development Handoff — Procedural Terrain / Road System v0.1
## The Long Road of the Weyfinder

### Goal

Replace the current repeated biome-texture backdrop with a **world-fixed, data-driven procedural terrain system** that:

- constructs a continuous road/path through terrain,
- streams chunks around the player,
- renders efficiently through the existing rotating camera,
- exposes terrain materials to physics/game systems,
- later supports height, fluids, animation, hazards, and event sockets,
- uses normal runtime content definitions so community creators can extend it.

Core rules:

> **World coordinates are authoritative. Camera rotation creates the apparent change in travel direction.**

> **Generate the route first. Fill the terrain around it second.**

> **Visual terrain and semantic gameplay terrain may use different resolutions.**

---

# 1. Existing Integration Points

Build on, do not replace, the current architecture.

Likely existing seams:

```text
src/core/camera.js
src/core/levelDefinition.js
src/core/contentRegistry.js
src/render/canvasRenderer.js
src/editor/levelEditor.js
tools/level-editor.html
content/levels/
```

Current useful behavior already includes:
- road world position/heading/speed,
- road-relative/world coordinate transforms,
- smooth camera rotation toward road heading,
- level route segments with length/turnRadians,
- procedural/mixed background definitions,
- obstacles/waves/triggers,
- temporary repeating biome texture rendering.

Do not introduce a second screen-space scrolling/rotation model.

Terrain exists in stable world coordinates and is drawn inside the same camera transform as gameplay entities.

---

# 2. Architecture Decision

Use **square world chunks + smaller square logical tiles/subcells** for v0.1.

Google's proposed prototype defaults:

```text
chunk:            512 × 512 world/render px
logical tile:      32 × 32
semantic subgrid:   4 × 4 per tile
```

Treat these as configurable prototype defaults, not permanent constants.

Centralize them in one terrain config/schema.

Do not scatter `512`, `32`, or `4` through runtime code.

---

# 3. Core Data Separation

Terrain has three concerns:

```text
PROCEDURAL
edge/socket compatibility
weights/tags/rotation

VISUAL
sprite/atlas/static layer/animated overlays

SEMANTIC
material/height/fluid/hazard information
```

Do not make Canvas pixels authoritative for gameplay.

---

# 4. Suggested New Modules

Use names that fit the repo, but roughly separate:

```text
src/core/
  terrainMaterial.js
  terrainTileDefinition.js
  terrainGrid.js
  terrainGenerator.js
  terrainQuery.js
  terrainStreaming.js

src/render/
  terrainRenderer.js
```

If a smaller number of modules fits current project style better, merge responsibly.

Avoid a large generic terrain framework.

---

# 5. Terrain Material v0.1

Create a versioned data definition.

Conceptual example:

```json
{
  "schemaVersion": "0.1",
  "materialId": "ghost_forest.path",
  "physics": {
    "traction": 1.0,
    "rollingResistance": 0.05,
    "roughness": 0.1
  },
  "systems": {
    "thermalFlux": 0,
    "ignitionRisk": 0,
    "conductivity": 0.1
  },
  "hazardTags": []
}
```

Do not wire every field into gameplay immediately.

Phase 2 only needs enough to prove:
- normal ground,
- low-traction ground.

Keep schema extensible for:
- thermal flux,
- conductivity,
- fluid effects,
- corrosion/biological tags later.

---

# 6. Terrain Tile Definition v0.1

Use the same data in editor and runtime.

Conceptual shape:

```json
{
  "schemaVersion": "0.1",
  "assetId": "ghost_forest.path_turn_01",
  "biome": "ghost_forest",

  "allowedRotations": [0, 90, 180, 270],

  "sockets": {
    "north": { "road": "standard", "height": 0, "fluid": "none" },
    "east":  { "road": "standard", "height": 0, "fluid": "none" },
    "south": { "road": "closed",   "height": 0, "fluid": "none" },
    "west":  { "road": "closed",   "height": 0, "fluid": "none" }
  },

  "render": {
    "baseAsset": "ghost_forest_atlas:path_turn_01",
    "animatedLayers": []
  },

  "semantic": {
    "materialGrid": [],
    "heightGrid": [],
    "fluidGrid": []
  },

  "decorSockets": [],
  "eventSockets": [],
  "intrinsicHazards": [],

  "tags": ["road", "turn"],
  "weight": 1
}
```

This is intentionally illustrative, not frozen schema.

Validators should reject malformed data clearly.

---

# 7. Socket Vocabulary

Keep v0.1 small.

Road:

```text
closed
standard
wide
```

Height:

```text
0
1
2
-1
```

Fluid:

```text
none
open:<fluid-channel>
```

Do not encode decorative variation as socket state.

Road width/position must be standardized enough that matching edges visually connect.

Rotate sockets/masks in code when legal rotations are used rather than authoring duplicate metadata.

---

# 8. Generation Pipeline

Implement deterministic, topology-first generation.

Conceptual pipeline:

```text
seed + biome + route segments
          ↓
1. resolve route centerline / path intent
          ↓
2. mark required road crossings in world tile grid
          ↓
3. choose compatible road tiles
          ↓
4. fill neighboring non-road terrain
          ↓
5. choose decor/hazard/event sockets
          ↓
6. build semantic query fields
          ↓
7. cache static visual chunk
```

Do not start with global Wave Function Collapse.

Use a simple local socket/filter/weighted-choice solver.

Required properties:
- seeded deterministic RNG,
- debuggable candidate lists,
- bounded retry count,
- deterministic fallback.

### Fallback

Road continuity must never fail because a decorative asset is missing.

If no authored road tile matches:
- use a safe procedural/plain road fallback,
- log/debug the missing socket combination,
- continue generation.

The fallback should be ugly but valid.

---

# 9. Route Integration

The current level schema already contains:

```text
route.startHeading
route.segments[].length
route.segments[].turnRadians
```

Use that route intent as the source of truth initially.

Do not make terrain tiles drive camera turning independently.

Route/path first:
- resolve path through world grid,
- choose road tile shapes supporting it,
- place surroundings afterward.

Later the route generator can become more topology-rich without changing the terrain query/render model.

---

# 10. World / Camera Model

Terrain chunks are world-fixed.

Renderer should:
- obtain active/visible chunks,
- draw them through the same world camera transform used by other world objects,
- never manually rotate stored chunk coordinates when road heading changes.

Avoid double-applying camera transforms.

Prefer one integration path such as:

```text
canvasRenderer
  establishes world transform
    terrainRenderer.drawWorld(...)
    entity rendering...
```

rather than `terrainRenderer` independently reproducing a second camera transform if the current renderer already owns it.

This is an important correction to the illustrative Google pseudocode: integrate with existing transform ownership instead of blindly nesting another rotate/translate pass.

---

# 11. Static Chunk Rendering

When a chunk is generated/loaded:

1. assemble its static terrain,
2. render static ground/detail/height-rim layers once to an offscreen canvas,
3. cache it,
4. blit the cached result during normal rendering.

Animated overlays and dynamic scenery are drawn separately.

Benchmark:
- generation cost,
- cache creation cost,
- draw cost during camera rotation,
- memory per cached chunk.

Do not prematurely migrate to WebGL.

---

# 12. Streaming v0.1

Prototype around a camera-centered chunk window.

Google proposed:

```text
3 × 3 active chunk neighborhood
generate ~2 chunks ahead
```

Use this only as a starting configuration.

Prefer a coordinate-based chunk map:

```text
chunkKey = `${chunkX},${chunkY}`
```

Each chunk should be reproducible from:
- world seed,
- biome/route state,
- chunk coordinate.

Retiring a chunk should release render/cache resources without losing deterministic reconstruction.

Avoid saving giant per-chunk histories if seed + compact resolved route state can reproduce them.

---

# 13. Terrain Query API

Create an authoritative world-point query.

Conceptually:

```js
sampleTerrain(worldX, worldY)
```

Return a safe normalized result:

```js
{
  materialId,
  traction,
  rollingResistance,
  roughness,
  height,
  fluidType,
  fluidDepth,
  thermalFlux,
  ignitionRisk,
  conductivity,
  hazardTags
}
```

Missing/unloaded terrain must return explicit safe defaults or a documented lazy-resolution path.

Never return `undefined` terrain physics.

Correctly support:
- negative world coordinates,
- tile boundaries,
- chunk boundaries,
- rotated tile definitions,
- subcell lookup.

---

# 14. Vehicle Contact Sampling

Stage this.

## Phase 2 prototype
Sample:
- vehicle center,
or
- a small fixed set of chassis/contact points.

## Later
Use surviving propulsion/contact components:

```text
wheel
tread
leg
ski
hover contact logic
```

Aggregate terrain response by contact.

This enables a craft to straddle:
- ice + stone,
- road + mud,
- dock + water,
- lava rim + safe ground.

Do not block the v0.1 terrain system on full propulsion-aware contact modeling.

---

# 15. Material Gameplay v0.1

First proof:

```text
normal ground traction = baseline
ice/wet/slippery tile = lower traction
```

Expose a debug overlay showing material IDs/subcells under/around the player.

Acceptance:
- entering slippery terrain visibly changes handling,
- leaving it restores handling,
- effect comes from `sampleTerrain()`, not biome-name conditionals.

No hard-coded:

```js
if (biome === "snow") ...
```

---

# 16. Height v0.1

After materials work, add a low-resolution stepped height field.

Use small discrete values first.

Terrain query returns height.

First gameplay behavior:
- detect crossing between adjacent samples/cells,
- if delta exceeds vehicle clearance/allowed step, treat edge as blocked/collision.

First visual behavior:
- top surface remains on world XY,
- renderer adds pseudo-voxel side/rim depth consistently.

Do not implement true 3D body physics.

Do not assume Google's exact `renderY = worldY - z` equation is sufficient under the current camera; integrate height projection with the established pseudo-2.5D rendering conventions.

---

# 17. Fluids v0.1

Treat fluid as separate from base ground.

A terrain definition may provide:
- depression/height,
- fluid type,
- fluid depth,
- fluid-connectivity/socket data,
- animated visual overlay.

First tests:
- shallow water OR lava trough,
- not both at once unless trivial.

Fluid semantic data must be queryable independently of visual animation.

Later:
- water drag/buoyancy,
- lava thermal flux/ignition,
- conductive data-water,
- etc.

---

# 18. Animation

Static chunk cache should remain unchanged.

Animated terrain should use:
- shared animation clock,
- small atlas loops,
- scrolling textures,
- localized overlay sprites,
- particles where appropriate.

Only draw/update animated overlays for visible/near-visible chunks.

Do not create an animation timer per tile.

Animation should be deterministic enough that recycling/reloading a chunk does not create distracting random phase pops unless desired.

---

# 19. Trigger / Event Sockets

Keep three ideas separate:

### Terrain material
Passive sampled property.

### Intrinsic terrain hazard
Behavior owned by the terrain asset.
Example:
- periodic geyser,
- electrified puddle.

### Event socket
A legal candidate point for level/director content.
Example:
- ambush spawn,
- landmark,
- shrine,
- boss arena cue.

Use existing level wave/trigger concepts where possible.

A tile containing `ambush_socket` does not automatically spawn enemies.

---

# 20. Content Registry / Level Schema

Extend existing registries/schemas rather than inventing a parallel content loader.

Likely additions:

```text
terrain materials
terrain tile definitions
terrain/biome pack definitions
```

Level background/terrain config should reference a biome/terrain pack and seed/options rather than embedding large generated arrays in the level JSON.

Example direction:

```json
{
  "terrain": {
    "mode": "procedural",
    "packId": "ghost_forest.v0",
    "seed": 12345
  }
}
```

Exact integration should follow current `levelDefinition.js` conventions.

---

# 21. Debug Tools

Add cheap debug modes early:

```text
chunk bounds
tile bounds
road sockets
chosen tile IDs
material subgrid
height values
fluid cells
event/decor sockets
generation seed / chunk coords
```

Remote/Codespaces development benefits heavily from visible diagnostics.

A solver failure should log:
- chunk coordinate,
- tile coordinate,
- required sockets,
- candidate count,
- fallback used.

---

# 22. Implementation Phases

## Phase 0 — schema + tests
- configurable terrain constants
- material definition + validator
- tile definition + validator
- one tiny Ghost Forest tileset
- no renderer rewrite yet

Stop/report.

## Phase 1 — static generation/rendering
- deterministic chunk/grid
- route projected into tiles
- straight + turn support
- simple socket matching
- deterministic fallback
- offscreen static chunk cache
- integrate with current rotating camera
- debug chunk/tile overlay

Acceptance:
- road continues through multiple chunks,
- camera can turn without terrain moving in memory,
- no gaps at legal seams.

Stop/report.

## Phase 2 — semantic materials
- `sampleTerrain(worldX, worldY)`
- material subgrid
- normal + slippery material
- vehicle reads terrain traction
- material debug overlay

Stop/report.

## Phase 3 — height
- stepped height grid
- height query
- simple blocked ledge/step rule
- pseudo-height rendering
- height overlay

Stop/report.

## Phase 4 — fluid/system effects
- one fluid type
- depth query
- water drag OR lava thermal effect
- fluid overlay/debug

Stop/report.

## Phase 5 — animation
- shared clock
- one animated fluid/data/mist overlay
- visible-only rendering
- benchmark cache behavior

Stop/report.

## Phase 6 — event sockets
- place/query sockets
- integrate one existing trigger/wave action
- one-shot trigger test

Stop/report.

## Phase 7 — first complete biome pack
- broaden Ghost Forest vocabulary
- varied procedural generation
- seam/readability benchmark
- document authoring format.

Do NOT implement all phases in one Codex pass.

---

# 23. Tests

Add automated tests where practical.

## Generation
- same seed -> same tile IDs
- road does not terminate accidentally
- required edge sockets match
- invalid asset reference fails clearly
- no-solution case uses deterministic fallback

## Coordinates/query
- world -> chunk/tile/subcell correct
- negative coordinates correct
- exact boundaries correct
- rotation maps material masks correctly
- safe unloaded query behavior

## Streaming
- retired/regenerated chunk resolves identically
- active chunk count remains bounded
- cache resources released/reused

## Materials
- slippery material lowers traction
- normal terrain restores it

## Height
- compatible edges agree
- excessive step blocks movement

## Fluids
- fluid depth/type correct at boundaries

## Triggers
- rotated/local socket resolves correct world position
- one-shot trigger fires once
- event socket does not behave as intrinsic hazard.

---

# 24. Non-Goals

Do not add yet:

- full Wave Function Collapse,
- WebGL/Three.js rewrite,
- true 3D terrain physics,
- per-pixel terrain simulation,
- huge tile libraries,
- full procedural route graph overhaul,
- all biomes,
- complex bridges/waterfalls,
- community publishing backend,
- editor polish.

The first objective is:

> **A deterministic Ghost Forest road can generate ahead of the player, remain stable while the camera turns, render cheaply, and tell the vehicle when it is standing on slippery ground.**

---

# 25. Completion Report Per Phase

Report:

1. files changed,
2. schemas introduced/changed,
3. run/test commands,
4. debug controls,
5. performance observations,
6. acceptance criteria passed,
7. known limitations,
8. next smallest phase.

North star:

> **One terrain grammar, many biome packs. Route first, surroundings second. World coordinates stay authoritative.**

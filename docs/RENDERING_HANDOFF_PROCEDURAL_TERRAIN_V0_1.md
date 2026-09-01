# Rendering / Art Handoff — Procedural Terrain Tiles v0.1
## The Long Road of the Weyfinder

### Purpose

Create the first reusable art kit for a procedurally generated road + surrounding terrain system.

The runtime will use **world-fixed square terrain pieces** viewed through the existing rotating camera. Art should therefore tile cleanly in world space; the renderer/camera will create the apparent turns and scrolling.

Core visual rule:

> **Terrain establishes place, height, and motion without competing with bullets, enemies, pickups, vehicle silhouettes, or shadows.**

---

## First Test Biome

Use **Ghost Forest Pathway** as the first sandbox.

Why:
- dark, readable base values,
- clear contrast between road / moss / water / spectral accents,
- easy to test subtle height,
- supports static terrain + mist + ghost light + puddle/water animation,
- difficult enough to expose seam/readability problems without requiring lava/complex heat effects immediately.

After the pipeline works, adapt the same grammar to:
- Shadowed Desert
- Pirate's Road
- Freedom's Pass
- Digitized Stream
- other road families

Do **not** create a biome-specific tiling system. Build one reusable tile language.

---

# 1. Provisional Geometry

Initial technical defaults proposed by the terrain architecture:

```text
Macro render chunk: 512 × 512 px
Logical tile:       32 × 32 px
Semantic subgrid:    4 × 4 per tile
```

These are **prototype targets, not permanent art law**. Keep source art organized so tile/chunk size can be changed after runtime benchmarking.

Square tiles are preferred over hexes for v0.1 because they:
- fit the pseudo-voxel orthogonal visual language,
- simplify atlases and rotation,
- simplify community authoring,
- align well with Canvas caching and semantic masks.

The path can still curve/diagonalize visually inside a square tile.

---

# 2. Minimum Ghost Forest Test Set

Do not produce a huge biome atlas yet.

Create a small, complete test vocabulary:

## Base ground
- neutral forest floor A/B/C
- mossy ground
- worn/path ground
- damp stone
- subtle root variation

## Road/path pieces
- straight
- gentle visual straight variation
- 90° turn left
- 90° turn right
- diagonal-feeling bend / softened turn
- T-junction
- cross/intersection
- wide pad
- end/broken path
- path-to-neutral transition

Runtime may rotate legal pieces; do not paint every rotation if a rotated asset remains visually valid.

## Terrain boundaries / height
- low raised edge
- high cliff/ledge edge
- inside corner
- outside corner
- step/ramp test
- shallow depression / trough test

## Fluid / wet areas
- shallow puddle
- water edge
- water corner
- trough/depression containing water
- animated water overlay strip/frame

## Decor
- small root cluster
- dead/bone-white tree
- rock cluster
- spirit lantern
- spectral growth/light
- fallen trunk
- shrine/gate marker

Decor should be separate sprites where possible rather than permanently baked into every ground tile.

---

# 3. Layering Model

Author terrain as separable visual layers.

```text
STATIC BASE
  ground / road / rock / moss

STATIC HEIGHT DETAIL
  rims / ledge sides / retaining edges

STATIC DETAIL
  cracks / roots / debris / stains

ANIMATED OVERLAY
  water / spectral flow / glow / mist vent

DYNAMIC SCENERY
  lantern pulse / hazard / moving prop / particles
```

The runtime intends to cache static chunk art to an offscreen canvas.

Therefore:

> **Animated art must not require the entire terrain chunk to be redrawn from source every frame.**

Prefer:
- small looping sprite sequences,
- repeatable scrolling strips,
- additive/translucent overlays,
- localized effect sprites,
- particle-emitter references.

---

# 4. Tile Edge / Socket Art Rules

Every tile used by the procedural solver needs visually compatible edges.

Keep a simple authoring vocabulary.

For each edge, think in terms of:

```text
ROAD:     closed / narrow / standard / wide
HEIGHT:   flat / raised / cliff
FLUID:    none / enters-exits
SURFACE:  compatible terrain family
```

Do not create dozens of decorative edge categories.

The runtime should solve a small structural vocabulary; variation should come from interchangeable textures/decor, not an exploding number of edge types.

Road/path openings should use consistent center positions and widths.

Fluid openings should use consistent edge positions/depths so water/lava/data-flow overlays can connect.

Height edges need predictable rim placement.

---

# 5. Height / Pseudo-3D Art

This is not true 3D terrain.

We need readable pseudo-voxel height cues.

Provide:

1. **top/surface art**
2. **separable or consistently aligned side/rim art**
3. optional shadow/ambient-contact treatment

Avoid baking perspective so strongly that rotating the tile 90° looks wrong.

The initial runtime may use stepped height values rather than continuous slopes.

Useful v0.1 height states:

```text
0 = base ground
1 = low raised surface
2 = high ledge / cliff
-1 = shallow trough
```

Exact numerical interpretation belongs to runtime; art only needs clear visual families.

Important:
- side faces must not obscure projectile silhouettes,
- dark terrain must still allow visible vehicle shadows,
- raised geometry should read without becoming a giant contrast wall.

---

# 6. Semantic Material Masks

Visible art and gameplay material resolution are separate.

For each test tile, provide or author a low-resolution semantic mask matching the agreed subgrid.

Example 4×4 semantic mask:

```text
G G G G
G R R G
G R I I
G G I I
```

Where:
- `G` = normal ground
- `R` = road
- `I` = ice/wet/slippery material

For Ghost Forest v0.1 likely materials:

```text
forest_ground
path
damp_stone
shallow_water
mud_or_moss
```

The art pipeline should eventually support additional masks/fields for:

```text
height
fluid occupancy/depth
```

Do NOT encode gameplay behavior through pixel color values in the visible sprite.

The semantic mask is explicit metadata.

---

# 7. Fluids

Treat fluids as a reusable layer:

```text
terrain/depression geometry
+
fluid semantic mask/depth
+
animated fluid surface
```

This allows the same conceptual geometry to hold:
- water,
- lava,
- corruption,
- data-flow,
- other future fluids.

For the Ghost Forest test:
- make one shallow pool/trough,
- one connecting water edge,
- one animated surface treatment.

Do not make the fluid animation depend on a unique full-size background movie.

---

# 8. Animation Requirements

Animation should be subtle and cheap.

Initial test effects:

### Water
- gentle directional flow or lapping
- small loop or scrolling texture

### Spectral light
- slow pulse
- no rapid flashing

### Mist
- sparse localized overlay/particle source

Use a shared/global animation phase where possible so many tiles can reuse one sequence.

Provide:
- frame dimensions,
- frame count,
- intended FPS or cycle length,
- whether sequence loops,
- intended blend/opacity behavior.

---

# 9. Decor & Event Sockets

Terrain art should leave intentional places where runtime content can be placed.

Examples:

```text
decor.light
decor.tree
decor.rock
decor.ruin
event.ambush
event.hazard
event.landmark
```

These sockets are metadata/local coordinates, not necessarily painted markers.

Important distinction:

> A terrain tile may provide a legal ambush location without deciding that an ambush always occurs there.

Similarly, a mist vent may be intrinsic scenery/hazard if the tile definition says so.

---

# 10. Atlas / Naming Expectations

Prefer atlas-friendly assets and deterministic names.

Suggested naming:

```text
ghost_forest_ground_01
ghost_forest_ground_02
ghost_forest_path_straight_01
ghost_forest_path_turn_01
ghost_forest_path_t_01
ghost_forest_cliff_edge_01
ghost_forest_water_edge_01
ghost_forest_water_overlay_01
ghost_forest_decor_lantern_01
```

Avoid names based only on atlas coordinates.

Provide a manifest/table that maps:
- asset ID
- atlas rectangle
- legal rotations
- edge/socket type
- semantic mask reference
- height-mask reference
- animated overlay reference
- tags/weight if needed

---

# 11. Readability / Seam Tests

Before expanding the tileset, verify:

### Seam test
Place random legal tiles in a large grid and inspect:
- no visible cracks,
- no mismatched road widths,
- no broken water edges,
- no obvious repeated hard seams.

### Rotation test
Rotate legal pieces 90/180/270° and ensure:
- lighting does not look impossible,
- pseudo-depth still reads,
- details are not strongly direction-locked unless intentionally tagged.

### Bullet-hell test
Overlay:
- orange/red enemy projectiles,
- cyan/blue player elements,
- pickups,
- vehicle shadow,
- enemy silhouettes.

Terrain must recede visually.

### Motion test
Rotate/scroll the camera over the assembled terrain.
Static chunks should look like one world rather than sliding wallpaper panels.

---

# 12. What NOT to Produce Yet

Do not spend time yet on:

- full biome atlas,
- every road permutation,
- elaborate four-way intersections,
- true 3D meshes,
- per-pixel height maps,
- high-frame-count terrain animation,
- huge unique background paintings,
- biome-specific bespoke tile dimensions,
- boss arenas,
- all hazard art.

We first need a **small Ghost Forest kit that proves the pipeline**.

---

# Deliverable

Produce a first-pass art package containing:

1. static Ghost Forest base/path tiles,
2. minimal road socket set,
3. a few height/ledge pieces,
4. one shallow fluid system,
5. a few separate decor sprites,
6. one or two animated overlays,
7. semantic material masks,
8. height/fluid masks if agreed,
9. atlas + manifest,
10. one assembled gameplay mockup demonstrating readability.

North star:

> **Subtle, modular, readable terrain that feels voxel-built while remaining cheap enough to stream and remix procedurally.**

# Mesh Import, Materials, Rigging, And Animation Runtime Handoff

Date: 2026-09-16

Editor checkpoint: `v1.0.9.0`

This handoff separates editor conversion work from the engine work needed to turn standard DCC exports into textured, animated cell constructs. The intended canonical interchange format is glTF 2.0, with self-contained `.glb` files preferred. OBJ and STL remain useful geometry-only inputs.

## Editor Work Available Now

The existing pure conversion module remains:

```text
src/editor/meshVoxelizer.js
```

The Pages-compatible UI remains:

```text
tools/mesh-voxelizer.html
src/editor/meshVoxelizerTool.js
```

The voxelizer now supports three fill modes:

- `surfaceOnly`: emit only sampled mesh-surface cells.
- `nearestSurface`: detect enclosed cells and propagate the nearest sampled surface cell type inward.
- `defaultType`: detect enclosed cells and assign every interior cell the selected default type.

The selectable default types are `armor`, `engine`, `gun`, `utility`, and `wheel`. A single generated core still replaces the occupied cell nearest the mesh centroid.

Enclosed space is found by flooding empty cells from outside a padded surface-cell bounding box. Empty cells the exterior flood cannot reach are interior. Open meshes and shells that leak at the selected sampling resolution therefore remain unfilled.

Nearest-surface propagation is deterministic and uses six-direction grid distance. When two or more source cell types reach a cell at the same distance, the selected default type wins. The same default resolves a sampled surface cell touched by triangles with conflicting type assignments.

Parsed mesh data may supply:

```js
mesh.triangleCellTypes[triangleIndex]
```

or the caller may pass `options.triangleCellTypes`. This is the editor seam a future glTF material/node mapping pass should use. OBJ and STL currently have no semantic cell-type mapping, so their triangles default to armor.

Generated construct metadata records:

```json
{
  "voxelizer": {
    "fillMode": "nearestSurface",
    "defaultCellType": "armor",
    "surfaceCells": 184,
    "interiorCells": 96
  }
}
```

Generated surface and fill cells use roles `meshSurface` and `meshInterior`. The core retains role `core`.

No engine change is required merely to instantiate these filled constructs: they remain ordinary cells with explicit structural connections. The work below is for richer source appearance, rigs, and animation.

## Recommended Ownership Split

Keep these contracts in the main game repo:

- construct, material, image-resource, pose-rig, and animation schemas
- validation and normalization
- Canvas renderer support
- runtime animation evaluation
- pack dependency loading
- the lightweight Pages UI

Move or package these conversion concerns independently once dependencies are introduced:

- glTF/GLB parsing and buffer decoding
- image decoding and atlas baking
- source-triangle spatial indexing
- barycentric UV, normal, material, and skin-weight sampling
- DCC coordinate-system conversion
- optional future FBX or Collada adapters

The converter must emit the same versioned content JSON consumed by the main runtime. It must not become a second gameplay schema.

## Canonical Import Target

Prioritize formats in this order:

1. `.glb`, including embedded buffers and images.
2. `.gltf` plus explicitly selected `.bin` and image dependencies.
3. Existing OBJ and ASCII/binary STL geometry-only paths.

Do not make FBX a first milestone. Blender, Blockbench, Maya, and 3ds Max can export glTF through standard or established export paths, and glTF already carries the required materials, UVs, nodes, skins, and animation clips.

The parser should produce a DOM-free intermediate model containing nodes, primitives, triangle indices, `POSITION`, `NORMAL`, `TEXCOORD_0`, optional vertex colors, material slots, `JOINTS_0`, `WEIGHTS_0`, skins, inverse-bind matrices, images, and animation samplers/channels.

## Proposed Cell Surface Contract

The converter should map each exposed generated cell face to the nearest source triangle. Barycentric interpolation on that triangle supplies UVs, normals, material assignment, and skin weights.

Proposed editor/runtime shape:

```json
{
  "id": "meshSurface_x0_y0_z2",
  "type": "armor",
  "gridX": 0,
  "gridY": 0,
  "gridZ": 2,
  "role": "meshSurface",
  "render": {
    "surfaces": {
      "top": {
        "materialId": "material.imported.body_paint",
        "normal": [0.12, -0.18, 0.98],
        "uvOrigin": [0.31, 0.42],
        "uvStepX": [0.015, 0.002],
        "uvStepY": [-0.001, 0.014]
      }
    }
  }
}
```

Use semantic face keys such as `top`, `bottom`, `left`, `right`, `front`, and `back`. A microvoxel UV can be derived without storing sixteen independent coordinates:

```text
uv = uvOrigin + localVoxelX * uvStepX + localVoxelY * uvStepY
```

An optional compact per-microvoxel override may be added later for material seams or cells where one affine projection is insufficient. Avoid requiring the source mesh at runtime.

Interior cells created by fill do not need source UV mappings by default. In `nearestSurface` mode they may inherit the nearest surface material id for destruction/exposure fallback. In `defaultType` mode they should use the normal material fallback for their selected cell type. This gives default-filled constructs the intended hard, uniform interior.

## Engine Material And Texture Work

Extend `src/core/renderMaterial.js` and construct validation to normalize and validate `render.surfaces` while preserving the existing cell-level material fallback.

Resolve imported glTF PBR fields into material assets:

- base color factor and base-color texture
- metallic and roughness factors
- emissive factor and texture
- alpha mode and cutoff
- double-sided state
- normal texture metadata when supported
- occlusion as a later enhancement

Finish atlas resource metadata and actual texture sampling. `atlasAssetId` is currently preserved, but the Canvas renderer still renders procedural/color material output rather than UV-addressed atlas pixels.

Recommended Canvas path:

1. Load dependency images through the content registry.
2. Resolve each surface material and atlas region once.
3. Bake/cache a tiny cell surface sprite or sampled 4x4 color array.
4. Multiply cached texture color by dynamic lighting, imported normals, damage state, fluorescence, phosphorescence, and emissive response.
5. Invalidate only when relevant material, lighting mode, pose orientation, or voxel damage changes.

Avoid per-frame `getImageData` calls. Imported pack images must remain local/bundled resources so Canvas does not become origin-tainted.

## Rig And Skin Work

Map source nodes and bones into the existing `poseRig` contract:

- source nodes become groups where appropriate
- bone hierarchy becomes joint parent links
- bind transforms become pivots and rest transforms
- rigid node pieces receive one joint influence at weight `1.0`
- skinned cells aggregate weights from their nearest sampled triangles
- retain the strongest two influences and normalize them, matching current runtime limits
- preserve source node, joint, and clip names in `poseRig.imports`

Weighted import should remain an explicit experimental option until mapping is visually inspectable. Rigid hierarchy import is the safer default.

## Animation Runtime Work

The current `oscillate`, `poseCycle`, and `aimAtTarget` primitives cannot faithfully represent arbitrary glTF clips. Add a data-only animation-clip contract with:

- clip id, display name, duration, and loop policy
- per-joint translation tracks
- per-joint rotation tracks
- optional scale tracks
- keyframe times and values
- `STEP` and `LINEAR` interpolation first; cubic spline later
- explicit playback driver and speed

glTF rotations are quaternions. The runtime must either add full 3D joint transforms and project them into the 2.5D renderer, or define and validate a deliberate import-plane flattening mode. Silent axis loss will make standard animations difficult to debug.

The renderer currently poses cell centers visually while collision, projectile hits, damage, detachment, connectivity, and center-of-mass calculations use rest positions. Before animated limbs become gameplay targets, the engine must choose one of these policies:

- visual-only animation with documented rest-pose hit geometry
- posed hit testing while structural physics remains in rest space
- fully posed gameplay geometry

The second option is likely the best intermediate milestone.

## Pack And Dependency Work

A converted asset download should be a module set containing:

- construct JSON
- material JSON assets
- image resource descriptors
- texture atlas images
- pose rig and animation clip data
- pack manifest and dependency links
- import provenance and source coordinate settings

Prefer `.glb` for direct browser import. Plain `.gltf` needs a multi-file or ZIP workflow so its buffers and images cannot be lost. The importer should reject remote URLs by default, enforce file and decoded-image limits, and report missing dependencies before conversion.

## Suggested Delivery Order

1. Stabilize and validate `render.surfaces` plus atlas image sampling.
2. Add static GLB parsing and PBR material/image pack generation.
3. Add source-triangle UV/normal/material projection to cell surfaces.
4. Add rigid node/bone hierarchy conversion with `1.0` cell bindings.
5. Add native animation clips and deliberate 2.5D transform rules.
6. Add opt-in weighted skin conversion and posed hit testing.

## Acceptance Checks

- A textured static GLB imports on the GitHub Pages editor without a server.
- Downloaded packs reopen after a page refresh and have no missing image/material dependencies.
- Neighboring microvoxels sample continuous UV regions where the source mapping is continuous.
- Material seams choose deterministic source faces or explicit overrides.
- Imported normals visibly affect directional lighting.
- Closed meshes support all three fill modes; open meshes do not fill accidentally.
- Mixed source cell types propagate inward, with ties using the selected default.
- A rigid animated GLB preserves hierarchy, clip names, duration, and loop behavior.
- Conversion output is deterministic for the same source file and settings.
- Malformed buffers, cyclic nodes, oversized images, and missing dependencies fail with actionable editor errors.

## Verification For This Editor Checkpoint

```text
npm.cmd test -- tests\meshVoxelizer.test.js tests\buildVersion.test.js
npm.cmd run build
npm.cmd run build:pages
```

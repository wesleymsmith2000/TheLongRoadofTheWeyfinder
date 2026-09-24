# Mesh Voxelizer Editor Handoff

Date: 2026-09-03

Runtime checkpoint: `v1.0.5.1`

Solid-fill editor checkpoint: `v1.0.9.0`

## What The Editor Added

The Construct Workshop is now layer-aware:

- cells preserve and edit `gridZ`
- the active layer is drawn normally
- lower layers can be ghosted
- upper layers can be hidden or ghosted
- same-X/Y stacked cells can be connected with `above` / `below`
- cell lists show X/Y/Z positions

The Creator Suite now includes:

```text
tools/mesh-voxelizer.html
src/editor/meshVoxelizer.js
src/editor/meshVoxelizerTool.js
```

The first voxelizer pass imports text-based `.obj` files plus ASCII and binary `.stl` files. It samples mesh triangle surfaces into occupied `(gridX, gridY, gridZ)` cells, picks one core near the sampled centroid, marks the rest as armor, and exports ordinary construct JSON with explicit adjacency connections.

The editor now also offers deterministic enclosed-volume filling:

- `surfaceOnly` preserves the sampled shell.
- `nearestSurface` propagates triangle-derived surface cell types into enclosed cells.
- `defaultType` fills enclosed cells with the selected default cell type.
- The default type resolves ties when multiple source types reach a surface or interior cell at equal distance.
- Exterior flood detection leaves open or leaking meshes unfilled instead of guessing at an interior.

Generated metadata records `fillMode`, `defaultCellType`, `surfaceCells`, and `interiorCells`. Surface cells use role `meshSurface`; filled cells use `meshInterior`. A future material-aware importer can provide `triangleCellTypes` aligned with the parsed triangle array without changing the fill algorithm.

## Intended Use

This is a bridge tool, not a final art pipeline.

Recommended creator flow:

1. Import a low-poly mesh in the Mesh Voxelizer.
2. Tune span and sampling until the silhouette is close.
3. Download or copy the construct JSON.
4. Open it in the Construct Workshop.
5. Assign core/gun/engine/wheel cells, gun loadouts, roles, and hand-cleaned connections.
6. Attach the construct to an enemy archetype or module pack.

## Foundation For The Correlated Project

The parser and voxelizer are pure editor modules with no DOM dependency, so they can be extracted later into a shared asset conversion package or separate creator tooling repo. Keep future mesh import support in that pure layer where possible:

- glTF/GLB
- material-name-to-cell-type hints
- vertex-group or painted-region hints
- repair/closing assistance for meshes whose shell leaks at the selected sampling resolution
- per-cell volumetric voxel masks once the runtime supports true volumetric damage masks

The exported artifact should remain normal construct JSON so sandbox mode, GitHub Pages editors, local packs, and the game runtime all consume the same asset shape.

## Verification

- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run build:pages`
- Local HTTP smoke check: `http://127.0.0.1:5173/tools/mesh-voxelizer.html` returned `200`

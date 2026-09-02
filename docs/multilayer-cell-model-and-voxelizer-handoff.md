# Multilayer Cell Model And Voxelizer Handoff

Runtime checkpoint: `v1.0.5.1`

This checkpoint starts the content/runtime contract for multilayer cell models. It does not yet ship the full layer-switching launch UI or ghosted layer rendering, but the schema and runtime instantiation now preserve stacked cells.

## Cell Layers

Construct cells may include `gridZ`.

```json
{
  "id": "upper-gun",
  "type": "gun",
  "gridX": 0,
  "gridY": 0,
  "gridZ": 1
}
```

Rules:

- Missing `gridZ` is treated as `0`.
- `(gridX, gridY, gridZ)` is the occupancy key, so cells can share X/Y when they are on different Z layers.
- Runtime cells preserve both `gridZ` and `layer`; `layer` mirrors `gridZ` for compatibility with older renderer/editor code.
- Current physics still projects cells into X/Y for mass, collision, and rendering. Treat this as a data contract foundation, not final volumetric gameplay.

## Vertical Connections

Construct connections now accept:

- `above`
- `below`

Example:

```json
{
  "a": "core",
  "b": "upper-gun",
  "aSide": "above",
  "bSide": "below",
  "type": "structural"
}
```

The current vertical validity check uses each cell's overall structure integrity because voxel masks do not yet expose true top/bottom Z-face anchors. Later work should add z-face integrity once masks become volumetric.

## Player Editor Follow-Up

The player edit helpers can add and connect stacked cells through `addEditableVehicleCell(definition, account, type, gridX, gridY, gridZ)` and `connectEditableVehicleCells(...)`.

Recommended launch-editor UI next:

- layer selector/stepper with 4 to 8 allowed layers
- current-layer rendering in normal opacity
- lower layers ghosted/transparent
- upper layers hidden
- `Connect Above` and `Connect Below` buttons that connect the selected cell to the same X/Y position on `gridZ + 1` or `gridZ - 1`
- status text showing current layer and selected cell Z

## Mesh Voxelizer Direction

Once the editor can author layered cells, a voxelizer can convert imported mesh occupancy into this same construct format.

Recommended first voxelizer output:

- a normalized grid of occupied `(gridX, gridY, gridZ)` cells
- one `core` seed chosen manually or by largest connected component centroid
- default `armor` for occupied exterior cells
- optional type hints from mesh material names, vertex groups, or painted regions
- explicit structural connections between adjacent occupied cells, including `above`/`below`
- optional per-cell voxel masks later, once volumetric masks are supported

Keep the voxelizer output as ordinary construct JSON so sandbox mode, runtime validation, and creator tools all consume the same artifact.

# Player Module Voxel And Build Grid Handoff

Date: 2026-09-02

Runtime checkpoint: `v1.0.4.0`

## What Changed

- Runtime module masks now use `4 x 4` voxels per cell via `VOXELS = 4` in `src/core/voxelMask.js`.
- `VOXEL_SIZE` is exported from `src/core/voxelMask.js`; runtime beam, blast, and magnet math should use it instead of hard-coded `CELL_SIZE / 6`.
- Per-voxel HP is scaled from the old `6 x 6` baseline so total module toughness stays roughly comparable while cells have fewer, chunkier damage regions.
- Structural connection validity now requires anchor integrity above `0.55`, so a `4 x 4` edge breaks once half its side anchors are destroyed.
- The player launch build grid now uses `VEHICLE_EDITOR_GRID_RADIUS = 8`, giving a `17 x 17` editable area.
- Default player equipment quantities are doubled in `PLAYER_EQUIPMENT_BASE_QUANTITIES`:
  - armor: `28`
  - gun: `6`
  - wheel: `8`
  - engine: `6`
- Account normalization floors old local saves to those doubled baseline quantities while preserving higher earned quantities.
- Achievement equipment rewards are doubled so progression grants remain proportional to the smaller/chunkier cell system.
- The launch build canvas is wrapped in `.vehicle-editor-canvas-wrap`, a scrollable touch-friendly viewport with larger scrollbars.

## Editor Guidance

Use runtime constants as the source of truth whenever possible:

- `src/core/voxelMask.js`
  - `CELL_SIZE`
  - `VOXELS`
  - `VOXEL_SIZE`
- `src/core/playerVehicleEditor.js`
  - `VEHICLE_EDITOR_GRID_RADIUS`
- `src/core/playerAccount.js`
  - `PLAYER_EQUIPMENT_BASE_QUANTITIES`

Avoid hard-coding the older `6 x 6` voxel mask, `CELL_SIZE / 6` voxel unit, or `9 x 9` player launch grid in editor examples.

## UI Notes

For mobile or narrow editor screens, keep the build surface scrollable instead of scaling the full `17 x 17` grid down until the cells become hard to tap. The launch page now keeps the canvas at `420 x 420` CSS pixels and scrolls the surrounding viewport.

## Validation

After syncing editor examples, run:

```bash
npm.cmd test -- --test-reporter=dot
npm.cmd run build
npm.cmd run build:pages
git diff --check
```

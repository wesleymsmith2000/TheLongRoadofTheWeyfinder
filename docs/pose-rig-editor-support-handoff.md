# Pose Rig Editor Support Handoff

Date: 2026-09-04

Updated: 2026-09-05 for weighted cell rig v0.2 editor support.

This handoff documents the editor-side work for runtime pose rigs from `docs/pose-rig-animation-editor-handoff.md`.

## Editor Surface

The Construct Workshop now supports authoring and round-tripping `poseRig` metadata on construct JSON.

Added controls:

- pose rig summary panel
- `Walker Stride Preset`
- `Cannon Aim Preset`
- `Clear Rig`
- group editor
- joint editor
- pose transform editor
- animation editor
- weighted cell binding editor
- selected-joint weight heatmap
- selected-cell binding readout
- `Paint Weight` and `Erase Weight` canvas tools
- `Fill Selected`, `Normalize Cell`, `50/50 Blend`, and `Smooth Cell` actions
- raw pose rig JSON editor

Downloaded constructs now emit the preferred nested shape:

```json
{
  "poseRig": {
    "schemaVersion": "0.2",
    "groups": [],
    "joints": [],
    "poses": [],
    "animations": [],
    "cellBindings": {}
  }
}
```

Imported top-level aliases still load:

- `cellGroups`
- `joints`
- `poses`
- `poseAnimations`
- `cellBindings`
- `poseDynamics`
- `poseRigImports`

The Construct Workshop normalizes those aliases into `poseRig` when loaded.

## Shared Editor Helper

New module:

```text
src/editor/poseRigAuthoring.js
```

This is intentionally DOM-free so later importer work can reuse it for external model, rig, pose, and animation formats.

Important exports:

- `poseRigFromConstructDefinition`
- `normalizePoseRigDraft`
- `hasPoseRigContent`
- `poseRigSummary`
- `createGroupDescriptor`
- `createJointDescriptor`
- `createPoseDescriptor`
- `createPoseTransformDescriptor`
- `createAnimationDescriptor`
- `createCellBindingDescriptor`
- `createWalkerStrideRigForConstruct`
- `createCannonAimRigForConstruct`

The helper uses the runtime `normalizePoseRig` and walker stride generator from `src/core/poseAnimation.js`, plus `normalizeCellWeights` from `src/core/poseWeights.js`, so editor presets and weighted cell bindings stay aligned with runtime expectations.

## Current Limits

The compact pose UI edits one transform per pose. Multi-target poses are still supported through the raw rig JSON field, and they validate through the existing construct validator.

Weighted painting supports the first milestone only: one or two influences per cell, selected-joint paint/erase, normalize, equal two-joint blend, and smoothing from connected neighbors. Mirror weights, chain gradients, external weighted imports, and topology/overlap relaxation UI are not built yet.

The runtime applies pose rigs visually. Collision and projectile hit tests are still based on the unposed construct cell grid, matching the runtime handoff.

## Runtime Follow-Up For Dev Thread

No new runtime schema is required for this editor checkpoint. The editor now consumes the v0.2 `poseRig.cellBindings` shape already accepted by runtime validation.

Useful next runtime steps remain:

1. Make collision and hit testing pose-aware for animated groups.
2. Let enemy archetype movement or attack phases explicitly drive named construct `poseRig.animations`.
3. Attach multi-part boss constructs by mount selectors such as `slot:leftCannonMount`, then allow child part rigs like the rotatable cannon `aimAtTarget` preset to evaluate in aggregate-local space.
4. Add event drivers such as `onAttackWindup`, `onAttackRelease`, `onDamaged`, `onLegLayerLost`, and `onPhaseChange`.
5. Add deterministic topology/overlap relaxation in a separate runtime module before exposing full `poseRig.dynamics` editing controls.

## Validation

Added and extended `tests/poseRigAuthoring.test.js` for alias normalization, form-friendly descriptor creation, weighted binding descriptor normalization, walker stride preset generation, and rotating cannon preset generation.

# Pose Rig Editor Support Handoff

Date: 2026-09-04

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
- raw pose rig JSON editor

Downloaded constructs now emit the preferred nested shape:

```json
{
  "poseRig": {
    "groups": [],
    "joints": [],
    "poses": [],
    "animations": []
  }
}
```

Imported top-level aliases still load:

- `cellGroups`
- `joints`
- `poses`
- `poseAnimations`

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
- `createWalkerStrideRigForConstruct`
- `createCannonAimRigForConstruct`

The helper uses the runtime `normalizePoseRig` and walker stride generator from `src/core/poseAnimation.js`, so editor presets stay aligned with runtime expectations.

## Current Limits

The compact pose UI edits one transform per pose. Multi-target poses are still supported through the raw rig JSON field, and they validate through the existing construct validator.

The runtime still applies pose rigs visually only. Collision and projectile hit tests are still based on the unposed construct cell grid, matching the runtime handoff.

## Runtime Follow-Up For Dev Thread

No new runtime schema is required for this editor checkpoint.

Useful next runtime steps remain:

1. Make collision and hit testing pose-aware for animated groups.
2. Let enemy archetype movement or attack phases explicitly drive named construct `poseRig.animations`.
3. Attach multi-part boss constructs by mount selectors such as `slot:leftCannonMount`, then allow child part rigs like the rotatable cannon `aimAtTarget` preset to evaluate in aggregate-local space.
4. Add event drivers such as `onAttackWindup`, `onAttackRelease`, `onDamaged`, `onLegLayerLost`, and `onPhaseChange`.

## Validation

Added `tests/poseRigAuthoring.test.js` for alias normalization, form-friendly descriptor creation, walker stride preset generation, and rotating cannon preset generation.

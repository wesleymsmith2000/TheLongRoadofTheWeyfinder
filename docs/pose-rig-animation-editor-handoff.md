# Pose Rig / Linked Cell Animation Editor Handoff

Runtime checkpoint: `v1.0.7.8`

This handoff describes the new runtime infrastructure for editor-authored linked cell groups, joints, poses, and simple pose animations.

## Runtime Surface

New runtime module:

```text
src/core/poseAnimation.js
```

Construct validation/instantiation now accepts and preserves pose rig metadata through:

```text
src/core/constructDefinition.js
```

The canvas renderer now evaluates pose rigs for enemies and player constructs. This is render-facing infrastructure first: collision and projectile hit tests still use the unposed cell grid for now.

## Accepted Construct JSON

Preferred nested form:

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

Editor-friendly top-level aliases are also accepted:

```json
{
  "cellGroups": [],
  "joints": [],
  "poses": [],
  "poseAnimations": []
}
```

Aliases normalize to `construct.poseRig` at runtime.

## Cell Groups

Groups define a linked assembly that should move as one unit.

```json
{
  "id": "frontLeftLeg",
  "selector": "role:supportLeg",
  "cells": ["front-left-foot", "front-left-knee"],
  "pivot": [-18, -24, 0],
  "role": "legAssembly"
}
```

Supported selectors:

- `all`
- `cell:<cellId>`
- `role:<role>`
- `type:<cellType>`
- `slot:<slotName>`
- `tag:<tagName>`

`cells` and `selector` may both be present. The runtime unions them. `pivot` is local construct space `[x, y, z]`, in pixels.

## Joints

Joints are declarative metadata for the editor and future simulation. Runtime currently preserves them and applies `defaultTransform` if supplied.

```json
{
  "id": "frontLeftLegSlide",
  "group": "frontLeftLeg",
  "kind": "slider",
  "axis": [0, 1, 0],
  "defaultTransform": { "translate": [0, 0, 0] }
}
```

Supported `kind` values:

- `fixed`
- `slider`
- `hinge`

## Poses

Poses are named target transforms.

```json
{
  "id": "strideForward",
  "transforms": [
    { "target": "group:frontLeftLeg", "translate": [0, -8, 0] },
    { "target": "group:rearRightLeg", "translate": [0, -8, 0] }
  ]
}
```

Transforms can use:

- `translate: [x, y, z]`
- `rotation`
- `pivot: [x, y, z]`
- scalar aliases `x`, `y`, `z`, `translateX`, `translateY`, `translateZ`

## Animations

Current runtime animation kinds:

```json
{
  "id": "walkCycle",
  "kind": "poseCycle",
  "driver": "phase",
  "frequency": 1,
  "loop": true,
  "keyframes": [
    { "at": 0, "pose": "strideForward" },
    { "at": 0.5, "pose": "strideBack" }
  ]
}
```

```json
{
  "id": "legBob",
  "kind": "oscillate",
  "target": "group:frontLeftLeg",
  "property": "translateY",
  "amplitude": 8,
  "frequency": 1,
  "phase": 0,
  "driver": "phase"
}
```

```json
{
  "id": "trackPlayer",
  "kind": "aimAtTarget",
  "target": "group:mainCannon",
  "rotationOffset": 0
}
```

Current renderer contexts provide:

- `time`
- `phase` for walkers, currently `enemy.walkPhase`
- `movementSpeed`
- `target`, currently the player vehicle for enemies

## Current Runtime Fallbacks

Starlight/Twilight walker spawns automatically get an inferred walker stride rig if the construct does not define one. The inferred rig groups cells whose roles are:

- `supportLeg`
- `legArmor`
- `legJoint`

This fallback is only a bridge. The editor should eventually author explicit leg assembly groups so each leg tower can be tuned cleanly.

## Recommended Walker Authoring

For the spidery 8-leg walker:

- Define one group per leg assembly.
- Include wheel/support cells, armor sleeves, and the joint engine for that leg.
- Use slider joints along local Y for forward/back stride.
- Use alternating phases so left/right and front/rear legs do not move in lockstep.

For the burly 4-leg walker:

- Same shape, fewer groups.
- Larger stride amplitude works better because each foot cluster is broad.

## Recommended Walker Boss Cannon Authoring

For each mounted cannon:

- Make one group for the full cannon construct.
- Put pivot on the cannon core or rotation joint center.
- Use `kind: "aimAtTarget"` on that group.
- Use `slot:leftCannonMount`, `slot:rightCannonMount`, and `slot:topCannonMount` on body mount cells so aggregate boss wiring can attach cannon parts to the matching mount.

The editor handoff in `docs/walker-cannon-boss-editor-handoff.md` still applies. This new pose rig contract provides the animation language those cannon mounts should use.

## Caterpillar / Inchworm Path

Current inchworm behavior still moves head and segments as separate runtime constructs. For future caterpillar-style rigs inside one construct:

- Use one group per segment.
- Use `poseCycle` keyframes to interpolate bunching and stretching.
- Use `aimAtTarget` or later `pathTangent` driver support for segment turning.

## Future Runtime Work

Next useful runtime steps:

1. Add pose-aware collision/hit testing for animated groups.
2. Let enemy archetype `movementProfiles` explicitly bind to construct `poseRig.animations`.
3. Instantiate aggregate boss parts from `aggregate.parts[].construct` and attach them by `slot:<name>`.
4. Add event drivers such as `onAttackWindup`, `onAttackRelease`, `onDamaged`, `onLegLayerLost`, and `onPhaseChange`.
5. Add melee helpers for club/blade/whip sweeps that sample posed group arcs for damage.

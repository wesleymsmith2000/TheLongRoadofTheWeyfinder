# Cell Skinning / Pose Dynamics Editor Handoff

Runtime checkpoint: `v1.0.7.9`

This extends the existing pose rig contract from rigid linked cell groups into optional weighted cell-center posing. Rigid remains the default. Weighted deformation is opt-in and still draws each cell as a crisp block.

## Runtime Surface

New shared helpers:

```text
src/core/poseWeights.js
```

Updated runtime:

```text
src/core/poseAnimation.js
src/core/constructDefinition.js
src/editor/poseRigAuthoring.js
```

The renderer now uses weighted pose transforms when `poseRig.cellBindings` is present. Simulation collision, projectile hits, damage, detachments, COM, and root physics still use the unposed cell model.

## Canonical JSON

Preferred nested form:

```json
{
  "poseRig": {
    "schemaVersion": "0.2",
    "groups": [
      { "id": "upperArm", "cells": ["shoulder", "bicep"], "pivot": [0, 0, 0] },
      { "id": "forearm", "cells": ["elbow", "wrist"], "pivot": [12, 0, 0] }
    ],
    "joints": [
      { "id": "upperArmJoint", "group": "upperArm", "kind": "hinge", "axis": [0, 0, 1] },
      { "id": "forearmJoint", "group": "forearm", "kind": "hinge", "axis": [0, 0, 1], "parent": "upperArmJoint" }
    ],
    "cellBindings": {
      "elbow": [
        { "joint": "upperArmJoint", "weight": 0.45 },
        { "joint": "forearmJoint", "weight": 0.55 }
      ],
      "wrist": [{ "joint": "forearmJoint", "weight": 1 }]
    },
    "poses": [
      {
        "id": "bend",
        "transforms": [
          { "target": "joint:forearmJoint", "rotation": 0.7, "pivot": [12, 0, 0] }
        ]
      }
    ],
    "animations": [
      { "id": "bendCycle", "kind": "poseCycle", "driver": "time", "frequency": 1, "keyframes": [{ "at": 0, "pose": "bend" }] }
    ],
    "dynamics": {
      "enabled": false,
      "iterations": 2,
      "topologyStiffness": 0.5,
      "overlapStiffness": 0.35,
      "minimumSpacing": 6,
      "maxCorrection": 2
    },
    "imports": [
      { "source": "blockbench", "mode": "rigidHierarchy", "assetId": "creator.walker.blockbench" }
    ]
  }
}
```

Top-level aliases are accepted and normalize into `poseRig`:

```text
cellGroups -> poseRig.groups
joints -> poseRig.joints
poses -> poseRig.poses
poseAnimations -> poseRig.animations
cellBindings -> poseRig.cellBindings
poseDynamics -> poseRig.dynamics
poseRigImports -> poseRig.imports
```

## Weight Rules

Runtime validation enforces:

- one or two influences per cell
- finite positive weights
- unique joint ids per bound cell
- every referenced cell exists
- every referenced joint exists
- joint parent chains must not be cyclic

Weights are normalized at runtime. If they sum to something other than `1.0`, validation warns and runtime normalizes.

No `cellBindings` means legacy rigid behavior. A rigid imported hierarchy should emit one binding at weight `1.0` for each controlled cell.

## Editor Milestone

Build the first editor pass around weighted cell rigs only:

- Add a Weights mode in Construct Workshop.
- Select a joint, then paint or erase its influence on cells.
- Show selected-joint heatmap and selected-cell influence list.
- Add Normalize and 50/50 Blend actions.
- Preserve `poseRig.cellBindings` during save/load and JSON paste.
- Generate rigid `1.0` bindings from external rigid hierarchies.
- Keep weighted import behind an experimental opt-in.

Do not add topology/overlap relaxation editing until weighted preview feels stable.

## Import Guidance

Blockbench:

- Import hierarchy/group nodes as `groups` and `joints`.
- Emit `cellBindings` with one `1.0` influence per cell.
- Preserve original node ids in `poseRig.imports`.

glTF:

- Rigid single-node pieces should become `1.0` bindings.
- Weighted import is experimental and should only run when cell mapping is reliable.

Spine/Spriter:

- Import as rigid transforms first.
- Keep source bone names so the editor can help map them to native joints.

Do not silently bake arbitrary mesh weights onto cells.

## Runtime Caveats

Current v0.2 runtime blends cell centers and angle-wrap-safe orientation. It does not shear cell corners or deform voxel geometry.

Pose dynamics metadata is validated and preserved, but relaxation is not active yet. The next runtime step is an isolated `poseDynamics` module with deterministic rest-distance constraints, then optional overlap relaxation.

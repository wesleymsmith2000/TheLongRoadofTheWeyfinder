# Creator Suite User Guide

Date: 2026-09-02

The Creator Suite is available from:

```text
tools/creator-suite.html
```

The user-facing tutorial page is:

```text
tools/creator-guide.html
```

## Basic Workflow

1. Open the Creator Suite.
2. Click `Install Example` and `Install Zone Enemies` to load sample packs into browser-local storage.
3. Use `Mob / Construct` to load and edit construct bodies.
4. Use `Mesh Voxelizer` to convert low-poly OBJ or STL meshes into layered construct JSON.
5. Use `Enemies` to assign constructs, firing patterns, movement profiles, aggregate behavior, and cell animations.
6. Use `Projectile / Weapon / Pattern` to tune weapon and projectile JSON.
7. Use `Levels` to assemble route, background, wave, obstacle, and trigger descriptors.
8. Use `Encounters` to author choice vignettes, route decisions, world-hold interactions, and delayed repercussions.
9. Download JSON assets or import/export module folders through the suite.

## Construct Loading

The Construct Workshop now has a `Load Construct` dropdown.

It lists:

- bundled runtime constructs
- sculpted zone enemy example constructs
- constructs installed into the browser-local module library

Use `Refresh Local` after importing a new pack if the Construct Workshop is already open. Loading a construct copies it into the editor, so changing the asset id before downloading is the safest way to make a variant.

## Layered Cells

Construct cells can now carry `gridZ`. The workshop edits one layer at a time, while lower layers can remain visible as ghosted reference cells. Use `Connect Above` and `Connect Below` to create structural links between stacked cells at the same X/Y position.

## Mesh Voxelizer

The Mesh Voxelizer accepts text OBJ files plus ASCII and binary STL files. It samples mesh surfaces into layered construct cells, chooses one centroid-adjacent core, and creates explicit adjacency connections. The first pass is best for low-poly silhouettes; open the generated JSON in the Construct Workshop to assign more meaningful cell types and loadouts.

## Pose Rigs

The Construct Workshop can now author construct `poseRig` metadata.

- `groups` collect linked cells by direct cell ids or selectors like `role:supportLeg`, `type:gun`, `slot:topCannonMount`, and `tag:name`.
- `joints` describe how groups attach. Current runtime accepts `fixed`, `slider`, and `hinge`; `defaultTransform` is applied visually.
- `poses` store named target transforms. The compact UI edits the first transform for a pose, and the raw rig JSON field can be used for multi-target pose keyframes.
- `animations` support `oscillate`, `poseCycle`, and `aimAtTarget`.
- `Walker Stride Preset` uses the runtime walker grouping helper for constructs whose leg cells are marked with `supportLeg`, `legArmor`, or `legJoint`.
- `Cannon Aim Preset` creates a rotating `mainCannon` group, hinge joint, and `aimAtTarget` animation.
- `cellBindings` opt cells into weighted posing. Select a joint, choose `Paint Weight`, then click cells to bind them to that joint.
- `50/50 Blend` binds the selected cell equally between the active joint and the blend joint. `Smooth Cell` averages the selected cell from connected neighbors.

Downloaded constructs emit the preferred nested `poseRig` shape. Imported alias fields (`cellGroups`, `joints`, `poses`, `poseAnimations`, `cellBindings`, `poseDynamics`, `poseRigImports`) are normalized into that shape when loaded.

## Current Limits

## Encounter Editor

The Encounter Editor emits first-class `encounter` assets for the content registry.

- `trigger` defines how an encounter starts, such as route distance, interaction button, collision, projectile hit, or manual/scripted launch.
- `states` define presentation mode, pause policy, text, choices, entry effects, and exit effects.
- `choices` can transition to another state, resolve the encounter, bind to a route branch, apply immediate effects, emit telemetry tags, or schedule repercussions.
- `interactions` define in-world prompts and anchors for world-hold encounters.
- `repercussions` define delayed consequences such as later route-distance events, next-level events, timers, or run-end effects.

Level triggers can reference an encounter with `kind: "encounter"` and `assetRef`. The registry treats referenced encounters as required dependencies unless the trigger sets `required: false`.

## Current Limits

Editor-authored constructs, enemy archetypes, patterns, weapons, levels, encounters, and resources can be validated and packaged now. The gameplay runner still needs small runtime adapters before every advanced descriptor field becomes active behavior.

# Creator Suite User Guide

Date: 2026-09-23

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
9. Use `Materials / Lighting` to author render materials, spectral puzzle responses, and reusable lighting presets.
10. Download JSON assets or import/export module folders through the suite.

## Mod Test Bench

The left side of the Creator Suite is the browser-local Mod Test Bench.

1. Import or reimport a folder. A matching `packId` replaces the prior installed copy after the new copy validates.
2. Choose the installed pack, then filter or search its assets. Enemy archetype packs are expanded so each enemy can be selected directly.
3. Review the validation and dependency reports. `INSTALLED LOCAL` dependencies are present in browser storage; `BUNDLED / EXTERNAL` dependencies must be supplied by the game or another pack.
4. Use `Open in Editor` to load supported constructs, enemies, weapons, patterns, status effects, levels, encounters, materials, or lighting presets into the matching editor.
5. Use `Test Enemy`, `Test Level`, or `Test Encounter` to prepare the existing Sandbox script and open the game. Click `Run Script` in Sandbox to start the prepared test.
6. Use `Export Pack` to download a reimportable single-file pack whose assets are embedded in its manifest.

## Construct Loading

The Construct Workshop now has a `Load Construct` dropdown.

It lists:

- bundled runtime constructs
- sculpted zone enemy example constructs
- constructs installed into the browser-local module library

Use `Refresh Local` after importing a new pack if the Construct Workshop is already open. Loading a construct copies it into the editor, so changing the asset id before downloading is the safest way to make a variant.

`Auto-connect` adds one structural edge between every pair of orthogonally adjacent cells, including cells directly above and below one another. Existing custom edges are preserved and duplicate edges are removed. `Remove Connection` is a two-cell tool: click one cell, then an adjacent cell to remove their edge. Individual edges can still be removed from the Connections list.

## Layered Cells

Construct cells can now carry `gridZ`. The workshop edits one layer at a time, while lower layers can remain visible as ghosted reference cells. Use `Connect Above` and `Connect Below` to create structural links between stacked cells at the same X/Y position.

## Mesh Voxelizer

The Mesh Voxelizer accepts text OBJ files plus ASCII and binary STL files. It samples mesh surfaces into layered construct cells, chooses one centroid-adjacent core, and creates explicit adjacency connections. `Surface Only` keeps the sampled shell. `Nearest Surface Type` fills enclosed regions by propagating surface cell types inward, while `Default Type` fills every enclosed cell with the selected default. The default also resolves equal-distance source-type ties. Open meshes do not fill because their interiors remain reachable from the exterior flood. The first pass is best for low-poly silhouettes; open the generated JSON in the Construct Workshop to assign more meaningful cell types and loadouts.

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

## Animation State Graphs

The Construct Workshop can add an optional `animationGraph` beside the pose rig. States choose stable poses and optional material/texture states. Transitions connect those states with rig, material, and texture clips, a randomized duration, and an interruption policy. `AT_NEXT_ANCHOR` and `REQUIRE_TAG` use normalized interrupt anchors to move an interrupted construct through an authored balanced pose. Use the graph canvas to inspect connectivity and the transition slider to see which anchors and markers have passed. The raw graph JSON remains available for additive motion and complex material or texture clips.

## Branching Levels

The Level Editor can embed a `navigationGraph` in a level asset. Use nodes for playable levels, encounters, relays, hazards, repairs, and obscured destinations. Edges can be visible, fogged, conditional, unstable, or false echoes, and may require or block run flags. Alignment and threat are independent axes; the score preview shows the authored road, fate, destination, danger, and ambush music contributions. Switch the center preview from `Road Timeline` to `Branch Graph` to inspect the topology before downloading the level JSON.

## Encounter Editor

The Encounter Editor emits first-class `encounter` assets for the content registry.

- `trigger` defines how an encounter starts, such as route distance, interaction button, collision, projectile hit, or manual/scripted launch.
- `states` define presentation mode, pause policy, text, choices, entry effects, and exit effects.
- `choices` can transition to another state, resolve the encounter, bind to a route branch, apply immediate effects, emit telemetry tags, or schedule repercussions.
- `interactions` define in-world prompts and anchors for world-hold encounters.
- `repercussions` define delayed consequences such as later route-distance events, next-level events, timers, or run-end effects.

Level triggers can reference an encounter with `kind: "encounter"` and `assetRef`. The registry treats referenced encounters as required dependencies unless the trigger sets `required: false`.

## Material Lighting Editor

The Material Lighting Editor writes runtime-ready material JSON and lighting preset JSON.

- Materials use `render` fields from `src/core/renderMaterial.js`: albedo, procedural texture, atlas metadata, shading, emissive response, fluorescence, phosphorescence, and pseudo-height.
- The canvas preview shows a continuous 5x5 material cluster, lighting preset comparison, atlas thumbnail, hidden fluorescent message preview, and phosphorescent trail timeline.
- Spectral bands are named puzzle bands such as `UV`, `BLUE`, `RED`, and `BROAD_WHITE`; they are not full spectroscopy.
- Phosphorescence remains static content plus runtime charge state. The editor previews charge/decay but does not store live charge in material definitions.

## Current Limits

Editor-authored constructs, enemy archetypes, patterns, weapons, levels, encounters, materials, lighting presets, and resources can be validated and packaged now. The gameplay runner still needs small runtime adapters before every advanced descriptor field becomes active behavior.

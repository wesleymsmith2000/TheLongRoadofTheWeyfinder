# Branch Navigation And Animation Graph Editor Handoff

Date: 2026-09-24

This pass implements editor-owned authoring support for two data contracts while the game-development thread owns simulation, integration, and API behavior.

## Implemented Editor Surfaces

### Level branching navigation

`tools/level-editor.html` now authors an optional `navigationGraph` embedded in the level definition.

The editor supports:

- node creation, rename, removal, content references, tags, and graph positions
- node kinds for levels, encounters, relays, hazards, stations, puzzles, bosses, repairs, and unknown/fogged destinations
- independent alignment, threat, clarity, fate pressure, road coherence, destination signal, and ambush-risk values
- directed edges; return paths and loops use explicit reverse edges
- visible, fogged, conditional, unstable, and false-echo edge presentation
- weighted edges, required flags, blocked flags, and per-edge navigation deltas
- an editable visible horizon
- a route-view / branch-graph preview toggle
- derived adaptive-music score preview without running gameplay
- raw graph JSON editing, whole-level JSON round-trip, and ordinary level download

The pure authoring and validation API is in:

```text
src/editor/navigationGraphAuthoring.js
```

The primary shape is:

```json
{
  "navigationGraph": {
    "schemaVersion": "0.1",
    "assetId": "navigation.example.relay_web",
    "initialNode": "relay-entry",
    "visibleHorizon": 2,
    "seedOffset": 14,
    "nodes": [],
    "edges": [],
    "adaptiveMusic": {
      "profile": "relay-web",
      "carryIntoLevel": true,
      "afterimageFromLevel": true
    }
  }
}
```

Playable nodes use the runtime's canonical `levelId` and `encounterId` fields so core dependency collection sees them. Other future node kinds retain a generic `assetRef` until the runtime defines a dedicated field.

### Construct key-state animation graphs

`tools/construct-workshop.html` now authors an optional `animationGraph` alongside `poseRig`.

The editor supports:

- deterministic `seedOffset`
- initial state selection
- states with pose, material-state, texture-state, dwell range, tags, weighted autonomous next states, and graph position
- transitions with randomized duration ranges
- synchronized rig, material, and texture clip references
- `IMMEDIATE`, `AT_NEXT_ANCHOR`, `FINISH_TRANSITION`, and `REQUIRE_TAG` interruption policies
- semantic interrupt anchors and event markers on a normalized timeline
- weighted transition variants
- state and transition rename/removal with reference cleanup
- visual graph preview and transition scrub preview
- raw graph JSON for material states/clips, texture states/clips, additive motion, and advanced fields
- validation against the construct's current pose and rig-clip ids

The pure authoring and validation API is in:

```text
src/editor/animationGraphAuthoring.js
```

`poseRig` remains the owner of geometry, poses, clips, and cell weighting. `animationGraph` owns semantic state and transition orchestration.

## Runtime Ownership / Follow-up

The editor does not choose routes, persist hidden navigation state, evaluate transition interruption, or alter rendering. The game-development thread should own those behaviors.

The current `src/core/animationGraph.js` already covers seeded state/transition evaluation, semantic requests, interruption policies, anchors, markers, variants, snapshots, and rig output. Remaining alignment work:

1. Preserve and evaluate `materialStates`, `materialClips`, `textureStates`, `textureClips`, and `additiveMotion` when normalizing an animation graph. The editor already emits these handoff fields.
2. Route material and texture channel output into the render-material pipeline without disabling intact-cell sprite caching globally.
3. Ensure construct loading preserves optional `animationGraph` and nested `poseRig.clips` from registry definitions through instantiated entities.
4. Add gameplay semantic maps such as `hit`, `fire`, `recover`, `walk`, or `death` to state requests without putting gameplay code in the editor schema.
5. Decide whether missing rig clips are hard errors at pack import or deferred dependencies. The editor currently reports them as validation errors.

The current `src/core/navigationGraph.js` and related game/save integration already provide normalization, validation, deterministic state, partial observation, route selection, scoring, music mix output, and hydration. Remaining alignment work:

1. Interpret editor presentation metadata `visibility`, `requiredFlags`, and `blockedFlags`, or replace it with the runtime's final canonical condition schema.
2. Resolve non-level/non-encounter node `assetRef` values once each node kind has a canonical dependency field.
3. Connect the graph view and route choices to the final player-facing navigation UI without exposing hidden `signals`.
4. Confirm whether `adaptiveMusic` profile metadata belongs in the graph or in level/audio configuration; the numeric mix already comes from core navigation state.
5. Add telemetry and content-facing diagnostics for choices rejected by runtime flag conditions.

## Packaging Notes

Both contracts are embedded fields on existing assets. A construct download carries its `animationGraph`; a level download carries its `navigationGraph`. They therefore work with the current GitHub Pages download and browser-local module workflow without a server.

Pack dependency collection should eventually inspect:

- `navigationGraph.nodes[].levelId`, `encounterId`, and future non-level `assetRef` fields
- animation material/texture asset references inside authored states and clips

The level editor lists graph content references in its import-plan panel now, but the core dependency collector has intentionally not been changed by this editor-side pass.

## Verification

Focused tests:

```text
tests/navigationGraphAuthoring.test.js
tests/animationGraphAuthoring.test.js
```

The examples exercise partially observed loops and false routes, independent direction/danger scoring, randomized key-state transitions, synchronized channels, interrupt anchors, markers, and weighted variants.

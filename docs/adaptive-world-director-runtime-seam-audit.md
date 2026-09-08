# Adaptive World Director Runtime Seam Audit

Date: 2026-09-08

Source context: `CODEX_HANDOFF_ADAPTIVE_WORLD_DIRECTOR_ROADMAP_V0_1.md`

This is the Phase 0 seam map for the future Road / Fate's Shadow adaptive director. It records where the first passive director work can attach after the current stall and lag pass is stable.

## Current Runtime Seams

### Level Definitions

Primary file: `src/core/levelDefinition.js`

Level JSON already validates the main authoring surfaces the director will eventually use:

- `background.layers[]` for procedural, image, video, and canvas layers
- `terrain` for procedural terrain packs, seeds, materials, and tiles
- `route.segments[]` for road distance, turns, and heading
- `obstacles[]` for distance/lane-positioned objects
- `waves[].spawn[]` for encounter timing and route-relative placement
- `triggers[]` for `voiceover`, `cue`, `music`, and `scripted_event`

Current trigger support is data-only. Triggers validate and contribute dependencies, but the main runtime does not yet dispatch cue/music/scripted events from level definitions.

### Music

Primary files: `src/core/levelMusic.js`, `src/main.js`

Music is currently selected by level index from `DEFAULT_LEVEL_MUSIC`; boss detection is name-based. Playback is handled by one `HTMLAudioElement` in `main.js`.

The recent stall pass added SFX coalescing and diagnostic audio counters. Future director music changes should stay state-driven and low-frequency, and should avoid per-frame audio commands.

### Terrain Streaming

Primary files: `src/core/terrainStreaming.js`, `src/core/terrainGenerator.js`

Terrain streaming requests chunks around the camera plus forward chunks along the road. Generation is deterministic from seed, chunk coordinates, route, and terrain content.

This is the correct place to plan future unseen content, but the generator itself should stay pure. The director should resolve a compact event plan before a chunk becomes visible, then pass that plan into terrain or event placement.

### Terrain Tiles And Sockets

Primary files: `src/core/terrainTileDefinition.js`, `src/core/terrainGenerator.js`

Terrain tile definitions already include `decorSockets`, `eventSockets`, intrinsic hazards, semantic material grids, height grids, fluid grids, sockets, and tags. Synthetic terrain feature tiles currently emit empty `eventSockets`.

This is the natural editor/runtime contract for future Road/Fate placement affordances. The next schema work should define shared socket tag registries before editor UI starts duplicating tag lists.

### Combat And Behavior Telemetry

Primary files: `src/core/game.js`, `src/core/combatEvents.js`, `src/core/enemy.js`

Useful passive signals already exist:

- score totals such as damage and scrap collected
- enemy defeat and special defeat counters
- targeting AI experience and selected targeting mode
- vehicle damage, ammo, boost, and scrap state
- enemy `activityFlags` for behavior conditions
- route/camera/terrain samples

The first player model should observe these signals from `stepGame` or existing event helpers without letting combat code depend on director state.

### Saves

Primary file: `src/core/saveState.js`

Saves currently persist seed, account, vehicle, level progression, scrap, upgrades, secondary state, score, targeting mode, and targeting AI state.

No director fields exist yet. When director work begins, saves should store compact model/chronicle/resolution state rather than generated chunks.

### Editor

Primary files: `src/editor/levelEditor.js`, `tools/level-editor.html`, `docs/adaptive-director-level-building-editor-roadmap.md`

The level editor currently edits the existing level contract and uses the shared validator. It previews route, waves, obstacles, and triggers.

Adaptive director authoring should keep the same direction:

```text
shared core definitions
  -> runtime
  -> editor
  -> tests
```

No editor-only director schema should be added until runtime validators, content samples, tests, and docs change together.

## Recommended First Implementation

After the stall work is verified on mobile, start with a zero-gameplay-effect passive player model:

- add `src/core/director/playerModel.js`
- track only `cueSensitivity`, `lootDrive`, `resourceTolerance`, and `aggression`
- update by event-driven samples plus low-frequency decay
- expose read-only debug output only when debug UI is visible
- persist only if the model is stable enough to survive save/load tests

Stop before event scoring. The first acceptance gate should be determinism, negligible performance impact, and plausible telemetry movement in sandbox scenarios.

## Guardrails

- Terrain generation must not read player telemetry or director state directly.
- Director scoring must not run every frame.
- Event templates, candidates, and resolutions should remain separate.
- Road/Fate choices must resolve before content is visible.
- Visible terrain should not be rewritten by adaptive decisions.
- False warnings need explicit budgets and cooldowns.
- Music cues mean significance, not guaranteed combat.
- Debug UI must be visibility-gated and throttled.

# Choice Vignette Encounter Editor Handoff

Date: 2026-09-08

Runtime/editor checkpoint: `v1.0.4.0+`

Source context: `EDITOR_CODEX_HANDOFF_CHOICE_VIGNETTE_ORCHESTRATION_V0_1.md`

This checkpoint starts editor-side support for authored choice/vignette encounters. The source handoff is treated as technical context; this repo now has a first concrete schema/editor slice that runtime can wire against.

## Files Added

```text
src/core/encounterDefinition.js
src/editor/encounterEditor.js
tools/encounter-editor.html
content/encounters/moonlit_beacon_choice_vignette.json
```

The new editor is available locally and on Pages at:

```text
tools/encounter-editor.html
```

It is linked from the Creator Suite and Creator Guide.

## Encounter Asset Shape

The editor emits first-class `encounter` assets, not editor-only data.

Current starter shape:

```json
{
  "schemaVersion": "0.1",
  "assetId": "encounter.moonlit_beacon_choice_vignette",
  "displayName": "Moonlit Beacon Choice Vignette",
  "canonStatus": "EXPERIMENTAL",
  "trigger": { "type": "route_distance", "atDistance": 430 },
  "initialState": "day_presentation",
  "states": [],
  "interactions": [],
  "repercussions": [],
  "telemetryHooks": [],
  "directorHooks": []
}
```

The validator accepts state lists or state maps. It also normalizes earlier uppercase handoff names such as `MODAL_CHOICE_PAUSED` into the canonical camelCase values. The editor writes state lists with canonical camelCase fields.

## Shared Registries

`src/core/encounterDefinition.js` exports the initial shared registries:

- `ENCOUNTER_TRIGGER_TYPES`
- `ENCOUNTER_PRESENTATION_MODES`
- `ENCOUNTER_PAUSE_POLICIES`
- `ENCOUNTER_EFFECT_TYPES`
- `ENCOUNTER_CONDITION_TYPES`
- `ENCOUNTER_REPERCUSSION_TRIGGER_TYPES`
- `ENCOUNTER_MUSIC_STATES`

The Encounter Editor imports these registries directly, so the UI options and validator stay aligned.

## Level Integration

`src/core/levelDefinition.js` now accepts level triggers with:

```json
{
  "id": "moonlit-beacon-choice",
  "kind": "encounter",
  "atDistance": 430,
  "assetRef": "encounter.moonlit_beacon_choice_vignette",
  "once": true
}
```

Encounter triggers require `assetRef`. `collectLevelDependencies()` now treats those refs as required `encounter` dependencies by default.

The prototype level includes a data-only sample trigger at distance `430`.

## Content Registry Integration

`src/core/contentRegistry.js` now validates registered `encounter` assets through `validateEncounterDefinition()`.

`src/core/localContentLibrary.js` can infer loose imported encounter JSON when it has `initialState`, `states`, and `trigger`.

`content/packs/canon.prototype0.json` now lists:

```text
../encounters/moonlit_beacon_choice_vignette.json
```

## Moonlit Beacon Sample Coverage

The sample encounter demonstrates:

- `modalChoicePaused`
- `worldHoldInteraction`
- `liveRouteChoice`
- `fullPause`
- `traversalHold`
- route branch selection via `selectRouteBranch`
- semantic music changes via `changeMusicState`
- in-world inspection interaction
- telemetry tags such as `INSPECTED`, `WAITED`, and `SAW_MOON_REVEAL`
- delayed repercussion scheduling via `after_route_distance`

It is not hard-coded into gameplay by this editor checkpoint.

## Runtime Follow-Up

The dev thread can now wire against stable data names:

1. Register encounter assets from content packs.
2. When level runner consumes `triggers[]`, start encounters for `kind: "encounter"` and `assetRef`.
3. Map `presentationMode` to live route, modal paused, or world-hold UI adapters.
4. Map `pausePolicy` to explicit gameplay domains rather than a single pause boolean.
5. Execute only registered `effects[].type` verbs.
6. Persist active encounter instance state separately from immutable encounter definitions.
7. Schedule `repercussions[]` without executing them at registration time.
8. Emit semantic `telemetryTags` and `directorTags` as observations, not direct player-model assignments.

## Current Limits

The first editor pass edits the primary state and quick choices through form controls. Full state graphs, interactions, and repercussions are still editable through raw JSON and validated by the shared core validator.

Preview is an outcome-tree/readout preview. It does not run in-game pause, world-hold, route-commit, or save/reload simulation yet.

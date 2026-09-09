# Choice / Vignette Encounter Runtime Handoff

Runtime target version: `v1.0.8.24`

This checkpoint adds the first shared encounter infrastructure for authored player decisions. It is intentionally a small runtime slice: modal vignettes can be triggered from sandbox scripts, they pause the main gameplay loop using named pause policies, choices can apply effects, and the runtime state is included in save exports.

## Runtime Modules

- `src/core/encounterDefinition.js`
  - Exports `normalizeEncounterDefinition`, `validateEncounterDefinition`, `encounterState`, and `encounterChoicesForState`.
  - Accepts the handoff-style uppercase names (`MODAL_CHOICE_PAUSED`, `ENCOUNTER_HOLD`) and normalizes them to runtime names (`modalChoicePaused`, `encounterHold`).
  - Validates forward `toState` / `nextState` references after collecting the full state graph.
- `src/core/encounterRuntime.js`
  - Exports `createEncounterRuntimeState`, `registerEncounterDefinition`, `beginEncounter`, `stepEncounters`, `activeEncounterView`, `chooseEncounterChoice`, `encounterPausePolicy`, `serializeEncounterRuntime`, and `hydrateEncounterRuntime`.
  - Named pause policies are:
    - `none`
    - `traversalHold`
    - `encounterHold`
    - `fullPause`
    - custom object policies with explicit domain flags.

## Current Authoring Shape

```json
{
  "schemaVersion": "0.1",
  "assetId": "encounter.example.fork",
  "title": "Fork in the Road",
  "initialState": "start",
  "states": [
    {
      "id": "start",
      "presentationMode": "MODAL_CHOICE_PAUSED",
      "pausePolicy": "ENCOUNTER_HOLD",
      "speaker": "The Road",
      "body": "A bridge groans to the left. A quiet path bends right.",
      "prompt": "Choose a route.",
      "choices": [
        {
          "id": "bridge",
          "label": "Take the bridge",
          "routeBranch": { "branchId": "bridge" },
          "effects": [
            { "type": "setWorldFlag", "flag": "tookBridge", "value": true }
          ],
          "resolves": true
        },
        {
          "id": "low-path",
          "label": "Follow the low path",
          "toState": "lowPath"
        }
      ]
    },
    {
      "id": "lowPath",
      "presentationMode": "MODAL_CHOICE_PAUSED",
      "pausePolicy": "ENCOUNTER_HOLD",
      "body": "The engine hum drops as mist rolls over the road.",
      "choices": [{ "id": "continue", "label": "Continue", "resolves": true }]
    }
  ]
}
```

## Sandbox Hook

Sandbox events now support:

```json
{
  "id": "test-choice",
  "type": "encounter",
  "at": 2,
  "encounter": { "...inline encounter definition": true }
}
```

Registered encounter ids are also supported with `encounterId`, but the current Pages/editor path should prefer inline definitions until packs start shipping encounter assets.

## Pages API

The game page exposes:

- `window.WeyfinderEncounters.normalize(definition)`
- `window.WeyfinderEncounters.validate(definition)`
- `window.WeyfinderEncounters.start(definitionOrId, options)`
- `window.WeyfinderEncounters.choose(choiceId)`
- `window.WeyfinderEncounters.current()`

The existing sandbox API can run event scripts containing encounter events, so the editor can immediately playtest modal choices in Pages.

## Implemented Effects

The first runtime pass supports these effect verbs:

- `setWorldFlag`
- `setEncounterVariable`
- `giveResource` / `consumeResource` for `scrap`
- `advanceTime`
- `changeMusicState`
- `setRouteModifier`
- `selectRouteBranch`
- `setTerrainHold`
- `showText`
- `revealObjectState`
- `addChronicleEntry`
- `addDirectorInfluence`
- `spawnEncounter`
- `scheduleEncounter`

Unsupported future resources are ignored rather than failing the encounter.

## Still Needed

- Road-fork trigger placement and route-branch geometry binding.
- In-world interaction prompts, hit tests, and hold zones.
- Repercussion firing from route distance / biome / director events.
- Editor UI for node graphs, condition builders, and effect builders.
- Save migration policy if encounter definitions move into installable content packs.

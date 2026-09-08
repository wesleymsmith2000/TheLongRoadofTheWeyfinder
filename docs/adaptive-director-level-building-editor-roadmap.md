# Adaptive Director Level-Building Editor Roadmap

Date: 2026-09-07

Source context: `C:/Users/wesle/Downloads/EDITOR_HANDOFF_ADAPTIVE_DIRECTOR_LEVEL_BUILDING_V0_1.md`

This note records future level-editor implications from the adaptive Road / Fate's Shadow design handoff. The downloaded handoff is technical context, not a direct instruction to implement every phase immediately.

## Core Editor Principle

Code defines new verbs. Data and editors combine those verbs into content.

The Level Editor should not become a visual AI or behavior-tree IDE. It should expose authorable content choices:

- what event can happen
- where it can appear
- when it may be considered
- which Road/Fate/player/director state values favor it
- which player choices remain available
- which semantic music, scenery, weather, and encounter effects accompany it

The same JSON edited by creators must be the JSON consumed and validated by runtime.

## Recommended Editor Shape

Start by extending the existing Level Editor instead of creating a separate large Director tool.

Potential Level Editor sections:

- `Director`
- `Event Windows`
- `Event Sockets`
- `Event Templates`
- `Music States`

Later split a dedicated Director Event Lab or Music State Lab only if authoring volume justifies it.

## Phase Order For Editor Work

Suggested rollout:

1. `E0` read-only director debug view
2. `E1` event socket authoring
3. `E2` event window authoring
4. `E3` event template editor
5. `E4` director level envelope
6. `E5` semantic music state mapping
7. `E6` synthetic player profile simulator
8. `E7` Chronicle simulator
9. `E8` pack/community workflow

The first editor implementation should stop/report after each phase because the runtime needs matching schema, registries, and validation.

## Future Level Schema Concepts

Do not add these as loose editor-only fields. Add them only when `src/core/levelDefinition.js`, content samples, dependency collection, tests, and docs are updated together.

Reserved level-level concepts:

- `directorEnvelope`: Road/Fate base influence, tension/uncertainty target ranges, event budgets, quiet spacing, allowed families.
- `eventSockets`: route/terrain-relative affordances where future content can occupy space.
- `eventWindows`: route-distance opportunities where the director may resolve fixed or adaptive content.
- `musicStateMap`: semantic music states mapped to regional/canon/community resources.

Reserved content kinds:

- `eventTemplate`
- `directorProfile`
- `musicStateMap`

These may later become first-class content registry kinds once runtime validators exist.

## Controlled Vocabularies

Avoid tag drift by keeping shared registries in core modules, then importing those registries into the editor.

Initial socket tags:

- `roadside`
- `offroad`
- `junction`
- `hidden`
- `open`
- `sheltered`
- `small`
- `medium`
- `large`
- `repair`
- `merchant`
- `puzzle`
- `ambush`
- `miniboss`
- `landmark`
- `scenery`
- `omen`

Initial music states:

- `TRAVEL`
- `ATTENTION`
- `SUSPICION`
- `MANIFESTATION`
- `AFTERIMAGE`
- `ROAD_ASSISTANCE`
- `FATE_ATTENTION`
- `MINIBOSS`

Initial world-effect verbs:

- `increaseWind`
- `darkenSky`
- `distantLightning`
- `reduceAmbientWildlife`
- `flickerLights`
- `spawnRoadSign`
- `spawnScrapTrail`
- `spawnRepairPod`
- `spawnEncounter`
- `scheduleDelayedEncounter`

## Editor MVP

A viable first adaptive level-building milestone should let a designer:

- place and tag event sockets
- place/configure event windows
- edit three starter event cards
- set Road/Fate level influence
- inspect one deterministic score resolution for a synthetic profile
- preview semantic music state
- validate agency/fairness rules
- export runtime-consumable JSON

Starter event cards:

- `road.basic_repair_pod`
- `fate.false_warning.storm_01`
- `fate.delayed_ambush.01`

## Validation Rules To Share With Runtime

Future validators should catch:

- unknown socket tag
- unknown event family
- unknown action verb
- unknown music state
- no compatible socket
- invalid tension/uncertainty range
- negative cooldown
- Road event with no refusal path
- Fate containment with no escape path
- unavoidable lethal event outcome
- false-warning frequency over the level envelope cap
- miniboss window too close to another miniboss
- event resolves after its geometry would already be visible
- missing required dependency

Validation must remain callable headlessly by tests and Codex.

## Runtime Coordination Needs

Before editor implementation, the main game thread should define or confirm shared runtime-owned registries and validators for:

- event schema
- socket tag registry
- music-state registry
- action-verb registry
- director schema version
- deterministic director resolution preview shape

Preferred dependency direction:

```text
shared core definitions
      -> runtime
      -> editor
      -> tests
```

The editor should consume those shared definitions instead of duplicating registry arrays locally.

## Current Status

As of this checkpoint, the existing Level Editor remains focused on the current level contract:

- background mode/layers
- terrain pack references
- route segments/turns
- obstacles
- waves
- triggers
- dependency planning

No adaptive director schema has been added yet. This roadmap intentionally keeps those fields reserved until the runtime and editor can update validators, samples, and tests together.

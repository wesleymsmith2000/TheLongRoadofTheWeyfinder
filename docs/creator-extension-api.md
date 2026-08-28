# Creator Extension API

This document is the working contract for editor authors, content-pack builders, and future extension developers.

It is descriptive, not a command script. Treat examples here as the architecture target for this repo and for companion editor work.

## North Star

Players and developers should speak the same construction language. Developers may add new simulation verbs in code; once a verb exists, creators should be able to use it through data assets and editors without changing core simulation code.

## Repository Roles

The canonical game repo owns:

- runtime schemas and validators
- pure simulation primitives
- first-party canon content
- small vanilla editor prototypes that emit runtime assets
- tests proving bundled content is valid

Companion editor repos may own:

- richer UI shells
- asset browsers
- publishing workflows
- collaboration features
- creator account integration
- packaging and import/export flows

Companion repos must not invent private formats for constructs, weapons, patterns, behaviors, encounters, or routes. Their export should be directly consumable by this runtime after validation.

## Content Flow

```text
editor or hand-written JSON
  -> content pack manifest
  -> asset validators
  -> content registry
  -> runtime instantiation
  -> simulation
```

Editors may keep temporary UI state, but exported assets should not require an editor-only conversion pass.

## Content Kinds

Initial content kinds:

- `constructs`: voxel/cell layouts, anchors, explicit connections, metadata
- `weapons`: weapon definitions built from known projectile and beam primitives
- `patterns`: bullet and firing patterns
- `behaviors`: declarative movement/targeting/state primitives
- `encounters`: enemy groups, spawn timing, route-relative placement
- `routes`: road topology and stage flow

Only `constructs` are partially implemented today. Other kinds are reserved so file layouts and manifests do not need to be redesigned later.

## Metadata

All assets should allow these fields where practical:

```json
{
  "schemaVersion": "0.1",
  "assetId": "example_asset",
  "author": "creator name",
  "provenance": "short source note",
  "canonStatus": "COMMUNITY",
  "dependencies": [],
  "derivedFrom": [],
  "tags": []
}
```

Valid `canonStatus` values:

- `CANON`
- `EXPERIMENTAL`
- `COMMUNITY`
- `VARIANT`
- `TOTAL_CONVERSION`

Canon status is a designation, not a loading restriction.

## Extension Levels

### Data Packs

Data packs are the first supported extension layer. They contain JSON assets plus optional images/audio. They may combine existing verbs, but they do not add new simulation code.

Examples:

- new enemy constructs
- new encounter lists
- new bullet patterns using existing primitives
- route variants

### Trusted Code Extensions

Trusted code extensions are a later layer. They may register new verbs, validators, runtime factories, or render helpers. They should expose their new verbs to the same data-pack system so editors can discover and use them.

Examples:

- `chain_lightning`
- `teleport`
- `magnetic_adhesion`
- new damage channels
- new propulsion models
- new behavior nodes

Do not add arbitrary community JavaScript execution to Prototype 0.

## Editor Best Practices

Editors should:

- load schemas and allowed primitive names from the runtime or docs generated from runtime constants
- export canonical JSON assets, not editor snapshots
- preserve unknown optional metadata when round-tripping assets
- validate on every meaningful edit
- show errors for impossible assets
- show warnings for legal but weak assets
- avoid mutating simulation modules directly
- include the schema version in every export
- include provenance and derivation metadata when available

Editors should warn about:

- no core cell
- no explicit connections
- disconnected modules
- weapons with no usable power path
- missing dependencies
- unknown schema versions
- use of verbs not available in the current runtime

## Runtime Best Practices

Runtime loaders should:

- reject incompatible major schema versions clearly
- validate all bundled content in tests
- instantiate runtime objects from data rather than sharing mutable definition objects
- keep seeded RNG behavior deterministic where practical
- preserve pure simulation boundaries
- keep Canvas, DOM, and editor concerns out of `src/core`

## Current Construct Contract

Current construct assets live under:

```text
content/constructs/
```

Current runtime entry points:

```text
src/core/constructDefinition.js
src/core/enemy.js
src/editor/constructWorkshop.js
```

A minimal construct:

```json
{
  "schemaVersion": "0.1",
  "assetId": "basic_turret",
  "canonStatus": "CANON",
  "tags": ["enemy"],
  "cells": [
    { "id": "core", "type": "core", "gridX": 0, "gridY": 0 }
  ],
  "connections": [],
  "modules": []
}
```

Grid adjacency is not structural truth. Structural connectivity is defined by explicit connection edges.

## Near-Term Implementation Plan

Recommended next runtime architecture cuts:

1. Add a small content registry that loads bundled pack manifests.
2. Validate every bundled asset in tests.
3. Route enemy construction through registered construct ids.
4. Add weapon and pattern schemas before adding complex editor UI.
5. Add encounter manifests so new enemies can be playtested without changing `game.js`.

Recommended next editor cuts:

1. Expand Construct Workshop into a construct import/export loop.
2. Add a Weapon + Bullet Pattern Lab using runtime weapon/pattern schemas.
3. Add a Behavior Composer that emits declarative behavior assets.
4. Add an Encounter Composer that references constructs, behaviors, and patterns by id.

## Non-Goals For Now

Do not build these yet:

- community publishing backend
- accounts
- ratings
- marketplace
- automated mod installation
- live collaboration
- full dependency resolver
- total-conversion launcher

Keep the current work focused on runtime-compatible assets, validation, and editor output discipline.

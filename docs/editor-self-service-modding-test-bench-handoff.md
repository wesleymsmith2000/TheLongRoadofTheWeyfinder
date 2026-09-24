# Editor Handoff: Self-Service Mod Test Bench

Date: 2026-09-23

## Scope completed in the editor thread

The Creator Suite now includes a browser-local Mod Test Bench that can:

- import or reimport content folders/files through the existing local library
- select an installed pack and browse/search assets
- expand enemy archetype packs into directly selectable enemies
- show definition validation and local/external dependency reports
- open supported assets in their matching editor with the selected JSON already loaded
- prepare enemy, level, or encounter Sandbox scripts
- export a reimportable single-file pack with inline asset definitions
- remove installed local packs

The Construct Workshop also has:

- `Auto-connect`, which fills every missing orthogonal X/Y/Z structural edge
- `Remove Connection`, a two-cell tool for deleting an adjacent edge
- preservation of valid custom edges with duplicate and stale-edge cleanup during auto-connect

## Runtime boundary

The editor does not start game simulation directly. `Test Enemy`, `Test Level`, and `Test Encounter` write both records below and open the game:

```text
weyfinder.creator.testRequest
weyfinder.prototype0.sandboxDefinition
```

`weyfinder.creator.testRequest` shape:

```json
{
  "schemaVersion": "0.1",
  "requestedAt": "ISO timestamp",
  "kind": "enemy | level | encounter",
  "assetId": "selected asset id",
  "sandboxDefinition": {}
}
```

The existing Sandbox UI reads `weyfinder.prototype0.sandboxDefinition`, so the current workflow is:

```text
Creator Suite -> Test ... -> game opens -> Sandbox -> Run Script
```

The runtime thread may optionally consume `weyfinder.creator.testRequest` on game startup to open Sandbox and run the prepared definition automatically. The editor does not require that enhancement and should remain compatible if it is added.

## Matching-editor handoff

The Suite stores one single-use payload in session storage:

```text
weyfinder.creator.assetHandoff
```

Supported routes currently cover constructs, individual enemies, weapons, patterns, status effects, levels, encounters, materials, and lighting presets. This is editor-only state and should not become a runtime content source.

## Portable pack export

`Export Pack` emits one JSON content-pack manifest whose `assets` arrays contain inline definitions rather than path strings. The existing content importer already accepts inline manifest entries, so the exported file can be reimported without ZIP support or filesystem reconstruction.

Large binary resources remain outside this milestone. They should use the planned IndexedDB blob store rather than `localStorage`.

## Verification

```text
npm test        497 passed
npm run build   passed
```

Focused coverage lives in:

```text
tests/modTestBench.test.js
tests/constructConnectionAuthoring.test.js
```

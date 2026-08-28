# Content Pack Manifest

Content packs group related assets so the runtime and editors can validate, list, and playtest them consistently.

The manifest format is intentionally small for Prototype 0. It is meant to grow alongside real editor/runtime needs.

## File Location

Bundled pack manifests should live under:

```text
content/packs/
```

Suggested file name:

```text
<packId>.json
```

Example:

```text
content/packs/canon.prototype0.json
```

## Manifest Shape

```json
{
  "schemaVersion": "0.1",
  "packId": "canon.prototype0",
  "displayName": "Prototype 0 Canon Content",
  "author": "Weyfinder prototype",
  "provenance": "Bundled with the canonical game repo.",
  "canonStatus": "CANON",
  "description": "First-party content used by the Prototype 0 play loop.",
  "tags": ["canon", "prototype"],
  "dependencies": [],
  "assets": {
    "constructs": ["../constructs/basic_turret.json"],
    "weapons": [],
    "patterns": [],
    "behaviors": [],
    "encounters": [],
    "routes": []
  }
}
```

## Required Fields

- `schemaVersion`: manifest schema version. Prototype 0 expects `0.x`.
- `packId`: stable unique id for this pack.
- `displayName`: human-readable name.
- `canonStatus`: content designation.
- `assets`: object listing asset paths by kind.

## Optional Fields

- `author`
- `provenance`
- `description`
- `tags`
- `dependencies`
- `derivedFrom`

Tools should preserve optional metadata when possible.

## Asset Paths

Asset paths are relative to the manifest file unless a future loader explicitly supports another URI scheme.

Prototype 0 should prefer local bundled assets and local imported files. Remote dependency resolution is a later concern.

## Pack Validation Rules

Hard errors:

- manifest is not an object
- incompatible `schemaVersion`
- missing or blank `packId`
- invalid `canonStatus`
- missing `assets`
- asset list is not an array
- an asset path is not a string

Warnings:

- empty pack
- missing optional attribution metadata
- dependencies declared but unavailable in the current runtime
- asset kind reserved but not implemented by the current runtime

## Canon And Community

`CANON` means the pack is part of the canonical repo or an accepted first-party release.

`COMMUNITY`, `VARIANT`, and `TOTAL_CONVERSION` packs should use the same manifest and asset formats. Runtime and editor code should not assume only canon packs are valid.

## Playtest Rule

The ideal playtest flow:

```text
open editor
  -> export content pack
  -> validate pack
  -> load pack in local runtime
  -> choose encounter or route
  -> playtest immediately
```

Do not require hand-coded glue for every new construct or encounter. If new glue is required, it is a sign the schema/registry needs another small primitive.

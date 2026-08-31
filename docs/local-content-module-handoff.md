# Local Content Module Handoff

This handoff is for the editor development thread. The main game now has a local content module API that editor tools can export to and the browser runtime can import from local storage.

## Added Runtime Surface

New module:

```text
src/core/localContentLibrary.js
```

It provides local-file import, content-pack assembly, validation, persistence, registry hydration, and level package instantiation. It uses the existing canonical schemas and `src/core/contentRegistry.js`; editors should not invent a separate export format.

Browser exposure:

```text
window.WeyfinderContentModules
```

The global API includes:

- `installFiles(fileList, options)`
- `createBundleFromFiles(files, options)`
- `installBundle(bundle, options)`
- `listPacks()`
- `removePack(packId)`
- `createRegistry()`
- `instantiateLevel(levelId, seed)`

## What Editors Should Export

Export a folder or zip contents that can be selected as files by the browser:

```text
creator_pack/
  packs/creator_pack.json
  constructs/*.json
  weapons/*.json
  patterns/*.json
  enemies/*.json
  levels/*.json
```

The manifest should reference assets with paths relative to the manifest file. Loose JSON exports are accepted for quick iteration, but pack manifests are the preferred path because dependencies and attribution are clearer.

## Integration Contract

Editor-authored assets should keep using these validators:

- `validateConstructDefinition`
- `validateWeaponDefinition`
- `validatePatternDefinition`
- `validateEnemyArchetypePack`
- `validateLevelDefinition`
- `validateContentPack`

The game-side importer stores validated local packs in browser `localStorage`, then rebuilds a registry via `createRegistryWithLocalContent`. This means editor tools can playtest without changing repo files, and canon integration can remain a later deliberate step.

## Needed Next Bridge

The current API resolves custom level packages, but the live Prototype 0 wave loop still mostly uses hard-coded schedule construction in:

```text
src/core/game.js
```

Next editor-facing runtime work:

- Add a small level-runner adapter that converts `instantiateLocalLevel(...).definition.waves` into the active enemy spawn queue.
- Add encounter manifests so enemy groups can reference archetypes, movement profiles, and pattern sets by id.
- Allow the launch screen or a future module screen to choose between canon progression and an installed local level.
- Keep behavior verbs named and validated before editors expose them as UI options.

## Testing Added

New tests:

```text
tests/localContentLibrary.test.js
```

These cover manifest-relative asset resolution, loose asset pack creation, local persistence, registry hydration, dependency resolution, level instantiation, and pack removal.

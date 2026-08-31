# Local Content Module API

Prototype 0 supports browser-local content packs so players, editors, and outside builders can import JSON modules from disk, persist them in browser `localStorage`, and rehydrate them into the same content registry used by canon assets.

This is intentionally a local-first API. It does not fetch remote code, execute plugin scripts, or bypass validation.

## Runtime Module

Core API:

```text
src/core/localContentLibrary.js
```

Public functions:

- `readLocalContentFiles(fileList)`: reads browser `FileList` or file-like objects into `{ name, path, text }` records.
- `createLocalContentBundleFromFiles(files, options)`: parses selected JSON files, resolves manifest-relative asset paths, and returns `{ manifests, assets, errors, warnings }`.
- `installLocalContentFiles(fileList, options)`: reads, validates, and persists local packs.
- `installLocalContentBundle(bundle, options)`: validates and stores an already-created bundle.
- `listLocalContentPacks(storage)`: returns installed pack summaries.
- `removeLocalContentPack(packId, storage)`: deletes one installed local pack.
- `createRegistryWithLocalContent(storage, baseRegistry)`: loads installed packs into a content registry.
- `instantiateLocalLevel(levelId, options)`: resolves a local level package and its dependencies for playtest.

Browser builds also expose:

```text
window.WeyfinderContentModules
```

Useful calls from a browser console or editor bridge:

```js
await window.WeyfinderContentModules.installFiles(fileInput.files);
window.WeyfinderContentModules.listPacks();
window.WeyfinderContentModules.createRegistry();
window.WeyfinderContentModules.instantiateLevel('creator.level_01', 1147);
window.WeyfinderContentModules.removePack('creator.my_pack');
```

## Import Shape

Preferred import is a folder or multi-file selection containing one content pack manifest plus its referenced assets.

```text
my_pack/
  packs/my_pack.json
  constructs/skiff_enemy.json
  patterns/harpoon_burst.json
  levels/pirates_road_variant.json
```

The manifest should use the canonical pack shape from [Content Pack Manifest](./content-pack-manifest.md). Asset paths are resolved relative to the manifest file. If the browser does not preserve folder paths, the importer falls back to unique file names.

Loose JSON assets without a manifest are accepted for rapid playtest. They are grouped into a synthetic `COMMUNITY` pack using the `packId` passed by the caller.

## Supported Asset Kinds

The current registry can validate and store:

- constructs
- weapons
- patterns
- enemy archetype packs
- levels
- resource descriptors for images, sounds, music, and voxel models

Reserved kinds are still preserved in the manifest vocabulary:

- behaviors
- encounters
- routes

Those should become the next bridge between editor-authored content and the active wave/AI loop.

## Safety Rules

Local modules are data, not executable code.

- No arbitrary script execution.
- No network loading in Prototype 0.
- No silent overwrite of canon content in source files.
- Invalid simulation assets block installation.
- Missing optional resources may warn when the level can still instantiate.
- Packs are stored per browser origin in `localStorage` under `weyfinder.prototype0.localContentPacks`.

## Playtest Path

The editor thread should target this flow:

```text
export manifest + JSON assets
  -> user selects folder or files in the game
  -> createLocalContentBundleFromFiles
  -> installLocalContentBundle
  -> createRegistryWithLocalContent
  -> instantiateLocalLevel
  -> runtime level runner consumes the level package
```

The last step is not fully data-driven yet. Custom level packages can be validated and resolved now; the active Prototype 0 enemy schedule still needs a small runner adapter for custom waves, encounters, and routes.

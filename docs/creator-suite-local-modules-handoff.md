# Creator Suite Local Modules Handoff

Date: 2026-08-31

This handoff is for the main game dev thread and future editor work. It summarizes the first unified creator shell and the editor-side integration with the new local content module importer.

## What Was Added

- Added a unified static editor shell:
  - `tools/creator-suite.html`
  - `src/editor/creatorSuite.js`
- Added Creator Suite to the Vite multi-page build:
  - `vite.config.js`
- Added navigation to the suite from:
  - `index.html`
  - `tools/construct-workshop.html`
  - `tools/enemy-editor.html`
  - `tools/weapon-pattern-lab.html`
  - `tools/level-editor.html`
- Added local module install/import controls to:
  - `tools/enemy-editor.html`
  - `src/editor/enemyEditor.js`
- Added an importable example module set:
  - `content/examples/prototype0-module-set/`
- Updated the docs index:
  - `docs/README.md`

## Current Creator Suite Behavior

The suite is a static shell that loads the existing vanilla editors in an iframe:

- Mob / Construct Workshop
- Enemy Editor
- Projectile / Weapon / Pattern Lab
- Level Editor

It also exposes a small local module manager:

- install the bundled example module set
- import a structured content-pack folder
- import loose JSON files
- list installed local packs
- remove installed local packs

All imports go through:

```text
src/core/localContentLibrary.js
```

The suite does not create a new editor-only format. Imported files are validated through the existing content registry and stored in browser local storage for the current origin.

## Enemy Editor Local Module Behavior

The Enemy Editor can now:

- install the current enemy archetype pack directly into local browser storage
- import a structured content-pack folder
- import loose JSON files
- show installed local packs and validation errors/warnings
- continue exporting/download JSON for repo integration or sharing

The current install path wraps the edited enemy archetype pack in a content-pack manifest with `enemyArchetypes` assets, then calls `installLocalContentBundle`.

## Example Module Set

The repo now includes a complete example folder for testing Creator Suite import:

```text
content/examples/prototype0-module-set/
```

It is namespaced with `example.*` ids and contains:

- one content-pack manifest
- two construct definitions
- three weapon definitions
- two enemy pattern definitions
- one status effect definition
- one enemy archetype pack
- one level definition
- one placeholder sound resource descriptor

This is meant to be the first known-good folder import sample for editor development and later download/export work.

The Creator Suite also imports this same example as a bundled JS asset through:

```text
src/editor/examplePrototype0ModuleSet.js
```

That gives Pages users an **Install Example** path even when they cannot browse to the repo folder on disk.

## DroidScript Handoff Review

The earlier DroidScript editor handoff is useful here as a UX and deployment reference, but not as a separate source of schema truth.

Adopted guidance:

- Keep creator terms friendly while saving runtime assets:
  - Mob / Construct -> `constructs`
  - Projectile / Weapon -> `weapons[].projectile`
  - Firing Pattern -> `patterns`
- Keep the editor stack as static HTML/CSS/JS for GitHub Pages.
- Use browser file inputs, downloads, and local storage instead of DroidScript file APIs.
- Reuse authoritative runtime validators instead of copying validation rules into editor-only code.
- Preserve the later path toward a test chamber and PWA/offline install.

Not adopted yet:

- No standalone `mob.json` or `projectile.json` schema.
- No separate DroidScript runtime path.
- No authenticated GitHub commit/PR flow.
- No PWA service worker until the Pages editor loop is stable.

## GitHub Pages Viability

Yes: the unified editor can run on GitHub Pages as a static Vite multi-page deployment.

Pages can host:

- `tools/creator-suite.html`
- `tools/construct-workshop.html`
- `tools/enemy-editor.html`
- `tools/weapon-pattern-lab.html`
- `tools/level-editor.html`
- shared static JS/CSS/assets produced by `npm.cmd run build:pages`

Pages can support:

- local JSON/folder import via browser file inputs
- browser-local pack persistence through `localStorage`
- downloading JSON exports
- iframe-based navigation among editor pages
- preview/playtest flows that run entirely client-side

Pages cannot directly provide:

- arbitrary read/write access to the player's drive without a file picker
- direct commits back to the GitHub repository
- multi-user collaboration
- account/cloud inventory sync
- server-side module publishing or moderation

Those need either manual download/upload, GitHub workflow integration, or a later service layer.

## Main Dev Runtime Work Still Needed

The local module infrastructure can hydrate a registry and instantiate local level packages, but the live gameplay loop still needs a bridge from registry content into actual runs.

Recommended next runtime work:

1. Add a launch/playtest path that lets the player choose an installed local level from `window.WeyfinderContentModules.listPacks()` / `createRegistry()`.
2. Route level waves through registry-backed constructs, patterns, and enemy archetype ids.
3. Add runtime support for enemy `movementProfiles`, `aggregate`, and `cellAnimations` descriptors.
4. Add an encounter layer so aggregate enemies, boss assemblies, and pattern mixes can be authored without changing `src/core/game.js`.
5. Add resource activation rules so a behavior/content pack can require its paired resource pack before play.

## Suggested Editor Work Next

- Teach Construct Workshop to install/download construct packs.
- Teach Weapon / Pattern Lab to install/download weapon and pattern packs.
- Teach Level Editor to import installed content ids into wave/dependency selectors.
- Add a playtest button in the Creator Suite once the runtime exposes a level-runner adapter.
- Keep richer collaboration, publishing, and account sync outside Prototype 0 until the static local pack loop is stable.

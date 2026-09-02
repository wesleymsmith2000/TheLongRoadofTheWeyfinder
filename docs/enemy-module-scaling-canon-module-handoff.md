# Enemy Module Scaling And Canon Module Handoff

Date: 2026-09-02

Runtime checkpoint: `v1.0.3.0`

## What Changed In Runtime

Enemy bodies now get a Prototype 0 runtime enlargement pass in `src/core/enemy.js`.

- `ENEMY_MODULE_LINEAR_SCALE` is `2`.
- Non-core enemy cells are expanded into explicit `2x2` module blocks.
- Voxel masks stay the same size; the system increases cell/module count instead of scaling voxel pixels.
- Core cells stay singular for now so existing destruction rules stay readable.
- Explicit structural edges are regenerated from the expanded module grid.
- Enemy presentation sprite `displaySize` is doubled when a sprite is already attached.
- The older frog-only `visualScale` enlargement has been replaced with module footprint scaling.

Current examples:

- Basic 3x3 turret enemy: 9 cells becomes 33 cells.
- One gun module becomes 4 gun modules.
- Runtime pirate ships, mortar skiffs, phantoms, frogs, moths, buzzards, walkers, and bosses inherit the same non-core expansion.
- Boss core modules remain singular in this adapter; boss enlargement should still be authored deliberately because arms and central-core destruction have special rules.

This is a gameplay-facing bridge, not the desired final authoring shape.

## Editor Goal

Move enemy enlargement out of the runtime adapter and into editable canon/module content.

The editor should author enlarged enemies as normal construct/module data:

- Keep `CELL_SIZE` and voxel masks unchanged.
- Increase visible size by adding more cells/modules.
- Preserve explicit graph edges; do not rely on implicit grid adjacency after export.
- Keep one clearly identifiable core unless the editor/runtime also updates multi-core destruction semantics.
- Multiply armor, gun, engine, wheel, and special modules in proportion to the intended silhouette.
- Update sprite `displaySize` and anchors to match the authored module footprint.

Target feel: roughly double linear size, which usually means about 3.5x to 4.5x non-core cell count, with hand-tuned silhouettes where a strict 2x grid copy looks clumsy.

## Central Canon Module Format

The repo already has the runtime canon manifest at:

```text
content/packs/canon.prototype0.json
```

The editor-facing editable copy should become one central module-pack root:

```text
content/examples/prototype0-module-set/
```

That folder should include editable copies of every bundled Prototype 0 content surface:

- constructs
- weapons
- enemy patterns
- enemy archetypes
- levels
- terrain materials
- terrain tiles
- status effects
- image resources for weapons, enemies, and terrain
- sound/music descriptors when they become editable

Keep subfolders for readability, but make the pack manifest the single entry point. A user should be able to copy or import the module-set folder and find all editable level/enemy/weapon/terrain content from that one root.

## Canon Module Refresh Checklist

When refreshing the editable module set, update these together:

- `content/examples/prototype0-module-set/packs/example.prototype0_module_set.json`
- `src/editor/examplePrototype0ModuleSet.js`
- all copied JSON assets under `constructs/`, `weapons/`, `patterns/`, `enemies/`, `levels/`, `terrain/`, and `resources/`
- tests in `tests/localContentLibrary.test.js`, `tests/weaponPatternDefinition.test.js`, `tests/zoneEnemyExampleContent.test.js`, `tests/enemyArchetypeDefinition.test.js`, and `tests/terrainContent.test.js`
- docs that describe importable modules, especially `docs/local-content-module-api.md`

Important gap to close: the current module-set example predates the full enemy sprite pass and does not yet mirror every canon resource descriptor. The editor should regenerate it from `content/packs/canon.prototype0.json` so it stays aligned.

## Enemy Enlargement Authoring Checklist

For each enemy archetype:

- Replace runtime-only shapes with data constructs where possible.
- Give every runtime factory enemy a construct or construct-like editable source:
  - pirate ship
  - pirate ram ship
  - mortar skiff
  - starlight/twilight walker body
  - scrap buzzard
  - inchworm carrier
  - moth bomber
  - ghost phaser
- Expand non-core modules into authored cells instead of relying on `ENEMY_MODULE_LINEAR_SCALE`.
- Preserve original role balance: guns should multiply enough to remain targetable, but firing rate should still be controlled by weapon/pattern timing.
- Update `presentation.sprite.displaySize` and `presentation.sprite.anchor`.
- Update radius-sensitive gameplay tests after the authored constructs replace the runtime adapter.

## Removal Plan For The Runtime Adapter

When the editor-authored enlarged enemies are ready:

1. Load enlarged constructs/archetypes from the central module pack.
2. Confirm all current enemy factories can use authored content or thin factory descriptors.
3. Remove or set `ENEMY_MODULE_LINEAR_SCALE` back to `1`.
4. Delete/update the runtime enlargement tests that assert the adapter behavior.
5. Keep tests that assert the authored enemies are larger by module count.

## Versioning

This checkpoint uses `v1.0.3.0` because enemy module scaling and canon module organization are a new editor-facing content line.

Use `v1.0.3.1`, `v1.0.3.2`, and so on for follow-up fixes on this line. Move to `v1.0.4.0` if the editor lands the central regenerated module-pack copy or replaces runtime factories with authored enemy constructs.

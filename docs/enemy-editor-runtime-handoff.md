# Enemy Editor Runtime Handoff

Date: 2026-08-30

This handoff is for the main game dev thread and future editor work. It summarizes the new enemy editor surface and the runtime gaps that still need engine-side support before custom enemies are fully playable from exported packs.

## What Was Added

- Added a new Enemy Editor page:
  - `tools/enemy-editor.html`
  - `src/editor/enemyEditor.js`
- Added the editor to the Vite multi-page build:
  - `vite.config.js`
- Added navigation links from:
  - `tools/construct-workshop.html`
  - `tools/weapon-pattern-lab.html`
  - `tools/level-editor.html`
- Extended enemy archetype validation in:
  - `src/core/enemyArchetypeDefinition.js`
- Added an experimental ghost/fabric enemy archetype template in:
  - `content/enemies/prototype0_enemy_archetypes.json`
- Updated creator docs for the new descriptor fields:
  - `docs/creator-extension-api.md`

## Editor Capabilities Now

The Enemy Editor can now create and export a valid enemy archetype pack with:

- runtime factory selection
- construct reference selection
- pattern selection
- entry behavior
- palette-preserving archetype data
- `movementProfiles`
- `aggregate`
- `cellAnimations`
- live validation through `validateEnemyArchetypePack`
- animated canvas preview for movement and cell animation intent
- JSON import/export

The editor intentionally composes enemies from existing content seams. Construct voxel editing still belongs in Construct Workshop, and weapon/pattern editing still belongs in Weapon + Pattern Lab.

## New Descriptor Fields

`movementProfiles[]` describes reusable movement intent:

```json
{
  "id": "fabric-weave",
  "kind": "weave",
  "target": "player",
  "speed": 42,
  "amplitude": 34,
  "frequency": 0.9,
  "phaseOffset": 0.6
}
```

Supported validated movement kinds:

- `drift`
- `charge`
- `returnToView`
- `orbitTarget`
- `strafeBroadside`
- `weave`
- `bossTentacleSwarm`

`aggregate` describes whether an enemy is a single body, a limb array, or a multi-part boss:

```json
{
  "kind": "multiPartBoss",
  "parts": [
    {
      "id": "arms",
      "role": "arm",
      "count": 8,
      "attachment": "radial",
      "movementProfile": "primary-movement"
    }
  ]
}
```

Supported validated aggregate kinds:

- `singleBody`
- `limbArray`
- `multiPartBoss`

`cellAnimations[]` describes renderable module/cell animation:

```json
{
  "selector": "type:armor",
  "kind": "fabricWeave",
  "amplitude": 12,
  "frequency": 1.1,
  "phaseOffset": 0.4,
  "opacityMin": 0.35,
  "opacityMax": 0.78
}
```

Supported validated cell animation kinds:

- `none`
- `opacityPulse`
- `sineWave`
- `swirl`
- `fabricWeave`

## Viability Status

The editor is viable today for designing and exporting enemy archetype descriptors. It is not yet a complete playable enemy authoring loop.

Creators can start building:

- new enemy archetype packs
- new combinations of existing constructs and patterns
- movement intent for future runtime support
- aggregate boss/limb descriptions
- ghost/fabric-style animation descriptions

Creators cannot yet expect the live game runtime to execute all exported movement, aggregate, or cell animation descriptors. The editor marks this in its status panel.

## Main Dev Runtime Work Needed

To make exported enemies fully playable, the main runtime needs:

1. Registry-backed enemy instantiation from archetype ids.
2. Construct lookup by `archetype.construct`, including custom construct ids from content packs.
3. Pattern lookup by `archetype.patterns`, including custom pattern ids from content packs.
4. A behavior runner for `movementProfiles[]`.
5. Aggregate entity support for `aggregate.kind = "limbArray"` and `aggregate.kind = "multiPartBoss"`.
6. Renderer support for `cellAnimations[]` on runtime enemies.
7. Selector support for at least:
   - `*`
   - `type:<cellType>`
   - future `id:<cellId>`
   - future `part:<aggregatePartId>`
8. A playtest bridge:

```text
editor JSON -> validate -> register in content registry -> instantiate test encounter/level -> run seeded preview
```

## Suggested Runtime Landing Order

1. Add a pure archetype instantiation helper:

```js
createEnemyFromArchetype(archetype, registry, position, rng)
```

2. Route standard level spawns through archetype ids while preserving current hard-coded fallback factories.
3. Add movement primitive stepping separate from `game.js`:

```js
createEnemyBehaviorState(archetype, rng)
stepEnemyBehavior(enemy, behaviorState, gameView, dt)
```

4. Add render-only `cellAnimations` support before making those animations affect collision.
5. Add aggregate boss support after single-body archetype spawning is stable.

## Verification

Passed locally:

```text
npm.cmd test
npm.cmd run build
npm.cmd run build:pages
```

Latest observed test count:

```text
149 passed
```

The Pages build required elevated filesystem access in Codex on Windows because of the existing Vite config path sandbox issue. The elevated build passed.

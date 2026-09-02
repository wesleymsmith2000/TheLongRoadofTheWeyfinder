# Sandbox Mode Editor Handoff

Runtime checkpoint: `v1.0.5.0`

Pages now exposes a first-pass sandbox runner for testing editor-authored enemies, constructs, weapons, and timed events without playing through campaign levels.

## Runtime Entry Points

- UI: open the top `SBOX` button in Pages.
- Browser API: use `window.WeyfinderSandbox`.
- Quick enemy run:

```js
window.WeyfinderSandbox.quickSpawn('heavy_mortar_boat.pirates_road', {
  count: 2,
  frequency: 0.5,
  spread: 92,
  level: 3,
});
```

- Scripted run:

```js
window.WeyfinderSandbox.run({
  schemaVersion: '0.1',
  title: 'Mortar Boat Timing Test',
  duration: 120,
  level: 3,
  completeOnEmpty: false,
  spawns: [
    { id: 'first-boat', archetype: 'heavy_mortar_boat.pirates_road', at: 0, count: 1, roadY: -220, speed: 18 }
  ],
  events: [
    { id: 'scrap', type: 'setScrap', at: 0, value: 120 },
    {
      id: 'second-wave',
      type: 'spawn',
      at: 8,
      spawns: [
        { archetype: 'mortar_skiff.prototype0', count: 3, interval: 1.2, spread: 84, roadY: -180 }
      ]
    }
  ]
});
```

## Definition Shape

- `schemaVersion`: should match the current content schema, presently `0.1`.
- `title`: shown in the level HUD as `Sandbox: ...`.
- `duration`: used only for the sandbox progress bar.
- `level`: applies runtime enemy level scaling.
- `completeOnEmpty`: if `true`, the sandbox can complete when enemies/spawns/scrap are empty. Default is `false` so tests can keep running.
- `spawns`: initial spawn records.
- `events`: timed event records, sorted by `at`.

Spawn fields:

- `archetype` or `enemy`: enemy archetype id. Canon ids and local editor-installed enemy archetypes are supported.
- `construct`: optional construct id lookup through archetypes that reference that construct.
- `at`: seconds after sandbox start.
- `count`: number of enemies to create.
- `interval`: seconds between repeated enemies.
- `frequency`: quick authoring alias; converted to `1 / frequency` when `interval` is absent.
- `laneOffset`: center offset from the road center.
- `spread`: spacing between repeated enemies.
- `randomLaneOffset`: random offset range per enemy.
- `roadY`: road-relative spawn Y. Negative values spawn ahead.
- `entry`: `ahead` by default, or `behind`.
- `speed`: initial travel speed.
- `level`: optional per-spawn level override.

Event types:

- `spawn`: queues one or more spawn records.
- `clearEnemies`: clears enemies, enemy projectiles, and incoming markers.
- `setScrap`: sets current scrap.
- `addScrap`: adds to current scrap.
- `setTargetingMode`: accepts `manual`, `guided`, or `mixed`.
- `message`: writes a sandbox status message.
- `complete`: arms completion and immediately shows the level-complete screen.

## Local Content

The sandbox enemy picker and API merge canon archetypes with locally installed content packs from `WeyfinderContentModules`. After the editor installs a new pack, call:

```js
window.WeyfinderSandbox.enemies();
```

The `SBOX` panel also has `Refresh Content` for manual browser testing.

## Frog/Hopper Presentation Rule

The canon Digitized Stream hopper remains `presentation.variant: "tractorFrog"` but must not include a `presentation.sprite`. The runtime renderer also ignores stale `tractorFrog` sprite overlays so the visible body comes from the voxel/cell model plus procedural frog-like motion and accents.

Editors should update examples so frog/hopper enemies are sculpted as voxelized frog shapes instead of using `sprite.enemy.tractor_frog`.

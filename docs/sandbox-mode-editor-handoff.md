# Sandbox Mode Editor Handoff

Runtime checkpoint: `v1.0.23.0`

`v1.0.24.0` adds **Offscreen hazard test > Add Hazard**, **Run Hazard Course**, and the
Hostile Wavelet Cannon/Gravity Bombard enemies. `WeyfinderSandbox.fireHazard(kind, options)`
fires a test attack without an enemy source. Timed/distance `hostileAttack` events use inline
`attack`, `origin`, `target`; `atDistance` takes precedence over `at`. See
[the hostile spatial attack contract](hostile-spatial-weapons.md).

## Arcade testing

In **SBOX**, select **Gameplay rules > Arcade** before starting a test. The selector updates the script's `runMode`; Run Quick and Play Custom Level also use that selection. Every Run starts a fresh vehicle with the selected rules. Arcade uses the Arcade hull, loadout policy, Guided AI default, forward firing, movement, larger terrain tiles, doubled road speed and emergency primary. Default/older Sandbox scripts still use Normal.

Quick/script/custom tests keep their authored spawns without ambient Diver waves or automatic boss staging. To test the live director, enter the campaign **Level** number and press **Test Campaign Level**. This includes scheduled/gap Divers, warnings and boss staging. Level transitions retain Sandbox access; these tests do not award account achievements or campaign boss clears. Arcade slots retain starter availability; use Workshop Loadout and the existing Sandbox upgrade/repair/ammo controls for equipment tests.

The **Music / zone preview** selector overrides the test's bundled track; Default uses the custom level's `music`, the campaign level's track, or silence for quick scripts. It also selects zone flavor for explicitly scripted Divers. Campaign enemy composition and scheduled Diver zone still follow the campaign Level number.

```js
WeyfinderSandbox.quickSpawn('diver.ghost', {
  runMode: 'arcade', music: 'GhostForrestPathway_1', level: 19
});
WeyfinderSandbox.runCampaignLevel(19, { runMode: 'arcade' });
WeyfinderSandbox.runLevel('local.level.ghost_forrest_music_trial', { runMode: 'arcade' });
```

See [GhostForrest music and level authoring](./ghost-forrest-music-and-levels.md) for a sample and import steps.

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
- `runMode`: `normal` (default) or `arcade`; legacy `lite` normalizes to `arcade`.
- `music`: optional bundled track key without `.mp3`; null selects the default.
- `useLevelSchedule`: optional boolean, default `false`. When true, use the campaign schedule for `level` instead of initial `spawns`, with the live Arcade director when applicable. Timed `events` still run. Cannot be combined with `sourceLevelId`.
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
- `encounter`: starts a choice/vignette encounter. Use `encounter` for an inline encounter definition, or `encounterId` for a definition already registered in runtime content. See [Choice Vignette Encounter Runtime Handoff](./choice-vignette-encounter-runtime-handoff.md).
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

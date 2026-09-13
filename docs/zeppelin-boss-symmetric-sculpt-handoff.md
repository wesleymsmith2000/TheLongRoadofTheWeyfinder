# Zeppelin Boss Symmetric Sculpt Handoff

Runtime version target: `v1.0.8.34+`

## Summary

The editor/content side now includes a sculpted Zeppelin boss construct that can replace the provisional runtime-generated model once the game thread is ready to wire it into `boss.zeppelin.prototype0`.

New construct asset:

- `example.construct.zeppelin_boss_sculpted`

New editor-facing enemy template:

- `example.zeppelin_boss.starlight_twilight`

Primary source files:

- `content/examples/prototype0-zone-enemy-set/constructs/example.construct.zeppelin_boss_sculpted.json`
- `content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json`
- `scripts/generate-sculpted-zone-enemy-constructs.mjs`

The construct is also registered in:

- `content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json`
- `src/editor/constructCatalog.js`
- `src/editor/exampleZoneEnemySet.js`

The enemy template is included in the example zone enemy archetype pack so the boss appears in the Enemy Editor template dropdown, not only in the Construct Workshop load dropdown.

## Sculpt Notes

The model is a layered ellipsoid airship hull mirrored across its long X axis.

Current generated counts:

- `758` cells
- `757` structural connections
- `521` `zeppelinHull` armor cells
- `223` `innerLining` armor cells
- `1` `zeppelinCore` undercarriage core cell
- `3` `zeppelinCannon` gun cells
- `8` `zeppelinFin` armor cells
- `2` `zeppelinThruster` engine cells

The editor-side test suite asserts that every non-centerline cell has a mirrored counterpart at `gridY * -1` with the same `gridX`, `gridZ`, `type`, and `role`.

## Runtime-Facing Roles

The construct preserves the role names from `docs/zeppelin-boss-editor-handoff.md`:

- `zeppelinHull`: exterior shell armor and the primary outer hull damage group
- `innerLining`: interior shell armor used for meltdown threshold checks
- `zeppelinCore`: player-readable undercarriage weak point
- `zeppelinCannon`: ATS rocket and ground laser source candidates
- `zeppelinFin`: mirrored rear stabilizer fins
- `zeppelinThruster`: mirrored rear engine cells

Additional metadata:

- Hull cells carry `damageGroup: "zeppelinHull"`.
- Lining cells carry `damageGroup: "innerLining"`.
- Cannons carry `damageGroup: "zeppelinCannons"` and `runtimeSource: "zeppelinWeapon"`.
- The core carries `damageGroup: "zeppelinCore"` and `runtimeWeakPoint: true`.
- Thrusters carry `damageGroup: "zeppelinThrusters"`.

## Suggested Game Thread Wiring

The current runtime still uses `createZeppelinBossEnemy` in `src/core/enemy.js`. To adopt this sculpt, the game thread should:

1. Import `example.construct.zeppelin_boss_sculpted.json` as a runtime construct definition.
2. Instantiate it through the same construct-backed enemy path used by other sculpted enemies, preserving:
   - `kind: "zeppelinBoss"`
   - `archetypeId: "boss.zeppelin.prototype0"`
   - `elevation` settings from the existing procedural Zeppelin
   - `zeppelin` runtime state from the existing procedural Zeppelin
   - `visualScale`, `visualHeading`, radius handling, and airborne collision behavior
3. Keep all behavior hooks role-driven:
   - `zeppelinCannonSources(enemy)` should continue scanning `role === "zeppelinCannon"`.
   - meltdown should continue reading the `innerLining` damage group.
   - core/weak-point handling should read `zeppelinCore`.
4. If runtime needs a denser cannon assembly than the three authored source cells, keep the three `zeppelinCannon` cells as source anchors and attach visual barrels procedurally or as child constructs later.

The editor-facing archetype `example.zeppelin_boss.starlight_twilight` already points at the sculpted construct and preserves the runtime-facing metadata:

- `runtimeFactory: "createZeppelinBossEnemy"`
- `baseArchetype: "boss.zeppelin.prototype0"`
- `presentation.variant: "zeppelinBoss"`
- `zeppelin.innerLiningDamageGroup: "innerLining"`
- `zeppelin.hullDamageGroup: "zeppelinHull"`
- `zeppelin.harpoonFieldRequiredForGroundFire: true`

## Dev Lookup Tags

Use these to find the asset quickly in the editor/catalog:

- `dev-lookup:zeppelin-boss-symmetric`
- `runtime-hook:zeppelinBoss`
- `boss`
- `zeppelin`
- `airship`
- `starlight-road`
- `twilight-crossroads`

## Verification

Editor-side coverage was added to `tests/zoneEnemyExampleContent.test.js`:

- construct validates as part of the example zone enemy pack
- required Zeppelin roles exist with expected types
- hull/lining counts are large enough for boss shell gameplay
- `dev-lookup` and runtime hook tags are present
- long-axis mirror symmetry is preserved

Recommended checks:

```powershell
npm.cmd test -- tests\zoneEnemyExampleContent.test.js
npm.cmd run build
```

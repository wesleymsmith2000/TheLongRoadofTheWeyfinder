# Zeppelin Boss Editor Handoff

Runtime version target: `v1.0.8.8`

## Runtime Status

The game now includes a provisional runtime-generated Zeppelin boss at `boss.zeppelin.prototype0`. It is used for Starlight Road and Twilight Crossroads boss tracks whose names include `Boss` or `BossFight`.

The runtime model is intentionally rough and should be replaced by a sculpted editor-authored construct once the editor thread has a version ready.

## Sculpted Construct Requirements

Preserve these runtime-facing ids and roles:

- `assetId`: propose `example.construct.zeppelin_boss_sculpted`
- `archetypeId`: propose `boss.zeppelin.prototype0` or an archetype that aliases to it
- Core: one or more connected undercarriage core cells with role `zeppelinCore`
- Hull: football/zeppelin silhouette, hollow interior, 2-cell-thick walls
- Inner lining: hull cells on the interior surface should use role `innerLining`
- Outer hull: exterior armor cells should use role `zeppelinHull`
- Cannons: three gun cells or grouped gun assemblies with role `zeppelinCannon`
- Cannon locations: port underside, starboard underside, forward underside/nose
- Rear details: fins with role `zeppelinFin`, thrusters/engines with role `zeppelinThruster`

The current scale target is roughly:

- Length: about 2x width
- Width: about 2x height
- Height: flattened, visibly layered in z
- Walls: about 2 cells thick

## Runtime Hooks To Preserve

The runtime behavior scans roles instead of hard-coded cell ids where possible:

- `zeppelinCannon`: used as ATS rocket and ground laser sources
- `innerLining`: if more than 10% of these cells are destroyed, the boss enters internal meltdown
- `zeppelinCore`: undercarriage core placement for player-readable weak point

The provisional boss is airborne. Ground-fire projectiles cannot damage it unless `harpoonField` is active; arc weapons can still hit it.

## Encounter Behavior Implemented

- Strafing: B-lines across the arena, exits, turns toward the player, and repeats
- Harpoon assist: charges for 2 seconds, attaches for 10 seconds, then repeats
- Harpoon effect: pulls non-beam player projectiles toward the attachment point and enables normal ground fire to damage the boss
- ATS grav rockets: drop slowly from cannons, then lock the player's current location and fly straight to that point
- Warning marker: shown for the ATS locked impact point during the ground-launch phase
- Ground lasers: cannons fire octopus-boss-strength red ground beams
- Walker drops: every fifth strafe, the boss drops the zone walker if fewer than 5 walkers are active
- Meltdown: destroying more than 10% of the `innerLining` triggers internal explosions, then a large burst

## Editor Follow-Up

Please create a sculpted version that keeps the roles above and adds a clear football/airship silhouette. Once ready, the runtime can replace `createZeppelinBossEnemy` with a construct-backed `createEnemyForArchetype` path, while keeping the same behavior hooks.

Also verify the moth bomber construct stays small: it should be built from single-cell blocks, not doubled enemy module blocks.

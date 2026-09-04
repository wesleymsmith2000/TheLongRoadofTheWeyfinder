# Walker Cannon Boss Editor Handoff

Date: 2026-09-04

Runtime/editor checkpoint: `v1.0.7.6`

## Editor Content Added

The editor example pack now includes a larger walker boss body and a reusable rotatable cannon construct:

- `example.construct.burly_walker_boss_body_sculpted`
- `example.construct.rotatable_boss_cannon_sculpted`

Both are registered in:

```text
content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json
src/editor/constructCatalog.js
src/editor/exampleZoneEnemySet.js
```

They appear in the Construct Workshop `Load Construct` dropdown and expose dev lookup tags in the workshop lookup panel.

## Lookup Tags

Use these tags to find the assets quickly in editor/runtime content scans:

- Boss body: `dev-lookup:walker-boss-body-burly`
- Cannon: `dev-lookup:boss-rotatable-cannon`
- Walker behavior hook: `runtime-hook:walkerLegs`
- Aggregate boss hook: `runtime-hook:aggregateBoss`
- Rotating cannon hook: `runtime-hook:rotatableCannon`

## Boss Body Anatomy

`example.construct.burly_walker_boss_body_sculpted` is a larger variant of the burly four-leg walker. The central body is roughly 50% wider than the normal burly walker body and the leg stacks extend through `gridZ` levels `0` through `5`.

Each leg layer uses this footprint:

```text
-AAA-
AAWAA
AWWWA
AAWAA
-AAA-
```

The `W` cells are authored as `wheel` cells tagged `supportLeg`. Leg/body attachment cells sit at `gridZ: 6` and are authored as `engine` cells tagged `legJoint`. Body cells are tagged `elevatedBody`.

The body also includes `utility` cells tagged `cannonMount`. Their `slot` metadata advertises mount targets:

- `leftCannonMount`
- `rightCannonMount`
- `topCannonMount`

## Cannon Anatomy

`example.construct.rotatable_boss_cannon_sculpted` is a standalone construct intended to be mounted as a boss sub-part. It has:

- one `core` pivot cell
- `engine` cells tagged `rotationJoint`
- `utility` cells tagged `mountSocket`
- `gun` cells tagged `cannonBarrel`
- `armor` cells tagged `cannonHousing`

The `mountSocket` cells include:

```json
{
  "acceptsAttachment": "cannonMount",
  "rotation": "runtimeControlled"
}
```

## Example Archetype Descriptor

The zone enemy archetype pack now includes:

```text
example.walker_cannon_boss.twilight_crossroads
```

It is a descriptor-first `multiPartBoss` example with:

- body: `example.construct.burly_walker_boss_body_sculpted`
- left cannon: `example.construct.rotatable_boss_cannon_sculpted`, attached to `slot:leftCannonMount`
- right cannon: `example.construct.rotatable_boss_cannon_sculpted`, attached to `slot:rightCannonMount`
- top cannon: `example.construct.rotatable_boss_cannon_sculpted`, attached to `slot:topCannonMount`

## Main Dev Runtime Work Needed

The current content schema validates the descriptor, but the live runtime still needs the execution bridge:

1. Resolve `aggregate.parts[].construct` for `aggregate.kind = "multiPartBoss"`.
2. Instantiate each part as a separate damageable construct or as a namespaced merged construct while preserving part ownership.
3. Attach cannon parts to body cells by matching `attachment: "slot:<name>"` against body cells with `role: "cannonMount"` and matching `slot` metadata.
4. Treat cannon `rotationJoint` cells as the rotation pivot/health source for aiming. If these are destroyed, the cannon should stop rotating or detach, depending on desired boss behavior.
5. Fire from live `cannonBarrel` cells only.
6. Allow cannon parts to rotate toward the player independently from the walker body.
7. Preserve the walker elevated-body rule: ground fire should not hit `elevatedBody` until the required `supportLeg` damage/fall condition is met, while arc projectiles can hit the elevated body.

The editor side is ready to export and preview these JSON assets. Runtime use should key off the asset ids and lookup tags above.

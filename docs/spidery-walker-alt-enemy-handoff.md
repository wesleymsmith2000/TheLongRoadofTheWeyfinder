# Spidery Walker Alternate Enemy Handoff

Date: 2026-09-05

Runtime/editor checkpoint: `v1.0.4.0`

## Editor Content Ready

The alternate eight-leg walker construct is now complete:

```text
content/examples/prototype0-zone-enemy-set/constructs/example.construct.spidery_walker_sculpted.json
```

Lookup fields:

- `assetId`: `example.construct.spidery_walker_sculpted`
- `displayName`: `Sculpted Spidery Eight Leg Walker Construct`
- Tags: `dev-lookup:walker-spidery-eight-leg`, `runtime-hook:walkerLegs`
- Current example archetypes already using it: `starlight_walker.prototype0`, `example.elevated_walker.starlight_road`

## Leg Anatomy

This model has eight individual support assemblies. Each assembly carries a stable `legId` so runtime code can group damage, debugging, and collapse behavior by leg:

- `leftFrontOuter`
- `leftFrontInner`
- `leftRearOuter`
- `leftRearInner`
- `rightFrontOuter`
- `rightFrontInner`
- `rightRearOuter`
- `rightRearInner`

Per leg:

- `gridZ: 0..5`: one `type: "wheel"` cell with `role: "supportLeg"` on every layer.
- `gridZ: 0..5`: four surrounding armor cells per layer with `role: "legArmor"`.
- `gridZ: 6`: one `type: "engine"` cell with `role: "legJoint"`.

Lower leg-stack layer footprint:

```text
-A-
AWA
-A-
```

The body starts at `gridZ: 6` and keeps `role: "elevatedBody"` for direct-hit gating.

## Runtime Wiring Request

Please wire alternate walker enemies to resolve `archetype.construct` from the active content registry and instantiate `example.construct.spidery_walker_sculpted` when requested. The important behavior hook is that this construct has visible, destructible legs now; without those cells, the walker remains mostly immune to non-arc weapons.

For damage gating:

- Treat `supportLeg`, `legArmor`, and `legJoint` as the walker support structure.
- Keep the elevated body resistant to normal direct fire while support structure remains.
- Once the support structure for the walker is destroyed/collapsed, let normal weapons hit the body.
- Preserve mortar/STA missile ability to hit elevated body cells while the legs are still standing.
- Do not rely on armor-only layer collapse for this construct; every lower layer intentionally has a non-armor wheel support cell so it remains targetable by normal direct fire.

For animation:

- Use `legId` to bind each support assembly to a separate stride group.
- The existing editor preset `createWalkerStrideRigForConstruct()` can generate a starter pose rig for this construct.

## Validation

The editor-side content test now asserts:

- 48 wheel `supportLeg` cells across `gridZ: 0..5`.
- 192 armor `legArmor` cells across `gridZ: 0..5`.
- 8 engine `legJoint` cells at `gridZ: 6`.
- 8 unique `legId` values shared by the support cells and leg joints.

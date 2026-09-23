# Custom Content Sandbox Runtime

Version `v1.0.9.3` extends the JSON-first test path for local levels and their dependencies.
The game Sandbox can import one or more JSON files, install/reinstall their local pack,
select a level, and launch it without adding that content to the bundled campaign.

## Browser API

The game exposes these editor-facing calls:

```js
WeyfinderContentModules.installFiles(fileList)
WeyfinderContentModules.createRegistry()
WeyfinderContentModules.instantiateLevel(levelId, seed)

WeyfinderSandbox.contentReport()
WeyfinderSandbox.levels()
WeyfinderSandbox.runLevel(levelId, { seed: 1147 })
WeyfinderSandbox.enemies()
WeyfinderSandbox.quickSpawn(enemyId)
WeyfinderSandbox.loadout({ allUpgradeLevel: 12, repair: true, refillAmmo: true })
WeyfinderSandbox.loadout({ upgradeLevels: { rocketBlastDamage: 8 } })
WeyfinderSandbox.repair('gun')
WeyfinderSandbox.refillAmmo('rocket')
WeyfinderSandbox.stop()
```

`runLevel` validates and resolves the installed level, translates distance-authored waves
into the Sandbox clock, applies the level route and lighting, and loads local constructs,
patterns, encounters, and voxel models from the merged registry.

The in-game Sandbox `Loadout` panel exposes the same testing operations without requiring
the browser console. It can set one upgrade or every currently installed upgrade to an
explicit level, restore detached/damaged cells for free, and refill every ammo reserve.

## Runtime verb discovery

Encounter validation and execution share one registry. Editor/runtime integrations can
inspect the executable vocabulary and runtime diagnostics with:

```js
WeyfinderEncounters.verbs()
WeyfinderEncounters.diagnostics()
```

An unknown encounter condition fails closed and records a diagnostic. Unknown condition
or effect names fail validation rather than being accepted as if the runtime supported them.

When `createGame` receives a `levelDefinition`, its route, lighting, waves, obstacles,
constructs, patterns, and voxel models are authoritative. The legacy campaign schedule is
used only when no authored level is supplied. Wave `atDistance` and `distanceInterval`
values remain route-distance triggers in the runtime spawn queue.

## Custom model references

A custom level wave references a construct and optional firing patterns:

```json
{
  "id": "opening",
  "atDistance": 120,
  "spawn": [{
    "construct": "local.construct.scout",
    "count": 3,
    "spacing": 25,
    "laneOffset": 0,
    "patterns": ["local.pattern.aimed"]
  }]
}
```

Construct cells may contain an inline 4 by 4 `mask`, or reference an installed embedded
voxel model with `voxelModel`, `voxelModelId`, or `voxelModelRef`. Embedded voxel models
use `kind: "voxelModel"` and a 4 by 4 `mask` or `voxels` array. String voxel roles and
full `{ role, hp, maxHp }` voxel records are accepted.

## Obstacles and hazards

Level obstacle kinds remain `construct`, `hazard`, `decor`, and `procedural_field`.
Construct obstacles reference a construct. Hazard/decor obstacles may reference an
embedded voxel model in this first runtime slice.

```json
{
  "id": "ash-front",
  "kind": "hazard",
  "assetRef": "local.voxel.ash_front",
  "atDistance": 400,
  "laneOffset": 0,
  "motion": {
    "mode": "chase",
    "targetGap": 150,
    "triggerSpeed": 30,
    "catchUpAcceleration": 45,
    "maxSpeed": 220,
    "lateralTracking": 0.2
  },
  "collision": {
    "mode": "trigger",
    "shape": "circle",
    "radius": 90,
    "restitution": 0.15,
    "friction": 0.35,
    "impactDamageScale": 0
  },
  "effects": {
    "damagePerSecond": 6,
    "accelerationScale": 0.55,
    "brakingScale": 0.7,
    "primaryFireRateScale": 0.5,
    "secondaryFireRateScale": 0,
    "force": { "lateral": 15, "forward": 0 },
    "impulse": { "lateral": 30, "forward": 0 },
    "spinoutSeconds": 0.8,
    "angularImpulse": 1.5
  }
}
```

Motion modes:

- `terrain`: fixed in world/terrain space after it enters play.
- `terrainVelocity`: terrain-space object with authored route-relative velocity and acceleration.
- `chase`: follows behind the player and gains on them when route speed falls below `triggerSpeed`.

Collision modes are `none`, `solid`, and `trigger`. Shapes are `circle` and `aabb`.
Effect vectors are route-relative: `lateral` is across the road and `forward` is along it.
A fire-rate scale of zero fully suppresses that weapon class while contact is active.

## Current boundary

This path persists JSON definitions in the local content library. Arbitrary local image,
audio, and mesh binaries still need the planned IndexedDB resource store. Procedural field
generation, generic weather, and arbitrary composed movement/firing verbs are later runtime
milestones; unknown new verbs should not be treated as implemented merely because an editor
can serialize them.

# Elevation Enemy And Loadout Editor Handoff

This is for the editor development thread and future main-game runtime work.

## Existing Elevation Surface

Projectiles already support a simple 2.5D arc surface:

- `behavior: "arc"`
- `z`
- `verticalVelocity` / `vz`
- `gravity`
- `maxArcHeight`
- `shadowRadius`
- `arcLanded`
- `targetHint: "aimReticle"`
- `detonateAtTarget`

The renderer draws an arc projectile shadow at ground position and the projectile body at `y - z`. Editors can expose these fields now for mortar, STA missile, hopping, and flying previews.

## Enemy Movement Vocabulary

The enemy archetype validator now accepts these additional movement primitives for editor-authored descriptors:

- `phase`: ghost/phantom enemies that periodically become partly or fully intangible.
- `hop`: enemies that jump from point to point with a visible `z` arc.
- `flyStrafe`: airborne enemies that cross the play area and can use z-aware collision.
- `walkerLegs`: elevated bodies supported by leg modules.
- `circleArtillery`: slow enemies that circle or follow the player and fire arcing shells.
- `carrierRelease`: enemies that periodically release child mobs/projectiles.

The new archetype examples live in `content/enemies/prototype0_enemy_archetypes.json`:

- `ghost_phaser.ghost_forrest`
- `hopping_stream_mob.digitized_stream`
- `heavy_mortar_boat.pirates_road`
- `starlight_walker.prototype0`
- `twilight_walker.prototype0`
- `scrap_buzzard.shadowed_desert`
- `inchworm_carrier.freedoms_pass`
- `moth_bomber.freedoms_pass`

These are descriptor contracts first. Runtime behavior runners still need to be added for most of them.

## Weapon Loadout Surface

Player vehicle definitions can now carry per-gun loadouts:

```json
{
  "gunLoadouts": [
    {
      "cellId": "gun",
      "primary": ["main.basic", null],
      "secondary": ["rocket", "cannon", "beam"]
    }
  ]
}
```

Construction screen support:

- Select a gun cell.
- Choose Primary 1, Primary 2, Secondary 1, Secondary 2, Secondary 3.
- Save/load preserves the loadout inside the vehicle definition.

Core helper:

```js
normalizeGunLoadouts(definition)
setGunLoadoutSlot(definition, cellId, slotKind, index, weaponId)
weaponStackMultiplier(definition, weaponId)
```

Current slot lists:

- Primary: `main.basic`, `tracking_flechette`, `mortar`, `mini_beam`, `tractor_beam`, `repulsor_beam`
- Secondary: `rocket`, `cannon`, `beam`, `sta_missile`, `orb_of_blades`

The launch build screen filters these choices through `account.weaponUnlocks`; the construct workshop keeps the full list available for editor/dev work.

Runtime firing still needs a follow-up pass to consume loadouts for actual primary/secondary firing. The data is now present for the editor and construction UI.

## New Weapon Assets

New canon weapon definitions:

- `content/weapons/tracking_flechette.json`
- `content/weapons/mortar.json`
- `content/weapons/mini_beam.json`
- `content/weapons/tractor_beam.json`
- `content/weapons/repulsor_beam.json`
- `content/weapons/sta_missile.json`
- `content/weapons/orb_of_blades.json`

The canon content pack includes these weapons for registry/editor discovery.

## Achievement, Targeting, And Shop Hooks

New achievement rewards unlock advanced weapons/modules:

- `mortar-combat`: defeat 4 `heavy_mortar_boat.pirates_road` enemies; unlocks `mortar`.
- `mothra-pillar`: emit `specialDefeats.inchwormAllSegmentsFirst`; unlocks `tracking_flechette`.
- `danger-skittles`: emit `specialDefeats.frogDistractedByConstruct`; unlocks `tractor_beam` and `repulsor_beam`.
- `buzz-off`: emit `specialDefeats.buzzardLandedForScrap`; unlocks `sta_missile`.
- `leg-up`: defeat a Starlight or Twilight walker; unlocks `orb_of_blades`.
- `crouching-weyfinder-hidden-phantom`: defeat a ghost phaser; unlocks the future `cloaking` module.
- `magnetic-personality`: collect 100 scrap in a run; unlocks the `scrap_magnet` upgrade family.

Public hooks live in `src/core/combatEvents.js`. Editors can use `targeting.preferConditions`, `targeting.requireConditions`, and `targeting.ignoreConditions` with `targetIsDistracted`, `targetIsCollectingScrap`, `targetIsLandedForScrap`, `targetIsPhasedIn`, and `targetIsDamaged`.

The repair/upgrade screen now filters upgrade rows through `availableUpgradeDefinitions(game, account, vehicleDefinition)`. Upgrades should only appear when the player has the relevant module/weapon unlocked and currently installed on the craft.

## Runtime Follow-Up

Good next implementation cuts:

1. Add z-aware hit checks for enemies/projectiles so flyers, walkers, mortars, and STA missiles share the same collision contract.
2. Add a movement-profile runner for `phase`, `hop`, `flyStrafe`, `walkerLegs`, `circleArtillery`, and `carrierRelease`.
3. Make phasing enemies ignore selected weapon hits while out of phase.
4. Make walker body cells elevated until enough support legs are detached/destroyed.
5. Route player primary and secondary firing through active gun loadouts with round-robin mounts and square-root duplicate scaling.

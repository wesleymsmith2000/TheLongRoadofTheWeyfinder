# Weapon Loadout And Flechette Handoff

This handoff gives the editor thread and future weapon work a stable direction after adding cannon flechette piercing.

## Runtime Added

- `cannonFlechettePierce` is now a shop upgrade under the Cannon system.
- Projectiles can carry general pierce fields:
  - `pierce`: number of follow-through voxel hits after the initial impact.
  - `pierceDamageScale`: fraction of impact damage available to the first pierced voxel.
  - `pierceDamageFalloff`: remaining damage multiplier after each voxel.
- Cannon shells now assign those fields from `cannonFlechettePierce`.
- Cannon shrapnel/flechettes inherit cannon pierce fields.
- Cannon flechette fragment velocity is doubled from the previous range.

## Editor Exposure

Weapon editors should treat piercing as a general projectile payload field, not as a cannon-only special case. Cannon is simply the first canon weapon using it.

Recommended projectile fields:

```json
{
  "pierce": 0,
  "pierceDamageScale": 0.7,
  "pierceDamageFalloff": 0.68
}
```

For UI, describe it as follow-through damage that continues into voxels behind the first struck voxel while enough damage remains.

## Turret Loadout Direction

The next larger architecture step should split physical gun modules from installed weapon slots.

Recommended future gun-cell loadout shape:

```json
{
  "cellId": "gun",
  "primary": "main.basic",
  "secondary": ["rocket", "cannon", null],
  "weightClass": "medium"
}
```

Rules to target:

- Each `gun` cell can hold at most one primary weapon.
- Each `gun` cell can hold up to three secondary weapons.
- Additional installed secondary weapons increase gun/module mass.
- Multiple copies of the same weapon improve fire rate, cooldown, charging, or heat recovery using the existing square-root law.
- Firing should round-robin through compatible active gun emplacements instead of firing all copies at once.
- Unlocks should determine which weapon ids can be installed, while the active vehicle definition determines where they are installed.

The editor thread can begin by exposing loadout data and validation without needing full live runtime support immediately.

## Suggested Next Runtime Contract

Add a dedicated loadout module before implementing more weapons:

```js
createWeaponLoadoutState(vehicleDefinition, unlocks)
availableWeaponSlots(vehicle)
installWeapon(loadout, cellId, slotKind, weaponId)
activeWeaponMounts(vehicle, loadout, weaponId)
nextRoundRobinMount(loadout, weaponId)
weaponStackMultiplier(loadout, weaponId)
```

Keep this logic independent of Canvas, DOM, and platform APIs.

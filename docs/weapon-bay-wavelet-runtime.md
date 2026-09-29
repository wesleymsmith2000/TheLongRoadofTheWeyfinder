# Weapon Bay and Wavelet Runtime

## Inter-zone weapon bay

`game.weaponBay` stores spare weapon quantities and per-gun slot unlocks. The bay is enabled when a boss level completes and is disabled when the next level starts.

Runtime entry points live in `src/core/weaponBay.js`:

- `buildWeaponWithScrap(game, weaponId)` constructs one spare weapon.
- `swapWeaponSlot(game, cellId, slotKind, slotIndex, weaponId)` installs or removes a weapon.
- `unlockLiteWeaponSlot(game, cellId, slotKind, slotIndex)` buys a Lite slot unlock.
- `weaponConstructionCost(game, weaponId)` combines one gun-cell replacement cost with every level-one upgrade cost for that weapon.

Repulsor and tractor beams are utility modules. Author them under a utility cell:

```json
{
  "cellId": "utility",
  "kind": "utilitySlots",
  "slots": ["booster", "scrap_magnet", "repulsor_beam", "tractor_beam"]
}
```

## Locked convergence wavelet

The player weapon asset is `content/weapons/vortex_wavelet_beam.json`. Its `effect.kind` is `locked_convergence_wavelet` and it always requires an explicit trigger.

The simulation implementation is split between:

- `src/core/spatialWaveletBeam.js` for fixed-path charge, convergence, pulse, and one-shot shockwave state.
- `src/core/weaponInterlock.js` for the brief all-weapon lockout at discharge.
- `src/core/secondaryWeapon.js` for ammo, heat, selection commitment, and player trigger integration.

During charge, destroying the source gun cancels the field. Once discharge starts, the field is independent. Locked origins and targets are carried with the road frame.

Sandbox automation can install the weapon without changing canon starter content:

```js
WeyfinderSandbox.equipWeapon('vortex_wavelet_beam', {
  cellId: 'gun',
  slotKind: 'secondary',
  slotIndex: 0
});
```

`WeyfinderSandbox.weapons()` returns the current primary and secondary runtime catalogs.

# Weapon Bay and Wavelet Runtime

## Inter-zone weapon bay

`game.weaponBay` stores spare equipment quantities and per-gun slot unlocks. Workshop Loadout, Fabrication and Merge are available after every completed level; live combat disables them. Arcade boss victories unlock one extra weapon slot for free and open Loadout at the rewarded mount, with a visible notice and equipment-setup button. If no locked slots remain, the runtime refits hull armor or adds an explicitly connected gun cell. `weaponBay.arcadeStartingSlots` preserves the initial active slot count (five on the default hull) across save/load, including smaller custom hulls.

Runtime entry points live in `src/core/weaponBay.js`:

- `buildWeaponWithScrap(game, weaponId)` constructs one spare weapon.
- `swapWeaponSlot(game, cellId, slotKind, slotIndex, weaponId)` installs or removes a weapon.
- `unlockArcadeWeaponSlot(game)` returns the boss-clear requirement; slots cannot be purchased.
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

In Arcade, `waveletTier` upgrades add ammo at triangular upgrade counts: 1, 3, 6, 10, 15, etc. The bonus is `floor((sqrt(8 * level + 1) - 1) / 2)`, added after the mounted-copy capacity calculation so each milestone grants exactly one round. The paid upgrade grants that new round immediately without refilling spent ammo. Capacity, refill pricing/status and save-loaded upgrades share `ammoCapacityWithUpgrades`; progression continues beyond the last visual tier. Normal retains its authored capacity.

The simulation implementation is split between:

- `src/core/spatialWaveletBeam.js` for fixed-path charge, convergence, pulse, and one-shot shockwave state.
- `src/core/weaponInterlock.js` for the brief all-weapon lockout at discharge.
- `src/core/secondaryWeapon.js` for ammo, heat, selection commitment, and player trigger integration.

During charge, destroying the source gun cancels the field. Once discharge starts, the field is independent. Locked origins and targets are carried with the road frame.

Arcade applies its ultimate tuning at the secondary-weapon runtime boundary, leaving the shared JSON asset's Normal/Sandbox balance intact. See [Arcade rules](arcade-mode.md) for the current multipliers and damage baseline. Runtime wavelet effects also support these optional fields:

- `effect.gameplay.pinSourceDuringCharge` (default `false`): pins the player to the copied `sourcePosition` supplied to `createSpatialWaveletField`, carried with road scrolling. The game enforces this before movement and after contacts.
- `effect.gameplay.recoilSpeed` (default `0`): backward velocity added once at discharge when charge pinning is enabled.
- `effect.gameplay.projectileDeflectionSpeedScale` (default `0`): enables hostile projectile returns at shock crossing through the `onProjectileDeflected(projectile, angle, speed, field)` simulation hook. A positive scale multiplies the projectile's recorded pre-attraction speed. Beam/blast effects and terrain-anchored projectiles are excluded from attraction and deflection.
- `effect.gameplay.pierceEachEnemy` (default `false`): gives each intersected enemy its own front-pulse pierce budget.
- `effect.gameplay.damageVisualArea` (default `false`): uses `src/core/waveletGeometry.js` to sweep the drawn front/rings and ripple area against live enemy voxel world positions. Every covered voxel is damaged once per field, with the same geometry used for hostile projectile deflection. This replaces the narrow front trace when enabled. Normal/Sandbox keep their original trace. Phase-protected cores remain protected.
- `effect.visual.showGuides` (default `true`): controls straight charge boundary/axis guides.
- `effect.visual.distortionEnabled` (default `false`): enables render-only scene displacement, using the tier's `maxStrengthPixels` and `frequencyMod`.

`onDischarge(field)` fires once at the charge/discharge transition for release sound and haptics. These hooks keep platform effects and projectile ownership integration outside the field simulation. `src/core/beamDamage.js` shares the damage envelope between sustained particle beams and the Arcade wavelet's burst-damage floor.

Sandbox automation can install the weapon without changing canon starter content:

```js
WeyfinderSandbox.equipWeapon('vortex_wavelet_beam', {
  cellId: 'gun',
  slotKind: 'secondary',
  slotIndex: 0
});
```

`WeyfinderSandbox.weapons()` returns the current primary and secondary runtime catalogs.

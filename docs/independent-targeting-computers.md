# Independent Targeting Computers

Version `v1.0.9.6` adds achievement-unlocked targeting computer modules for guided AI mode. Each unlocked offensive primary weapon slot receives its own moving reticle, and the selected secondary receives another. This allows weapons with different velocities and tracking behavior to calculate different lead points at the same time.

## Unlock progress

Progress is awarded when an enemy is defeated by damage from a projectile fired in `guided` mode. Projectiles retain a canonical `sourceWeaponId`, so cannon shrapnel, blade fragments, orb emissions, and blast damage credit the weapon that launched them rather than the child projectile name.

Progress is stored in:

```js
game.score.guidedWeaponDefeats[weaponId]
```

Achievement definitions and thresholds are exported from `src/core/targetingComputers.js`. Rewards use module IDs in this form:

```text
targeting_computer.main.basic
targeting_computer.mortar
targeting_computer.sta_missile
```

Unlocked module IDs remain in the player account's existing `moduleUnlocks` array. Old accounts and locked weapons retain the shared guided reticle behavior.

The defensive repulsor is intentionally excluded: it already selects nearby projectiles through its defensive queue and does not consume an offensive aim solution.

## Runtime behavior

Primary reticles are keyed per physical gun cell and weapon slot:

```text
primary:<cellId>:<slotIndex>:<weaponId>
```

The selected secondary uses:

```text
secondary:<weaponId>
```

Reticles inherit targeting AI experience, movement speed, wobble, Gaussian error reduction, selected enemy, and selected cell type. Each weapon profile independently decides whether to lead. Beam, tractor beam, STA missile, and orb of blades aim directly at their live reticles; ballistic weapons lead based on their projectile speed.

## Browser API

The read-only API is available for creator tools and diagnostics:

```js
WeyfinderTargetingComputers.definitions();
WeyfinderTargetingComputers.unlocks();
WeyfinderTargetingComputers.progress();
WeyfinderTargetingComputers.reticles();
```

The reticle map is transient and is cleared outside guided mode. Unlocks and progress remain persistent through the player account and normal save payload respectively.

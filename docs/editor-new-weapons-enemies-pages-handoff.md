# Editor New Weapons, Enemies, And Pages Handoff

This checkpoint updates the browser editors after the main runtime added elevation enemy descriptors, player gun loadouts, cannon flechette pierce, and new canon weapon assets.

## Editor Updates

- Weapon + Pattern Lab now lists all canon weapon definitions:
  - `rocket`
  - `cannon`
  - `beam`
  - `tracking_flechette`
  - `mortar`
  - `mini_beam`
  - `sta_missile`
  - `orb_of_blades`
- Weapon editing now exposes general projectile fields for:
  - `turnRate`
  - `acceleration`
  - `maxSpeed`
  - `pierce`
  - `pierceDamageScale`
  - `pierceDamageFalloff`
  - `blastRadiusCells`
  - `blastDamage`
  - `blastKnockback`
  - `targetHint`
  - `detonateAtTarget`
  - `zCollision`
  - `emitsProjectiles`
- Pattern projectile editing now exposes the same pierce trio used by weapon projectiles.
- Construct Workshop now emits `gunLoadouts[]` using the shared helper from `src/core/weaponLoadout.js`.
- Construct Workshop now allows Primary 1, Primary 2, and Secondary 1-3 slot editing for the selected gun cell.
- Construct Workshop status shows duplicate-weapon square-root stack multipliers.
- Enemy Editor now exposes movement descriptor fields for `duration`, `z`, `minZ`, `maxZ`, and `hopHeight`.
- Enemy Editor target options include `playerLead` and `scrap`.
- Enemy Editor preserves extra movement profiles and aggregate parts when editing the first visible descriptor, which protects multi-profile enemies like the buzzard/carrier and multi-part walkers.
- Enemy Editor preview paths now sketch the new movement kinds: `phase`, `hop`, `flyStrafe`, `walkerLegs`, `circleArtillery`, and `carrierRelease`.

## Runtime Contract Notes

These editor changes are data-surface updates. The runtime still owns actual behavior execution. The main runtime thread should continue the follow-up items from `docs/elevation-enemy-loadout-editor-handoff.md`:

1. Consume `gunLoadouts[]` for live player primary/secondary firing.
2. Add z-aware projectile/enemy collision.
3. Add movement runners for the newer enemy movement descriptors.
4. Move remaining boss arm attack scheduling out of hardcoded game logic when practical.

## Verification

Run before publishing:

```text
npm.cmd test
npm.cmd run build
npm.cmd run build:pages
```

The Pages build should keep the creator suite available at:

```text
https://wesleymsmith2000.github.io/TheLongRoadofTheWeyfinder/tools/creator-suite.html
```

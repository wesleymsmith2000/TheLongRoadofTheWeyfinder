# Editor Weapon Upgrade Examples Handoff

Date: 2026-09-02

Gameplay/runtime checkpoint: `v1.0.1.6`

## Purpose

Update editor examples and UI affordances for the latest weapon behavior/content changes:

- Tracking Flechette
- STA Missile
- Orb Of Blades
- secondary ammo capacity copy scaling

## Tracking Flechette

Canonical file: `content/weapons/tracking_flechette.json`

Runtime changes:

- Base `projectileSpeed` is now `161.25`, half of the prior initial launch velocity.
- `lifetime` is now `3.9`, a 50% increase.
- Base `acceleration` remains `105`.
- Projectile sprite display size is now `[11, 4]`.
- Launch metadata:
  - `delayBeforeAcceleration`: `0.35`
  - `stopBeforeAcceleration`: `true`
  - `launchAngleMode`: `orthogonal`
  - `launchAngleSpreadRadians`: `0.5235987755982988`
  - `launchWhenFacingTarget`: `true`

Editor examples should show the flechette launching sideways from the aim line, drifting briefly, rotating toward target, then accelerating in a locked straight line.

Upgrade ids to expose when `tracking_flechette` is mounted as a primary:

- `trackingFlechetteFireRate`
- `trackingFlechettePierce`
- `trackingFlechetteAcceleration`
- `trackingFlechetteImpactDamage`
- `trackingFlechetteTurningRate`

## STA Missile

Canonical file: `content/weapons/sta_missile.json`

Runtime changes:

- `tracksReticleInArc: true` is now active at runtime.
- While in flight, player STA missiles update `targetHint` from the live aim reticle and recompute horizontal velocity so the arc lands at the current reticle.
- STA uses the full-scale tracking flechette sprite:
  - `assetId`: `sprite.weapon.tracking_flechette`
  - `displaySize`: `[22, 8]`
- STA has a blue/grey contrail using the existing contrail shape:
  - `particleRadiusScale`: `1.5`
  - `colors`: `["#b9e8ff", "#6f9fb7", "#8c969f", "#d4dde5"]`

Editor examples should differentiate STA from mortar: mortar lands on the chosen point, STA keeps correcting toward the live reticle during the arc.

## Orb Of Blades

Canonical file: `content/weapons/orb_of_blades.json`

New blade payload field:

- `absorbsEnemyProjectiles: true`

This may appear on:

- `projectile.emitsProjectiles`
- `projectile.detonationBurst.groups[]`

Runtime behavior:

- Player orb blade projectiles destroy overlapping non-beam, non-blast enemy projectiles.
- The blade loses damage equal to the absorbed projectile's `damage`.
- If blade damage is depleted, the blade expires; otherwise it continues and may still pierce enemies through `damagePiercesUntilSpent`.

Upgrade ids to expose when `orb_of_blades` is mounted as a secondary:

- `orbOfBladesEmissionRate`
- `orbOfBladesBladeDamage`
- `orbOfBladesBladesPerCycle`
- `orbOfBladesBladeKnockback`

Upgrade effects:

- emission rate divides `emitsProjectiles.interval`
- blade damage scales emitted and burst blade `damage`
- blades per cycle increases emitted blade `count` and burst flechette count
- blade knockback scales emitted and burst blade `impulse`

## Secondary Ammo Copy Scaling

Runtime ammo capacity now scales by mounted secondary copies:

```text
capacity = ceil((baseCapacity + ammoBonus) * sqrt(N + 1))
```

Where `N` is the count of that secondary weapon across all gun loadout secondary slots on the player's craft.

Examples:

- one mounted `rocket`: `ceil(12 * sqrt(2)) = 17`
- three mounted `rocket`: `ceil(12 * sqrt(4)) = 24`

Editor loadout previews should account for this when displaying secondary ammo capacity.

## Validation Notes

`src/core/weaponDefinition.js` now validates:

- `tracksReticleInArc`
- `launchAngleMode`
- `launchAngleSpreadRadians`
- `launchWhenFacingTarget`
- `contrail.particleRadiusScale`
- `absorbsEnemyProjectiles` on orb emitter/burst payloads


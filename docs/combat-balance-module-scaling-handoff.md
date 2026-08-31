# Combat Balance And Module Scaling Handoff

This handoff summarizes the balance/runtime changes made after the first arc-projectile pass.

## Implemented In Main Game

Explosives:

- Cannon and rocket projectile radii are doubled in the canon weapon JSON.
- Cannon and rocket base projectile speeds are increased by 50%.
- Cannon and rocket blast radii are doubled.
- Cannon and rocket blast damage now uses stronger runtime defaults.
- `applyEnemyBlastDamage` now propagates excess voxel damage into nearby consecutive voxels within blast range, so overkill damage is not wasted on the first destroyed voxel.
- Cannon shells store a `detonateDistance` from launch muzzle to target reticle and detonate after traveling that distance, even if the reticle point is not exactly on the projectile path.

Enemy projectiles:

- Sequential redirect bullets now use triple acceleration and triple max speed.
- The example module set was updated with the same values so editor-imported sample content matches canon behavior.

Boss:

- Boss arm/tentacle standard shots are doubled in speed and projectile radius.
- Each live arm gun now has a low-probability independent nodule shot aimed at the player.
- Boss laser projectiles carry their source enemy/cell. If that source cell is destroyed or the boss is destroyed, the beam expires instead of floating away.

Player modules:

- Each active gun cell becomes a main-gun firing point.
- Main gun fire interval scales by `sqrt(activeGunCount)`.
- Main gun projectile radius is doubled and base projectile speed is increased by 50%.
- Engine module power now scales acceleration/top-speed contribution with the square root of active engine integrity.
- Engine and wheel mobility contributions were boosted by 50%, and base acceleration/max velocity were boosted by about 50%.
- Wheel module power now improves braking/grounding and release drag. Asymmetric wheels still feed the existing wobble/pull behavior.
- Upgrade shop now includes `engineAcceleration`, `engineMaxVelocity`, and `wheelInertiaCompensation`.
- Boost drive now uses active engine power through the square-root rule for launch impulse, sustained thrust, boost speed cap, drive duration, fuel capacity, and recharge rate.
- Boost shielding temporarily uses active gun power through the square-root rule for shield duration, repel impulse, radius, and absorption until dedicated shield modules exist.
- Active boost drive emits large bluish-white/gray exhaust particles. Emission count scales logarithmically with engine power and boost upgrade count, and exhaust particles deal light contact damage as a placeholder for future fire/status effects.

## Editor Follow-Up

Weapon and construct editors should expose these assumptions:

- Multiple gun cells are meaningful as distinct firing points.
- Multiple engine cells are meaningful for acceleration and max speed, with diminishing returns.
- Multiple wheel cells are meaningful for braking/control, with diminishing returns.
- Multiple engine cells are also meaningful for boost reserve, recharge, thrust, duration, and speed cap.
- Multiple gun cells are temporarily meaningful for boost shield duration/radius/repel/absorption until shield modules are introduced.
- Boost exhaust should be previewed as damaging particles/status emitters once the editor exposes engine plume or booster effects.
- Mobility upgrades should be grouped under a `Mobility` system: engine acceleration, engine max velocity, and wheel inertia compensation.
- Cannon/mortar-style weapons should prefer `targetHint: "aimReticle"` plus detonation distance/reticle semantics.
- Explosive weapon previews should treat excess damage as tunneling through consecutive voxels while blast power remains.

## Still Worth Doing

- Move boss nodule firing, beam source binding, and redirect projectile tuning fully into enemy archetype data.
- Add UI readouts for active gun/engine/wheel counts, mobility upgrade levels, and resulting multipliers.
- Add a true mortar weapon entry using `behavior: "arc"` plus the new blast propagation model.
- Add editor controls for blast propagation loss/resistance once materials exist.

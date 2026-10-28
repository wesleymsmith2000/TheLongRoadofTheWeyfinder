# Hostile Wavelet, gravity bombs and octopus weak points

Available in **v1.0.24.0**. Simulation lives in `src/core/hostileSpatialAttacks.js`;
Canvas effects live in `src/render/hostileSpatialAttacks.js`. Player Wavelet tuning is unchanged.

## Playtesting

Open **Sandbox Run**, select Normal or Arcade rules, then:

- Pick **Hostile Wavelet Cannon** or **Gravity Bombard** in the enemy picker and **Run Quick**.
- Select **Offscreen hazard test** and **Add Hazard** to aim an offscreen attack at your vehicle.
- Use **Run Hazard Course** for the pre-boss driving trial: two side-fired Wavelets and a bomb drop.
- Test bosses with the enemy picker or **Test Campaign Level**. Weyfinder Road and Pirates Road
  bosses fire gravity bombs; the zeppelin fires the suction Wavelet; the octopus retains its
  standard beam. Existing boss attacks remain available.

Boss spatial attacks have a nine-second initial timer and a twelve-second cooldown between
starts, subject to existing enemy fire-rate scaling. A missing/destroyed source gun prevents firing. The zeppelin cannot start one during
meltdown. Destroying a source gun during warning/suction cancels that Wavelet. A released
flame or launched bomb continues independently.

```js
WeyfinderSandbox.quickSpawn('hostile_wavelet_cannon.prototype0', { runMode: 'arcade' });
WeyfinderSandbox.quickSpawn('gravity_bombard.prototype0', { runMode: 'arcade' });
WeyfinderSandbox.fireHazard('hostile_wavelet', {
  origin: { edge: 'right', margin: 80, roadY: -100 },
  target: { laneOffset: 0, roadY: 100 }
});
WeyfinderSandbox.fireHazard('gravity_bomb', { attack: { radius: 220, chargeSeconds: 3.5 } });
```

## Attack definitions

Use `kind: "hostile_wavelet"` or `kind: "gravity_bomb"`. Optional fields are validated by
`validateHostileAttack` in `hostileAttackDefinition.js`.

| Field | Hostile Wavelet default | Gravity bomb default |
| --- | --- | --- |
| `warningSeconds` | 2; minimum 2 | — |
| `chargeSeconds` | 3 | 3 after impact |
| `length` | 1,100 world units | — |
| `halfWidth` | 120 | — |
| `frontSpeed` | 560 units/s | — |
| `flightSeconds` | — | 1.5 |
| `radius` | — | 190 |
| `explosionRadius` | — | 250 |
| `pullAcceleration` | 350 | 420 |
| `damage` | 18 per swept hull-cell hit | 24 blast damage |
| `knockback` | 170 | 900 |

Durations, dimensions and speeds must be positive and finite. Damage, knockback and pull
acceleration may be zero. Without an explicit `length`, Wavelets extend far enough to reach
their target on wide viewports. Explicit lengths are respected.

Wavelets show a black/red/purple footprint for the full warning, with no suction or damage.
During charge, particles and distortion flow toward the firing origin, including for targets
exactly on the axis. Moving guns carry the warning and suction origin while preserving the
locked firing direction. The flame/fireball release uses swept Wavelet geometry and hits
each covered player cell once. Player upgrade and Arcade ultimate tuning do not apply.

Bombs use real arc projectiles with a landing-region marker. Only ground impact creates a
vortex; it then stays in terrain space. It pulls the player, enemies, movable projectiles,
scrap and detached vehicle pieces inward. Static terrain remains fixed. At charge completion,
it damages nearby player/enemy hulls and pushes movable objects outward once, canceling
inward radial velocity before applying the large impulse. Centered objects get a deterministic
road-forward kick. Deflected bombs retain their payload and use their resulting impact point.

## Enemy patterns

Use the existing registry and `emitter.kind: "hostileAttack"`:

```json
{
  "schemaVersion": "0.1", "assetId": "local.pattern.gravity_bomb",
  "initialDelay": 2, "interval": 8,
  "emitter": { "kind": "hostileAttack", "attack": { "kind": "gravity_bomb", "radius": 190 } }
}
```

Examples: [hostile_wavelet_cannon.json](../content/patterns/hostile_wavelet_cannon.json) and
[gravity_bomb.json](../content/patterns/gravity_bomb.json). Assign pattern ids in a custom
level spawn's `patterns` list, with a construct that has a live gun. Import that construct
and its patterns with the level. The pattern lab preserves `attack` when metadata/timing
changes; edit attack parameters in JSON and test in Sandbox. Projectile count, speed and
damage controls do not configure a spatial attack.

## Offscreen navigation hazards

Level JSON accepts `hazards[]`, with `id`, `atDistance`, `attack`, `origin` and `target`:

```json
{
  "id": "pre-boss-flame", "atDistance": 600,
  "attack": { "kind": "hostile_wavelet", "chargeSeconds": 3 },
  "origin": { "edge": "left", "margin": 80, "roadY": -100 },
  "target": { "laneOffset": 100, "roadY": 120 }
}
```

Points use road-relative `laneOffset` and `roadY`. Optional `edge` is `left`, `right`,
`ahead` or `behind`, placing that coordinate beyond numeric visible-view bounds with a
non-negative `margin` (default 80). The other coordinate uses its authored offset. Points
resolve when the distance gate fires. No enemy, visible emitter or asset dependency is needed.
Pending hazards and live attacks prevent automatic completion of an otherwise empty stage.

The level editor preserves `hazards` in JSON. Apply JSON, Download JSON, then import into
Sandbox. **Run Hazard Course** uses
[hostile_spatial_hazard_trial.json](../content/levels/hostile_spatial_hazard_trial.json).
Hazards also run through direct `createGame({ levelDefinition })` entry.

For timed Sandbox scripts, use `type: "hostileAttack"`, `at` in seconds, and the same
`attack`/`origin`/`target`. Optional `atDistance` takes precedence over `at`. Events fire once.
Pause holds warnings, suction and bomb flight. Restart/level transitions clear live fields.
These examples do not insert hazards into existing campaign stages automatically.

## Octopus arms

One actual runtime cell per arm is selected with seeded RNG and recorded as `arm.weakCellId`.
Only that cell has `bossArmWeakPoint: true` and the yellow glow. It keeps normal health;
every other arm cell receives six times its previous voxel HP and maximum HP before ordinary
level scaling. Destroying the marked cell detonates the entire arm and preserves the existing
scrap, reaction and retreat sequence. Ordinary cell loss no longer detonates the whole arm.
Body durability is unchanged. Weak-point fields are runtime state, not authored construct fields.

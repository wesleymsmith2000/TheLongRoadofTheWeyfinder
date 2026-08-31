# Editor Thread Quick Handoff

Pull latest `main` before continuing editor work.

Latest relevant checkpoints:

```text
pending/current: Boost mobility upgrade scaling
f25d968 Rotate main gun firing points
28ec68a Rebalance explosives and module scaling
```

Full handoff:

```text
docs/combat-balance-module-scaling-handoff.md
```

## Runtime Changes Editors Should Match

- Weapon/projectile editors should show the current canon rocket/cannon sizes, speeds, blast radii, and blast damage from `content/weapons/rocket.json` and `content/weapons/cannon.json`.
- Pattern editors should show redirect projectile fields from `content/patterns/enemy_radial_burst.json`: delayed stop, triple redirect acceleration, triple max speed, and doubled projectile/blast radius.
- Construct editors should treat every active `gun` cell as a real firing point.
- Construct editors should treat additional `engine` cells as acceleration/top-speed contributors with diminishing returns.
- Construct editors should treat additional `wheel` cells as braking/control contributors with diminishing returns and possible asymmetry wobble.
- Upgrade editors/menus should include Mobility upgrades: `engineAcceleration`, `engineMaxVelocity`, and `wheelInertiaCompensation`.
- Enemy editors should expose that boss beams must bind to a source cell and shut off when that cell is destroyed.
- Boss editors should plan for independent arm-nodule shots, even though this is still partly hardcoded in `src/core/game.js`.

## Best Next Editor Tasks

- Add visible arc/mortar fields in Weapon Pattern Lab using `behavior: "arc"` from `docs/arc-projectiles-editor-handoff.md`.
- Add blast preview language/visualization that implies excess damage can tunnel through consecutive voxels while blast power remains.
- Add module-count/multiplier readouts for guns, engines, and wheels in the vehicle/construct editor.
- Show Mobility upgrade levels alongside module-count readouts.
- Begin moving boss nodule attacks and beam-source binding out of hardcoded runtime logic into enemy archetype data.

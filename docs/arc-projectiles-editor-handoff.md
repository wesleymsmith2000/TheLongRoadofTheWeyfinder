# Arc Projectiles And Airborne Entities Handoff

This handoff wires in the first runtime/editor primitive for 2.5D lobbed attacks.

## Implemented In Main Game

Arc projectile runtime:

```text
src/core/projectile.js
src/render/canvasRenderer.js
tests/projectile.test.js
```

Projectiles may now use:

```json
{
  "behavior": "arc",
  "projectileSpeed": 45,
  "radius": 3,
  "damage": 12,
  "impulse": 90,
  "lifetime": 3,
  "verticalVelocity": 80,
  "gravity": 100,
  "maxArcHeight": 32,
  "shadowRadius": 5
}
```

Runtime behavior:

- `x/y` remain the ground position and impact location.
- `z` rises and falls under `verticalVelocity` and `gravity`.
- The renderer draws a ground shadow at `x/y` and the projectile at `y - z` with modest scaling.
- Arc projectiles do not collide while airborne.
- On landing, `arcLanded` and `readyToExplode` become true.

Validation/editor contract:

```text
src/core/weaponDefinition.js
src/core/patternDefinition.js
tests/contentRegistry.test.js
```

Weapon and pattern editors can emit `behavior: "arc"` with the fields above. Enemy patterns can use `blastOnExpire` to make landing shells explode through the existing delayed/blast path. Player-side arcing cannon/mortar variants can reuse cannon impact behavior when `weapon: "cannon"` is used.

## Editor Guidance

Good controls for the editor:

- Horizontal speed: `projectileSpeed`
- Arc height feel: `verticalVelocity`
- Fall speed: `gravity`
- Visual height cap: `maxArcHeight`
- Ground tell size: `shadowRadius`
- Impact payload: `blastOnExpire` for enemy patterns, or cannon/rocket blast fields for player weapons

For warnings/telegraphs, the editor can display the ground shadow or an impact marker at `x/y` while the shell is airborne. That should become the same primitive used by overhead bombers and boss attacks later.

## Remaining Work

- Add a first actual mortar/artillery weapon definition and shop/upgrade entries.
- Add editor UI fields in the Weapon Pattern Lab for arc motion.
- Add airborne enemy mobility states: `airborne`, `strafe`, `bombingRun`, `landing`, `ground`.
- Add bombing-run attacks that drop arc projectiles from offscreen or high `z`.
- Add hit rules for anti-air weapons or shields if we want some attacks to interact before landing.
- Add richer landing telegraphs, warning sounds, and damage preview rings.

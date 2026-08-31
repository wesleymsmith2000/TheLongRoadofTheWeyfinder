# Arc Projectiles And Status Effects Editor Handoff

Date: 2026-08-31

This handoff summarizes editor-side updates made after the runtime added arc projectile and status-effect primitives.

## Runtime Handoffs Reviewed

- `docs/arc-projectiles-editor-handoff.md`
- `docs/additional-mechanics-handoff.md`

They were treated as context, not instructions.

## What Was Added

- Added `arc` projectile controls to Weapon mode in:
  - `tools/weapon-pattern-lab.html`
  - `src/editor/weaponPatternLab.js`
- Added projectile behavior selection and `arc` controls to Pattern mode.
- Added a Status Effect mode to the Weapon / Pattern Lab.
- Added arc path and landing-shadow preview rendering.
- Added status-effect preview and validation through `validateStatusEffectDefinition`.
- Updated the bundled example module set with:
  - `content/examples/prototype0-module-set/status_effects/example.acid_splash.json`
  - a `statusEffects` manifest entry
- Updated creator-facing docs and tests.

## Editor Fields Now Exposed

Weapon and pattern projectile payloads can emit:

```json
{
  "behavior": "arc",
  "projectileSpeed": 45,
  "verticalVelocity": 80,
  "gravity": 100,
  "maxArcHeight": 32,
  "shadowRadius": 5
}
```

Pattern projectiles can still combine this with `blastOnExpire` to describe landing explosions.

Status Effect mode emits:

```json
{
  "schemaVersion": "0.1",
  "id": "example.acid_splash",
  "type": "acid",
  "intensity": 1.2,
  "duration": 5,
  "materialRules": {
    "metal": 1,
    "ceramic": 0.4,
    "gold": 0
  }
}
```

## Runtime Work Still Needed

- Runtime simulation for the status effects is still mostly future work.
- Weapons, bullets, hazards, levels, and enemy modules still need a stable field convention for referencing status-effect ids.
- The Level Editor should eventually expose status effects on hazards, triggers, and biome/style data once the runner consumes them.
- The Enemy Editor should eventually expose module/cell-level status-effect emitters once the runtime has those hooks.

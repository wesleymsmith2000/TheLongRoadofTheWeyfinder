# Editor Runtime Seams

This note is for the main game thread, the editor thread, and future creator tooling. It names the seams where new combat and level mechanics should enter the game so editors can build against stable contracts instead of chasing hard-coded runtime behavior.

## Working Rule

If a mechanic is meant to be authored, reused, balanced, or shared, add a named data contract first. Runtime code may still implement the primitive, but editors should reference it by asset id, behavior id, or enum value.

Recommended landing order:

1. Define or extend the validator in `src/core/*Definition.js`.
2. Add a small canon asset under `content/`.
3. Add validation tests for the asset and for malformed inputs.
4. Wire runtime instantiation through the validated definition.
5. Update `docs/creator-extension-api.md` and any editor handoff.

## Enemy And Pattern Content

Enemy work should remain split across:

- `content/constructs/`: voxel/cell layouts and explicit graph edges
- `content/patterns/`: firing sequences, emitter timing, projectile payloads
- `content/enemies/`: archetype descriptors binding construct, palette, entry behavior, and patterns

The editor thread can safely create new enemies by emitting an archetype that references existing constructs and patterns. If a new enemy needs a new movement verb, add the verb as a named behavior primitive before exposing it in editor UI.

Near-term enemy fields editors should target:

```json
{
  "id": "pirate_sloop_variant",
  "runtimeFactory": "createPirateShipEnemy",
  "construct": "basic_turret",
  "patterns": ["enemy_aimed_shot"],
  "entry": { "kind": "aheadDrift", "speed": 35 },
  "palette": { "core": "#e9d84b", "gun": "#e86f28" },
  "editable": ["construct", "patterns", "entry", "palette"]
}
```

## Projectile And Weapon Content

Weapon and bullet editors should use `content/weapons/` and `src/core/weaponDefinition.js` for player-facing weapons, and `content/patterns/` plus `src/core/patternDefinition.js` for enemy projectile payloads.

Supported runtime projectile primitives today:

- `ballistic`
- `homing`
- `beam`
- `blast`

Important flags and knobs already supported or reserved for editors:

- `targetHint`: use `aimReticle` when a projectile should interact with the player-selected target point.
- `detonateAtTarget`: useful for cannon shells that burst at the reticle.
- `destructible`: lets rockets and shells be damaged in flight.
- `pierce`: beam voxel penetration depth after the first damageable voxel.
- `width`: beam width in world units, scaled by upgrade multipliers.
- `blastOnExpire`: delayed or stopped projectiles can create a blast payload.
- `delayBeforeAcceleration`, `stopBeforeAcceleration`, `acceleration`, `accelerationDuration`: useful for staged enemy shots.
- `absorbsPlayerProjectiles`, `absorbHp`: useful for shields, ramming fronts, and protective bullets.

Editors should preview these knobs visually, but the exported asset should stay pure JSON and should not require editor UI state to play.

## Level, Obstacle, And Road Content

Level editor work should target `content/levels/` and `src/core/levelDefinition.js`.

Current level definitions already reserve:

- `background.layers[]` for procedural and prebaked scenery
- `route.segments[]` for travel direction and road turns
- `obstacles[]` for scenery, hazards, constructs, and procedural fields
- `waves[].spawn[]` for enemy timing and route-relative placement
- `triggers[]` for music, voiceover, cues, and scripted events

For upcoming mechanics, prefer these additions before touching `game.js` directly:

- `route.segments[].duration` or `route.segments[].targetTime` for timed three-minute level pacing.
- `route.segments[].roadSpeed` for stage-specific travel speed.
- `route.segments[].turnRadians` for editor-authored road rotation.
- `obstacles[].collision`, `obstacles[].damage`, and `obstacles[].destructible` for objects that must be dodged or maneuvered around.
- `waves[].spawn[].distribution` for exponential/Poisson entry timing.
- `waves[].spawn[].entry` for ahead drift, behind charge, boss entry, or future route-relative entrances.

The runtime should eventually consume these through a small level runner:

```js
createLevelRunState(levelDefinition, registry, seed)
stepLevelRun(levelState, game, dt)
consumeLevelEvents(levelState)
```

Keep the level runner separate from Canvas, DOM, and editor preview code.

## Playtest Loop

Creator tooling should aim for this workflow:

```text
edit construct/pattern/weapon/level
  -> export content JSON
  -> validate through core validator
  -> register in content registry
  -> instantiate a seeded playtest level
  -> report errors and warnings back to the editor
```

The main game repo remains the canon source. External editors can be more comfortable and powerful, but the runtime-compatible asset shape should remain the shared language.

# Additional Mechanics Handoff

This is the editor-thread handoff for the first pass on the `additional_game_mechanics.md` direction list.

## Implemented In Main Game

Save-state foundation:

```text
src/core/saveState.js
tests/saveState.test.js
```

The save format records account/unlocks, saved vehicle definition, current level, level times, completed boss/normal counts, scrap, upgrades, secondary weapon state, score, and targeting mode. Saves are signed with a deterministic checksum. Edited JSON is still loadable as sandbox/unofficial progress, but it no longer reports as official.

Status-effect vocabulary:

```text
src/core/statusEffects.js
tests/statusEffects.test.js
src/core/contentRegistry.js
src/core/localContentLibrary.js
```

The first supported effect types are:

- `fire`
- `acid`
- `frost`
- `ionSurge`
- `shield`
- `refractive`
- `reflective`

These are schema and editor-contract primitives only right now. Full runtime simulation for spread, heat, material resistance, misfires, beam reflection, ghost images, and shield timing still needs follow-up.

Content packs and loose local imports now recognize `statusEffect` assets via the manifest key `statusEffects`. The user-facing docs were updated in:

```text
docs/content-pack-manifest.md
docs/local-content-module-api.md
```

Checkpoint save import/export:

```text
index.html
src/main.js
```

The pause menu now has export/import save buttons. Imported saves initialize the game at the saved level first so soundtrack-derived boss waves and spawn schedules stay aligned before checkpoint fields are applied.

## Editor Contract

Editors can begin exposing status-effect fields on weapons, bullets, hazards, level triggers, biomes, and enemy modules with this shape:

```json
{
  "schemaVersion": "0.1",
  "id": "piratesroad.acid-splash",
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

Do not invent private names for these effects. If a new effect is needed, add it to `STATUS_EFFECT_TYPES` and docs first, then let editor UI expose it.

## Remaining Work

Runtime effect simulation:

- Fire damage over time, spread, heat escalation, ammo/engine detonation risk.
- Acid material resistance and armor/system erosion over time.
- Frost movement skid, weapon failure chance, heat-assisted de-icing, beam/boost heat dissipation bonuses.
- Ion surge misfire/failure, unintended boost/brake/acceleration, and sensor glitch visuals.
- Standalone shield modules and timing button.
- Refractive/reflective armor render and targeting consequences.
- Beam bounce, arcing, and reflection/pierce interactions.

Systems and scoring:

- Score formulas for enemy kill value, level completion, speed, and low-damage completion.
- Achievement toast UI with sound.
- Drones and guardian weapons as equipment/content primitives.
- Alternate main gun definitions.
- Telemetry module/radar/sensor progression.

Save-state follow-up:

- Add a fuller battlefield snapshot if we want exact mid-fight restore instead of level checkpoint restore.
- Decide how official signing should work for public builds. The current checksum is tamper-evident, not secret.
- Route invalid saves into a visible sandbox-mode badge.

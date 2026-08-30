# Enemy And Pattern Editor Handoff

This handoff captures the current enemy, pattern, and level-entry work so the editor thread can build tools against stable game-facing surfaces instead of scraping runtime implementation details.

## Current Source Of Truth

Use these files as the first editor integration points:

```text
content/enemies/prototype0_enemy_archetypes.json
content/patterns/enemy_aimed_shot.json
content/patterns/enemy_radial_burst.json
content/packs/canon.prototype0.json
src/core/enemyArchetypeDefinition.js
src/core/patternDefinition.js
src/core/contentRegistry.js
```

The runtime enemy bodies and special behaviors are still created in code:

```text
src/core/enemy.js
src/core/game.js
src/render/canvasRenderer.js
```

Editors should treat the JSON archetype pack as the editable descriptor layer and the code factories as the current Prototype 0 implementation layer. When artwork, palette, pattern, entry, or balance data changes, update the descriptor first and then adjust code only where runtime support is not data-driven yet.

## Editor-Facing Enemy Catalog

The new enemy archetype pack lives at:

```text
content/enemies/prototype0_enemy_archetypes.json
```

It currently exposes:

- `standard`: basic turret enemy using `basic_turret`, `enemy_aimed_shot`, and the sequential radial burst.
- `enhanced_charger`: post-boss charger variant with rear entry, incoming warning marker, charge timing, and frontal ramming shield settings.
- `boss.octagon.prototype0`: current boss descriptor with central core, octagon armor, segmented arms, palette, center-pulse projectile notes, arm attack mix, and laser telegraph data.

Runtime/editor helpers:

```js
import {
  editableEnemyKnobs,
  getEnemyArchetype,
  listEnemyArchetypes,
  validateEnemyArchetypePack,
} from './src/core/enemyArchetypeDefinition.js';
```

Recommended editor usage:

```js
const report = validateEnemyArchetypePack(packJson);
if (!report.valid) showErrors(report.errors);

const enemies = listEnemyArchetypes(packJson);
const boss = getEnemyArchetype('boss.octagon.prototype0', packJson);
const editable = editableEnemyKnobs('enhanced_charger', packJson);
```

The helpers are pure and do not touch Canvas, DOM, storage, or platform APIs.

## Content Pack Hook

The content pack manifest now supports:

```json
{
  "assets": {
    "enemyArchetypes": ["../enemies/prototype0_enemy_archetypes.json"]
  }
}
```

`src/core/contentRegistry.js` recognizes `enemyArchetype` as an asset kind and validates archetype packs through `validateEnemyArchetypePack`.

## Pattern Updates To Expose

`content/patterns/enemy_radial_burst.json` now uses:

- `emitter.kind: "sequentialRadial"`
- `sequenceRest`
- projectile delayed acceleration fields
- `blastOnExpire`

This lets the standard enemy fire ring spokes in sequence. Each projectile coasts, stops, locks an acceleration vector toward a target snapshot with optional spread, accelerates for the configured duration, then can explode.

Editors should expose these fields as pattern controls:

- spoke count
- interval between spokes
- rest time after a full sequence
- coast delay
- stop-before-acceleration toggle
- acceleration and acceleration duration
- acceleration spread
- blast radius, damage, and impulse
- projectile color
- projectile absorption toggle and absorption HP

## Level Progression Context

The current main-game loop schedules enemies over about three minutes per level. Enemy entry timing is produced by `createLevelEnemySchedule` in `src/core/game.js` using a seeded exponential distribution.

Boss waves are soundtrack-driven. A level becomes a boss wave when its music track name contains `Boss` or `BossFight`. The mapping starts in:

```text
default_levels_music.md
src/core/levelMusic.js
```

After a completed boss soundtrack has occurred, later non-boss waves add enhanced charger enemies and reduce the standard count.

Enhanced chargers can receive palette styling from the current level music through:

```text
src/core/levelStyle.js
```

The current stylesheet/background image resources live in:

```text
assets/stylesheets/
```

They are available for editor previews and future zone/background integration. They are not yet wired into the runtime background renderer.

## Boss Pattern Context

The current boss implementation includes:

- arm unfurl while entering the view
- stochastic arm aim centers with a player bias
- standard arm shots
- delayed drifting shots that stop and accelerate after a delay
- protective shots that absorb player bullets and beams
- tracking laser telegraphs followed by a short beam attack
- arm detonation on disconnection

These are documented in `content/enemies/prototype0_enemy_archetypes.json` under `arms.attackMix`. For now, the descriptor records the intended editable knobs while `src/core/game.js` remains the runtime implementation.

## Current Runtime Gaps

These are intentional gaps the editor thread should account for:

- Enemy body generation is not fully data-driven yet.
- Boss arm construction, arm detonation, and charger shield behavior still live in `src/core/enemy.js` and `src/core/game.js`.
- Boss laser telegraphs, protective projectile absorption, and arm attack selection still live in `src/core/game.js`.
- Rendering palettes for special boss cells currently live in `src/render/canvasRenderer.js`.
- Level-themed enhanced enemy palettes currently live in `src/core/levelStyle.js`.
- Encounter composition is still code-owned; future work should move spawn tables and enemy mixes into encounter assets.

When the editor improves artwork or enemy types, it should update the archetype descriptor and add notes for any runtime factory fields that still require code support.

## Safe Update Interface

For artwork and model iteration:

1. Add or update a descriptor in `content/enemies/prototype0_enemy_archetypes.json`.
2. Keep `id` stable once content has shipped; use a new id for incompatible variants.
3. Validate with `validateEnemyArchetypePack`.
4. Add referenced constructs or patterns to the same content pack manifest.
5. If new simulation behavior is required, add a named runtime primitive and expose that primitive in the descriptor instead of embedding editor-only logic.

For firing pattern iteration:

1. Update or create files in `content/patterns/`.
2. Validate with `validatePatternDefinition`.
3. Reference the pattern id from the relevant enemy archetype.
4. Keep projectile behaviors inside the supported primitives until trusted code extensions exist.

For new enemy families:

1. Start with a construct, one or more patterns, and an enemy archetype descriptor.
2. Use `runtimeFactory` only for known game factories until a new runtime factory lands.
3. Include `editable` fields so UI tools know what can be safely changed.
4. Add tests for the new descriptor and any new primitive.

## Near-Term Best Next Step

The next clean architecture move is to route `createLevelEnemies` through the enemy archetype catalog, then split enemy spawn mixes into encounter assets. That will let the level editor preview and playtest enemy waves without hand-editing `game.js`.

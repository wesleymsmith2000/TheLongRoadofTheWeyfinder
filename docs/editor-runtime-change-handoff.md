# Editor Runtime Change Handoff

Date: 2026-09-02

Runtime checkpoint: `v1.0.2.0`

## Version Scheme

Use the visible badge in `src/core/buildVersion.js` for every pushed runtime or content checkpoint.

```text
v<prototype>.<schema-line>.<content-line>.<checkpoint>
```

- Increment `checkpoint` for ordinary gameplay fixes, tuning, and renderer fixes inside the current content line.
- Increment `content-line` and reset `checkpoint` to `0` when bundled content or editor-facing asset surfaces change, such as enemy sprites, weapon sprite fields, terrain atlas metadata, example packs, or new upgrade ids.
- Increment `schema-line` and reset later segments only for save/content schema changes that require migration or coordinated editor/runtime rollout.
- Increment `prototype` only for a major prototype generation or release boundary.

The enemy sprite presentation pass moved the build from `v1.0.1.8` to `v1.0.2.0` because it adds bundled enemy image resources, archetype `presentation` fields, renderer imports, and editor example coverage.

## Enemy Sprite Update Checklist

When adding or changing bundled enemy sprites, update these together:

- `assets/images/enemies/<enemy>.svg` or another renderable image asset.
- `content/resources/enemies/sprite.enemy.<id>.json` with `assetId`, `kind: "image"`, `path`, `nativeSize`, and useful tags.
- `content/enemies/prototype0_enemy_archetypes.json` with `presentation.variant` and `presentation.sprite`.
- `content/packs/canon.prototype0.json` under `assets.images`.
- `src/render/canvasRenderer.js` imports plus `CANON_IMAGE_URLS` for bundled runtime rendering.
- Example-pack copies under `content/examples/prototype0-zone-enemy-set/...` when creator examples should show the same surface.
- Tests in `tests/enemyArchetypeDefinition.test.js`, `tests/levelMusic.test.js`, and `tests/zoneEnemyExampleContent.test.js`.

Current enemy sprite resource ids:

- `sprite.enemy.ghost_phaser`
- `sprite.enemy.spider_walker`
- `sprite.enemy.heavy_mortar_boat`
- `sprite.enemy.tractor_frog`
- `sprite.enemy.scrap_buzzard`
- `sprite.enemy.inchworm_carrier`
- `sprite.enemy.moth_bomber`

Current renderer variants:

- `ghostWraith`
- `tractorFrog`
- `heavyMortarBoat`
- `spiderWalker`
- `scrapBuzzard`
- `inchwormCarrier`
- `mothBomber`

## Weapon And Projectile Update Checklist

When changing weapon visuals or gameplay fields, update these together:

- Canon weapon JSON in `content/weapons/`.
- Resource descriptors in `content/resources/weapons/` when sprites or sheets change.
- Runtime normalization and validation in `src/core/weaponDefinition.js`.
- Firing/runtime behavior in `src/core/game.js`, `src/core/projectile.js`, `src/core/secondaryWeapon.js`, or `src/core/turret.js` as needed.
- Upgrade availability/effects in `src/core/economy.js` if a new tunable stat is exposed.
- Example-pack weapons under `content/examples/prototype0-module-set/`.
- Tests in `tests/weaponPatternDefinition.test.js`, plus focused gameplay tests such as `tests/playerGun.test.js`, `tests/secondaryWeapon.test.js`, or `tests/economy.test.js`.

## Validation Notes

Enemy archetype validation now checks `presentation` when present:

- `presentation.variant` must be a non-empty string.
- Unknown renderer variants warn instead of failing, so editor experiments are still possible.
- `presentation.sprite.assetId` and `presentation.sprite.path` must be non-empty strings.
- `nativeSize` and `displaySize`, when present, must be positive `[width, height]` pairs.
- `anchor`, when present, must be an `[x, y]` numeric pair.

Image resources now validate `nativeSize` when it is supplied.

## Before Pushing

Run the focused tests for touched surfaces, then the full suite and builds:

```bash
npm.cmd test -- --test-reporter=dot
npm.cmd run build
npm.cmd run build:pages
git diff --check
```

After pushing, tell the gameplay thread the exact badge to expect.

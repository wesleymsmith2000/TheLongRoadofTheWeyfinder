# Weapon Sprite Content Handoff

Date: 2026-09-01

## What Changed

The editor/content thread converted the newly added weapon concept sheets into small runtime-ready PNG sprites and wired those sprites into weapon and pattern JSON metadata.

Source sheets:

- `assets/stylesheets/weapons__Flechettes__sprite_stylesheet.png`
- `assets/stylesheets/weapons__mortar__sprite_stylesheet.png`
- `assets/stylesheets/weapons__OrbOfBlades__sprite_stylesheet.png`

Derived runtime sprites:

- `assets/images/weapons/tracking_flechette.png`
- `assets/images/weapons/orb_flechette.png`
- `assets/images/weapons/orb_blade_shard.png`
- `assets/images/weapons/orb_of_blades_core.png`
- `assets/images/weapons/mortar_player_shell.png`
- `assets/images/weapons/mortar_enemy_shell.png`
- `assets/images/weapons/mortar_player_marker.png`
- `assets/images/weapons/mortar_enemy_marker.png`

Image resource descriptors were added under `content/resources/weapons/` and the canon pack manifest now includes them in `assets.images`.

## Content JSON Updates

Updated canon weapon assets:

- `content/weapons/tracking_flechette.json`
  - Added `projectile.sprite`.
- `content/weapons/mortar.json`
  - Added `projectile.sprite`.
  - Added `projectile.landingMarkerSprite`.
- `content/weapons/orb_of_blades.json`
  - Added `projectile.sprite` for the orb core.
  - Added `projectile.emitsProjectiles.sprite` for emitted blade shards.

Updated example enemy pattern assets:

- `content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json`
  - Added a homing projectile sprite.
- `content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json`
  - Added enemy mortar shell and landing marker sprites.

No cannon-specific sprite sheet was present in this asset drop, so `content/weapons/cannon.json` remains simulation-only for now. If a `weapons__cannon__sprite_stylesheet` sheet is added later, it should follow the same `sprite.weapon.*` resource descriptor pattern.

## Runtime Contract

Sprite descriptors are render-facing metadata and should not affect simulation. The validated shape is:

```json
{
  "assetId": "sprite.weapon.tracking_flechette",
  "path": "assets/images/weapons/tracking_flechette.png",
  "sourceSheet": "assets/stylesheets/weapons__Flechettes__sprite_stylesheet.png",
  "nativeSize": [66, 25],
  "displaySize": [22, 8],
  "anchor": [0.5, 0.5],
  "alignToVelocity": true
}
```

`assetId` is required. `path`, `uri`, `sourceSheet`, `nativeSize`, `displaySize`, `anchor`, and `alignToVelocity` are optional but validated when present.

The core now preserves these fields through:

- `runtimeWeaponDefinition()`
- `createProjectile()`
- primary weapon firing
- secondary weapon firing
- emitted player projectiles from `emitsProjectiles`
- enemy pattern projectiles from `firePattern()`

While verifying the sprite work, the thread also aligned `tractor_beam` as a secondary weapon across account defaults, achievement rewards, gun loadout filtering, and the secondary weapon runtime definition map. It was previously split between primary and secondary paths, which caused unlock/availability tests to disagree.

## Game Thread Integration Needed

The canvas renderer still draws projectiles procedurally today. To make these sprites visible in-game, the main game thread should:

1. Load `image` resources from active content packs into an asset map keyed by `assetId`.
2. In `drawProjectiles`, prefer `projectile.sprite` when its image is loaded.
3. Draw projectile sprites at `projectile.x, projectile.y - projectile.z` for arc projectiles.
4. Draw `projectile.landingMarkerSprite` at ground position `projectile.x, projectile.y` for arc/telegraph markers when present.
5. Use `sprite.displaySize` for world-space size, `sprite.anchor` for alignment, and `sprite.alignToVelocity ? projectile.angle : 0` for rotation.
6. Keep the existing procedural drawing as fallback when a sprite is missing or still loading.

Recommended interpretation:

- Tracking flechettes and orb blade shards should rotate with velocity.
- Mortar shells should remain upright/readable during arc flight unless the game thread prefers a light spin animation.
- Mortar landing markers should render under the projectile/target and below most foreground constructs.
- Orb core can rotate or animate later, but the current metadata points at a single viable frame.

## Editor Notes

`tools/weapon-pattern-lab.html` now exposes compact JSON editors for:

- weapon projectile sprite descriptors
- weapon landing marker sprite descriptors
- pattern projectile sprite descriptors
- pattern landing marker sprite descriptors

The lab also includes the newer `tractor_beam` and `repulsor_beam` assets in the canon weapon dropdown.

## Validation

Tests cover:

- canon weapon validation with sprite descriptors
- image resource registration through the content registry
- pattern-fired projectile sprite preservation

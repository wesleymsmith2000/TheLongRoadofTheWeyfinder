# Weapon And Construct Sprite Wiring Handoff

Date: 2026-09-01

## Purpose

This handoff is for the main game dev thread. The editor/content thread has added runtime-ready sprite assets and JSON metadata for the newer weapons, plus the first content-pack resource descriptors needed to load those images. The remaining work is to make the game renderer consume those descriptors and to define the construct-side presentation seam without replacing voxel simulation.

## Sprite Assets Ready To Use

Source sprite sheets:

- `assets/stylesheets/weapons__Flechettes__sprite_stylesheet.png`
- `assets/stylesheets/weapons__mortar__sprite_stylesheet.png`
- `assets/stylesheets/weapons__OrbOfBlades__sprite_stylesheet.png`

Derived runtime PNGs:

- `assets/images/weapons/tracking_flechette.png`
- `assets/images/weapons/orb_flechette.png`
- `assets/images/weapons/orb_blade_shard.png`
- `assets/images/weapons/orb_of_blades_core.png`
- `assets/images/weapons/mortar_player_shell.png`
- `assets/images/weapons/mortar_enemy_shell.png`
- `assets/images/weapons/mortar_player_marker.png`
- `assets/images/weapons/mortar_enemy_marker.png`

Resource descriptors:

- `content/resources/weapons/sprite.weapon.tracking_flechette.json`
- `content/resources/weapons/sprite.weapon.orb_flechette.json`
- `content/resources/weapons/sprite.weapon.orb_blade_shard.json`
- `content/resources/weapons/sprite.weapon.orb_of_blades_core.json`
- `content/resources/weapons/sprite.weapon.mortar_player_shell.json`
- `content/resources/weapons/sprite.weapon.mortar_enemy_shell.json`
- `content/resources/weapons/sprite.weapon.mortar_player_marker.json`
- `content/resources/weapons/sprite.weapon.mortar_enemy_marker.json`

The canon pack includes these descriptors in `content/packs/canon.prototype0.json` under `assets.images`.

## JSON Already Wired

Weapon definitions now expose render metadata:

- `content/weapons/tracking_flechette.json`
  - `projectile.sprite`
- `content/weapons/mortar.json`
  - `projectile.sprite`
  - `projectile.landingMarkerSprite`
- `content/weapons/orb_of_blades.json`
  - `projectile.sprite`
  - `projectile.emitsProjectiles.sprite`

Example enemy patterns also include sprite metadata:

- `content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json`
  - homing projectile sprite
- `content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json`
  - enemy mortar shell sprite
  - enemy mortar landing marker sprite

`content/weapons/cannon.json` intentionally has no sprite yet because no cannon-specific sheet was added in this asset pass. Rockets and cannons can continue using procedural rendering until matching sheets exist.

## Runtime Data Path Already Preserved

The simulation side should already preserve sprite descriptors through the weapon and pattern firing paths:

- `src/core/weaponDefinition.js`
  - validates `projectile.sprite`, `projectile.landingMarkerSprite`, and `projectile.emitsProjectiles.sprite`
- `src/core/projectile.js`
  - stores cloned `sprite` and `landingMarkerSprite` descriptors on projectiles
- `src/core/patternDefinition.js`
  - preserves pattern projectile sprite descriptors
- `src/core/game.js`
  - passes weapon, mortar, beam, pattern, and emitted projectile sprite metadata into `createProjectile`
- `src/core/secondaryWeapon.js`
  - passes secondary weapon projectile sprite metadata into `createProjectile`

Sprite metadata is render-facing only. It must not change projectile collision radius, voxel damage, arcing logic, z-collision rules, or lifetime.

## Main Game Work Needed

1. Add an image asset loader/cache keyed by image resource `assetId`.

   The content registry already registers resource assets by kind. The renderer needs a runtime map such as `Map<assetId, HTMLImageElement | ImageBitmap>` loaded from the active pack's `assets.images`.

2. Resolve image paths in a Pages-safe way.

   Most descriptors currently include repo-relative `path` values such as `assets/images/weapons/tracking_flechette.png`. When running under GitHub Pages, resolve these against the Vite base URL instead of assuming root `/`. A helper that prefixes relative asset paths with `import.meta.env.BASE_URL` should be enough for bundled static assets.

3. Teach `src/render/canvasRenderer.js` to draw projectile sprites before procedural fallbacks.

   In `drawProjectiles`, prefer `projectile.sprite` when the referenced image is loaded. If the image is missing, still loading, malformed, or unavailable, fall back to the existing procedural projectile drawing.

4. Respect the sprite descriptor fields:

   - `displaySize`: world-space width and height
   - `anchor`: normalized anchor, usually `[0.5, 0.5]`
   - `alignToVelocity`: rotate by `projectile.angle` when true
   - `assetId`: primary lookup key
   - `path` or `uri`: fallback lookup/source when an asset registry entry is unavailable

5. Draw arcing projectile sprites at flight height.

   For `behavior: "arc"`, draw the shell at `projectile.x, projectile.y - projectile.z`. Keep the existing shadow behavior. If `projectile.landingMarkerSprite` is present, draw it at the ground target/telegraph position `projectile.x, projectile.y` below the shell and below most foreground constructs.

6. Keep special procedural beams procedural.

   `beam`, `mini_beam`, `tractor_beam`, and `repulsor_beam` are still better represented by the existing beam renderer unless or until a beam texture/animation contract is added. The sprite work is mainly for flechettes, mortar shells, mortar markers, orb cores, and orb blade shards.

7. Use enemy pattern sprite descriptors too.

   Pattern-fired mortar shells should use the enemy mortar shell and enemy landing marker descriptors. Ghost homing projectiles should use the tracking flechette style sprite from the example pattern data.

## Construct Presentation Seam

Current construct definitions remain voxel-authoritative:

- `content/constructs/starting_vehicle.json`
- `content/constructs/basic_turret.json`
- `src/core/constructDefinition.js`

There are no dedicated construct sprite resource descriptors yet. Do not replace construct hit masks, damage, connectivity, or module layout with bitmap sprites. The recommended next schema step is to add optional presentation metadata while keeping `cells` and `connections` authoritative.

Suggested construct extensions:

```json
{
  "presentation": {
    "sprite": {
      "assetId": "sprite.construct.example_ship",
      "path": "assets/images/constructs/example_ship.png",
      "nativeSize": [128, 128],
      "displaySize": [96, 96],
      "anchor": [0.5, 0.5],
      "alignToHeading": true
    },
    "cellSprites": {
      "gun": "sprite.module.gun.example",
      "armor": "sprite.module.armor.example"
    },
    "editorIcon": "sprite.construct.example_ship.icon"
  }
}
```

Recommended behavior:

- Runtime simulation continues to use `cells`, `connections`, and per-cell state.
- Construct sprites are optional overlays or preview icons.
- Per-cell/module sprites can be used in the vehicle editor and enemy editor without changing damage rules.
- The renderer should keep the current voxel renderer as fallback and as the source of damage readability.
- If a construct overlay is added, damaged/destroyed cells still need visible feedback, either by masking the overlay, tinting per-cell regions, or drawing damage voxels above the overlay.

## Acceptance Criteria

- Tracking flechettes, orb cores, orb blade shards, player mortar shells, and player mortar landing markers render from content sprite descriptors in local dev and on GitHub Pages.
- Enemy pattern projectiles can render the enemy mortar shell/marker and ghost homing projectile sprite descriptors.
- Missing or unloaded sprite assets never crash rendering and always fall back to procedural drawing.
- Sprite display does not affect collisions, damage, arc timing, z-collision, or homing behavior.
- Constructs remain fully voxel-damageable even after optional sprite/icon presentation metadata is introduced.

## Tests To Add Or Verify

- Content registry registers image resource descriptors from `content/packs/canon.prototype0.json`.
- Weapon and pattern runtime definitions preserve sprite descriptors after validation.
- Projectile creation clones sprite descriptors and does not mutate source weapon JSON.
- Canvas sprite drawing falls back when the image cache misses.
- Arc projectile rendering draws landing markers at ground position and shells at `y - z`.
- Pages build resolves bundled sprite paths under the configured base URL.

## Related Docs

- `docs/weapon-sprite-content-handoff.md`
- `docs/content-pack-manifest.md`
- `docs/creator-extension-api.md`
- `docs/editor-new-weapons-enemies-pages-handoff.md`

# Gameplay / Audio / Mobile Handoff

Date: 2026-08-30

This handoff summarizes the current gameplay polish pass for the main game dev thread. Treat it as review context, not as a new instruction set.

## Implemented

- Boss octopus laser attacks now use a 3 second charge.
- Boss laser target tracking updates for the first 2 seconds, then locks for the final 1 second before firing.
- Boss laser telegraph rendering now shows a steadier red tracking beam during tracking, then a very fast flash during the locked final second.
- First two early soundtrack sets now use runtime pirate ship enemy silhouettes:
  - `TheWeyfindersRoad_*`
  - `DigitizedStream_*`
- Pirate ship enemies rotate to face their movement direction.
- Pirate ship enemies briefly rotate into broadside posture when firing.
- Enhanced pirate enemies use an added spiked skull bulkhead / ram visual and still use level-style palettes.
- Mobile now has a floating `SWAP` button above the `2ND` fire button, wired to cycle secondary weapons without opening the HUD.
- Core simulation now emits pure `soundEvents`; browser audio playback stays in `src/main.js`.

## Sound Mapping

- Player cannon and rocket explosions: `A Futuristic Cannon Fire Sound Effect. About 2 Seconds Max. Should Have A Mix.mp3`
- Enemy death explosions: `A Futuristic Cannon Fire Sound Effect. About 2 Seconds Max. Should Have A Mix.mp3`
- Enemy beam weapon: `ErrorBuzz2.mp3`
- Enemy bullet fire: `ErrorClick.mp3`
- Player main gun: `ButtonChirp.mp3`
- Player cannon and rocket launch: `RocketAccelerate.mp3`
- Player beam weapon: `ParticleBeam.mp3`
- Player finishes stage successfully: `VictoryTone1.mp3`

## Important Files

- `src/core/enemy.js`
- `src/core/game.js`
- `src/core/secondaryWeapon.js`
- `src/core/soundEvents.js`
- `src/main.js`
- `src/render/canvasRenderer.js`
- `index.html`
- `tests/enemy.test.js`
- `tests/levelProgression.test.js`
- `tests/secondaryWeapon.test.js`

## Verification

These passed locally after the pass:

```text
npm.cmd test
npm.cmd run build
npm.cmd run build:pages
```

Latest observed test count:

```text
141 passed
```

`npm.cmd run build:pages` required elevated filesystem access in Codex on Windows due to the existing Vite config path sandbox issue; the elevated build passed.

## Review Notes For Main Dev Thread

- The pirate ship shapes are runtime-created prototype silhouettes, not new content JSON yet. This keeps the current editor/content contract untouched while the visual direction is tested.
- Collision and damage still use the underlying voxel cells in normal world orientation. The pirate ship rotation is render-only for now.
- The sound-event queue is intentionally pure data so simulation tests stay browser-independent.
- Audio playback currently reuses one `Audio` element per source and resets `currentTime`; if overlapping SFX layering becomes important, replace `soundPlayerFor` with a tiny player pool.
- The enhanced pirate bulkhead is render flair over the voxel body. If it becomes gameplay armor or a distinct weak point, it should move into content/construct data.
- Main game review synced `content/enemies/prototype0_enemy_archetypes.json` so the pirate ship variants and 3 second boss laser telegraph are visible to editor tooling.
- Main game follow-up made early-wave ship silhouettes fallback by level as well as soundtrack name, so the silhouette should appear even if music rotation changes.
- Particle beam collision is now width-aware at voxel level. It samples across the animated beam width, damages the first damageable voxel on each lane, and continues through additional voxels only according to pierce.
- Beam width upgrade growth was reduced by half, beam damage per frame was reduced by 25%, and the upgrade shop now includes beam ammo capacity plus main gun shot velocity.

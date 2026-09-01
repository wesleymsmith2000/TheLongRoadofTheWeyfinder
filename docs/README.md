# Weyfinder Creator Architecture Docs

This folder documents the shared content language for The Long Road of the Weyfinder.

The canonical game repo is the reference implementation. Editors, helper tools, and future community packs should emit the same versioned assets that the runtime consumes.

Start here:

- [Creator Extension API](./creator-extension-api.md)
- [Content Pack Manifest](./content-pack-manifest.md)
- [Level Editor Main Game Handoff](./level-editor-main-game-handoff.md)
- [Enemy And Pattern Editor Handoff](./enemy-pattern-editor-handoff.md)
- [Gameplay / Audio / Mobile Handoff](./gameplay-audio-mobile-handoff.md)
- [Editor Runtime Seams](./editor-runtime-seams.md)
- [Local Content Module API](./local-content-module-api.md)
- [Local Content Module Handoff](./local-content-module-handoff.md)
- [Enemy Editor Runtime Handoff](./enemy-editor-runtime-handoff.md)
- [Creator Suite Local Modules Handoff](./creator-suite-local-modules-handoff.md)
- [Weapon Loadout And Flechette Handoff](./weapon-loadout-and-flechette-handoff.md)
- [Elevation Enemy And Loadout Editor Handoff](./elevation-enemy-loadout-editor-handoff.md)
- [Arc Projectiles And Status Effects Editor Handoff](./arc-status-effects-editor-handoff.md)
- [Combat Balance Editor Follow-Up Handoff](./combat-balance-editor-followup-handoff.md)
- [Editor New Weapons, Enemies, And Pages Handoff](./editor-new-weapons-enemies-pages-handoff.md)
- [Zone Enemy Example Pack Handoff](./zone-enemy-example-pack-handoff.md)
- [Weapon Sprite Content Handoff](./weapon-sprite-content-handoff.md)
- [Weapon And Construct Sprite Wiring Handoff](./weapon-construct-sprite-wiring-handoff.md)
- [Procedural Terrain Content](./procedural-terrain-content.md)
- [Procedural Terrain Architecture Handoff](../CODEX_HANDOFF_PROCEDURAL_TERRAIN_V0_1.md)
- [Procedural Terrain Rendering / Art Handoff](./RENDERING_HANDOFF_PROCEDURAL_TERRAIN_V0_1.md)

Current priorities:

- keep simulation code independent of editor UI
- prefer versioned data assets over hard-coded content
- validate malformed content strongly
- warn, rather than forbid, mechanically legal but weak designs
- keep room for canon, experimental, community, variant, and total-conversion content

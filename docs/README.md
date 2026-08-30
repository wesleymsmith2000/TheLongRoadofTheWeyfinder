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

Current priorities:

- keep simulation code independent of editor UI
- prefer versioned data assets over hard-coded content
- validate malformed content strongly
- warn, rather than forbid, mechanically legal but weak designs
- keep room for canon, experimental, community, variant, and total-conversion content

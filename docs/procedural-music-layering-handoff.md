# Procedural Music Layering Handoff

Date: 2026-09-08

The runtime now has a small procedural music state machine intended for future Road / Fate's Shadow cues.

## Runtime Contract

Primary file: `src/core/proceduralMusic.js`

Semantic states:

- `TRAVEL`
- `ATTENTION`
- `SUSPICION`
- `MANIFESTATION`
- `AFTERIMAGE`

Layer names:

- `travel`
- `attention`
- `suspicion`
- `manifestation`
- `afterimage`

The core simulation owns only deterministic state:

- current base track
- semantic state
- target layer weights
- faded layer volumes
- a pending cue when the signature changes

It does not touch browser audio APIs.

## Browser Seam

Primary file: `src/main.js`

The current game still plays one base track. A new `MUSIC_LAYER_URLS` table is ready for optional stem/cue loops keyed by base track:

```js
const MUSIC_LAYER_URLS = {
  TheWeyfindersRoad_1: {
    attention: attentionStemUrl,
    suspicion: suspicionStemUrl
  }
};
```

If a layer has no asset, no audio element is created. This keeps the current build cheap while leaving the machinery ready for real stems.

Console inspection:

```js
WeyfinderMusic.snapshot()
WeyfinderMusic.lastCue()
WeyfinderMusic.layerAssets()
```

## Current Cue Sources

The initial procedural music state reacts to:

- incoming enemy warning markers
- active enemies
- boss presence
- active beam/laser telegraphs
- heavy projectile pressure
- victory banner / level-complete afterimage

This is intentionally small. The adaptive director can later feed resolved event windows into the same state machine rather than issuing per-frame music commands.

## Performance Rules

- Core music scoring runs at 5 Hz.
- Browser playback is state-driven and coalesced.
- No per-frame DOM rebuilds are involved.
- No per-frame JSON parsing is involved.
- Future stem assets should be preloaded and crossfaded, not repeatedly restarted.

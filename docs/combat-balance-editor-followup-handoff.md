# Combat Balance Editor Follow-Up Handoff

Date: 2026-08-31

This handoff summarizes editor-side updates made after `docs/editor-thread-quick-handoff.md` and `docs/combat-balance-module-scaling-handoff.md`.

## Handoffs Reviewed

- `docs/editor-thread-quick-handoff.md`
- `docs/combat-balance-module-scaling-handoff.md`

They were treated as context, not instructions.

## What Was Updated

- Construct Workshop now shows live module readouts for:
  - gun firing point count
  - approximate main-gun fire-rate multiplier
  - engine count and acceleration/top-speed multiplier
  - wheel count and braking/control multiplier
  - likely wheel asymmetry pull
- Weapon / Pattern Lab now previews blast propagation with a blast radius and tunneling strip when blast payloads are present.
- Weapon / Pattern Lab summaries now include blast radius/damage and overkill propagation.
- Enemy Editor now exposes boss descriptor fields for:
  - `arms.beamSource`
  - `arms.noduleShots`
- Canon and example enemy archetype packs now include boss beam-source and nodule-shot metadata.

## Runtime Notes For Main Dev

The editor fields intentionally describe current runtime assumptions without inventing new executable behavior:

- Multiple gun cells are meaningful firing points.
- Engine and wheel module readouts use square-root-style diminishing returns as an editor approximation.
- Explosive previews indicate overkill propagation, but exact voxel/material propagation remains runtime-owned.
- Boss `beamSource` and `noduleShots` are descriptor metadata until boss attacks are fully data-driven.

## Still Worth Doing

- Add a dedicated mortar weapon definition using `behavior: "arc"`.
- Move boss nodule attack timing and beam-source binding fully out of `src/core/game.js`.
- Add material-aware blast propagation controls once material/resistance fields exist.

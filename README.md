# The Long Road of the Weyfinder

Browser-playable Prototype 0 for the vehicle roguelite: a modular machine whose parts are physically shredded away instead of using a global HP bar.

## Run

```bash
npm install
npm run dev
```

Open the forwarded Vite preview on port `5173`.

## Test

```bash
npm test
```

## Controls

- `WASD` or arrow keys: thrust / strafe
- `Q` / `E`: rotate
- `Space`: brake and stabilize
- `F`: toggle autofire
- `D`: toggle debug overlay
- `R`: reset scene

## Prototype Scope

Implemented for Milestone 1:

- modular vehicle cells with explicit structural graph edges
- pseudo-voxel damage masks
- anchor integrity derived from damaged voxel regions
- structural flood fill from the Core
- disconnected modules detach and tumble away
- guns stop firing when detached
- vehicle mass, center of mass, and inertia recalculate after damage
- projectile damage and impulse are separate
- primitive Canvas renderer and debug overlay

Milestone 2 wiring glitches are intentionally not implemented yet.

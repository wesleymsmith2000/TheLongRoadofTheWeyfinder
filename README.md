# The Long Road of the Weyfinder

Browser-playable Prototype 0 for the vehicle roguelite: a modular machine whose parts are physically shredded away instead of using a global HP bar.

## Run

```bash
npm install
npm run dev
```

Open the forwarded Vite preview on port `5173`.

## Public Playtest

The `main` branch deploys to GitHub Pages:

```text
https://wesleymsmith2000.github.io/TheLongRoadofTheWeyfinder/
```

## Test

```bash
npm test
```

## Current Loop

Destroy every enemy to clear the level, then use `Start Next Level` to continue. Each new level adds one more enemy. The run ends when the Core is lost and reports total levels completed.

## Controls

- `WASD` or arrow keys: thrust / strafe
- Mouse: aim turret
- Mouse click: fire selected secondary weapon
- `Q` / `E`: cycle secondary weapon
- Double-tap a move direction: dodge/boost
- `Space`: brake and stabilize
- `F`: toggle autofire
- `D`: toggle debug overlay
- `R`: reset scene
- `H` or `?`: controls panel
- `Z` / `X`: cycle secondary weapon
- `Shift`: fire secondary weapon

## Controller

Standard browser gamepads are supported, including Xbox controllers in the `standard` layout.

- Left stick: move within the road lane
- Right stick: aim turret
- Left/right triggers: rotate
- Left/right bumpers: cycle secondary weapon
- Stick press: fire secondary weapon
- `A`: brake and stabilize
- `B`: dodge/boost in the current left-stick direction
- D-pad up: toggle autofire
- `X`: toggle debug overlay
- `Y`: reset scene
- View/Back or Menu/Start: controls panel

Mobile touch:

- Left side drag: virtual movement stick
- Right side touch/drag: aim and fire turret
- `BOOST` button: dodge/boost in the current movement direction

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

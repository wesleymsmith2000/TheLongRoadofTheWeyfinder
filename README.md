# The Long Road of the Weyfinder

Browser-playable Prototype 0 for the vehicle roguelite: a modular machine whose parts are physically shredded away instead of using a global HP bar.

## Run

```bash
npm install
npm run dev
```

Open the forwarded Vite preview. Vite starts on port `5173`, or the next open port if `5173` is already busy.

## Public Playtest

The `main` branch deploys to GitHub Pages:

```text
https://wesleymsmith2000.github.io/TheLongRoadofTheWeyfinder/
```

## Test

```bash
npm test
```

## Creator Tools

Early editor work lives in this main game repo while Prototype 0 is hardening its shared runtime schemas. The current rule is:

- put runtime-consumed schemas, validators, loaders, first-party content, and small vanilla editor pages in this repo
- keep editor output identical to the JSON assets under `content/`
- keep simulation code independent of Canvas, DOM, and editor UI
- move a creator suite to a separate repo only when it needs its own release cycle, package/dependency stack, publishing flow, accounts, plugin system, or total-conversion launcher

Open the first tool during local development at:

```text
http://127.0.0.1:5173/tools/construct-workshop.html
```

Open the weapon and firing-pattern tool at:

```text
http://127.0.0.1:5173/tools/weapon-pattern-lab.html
```

Open the level editor framework at:

```text
http://127.0.0.1:5173/tools/level-editor.html
```

The launch screen includes the first in-game player vehicle editor. It uses local prototype account data for available equipment and edits the runtime vehicle construct before deployment.

Shared content starts under:

```text
content/
  constructs/
  weapons/
  patterns/
  levels/
  packs/
```

Creator architecture and content-pack guidance lives in:

```text
docs/
```

The shared content registry starts in `src/core/contentRegistry.js`. It validates pack manifests, registers immutable asset definitions, and checks level dependencies before a level package is handed to future runtime level-runner code.

## Current Loop

Destroy every enemy, collect the dropped scrap, then use `Start Next Level` to continue. Each new level adds one more enemy. The run ends when the Core is lost and reports total levels completed.

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
- `DBG` button or `D`: debug stats panel
- `G`: toggle gunner AI
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
- `HUD` button: show or hide the vehicle/combat panel

The run now starts paused on a launch screen so controls, HUD, and debug settings can be prepared before the first wave begins.

## Help And Economy Notes

The in-game `?` button opens the help panel with controls, combat notes, and the current scrap plan.

Scrap collection is the first economy hook. When an enemy is destroyed, each surviving enemy voxel becomes a scrap pickup. Pickups magnetize toward the craft at about 30 voxel range. Drive over pickups to collect them before the next level starts.

Current between-wave actions:

- Repair damaged systems: about 1-2 scrap per repair step
- Replace detached systems or pieces: about 2x the full repair cost
- Refill one secondary weapon ammo reserve: about half of a full enemy worth of scrap
- Buy an ammo module: planned at about 4x a full ammo complement, adding one extra standard ammo load for that weapon

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

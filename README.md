# The Long Road of the Weyfinder

Browser-playable Prototype 0 for the vehicle roguelite: a modular machine whose parts are physically shredded away instead of using a global HP bar.

## Run

```bash
npm install
npm run dev
```

Open the forwarded Vite preview. Vite starts on port `5173`, or the next open port if `5173` is already busy.

## Arcade Mode

Choose **Arcade Run** for the fixed-vehicle forward shooter. The 114-cell hull uses single-cell systems and faces road-forward, with Guided AI targeting, seeded Main Gun spray, doubled bullet flight time, reticle-targeted cannon detonations and forward beam fire. Acceleration and braking use a 2.25 multiplier and top speed uses a 4 multiplier relative to the same Normal hull. Bosses recover toward reachable forward positions between scripted maneuvers. Arcade travels twice as fast over terrain tiles with four times the edge length; each chunk contains one quarter as many tiles, with unchanged cache image dimensions. Each gun cell holds one primary and one secondary; three cells start active, with two primary and three secondary slots. Each zone boss clear opens one additional slot. Mini Beam is an automatic utility, and fully inactive gun cells show a grey X with a hover explanation. Quiet screens get a single gap Diver after two seconds without visible enemies or scrap; it yields to scheduled waves and never counts toward completion. Scheduled waves still use the 15-second empty-screen limit. Divers use faster movement, tighter visible turns and player-directed tracking spray. Motorcycle wheel loss triggers a spinout and explosion; Stream Divers react to nearby hoppers with fear and, after surviving five seconds, relief. Each level requires two cleared Diver waves, and the progress bar includes those waves and their partial kills. See [Arcade runtime rules](docs/arcade-mode.md) and [Diver content and behavior](docs/arcade-divers.md).

Arcade v1.0.18.0 strengthens the Wavelet ultimate: double attraction, 50% longer and 25% narrower reach, triple scene distortion without straight guides, a charging movement pin and firing recoil, projectile returns at triple speed, and a full level-10 Particle Beam burst damage floor. Bullets from both teams and player flechettes are 50% larger and faster; all projectile damage increases another 50%.

## Public Playtest

The `main` branch deploys to GitHub Pages:

```text
https://wesleymsmith2000.github.io/TheLongRoadofTheWeyfinder/
```

Publish each verified gameplay update to Pages by default so PC and phone playtests use the same release. After tests and the Pages build pass, commit and push the relevant changes to `main`, wait for the **Deploy Pages** workflow to succeed, and verify the public build version before reporting deployment complete. The current Arcade build is **v1.0.18.0**. Local edits and builds alone do not update the public site; the visible version identifies the release loaded by each browser.

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

Open the unified creator suite during local development at:

```text
http://127.0.0.1:5173/tools/creator-suite.html
```

Open the construct workshop at:

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

Open the mesh voxelizer at:

```text
http://127.0.0.1:5173/tools/mesh-voxelizer.html
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

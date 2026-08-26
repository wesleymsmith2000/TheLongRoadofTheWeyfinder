# Vehicle Roguelite Prototype — Codex Build Handoff

## Purpose

Start a lightweight, browser-playable prototype of the **The Veil Remembers vehicle roguelite** that can be developed primarily through:

- GitHub
- GitHub Codespaces
- VS Code in the browser
- Codex / AI-assisted coding
- phone-first remote steering

The first implementation should be easy to launch in a Codespace, test in a browser, and iterate without requiring a local laptop toolchain.

A later goal is to adapt the same simulation concepts to:

- DroidScript / Android / Fire TV
- Roblox

Do **not** optimize for those platforms yet. Keep the simulation modular enough that the rules can later be ported.

---

# 1. Core Game Thesis

The game is a modular vehicle-builder + bullet-hell roguelite.

The most important rule is:

> **The vehicle is the health bar.**

The player does not primarily lose abstract HP.

Instead, the contraption they built is physically shredded apart:

- armor gets chipped away,
- structural anchors fail,
- weapons fall off,
- wiring becomes intermittent,
- propulsion becomes asymmetric,
- fuel leaks,
- cooling fails,
- sensors glitch,
- the center of mass shifts,
- handling changes,
- and the player keeps going as long as the Core remains functional.

The first prototype only needs to prove that this is fun and legible.

---

# 2. Prototype 0 — “The Shreddable Box”

Build the smallest playable experiment.

The player controls a small modular vehicle made from grid cells.

Example starting vehicle:

```text
[A][G][A]
[W][C][W]
[ ][E][ ]
```

Where:

- `C` = Core
- `A` = armor / structure
- `G` = gun
- `W` = wheel / propulsion
- `E` = engine / power source

The vehicle moves as one lightweight 2D rigid body.

Enemy projectiles can hit specific areas of the vehicle.

Damage removes visible pseudo-voxels from the impacted cell.

Enough localized damage can:

- weaken a cell,
- sever structural anchors,
- damage wiring,
- depower a device,
- detach an otherwise mostly intact module,
- change the mass distribution of the surviving craft.

Detached pieces should visibly fall / tumble away.

If a gun detaches or loses usable power/control connectivity, it must immediately stop contributing DPS.

---

# 3. Visual Direction

The game should use:

> **2D arcade logic with pseudo-voxelized 2.5D presentation.**

Do not build a full 3D engine.

Use HTML5 Canvas first.

The camera should feel nearly top-down, with enough fake depth to suggest chunky physical construction.

Each build cell should appear as a small rotatable cluster of voxels / block fragments rather than one flat square.

Suggested visual principles:

- visible top surfaces,
- tiny side faces / extrusion,
- simple shadows,
- layered equipment,
- damage removes visible chunks,
- detached modules visibly break away,
- cells rotate with the vehicle,
- projectiles and effects remain fundamentally 2D.

The important rule is:

> **Render depth. Do not simulate unnecessary depth.**

The exact art style can remain primitive in Prototype 0.

Colored blocks are acceptable if the structural damage is readable.

---

# 4. Two-Level Vehicle Representation

Do not represent every voxel as an independent physics object.

Use two levels of simulation.

## Level A — Vehicle Cells

Each build cell is a logical module.

Example:

```js
{
  id,
  type,
  gridX,
  gridY,
  layer,
  rotation,
  material,
  componentState
}
```

The vehicle grid defines large-scale construction geometry.

## Level B — Cell Voxel Mask

Each logical cell contains a small pseudo-voxel damage mask.

For Prototype 0, something small is sufficient, for example:

```text
6 x 6 x 3
```

or an equivalent 2D/2.5D representation.

Voxel roles can initially be:

```text
EMPTY
STRUCTURE
ARMOR
ANCHOR
WIRE
DEVICE
```

Do not create thousands of independent rigid bodies.

Voxel damage exists primarily to determine:

- visible damage shape,
- remaining mass,
- remaining anchor integrity,
- remaining wiring integrity,
- remaining device integrity.

After damage, summarize the voxel mask into aggregate descriptors.

---

# 5. Grid Geometry != Connectivity

This is an important architectural requirement.

> **The grid determines where components are.  
> Explicit graph edges determine what is connected.**

Adjacency can create sensible default connections automatically, but adjacency must not be equivalent to connectivity.

This is required so later versions can support:

- structural support routing,
- electrical wiring,
- thermal paths,
- control networks,
- fuel / coolant plumbing,
- insulating joints,
- manual support / wiring views.

The player should eventually be able to edit or override connections.

Prototype 0 does not need the connection editor UI, but the data model must not prevent it.

---

# 6. Anchor-Based Structural Failure

Connections between cells should be tied to specific **anchor regions**.

Example:

```text
Cell A right anchor <--> Cell B left anchor
```

If damage destroys the voxels supporting the anchor:

```text
connection becomes structurally invalid
```

This means a component may remain mostly intact yet fall off because the small region attaching it to the vehicle was severed.

This behavior is highly desirable.

Example:

```text
CORE -- FRAME -- CANNON
```

The cannon may still have 90% of its voxels but detach if its mounting neck is destroyed.

After structural damage:

1. update affected anchor integrity,
2. update structural graph edges,
3. flood-fill / traverse structural connections from the Core,
4. any unreachable module detaches.

---

# 7. Aggregate Cell Integrity Channels

After voxel damage, derive aggregate state rather than simulating every voxel individually.

Suggested cell state:

```js
{
  mass,
  centerOfMassLocal,
  momentOfInertiaContribution,

  structureIntegrity,
  anchorIntegrity,
  armorCoverage,

  wiringIntegrity,
  deviceIntegrity,

  temperature,
  statuses
}
```

Later systems can add:

```text
fuelIntegrity
coolantIntegrity
heaterIntegrity
controlIntegrity
sensorIntegrity
```

Prototype 0 only needs enough channels to prove structural and wiring degradation.

---

# 8. Partial Damage Should Produce Glitching

Do not make every subsystem purely ON / OFF.

Example wiring behavior:

```text
100% wiring
-> fully reliable

>= 50%
-> fully reliable for Prototype 0

< 50%
-> increasingly intermittent

10%
-> mostly offline with occasional successful activity

0%
-> completely offline
```

Avoid independent per-frame random flickering.

Instead, use stateful failure behavior such as:

```text
ON
-> GLITCH
-> OFF
-> RECOVER
```

The lower the integrity:

- the more often faults begin,
- the longer faults last,
- the lower the average uptime.

Use a seeded RNG so behavior is reproducible during testing.

The exact curve can be tuned later.

---

# 9. Lightweight Vehicle Physics

The vehicle should behave as one 2D body while attached.

Track:

```js
position
velocity
heading
angularVelocity
```

Derive from surviving cells:

```text
totalMass
centerOfMass
momentOfInertia
```

When components detach or are destroyed:

- recalculate mass,
- recalculate center of mass,
- recalculate moment of inertia,
- handling should change.

The player should be able to start with a balanced craft and finish with a wreck that pulls / rotates differently.

Use **legible arcade physics**, not strict simulation.

---

# 10. Projectile Impulse

Projectiles should carry both:

```text
damage
impulse
```

plus:

```text
impact position
impact direction
```

These are separate effects.

A hit can:

- damage voxels,
- push the vehicle,
- rotate the vehicle.

A light craft should be easier to knock and spin.

A heavy craft should be more sluggish to control but harder to knock around.

This is important for later:

- shields that stop damage but not momentum,
- heavy vs light builds,
- propulsion types,
- terrain traction,
- asymmetric wreck handling.

---

# 11. Prototype 0 Weapons and Enemies

Keep combat tiny.

Player:

- one autofiring gun,
- movement,
- optional simple brake / stabilization button.

Enemy:

- one stationary or slowly moving enemy,
- aimed shots,
- one radial burst.

Projectile state can remain:

```js
{
  x,
  y,
  vx,
  vy,
  radius,
  damage,
  impulse,
  lifetime
}
```

Do not implement elaborate weapon systems yet.

---

# 12. Core Failure Rule

The Core is mandatory.

As long as the Core remains structurally part of the surviving vehicle and is functional, the run continues.

The run ends when:

- the Core is destroyed,
- or no usable vehicle state remains.

Do not add a global player HP bar.

Individual modules and voxel regions may have durability.

---

# 13. Architecture

Simulation code must not depend on:

- Canvas rendering,
- DroidScript,
- Roblox,
- DOM UI.

Suggested repository:

```text
vehicle-roguelite/
|
|-- AGENTS.md
|-- README.md
|-- CODEX_HANDOFF.md
|-- package.json
|-- index.html
|
|-- .devcontainer/
|   `-- devcontainer.json
|
|-- src/
|   |-- main.js
|   |
|   |-- core/
|   |   |-- game.js
|   |   |-- vehicle.js
|   |   |-- cell.js
|   |   |-- voxelMask.js
|   |   |-- connections.js
|   |   |-- damage.js
|   |   |-- physics.js
|   |   |-- projectile.js
|   |   `-- rng.js
|   |
|   |-- render/
|   |   `-- canvasRenderer.js
|   |
|   |-- input/
|   |   |-- keyboard.js
|   |   `-- gamepad.js
|   |
|   `-- debug/
|       `-- debugOverlay.js
|
`-- tests/
    |-- connections.test.js
    |-- damage.test.js
    |-- physics.test.js
    `-- wiring.test.js
```

Keep modules small and understandable.

Do not introduce ECS architecture unless the project clearly needs it later.

---

# 14. Codespaces Requirements

The repository should launch cleanly in GitHub Codespaces.

Use a minimal Node-based dev environment.

Recommended:

- current stable Node LTS,
- npm,
- Vite only as a lightweight development server / bundler,
- Node's built-in test runner if practical.

Runtime game code should remain framework-free JavaScript.

No React.

No Phaser initially.

No Three.js initially.

No physics engine initially.

No backend initially.

No database initially.

The Codespace should support:

```bash
npm install
npm run dev
npm test
```

`npm run dev` should launch the prototype on:

```text
0.0.0.0:5173
```

so GitHub Codespaces can forward the port and open the game in a browser.

---

# 15. Phone-First Development Goal

The project should be practical to steer without sitting at a laptop.

Expected workflow:

```text
Phone
  |
  | ChatGPT / Codex instructions
  v
GitHub repository
  |
  v
Codespace
  |
  +--> Codex edits code
  |
  +--> browser preview through forwarded port
  |
  +--> tests
  |
  `--> commits / PRs
```

Favor:

- clear file names,
- short modules,
- useful debug overlays,
- deterministic test scenarios,
- simple commands,
- minimal manual setup.

Do not require local desktop-only utilities.

---

# 16. Debug UI

Prototype 0 should have a simple toggleable debug overlay.

Suggested information:

```text
FPS
vehicle mass
center of mass
moment of inertia
linear speed
angular velocity

selected / last-hit cell
cell structure integrity
cell anchor integrity
cell wiring integrity
cell device integrity

number of connected cells
number of detached cells
```

Optional debug rendering:

- center of mass marker,
- structural graph edges,
- anchor regions,
- hit location,
- cell boundaries.

This is important for remote iteration.

---

# 17. Seeded Determinism

Use a lightweight seeded RNG abstraction.

It should eventually support independent streams such as:

```text
combatSeed
damageSeed
dialogueSeed
worldSeed
```

Prototype 0 only needs one or two.

Given the same:

- starting vehicle,
- seed,
- input sequence,

simulation behavior should be as reproducible as practical.

This will help later with:

- testing,
- replay,
- procedural levels,
- deterministic crew chatter selection.

---

# 18. First Acceptance Test

The first meaningful milestone is complete when all of the following work:

1. Open the Codespace.
2. Run:

```bash
npm install
npm run dev
```

3. Open the forwarded browser preview.
4. A small modular vehicle appears.
5. Keyboard controls move / rotate the vehicle.
6. The player's gun autofires.
7. An enemy fires damaging projectiles.
8. Projectiles visibly chip pseudo-voxels from individual cells.
9. A shot can sever an anchor without destroying the whole attached module.
10. A structurally disconnected weapon visibly falls away.
11. The detached weapon immediately stops firing.
12. Damage can alter the vehicle's mass / center of mass.
13. The changed vehicle handles differently.
14. A hit near the edge of the vehicle can impart visible rotation.
15. Destroying the Core ends the run.
16. There is no global HP bar.

If this is fun even with primitive graphics, proceed.

---

# 19. Second Milestone — Wiring Failure

After structural destruction works, add minimal power connectivity.

Implement:

```text
Core / power source
-> wire regions / power edges
-> gun
```

Damage to wiring should reduce `wiringIntegrity`.

Above the reliable threshold:

```text
gun uptime = 100%
```

Below it:

```text
gun begins stateful intermittent failure
```

At zero usable wiring:

```text
gun remains physically attached but cannot fire
```

This milestone proves that:

> **A component can remain attached yet become functionally disconnected.**

---

# 20. Third Milestone — Fuel / Heat Prototype

Do not implement this before the first two milestones work.

Add a minimal fuel system:

```text
fuel source
fuel line
engine
```

Damage can produce:

```text
LEAKING
FUEL_SPATTERED
FUEL_SOAKED
```

Fuel contamination can spread to nearby cells in an aggregate way.

A sufficiently hot or incendiary interaction may ignite contaminated cells.

Important interactions:

```text
fuel leak
+
overheated weapon
=
possible ignition
```

and later:

```text
fuel leak
+
hot environment
=
possible spontaneous ignition
```

Fire should have gameplay consequences, not just visual effects.

---

# 21. Future Failure Channels

Do not implement yet, but preserve room for:

## Cooling

Partial cooling damage:

```text
slower heat removal
-> overheating
-> thermal shutdown / damage
```

## Heating / De-icing

In cold environments:

```text
heater damage
-> ice buildup
-> impaired movement / joints / sensors
```

## Ammunition

Exposed ammunition can:

```text
heat
-> cook-off
-> random discharge
-> catastrophic magazine failure
```

## Sensors / HUD

Physical sensor modules later drive corresponding UI.

Example:

```text
radar damaged
-> radar HUD flickers / delays / loses contacts
```

The HUD should eventually represent surviving instrumentation rather than omniscient game state.

---

# 22. Future Propulsion System

Do not build this in Prototype 0, but keep physics compatible with it.

Planned propulsion includes:

- wheels,
- tank treads,
- crawler legs,
- hover,
- boosters,
- later water propulsion,
- later air / lift systems.

Players may install multiple propulsion types simultaneously.

Tradeoffs include:

- extra mass,
- construction volume,
- power draw,
- redundant capability.

Propulsion modes should eventually be switchable dynamically.

Some modes may be used simultaneously.

---

# 23. Future Terrain / Route System

Later, levels should be generated topology-first.

North-star rule:

> **Meaning / topology first. Geometry second.**

Possible topology primitives:

```text
STRAIGHT
EXPAND
BOTTLENECK
BRANCH
CROSSING
MERGE
```

The same relational graph can eventually drive:

- visible runner geometry,
- enemy placement,
- bullet patterns,
- between-level route choices,
- shops,
- repairs,
- strange Wayweb / ARRKANE geometry.

Do not implement this before vehicle destruction is fun.

---

# 24. Future Roadside Diagnostic Hospitality

A later adaptive director should be able to:

1. inspect the player's current vehicle,
2. inspect upcoming route hazards,
3. identify serious mismatches,
4. create opportunities containing the ingredients needed to survive,
5. give hints without directly solving the player's build.

Example:

```text
CURRENT VEHICLE
- leaking fuel hose
- empty oversized cannon
- wooden walker legs
- damaged propulsion

UPCOMING FOREST
- narrow route
- wood-consuming pests

WAYSTATION PROVIDES
- replacement fuel hose
- robotic arm / scrap claw
- robotic leg
- ARRKANE hint
```

The player must still infer how to use the opportunity.

Design rule:

> **Diagnosis does not equal autofix.  
> Help does not remove consequence.**

---

# 25. Humor as Gameplay Signaling

Later, the road / world can use humor as a warning signal.

Example:

A waystation sign says:

```text
PRICE:
[ARRKANE knot]
```

Below it are:

- robotic arm,
- robotic leg.

This encodes several relationships:

```text
ARMament -> ARM
legs -> LEG

release exhausted weapon
preserve useful reach

release vulnerable locomotion
preserve movement
```

The empty cannon can be replaced by a scrap claw.

The wooden walker legs can be replaced / supplemented by a robotic leg.

This simultaneously:

- reduces dead weight,
- improves future scrap collection,
- avoids a biological hazard ahead,
- repairs locomotion.

The joke is not decorative.

> **The joke gets the player to inspect the clue.**

Humor generation should later be built as:

```text
diagnosis
-> semantic hint
-> approved humor ontology
-> presentation
```

rather than asking an LLM to freely invent gameplay facts.

---

# 26. Future ARRKANE Integration

Power-ups / special effects can eventually use ARRKANE Knotcode.

Examples:

```text
PRESERVE
STABILIZE
SEPARATE
RECONCILE
RETURN
SOFTEN
```

These should alter relationships rather than provide generic stat buffs.

Do not implement ARRKANE in Prototype 0.

---

# 27. Future Crew System

Vehicles can eventually carry crew / passengers depending on:

- size,
- seats / stations,
- mission type,
- mass / capacity.

Crew may provide real benefits.

Examples:

## Mechanic

- patch fuel leaks,
- repair wiring,
- stabilize damaged connections.

## Navigator

- reveal alternate routes,
- avoid dangerous terrain.

## Salvager

- increase scrap collection,
- recover detached modules.

## Quartermaster

- shop / repair discounts.

## Sensor operator

- improve information quality.

Crew should not instantly restore pristine components.

They should provide:

> **field improvisation and graceful degradation**

---

# 28. Future Crew Chatter Architecture

Gameplay simulation should emit semantic events.

Examples:

```text
fuel_leak
same_fuel_line_reopened
weapon_detached
shield_failed_during_barrage
stealth_glitched_enemy_alerted
vehicle_spinning
radar_unreliable
route_revisited
same_place_different_projection
```

Dialogue selection should use:

```text
event
+ crew personality
+ recent event history
+ mission history
+ seeded weighted selection
```

The first implementation should eventually use prebaked / LLM-assisted authored dialogue.

A later optional design is to call an LLM at **mission initialization**, not continuously during gameplay.

The LLM can extend validated dialogue trees using:

- crew personalities,
- vehicle state,
- mission structure,
- prior mission history,
- known running jokes.

Runtime gameplay remains local and deterministic.

Do not implement this in Prototype 0.

---

# 29. Explicit Non-Goals for Prototype 0

Do NOT build yet:

- roguelite progression,
- procedural route graph,
- shops,
- salvage economy,
- crew,
- dialogue,
- live LLM integration,
- ARRKANE power-ups,
- water travel,
- flight,
- terrain physics,
- elaborate materials database,
- multiplayer,
- backend,
- accounts,
- inventory persistence,
- fancy 3D assets,
- Roblox integration,
- DroidScript packaging.

Do not turn the prototype into a framework project.

The first question is simply:

> **Is it fun to drive a modular machine while bullets physically shred away the machine you built?**

---

# 30. Coding Principles for Codex

When modifying this repository:

1. Prefer small, testable modules.
2. Keep simulation separate from rendering.
3. Use explicit data structures over clever abstractions.
4. Avoid premature optimization.
5. Avoid framework dependencies unless they solve a demonstrated problem.
6. Preserve seeded determinism where practical.
7. Keep browser performance bounded.
8. Use object pooling only after profiling shows a need.
9. Do not use DOM elements for every projectile / voxel.
10. Canvas owns game rendering.
11. Game simulation owns authoritative state.
12. Never let rendering state become authoritative gameplay state.
13. Add tests for graph connectivity and damage behavior before adding complexity.
14. Update `README.md` when setup commands change.
15. Keep the project launchable from a fresh Codespace.

---

# 31. Codex First Task

Start by implementing only Milestone 1.

## Deliverables

Create:

- `package.json`
- `.devcontainer/devcontainer.json`
- `index.html`
- core simulation modules
- Canvas renderer
- keyboard input
- one player vehicle
- one enemy
- projectiles
- pseudo-voxel cell rendering
- localized damage
- anchor failure
- structural detachment
- lightweight vehicle impulse physics
- debug overlay
- automated tests for:
  - structural connectivity,
  - anchor severing,
  - component detachment,
  - center-of-mass recalculation.

## Required Commands

These must work from a fresh Codespace:

```bash
npm install
npm run dev
npm test
```

## Completion Report

When finished, report:

1. files added / changed,
2. exact run commands,
3. controls,
4. implemented acceptance-test items,
5. known limitations,
6. recommended next smallest iteration.

Do not begin Milestone 2 automatically.

---

# 32. Suggested Initial Controls

For desktop browser testing:

```text
WASD / arrow keys
    movement

Q / E
    rotate / steer if needed

Space
    brake / stabilization

F
    toggle autofire if useful

D
    toggle debug overlay

R
    reset test scene
```

Exact controls may be adjusted for feel.

Gamepad support can be added after keyboard movement works, but the architecture should allow it.

---

# 33. Definition of Success

The prototype is successful if a tester can say:

> “That cannon was almost undamaged, but a tiny shot severed its mount and I watched it tumble away.”

Then:

> “Losing that side changed how the whole wreck handled.”

Then:

> “I kept going anyway.”

That is the core experience to prove before expanding the project.

---

# 34. North-Star Principles

Keep these visible throughout development:

> **The vehicle is the health bar.**

> **Cells are modules. Voxels are how modules get wounded. Anchors are how modules stay part of the machine.**

> **Grid determines placement. Graphs determine relationships.**

> **Voxels determine damage shape. Aggregate integrity determines behavior.**

> **Different things should fail differently.**

> **Simulate consequences, not every atom.**

> **Let the screen become ridiculous while the state stays simple.**

> **Build something improbable. Learn what it really is. Let the world tear pieces from it. Keep moving while the Core still works.**

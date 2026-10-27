# Arcade Divers

Release **v1.0.14.0** adds an Arcade-only wave director and a shared Diver movement cycle. Normal runs retain their previous schedules. Sandbox runs can explicitly spawn Divers without automatic waves or a two-wave completion requirement.

## Cycle and view bounds

The cycle is `approach -> track -> climb -> topTurn -> aim -> dive -> bottomTurn -> return -> approach`.

Divers start well beyond the visible road-forward edge, facing road-forward while drifting into the top staging band. They track the player's road-local lateral position for ten seconds using a delayed target and an underdamped steering response. This produces lag and small overcorrections. Tracking gunfire aims toward the player's current position with seeded random offsets up to 30 degrees on either side; the body keeps facing forward. They then climb toward the view edge, begin a continuous U-turn while still visible, and snapshot the player's current location. After aligning, they accelerate along that fixed dive vector while shooting along their own facing. Changing player position during the dive does not retarget them. The lower U-turn also begins while visible, then they accelerate straight back up and repeat from far ahead.

From **v1.0.16.0**, approach, return, turn, dive and lateral tracking speed caps each increase by 100 world units/second. Acceleration increases by 50%, and authored U-turn radius ratios halve. Top and bottom turns begin at 88% of the corresponding visible road-axis extent. Approach and climb accelerate toward their speed caps, while tracking retains its lag and overcorrection.

`arcadePlayBounds(road)` derives the visible forward/backward edge from `road.viewWidth`, `road.viewHeight`, the fixed camera origin at 58% screen height, and the current road direction. `configureRoadLaneForViewport` supplies these numeric world-space dimensions, including mobile zoom. Simulation code does not read Canvas, DOM, or browser APIs. Headless tests without view dimensions use road lane dimensions as a fallback. Ordinary Arcade enemies stage 55–85% toward this visible forward edge, centered at 72%; Divers track at 72%. The body and collision geometry rotate together, and scripted Diver movement bypasses ordinary lane steering and front recovery.

## Themes

| Zone | Variant | Behavior and presentation |
| --- | --- | --- |
| Weyfinder's Road, Starlight Road, other road themes | `motorcycle` | Two physical wheels, narrow body, tight turns and strong acceleration, slow lateral tracking. Fully destroying either wheel stops scripted movement and firing, starts the roadster's spinning/dizzy reactions, then panic and an explosion. Partial wheel damage does not trigger this. |
| Digitized Stream | `insect` | Two animated insect wings, tight turns and quicker tracking. Nearby hopper beams prefer these Divers. Entering the same 45-unit feeding range triggers alternating panic/fear emojis. Surviving five seconds produces a relief emoji once; the cue rearms after leaving and re-entering danger. Eaten or otherwise destroyed Divers show no relief. |
| Pirates Road | `sailboat` | Destructible sail/mast, residual lateral drift and facing lag during turns, player-targeted mortar during tracking. |
| Twilight Crossroads, Shadowed Road | `walker` | Two physical legs; body height is four cell layers including thickness, half the eight-layer regular walkers. When all leg cells are gone, a red/orange rear thruster replaces their support and preserves the body's elevation. Shadowed Road uses a darker palette. |
| Ghost Forrest, including Banshee tracks | `ghost` | Each 25% of the original cell count lost triggers one second of phasing immediately within damage resolution. Crossing multiple thresholds queues the corresponding phase periods. Phased Divers cannot be hit by direct, beam, piercing or blast damage. |
| Shadowed Desert | `snake` | Long narrow segmented body, a slithering path and a small visual wave along the body cells. |
| Freedoms Pass | `burrower` | Hidden and protected during approach, lower U-turn and return, represented only by brown dirt particles. Bursts out at the tracking band, remains exposed through the attack, and burrows again after passing the lower edge. |

Generic `BossFight_1`/`BossFight_2` tracks inherit the preceding zone. Numbered tracks and boss tracks increment the level within the current zone; both Ghost Forrest music prefixes share one zone.

Hopper predation uses the beam's actual voxel ray. A connected beam immediately destroys the insect Diver, harvests its remaining scrap once, suppresses loose drops, and draws scrap suction particles toward the hopper. Exactly `floor(normalRemainingScrapValue * 0.5)` is banked in `hopperConsumedScrap` and included in the hopper's eventual death drop. The stored value already includes the prey's normal scrap scaling and is not scaled again.

## Waves and level completion

- Both the first-wave wait and waits after clearing a wave are seeded random **60–240 seconds** while combat remains visible. From **v1.0.15.0**, an empty-screen watchdog brings the next normal wave forward within 15 seconds, or rushes a required Diver wave directly into the tracking band if no normal wave remains. A living offscreen Diver prevents a second Diver wave; a normal reinforcement fills that gap instead.
- A countdown runs only while no living Divers remain. Tracking, phased, burrowed and offscreen Divers all count as alive; the director cannot overlap waves.
- Wave size is `seededInteger(1, 3) + zoneNumber + zoneLevel`, all counts one-based. The default sequence has zones 1–9 from Weyfinder's Road through Freedoms Pass; Steppes is zone 10 when supplied in the music list.
- Every Arcade level must clear at least **two waves**. Ordinary enemy or timed traversal completion cannot finish the level before that requirement is met. The empty-screen watchdog limits the wait between waves. New levels reset the director and watchdog.

## Runtime-consumed content

`content/enemies/arcade_divers.json` is the first-party `0.1` variant pack. Its `variants` entries use:

- `id`: `motorcycle`, `sailboat`, `insect`, `walker`, `ghost`, `snake`, or `burrower`.
- `construct`: matching `enemy.diver.<id>` asset ID.
- `displayName` and `palette`: labels and cell colors.
- `profile`: positive numeric tuning, validated by `validateDiverPack` before runtime use.

| Profile field | Unit / meaning |
| --- | --- |
| `trackingSeconds` | Seconds in lateral tracking; defaults to 10 in all first-party variants. |
| `approachSpeed` | Road units/second drifting down while facing forward. |
| `climbSpeed`, `diveSpeed` | Return and dive speed caps before normal enemy movement scaling. |
| `acceleration` | Road units/second squared during approach, climb, dive and return; also caps lateral spring acceleration. |
| `turnSpeed` | Speed along the circular U-turn. |
| `turnRadiusRatio` | U-turn radius relative to the smaller of road half-height and 80% of lane half-width. Lower return turns can expand to bring a wide dive back toward the lane. |
| `turnRate` | Radians/second aligning the completed upper turn to the snapshot dive vector. |
| `trackingGain`, `trackingDamping`, `trackingLag`, `maxTrackingSpeed` | Lateral spring response, damping, delayed-target response and speed cap. |
| `fireInterval`, `mortarInterval` | Seconds between gun/mortar volleys before ordinary enemy attack-rate and Arcade rate scaling. |
| `trackingSpreadRadians` | Optional tracking-shot half-angle, from 0 to pi. Defaults to pi/6 (30 degrees). Dive fire remains aligned with the dive. |

Constructs are standard editable `0.1` JSON under `content/constructs/diver_*.json`, with explicit structural edges. Named cells/roles carry family semantics: `diverWing` and `wing-left`/`wing-right`, `diverLeg` with left/right prefixes, `mast`, and `mortar`. Damage removes the corresponding visible feature; support roles do not opt into the full-size walker's fall animation.

The archetype schema now accepts `runtimeFactory: 'createDiverEnemy'` and optional `diverTheme` from the same seven IDs. Presentation variants are `diver.<id>`. The built-in runtime archetypes can be referenced directly in existing sandbox spawn JSON, for example:

```json
{
  "title": "Sail Diver test",
  "level": 1,
  "spawns": [{ "archetype": "diver.sailboat", "count": 1, "at": 0, "entry": "ahead" }]
}
```

Editing first-party variant profiles or construct JSON changes the same content imported by the runtime after rebuilding. No separate creator dependency stack or new rendering library is introduced.

## Verification

`tests/diverEnemy.test.js` covers all constructs, zone counting, repeated cycles on straight/curved road frames, desktop/mobile view edges, tracking lag and overshoot, snapshot dives, mortar aim, phase protection, leg-loss thrusters, burrowing, hopper ray contact and reward drops, wave timing/counts, level gates, and sandbox loading. `tests/arcadeMode.test.js` checks the corrected authored body-forward transform and seeded forward-centered spray alongside the existing Arcade rules.

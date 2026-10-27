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
| Weyfinder's Road, other road themes | `motorcycle` | Two physical wheels, narrow body, tight turns and strong acceleration, slow lateral tracking. Fully destroying either wheel stops scripted movement and firing, starts the roadster's spinning/dizzy reactions, then panic and an explosion. Partial wheel damage does not trigger this. |
| Digitized Stream | `insect` | Two animated insect wings, tight turns and quicker tracking. Nearby hopper beams prefer these Divers. Entering the same 45-unit feeding range triggers alternating panic/fear emojis. Surviving five seconds produces a relief emoji once; the cue rearms after leaving and re-entering danger. Eaten or otherwise destroyed Divers show no relief. |
| Pirates Road | `sailboat` | Destructible sail/mast, residual lateral drift and facing lag during turns, player-targeted mortar during tracking. |
| Starlight Road (from v1.0.22.0), Twilight Crossroads, Shadowed Road | `walker` | Two physical legs; body height is four cell layers including thickness, half the eight-layer regular walkers. When all leg cells are gone, a red/orange rear thruster replaces their support and preserves the body's elevation. Shadowed Road uses a darker palette. |
| Ghost Forrest, including Banshee tracks | `ghost` | Each 25% of the original cell count lost triggers one second of phasing immediately within damage resolution. Crossing multiple thresholds queues the corresponding phase periods. Phased Divers cannot be hit by direct, beam, piercing or blast damage. |
| Shadowed Desert | `snake` | Long narrow segmented body, a slithering path and a small visual wave along the body cells. |
| Freedoms Pass | `burrower` | Hidden and protected during approach, lower U-turn and return, represented only by brown dirt particles. Bursts out at the tracking band, remains exposed through the attack, and burrows again after passing the lower edge. |

Generic `BossFight_1`/`BossFight_2` tracks inherit the preceding zone. Numbered tracks and boss tracks increment the level within the current zone; both Ghost Forrest music prefixes share one zone.

## Zone-specific behavior (v1.0.22.0)

The table below overrides the shared cycle for Arcade campaign Divers, including boss-vanguard Divers. Quiet-screen gap Divers retain their immediate tracking entry, then use the same zone contact attacks and return paths. Normal and explicit Sandbox archetypes keep the shared cycle. `configureDiverFlavor` supplies runtime zone identity; this is not a new construct JSON field. Motion uses numeric visible bounds and seeded RNG without Canvas/DOM access.

| Zone | Movement and attacks |
| --- | --- |
| TheWeyfindersRoad | Tracking and U-turns stay unchanged. During a dive, homing flechettes fire once every **0.75 real seconds**, replacing the old 1–3-shot limit. Dive contact triggers the existing motorcycle skid, dizzy/panic reactions and delayed explosion. The contact deals base Mortar blast damage and level-5 knockback once. |
| DigitizedStream | Enter from the rear corners toward a seeded point in the top quarter. Circle it **four times** in an eccentric ellipse; a continuous bounded random walk varies radius from one to five physical bug widths. Then move to the tracking band and use the normal dive. Return begins another orbit sequence instead of exiting the top. On hull contact, latch at the touched cell and follow the player; drain exactly **1 HP from one voxel every 0.5 seconds**. Detach after eight voxels are consumed, a cell detaches from the bite, the mounting cell is lost, a boost succeeds, or an explosion/other impulse knocks the player. A visible `use boosters to detach the fly!` hint appears. After release, a 1.5-second grace prevents immediate reattachment. Hoppers beeline toward attached flies and try to eat them with their normal feeding beam, which does not hurt the player in Arcade. Attached flies start their panic sequence within three feeding ranges so the reaction is visible before rescue. Existing hopper scrap banking remains unchanged. |
| StarlightRoad | Uses the two-legged mini walker. Starts in a rear corner and makes **four or five alternating edge passes**, with rounded turns, toward the tracking band. Each turn starts a 12-blade spiral over 1.5 seconds. After a dive, repeat the ascent. Contact uses a surviving leg for a visible kick: level-1 Cannon blast damage and level-5 Cannon knockback, with angry, swearing and steam reactions in sequence. |
| TwilightCrossroads | Same walker weave and kick, with spirals of 12 tracking flechettes instead of blades. |
| ShadowedRoad | Same walker weave and kick, with **seven mortars over three seconds** at each turn. Every shell snapshots the player's current position with a seeded radial offset of at most one surviving hull width, and uses the existing mortar landing warning. Overlapping turn bursts finish independently. |
| GhostForrest | Keeps the shared movement and cell-loss phasing. Each fresh contact adds a **15% standard speed reduction**, up to three stacks (45%), and refreshes the shared **three-second** duration. Cold/shivering/frozen cues appear above the player. Continuous overlap does not count as repeated hits. All stacks expire together. |
| ShadowedDesert | Keeps normal slithering until contact. Shows surprise, recoils two body lengths over 0.25 seconds, fires three blades toward the player over one second, then shows a poof, phases out for 0.5 seconds and teleports back to tracking. |
| FreedomsPass | During the dive, two real blades orbit outside the hull. Instead of leaving the bottom, reflect off the visible play bounds. At **five reflections**, or upon a blade hit on the player, launch all surviving blades toward the player and head straight back to tracking. Destroyed/intercepted blades stay lost until a new dive; no replacements appear mid-cycle. Owner death removes remaining orbit blades. The burrower stays exposed during the dive, ricochets and regroup. |
| PiratesRoad | Retains the sailboat cycle, drift and tracking-phase mortar. |

Contact tests use live attached player voxels and trigger on fresh overlap with a short cooldown. Phased Divers and spinning motorcycles cannot retrigger. Kick cells follow the chosen surviving left/right leg; cue delays are simulation state consumed by the renderer. Player status timers pause with the game, and chill clears at the next level.

Damage references use the existing weapon assets and Arcade multipliers: a base Mortar blast is `90 * 3`; the level-1 Cannon kick is `27 * 2 * 1.05 * 1.5`. Requested level-5 knockback uses the respective authored blast impulse times `1.05^5`. Freedom Pass blades use `22 * 1.05^20 * 3` damage and the Arcade level-20 deflection probability `1 - 0.67 * 0.95^20`, with matching pierce/ricochet upgrades. These contact references do not scale again with zone rank or the player's purchases.

`tests/diverFlavor.test.js` covers all zone paths, real timing, seeded orbits, physical kicks, attachment/drain/release, hopper rescue, chill stacking, teleport, blade interception and mobile viewport bounds. Implementation lives in `src/core/diverFlavor.js`, `diverContact.js` and `diverAttacks.js`, integrated with the shared Diver director and combat pipeline.

Hopper predation uses the beam's actual voxel ray. A connected beam immediately destroys the insect Diver, harvests its remaining scrap once, suppresses loose drops, and draws scrap suction particles toward the hopper. Exactly `floor(normalRemainingScrapValue * 0.5)` is banked in `hopperConsumedScrap` and included in the hopper's eventual death drop. The stored value already includes the prey's normal scrap scaling and is not scaled again.

## Waves and level completion

- Both the first-wave wait and waits after clearing a wave are seeded random **60–240 seconds** while combat remains visible. From **v1.0.15.0**, an empty-screen watchdog brings the next normal wave forward within 15 seconds, or rushes a required Diver wave directly into the tracking band if no normal wave remains. A living offscreen Diver prevents a second Diver wave; a normal reinforcement fills that gap instead.
- A countdown runs only while no living Divers remain. Tracking, phased, burrowed and offscreen Divers all count as alive; the director cannot overlap waves.
- Wave size is `seededInteger(1, 3) + zoneNumber + zoneLevel`, all counts one-based. The default sequence has zones 1–9 from Weyfinder's Road through Freedoms Pass; Steppes is zone 10 when supplied in the music list.
- Every Arcade level must clear at least **two waves**. Ordinary enemy or timed traversal completion cannot finish the level before that requirement is met. The empty-screen watchdog limits the wait between waves. New levels reset the director and watchdog.

## Runtime-consumed content

From **v1.0.21.0**, campaign boss levels hold their boss outside the active spawn queue until the two required Diver waves and all ordinary escorts are defeated. A final, seeded **one-to-three Diver** group then arrives with a two-second ETA and approach triangles. Defeating this group triggers the boss's normal approach warning and entry. This extra group does not replace either required wave. Boss levels stop scheduling further regular Diver waves once the two required waves have spawned, so no Diver cleanup follows boss victory. The empty-screen watchdog cannot rush the held boss ahead of these phases. Normal and Sandbox scheduling are unchanged.

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

## Dive payloads and inbound warnings

Each main dive reserves a seeded budget of one to three tracking flechettes. They launch along the dive heading at spaced progress points and home toward the moving player. Each return climb independently reserves one to three stationary terrain-anchored time bombs, dropped at spaced progress points. Bombs use the enemy mortar shell/marker artwork, flashing danger cue and growing numeric countdown. They explode once after three simulation seconds, retain their fuse after the source is destroyed, and do not detonate from mere vehicle contact. Destroyed gun systems suppress new payloads. Burrowers can leave bombs during their underground return. These payload budgets reset on each new dive/return cycle; ordinary tracking spray and sailboat mortar fire remain.

Scheduled Diver waves reserve their actual formation when their ETA reaches two seconds and display the same incoming-craft triangles as ordinary waves at the visible top entry lanes. The HUD displays INTERCEPTORS INBOUND with an ETA. Gap Divers do not affect these reservations or warnings.

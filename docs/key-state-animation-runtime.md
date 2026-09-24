# Key-State Animation Runtime

Version `v1.0.9.5` adds the game-engine half of key-state transition graphs. The runtime is deterministic, independent of rendering APIs, and optional: constructs without an `animationGraph` continue to use their existing `poseRig.animations` unchanged.

## Construct fields

```json
{
  "poseRig": {},
  "animationGraph": {
    "schemaVersion": "0.1",
    "initialState": "idle",
    "states": [
      {
        "id": "idle",
        "tags": ["stable", "grounded"],
        "rig": { "pose": "pose.idle" },
        "dwell": { "min": 0.8, "max": 2.4 },
        "next": [{ "state": "look-left", "weight": 2 }]
      }
    ],
    "transitions": [
      {
        "id": "idle-to-look-left",
        "from": "idle",
        "to": "look-left",
        "duration": { "min": 0.2, "max": 0.35 },
        "channels": { "rig": { "clip": "clip.look-left" } },
        "interruptPolicy": "AT_NEXT_ANCHOR",
        "interruptAnchors": [
          { "id": "balanced", "at": 0.5, "tags": ["stable"] }
        ],
        "markers": [
          { "id": "footfall", "at": 0.5, "tags": ["sound"] }
        ]
      }
    ]
  },
  "animationStateMap": {
    "idle": "idle",
    "alert": "alert"
  }
}
```

States may select `poseRig` poses. Transitions and weighted variants may select `poseRig` clips. `dwell`, autonomous weighted `next` choices, transition weights, durations, and variants all use a deterministic entity-local RNG.

## Interrupt policies

- `IMMEDIATE`: capture the evaluated pose and retarget immediately with velocity-aware inertial blending.
- `AT_NEXT_ANCHOR`: continue until the next authored interrupt anchor, then retarget.
- `FINISH_TRANSITION`: complete the current transition before applying the request.
- `REQUIRE_TAG`: wait for or route through an outgoing transition with all requested anchor tags.

## Browser API

`window.WeyfinderAnimation` exposes engine integration without coupling content tools to game internals:

```js
WeyfinderAnimation.validate(graph, poseRig);
WeyfinderAnimation.attach(enemyId, graph, { attack: "attack-left" });
WeyfinderAnimation.request(enemyId, "attack", {
  priority: 50,
  interruptPolicy: "AT_NEXT_ANCHOR"
});
WeyfinderAnimation.inspect(enemyId);
WeyfinderAnimation.consumeMarkers(enemyId);
```

Targets may be `"player"`, an enemy runtime ID, or an entity object. Marker events carry the entity ID and simulation time. The game queue is bounded to 256 events and is cleared between levels and sandbox sessions.

Player animation-controller state is included in normal saves. Spawned enemies create their controller lazily from the game seed and stable entity identity.

## Current boundary

This checkpoint implements handoff milestones A0 through A6: schema, controller, rig channel, smooth snapshots, inertialization, anchors, and markers. Material-state animation, texture transitions, and organic additive motion are reserved for A7 through A9 so renderer caching can be handled as a separate measured change.

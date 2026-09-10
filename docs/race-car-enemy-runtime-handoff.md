# Race Car Enemy Runtime Handoff

Runtime checkpoint target: `v1.0.8.35`

The runtime now supports editor-authored car enemies through `carBehavior` metadata. This is intended for the new level 1 car rebuild and the race-car flechette strafer.

## Archetype fields

Add these fields to an enemy archetype:

```json
{
  "movementProfiles": [
    { "id": "race-side-strafe", "kind": "raceStrafe", "target": "player", "speed": 185 }
  ],
  "carBehavior": {
    "movement": "raceStrafe",
    "speed": 185,
    "steer": 4.8,
    "playerDriftBias": 0.18,
    "flechetteCooldown": 0.58,
    "spinout": { "wheelBlocksDestroyed": 2 }
  },
  "reactionCues": [
    { "trigger": "carSpinout", "texts": ["Dizzy?", "Confused?"], "duration": 1.8, "growth": 2.3 },
    { "trigger": "carPanic", "texts": ["Ouch!", "Panic!"], "duration": 1.25, "growth": 2.2 }
  ]
}
```

`raceStrafe` causes the car to race side-to-side across the main play area, U-turn after it exits the side, and fire enemy flechette sprays at the player.

## Wheel groups

The spinout system builds wheel-block groups from cells whose `type`, `role`, `wheelBlockId`, or `damageGroup` includes `wheel`.

Preferred authoring:

- Give each 2x2 wheel block a shared `wheelBlockId`, such as `frontLeftWheel`.
- Use `type: "wheel"` for wheel cells.
- Keep each block connected internally with normal cell connections or adjacency.

If more than `carBehavior.spinout.wheelBlocksDestroyed` groups are fully destroyed, the car spins for 3 seconds with floating confused/dizzy cues, then runs 1 second of internal explosions with ouch/panic cues before its final explosion.

## Notes

- `carBehavior` is preserved by archetype metadata cloning.
- `raceStrafe` is a validated movement kind.
- Generic `entranceBarks` and `reactionCues` now render through the shared floating cue queue.
- The Zone 1 boss is `boss.weyfinder_road_hotrod.prototype0` via `createRoadBossCarEnemy`; it uses `roadBossBladeLauncher`, `roadBossBulletGun`, and `roadBossWheel` runtime cell roles, then launches `escapePodBoat` skiffs during internal destruction.

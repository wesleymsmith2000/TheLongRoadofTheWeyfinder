# Inchworm Linked Construct Editor Handoff

Runtime target version: `v1.0.7.5`

## Goal

Maintain the Freedoms Pass inchworm as linked construct instances:

- `example.construct.inchworm_head_sculpted`
- `example.construct.inchworm_body_segment_sculpted`

The game runtime now consumes these first-class construct JSON files directly and spawns them as separate linked enemies.

## Content Shape

Keep `example.inchworm_carrier.freedoms_pass` expressing:

```json
"construct": "example.construct.inchworm_head_sculpted",
"segments": {
  "construct": "example.construct.inchworm_body_segment_sculpted",
  "minCount": 4,
  "maxCount": 12,
  "bunchedOverlap": 0.5,
  "extendedOverlap": 0,
  "destroyedSegmentRelease": {
    "kind": "scrapSpray",
    "explosion": false,
    "shrapnel": false
  }
}
```

If any legacy references to `example.construct.inchworm_carrier_sculpted` remain, treat that asset as deprecated and migrate them to the split head/segment pair.

## Construct Requirements

The head construct should contain the head armor, core, and eye guns only. Keep the head's front-facing orientation obvious in local construct space and label eye guns with `role: "eyeGun"`.

The body segment construct should be a compact repeated body unit, not the whole worm body. It still needs one `core` cell because current construct validation requires every construct to have a core. Use `role: "bodySegment"` on the body cells and, if helpful, `role: "segmentCore"` on that bookkeeping core.

Do not wire body segment destruction to a knockback blast, projectile shrapnel, flechette burst, or enemy explosion visual. It should only spray scrap for now. Later acid-puddle fields can hang from the same `destroyedSegmentRelease` block, and inchworm-family archetypes should get an acid immunity tag.

## Runtime Notes

Runtime currently spawns one linked head plus 4-12 independent segment enemies. Segments bunch toward 50% overlap, then extend until just touching behind the head's facing direction. Each segment is targetable/damageable on its own and carries `inchworm.role = "segment"` with `suppressDeathBlast = true`.

Zone enemy runtime now uses the sculpted constructs for in-game leaders:

- `example.construct.ghost_phaser_sculpted`
- `example.construct.tractor_frog_sculpted`
- `example.construct.heavy_mortar_boat_sculpted`
- `example.construct.spider_walker_sculpted`
- `example.construct.scrap_buzzard_sculpted`
- `example.construct.inchworm_head_sculpted`
- `example.construct.inchworm_body_segment_sculpted`
- `example.construct.moth_bomber_sculpted`

Each brood spawn should include one sculpted leader and 1-3 basic turret escorts. Keep presentation sprites unset; these enemies should render from their cell models.

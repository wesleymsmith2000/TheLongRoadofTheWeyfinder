# Walker Stability And Pose Runtime Handoff

Date: 2026-09-06

Runtime checkpoint: `v1.0.8.7`

## Pose Rig Contract

Grouped cells can now use `rotateZ` as an alias for the existing render-plane `rotation` field. `translateZ`, `z`, and three-value `translate` arrays continue to move grouped cells vertically for rendering.

Supported transform fields for editor-authored poses:

```json
{
  "target": "group:leftFrontLeg",
  "translate": [0, 4, 6],
  "rotateZ": 0.35,
  "pivot": [-24, 12, 18]
}
```

Notes:

- `rotation` and `rotateZ` currently mean the same thing.
- Z translation is render-facing. Collision and damage still use the unposed cell model until the next simulation-pose pass.
- Walker stride groups should continue to use `role: "legAssembly"` where possible.

## Walker Stability Metadata

Runtime now evaluates walker stability from cell roles and leg ids:

- `role: "supportLeg"` marks primary load-bearing cells.
- `role: "legArmor"` and `role: "legJoint"` are treated as detachable support structure.
- `legId` groups support cells into a single logical leg.
- Body/gun/core cells using `role: "elevatedBody"` or `role: "turretGun"` are treated as elevated payload.

Runtime behavior:

- If a lower support Z slice no longer has stable support, that slice shears off.
- If remaining live support legs are unstable overall, the walker falls.
- One live leg is unstable.
- Two live legs on the same side are unstable.
- Two or more live legs spanning left and right sides are currently stable.
- When the walker falls, remaining support cells detach and produce a bounded scrap spray.

This is intentionally simple for `v0.1` and can later be replaced with a fuller support-polygon/center-of-mass test once pose-aware collision is active.

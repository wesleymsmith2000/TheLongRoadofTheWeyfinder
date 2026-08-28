# Codex Notes

- Keep simulation code independent of Canvas, DOM, and platform APIs.
- Use explicit graph edges for connectivity; grid adjacency is only a convenience for initial construction.
- Preserve deterministic behavior with seeded RNG where practical.
- Keep Prototype 0 small. Do not add progression, inventory, backend, React, Phaser, or Three.js.
- Keep early creator editors in this repo only when they are small vanilla tools that emit the same content JSON consumed by runtime loaders.
- Split creator tooling to a separate repo once it needs an independent release cycle, dependency stack, publishing/community services, or a total-conversion launcher.
- Keep `docs/` aligned with runtime schemas whenever adding creator-facing asset fields, verbs, or extension points.
- Update this file and `README.md` when setup or development conventions change.

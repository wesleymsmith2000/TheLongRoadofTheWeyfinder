# Codex Notes

- Keep simulation code independent of Canvas, DOM, and platform APIs.
- Use explicit graph edges for connectivity; grid adjacency is only a convenience for initial construction.
- Preserve deterministic behavior with seeded RNG where practical.
- Keep Prototype 0 small. Do not add progression, inventory, backend, React, Phaser, or Three.js.
- Keep early creator editors in this repo only when they are small vanilla tools that emit the same content JSON consumed by runtime loaders.
- Split creator tooling to a separate repo once it needs an independent release cycle, dependency stack, publishing/community services, or a total-conversion launcher.
- Keep `docs/` aligned with runtime schemas whenever adding creator-facing asset fields, verbs, or extension points.
- Update this file and `README.md` when setup or development conventions change.

- Keep Arcade-only balance and movement rules in runtime mode overrides; normalize legacy `lite` to `arcade` at input boundaries and preserve Normal/Sandbox content balance.
- Sandbox definitions select `runMode: normal|arcade` (default Normal). Arcade Sandbox shares live Arcade rules and terrain; `useLevelSchedule: true` opts into the campaign director. Quick/script/custom tests keep their authored spawns without ambient Divers. Keep Sandbox campaign previews in Sandbox across level transitions and exclude Sandbox from account achievement awards.
- Give gameplay releases a distinct visible `BUILD_VERSION` and distinguish local verification from a successful GitHub Pages deployment when reporting completion.
- After each verified gameplay update, commit and push the relevant changes to `main` and publish to GitHub Pages by default, as requested for PC/phone playtesting. Wait for the Deploy Pages workflow to succeed and verify the public build version before reporting deployment complete. Do not include unrelated local handoffs or assets in release commits.
- Vehicle body rotation transforms authored local negative Y; projectile headings are measured from positive X. Keep those angle conventions distinct, and use numeric visible-view bounds for Arcade enemy staging rather than the smaller player movement lane.
- Arcade gun slots are one primary and one secondary per cell, enabled by boss-clear progression. Use the shared Arcade loadout policy for firing and slot UI; empty/locked mounts must never synthesize equipment. Mini Beam belongs to Arcade utility slots while Normal retains its primary catalog entry.
- Arcade's separately configured core emergency primary defaults to Main Gun. Use the shared emergency-activation policy for firing and manifest status; it activates only when no installed primary mount is functional. Cooldown/heat alone must not trigger it, and Normal/Sandbox retain their existing core behavior.
- Configure Arcade Diver zone flavor on every scheduled, boss-vanguard and gap spawn. Keep zone movement, contact/status effects and attack payloads in the simulation modules; rendering reads that state for kicks and cues. Orbit blades must remain real projectiles and share collision/deflection handling with combat.

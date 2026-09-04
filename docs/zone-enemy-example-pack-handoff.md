# Zone Enemy Example Pack Handoff

This checkpoint adds an installable example content pack for advanced zone enemies requested for the next editor/runtime integration pass.

## Added Content

Pack manifest:

```text
content/examples/prototype0-zone-enemy-set/packs/example.prototype0_zone_enemy_set.json
```

Enemy archetype pack:

```text
content/examples/prototype0-zone-enemy-set/enemies/example.zone_enemy_archetypes.json
```

Pattern assets:

```text
content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json
content/examples/prototype0-zone-enemy-set/patterns/example.frog_tractor_beam.json
content/examples/prototype0-zone-enemy-set/patterns/example.frog_short_laser.json
content/examples/prototype0-zone-enemy-set/patterns/example.mortar_line_7.json
content/examples/prototype0-zone-enemy-set/patterns/example.buzzard_trailing_mortar.json
content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_repulsor_eye.json
content/examples/prototype0-zone-enemy-set/patterns/example.inchworm_eye_mini_beam.json
```

Behavior-contract notes:

```text
content/examples/prototype0-zone-enemy-set/behaviors/example.zone_enemy_behavior_contracts.json
```

The Creator Suite can install this pack from Pages via `Install Zone Enemies`.

The Enemy Editor template dropdown also includes these example archetypes directly, and its pattern checklist includes the new example patterns.

## Enemy Descriptors

- `example.ghost_phase_mob.ghost_forrest`: mostly phased-out flyer that phases in one second before a 16-shot sequential homing radial burst, cancels the fire sequence when hit, phases out after a four-frame delay over four frames, then teleports.
- `example.tractor_frog.digitized_stream`: hopping frog-like mob with a tractor beam, short laser beam, non-frog target selection, and scrap-healing descriptor.
- `example.heavy_mortar_boat.pirates_road`: heavy armored pirate mortar boat retaining aimed/radial shots and adding a seven-shell walking mortar line.
- `example.elevated_walker.starlight_road`: four-leg elevated walker whose body is only arc-hittable until all legs are destroyed.
- `example.elevated_walker.twilight_crossroads`: Twilight variant of the elevated walker with the same four-leg fall contract.
- `example.scrap_buzzard.shadowed_desert`: aerial straight-line strafer that circles off-field, drops mortars behind itself, and lands to eat scrap.
- `example.inchworm_carrier.freedoms_pass`: split head plus 4-12 linked segment carrier descriptor; destroyed segments spray scrap without explosion or shrapnel; eye guns use repulsor and mini-beam patterns.
- `example.moth_bomber.freedoms_pass`: fast spawned moth that flies toward targets and explodes on contact.

## Editor Updates

Enemy Editor now includes an Advanced Descriptor JSON panel. It preserves and edits custom behavior blocks such as:

```text
phase
fireSequence
targeting
tractorBeam
shortLaser
armor
artillery
elevation
fallWhenSupportsDestroyed
aerialStrafe
scrapFeeding
segments
spawns
eyeGuns
detonation
```

This lets the editor round-trip richer descriptors before dedicated controls exist for every behavior family.

## Runtime Work Still Needed

The JSON validates and imports, but much of the requested gameplay behavior is still descriptor-first. The main runtime thread should add behavior runners for:

1. Phase state, hit-cancel, delayed phase-out, and teleport.
2. Homing radial sequence cancellation mid-burst.
3. Tractor beam scrap pull and healing.
4. Non-player construct targeting filters.
5. Seven-shot mortar-line scheduler.
6. Z-aware elevated body damage gates and support-leg fall transitions.
7. Buzzard off-field return loop, landing, and scrap feeding.
8. Segmented inchworm body generation, segment destruction flechettes, moth release, and eye-gun repulsor behavior.

Keep those runners independent of Canvas/DOM APIs and drive them from the named descriptor blocks above.

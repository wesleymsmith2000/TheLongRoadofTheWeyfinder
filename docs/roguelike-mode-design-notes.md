# Roguelike Mode Design Notes

## Player Start

- The player chooses one primary weapon and one secondary weapon before the run begins.
- The chosen primary and secondary define the run's class-like baseline.
- Only those starting weapons are guaranteed to remain directly available.

## Drops And Inventory

- Enemies can drop weapon parts, module parts, ammo parts, and upgrade components.
- Drops are collected into a run inventory instead of becoming direct shop currency.
- Scrap remains the repair resource for damaged systems.

## Crafting And Repairs

- Between levels, the repair screen should become a crafting bay for this mode.
- Scrap can repair damaged modules that are still attached or recoverable.
- Lost modules cannot be directly bought back.
- New modules, weapons, ammo, and upgrades are crafted from collected components.
- The starting secondary is the only secondary ammo type that can be bought directly.

## Title Screen Hook

- The main menu includes a disabled Roguelike Draft entry until this mode has a playable loop.
- Future work should route that entry into a weapon selection screen, then a roguelike run state with inventory-backed crafting.

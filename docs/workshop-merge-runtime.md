# Workshop and Equipment Merge Runtime

The first Workshop runtime pass keeps the persisted `game.weaponBay` key for save compatibility while treating its `inventory` record as generic physical equipment inventory.

## Equipment knowledge and copies

- Upgrade levels remain global technology knowledge.
- `equipmentSystemLevel(game, itemId)` is the minimum level across every upgrade in that equipment family.
- Installed equipment is not inventory and cannot satisfy a consumed merge ingredient.
- Removing equipment adds one physical copy to `game.weaponBay.inventory`.
- Installing equipment consumes one physical inventory copy.

## Utility loadouts

Utility cells use construct modules shaped as:

```json
{
  "cellId": "utility",
  "kind": "utilitySlots",
  "slots": ["booster", "scrap_magnet", "repulsor_beam", "tractor_beam"]
}
```

Slots may contain duplicate IDs. Runtime and creator integrations should use `normalizeUtilityLoadouts()`, `setUtilityLoadoutSlot()`, and `utilityModuleCount()` instead of presence-only array checks.

## Merge recipe schema

Recipes live in `content/merges/` and use schema version `0.1`:

```json
{
  "schemaVersion": "0.1",
  "assetId": "merge.example",
  "displayName": "Example Merge",
  "output": { "itemId": "example_output", "quantity": 1 },
  "ingredients": [
    { "itemId": "beam", "quantity": 1, "minSystemLevel": 5 }
  ],
  "technologyPrerequisites": [
    { "itemId": "booster", "minSystemLevel": 3 }
  ],
  "requirements": { "achievementId": null }
}
```

`ingredients` require uninstalled inventory copies and consume them. `technologyPrerequisites` check global system level without requiring or consuming a physical copy. `evaluateMergeRecipe()` returns every requirement for locked-recipe UI. `mergeEquipment()` reevaluates before making an atomic inventory transaction and never auto-installs its output.

The current prototype recipe produces the existing Vortex Wavelet Beam. Its fabrication mode is `mergeOnly`, providing an end-to-end test of the Workshop contract before new merged runtimes are added.

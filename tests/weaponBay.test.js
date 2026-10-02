import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import liteVehicleDefinition from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };
import {
  LITE_SLOT_UNLOCK_COST,
  buildEquipmentWithScrap,
  buildWeaponWithScrap,
  equipmentConstructionCost,
  normalizeWeaponBayState,
  swapEquipmentSlot,
  swapWeaponSlot,
  unlockLiteWeaponSlot,
  weaponConstructionCost,
  weaponSlotUnlocked,
} from '../src/core/weaponBay.js';
import { normalizeGunLoadouts, normalizeUtilityLoadouts, utilityModuleCount } from '../src/core/weaponLoadout.js';

test('weapon construction includes a gun replacement and every level-one upgrade', () => {
  const game = createGame();
  assert.equal(weaponConstructionCost(game, 'rocket'), 196);
  assert.equal(weaponConstructionCost(game, 'main.basic'), 96);
});

test('rest-area inventory can build, install, and recover weapons', () => {
  const game = createGame();
  game.levelComplete = true;
  game.weaponBay.available = true;
  game.scrap = weaponConstructionCost(game, 'sta_missile');
  assert.equal(buildWeaponWithScrap(game, 'sta_missile').changed, true);
  assert.equal(swapWeaponSlot(game, 'gun', 'secondary', 0, 'sta_missile').changed, true);
  const loadout = normalizeGunLoadouts(game.vehicleDefinition)[0];
  assert.equal(loadout.secondary[0], 'sta_missile');
  assert.equal(game.weaponBay.inventory.rocket, 1);
  assert.equal(game.weaponBay.inventory.sta_missile, 0);
});

test('workshop remains locked outside a completed level', () => {
  const game = createGame();
  game.scrap = 10_000;
  assert.equal(buildWeaponWithScrap(game, 'cannon').changed, false);
  assert.equal(swapWeaponSlot(game, 'gun', 'secondary', 0, null).changed, false);
});

test('workshop opens after every completed level without a boss-only flag', () => {
  const game = createGame();
  game.levelComplete = true;
  game.scrap = equipmentConstructionCost(game, 'scrap_magnet');
  assert.equal(buildEquipmentWithScrap(game, 'scrap_magnet').changed, true);
});

test('utility equipment can be removed, duplicated in inventory, and reinstalled', () => {
  const game = createGame();
  game.levelComplete = true;

  assert.equal(swapEquipmentSlot(game, 'utility', 'utility', 2, null).changed, true);
  assert.equal(game.weaponBay.inventory.repulsor_beam, 1);
  assert.equal(swapEquipmentSlot(game, 'utility', 'utility', 3, 'repulsor_beam').changed, true);

  const utilities = normalizeUtilityLoadouts(game.vehicleDefinition)[0];
  assert.equal(utilities.slots[2], null);
  assert.equal(utilities.slots[3], 'repulsor_beam');
  assert.equal(game.weaponBay.inventory.tractor_beam, 1);
  assert.equal(utilityModuleCount(game.vehicleDefinition, 'repulsor_beam'), 1);
});

test('duplicate utility copies are counted by slot rather than presence', () => {
  const game = createGame();
  game.levelComplete = true;
  game.weaponBay.inventory.repulsor_beam = 1;
  assert.equal(swapEquipmentSlot(game, 'utility', 'utility', 0, 'repulsor_beam').changed, true);
  assert.equal(utilityModuleCount(game.vehicleDefinition, 'repulsor_beam'), 2);
});

test('old weapon-bay saves normalize without losing generic equipment inventory', () => {
  const game = createGame();
  const normalized = normalizeWeaponBayState({
    available: true,
    inventory: { cannon: 2, future_merged_utility: 3 },
    unlockedSlots: game.weaponBay.unlockedSlots,
  }, game.vehicleDefinition);
  assert.equal(normalized.inventory.cannon, 2);
  assert.equal(normalized.inventory.future_merged_utility, 3);
  assert.deepEqual(normalized.discoveredMerges, []);
});

test('lite support gun unlocks its first primary slot before later slots', () => {
  const game = createGame(1147, { vehicleDefinition: liteVehicleDefinition, runMode: 'lite' });
  game.levelComplete = true;
  game.weaponBay.available = true;
  game.scrap = LITE_SLOT_UNLOCK_COST * 2;
  assert.equal(weaponSlotUnlocked(game, 'gun-support', 'primary', 0), false);
  assert.equal(unlockLiteWeaponSlot(game, 'gun-support', 'secondary', 0).changed, false);
  assert.equal(unlockLiteWeaponSlot(game, 'gun-support', 'primary', 0).changed, true);
  assert.equal(unlockLiteWeaponSlot(game, 'gun-support', 'secondary', 0).changed, true);
  assert.equal(game.scrap, 0);
});

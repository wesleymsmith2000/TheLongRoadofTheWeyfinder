import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import liteVehicleDefinition from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };
import {
  LITE_SLOT_UNLOCK_COST,
  buildWeaponWithScrap,
  swapWeaponSlot,
  unlockLiteWeaponSlot,
  weaponConstructionCost,
  weaponSlotUnlocked,
} from '../src/core/weaponBay.js';
import { normalizeGunLoadouts } from '../src/core/weaponLoadout.js';

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

test('weapon bay remains locked outside a completed boss rest area', () => {
  const game = createGame();
  game.scrap = 10_000;
  assert.equal(buildWeaponWithScrap(game, 'cannon').changed, false);
  assert.equal(swapWeaponSlot(game, 'gun', 'secondary', 0, null).changed, false);
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

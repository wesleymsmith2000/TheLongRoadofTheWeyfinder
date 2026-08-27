import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import {
  SHOP_COSTS,
  ammoCapacityWithUpgrades,
  ammoModuleCost,
  ammoRefillCost,
  buyUpgradeWithScrap,
  refillAmmoWithScrap,
  repairStatus,
  repairVehicleWithScrap,
  replacementStatus,
  replaceDetachedWithScrap,
  upgradeCost,
  upgradeStatus,
} from '../src/core/economy.js';
import { applyVehicleDamage } from '../src/core/vehicle.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('repair shop spends scrap to restore damaged attached voxels', () => {
  const game = createGame();
  const cell = game.vehicle.cells.find((candidate) => candidate.id === 'armor-left');
  applyVehicleDamage(game.vehicle, { x: -CELL_SIZE, y: -CELL_SIZE }, CELL_SIZE * 0.45, 6);
  const before = cell.state.mass;
  game.scrap = SHOP_COSTS.repair;
  const repaired = repairVehicleWithScrap(game);
  assert.equal(repaired, true);
  assert.equal(game.scrap, 0);
  assert.equal(cell.state.mass > before, true);
});

test('repair shop can restore stripped attached voxels', () => {
  const game = createGame();
  const cell = game.vehicle.cells.find((candidate) => candidate.id === 'armor-left');
  for (const voxel of cell.mask.flat()) voxel.hp = 0;
  game.scrap = SHOP_COSTS.repair;
  const repaired = repairVehicleWithScrap(game);
  assert.equal(repaired, true);
  assert.equal(cell.mask.flat().some((voxel) => voxel.hp > 0), true);
});

test('replacement shop restores one detached module at folded repair cost', () => {
  const game = createGame();
  const wheel = game.vehicle.cells.find((candidate) => candidate.id === 'wheel-left');
  wheel.attached = false;
  game.vehicle.detachedPieces.push({ cell: wheel });
  game.scrap = SHOP_COSTS.replaceDetached;
  const replaced = replaceDetachedWithScrap(game);
  assert.equal(replaced, true);
  assert.equal(wheel.attached, true);
  assert.equal(game.scrap, 0);
});

test('replacement shop restores missing modules after debris expires', () => {
  const game = createGame();
  const wheel = game.vehicle.cells.find((candidate) => candidate.id === 'wheel-left');
  wheel.attached = false;
  game.vehicle.detachedPieces = [];
  game.scrap = SHOP_COSTS.replaceDetached;
  const replaced = replaceDetachedWithScrap(game);
  assert.equal(replaced, true);
  assert.equal(wheel.attached, true);
});

test('replacement shop restores core-connected modules before outer modules', () => {
  const game = createGame();
  const gun = game.vehicle.cells.find((candidate) => candidate.id === 'gun');
  const armor = game.vehicle.cells.find((candidate) => candidate.id === 'armor-left');
  gun.attached = false;
  armor.attached = false;
  game.scrap = SHOP_COSTS.replaceDetached * 2;
  const replacedFirst = replaceDetachedWithScrap(game);
  assert.equal(replacedFirst, true);
  assert.equal(gun.attached, true);
  assert.equal(armor.attached, false);
  const replacedSecond = replaceDetachedWithScrap(game);
  assert.equal(replacedSecond, true);
  assert.equal(armor.attached, true);
});

test('shop status text reports scrap shortfalls and missing modules', () => {
  const game = createGame();
  const wheel = game.vehicle.cells.find((candidate) => candidate.id === 'wheel-left');
  wheel.attached = false;
  game.scrap = 4;
  assert.equal(replacementStatus(game), '1 missing, need 12');
  assert.equal(repairStatus(game), 'No damage');
});

test('ammo refill uses half of a standard ammo load cost', () => {
  const game = createGame();
  game.secondary.ammo.rocket = 1;
  game.scrap = ammoRefillCost('rocket');
  const refilled = refillAmmoWithScrap(game, 'rocket');
  assert.equal(refilled, true);
  assert.equal(game.secondary.ammo.rocket, 12);
  assert.equal(game.scrap, 0);
});

test('ammo module cost is four times a standard ammo load', () => {
  assert.equal(ammoModuleCost('cannon'), 72);
});

test('level-complete shop actions are accepted before next level starts', () => {
  const game = createGame();
  game.levelComplete = true;
  game.secondary.ammo.cannon = 0;
  game.scrap = ammoRefillCost('cannon');
  stepGame(game, { shopRefillAmmoPressed: true, shopAmmoWeapon: 'cannon' }, 1 / 60);
  assert.equal(game.secondary.ammo.cannon, 18);
  assert.equal(game.levelComplete, true);
});

test('level-complete shop can buy upgrades that persist into the next level', () => {
  const game = createGame();
  game.levelComplete = true;
  game.scrap = upgradeCost(game, 'gunDamage');
  stepGame(game, { shopBuyUpgradePressed: true, shopUpgradeId: 'gunDamage' }, 1 / 60);
  assert.equal(game.upgrades.gunDamage, 1);
  stepGame(game, { nextLevelPressed: true }, 1 / 60);
  assert.equal(game.levelComplete, false);
  assert.equal(game.upgrades.gunDamage, 1);
});

test('upgrade shop spends scrap and scales the next cost geometrically', () => {
  const game = createGame();
  game.scrap = upgradeCost(game, 'gunDamage');
  const bought = buyUpgradeWithScrap(game, 'gunDamage');
  assert.equal(bought, true);
  assert.equal(game.upgrades.gunDamage, 1);
  assert.equal(game.scrap, 0);
  assert.equal(upgradeCost(game, 'gunDamage'), 5);
  assert.equal(upgradeStatus(game, 'gunDamage'), 'Level 1, need 5');
});

test('ammo capacity upgrades expand the matching reserve', () => {
  const game = createGame();
  game.scrap = upgradeCost(game, 'rocketAmmo');
  const bought = buyUpgradeWithScrap(game, 'rocketAmmo');
  assert.equal(bought, true);
  assert.equal(ammoCapacityWithUpgrades(game, 'rocket'), 15);
  assert.equal(game.secondary.ammo.rocket, 15);
});

test('armor toughness upgrade thickens armor voxels', () => {
  const game = createGame();
  const armor = game.vehicle.cells.find((cell) => cell.id === 'armor-left');
  const before = Math.max(...armor.mask.flat().map((voxel) => voxel.maxHp));
  game.scrap = upgradeCost(game, 'armorToughness');
  buyUpgradeWithScrap(game, 'armorToughness');
  const after = Math.max(...armor.mask.flat().map((voxel) => voxel.maxHp));
  assert.equal(after > before, true);
});

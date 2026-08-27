import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import {
  SHOP_COSTS,
  ammoModuleCost,
  ammoRefillCost,
  refillAmmoWithScrap,
  repairStatus,
  repairVehicleWithScrap,
  replacementStatus,
  replaceDetachedWithScrap,
} from '../src/core/economy.js';
import { applyVehicleDamage } from '../src/core/vehicle.js';

test('repair shop spends scrap to restore damaged attached voxels', () => {
  const game = createGame();
  const cell = game.vehicle.cells.find((candidate) => candidate.id === 'armor-left');
  applyVehicleDamage(game.vehicle, { x: -20, y: -20 }, 9, 6);
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

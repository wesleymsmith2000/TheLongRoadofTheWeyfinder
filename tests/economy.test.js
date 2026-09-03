import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };
import {
  SHOP_COSTS,
  ammoCapacityWithUpgrades,
  ammoModuleCost,
  ammoRefillCost,
  availableUpgradeDefinitions,
  buyUpgradeWithScrap,
  refillAmmoWithScrap,
  repairCost,
  repairStatus,
  repairVehicleWithScrap,
  replacementStatus,
  replaceDetachedWithScrap,
  upgradeCost,
  upgradeStatus,
} from '../src/core/economy.js';
import { applyVehicleDamage } from '../src/core/vehicle.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import { createPrototypePlayerAccountData } from '../src/core/playerAccount.js';
import { setGunLoadoutSlot } from '../src/core/weaponLoadout.js';

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

test('repair shop can target one damaged system', () => {
  const game = createGame();
  const armor = game.vehicle.cells.find((candidate) => candidate.id === 'armor-left');
  const gun = game.vehicle.cells.find((candidate) => candidate.id === 'gun');
  applyVehicleDamage(game.vehicle, { x: -CELL_SIZE, y: -CELL_SIZE }, CELL_SIZE * 0.45, 6);
  applyVehicleDamage(game.vehicle, { x: 0, y: -CELL_SIZE }, CELL_SIZE * 0.45, 6);
  const armorBefore = armor.state.mass;
  const gunBefore = gun.state.mass;
  game.scrap = repairCost(game, 'armor');
  const repaired = repairVehicleWithScrap(game, 'armor');
  assert.equal(repaired, true);
  assert.equal(armor.state.mass > armorBefore, true);
  assert.equal(gun.state.mass, gunBefore);
});

test('repair cost rises with total upgrade levels', () => {
  const game = createGame();
  applyVehicleDamage(game.vehicle, { x: -CELL_SIZE, y: -CELL_SIZE }, CELL_SIZE * 0.45, 6);
  const base = repairCost(game);
  game.upgrades.gunDamage = 50;
  assert.equal(repairCost(game) > base, true);
});

test('ammo refill uses half of a standard ammo load cost', () => {
  const game = createGame();
  game.secondary.ammo.rocket = 1;
  game.scrap = ammoRefillCost('rocket');
  const refilled = refillAmmoWithScrap(game, 'rocket');
  assert.equal(refilled, true);
  assert.equal(game.secondary.ammo.rocket, 17);
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
  assert.equal(game.secondary.ammo.cannon, 26);
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
  assert.equal(ammoCapacityWithUpgrades(game, 'rocket'), 19);
  assert.equal(game.secondary.ammo.rocket, 19);
});

test('beam ammo capacity upgrades expand the beam reserve', () => {
  const game = createGame();
  game.scrap = upgradeCost(game, 'beamAmmo');
  const bought = buyUpgradeWithScrap(game, 'beamAmmo');
  assert.equal(bought, true);
  assert.equal(ammoCapacityWithUpgrades(game, 'beam'), 60);
  assert.equal(game.secondary.ammo.beam, 60);
});

test('secondary ammo capacity scales with installed weapon copies', () => {
  const twoRocketSlots = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 1, 'rocket').definition;
  const threeRocketSlots = setGunLoadoutSlot(twoRocketSlots, 'gun', 'secondary', 2, 'rocket').definition;
  const game = createGame(1147, { vehicleDefinition: threeRocketSlots });
  assert.equal(ammoCapacityWithUpgrades(game, 'rocket'), 24);
  assert.equal(game.secondary.ammo.rocket, 24);
});

test('new secondary ammo capacity upgrades expand their reserves', () => {
  const staDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 0, 'sta_missile').definition;
  const staGame = createGame(1147, { vehicleDefinition: staDefinition });
  staGame.account = createPrototypePlayerAccountData();
  staGame.scrap = upgradeCost(staGame, 'staMissileAmmo');
  assert.equal(buyUpgradeWithScrap(staGame, 'staMissileAmmo'), true);
  assert.equal(ammoCapacityWithUpgrades(staGame, 'sta_missile'), 25);
  assert.equal(staGame.secondary.ammo.sta_missile, 25);

  const orbDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 0, 'orb_of_blades').definition;
  const orbGame = createGame(1147, { vehicleDefinition: orbDefinition });
  orbGame.account = createPrototypePlayerAccountData();
  orbGame.scrap = upgradeCost(orbGame, 'orbOfBladesAmmo');
  assert.equal(buyUpgradeWithScrap(orbGame, 'orbOfBladesAmmo'), true);
  assert.equal(ammoCapacityWithUpgrades(orbGame, 'orb_of_blades'), 19);
  assert.equal(orbGame.secondary.ammo.orb_of_blades, 19);
});

test('upgrade purchases allow installed weapons even before unlock state is checked', () => {
  const definition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 0, 'sta_missile').definition;
  const game = createGame(1147, { vehicleDefinition: definition });
  const lockedAccount = createPrototypePlayerAccountData();
  lockedAccount.weaponUnlocks.secondary = ['rocket'];
  game.scrap = upgradeCost(game, 'staMissileBlastRadius');
  assert.equal(availableUpgradeDefinitions(game, lockedAccount, definition).some((upgrade) => upgrade.id === 'staMissileBlastRadius'), true);
  assert.equal(buyUpgradeWithScrap(game, 'staMissileBlastRadius', lockedAccount, definition), true);
  assert.equal(game.upgrades.staMissileBlastRadius, 1);
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

test('repair screen upgrade list only includes unlocked installed systems', () => {
  const account = createPrototypePlayerAccountData();
  const game = createGame(1147, { vehicleDefinition: startingVehicleDefinition });
  const baseline = availableUpgradeDefinitions(game, account, startingVehicleDefinition).map((upgrade) => upgrade.id);
  assert.equal(baseline.includes('rocketImpactDamage'), true);
  assert.equal(baseline.includes('beamDamage'), true);
  assert.equal(baseline.includes('miniBeamDamage'), false);
  assert.equal(baseline.includes('scrapMagnetDistance'), false);
  account.moduleUnlocks.push('scrap_magnet');
  const withMagnet = availableUpgradeDefinitions(game, account, startingVehicleDefinition).map((upgrade) => upgrade.id);
  assert.equal(withMagnet.includes('scrapMagnetDistance'), true);

  const withMiniBeam = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 1, 'mini_beam').definition;
  const miniBeamUpgrades = availableUpgradeDefinitions(game, account, withMiniBeam).map((upgrade) => upgrade.id);
  assert.equal(miniBeamUpgrades.includes('miniBeamDamage'), true);
  assert.equal(miniBeamUpgrades.includes('miniBeamHeatSink'), true);

  const withTrackingFlechette = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'tracking_flechette').definition;
  const flechetteUpgrades = availableUpgradeDefinitions(game, account, withTrackingFlechette).map((upgrade) => upgrade.id);
  assert.equal(flechetteUpgrades.includes('trackingFlechetteFireRate'), true);
  assert.equal(flechetteUpgrades.includes('trackingFlechettePierce'), true);
  assert.equal(flechetteUpgrades.includes('trackingFlechetteAcceleration'), true);
  assert.equal(flechetteUpgrades.includes('trackingFlechetteImpactDamage'), true);
  assert.equal(flechetteUpgrades.includes('trackingFlechetteTurningRate'), true);

  const withoutBeam = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 2, null).definition;
  const filtered = availableUpgradeDefinitions(game, account, withoutBeam).map((upgrade) => upgrade.id);
  assert.equal(filtered.includes('beamDamage'), false);

  const withSta = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 0, 'sta_missile').definition;
  const staUpgrades = availableUpgradeDefinitions(game, account, withSta).map((upgrade) => upgrade.id);
  assert.equal(staUpgrades.includes('staMissileAmmo'), true);
  assert.equal(staUpgrades.includes('staMissileBlastRadius'), true);

  const withOrb = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'secondary', 0, 'orb_of_blades').definition;
  const orbUpgrades = availableUpgradeDefinitions(game, account, withOrb).map((upgrade) => upgrade.id);
  assert.equal(orbUpgrades.includes('orbOfBladesEmissionRate'), true);
  assert.equal(orbUpgrades.includes('orbOfBladesBladeDamage'), true);
  assert.equal(orbUpgrades.includes('orbOfBladesBladesPerCycle'), true);
  assert.equal(orbUpgrades.includes('orbOfBladesBladeKnockback'), true);

  const withMortar = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mortar').definition;
  const mortarUpgrades = availableUpgradeDefinitions(game, account, withMortar).map((upgrade) => upgrade.id);
  assert.equal(mortarUpgrades.includes('mortarFireRate'), true);
  assert.equal(mortarUpgrades.includes('mortarImpactDamage'), true);
  assert.equal(mortarUpgrades.includes('mortarBlastDamage'), true);

  const withRepulsor = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'repulsor_beam').definition;
  const repulsorUpgrades = availableUpgradeDefinitions(game, account, withRepulsor).map((upgrade) => upgrade.id);
  assert.equal(repulsorUpgrades.includes('repulsorKnockback'), true);
  assert.equal(repulsorUpgrades.includes('repulsorFireRate'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };
import { createPrototypePlayerAccountData, equipmentLimit, normalizePrototypePlayerAccountData, validatePlayerAccountData } from '../src/core/playerAccount.js';
import {
  addEditableVehicleCell,
  connectEditableVehicleCells,
  createVehicleFromConstructDefinition,
  editableVehicleReport,
  normalizeGunLoadouts,
  removeEditableVehicleCell,
  setGunLoadoutSlot,
  vehicleToConstructDefinition,
} from '../src/core/playerVehicleEditor.js';
import { weaponStackMultiplier } from '../src/core/weaponLoadout.js';
import { availablePrimaryWeaponIds, availableSecondaryWeaponIds } from '../src/core/weaponLoadout.js';
import { createStartingVehicle } from '../src/core/vehicle.js';

test('prototype player account exposes non-core equipment quantities', () => {
  const account = createPrototypePlayerAccountData();
  const report = validatePlayerAccountData(account);
  assert.equal(report.valid, true);
  assert.equal(equipmentLimit(account, 'core'), 0);
  assert.equal(equipmentLimit(account, 'armor') > startingVehicleDefinition.cells.filter((cell) => cell.type === 'armor').length, true);
  assert.equal(equipmentLimit(account, 'utility') > startingVehicleDefinition.cells.filter((cell) => cell.type === 'utility').length, true);
});

test('old player accounts are normalized to the expanded equipment baseline', () => {
  const account = normalizePrototypePlayerAccountData({
    ...createPrototypePlayerAccountData(),
    equipment: {
      armor: { unlocked: true, quantity: 14 },
      gun: { unlocked: true, quantity: 3 },
      wheel: { unlocked: true, quantity: 4 },
      engine: { unlocked: true, quantity: 3 },
    },
  });
  assert.equal(equipmentLimit(account, 'armor'), 28);
  assert.equal(equipmentLimit(account, 'gun'), 6);
  assert.equal(equipmentLimit(account, 'wheel'), 8);
  assert.equal(equipmentLimit(account, 'engine'), 6);
  assert.equal(equipmentLimit(account, 'utility'), 2);
});

test('starting player vehicle content creates the default runtime vehicle', () => {
  const vehicle = createStartingVehicle();
  assert.equal(vehicle.cells.length, 8);
  assert.equal(vehicle.connections.length, 7);
  assert.equal(vehicle.alive, true);
  assert.equal(vehicle.cells.some((cell) => cell.type === 'core'), true);
  assert.equal(vehicle.cells.some((cell) => cell.type === 'utility'), true);
  assert.deepEqual(vehicle.modules.find((module) => module.cellId === 'utility')?.slots, ['booster', 'scrap_magnet']);
});

test('player vehicle editor can add additional unlocked equipment copies', () => {
  const account = createPrototypePlayerAccountData();
  const result = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', -2, -1);
  assert.equal(result.changed, true);
  assert.equal(result.definition.cells.some((cell) => cell.type === 'armor' && cell.gridX === -2 && cell.gridY === -1), true);
});

test('player vehicle editor adds default utility slots to utility cells', () => {
  const account = createPrototypePlayerAccountData();
  const result = addEditableVehicleCell(startingVehicleDefinition, account, 'utility', -2, -1);
  const utility = result.definition.cells.find((cell) => cell.type === 'utility' && cell.gridX === -2 && cell.gridY === -1);
  assert.equal(result.changed, true);
  assert.deepEqual(result.definition.modules.find((module) => module.cellId === utility.id)?.slots, ['booster', 'scrap_magnet']);

  const removed = removeEditableVehicleCell(result.definition, utility.id);
  assert.equal(removed.changed, true);
  assert.equal(removed.definition.modules.some((module) => module.cellId === utility.id), false);
});

test('player vehicle editor allows the expanded build radius', () => {
  const account = createPrototypePlayerAccountData();
  const edgeResult = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', 8, 0);
  const outsideResult = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', 9, 0);
  assert.equal(edgeResult.changed, true);
  assert.equal(outsideResult.changed, false);
});

test('player vehicle editor refuses additional cores and occupied positions', () => {
  const account = createPrototypePlayerAccountData();
  const coreResult = addEditableVehicleCell(startingVehicleDefinition, account, 'core', 2, 0);
  const occupiedResult = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', 0, 0);
  assert.equal(coreResult.changed, false);
  assert.equal(occupiedResult.changed, false);
});

test('player vehicle editor keeps the original core removable invariant', () => {
  const result = removeEditableVehicleCell(startingVehicleDefinition, 'core');
  assert.equal(result.changed, false);
  assert.match(result.reason, /Core/);
});

test('player vehicle editor can connect adjacent added cells', () => {
  const account = createPrototypePlayerAccountData();
  const addResult = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', -2, -1);
  const added = addResult.definition.cells.find((cell) => cell.gridX === -2 && cell.gridY === -1);
  const connectResult = connectEditableVehicleCells(addResult.definition, added.id, 'armor-left');
  assert.equal(connectResult.changed, true);
  assert.equal(connectResult.definition.connections.some((edge) => edge.a === added.id || edge.b === added.id), true);
});

test('player vehicle editor can stack cells and connect vertical layers', () => {
  const account = createPrototypePlayerAccountData();
  const addResult = addEditableVehicleCell(startingVehicleDefinition, account, 'armor', 0, 0, 1);
  const stacked = addResult.definition.cells.find((cell) => cell.gridX === 0 && cell.gridY === 0 && cell.gridZ === 1);
  const occupiedResult = addEditableVehicleCell(addResult.definition, account, 'armor', 0, 0, 1);
  const connectResult = connectEditableVehicleCells(addResult.definition, 'core', stacked.id);
  const vehicle = createVehicleFromConstructDefinition(connectResult.definition);
  assert.equal(addResult.changed, true);
  assert.equal(occupiedResult.changed, false);
  assert.equal(connectResult.changed, true);
  assert.equal(connectResult.definition.connections.some((edge) => edge.aSide === 'above' && edge.bSide === 'below'), true);
  assert.equal(vehicle.cells.find((cell) => cell.id === stacked.id).gridZ, 1);
});

test('edited player vehicle definitions instantiate into runtime vehicles', () => {
  const account = createPrototypePlayerAccountData();
  const addResult = addEditableVehicleCell(startingVehicleDefinition, account, 'engine', 0, 3);
  const vehicle = createVehicleFromConstructDefinition(addResult.definition);
  const roundTrip = vehicleToConstructDefinition(vehicle, addResult.definition);
  const report = editableVehicleReport(roundTrip, account);
  assert.equal(vehicle.cells.length, 9);
  assert.equal(report.valid, true);
});

test('player vehicle editor stores configurable weapon loadouts on gun cells', () => {
  const account = createPrototypePlayerAccountData();
  const addResult = addEditableVehicleCell(startingVehicleDefinition, account, 'gun', 0, -2);
  const gun = addResult.definition.cells.find((cell) => cell.gridX === 0 && cell.gridY === -2);
  const primaryResult = setGunLoadoutSlot(addResult.definition, gun.id, 'primary', 0, 'tracking_flechette');
  const secondaryResult = setGunLoadoutSlot(primaryResult.definition, gun.id, 'secondary', 1, 'orb_of_blades');
  const loadout = normalizeGunLoadouts(secondaryResult.definition).find((candidate) => candidate.cellId === gun.id);
  assert.equal(loadout.primary[0], 'tracking_flechette');
  assert.equal(loadout.secondary[1], 'orb_of_blades');
  assert.equal(weaponStackMultiplier(secondaryResult.definition, 'rocket') >= 1, true);
});

test('prototype account exposes only unlocked player weapon choices', () => {
  const account = createPrototypePlayerAccountData();
  assert.deepEqual(availablePrimaryWeaponIds(account), ['main.basic', 'tracking_flechette', 'mortar', 'blade_launcher', 'mini_beam', 'repulsor_beam']);
  assert.deepEqual(availableSecondaryWeaponIds(account), ['rocket', 'cannon', 'beam', 'tractor_beam', 'sta_missile', 'orb_of_blades']);
  account.weaponUnlocks.primary.push('mortar');
  account.weaponUnlocks.secondary.push('sta_missile');
  assert.equal(availablePrimaryWeaponIds(account).includes('mortar'), true);
  assert.equal(availableSecondaryWeaponIds(account).includes('sta_missile'), true);
});

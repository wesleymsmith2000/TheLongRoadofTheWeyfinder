import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createPrototypePlayerAccountData } from '../src/core/playerAccount.js';
import { equipmentUpgradeDefinitions } from '../src/core/equipmentSystemLevel.js';
import {
  evaluateMergeRecipe,
  listEquipmentMergeRecipes,
  mergeEquipment,
  normalizeEquipmentMergeRecipe,
  validateEquipmentMergeRecipe,
} from '../src/core/equipmentMerge.js';
import { buildEquipmentWithScrap } from '../src/core/weaponBay.js';

function raiseFamily(game, itemId, level) {
  for (const upgrade of equipmentUpgradeDefinitions(itemId)) game.upgrades[upgrade.id] = level;
}

test('merge recipe validation preserves consumed ingredients and technology prerequisites', () => {
  const recipe = testRecipe({
    technologyPrerequisites: [{ itemId: 'booster', minSystemLevel: 2 }],
  });
  const report = validateEquipmentMergeRecipe(recipe);
  assert.equal(report.valid, true);
  const normalized = normalizeEquipmentMergeRecipe(recipe);
  assert.equal(normalized.ingredients[0].quantity, 1);
  assert.equal(normalized.technologyPrerequisites[0].itemId, 'booster');
});

test('installed equipment does not satisfy a merge physical-copy requirement', () => {
  const game = createGame();
  const account = createPrototypePlayerAccountData();
  const recipe = listEquipmentMergeRecipes()[0];
  for (const item of recipe.ingredients) raiseFamily(game, item.itemId, item.minSystemLevel);

  const evaluation = evaluateMergeRecipe(game, account, recipe);
  const beamInventory = evaluation.requirements.find((requirement) => requirement.kind === 'inventory' && requirement.itemId === 'beam');
  assert.equal(beamInventory.actual, 0);
  assert.equal(beamInventory.met, false);
  assert.equal(evaluation.available, false);
});

test('successful merge consumes exact hardware quantities and adds an uninstalled output', () => {
  const game = createGame();
  const account = createPrototypePlayerAccountData();
  game.levelComplete = true;
  const recipe = listEquipmentMergeRecipes()[0];
  for (const item of recipe.ingredients) {
    raiseFamily(game, item.itemId, item.minSystemLevel);
    game.weaponBay.inventory[item.itemId] = item.quantity;
  }

  const result = mergeEquipment(game, account, recipe.assetId);

  assert.equal(result.changed, true);
  for (const item of recipe.ingredients) assert.equal(game.weaponBay.inventory[item.itemId], 0);
  assert.equal(game.weaponBay.inventory.vortex_wavelet_beam, 1);
  assert.equal(game.weaponBay.discoveredMerges.includes(recipe.assetId), true);
});

test('failed merge is atomic and reports every unmet requirement', () => {
  const game = createGame();
  const account = createPrototypePlayerAccountData();
  const recipe = listEquipmentMergeRecipes()[0];
  game.weaponBay.inventory.beam = 1;
  const before = structuredClone(game.weaponBay.inventory);

  const result = mergeEquipment(game, account, recipe.assetId);

  assert.equal(result.changed, false);
  assert.deepEqual(game.weaponBay.inventory, before);
  assert.equal(result.evaluation.requirements.filter((requirement) => !requirement.met).length > 1, true);
});

test('technology prerequisites and achievement gates do not consume hardware', () => {
  const game = createGame();
  const account = createPrototypePlayerAccountData();
  const recipe = normalizeEquipmentMergeRecipe(testRecipe({
    technologyPrerequisites: [{ itemId: 'booster', minSystemLevel: 1 }],
    requirements: { achievementId: 'achievement.merge_test' },
  }));
  game.weaponBay.inventory['main.basic'] = 1;
  game.weaponBay.inventory.booster = 3;
  raiseFamily(game, 'booster', 1);

  const locked = evaluateMergeRecipe(game, account, recipe);
  assert.equal(locked.requirements.find((requirement) => requirement.kind === 'achievement').met, false);
  account.achievements.unlocked.push('achievement.merge_test');
  const result = mergeEquipment(game, account, recipe.assetId, [recipe]);

  assert.equal(result.changed, true);
  assert.equal(game.weaponBay.inventory['main.basic'], 0);
  assert.equal(game.weaponBay.inventory.booster, 3);
  assert.equal(game.weaponBay.inventory.test_output, 1);
});

test('locked recipes remain listed and merge-only outputs cannot be scrap-fabricated', () => {
  const game = createGame();
  game.levelComplete = true;
  game.scrap = 1_000_000;
  assert.equal(listEquipmentMergeRecipes().length > 0, true);
  const result = buildEquipmentWithScrap(game, 'vortex_wavelet_beam');
  assert.equal(result.changed, false);
  assert.match(result.reason, /only be created through a merge/i);
});

function testRecipe(overrides = {}) {
  return {
    schemaVersion: '0.1',
    assetId: 'merge.test_output',
    displayName: 'Test Output',
    output: { itemId: 'test_output', quantity: 1 },
    ingredients: [{ itemId: 'main.basic', quantity: 1, minSystemLevel: 0 }],
    technologyPrerequisites: [],
    requirements: { achievementId: null },
    ...overrides,
  };
}

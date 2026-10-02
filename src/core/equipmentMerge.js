import { isCompatibleSchemaVersion, isNonEmptyString, isPlainObject } from './contentSchema.js';
import { equipmentSystemLevel } from './equipmentSystemLevel.js';
import prototypeVortexRecipe from '../../content/merges/prototype_vortex_wavelet_beam.json' with { type: 'json' };

export const EQUIPMENT_MERGE_RECIPES = Object.freeze([normalizeEquipmentMergeRecipe(prototypeVortexRecipe)]);

export function listEquipmentMergeRecipes() {
  return EQUIPMENT_MERGE_RECIPES;
}

export function validateEquipmentMergeRecipe(recipe) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(recipe)) return { valid: false, errors: ['Merge recipe must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(recipe.schemaVersion)) errors.push(`Unsupported merge schemaVersion "${recipe.schemaVersion ?? 'missing'}". Expected 0.x.`);
  if (!isNonEmptyString(recipe.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(recipe.displayName)) errors.push('displayName must be a non-empty string.');
  validateItemQuantity(recipe.output, 'output', errors);
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) errors.push('ingredients must contain at least one consumed item.');
  for (const [index, ingredient] of (recipe.ingredients ?? []).entries()) validateRecipeItem(ingredient, `ingredients[${index}]`, errors);
  if (recipe.technologyPrerequisites != null && !Array.isArray(recipe.technologyPrerequisites)) {
    errors.push('technologyPrerequisites must be an array when provided.');
  }
  for (const [index, prerequisite] of (recipe.technologyPrerequisites ?? []).entries()) {
    if (!isPlainObject(prerequisite) || !isNonEmptyString(prerequisite.itemId)) errors.push(`technologyPrerequisites[${index}].itemId must be a non-empty string.`);
    validateNonNegativeInteger(prerequisite?.minSystemLevel ?? 0, `technologyPrerequisites[${index}].minSystemLevel`, errors);
  }
  if (recipe.requirements != null && !isPlainObject(recipe.requirements)) errors.push('requirements must be an object when provided.');
  if (recipe.requirements?.achievementId != null && !isNonEmptyString(recipe.requirements.achievementId)) {
    errors.push('requirements.achievementId must be null or a non-empty string.');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeEquipmentMergeRecipe(recipe) {
  const report = validateEquipmentMergeRecipe(recipe);
  if (!report.valid) throw new Error(`Invalid merge recipe "${recipe?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  return Object.freeze({
    schemaVersion: recipe.schemaVersion,
    assetId: recipe.assetId,
    displayName: recipe.displayName,
    description: recipe.description ?? '',
    output: Object.freeze({ itemId: recipe.output.itemId, quantity: recipe.output.quantity }),
    ingredients: Object.freeze(recipe.ingredients.map((ingredient) => Object.freeze({
      itemId: ingredient.itemId,
      quantity: ingredient.quantity,
      minSystemLevel: ingredient.minSystemLevel ?? 0,
    }))),
    technologyPrerequisites: Object.freeze((recipe.technologyPrerequisites ?? []).map((prerequisite) => Object.freeze({
      itemId: prerequisite.itemId,
      minSystemLevel: prerequisite.minSystemLevel ?? 0,
    }))),
    requirements: Object.freeze({ achievementId: recipe.requirements?.achievementId ?? null }),
  });
}

export function evaluateMergeRecipe(game, account, recipe) {
  const normalized = recipe?.output ? normalizeEquipmentMergeRecipe(recipe) : recipe;
  const requirements = [];
  for (const ingredient of normalized.ingredients) {
    requirements.push(systemLevelRequirement(game, ingredient));
    requirements.push(inventoryRequirement(game, ingredient));
  }
  for (const prerequisite of normalized.technologyPrerequisites) {
    requirements.push({ ...systemLevelRequirement(game, prerequisite), consumed: false });
  }
  if (normalized.requirements.achievementId) {
    const achievementId = normalized.requirements.achievementId;
    const unlocked = account?.achievements?.unlocked ?? [];
    requirements.push({ kind: 'achievement', achievementId, required: true, actual: unlocked.includes(achievementId), met: unlocked.includes(achievementId) });
  }
  return {
    recipeId: normalized.assetId,
    available: requirements.every((requirement) => requirement.met),
    requirements,
  };
}

export function mergeEquipment(game, account, recipeId, recipes = EQUIPMENT_MERGE_RECIPES) {
  const recipe = recipes.find((candidate) => candidate.assetId === recipeId);
  if (!recipe) return { changed: false, reason: 'Unknown merge recipe.', evaluation: null };
  const evaluation = evaluateMergeRecipe(game, account, recipe);
  if (!evaluation.available) return { changed: false, reason: 'Merge requirements are not met.', evaluation };

  const inventory = game.weaponBay.inventory;
  for (const ingredient of recipe.ingredients) inventory[ingredient.itemId] -= ingredient.quantity;
  inventory[recipe.output.itemId] = (inventory[recipe.output.itemId] ?? 0) + recipe.output.quantity;
  game.weaponBay.discoveredMerges ??= [];
  if (!game.weaponBay.discoveredMerges.includes(recipe.assetId)) game.weaponBay.discoveredMerges.push(recipe.assetId);
  return {
    changed: true,
    recipeId: recipe.assetId,
    output: { ...recipe.output },
    evaluation,
  };
}

function systemLevelRequirement(game, item) {
  const actual = equipmentSystemLevel(game, item.itemId);
  return {
    kind: 'systemLevel',
    itemId: item.itemId,
    required: item.minSystemLevel ?? 0,
    actual,
    met: actual >= (item.minSystemLevel ?? 0),
    consumed: true,
  };
}

function inventoryRequirement(game, item) {
  const actual = game?.weaponBay?.inventory?.[item.itemId] ?? 0;
  return {
    kind: 'inventory',
    itemId: item.itemId,
    required: item.quantity,
    actual,
    met: actual >= item.quantity,
    consumed: true,
  };
}

function validateRecipeItem(item, path, errors) {
  validateItemQuantity(item, path, errors);
  validateNonNegativeInteger(item?.minSystemLevel ?? 0, `${path}.minSystemLevel`, errors);
}

function validateItemQuantity(item, path, errors) {
  if (!isPlainObject(item)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!isNonEmptyString(item.itemId)) errors.push(`${path}.itemId must be a non-empty string.`);
  if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push(`${path}.quantity must be a positive integer.`);
}

function validateNonNegativeInteger(value, path, errors) {
  if (!Number.isInteger(value) || value < 0) errors.push(`${path} must be a non-negative integer.`);
}

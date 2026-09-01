import { CELL_TYPES } from './constructDefinition.js';
import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isPlainObject } from './contentSchema.js';

export const PLAYER_ACCOUNT_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PLAYER_EQUIPMENT_TYPES = CELL_TYPES.filter((type) => type !== 'core');

export function createPrototypePlayerAccountData() {
  return {
    schemaVersion: PLAYER_ACCOUNT_SCHEMA_VERSION,
    accountId: 'local.prototype0',
    displayName: 'Local Pilot',
    equipment: {
      armor: { unlocked: true, quantity: 14 },
      gun: { unlocked: true, quantity: 3 },
      wheel: { unlocked: true, quantity: 4 },
      engine: { unlocked: true, quantity: 3 },
    },
    achievements: { unlocked: [] },
    weaponUnlocks: {
      primary: ['main.basic', 'mini_beam'],
      secondary: ['rocket', 'cannon', 'beam'],
    },
    savedVehicle: null,
  };
}

export function validatePlayerAccountData(account) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(account)) return { valid: false, errors: ['Player account data must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(account.schemaVersion)) {
    errors.push(`Unsupported player account schemaVersion "${account.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isPlainObject(account.equipment)) errors.push('equipment must be an object.');

  for (const type of PLAYER_EQUIPMENT_TYPES) {
    const entry = account.equipment?.[type];
    if (!isPlainObject(entry)) {
      warnings.push(`equipment.${type} is missing; ${type} will be unavailable.`);
      continue;
    }
    if (typeof entry.unlocked !== 'boolean') errors.push(`equipment.${type}.unlocked must be a boolean.`);
    if (!Number.isInteger(entry.quantity) || entry.quantity < 0) errors.push(`equipment.${type}.quantity must be a non-negative integer.`);
  }

  if (account.equipment?.core) warnings.push('Core equipment is ignored; player vehicles may only contain one core.');
  if (account.achievements != null && !Array.isArray(account.achievements?.unlocked)) errors.push('achievements.unlocked must be an array when provided.');
  if (account.weaponUnlocks != null) {
    if (!Array.isArray(account.weaponUnlocks?.primary)) errors.push('weaponUnlocks.primary must be an array when provided.');
    if (!Array.isArray(account.weaponUnlocks?.secondary)) errors.push('weaponUnlocks.secondary must be an array when provided.');
  }
  if (account.moduleUnlocks != null && !Array.isArray(account.moduleUnlocks)) errors.push('moduleUnlocks must be an array when provided.');
  return { valid: errors.length === 0, errors, warnings };
}

export function equipmentLimit(account, type) {
  if (!PLAYER_EQUIPMENT_TYPES.includes(type)) return 0;
  const entry = account.equipment?.[type];
  if (!entry?.unlocked) return 0;
  return Math.max(0, entry.quantity ?? 0);
}

export function preparePlayerAccountForSave(account, savedVehicle) {
  const next = structuredClone(account);
  next.savedVehicle = savedVehicle;
  return next;
}

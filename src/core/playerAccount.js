import { CELL_TYPES } from './constructDefinition.js';
import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isPlainObject } from './contentSchema.js';

export const PLAYER_ACCOUNT_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const PLAYER_EQUIPMENT_TYPES = CELL_TYPES.filter((type) => type !== 'core');
export const PLAYER_EQUIPMENT_BASE_QUANTITIES = {
  armor: 28,
  gun: 6,
  utility: 2,
  wheel: 8,
  engine: 6,
};

export function createPrototypePlayerAccountData() {
  return {
    schemaVersion: PLAYER_ACCOUNT_SCHEMA_VERSION,
    accountId: 'local.prototype0',
    displayName: 'Local Pilot',
    equipment: {
      armor: { unlocked: true, quantity: PLAYER_EQUIPMENT_BASE_QUANTITIES.armor },
      gun: { unlocked: true, quantity: PLAYER_EQUIPMENT_BASE_QUANTITIES.gun },
      utility: { unlocked: true, quantity: PLAYER_EQUIPMENT_BASE_QUANTITIES.utility },
      wheel: { unlocked: true, quantity: PLAYER_EQUIPMENT_BASE_QUANTITIES.wheel },
      engine: { unlocked: true, quantity: PLAYER_EQUIPMENT_BASE_QUANTITIES.engine },
    },
    achievements: { unlocked: [] },
    weaponUnlocks: {
      primary: ['main.basic', 'tracking_flechette', 'mortar', 'blade_launcher', 'mini_beam', 'repulsor_beam'],
      secondary: ['rocket', 'cannon', 'beam', 'tractor_beam', 'sta_missile', 'orb_of_blades'],
    },
    moduleUnlocks: [],
    modules: {},
    savedVehicle: null,
  };
}

export function normalizePrototypePlayerAccountData(account = null) {
  const defaults = createPrototypePlayerAccountData();
  if (!account) return defaults;
  const next = { ...defaults, ...account };
  next.equipment = mergeRecord(defaults.equipment, account.equipment);
  for (const [type, floor] of Object.entries(PLAYER_EQUIPMENT_BASE_QUANTITIES)) {
    next.equipment[type] ??= { unlocked: true, quantity: floor };
    next.equipment[type].unlocked = next.equipment[type].unlocked || defaults.equipment[type]?.unlocked === true;
    next.equipment[type].quantity = Math.max(floor, next.equipment[type].quantity ?? 0);
  }
  next.achievements = { unlocked: [...new Set([...(defaults.achievements.unlocked ?? []), ...(account.achievements?.unlocked ?? [])])] };
  next.weaponUnlocks = {
    primary: mergeList(defaults.weaponUnlocks.primary, account.weaponUnlocks?.primary),
    secondary: mergeList(defaults.weaponUnlocks.secondary, account.weaponUnlocks?.secondary),
  };
  next.moduleUnlocks = mergeList(defaults.moduleUnlocks, account.moduleUnlocks);
  next.modules = mergeRecord(defaults.modules, account.modules);
  return next;
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
  if (account.modules != null && !isPlainObject(account.modules)) errors.push('modules must be an object when provided.');
  for (const [moduleId, entry] of Object.entries(account.modules ?? {})) {
    if (!isPlainObject(entry)) {
      errors.push(`modules.${moduleId} must be an object.`);
      continue;
    }
    if (typeof entry.unlocked !== 'boolean') errors.push(`modules.${moduleId}.unlocked must be a boolean.`);
    if (!Number.isInteger(entry.quantity) || entry.quantity < 0) errors.push(`modules.${moduleId}.quantity must be a non-negative integer.`);
  }
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

function mergeList(defaults = [], saved = []) {
  return [...new Set([...(Array.isArray(defaults) ? defaults : []), ...(Array.isArray(saved) ? saved : [])])];
}

function mergeRecord(defaults = {}, saved = {}) {
  return { ...(defaults ?? {}), ...(isPlainObject(saved) ? saved : {}) };
}

import canonEnemyArchetypes from '../../content/enemies/prototype0_enemy_archetypes.json' with { type: 'json' };
import { CANON_STATUSES, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const CANON_ENEMY_ARCHETYPE_PACK = canonEnemyArchetypes;
export const ENEMY_RUNTIME_FACTORIES = ['createEnemy', 'createEnhancedEnemy', 'createPirateShipEnemy', 'createEnhancedPirateShipEnemy', 'createBossEnemy'];
export const ENEMY_ENTRY_KINDS = ['aheadDrift', 'behindCharge', 'aheadBoss'];

export function validateEnemyArchetypePack(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Enemy archetype pack must be an object.'], warnings };

  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported enemy archetype schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(definition.displayName)) errors.push('displayName must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
  if (!Array.isArray(definition.archetypes)) {
    errors.push('archetypes must be an array.');
  } else {
    validateArchetypes(definition.archetypes, errors, warnings);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function listEnemyArchetypes(pack = CANON_ENEMY_ARCHETYPE_PACK, filters = {}) {
  const archetypes = Array.isArray(pack?.archetypes) ? pack.archetypes : [];
  return archetypes.filter((archetype) => matchesArchetypeFilters(archetype, filters));
}

export function getEnemyArchetype(id, pack = CANON_ENEMY_ARCHETYPE_PACK) {
  return listEnemyArchetypes(pack).find((archetype) => archetype.id === id || archetype.assetIdAlias === id) ?? null;
}

export function editableEnemyKnobs(archetypeOrId, pack = CANON_ENEMY_ARCHETYPE_PACK) {
  const archetype = typeof archetypeOrId === 'string' ? getEnemyArchetype(archetypeOrId, pack) : archetypeOrId;
  if (!archetype) return [];
  return Array.isArray(archetype.editable) ? [...archetype.editable] : [];
}

function validateArchetypes(archetypes, errors, warnings) {
  const ids = new Set();
  for (const [index, archetype] of archetypes.entries()) {
    const prefix = `archetypes[${index}]`;
    if (!isPlainObject(archetype)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(archetype.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (ids.has(archetype.id)) {
      errors.push(`${prefix}.id "${archetype.id}" is duplicated.`);
    } else {
      ids.add(archetype.id);
    }
    if (!ENEMY_RUNTIME_FACTORIES.includes(archetype.runtimeFactory)) {
      errors.push(`${prefix}.runtimeFactory must be one of: ${ENEMY_RUNTIME_FACTORIES.join(', ')}.`);
    }
    if (archetype.construct != null && !isNonEmptyString(archetype.construct)) errors.push(`${prefix}.construct must be a non-empty string when provided.`);
    if (archetype.patterns != null && !isStringArray(archetype.patterns)) errors.push(`${prefix}.patterns must be an array of strings when provided.`);
    validateEntry(archetype.entry, `${prefix}.entry`, errors);
    if (archetype.editable != null && !isStringArray(archetype.editable)) errors.push(`${prefix}.editable must be an array of strings when provided.`);
    if (archetype.palette != null && !isPlainObject(archetype.palette)) errors.push(`${prefix}.palette must be an object when provided.`);
    if (archetype.baseArchetype != null && !ids.has(archetype.baseArchetype)) {
      warnings.push(`${prefix}.baseArchetype "${archetype.baseArchetype}" should reference an earlier archetype in the same pack.`);
    }
  }
}

function validateEntry(entry, path, errors) {
  if (!isPlainObject(entry)) {
    errors.push(`${path} must be an object.`);
    return;
  }
  if (!ENEMY_ENTRY_KINDS.includes(entry.kind)) {
    errors.push(`${path}.kind must be one of: ${ENEMY_ENTRY_KINDS.join(', ')}.`);
  }
  if (entry.speed != null && !Number.isFinite(entry.speed)) errors.push(`${path}.speed must be a number when provided.`);
  if (entry.warningLeadSeconds != null && (!Number.isFinite(entry.warningLeadSeconds) || entry.warningLeadSeconds < 0)) {
    errors.push(`${path}.warningLeadSeconds must be a non-negative number when provided.`);
  }
}

function matchesArchetypeFilters(archetype, filters) {
  if (filters.runtimeFactory != null && archetype.runtimeFactory !== filters.runtimeFactory) return false;
  if (filters.editable != null && !(archetype.editable ?? []).includes(filters.editable)) return false;
  if (filters.pattern != null && !(archetype.patterns ?? []).includes(filters.pattern)) return false;
  return true;
}

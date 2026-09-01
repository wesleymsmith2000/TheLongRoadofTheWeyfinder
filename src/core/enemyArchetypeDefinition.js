import canonEnemyArchetypes from '../../content/enemies/prototype0_enemy_archetypes.json' with { type: 'json' };
import { CANON_STATUSES, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';
import { TARGET_CONDITIONS } from './combatEvents.js';

export const CANON_ENEMY_ARCHETYPE_PACK = canonEnemyArchetypes;
export const ENEMY_RUNTIME_FACTORIES = ['createEnemy', 'createEnhancedEnemy', 'createPirateShipEnemy', 'createEnhancedPirateShipEnemy', 'createBossEnemy'];
export const ENEMY_ENTRY_KINDS = ['aheadDrift', 'behindCharge', 'aheadBoss', 'airStrafe', 'zoneAmbush'];
export const ENEMY_MOVEMENT_KINDS = [
  'drift',
  'charge',
  'returnToView',
  'orbitTarget',
  'strafeBroadside',
  'weave',
  'bossTentacleSwarm',
  'phase',
  'hop',
  'flyStrafe',
  'walkerLegs',
  'circleArtillery',
  'carrierRelease',
];
export const ENEMY_AGGREGATE_KINDS = ['singleBody', 'limbArray', 'multiPartBoss'];
export const ENEMY_CELL_ANIMATION_KINDS = ['none', 'opacityPulse', 'sineWave', 'swirl', 'fabricWeave', 'phaseFade', 'legStride', 'wingBeat'];
export const ENEMY_TARGET_CONDITIONS = Object.freeze(Object.values(TARGET_CONDITIONS));

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
    validateMovementProfiles(archetype.movementProfiles, `${prefix}.movementProfiles`, errors);
    validateAggregate(archetype.aggregate, `${prefix}.aggregate`, errors);
    validateCellAnimations(archetype.cellAnimations, `${prefix}.cellAnimations`, errors);
    validateTargeting(archetype.targeting, `${prefix}.targeting`, errors);
    if (archetype.editable != null && !isStringArray(archetype.editable)) errors.push(`${prefix}.editable must be an array of strings when provided.`);
    if (archetype.palette != null && !isPlainObject(archetype.palette)) errors.push(`${prefix}.palette must be an object when provided.`);
    if (archetype.baseArchetype != null && !ids.has(archetype.baseArchetype)) {
      warnings.push(`${prefix}.baseArchetype "${archetype.baseArchetype}" should reference an earlier archetype in the same pack.`);
    }
  }
}

function validateTargeting(targeting, path, errors) {
  if (targeting == null) return;
  if (!isPlainObject(targeting)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  validateTargetConditionArray(targeting.preferConditions, `${path}.preferConditions`, errors);
  validateTargetConditionArray(targeting.requireConditions, `${path}.requireConditions`, errors);
  validateTargetConditionArray(targeting.ignoreConditions, `${path}.ignoreConditions`, errors);
}

function validateTargetConditionArray(conditions, path, errors) {
  if (conditions == null) return;
  if (!Array.isArray(conditions)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, condition] of conditions.entries()) {
    if (!ENEMY_TARGET_CONDITIONS.includes(condition)) {
      errors.push(`${path}[${index}] must be one of: ${ENEMY_TARGET_CONDITIONS.join(', ')}.`);
    }
  }
}

function validateMovementProfiles(profiles, path, errors) {
  if (profiles == null) return;
  if (!Array.isArray(profiles)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, profile] of profiles.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(profile)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(profile.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (!ENEMY_MOVEMENT_KINDS.includes(profile.kind)) errors.push(`${label}.kind must be one of: ${ENEMY_MOVEMENT_KINDS.join(', ')}.`);
    validateOptionalNumber(profile.speed, `${label}.speed`, errors);
    validateOptionalNumber(profile.acceleration, `${label}.acceleration`, errors);
    validateOptionalNumber(profile.amplitude, `${label}.amplitude`, errors);
    validateOptionalNumber(profile.frequency, `${label}.frequency`, errors);
    validateOptionalNumber(profile.phaseOffset, `${label}.phaseOffset`, errors);
    validateOptionalNumber(profile.strength, `${label}.strength`, errors);
    validateOptionalNumber(profile.duration, `${label}.duration`, errors);
    validateOptionalNumber(profile.z, `${label}.z`, errors);
    validateOptionalNumber(profile.minZ, `${label}.minZ`, errors);
    validateOptionalNumber(profile.maxZ, `${label}.maxZ`, errors);
    validateOptionalNumber(profile.hopHeight, `${label}.hopHeight`, errors);
    if (profile.target != null && !isNonEmptyString(profile.target)) errors.push(`${label}.target must be a non-empty string when provided.`);
  }
}

function validateAggregate(aggregate, path, errors) {
  if (aggregate == null) return;
  if (!isPlainObject(aggregate)) {
    errors.push(`${path} must be an object when provided.`);
    return;
  }
  if (!ENEMY_AGGREGATE_KINDS.includes(aggregate.kind)) errors.push(`${path}.kind must be one of: ${ENEMY_AGGREGATE_KINDS.join(', ')}.`);
  if (aggregate.parts == null) return;
  if (!Array.isArray(aggregate.parts)) {
    errors.push(`${path}.parts must be an array when provided.`);
    return;
  }
  for (const [index, part] of aggregate.parts.entries()) {
    const label = `${path}.parts[${index}]`;
    if (!isPlainObject(part)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(part.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (part.role != null && !isNonEmptyString(part.role)) errors.push(`${label}.role must be a non-empty string when provided.`);
    if (part.attachment != null && !isNonEmptyString(part.attachment)) errors.push(`${label}.attachment must be a non-empty string when provided.`);
    if (part.movementProfile != null && !isNonEmptyString(part.movementProfile)) errors.push(`${label}.movementProfile must be a non-empty string when provided.`);
    validateOptionalNumber(part.count, `${label}.count`, errors);
  }
}

function validateCellAnimations(animations, path, errors) {
  if (animations == null) return;
  if (!Array.isArray(animations)) {
    errors.push(`${path} must be an array when provided.`);
    return;
  }
  for (const [index, animation] of animations.entries()) {
    const label = `${path}[${index}]`;
    if (!isPlainObject(animation)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(animation.selector)) errors.push(`${label}.selector must be a non-empty string.`);
    if (!ENEMY_CELL_ANIMATION_KINDS.includes(animation.kind)) errors.push(`${label}.kind must be one of: ${ENEMY_CELL_ANIMATION_KINDS.join(', ')}.`);
    validateOptionalNumber(animation.amplitude, `${label}.amplitude`, errors);
    validateOptionalNumber(animation.frequency, `${label}.frequency`, errors);
    validateOptionalNumber(animation.phaseOffset, `${label}.phaseOffset`, errors);
    validateOptionalNumber(animation.opacityMin, `${label}.opacityMin`, errors);
    validateOptionalNumber(animation.opacityMax, `${label}.opacityMax`, errors);
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
  validateOptionalNumber(entry.speed, `${path}.speed`, errors);
  if (entry.warningLeadSeconds != null && (!Number.isFinite(entry.warningLeadSeconds) || entry.warningLeadSeconds < 0)) {
    errors.push(`${path}.warningLeadSeconds must be a non-negative number when provided.`);
  }
}

function validateOptionalNumber(value, label, errors) {
  if (value != null && !Number.isFinite(value)) errors.push(`${label} must be a number when provided.`);
}

function matchesArchetypeFilters(archetype, filters) {
  if (filters.runtimeFactory != null && archetype.runtimeFactory !== filters.runtimeFactory) return false;
  if (filters.editable != null && !(archetype.editable ?? []).includes(filters.editable)) return false;
  if (filters.pattern != null && !(archetype.patterns ?? []).includes(filters.pattern)) return false;
  return true;
}

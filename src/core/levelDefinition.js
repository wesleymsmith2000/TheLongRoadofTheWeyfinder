import { CANON_STATUSES, CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const LEVEL_SCHEMA_VERSION = CONTENT_SCHEMA_VERSION;
export const LEVEL_BACKGROUND_MODES = ['procedural', 'prebaked', 'mixed'];
export const LEVEL_BACKGROUND_SOURCES = ['procedural', 'image', 'video', 'canvas'];
export const LEVEL_OBSTACLE_KINDS = ['procedural_field', 'construct', 'hazard', 'decor'];
export const LEVEL_TRIGGER_KINDS = ['voiceover', 'cue', 'music', 'scripted_event'];
export const LEVEL_DEPENDENCY_KINDS = ['pack', 'construct', 'weapon', 'pattern', 'behavior', 'encounter', 'route', 'level', 'image', 'sound', 'music', 'voxelModel'];

export function validateLevelDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Level definition must be an object.'], warnings };

  validateMetadata(definition, errors, warnings);
  validateDependencies(definition.dependencies, errors, warnings);
  validateBackground(definition.background, errors, warnings);
  validateRoute(definition.route, errors, warnings);
  validateObstacles(definition.obstacles ?? [], errors, warnings);
  validateWaves(definition.waves ?? [], errors, warnings);
  validateTriggers(definition.triggers ?? [], errors, warnings);

  if ((definition.waves ?? []).length === 0) warnings.push('Level has no enemy waves.');
  if ((definition.route?.segments ?? []).length === 0) warnings.push('Level has no route segments.');
  return { valid: errors.length === 0, errors, warnings };
}

export function collectLevelDependencies(definition) {
  const explicit = Array.isArray(definition.dependencies) ? definition.dependencies : [];
  const dependencies = explicit.map(normalizeDependency).filter(Boolean);
  for (const wave of definition.waves ?? []) {
    for (const spawn of wave.spawn ?? []) {
      if (spawn.construct) dependencies.push({ kind: 'construct', assetId: spawn.construct, required: true });
      for (const pattern of spawn.patterns ?? []) dependencies.push({ kind: 'pattern', assetId: pattern, required: true });
      if (spawn.behavior) dependencies.push({ kind: 'behavior', assetId: spawn.behavior, required: true });
    }
  }
  for (const layer of definition.background?.layers ?? []) {
    if (layer.assetRef) dependencies.push({ kind: layer.kind ?? 'image', assetId: layer.assetRef, required: layer.required === true });
  }
  for (const obstacle of definition.obstacles ?? []) {
    if (obstacle.assetRef) dependencies.push({ kind: obstacle.kind === 'construct' ? 'construct' : 'voxelModel', assetId: obstacle.assetRef, required: obstacle.kind === 'construct' || obstacle.required === true });
  }
  for (const trigger of definition.triggers ?? []) {
    if (trigger.assetRef) dependencies.push({ kind: trigger.kind === 'music' ? 'music' : 'sound', assetId: trigger.assetRef, required: trigger.required === true });
  }
  return uniqueDependencies(dependencies);
}

export function createLevelPackagePlan(definition) {
  const report = validateLevelDefinition(definition);
  if (!report.valid) {
    throw new Error(`Invalid level "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  }
  return {
    levelId: definition.assetId,
    dependencies: collectLevelDependencies(definition),
    assetGroups: {
      simulation: ['construct', 'weapon', 'pattern', 'behavior', 'encounter', 'route', 'level'],
      resources: ['image', 'sound', 'music', 'voxelModel'],
      packs: ['pack'],
    },
  };
}

function validateMetadata(definition, errors, warnings) {
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported level schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (definition.canonStatus != null && !CANON_STATUSES.includes(definition.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  if (definition.tags != null && !isStringArray(definition.tags)) warnings.push('tags should be an array of strings.');
}

function validateDependencies(dependencies, errors, warnings) {
  if (dependencies == null) return;
  if (!Array.isArray(dependencies)) {
    errors.push('dependencies must be an array when provided.');
    return;
  }
  for (const [index, dependency] of dependencies.entries()) {
    const label = `dependencies[${index}]`;
    const normalized = normalizeDependency(dependency);
    if (!normalized) {
      errors.push(`${label} must be a string or dependency object.`);
      continue;
    }
    if (!LEVEL_DEPENDENCY_KINDS.includes(normalized.kind)) errors.push(`${label}.kind must be one of: ${LEVEL_DEPENDENCY_KINDS.join(', ')}.`);
    if (!isNonEmptyString(normalized.assetId) && !isNonEmptyString(normalized.packId)) errors.push(`${label} must include assetId or packId.`);
  }
  const packDependencies = dependencies.map(normalizeDependency).filter((dependency) => dependency?.kind === 'pack');
  if (packDependencies.length > 0) warnings.push('Pack dependency resolution is declared but not implemented in Prototype 0.');
}

function validateBackground(background, errors, warnings) {
  if (!isPlainObject(background)) {
    errors.push('background must be an object.');
    return;
  }
  if (!LEVEL_BACKGROUND_MODES.includes(background.mode)) errors.push(`background.mode must be one of: ${LEVEL_BACKGROUND_MODES.join(', ')}.`);
  if (!Array.isArray(background.layers)) {
    errors.push('background.layers must be an array.');
    return;
  }
  if (background.layers.length === 0) warnings.push('Level background has no layers.');
  for (const [index, layer] of background.layers.entries()) {
    const label = `background.layers[${index}]`;
    if (!isPlainObject(layer)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(layer.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (!LEVEL_BACKGROUND_SOURCES.includes(layer.source)) errors.push(`${label}.source must be one of: ${LEVEL_BACKGROUND_SOURCES.join(', ')}.`);
    if (layer.source === 'procedural' && !isNonEmptyString(layer.generator)) errors.push(`${label}.generator is required for procedural layers.`);
    if (layer.source !== 'procedural' && !isNonEmptyString(layer.assetRef)) errors.push(`${label}.assetRef is required for prebaked layers.`);
    validateFiniteNumber(layer.parallax ?? 1, `${label}.parallax`, errors, { min: 0 });
  }
}

function validateRoute(route, errors) {
  if (!isPlainObject(route)) {
    errors.push('route must be an object.');
    return;
  }
  validateFiniteNumber(route.startHeading ?? 0, 'route.startHeading', errors);
  if (!Array.isArray(route.segments)) {
    errors.push('route.segments must be an array.');
    return;
  }
  for (const [index, segment] of route.segments.entries()) {
    const label = `route.segments[${index}]`;
    if (!isPlainObject(segment)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(segment.id)) errors.push(`${label}.id must be a non-empty string.`);
    validateFiniteNumber(segment.length, `${label}.length`, errors, { min: 1 });
    validateFiniteNumber(segment.turnRadians ?? 0, `${label}.turnRadians`, errors);
  }
}

function validateObstacles(obstacles, errors, warnings) {
  if (!Array.isArray(obstacles)) {
    errors.push('obstacles must be an array when provided.');
    return;
  }
  for (const [index, obstacle] of obstacles.entries()) {
    const label = `obstacles[${index}]`;
    if (!isPlainObject(obstacle)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(obstacle.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (!LEVEL_OBSTACLE_KINDS.includes(obstacle.kind)) errors.push(`${label}.kind must be one of: ${LEVEL_OBSTACLE_KINDS.join(', ')}.`);
    validateFiniteNumber(obstacle.atDistance, `${label}.atDistance`, errors, { min: 0 });
    validateFiniteNumber(obstacle.laneOffset ?? 0, `${label}.laneOffset`, errors);
    if (obstacle.kind !== 'procedural_field' && !isNonEmptyString(obstacle.assetRef)) warnings.push(`${label} should reference a resource or construct asset.`);
  }
}

function validateWaves(waves, errors) {
  if (!Array.isArray(waves)) {
    errors.push('waves must be an array when provided.');
    return;
  }
  for (const [index, wave] of waves.entries()) {
    const label = `waves[${index}]`;
    if (!isPlainObject(wave)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(wave.id)) errors.push(`${label}.id must be a non-empty string.`);
    validateFiniteNumber(wave.atDistance, `${label}.atDistance`, errors, { min: 0 });
    if (!Array.isArray(wave.spawn) || wave.spawn.length === 0) {
      errors.push(`${label}.spawn must be a non-empty array.`);
      continue;
    }
    for (const [spawnIndex, spawn] of wave.spawn.entries()) validateSpawn(spawn, `${label}.spawn[${spawnIndex}]`, errors);
  }
}

function validateSpawn(spawn, label, errors) {
  if (!isPlainObject(spawn)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (!isNonEmptyString(spawn.construct)) errors.push(`${label}.construct must be a non-empty string.`);
  validateFiniteNumber(spawn.count, `${label}.count`, errors, { integer: true, min: 1 });
  validateFiniteNumber(spawn.laneOffset ?? 0, `${label}.laneOffset`, errors);
  validateFiniteNumber(spawn.spacing ?? 0, `${label}.spacing`, errors, { min: 0 });
  if (spawn.patterns != null && !isStringArray(spawn.patterns)) errors.push(`${label}.patterns must be an array of strings when provided.`);
}

function validateTriggers(triggers, errors, warnings) {
  if (!Array.isArray(triggers)) {
    errors.push('triggers must be an array when provided.');
    return;
  }
  for (const [index, trigger] of triggers.entries()) {
    const label = `triggers[${index}]`;
    if (!isPlainObject(trigger)) {
      errors.push(`${label} must be an object.`);
      continue;
    }
    if (!isNonEmptyString(trigger.id)) errors.push(`${label}.id must be a non-empty string.`);
    if (!LEVEL_TRIGGER_KINDS.includes(trigger.kind)) errors.push(`${label}.kind must be one of: ${LEVEL_TRIGGER_KINDS.join(', ')}.`);
    validateFiniteNumber(trigger.atDistance, `${label}.atDistance`, errors, { min: 0 });
    if (trigger.kind === 'voiceover' && !isNonEmptyString(trigger.assetRef)) warnings.push(`${label} voiceover trigger should reference an audio asset.`);
  }
}

function normalizeDependency(dependency) {
  if (typeof dependency === 'string') return { kind: 'pack', packId: dependency };
  if (!isPlainObject(dependency)) return null;
  return {
    kind: dependency.kind,
    assetId: dependency.assetId,
    packId: dependency.packId,
    required: dependency.required !== false,
  };
}

function uniqueDependencies(dependencies) {
  const byKey = new Map();
  const unique = [];
  for (const dependency of dependencies) {
    const key = `${dependency.kind}:${dependency.assetId ?? dependency.packId}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.required = existing.required !== false || dependency.required !== false;
      continue;
    }
    byKey.set(key, dependency);
    unique.push(dependency);
  }
  return unique;
}

function validateFiniteNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.integer && !Number.isInteger(value)) errors.push(`${label} must be an integer.`);
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}

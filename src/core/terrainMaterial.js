import { CONTENT_SCHEMA_VERSION, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';

export const SAFE_TERRAIN_MATERIAL = Object.freeze({
  schemaVersion: CONTENT_SCHEMA_VERSION,
  assetId: 'terrain.material.safe_default',
  materialId: 'safe.default',
  displayName: 'Safe Default Ground',
  physics: Object.freeze({
    traction: 1,
    rollingResistance: 0.05,
    roughness: 0,
  }),
  systems: Object.freeze({
    thermalFlux: 0,
    ignitionRisk: 0,
    conductivity: 0,
  }),
  hazardTags: Object.freeze([]),
});

export const SAFE_TERRAIN_SAMPLE = Object.freeze({
  materialId: SAFE_TERRAIN_MATERIAL.materialId,
  traction: SAFE_TERRAIN_MATERIAL.physics.traction,
  rollingResistance: SAFE_TERRAIN_MATERIAL.physics.rollingResistance,
  roughness: SAFE_TERRAIN_MATERIAL.physics.roughness,
  height: 0,
  fluidType: 'none',
  fluidDepth: 0,
  thermalFlux: SAFE_TERRAIN_MATERIAL.systems.thermalFlux,
  ignitionRisk: SAFE_TERRAIN_MATERIAL.systems.ignitionRisk,
  conductivity: SAFE_TERRAIN_MATERIAL.systems.conductivity,
  hazardTags: SAFE_TERRAIN_MATERIAL.hazardTags,
});

export function validateTerrainMaterialDefinition(definition) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Terrain material definition must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported terrain material schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(definition.materialId)) errors.push('materialId must be a non-empty string.');
  validatePhysics(definition.physics, errors);
  validateSystems(definition.systems, errors);
  if (definition.hazardTags != null && !isStringArray(definition.hazardTags)) errors.push('hazardTags must be an array of strings when provided.');
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeTerrainMaterialDefinition(definition) {
  const report = validateTerrainMaterialDefinition(definition);
  if (!report.valid) throw new Error(`Invalid terrain material "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  return deepFreeze({
    schemaVersion: definition.schemaVersion,
    assetId: definition.assetId,
    materialId: definition.materialId,
    displayName: definition.displayName ?? definition.materialId,
    physics: {
      traction: finiteOrDefault(definition.physics?.traction, SAFE_TERRAIN_MATERIAL.physics.traction),
      rollingResistance: finiteOrDefault(definition.physics?.rollingResistance, SAFE_TERRAIN_MATERIAL.physics.rollingResistance),
      roughness: finiteOrDefault(definition.physics?.roughness, SAFE_TERRAIN_MATERIAL.physics.roughness),
    },
    systems: {
      thermalFlux: finiteOrDefault(definition.systems?.thermalFlux, SAFE_TERRAIN_MATERIAL.systems.thermalFlux),
      ignitionRisk: finiteOrDefault(definition.systems?.ignitionRisk, SAFE_TERRAIN_MATERIAL.systems.ignitionRisk),
      conductivity: finiteOrDefault(definition.systems?.conductivity, SAFE_TERRAIN_MATERIAL.systems.conductivity),
    },
    hazardTags: [...(definition.hazardTags ?? [])],
  });
}

export function createTerrainMaterialLookup(definitions = []) {
  const lookup = new Map([[SAFE_TERRAIN_MATERIAL.materialId, SAFE_TERRAIN_MATERIAL]]);
  for (const definition of definitions) {
    const material = normalizeTerrainMaterialDefinition(definition);
    lookup.set(material.materialId, material);
  }
  return lookup;
}

export function materialToSample(material = SAFE_TERRAIN_MATERIAL, overrides = {}) {
  return {
    materialId: material.materialId,
    traction: material.physics.traction,
    rollingResistance: material.physics.rollingResistance,
    roughness: material.physics.roughness,
    height: 0,
    fluidType: 'none',
    fluidDepth: 0,
    thermalFlux: material.systems.thermalFlux,
    ignitionRisk: material.systems.ignitionRisk,
    conductivity: material.systems.conductivity,
    hazardTags: material.hazardTags,
    ...overrides,
  };
}

function validatePhysics(physics, errors) {
  if (!isPlainObject(physics)) {
    errors.push('physics must be an object.');
    return;
  }
  validateFiniteNumber(physics.traction, 'physics.traction', errors, { min: 0 });
  validateFiniteNumber(physics.rollingResistance, 'physics.rollingResistance', errors, { min: 0 });
  validateFiniteNumber(physics.roughness, 'physics.roughness', errors, { min: 0 });
}

function validateSystems(systems, errors) {
  if (systems == null) return;
  if (!isPlainObject(systems)) {
    errors.push('systems must be an object when provided.');
    return;
  }
  validateFiniteNumber(systems.thermalFlux ?? 0, 'systems.thermalFlux', errors);
  validateFiniteNumber(systems.ignitionRisk ?? 0, 'systems.ignitionRisk', errors, { min: 0 });
  validateFiniteNumber(systems.conductivity ?? 0, 'systems.conductivity', errors, { min: 0 });
}

function validateFiniteNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

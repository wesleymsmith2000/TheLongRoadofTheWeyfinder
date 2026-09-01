import { isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';
import { DEFAULT_TERRAIN_CONFIG } from './terrainConfig.js';

export const TERRAIN_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);
export const ROAD_SOCKET_VALUES = Object.freeze(['closed', 'standard', 'wide']);
export const FLUID_SOCKET_PATTERN = /^(none|open:[a-z0-9_.-]+)$/;

export function validateTerrainTileDefinition(definition, options = {}) {
  const config = options.config ?? DEFAULT_TERRAIN_CONFIG;
  const errors = [];
  const warnings = [];
  if (!isPlainObject(definition)) return { valid: false, errors: ['Terrain tile definition must be an object.'], warnings };
  if (!isCompatibleSchemaVersion(definition.schemaVersion)) {
    errors.push(`Unsupported terrain tile schemaVersion "${definition.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(definition.assetId)) errors.push('assetId must be a non-empty string.');
  if (!isNonEmptyString(definition.biome)) errors.push('biome must be a non-empty string.');
  validateRotations(definition.allowedRotations, errors);
  validateSockets(definition.sockets, errors);
  validateRender(definition.render, errors);
  validateSemantic(definition.semantic, errors, config);
  if (definition.tags != null && !isStringArray(definition.tags)) errors.push('tags must be an array of strings when provided.');
  if (definition.weight != null) validateFiniteNumber(definition.weight, 'weight', errors, { min: 0 });
  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeTerrainTileDefinition(definition, options = {}) {
  const config = options.config ?? DEFAULT_TERRAIN_CONFIG;
  const report = validateTerrainTileDefinition(definition, { config });
  if (!report.valid) throw new Error(`Invalid terrain tile "${definition?.assetId ?? 'unknown'}": ${report.errors.join(' ')}`);
  return deepFreeze({
    schemaVersion: definition.schemaVersion,
    assetId: definition.assetId,
    biome: definition.biome,
    allowedRotations: [...definition.allowedRotations],
    sockets: structuredClone(definition.sockets),
    render: {
      baseAsset: definition.render?.baseAsset ?? null,
      animatedLayers: [...(definition.render?.animatedLayers ?? [])],
    },
    semantic: {
      materialGrid: normalizeMaterialGrid(definition.semantic?.materialGrid, config),
      heightGrid: normalizeOptionalGrid(definition.semantic?.heightGrid, 0, config),
      fluidGrid: normalizeOptionalGrid(definition.semantic?.fluidGrid, null, config),
    },
    decorSockets: [...(definition.decorSockets ?? [])],
    eventSockets: [...(definition.eventSockets ?? [])],
    intrinsicHazards: [...(definition.intrinsicHazards ?? [])],
    tags: [...(definition.tags ?? [])],
    weight: definition.weight ?? 1,
  });
}

export function createTileVariants(definitions, options = {}) {
  const variants = [];
  for (const definition of definitions) {
    const tile = normalizeTerrainTileDefinition(definition, options);
    for (const rotation of tile.allowedRotations) {
      variants.push(
        deepFreeze({
          sourceAssetId: tile.assetId,
          assetId: `${tile.assetId}@${rotation}`,
          biome: tile.biome,
          rotation,
          sockets: rotateSockets(tile.sockets, rotation),
          render: tile.render,
          semantic: {
            materialGrid: rotateGrid(tile.semantic.materialGrid, rotation),
            heightGrid: rotateGrid(tile.semantic.heightGrid, rotation),
            fluidGrid: rotateGrid(tile.semantic.fluidGrid, rotation),
          },
          decorSockets: tile.decorSockets,
          eventSockets: tile.eventSockets,
          intrinsicHazards: tile.intrinsicHazards,
          tags: tile.tags,
          weight: tile.weight,
        }),
      );
    }
  }
  return variants;
}

export function tileMatchesRoadSockets(tile, requiredRoadSockets) {
  return TERRAIN_DIRECTIONS.every((direction) => (requiredRoadSockets[direction] ?? 'closed') === (tile.sockets[direction]?.road ?? 'closed'));
}

export function rotateSockets(sockets, rotation) {
  const steps = rotationSteps(rotation);
  const rotated = {};
  for (const [index, direction] of TERRAIN_DIRECTIONS.entries()) {
    rotated[TERRAIN_DIRECTIONS[(index + steps) % TERRAIN_DIRECTIONS.length]] = structuredClone(sockets[direction]);
  }
  return rotated;
}

export function rotateGrid(grid, rotation) {
  let rotated = structuredClone(grid);
  for (let step = 0; step < rotationSteps(rotation); step += 1) rotated = rotateGridClockwise(rotated);
  return rotated;
}

function validateRotations(rotations, errors) {
  if (!Array.isArray(rotations) || rotations.length === 0) {
    errors.push('allowedRotations must be a non-empty array.');
    return;
  }
  for (const rotation of rotations) {
    if (![0, 90, 180, 270].includes(rotation)) errors.push('allowedRotations may only include 0, 90, 180, or 270.');
  }
}

function validateSockets(sockets, errors) {
  if (!isPlainObject(sockets)) {
    errors.push('sockets must be an object.');
    return;
  }
  for (const direction of TERRAIN_DIRECTIONS) {
    const socket = sockets[direction];
    if (!isPlainObject(socket)) {
      errors.push(`sockets.${direction} must be an object.`);
      continue;
    }
    if (!ROAD_SOCKET_VALUES.includes(socket.road)) errors.push(`sockets.${direction}.road must be one of: ${ROAD_SOCKET_VALUES.join(', ')}.`);
    if (![0, 1, 2, -1].includes(socket.height)) errors.push(`sockets.${direction}.height must be one of: 0, 1, 2, -1.`);
    if (typeof socket.fluid !== 'string' || !FLUID_SOCKET_PATTERN.test(socket.fluid)) {
      errors.push(`sockets.${direction}.fluid must be "none" or "open:<channel>".`);
    }
  }
}

function validateRender(render, errors) {
  if (render == null) return;
  if (!isPlainObject(render)) {
    errors.push('render must be an object when provided.');
    return;
  }
  if (render.baseAsset != null && !isNonEmptyString(render.baseAsset)) errors.push('render.baseAsset must be a non-empty string when provided.');
  if (render.animatedLayers != null && !Array.isArray(render.animatedLayers)) errors.push('render.animatedLayers must be an array when provided.');
}

function validateSemantic(semantic, errors, config) {
  if (!isPlainObject(semantic)) {
    errors.push('semantic must be an object.');
    return;
  }
  validateGrid(semantic.materialGrid, 'semantic.materialGrid', errors, config, isNonEmptyString);
  if (semantic.heightGrid?.length) validateGrid(semantic.heightGrid, 'semantic.heightGrid', errors, config, (value) => Number.isFinite(value));
  if (semantic.fluidGrid?.length) validateGrid(semantic.fluidGrid, 'semantic.fluidGrid', errors, config, (value) => value == null || typeof value === 'string' || isPlainObject(value));
}

function validateGrid(grid, label, errors, config, predicate) {
  if (!Array.isArray(grid) || grid.length !== config.subcellsPerTile) {
    errors.push(`${label} must be a ${config.subcellsPerTile}x${config.subcellsPerTile} array.`);
    return;
  }
  for (const [rowIndex, row] of grid.entries()) {
    if (!Array.isArray(row) || row.length !== config.subcellsPerTile) {
      errors.push(`${label}[${rowIndex}] must contain ${config.subcellsPerTile} entries.`);
      continue;
    }
    row.forEach((value, columnIndex) => {
      if (!predicate(value)) errors.push(`${label}[${rowIndex}][${columnIndex}] is invalid.`);
    });
  }
}

function normalizeMaterialGrid(grid, config) {
  if (grid?.length) return structuredClone(grid);
  return Array.from({ length: config.subcellsPerTile }, () => Array.from({ length: config.subcellsPerTile }, () => 'safe.default'));
}

function normalizeOptionalGrid(grid, fallback, config) {
  if (grid?.length) return structuredClone(grid);
  return Array.from({ length: config.subcellsPerTile }, () => Array.from({ length: config.subcellsPerTile }, () => fallback));
}

function rotationSteps(rotation) {
  return (((rotation / 90) % 4) + 4) % 4;
}

function rotateGridClockwise(grid) {
  const size = grid.length;
  return Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => grid[size - 1 - x][y]));
}

function validateFiniteNumber(value, label, errors, options = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return;
  }
  if (options.min != null && value < options.min) errors.push(`${label} must be at least ${options.min}.`);
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

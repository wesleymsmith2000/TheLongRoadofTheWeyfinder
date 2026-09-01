export const DEFAULT_TERRAIN_CONFIG = Object.freeze({
  chunkSize: 512,
  tileSize: 32,
  subcellsPerTile: 4,
  activeRadiusChunks: 1,
  pregenerateAheadChunks: 2,
  routePadding: 2048,
  routeFallbackLength: 48000,
});

export function normalizeTerrainConfig(config = {}) {
  const normalized = {
    ...DEFAULT_TERRAIN_CONFIG,
    ...config,
  };
  for (const key of ['chunkSize', 'tileSize', 'subcellsPerTile', 'activeRadiusChunks', 'pregenerateAheadChunks', 'routePadding', 'routeFallbackLength']) {
    if (!Number.isFinite(normalized[key]) || normalized[key] <= 0) {
      throw new Error(`terrain config ${key} must be a positive number.`);
    }
  }
  if (!Number.isInteger(normalized.chunkSize) || !Number.isInteger(normalized.tileSize)) {
    throw new Error('terrain config chunkSize and tileSize must be integers.');
  }
  if (normalized.chunkSize % normalized.tileSize !== 0) {
    throw new Error('terrain config chunkSize must be divisible by tileSize.');
  }
  if (!Number.isInteger(normalized.subcellsPerTile)) {
    throw new Error('terrain config subcellsPerTile must be an integer.');
  }
  return Object.freeze(normalized);
}

export function tilesPerChunk(config = DEFAULT_TERRAIN_CONFIG) {
  return config.chunkSize / config.tileSize;
}

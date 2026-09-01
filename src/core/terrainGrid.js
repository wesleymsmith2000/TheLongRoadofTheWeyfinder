import { DEFAULT_TERRAIN_CONFIG, tilesPerChunk } from './terrainConfig.js';

export function terrainChunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

export function worldToTerrainAddress(worldX, worldY, config = DEFAULT_TERRAIN_CONFIG) {
  const chunkX = Math.floor(worldX / config.chunkSize);
  const chunkY = Math.floor(worldY / config.chunkSize);
  const chunkOriginX = chunkX * config.chunkSize;
  const chunkOriginY = chunkY * config.chunkSize;
  const localX = worldX - chunkOriginX;
  const localY = worldY - chunkOriginY;
  const tileX = Math.floor(localX / config.tileSize);
  const tileY = Math.floor(localY / config.tileSize);
  const worldTileX = chunkX * tilesPerChunk(config) + tileX;
  const worldTileY = chunkY * tilesPerChunk(config) + tileY;
  const tileLocalX = localX - tileX * config.tileSize;
  const tileLocalY = localY - tileY * config.tileSize;
  const subcellSize = config.tileSize / config.subcellsPerTile;
  const subcellX = clampIndex(Math.floor(tileLocalX / subcellSize), config.subcellsPerTile);
  const subcellY = clampIndex(Math.floor(tileLocalY / subcellSize), config.subcellsPerTile);
  return {
    chunkX,
    chunkY,
    chunkKey: terrainChunkKey(chunkX, chunkY),
    chunkOriginX,
    chunkOriginY,
    localX,
    localY,
    tileX,
    tileY,
    worldTileX,
    worldTileY,
    tileLocalX,
    tileLocalY,
    subcellX,
    subcellY,
  };
}

export function tileWorldBounds(worldTileX, worldTileY, config = DEFAULT_TERRAIN_CONFIG) {
  return {
    x: worldTileX * config.tileSize,
    y: worldTileY * config.tileSize,
    width: config.tileSize,
    height: config.tileSize,
  };
}

function clampIndex(value, size) {
  return Math.max(0, Math.min(size - 1, value));
}

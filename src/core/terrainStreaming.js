import { roadForward } from './camera.js';
import { generateTerrainChunk } from './terrainGenerator.js';
import { terrainChunkKey } from './terrainGrid.js';

export function createTerrainState(generator) {
  return {
    generator,
    chunks: new Map(),
    stats: {
      generatedChunks: 0,
      retiredChunks: 0,
    },
  };
}

export function updateTerrainStreaming(terrain, camera) {
  if (!terrain?.generator || !camera) return terrain;
  const config = terrain.generator.config;
  const centerX = Math.floor(camera.x / config.chunkSize);
  const centerY = Math.floor(camera.y / config.chunkSize);
  const activeKeys = new Set();
  for (let y = centerY - config.activeRadiusChunks; y <= centerY + config.activeRadiusChunks; y += 1) {
    for (let x = centerX - config.activeRadiusChunks; x <= centerX + config.activeRadiusChunks; x += 1) {
      activeKeys.add(terrainChunkKey(x, y));
      getTerrainChunk(terrain, x, y);
    }
  }

  const forward = roadForward(camera);
  for (let index = 1; index <= config.pregenerateAheadChunks; index += 1) {
    const aheadX = centerX + Math.round(forward.x * index);
    const aheadY = centerY + Math.round(forward.y * index);
    activeKeys.add(terrainChunkKey(aheadX, aheadY));
    getTerrainChunk(terrain, aheadX, aheadY);
  }

  for (const [key, chunk] of terrain.chunks.entries()) {
    if (activeKeys.has(key)) continue;
    releaseTerrainChunk(chunk);
    terrain.chunks.delete(key);
    terrain.stats.retiredChunks += 1;
  }
  return terrain;
}

export function getTerrainChunk(terrain, chunkX, chunkY) {
  const key = terrainChunkKey(chunkX, chunkY);
  let chunk = terrain.chunks.get(key);
  if (!chunk) {
    chunk = generateTerrainChunk(terrain.generator, chunkX, chunkY);
    terrain.chunks.set(key, chunk);
    terrain.stats.generatedChunks += 1;
  }
  return chunk;
}

export function releaseTerrainChunk(chunk) {
  chunk.cache = null;
}

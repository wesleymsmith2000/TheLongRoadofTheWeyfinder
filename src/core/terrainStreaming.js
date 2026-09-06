import { roadForward } from './camera.js';
import { generateTerrainChunk } from './terrainGenerator.js';
import { terrainChunkKey } from './terrainGrid.js';

export function createTerrainState(generator, options = {}) {
  return {
    generator,
    chunks: new Map(),
    maxGeneratedChunksPerUpdate: options.maxGeneratedChunksPerUpdate ?? Infinity,
    stats: {
      generatedChunks: 0,
      generatedLastUpdate: 0,
      pendingChunks: 0,
      retiredChunks: 0,
    },
  };
}

export function updateTerrainStreaming(terrain, camera, options = {}) {
  if (!terrain?.generator || !camera) return terrain;
  const config = terrain.generator.config;
  const centerX = Math.floor(camera.x / config.chunkSize);
  const centerY = Math.floor(camera.y / config.chunkSize);
  const activeKeys = new Set();
  const requestedChunks = [];
  const requestedKeys = new Set();
  const queueChunk = (x, y) => {
    const key = terrainChunkKey(x, y);
    activeKeys.add(key);
    if (!terrain.chunks.has(key) && !requestedKeys.has(key)) {
      requestedKeys.add(key);
      requestedChunks.push({ x, y, distance: (x - centerX) ** 2 + (y - centerY) ** 2 });
    }
  };

  for (let y = centerY - config.activeRadiusChunks; y <= centerY + config.activeRadiusChunks; y += 1) {
    for (let x = centerX - config.activeRadiusChunks; x <= centerX + config.activeRadiusChunks; x += 1) {
      queueChunk(x, y);
    }
  }

  const forward = roadForward(camera);
  for (let index = 1; index <= config.pregenerateAheadChunks; index += 1) {
    const aheadX = centerX + Math.round(forward.x * index);
    const aheadY = centerY + Math.round(forward.y * index);
    queueChunk(aheadX, aheadY);
  }

  requestedChunks.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  const requestedBudget = Math.max(0, options.maxGeneratedChunks ?? terrain.maxGeneratedChunksPerUpdate ?? Infinity);
  const budget = Number.isFinite(requestedBudget) ? Math.floor(requestedBudget) : requestedBudget;
  const generateCount = Math.min(requestedChunks.length, budget);
  terrain.stats.generatedLastUpdate = 0;
  terrain.stats.pendingChunks = Math.max(0, requestedChunks.length - generateCount);
  for (let index = 0; index < generateCount; index += 1) {
    getTerrainChunk(terrain, requestedChunks[index].x, requestedChunks[index].y);
    terrain.stats.generatedLastUpdate += 1;
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

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
  const windowPlan = terrainStreamWindowPlan(terrain, camera, centerX, centerY);
  const requestedBudget = Math.max(0, options.maxGeneratedChunks ?? terrain.maxGeneratedChunksPerUpdate ?? Infinity);
  const budget = Number.isFinite(requestedBudget) ? Math.floor(requestedBudget) : requestedBudget;
  let generated = 0;
  let pending = 0;
  for (const chunk of windowPlan.requestedChunks) {
    if (terrain.chunks.has(chunk.key)) continue;
    if (generated < budget) {
      getTerrainChunk(terrain, chunk.x, chunk.y);
      generated += 1;
    } else {
      pending += 1;
    }
  }
  terrain.stats.generatedLastUpdate = generated;
  terrain.stats.pendingChunks = pending;

  for (const [key, chunk] of terrain.chunks.entries()) {
    if (windowPlan.activeKeys.has(key)) continue;
    releaseTerrainChunk(chunk);
    terrain.chunks.delete(key);
    terrain.stats.retiredChunks += 1;
  }
  return terrain;
}

function terrainStreamWindowPlan(terrain, camera, centerX, centerY) {
  const config = terrain.generator.config;
  const forward = roadForward(camera);
  const aheadOffsets = [];
  for (let index = 1; index <= config.pregenerateAheadChunks; index += 1) {
    aheadOffsets.push([Math.round(forward.x * index), Math.round(forward.y * index)]);
  }
  const key = [
    centerX,
    centerY,
    config.activeRadiusChunks,
    config.pregenerateAheadChunks,
    ...aheadOffsets.map(([x, y]) => `${x},${y}`),
  ].join(':');
  if (terrain.streamWindow?.key === key) return terrain.streamWindow;

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

  for (const [x, y] of aheadOffsets) {
    queueChunk(centerX + x, centerY + y);
  }

  requestedChunks.sort((a, b) => a.distance - b.distance || a.y - b.y || a.x - b.x);
  terrain.streamWindow = {
    key,
    activeKeys,
    requestedChunks: requestedChunks.map((chunk) => ({
      ...chunk,
      key: terrainChunkKey(chunk.x, chunk.y),
    })),
  };
  return terrain.streamWindow;
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

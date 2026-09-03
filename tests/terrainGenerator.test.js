import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultGhostForestTerrainContent, createTerrainGenerator, generateTerrainChunk } from '../src/core/terrainGenerator.js';
import { worldToTerrainAddress } from '../src/core/terrainGrid.js';
import { sampleTerrain } from '../src/core/terrainQuery.js';
import { createTerrainState, getTerrainChunk, updateTerrainStreaming } from '../src/core/terrainStreaming.js';

test('terrain generation is deterministic for the same seed and chunk', () => {
  const first = generateTerrainChunk(createTerrainGenerator({ seed: 22 }), 0, -1);
  const second = generateTerrainChunk(createTerrainGenerator({ seed: 22 }), 0, -1);
  assert.deepEqual(tileIds(first), tileIds(second));
});

test('generated route road sockets match adjacent road tiles', () => {
  const chunk = generateTerrainChunk(createTerrainGenerator({ seed: 22 }), 0, -1);
  const roadTiles = chunk.tiles.flat().filter((tile) => tile.tags.includes('road'));
  assert.equal(roadTiles.length > 0, true);
  for (const tile of roadTiles) {
    if (tile.sockets.north.road === 'standard') assert.equal(tile.requiredRoadSockets.north, 'standard');
    if (tile.sockets.south.road === 'standard') assert.equal(tile.requiredRoadSockets.south, 'standard');
  }
});

test('no-solution road socket combinations use deterministic fallback', () => {
  const content = createDefaultGhostForestTerrainContent();
  const generator = createTerrainGenerator({
    seed: 7,
    content: { materials: content.materials, tiles: content.tiles.filter((tile) => !tile.tags?.includes('road')) },
  });
  const chunks = [generateTerrainChunk(generator, 0, -1), generateTerrainChunk(generator, 0, 0)];
  const fallback = chunks.flatMap((chunk) => chunk.tiles.flat()).find((tile) => tile.fallback);
  assert.equal(Boolean(fallback), true);
  assert.equal(fallback.sourceAssetId, 'terrain.tile.fallback_road');
});

test('procedural terrain route stamps connected turn tiles', () => {
  const generator = createTerrainGenerator({
    seed: 22,
    route: {
      startX: 0,
      startY: 0,
      startHeading: 0,
      routePadding: 0,
      segments: [
        { id: 'test.straight', length: 96, turnRadians: 0 },
        { id: 'test.turn', length: 192, turnRadians: Math.PI / 2 },
      ],
    },
  });
  const chunks = [
    generateTerrainChunk(generator, -1, -1),
    generateTerrainChunk(generator, 0, -1),
    generateTerrainChunk(generator, 1, -1),
  ];
  const turnTiles = chunks
    .flatMap((chunk) => chunk.tiles.flat())
    .filter((tile) => {
      const sockets = tile.requiredRoadSockets;
      const northSouth = sockets.north !== 'closed' || sockets.south !== 'closed';
      const eastWest = sockets.east !== 'closed' || sockets.west !== 'closed';
      return tile.tags.includes('road') && northSouth && eastWest;
    });
  assert.equal(turnTiles.length > 0, true);
  assert.equal(generator.debugLog.length, 0);
});

test('world terrain addressing supports negatives and exact boundaries', () => {
  const address = worldToTerrainAddress(-1, -32);
  assert.equal(address.chunkX, -1);
  assert.equal(address.chunkY, -1);
  assert.equal(address.worldTileY, -1);
  assert.equal(worldToTerrainAddress(32, 32).worldTileX, 1);
});

test('sampleTerrain returns material data and never undefined terrain physics', () => {
  const terrain = createTerrainState(createTerrainGenerator({ seed: 22 }));
  const normal = sampleTerrain(terrain, 16, -48);
  assert.equal(Number.isFinite(normal.traction), true);
  assert.equal(Number.isFinite(normal.rollingResistance), true);

  const slippery = sampleTerrain(terrain, 16, -608);
  assert.equal(slippery.materialId, 'ghost_forest.slippery_moss');
  assert.equal(slippery.traction < normal.traction, true);
});

test('streamed chunks retire and regenerate identically', () => {
  const terrain = createTerrainState(createTerrainGenerator({ seed: 33 }));
  const first = getTerrainChunk(terrain, 0, -1);
  const firstIds = tileIds(first);
  updateTerrainStreaming(terrain, { x: 4096, y: 4096, heading: 0 });
  assert.equal(terrain.chunks.has('0,-1'), false);
  const regenerated = getTerrainChunk(terrain, 0, -1);
  assert.deepEqual(tileIds(regenerated), firstIds);
});

function tileIds(chunk) {
  return chunk.tiles.map((row) => row.map((tile) => `${tile.sourceAssetId}:${tile.rotation}:${tile.fallback ? 'fallback' : 'authored'}`));
}

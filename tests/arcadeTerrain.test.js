import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { ARCADE_TERRAIN_CONFIG, DEFAULT_TERRAIN_CONFIG, normalizeTerrainConfig, tilesPerChunk } from '../src/core/terrainConfig.js';
import { createTerrainGenerator, generateTerrainChunk } from '../src/core/terrainGenerator.js';
import { sampleTerrain } from '../src/core/terrainQuery.js';
import { TerrainRenderer } from '../src/render/terrainRenderer.js';

test('Arcade terrain tiles have four times the edge length and one quarter the tiles per chunk', () => {
  const normal = createGame();
  const arcade = createGame(1147, { runMode: 'arcade' });
  const a = arcade.terrain.generator.config, n = normal.terrain.generator.config;
  assert.equal(a.tileSize, n.tileSize * 4);
  assert.equal(a.chunkSize, n.chunkSize * 2);
  assert.equal(tilesPerChunk(a), tilesPerChunk(n) / 2);
  const chunk = [...arcade.terrain.chunks.values()][0];
  assert.equal(chunk.tiles.flat().length, 64);
  assert.equal(chunk.tiles.flat().length, tilesPerChunk(n) ** 2 / 4);
  for (const point of [{ x: 0, y: 0 }, { x: -1025, y: -129 }, { x: 1025, y: 129 }]) {
    const sample = sampleTerrain(arcade.terrain, point.x, point.y);
    assert.ok(Number.isFinite(sample.traction));
    assert.ok(sample.tileX >= 0 && sample.tileX < 8);
    assert.ok(sample.tileY >= 0 && sample.tileY < 8);
  }
  const sandbox = createGame(1147, { runMode: 'arcade', sandbox: { schemaVersion: '0.1', assetId: 'test.arcade_terrain_sandbox', spawns: [] } });
  assert.equal(sandbox.terrain.generator.config.tileSize, DEFAULT_TERRAIN_CONFIG.tileSize);
  assert.equal(sandbox.road.baseSpeed, normal.road.baseSpeed);
});

test('Arcade road distance advances twice as fast with matching chunk cadence and seeded terrain', () => {
  const games = [createGame(), createGame(1147, { runMode: 'arcade' })];
  for (const game of games) {
    game.autofire = false;
    game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
    stepGame(game, {}, 0.03);
  }
  assert.equal(games[1].road.baseSpeed, games[0].road.baseSpeed * 2);
  assert.equal(games[1].road.routeDistance, games[0].road.routeDistance * 2);
  assert.equal(games[1].terrain.generator.config.chunkSize / games[1].road.baseSpeed, games[0].terrain.generator.config.chunkSize / games[0].road.baseSpeed);
  const a = generateTerrainChunk(createTerrainGenerator({ seed: 42, config: ARCADE_TERRAIN_CONFIG }), -1, 0);
  const b = generateTerrainChunk(createTerrainGenerator({ seed: 42, config: ARCADE_TERRAIN_CONFIG }), -1, 0);
  assert.deepEqual(a, b);
});

test('larger Arcade chunks keep 512-pixel caches and paint only 64 tiles', () => {
  const originalDocument = globalThis.document;
  let draws = 0;
  const scales = [];
  const ctx = { scale: (...args) => scales.push(args), fillRect() {}, save() {}, restore() {}, translate() {}, rotate() {}, drawImage() { draws++; } };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try {
    const renderer = new TerrainRenderer({ ready: () => true, resolve: () => ({ image: { complete: true, naturalWidth: 32 }, source: { x: 0, y: 0, width: 32, height: 32 } }) });
    const config = normalizeTerrainConfig(ARCADE_TERRAIN_CONFIG);
    const tile = { tags: [], semantic: { materialGrid: [['ghost_forest.ground']] }, render: { baseAsset: 'test' }, rotation: 0 };
    const cache = renderer.createChunkCache({ size: config.chunkSize, tiles: Array.from({ length: 8 }, () => Array(8).fill(tile)) }, config);
    assert.equal(cache.canvas.width, 512);
    assert.equal(cache.canvas.height, 512);
    assert.deepEqual(scales, [[0.5, 0.5]]);
    assert.equal(draws, 64);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

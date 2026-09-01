import test from 'node:test';
import assert from 'node:assert/strict';
import ghostForestGroundMaterial from '../content/terrain/materials/ghost_forest_ground.json' with { type: 'json' };
import ghostForestPathStraight from '../content/terrain/tiles/ghost_forest_path_straight.json' with { type: 'json' };
import { normalizeTerrainConfig } from '../src/core/terrainConfig.js';
import { normalizeTerrainMaterialDefinition, validateTerrainMaterialDefinition } from '../src/core/terrainMaterial.js';
import { createTileVariants, validateTerrainTileDefinition } from '../src/core/terrainTileDefinition.js';

test('terrain material definition validates and normalizes physics fields', () => {
  const report = validateTerrainMaterialDefinition(ghostForestGroundMaterial);
  assert.equal(report.valid, true);
  const material = normalizeTerrainMaterialDefinition(ghostForestGroundMaterial);
  assert.equal(material.materialId, 'ghost_forest.ground');
  assert.equal(material.physics.traction, 1);
});

test('terrain material rejects missing traction clearly', () => {
  const report = validateTerrainMaterialDefinition({
    ...ghostForestGroundMaterial,
    physics: { rollingResistance: 0.1, roughness: 0.1 },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('physics.traction')), true);
});

test('terrain tile definition validates socket and semantic grids', () => {
  const report = validateTerrainTileDefinition(ghostForestPathStraight);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('terrain tile rotation maps sockets and semantic material grid', () => {
  const [eastWest] = createTileVariants([ghostForestPathStraight]).filter((tile) => tile.rotation === 90);
  assert.equal(eastWest.sockets.north.road, 'closed');
  assert.equal(eastWest.sockets.east.road, 'standard');
  assert.equal(eastWest.sockets.south.road, 'closed');
  assert.equal(eastWest.sockets.west.road, 'standard');
  assert.equal(eastWest.semantic.materialGrid[1][0], 'ghost_forest.path');
});

test('terrain config keeps chunk and tile sizes compatible', () => {
  assert.throws(() => normalizeTerrainConfig({ chunkSize: 500, tileSize: 32 }), /divisible/);
});

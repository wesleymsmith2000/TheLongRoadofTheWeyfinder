import test from 'node:test';
import assert from 'node:assert/strict';
import terrainPackManifest from '../content/packs/terrain.ghost_forest.v0.json' with { type: 'json' };
import ghostForestGroundMaterial from '../content/terrain/materials/ghost_forest_ground.json' with { type: 'json' };
import ghostForestPathMaterial from '../content/terrain/materials/ghost_forest_path.json' with { type: 'json' };
import ghostForestSlipperyMossMaterial from '../content/terrain/materials/ghost_forest_slippery_moss.json' with { type: 'json' };
import ghostForestFloorTile from '../content/terrain/tiles/ghost_forest_floor.json' with { type: 'json' };
import ghostForestPathStraightTile from '../content/terrain/tiles/ghost_forest_path_straight.json' with { type: 'json' };
import ghostForestPathTurnTile from '../content/terrain/tiles/ghost_forest_path_turn.json' with { type: 'json' };
import ghostForestPathSlipperyTile from '../content/terrain/tiles/ghost_forest_path_slippery.json' with { type: 'json' };
import { createContentRegistry, getAvailableContent, registerContentAsset, validateContentPack } from '../src/core/contentRegistry.js';
import { createLocalContentBundleFromFiles } from '../src/core/localContentLibrary.js';
import { normalizeTerrainConfig, tilesPerChunk } from '../src/core/terrainConfig.js';
import { createTerrainMaterialLookup, materialToSample, validateTerrainMaterialDefinition } from '../src/core/terrainMaterial.js';
import { createTileVariants, tileMatchesRoadSockets, validateTerrainTileDefinition } from '../src/core/terrainTileDefinition.js';

const terrainMaterials = [ghostForestGroundMaterial, ghostForestPathMaterial, ghostForestSlipperyMossMaterial];
const terrainTiles = [ghostForestFloorTile, ghostForestPathStraightTile, ghostForestPathTurnTile, ghostForestPathSlipperyTile];

test('terrain config keeps prototype chunk and tile dimensions coherent', () => {
  const config = normalizeTerrainConfig();
  assert.equal(config.chunkSize, 512);
  assert.equal(config.tileSize, 32);
  assert.equal(tilesPerChunk(config), 16);
});

test('ghost forest terrain material assets validate and expose safe samples', () => {
  for (const material of terrainMaterials) {
    const report = validateTerrainMaterialDefinition(material);
    assert.equal(report.valid, true);
  }
  const lookup = createTerrainMaterialLookup(terrainMaterials);
  const slippery = materialToSample(lookup.get('ghost_forest.slippery_moss'));
  assert.equal(slippery.traction < 0.5, true);
  assert.equal(slippery.hazardTags.includes('slippery'), true);
});

test('ghost forest terrain tile assets validate and rotate road sockets', () => {
  for (const tile of terrainTiles) {
    const report = validateTerrainTileDefinition(tile);
    assert.equal(report.valid, true);
  }

  const variants = createTileVariants([ghostForestPathStraightTile]);
  assert.equal(variants.length, 4);
  assert.equal(
    variants.some((variant) =>
      tileMatchesRoadSockets(variant, {
        north: 'closed',
        east: 'standard',
        south: 'closed',
        west: 'standard',
      }),
    ),
    true,
  );
});

test('terrain pack manifest registers material and tile assets', () => {
  const report = validateContentPack(terrainPackManifest);
  assert.equal(report.valid, true);

  const registry = createContentRegistry();
  for (const material of terrainMaterials) registerContentAsset(registry, 'terrainMaterial', material, terrainPackManifest.packId);
  for (const tile of terrainTiles) registerContentAsset(registry, 'terrainTile', tile, terrainPackManifest.packId);

  assert.equal(getAvailableContent(registry, 'terrainMaterial', { sourcePack: terrainPackManifest.packId }).length, 3);
  assert.equal(getAvailableContent(registry, 'terrainTile', { tag: 'road' }).length, 3);
  assert.equal(registry.assets.get('terrainMaterial').get('terrain.material.ghost_forest.path').materialId, 'ghost_forest.path');
});

test('loose local terrain JSON files are grouped into terrain asset manifest keys', () => {
  const bundle = createLocalContentBundleFromFiles([
    {
      name: 'ghost_forest_ground.json',
      path: 'ghost_forest_ground.json',
      text: JSON.stringify(ghostForestGroundMaterial),
    },
    {
      name: 'ghost_forest_path_straight.json',
      path: 'ghost_forest_path_straight.json',
      text: JSON.stringify(ghostForestPathStraightTile),
    },
  ]);

  assert.deepEqual(bundle.manifests[0].assets.terrainMaterials, ['ghost_forest_ground.json']);
  assert.deepEqual(bundle.manifests[0].assets.terrainTiles, ['ghost_forest_path_straight.json']);
  assert.equal(bundle.assets.some((asset) => asset.kind === 'terrainMaterial'), true);
  assert.equal(bundle.assets.some((asset) => asset.kind === 'terrainTile'), true);
});

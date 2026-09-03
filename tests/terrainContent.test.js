import test from 'node:test';
import assert from 'node:assert/strict';
import terrainPackManifest from '../content/packs/terrain.ghost_forest.v0.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';
import coreGroundSetsAtlas from '../content/resources/terrain/atlas.terrain_1_core_ground_sets.json' with { type: 'json' };
import pathsEdgesTransitionsAtlas from '../content/resources/terrain/atlas.terrain_2_paths_edges_transitions.json' with { type: 'json' };
import wideRoadsPathsAtlas from '../content/resources/terrain/atlas.terrain_3_wide_roads_paths.json' with { type: 'json' };
import environmentLandformsWaterAtlas from '../content/resources/terrain/atlas.terrain_4_environment_landforms_water.json' with { type: 'json' };
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
const terrainAtlases = [coreGroundSetsAtlas, pathsEdgesTransitionsAtlas, wideRoadsPathsAtlas, environmentLandformsWaterAtlas];

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

test('terrain atlas metadata matches source image dimensions and sprite rects', () => {
  for (const atlas of terrainAtlases) {
    const size = pngSize(path.join(process.cwd(), atlas.image.path));
    assert.equal(size.width, atlas.image.width);
    assert.equal(size.height, atlas.image.height);
    assert.equal(atlas.nativeTileSize, 32);
  }

  const straight = spriteRect(pathsEdgesTransitionsAtlas, 'ghost_forest.path_straight');
  assert.deepEqual(straight, { x: 211, y: 323, width: 72, height: 72 });
  const wideFill = spriteRect(wideRoadsPathsAtlas, 'ghost_forest_path.center_fill_repeatable');
  assert.deepEqual(wideFill, { x: 495, y: 363, width: 56, height: 92 });
  const streamCenter = spriteRect(environmentLandformsWaterAtlas, 'ghost_forest_stream.water_center');
  assert.deepEqual(streamCenter, { x: 108, y: 112, width: 72, height: 72 });
  assert.equal(Boolean(pathsEdgesTransitionsAtlas.sprites['ghost_forest.path_turn']), true);
  assert.equal(Boolean(coreGroundSetsAtlas.sprites['ghost_forest.ground_a']), true);
  assert.equal(Boolean(environmentLandformsWaterAtlas.semanticMasks.wet), true);
});

test('ghost forest tile render assets resolve to atlas sprite references', () => {
  assert.equal(ghostForestFloorTile.render.baseAsset, 'atlas:terrain.atlas.paths_edges_transitions.v0#ghost_forest.ground');
  assert.equal(ghostForestPathStraightTile.render.baseAsset, 'atlas:terrain.atlas.paths_edges_transitions.v0#ghost_forest.path_straight');
  assert.equal(ghostForestPathTurnTile.render.baseAsset, 'atlas:terrain.atlas.paths_edges_transitions.v0#ghost_forest.path_turn');
  assert.equal(ghostForestPathSlipperyTile.render.baseAsset, 'atlas:terrain.atlas.paths_edges_transitions.v0#ghost_forest.slippery_hazard');
});

test('terrain pack manifest registers material and tile assets', () => {
  const report = validateContentPack(terrainPackManifest);
  assert.equal(report.valid, true);
  assert.equal(terrainPackManifest.assets.images.length, 4);

  const registry = createContentRegistry();
  for (const material of terrainMaterials) registerContentAsset(registry, 'terrainMaterial', material, terrainPackManifest.packId);
  for (const tile of terrainTiles) registerContentAsset(registry, 'terrainTile', tile, terrainPackManifest.packId);

  assert.equal(getAvailableContent(registry, 'terrainMaterial', { sourcePack: terrainPackManifest.packId }).length, 3);
  assert.equal(getAvailableContent(registry, 'terrainTile', { tag: 'road' }).length, 3);
  assert.equal(registry.assets.get('terrainMaterial').get('terrain.material.ghost_forest.path').materialId, 'ghost_forest.path');
});

function spriteRect(atlas, spriteId) {
  const sprite = atlas.sprites[spriteId];
  const row = atlas.rows[sprite.row];
  const column = atlas.columns[sprite.column];
  return {
    x: sprite.x ?? column.x,
    y: sprite.y ?? row.y,
    width: sprite.width ?? atlas.sourceTileSize.width,
    height: sprite.height ?? atlas.sourceTileSize.height,
  };
}

function pngSize(filePath) {
  const data = fs.readFileSync(filePath);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  };
}

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

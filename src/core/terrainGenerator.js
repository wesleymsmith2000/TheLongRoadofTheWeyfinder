import { rotatePoint } from './math.js';
import { normalizeTerrainConfig, tilesPerChunk } from './terrainConfig.js';
import { terrainChunkKey } from './terrainGrid.js';
import { createTerrainMaterialLookup } from './terrainMaterial.js';
import { createTileVariants, tileMatchesRoadSockets } from './terrainTileDefinition.js';
import ghostForestGround from '../../content/terrain/materials/ghost_forest_ground.json' with { type: 'json' };
import ghostForestPath from '../../content/terrain/materials/ghost_forest_path.json' with { type: 'json' };
import ghostForestSlipperyMoss from '../../content/terrain/materials/ghost_forest_slippery_moss.json' with { type: 'json' };
import ghostForestFloor from '../../content/terrain/tiles/ghost_forest_floor.json' with { type: 'json' };
import ghostForestPathSlippery from '../../content/terrain/tiles/ghost_forest_path_slippery.json' with { type: 'json' };
import ghostForestPathStraight from '../../content/terrain/tiles/ghost_forest_path_straight.json' with { type: 'json' };
import ghostForestPathTurn from '../../content/terrain/tiles/ghost_forest_path_turn.json' with { type: 'json' };

export const DEFAULT_TERRAIN_ROUTE = Object.freeze({
  startHeading: 0,
  segments: Object.freeze([{ id: 'prototype-endless-road', length: 48000, turnRadians: 0 }]),
});

export function createDefaultGhostForestTerrainContent() {
  return {
    materials: [ghostForestGround, ghostForestPath, ghostForestSlipperyMoss],
    tiles: [ghostForestFloor, ghostForestPathStraight, ghostForestPathTurn, ghostForestPathSlippery],
  };
}

export function createTerrainGenerator(options = {}) {
  const config = normalizeTerrainConfig(options.config);
  const content = options.content ?? createDefaultGhostForestTerrainContent();
  const seed = options.seed ?? 1147;
  const route = options.route ?? DEFAULT_TERRAIN_ROUTE;
  const routeTiles = resolveRouteTiles(route, { config });
  const tileVariants = createTileVariants(content.tiles, { config });
  return {
    seed,
    config,
    route,
    routeTiles,
    materials: createTerrainMaterialLookup(content.materials),
    tileVariants,
    debugLog: [],
  };
}

export function generateTerrainChunk(generator, chunkX, chunkY) {
  const config = generator.config;
  const count = tilesPerChunk(config);
  const worldTileOriginX = chunkX * count;
  const worldTileOriginY = chunkY * count;
  const tiles = [];
  const fallbacks = [];
  for (let localY = 0; localY < count; localY += 1) {
    const row = [];
    for (let localX = 0; localX < count; localX += 1) {
      const worldTileX = worldTileOriginX + localX;
      const worldTileY = worldTileOriginY + localY;
      const placed = chooseTerrainTile(generator, worldTileX, worldTileY);
      if (placed.fallback) fallbacks.push({ worldTileX, worldTileY, requiredRoadSockets: placed.requiredRoadSockets });
      row.push(placed);
    }
    tiles.push(row);
  }
  const chunk = {
    chunkX,
    chunkY,
    key: terrainChunkKey(chunkX, chunkY),
    originX: chunkX * config.chunkSize,
    originY: chunkY * config.chunkSize,
    size: config.chunkSize,
    tiles,
    fallbacks,
    cache: null,
  };
  if (fallbacks.length > 0) {
    generator.debugLog.push({ chunkX, chunkY, fallbackCount: fallbacks.length, fallbacks });
  }
  return chunk;
}

export function chooseTerrainTile(generator, worldTileX, worldTileY) {
  const requiredRoadSockets = requiredRoadSocketsForTile(generator.routeTiles, worldTileX, worldTileY);
  const isRoad = Object.values(requiredRoadSockets).some((value) => value !== 'closed');
  if (!isRoad) return placedTile(floorTile(generator), worldTileX, worldTileY, requiredRoadSockets);

  const candidates = generator.tileVariants.filter((tile) => tile.tags.includes('road') && tileMatchesRoadSockets(tile, requiredRoadSockets));
  const roadCandidates = shouldUseSlipperyPatch(generator.seed, worldTileX, worldTileY)
    ? candidates.filter((tile) => tile.tags.includes('slippery'))
    : candidates.filter((tile) => !tile.tags.includes('slippery'));
  const tile = chooseWeighted(roadCandidates.length > 0 ? roadCandidates : candidates, hashUnit(generator.seed, worldTileX, worldTileY, 17));
  if (tile) return placedTile(tile, worldTileX, worldTileY, requiredRoadSockets);
  return createFallbackRoadTile(generator, worldTileX, worldTileY, requiredRoadSockets);
}

export function resolveRouteTiles(route = DEFAULT_TERRAIN_ROUTE, options = {}) {
  const config = options.config ?? normalizeTerrainConfig();
  const routeTiles = new Set();
  const segments = Array.isArray(route.segments) && route.segments.length > 0 ? route.segments : DEFAULT_TERRAIN_ROUTE.segments;
  let x = route.startX ?? 0;
  let y = route.startY ?? 0;
  let heading = route.startHeading ?? 0;
  const step = config.tileSize / 2;

  const paddingSteps = Math.ceil((route.routePadding ?? config.routePadding) / step);
  const startBackward = rotatePoint(0, 1, heading);
  for (let index = paddingSteps; index > 0; index -= 1) {
    markRouteTile(routeTiles, x + startBackward.x * index * step, y + startBackward.y * index * step, config);
  }

  markRouteTile(routeTiles, x, y, config);
  for (const segment of segments) {
    const length = Number.isFinite(segment.length) ? segment.length : config.routeFallbackLength;
    const turnRadians = Number.isFinite(segment.turnRadians) ? segment.turnRadians : 0;
    const steps = Math.max(1, Math.ceil(length / step));
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const segmentHeading = heading + turnRadians * t;
      const direction = rotatePoint(0, -1, segmentHeading);
      x += direction.x * step;
      y += direction.y * step;
      markRouteTile(routeTiles, x, y, config);
    }
    heading += turnRadians;
  }

  const finalForward = rotatePoint(0, -1, heading);
  const extensionSteps = Math.ceil(config.routeFallbackLength / step);
  for (let index = 1; index <= extensionSteps; index += 1) {
    markRouteTile(routeTiles, x + finalForward.x * index * step, y + finalForward.y * index * step, config);
  }
  return routeTiles;
}

function requiredRoadSocketsForTile(routeTiles, worldTileX, worldTileY) {
  if (!routeTiles.has(routeTileKey(worldTileX, worldTileY))) {
    return { north: 'closed', east: 'closed', south: 'closed', west: 'closed' };
  }
  return {
    north: routeTiles.has(routeTileKey(worldTileX, worldTileY - 1)) ? 'standard' : 'closed',
    east: routeTiles.has(routeTileKey(worldTileX + 1, worldTileY)) ? 'standard' : 'closed',
    south: routeTiles.has(routeTileKey(worldTileX, worldTileY + 1)) ? 'standard' : 'closed',
    west: routeTiles.has(routeTileKey(worldTileX - 1, worldTileY)) ? 'standard' : 'closed',
  };
}

function markRouteTile(routeTiles, worldX, worldY, config) {
  routeTiles.add(routeTileKey(Math.floor(worldX / config.tileSize), Math.floor(worldY / config.tileSize)));
}

function routeTileKey(worldTileX, worldTileY) {
  return `${worldTileX},${worldTileY}`;
}

function floorTile(generator) {
  return generator.tileVariants.find((tile) => tile.sourceAssetId === 'terrain.tile.ghost_forest.floor') ?? generator.tileVariants[0];
}

function placedTile(tile, worldTileX, worldTileY, requiredRoadSockets) {
  return {
    ...tile,
    worldTileX,
    worldTileY,
    requiredRoadSockets,
    fallback: false,
  };
}

function createFallbackRoadTile(generator, worldTileX, worldTileY, requiredRoadSockets) {
  const size = generator.config.subcellsPerTile;
  const materialGrid = Array.from({ length: size }, () => Array.from({ length: size }, () => 'ghost_forest.path'));
  return {
    sourceAssetId: 'terrain.tile.fallback_road',
    assetId: 'terrain.tile.fallback_road@0',
    biome: 'ghost_forest',
    rotation: 0,
    sockets: Object.fromEntries(Object.entries(requiredRoadSockets).map(([direction, road]) => [direction, { road, height: 0, fluid: 'none' }])),
    render: { baseAsset: 'procedural:fallback_road', animatedLayers: [] },
    semantic: {
      materialGrid,
      heightGrid: Array.from({ length: size }, () => Array.from({ length: size }, () => 0)),
      fluidGrid: Array.from({ length: size }, () => Array.from({ length: size }, () => null)),
    },
    decorSockets: [],
    eventSockets: [],
    intrinsicHazards: [],
    tags: ['road', 'fallback'],
    weight: 1,
    worldTileX,
    worldTileY,
    requiredRoadSockets,
    fallback: true,
  };
}

function chooseWeighted(candidates, roll) {
  const total = candidates.reduce((sum, tile) => sum + Math.max(0, tile.weight ?? 1), 0);
  if (total <= 0) return candidates[0] ?? null;
  let cursor = roll * total;
  for (const tile of candidates) {
    cursor -= Math.max(0, tile.weight ?? 1);
    if (cursor <= 0) return tile;
  }
  return candidates[candidates.length - 1] ?? null;
}

function shouldUseSlipperyPatch(seed, worldTileX, worldTileY) {
  if (Math.abs(worldTileY % 19) > 1) return false;
  return hashUnit(seed, worldTileX, worldTileY, 73) > 0.42;
}

function hashUnit(seed, x, y, salt = 0) {
  let value = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041)) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 0x100000000;
}

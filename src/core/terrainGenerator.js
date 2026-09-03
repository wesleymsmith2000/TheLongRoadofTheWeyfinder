import { rotatePoint } from './math.js';
import { normalizeTerrainConfig, tilesPerChunk } from './terrainConfig.js';
import { terrainChunkKey } from './terrainGrid.js';
import { createTerrainMaterialLookup } from './terrainMaterial.js';
import { createTileVariants, tileMatchesRoadSockets } from './terrainTileDefinition.js';
import { DEFAULT_ROAD_ROUTE, roadRouteLength, sampleRoadRoute } from './roadRoute.js';
import ghostForestGround from '../../content/terrain/materials/ghost_forest_ground.json' with { type: 'json' };
import ghostForestPath from '../../content/terrain/materials/ghost_forest_path.json' with { type: 'json' };
import ghostForestSlipperyMoss from '../../content/terrain/materials/ghost_forest_slippery_moss.json' with { type: 'json' };
import ghostForestFloor from '../../content/terrain/tiles/ghost_forest_floor.json' with { type: 'json' };
import ghostForestPathSlippery from '../../content/terrain/tiles/ghost_forest_path_slippery.json' with { type: 'json' };
import ghostForestPathStraight from '../../content/terrain/tiles/ghost_forest_path_straight.json' with { type: 'json' };
import ghostForestPathTurn from '../../content/terrain/tiles/ghost_forest_path_turn.json' with { type: 'json' };

export const DEFAULT_TERRAIN_ROUTE = DEFAULT_ROAD_ROUTE;

const BEACH_SIDE = 1;
const STREAM_SPACING = 3400;
const RAVINE_SPACING = 5200;

const beachSandMaterial = {
  schemaVersion: '0.1',
  assetId: 'terrain.material.ghost_forest.beach_sand',
  materialId: 'ghost_forest.beach_sand',
  displayName: 'Ghost Forest Beach Sand',
  physics: { traction: 0.88, rollingResistance: 0.075, roughness: 0.18 },
  systems: { thermalFlux: 0, ignitionRisk: 0, conductivity: 0.16 },
  hazardTags: [],
};

const shallowWaterMaterial = {
  schemaVersion: '0.1',
  assetId: 'terrain.material.ghost_forest.shallow_water',
  materialId: 'ghost_forest.shallow_water',
  displayName: 'Ghost Forest Shallow Water',
  physics: { traction: 0.62, rollingResistance: 0.14, roughness: 0.24 },
  systems: { thermalFlux: 0, ignitionRisk: 0, conductivity: 0.8 },
  hazardTags: ['water'],
};

const deepWaterMaterial = {
  schemaVersion: '0.1',
  assetId: 'terrain.material.ghost_forest.deep_water',
  materialId: 'ghost_forest.deep_water',
  displayName: 'Ghost Forest Deep Water',
  physics: { traction: 0.35, rollingResistance: 0.2, roughness: 0.3 },
  systems: { thermalFlux: 0, ignitionRisk: 0, conductivity: 1 },
  hazardTags: ['water', 'deep_water'],
};

const ravineMaterial = {
  schemaVersion: '0.1',
  assetId: 'terrain.material.ghost_forest.ravine_floor',
  materialId: 'ghost_forest.ravine_floor',
  displayName: 'Ghost Forest Ravine Floor',
  physics: { traction: 0.42, rollingResistance: 0.18, roughness: 0.56 },
  systems: { thermalFlux: 0, ignitionRisk: 0, conductivity: 0.05 },
  hazardTags: ['drop'],
};

export function createDefaultGhostForestTerrainContent() {
  return {
    materials: [ghostForestGround, ghostForestPath, ghostForestSlipperyMoss, beachSandMaterial, shallowWaterMaterial, deepWaterMaterial, ravineMaterial],
    tiles: [ghostForestFloor, ghostForestPathStraight, ghostForestPathTurn, ghostForestPathSlippery],
  };
}

export function createTerrainGenerator(options = {}) {
  const config = normalizeTerrainConfig(options.config);
  const content = options.content ?? createDefaultGhostForestTerrainContent();
  const seed = options.seed ?? 1147;
  const route = options.route ?? DEFAULT_TERRAIN_ROUTE;
  const routeTiles = resolveRouteTiles(route, { config });
  const pathSamples = createRoutePathSamples(route, { config });
  const tileVariants = createTileVariants(content.tiles, { config });
  return {
    seed,
    config,
    route,
    routeTiles,
    scenery: {
      pathSamples,
      crossings: createStreamCrossings(route, { config, seed }),
      ravines: createRavineCrossings(route, { config, seed }),
      beachSide: options.beachSide ?? BEACH_SIDE,
    },
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
  const feature = terrainFeatureForTile(generator, worldTileX, worldTileY);
  if (isRoad && feature?.kind === 'stream') return createSyntheticTile(generator, 'bridge', worldTileX, worldTileY, requiredRoadSockets, feature);
  if (!isRoad && feature) return createSyntheticTile(generator, feature.kind, worldTileX, worldTileY, requiredRoadSockets, feature);
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
  const step = config.tileSize / 2;

  const paddingSteps = Math.ceil((route.routePadding ?? config.routePadding) / step);
  const start = sampleRoadRoute(route, 0);
  const startBackward = rotatePoint(0, 1, start.heading);
  let previousTile = null;
  for (let index = paddingSteps; index > 0; index -= 1) {
    previousTile = markConnectedRouteTile(routeTiles, previousTile, start.x + startBackward.x * index * step, start.y + startBackward.y * index * step, config);
  }

  const routeLength = roadRouteLength(route);
  for (let distance = 0; distance <= routeLength; distance += step) {
    const pose = sampleRoadRoute(route, distance);
    previousTile = markConnectedRouteTile(routeTiles, previousTile, pose.x, pose.y, config);
  }

  const final = sampleRoadRoute(route, routeLength);
  const finalForward = rotatePoint(0, -1, final.heading);
  const extensionSteps = Math.ceil(config.routeFallbackLength / step);
  for (let index = 1; index <= extensionSteps; index += 1) {
    previousTile = markConnectedRouteTile(routeTiles, previousTile, final.x + finalForward.x * index * step, final.y + finalForward.y * index * step, config);
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
  const tile = { x: Math.floor(worldX / config.tileSize), y: Math.floor(worldY / config.tileSize) };
  routeTiles.add(routeTileKey(tile.x, tile.y));
  return tile;
}

function markConnectedRouteTile(routeTiles, previousTile, worldX, worldY, config) {
  const tile = markRouteTile(routeTiles, worldX, worldY, config);
  if (!previousTile) return tile;
  let x = previousTile.x;
  let y = previousTile.y;
  while (x !== tile.x || y !== tile.y) {
    const dx = tile.x - x;
    const dy = tile.y - y;
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      x += Math.sign(dx);
    } else if (dy !== 0) {
      y += Math.sign(dy);
    }
    routeTiles.add(routeTileKey(x, y));
  }
  return tile;
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

function terrainFeatureForTile(generator, worldTileX, worldTileY) {
  const config = generator.config;
  const center = tileCenter(worldTileX, worldTileY, config);
  const local = nearestRouteLocal(generator.scenery.pathSamples, center);
  if (!local) return null;

  const stream = crossingFeatureAt(generator.scenery.crossings, center, config, {
    kind: 'stream',
    halfWidth: config.tileSize * 1.28,
    minLateral: -config.tileSize * 9,
    maxLateral: config.tileSize * 14,
  });
  if (stream) return stream;

  const shoreStart = config.tileSize * 6.5;
  const oceanStart = config.tileSize * 10.5;
  const shoreX = local.x * (generator.scenery.beachSide ?? BEACH_SIDE);
  if (shoreX >= oceanStart) return { kind: 'ocean', local };
  if (shoreX >= shoreStart) return { kind: 'beach', local };

  const ravine = crossingFeatureAt(generator.scenery.ravines, center, config, {
    kind: 'ravine',
    halfWidth: config.tileSize * 0.95,
    minLateral: config.tileSize * 7,
    maxLateral: config.tileSize * 16,
  });
  if (ravine) return ravine;
  return null;
}

function crossingFeatureAt(crossings, point, config, options) {
  for (const crossing of crossings) {
    const local = localToPose(point, crossing);
    if (Math.abs(local.x) > options.halfWidth) continue;
    if (local.y < options.minLateral || local.y > options.maxLateral) continue;
    return { kind: options.kind, crossing, local };
  }
  return null;
}

function createSyntheticTile(generator, kind, worldTileX, worldTileY, requiredRoadSockets, feature) {
  const sourceAssetId = `terrain.tile.procedural.${kind}`;
  const materialId = materialForFeature(kind);
  const fluid = fluidForFeature(kind);
  const height = kind === 'ravine' ? -1 : 0;
  const size = generator.config.subcellsPerTile;
  const roadSockets = kind === 'bridge' ? requiredRoadSockets : { north: 'closed', east: 'closed', south: 'closed', west: 'closed' };
  return {
    sourceAssetId,
    assetId: `${sourceAssetId}@0`,
    biome: 'ghost_forest',
    rotation: 0,
    sockets: Object.fromEntries(
      Object.entries(roadSockets).map(([direction, road]) => [direction, { road, height, fluid: fluid ? `open:${fluid.type}` : 'none' }]),
    ),
    render: {
      baseAsset: baseAssetForFeature(kind),
      animatedLayers: [],
    },
    semantic: {
      materialGrid: Array.from({ length: size }, () => Array.from({ length: size }, () => materialId)),
      heightGrid: Array.from({ length: size }, () => Array.from({ length: size }, () => height)),
      fluidGrid: Array.from({ length: size }, () => Array.from({ length: size }, () => (fluid ? { ...fluid } : null))),
    },
    decorSockets: [],
    eventSockets: [],
    intrinsicHazards: [],
    tags: tagsForFeature(kind),
    weight: 1,
    worldTileX,
    worldTileY,
    requiredRoadSockets,
    feature,
    fallback: false,
  };
}

function materialForFeature(kind) {
  if (kind === 'beach') return 'ghost_forest.beach_sand';
  if (kind === 'ocean') return 'ghost_forest.deep_water';
  if (kind === 'stream') return 'ghost_forest.shallow_water';
  if (kind === 'ravine') return 'ghost_forest.ravine_floor';
  if (kind === 'bridge') return 'ghost_forest.path';
  return 'ghost_forest.ground';
}

function fluidForFeature(kind) {
  if (kind === 'ocean') return { type: 'ocean', depth: 1 };
  if (kind === 'stream') return { type: 'stream', depth: 0.42 };
  return null;
}

function tagsForFeature(kind) {
  if (kind === 'beach') return ['ground', 'beach', 'shore'];
  if (kind === 'ocean') return ['water', 'ocean'];
  if (kind === 'stream') return ['water', 'stream'];
  if (kind === 'ravine') return ['ravine', 'drop'];
  if (kind === 'bridge') return ['road', 'bridge', 'stream-crossing'];
  return ['ground'];
}

function baseAssetForFeature(kind) {
  if (kind === 'stream' || kind === 'bridge') return 'atlas:terrain.atlas.environment_landforms_water.v0#ghost_forest_stream.water_center';
  if (kind === 'ravine') return 'atlas:terrain.atlas.environment_landforms_water.v0#shadowed_desert_canyon.floor_center';
  return null;
}

function tileCenter(worldTileX, worldTileY, config) {
  return {
    x: (worldTileX + 0.5) * config.tileSize,
    y: (worldTileY + 0.5) * config.tileSize,
  };
}

function createRoutePathSamples(route, options = {}) {
  const config = options.config ?? normalizeTerrainConfig();
  const routeLength = roadRouteLength(route);
  const step = config.tileSize * 2;
  const samples = [];
  for (let distance = 0; distance <= routeLength; distance += step) {
    const pose = sampleRoadRoute(route, distance);
    samples.push({ x: pose.x, y: pose.y, heading: pose.heading, distance });
  }
  const final = sampleRoadRoute(route, routeLength);
  samples.push({ x: final.x, y: final.y, heading: final.heading, distance: routeLength });
  return samples;
}

function createStreamCrossings(route, options = {}) {
  return createCrossings(route, {
    ...options,
    spacing: STREAM_SPACING,
    startDistance: 2200,
    jitter: 780,
    headingOffset: Math.PI / 2,
    salt: 311,
  });
}

function createRavineCrossings(route, options = {}) {
  return createCrossings(route, {
    ...options,
    spacing: RAVINE_SPACING,
    startDistance: 3800,
    jitter: 920,
    headingOffset: -Math.PI / 2,
    salt: 719,
  });
}

function createCrossings(route, options) {
  const config = options.config ?? normalizeTerrainConfig();
  const length = roadRouteLength(route);
  const crossings = [];
  for (let distance = options.startDistance; distance < length; distance += options.spacing) {
    const roll = hashUnit(options.seed ?? 1147, Math.floor(distance / config.tileSize), 0, options.salt);
    const pose = sampleRoadRoute(route, Math.min(length, distance + (roll - 0.5) * options.jitter));
    crossings.push({
      x: pose.x,
      y: pose.y,
      heading: pose.heading + options.headingOffset,
      distance,
    });
  }
  return crossings;
}

function nearestRouteLocal(samples, point) {
  let best = null;
  let bestDistanceSquared = Infinity;
  for (const sample of samples ?? []) {
    const dx = point.x - sample.x;
    const dy = point.y - sample.y;
    const distSq = dx * dx + dy * dy;
    if (distSq >= bestDistanceSquared) continue;
    bestDistanceSquared = distSq;
    best = sample;
  }
  return best ? { ...localToPose(point, best), sample: best, distanceSquared: bestDistanceSquared } : null;
}

function localToPose(point, pose) {
  const right = rotatePoint(1, 0, pose.heading);
  const forward = rotatePoint(0, -1, pose.heading);
  const dx = point.x - pose.x;
  const dy = point.y - pose.y;
  return {
    x: dx * right.x + dy * right.y,
    y: dx * forward.x + dy * forward.y,
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

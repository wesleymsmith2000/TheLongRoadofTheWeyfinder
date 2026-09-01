import { tilesPerChunk } from '../core/terrainConfig.js';

const MATERIAL_COLORS = Object.freeze({
  'ghost_forest.ground': '#1d2a24',
  'ghost_forest.path': '#3b3830',
  'ghost_forest.slippery_moss': '#3e7368',
  'safe.default': '#242826',
});

export class TerrainRenderer {
  drawWorld(ctx, terrain, camera, viewportWidth, viewportHeight, debug = {}) {
    if (!terrain?.chunks) return;
    const range = Math.max(viewportWidth, viewportHeight) * 1.55;
    for (const chunk of terrain.chunks.values()) {
      if (!chunkNearCamera(chunk, camera, range)) continue;
      const cache = chunk.cache ?? this.createChunkCache(chunk, terrain.generator.config);
      chunk.cache = cache;
      ctx.drawImage(cache.canvas, chunk.originX, chunk.originY, chunk.size, chunk.size);
    }
    if (debug.visible) drawTerrainDebug(ctx, terrain, camera, range);
  }

  createChunkCache(chunk, config) {
    const canvas = document.createElement('canvas');
    canvas.width = chunk.size;
    canvas.height = chunk.size;
    const ctx = canvas.getContext('2d');
    const tileCount = tilesPerChunk(config);
    ctx.fillStyle = '#17201c';
    ctx.fillRect(0, 0, chunk.size, chunk.size);
    for (let y = 0; y < tileCount; y += 1) {
      for (let x = 0; x < tileCount; x += 1) {
        drawTile(ctx, chunk.tiles[y][x], x * config.tileSize, y * config.tileSize, config.tileSize);
      }
    }
    return { canvas, createdAt: performance.now?.() ?? Date.now() };
  }
}

function drawTile(ctx, tile, x, y, size) {
  const baseMaterial = tile.semantic?.materialGrid?.[0]?.[0] ?? 'ghost_forest.ground';
  const isRoad = tile.tags.includes('road');
  ctx.fillStyle = MATERIAL_COLORS[baseMaterial] ?? MATERIAL_COLORS['safe.default'];
  ctx.fillRect(x, y, size, size);
  drawGroundVariation(ctx, tile, x, y, size);
  if (isRoad) drawRoadShape(ctx, tile, x, y, size);
}

function drawGroundVariation(ctx, tile, x, y, size) {
  const roll = hashUnit(tile.worldTileX, tile.worldTileY, tile.rotation);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = roll > 0.55 ? '#26382f' : '#111a18';
  ctx.fillRect(x + size * ((roll * 3) % 0.6), y + size * ((roll * 7) % 0.6), size * 0.32, size * 0.18);
  ctx.globalAlpha = 1;
}

function drawRoadShape(ctx, tile, x, y, size) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const halfWidth = size * 0.26;
  const isSlippery = tile.tags.includes('slippery');
  ctx.save();
  ctx.strokeStyle = tile.fallback ? '#7c6141' : isSlippery ? '#477f72' : '#484238';
  ctx.lineWidth = halfWidth * 2;
  ctx.lineCap = 'butt';
  for (const [direction, socket] of Object.entries(tile.sockets)) {
    if (socket.road === 'closed') continue;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    if (direction === 'north') ctx.lineTo(centerX, y);
    if (direction === 'east') ctx.lineTo(x + size, centerY);
    if (direction === 'south') ctx.lineTo(centerX, y + size);
    if (direction === 'west') ctx.lineTo(x, centerY);
    ctx.stroke();
  }
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fillRect(centerX - halfWidth, centerY - halfWidth, halfWidth * 2, halfWidth * 2);
  ctx.globalAlpha = isSlippery ? 0.34 : 0.18;
  ctx.strokeStyle = isSlippery ? '#a7fff0' : '#9e8d6a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.34, y + size * 0.52);
  ctx.lineTo(x + size * 0.66, y + size * 0.48);
  ctx.stroke();
  ctx.restore();
}

function drawTerrainDebug(ctx, terrain, camera, range) {
  const config = terrain.generator.config;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgb(131 247 255 / 0.22)';
  for (const chunk of terrain.chunks.values()) {
    if (!chunkNearCamera(chunk, camera, range)) continue;
    ctx.strokeRect(chunk.originX, chunk.originY, chunk.size, chunk.size);
    ctx.fillStyle = 'rgb(233 242 223 / 0.72)';
    ctx.font = '12px ui-monospace, SFMono-Regular, Consolas, monospace';
    ctx.fillText(chunk.key, chunk.originX + 6, chunk.originY + 16);
  }
  ctx.strokeStyle = 'rgb(233 242 223 / 0.08)';
  const startX = Math.floor((camera.x - range) / config.tileSize) * config.tileSize;
  const endX = Math.ceil((camera.x + range) / config.tileSize) * config.tileSize;
  const startY = Math.floor((camera.y - range) / config.tileSize) * config.tileSize;
  const endY = Math.ceil((camera.y + range) / config.tileSize) * config.tileSize;
  for (let x = startX; x <= endX; x += config.tileSize * 4) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += config.tileSize * 4) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  ctx.restore();
}

function chunkNearCamera(chunk, camera, range) {
  const centerX = chunk.originX + chunk.size / 2;
  const centerY = chunk.originY + chunk.size / 2;
  return Math.abs(centerX - camera.x) <= range + chunk.size && Math.abs(centerY - camera.y) <= range + chunk.size;
}

function hashUnit(x, y, salt = 0) {
  let value = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041)) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 0x100000000;
}

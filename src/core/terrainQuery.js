import { worldToTerrainAddress } from './terrainGrid.js';
import { materialToSample, SAFE_TERRAIN_MATERIAL, SAFE_TERRAIN_SAMPLE } from './terrainMaterial.js';
import { getTerrainChunk } from './terrainStreaming.js';

export function sampleTerrain(terrain, worldX, worldY) {
  if (!terrain?.generator || !Number.isFinite(worldX) || !Number.isFinite(worldY)) return { ...SAFE_TERRAIN_SAMPLE };
  const address = worldToTerrainAddress(worldX, worldY, terrain.generator.config);
  const chunk = getTerrainChunk(terrain, address.chunkX, address.chunkY);
  const tile = chunk?.tiles?.[address.tileY]?.[address.tileX];
  if (!tile) return { ...SAFE_TERRAIN_SAMPLE, ...address };

  const materialId = tile.semantic?.materialGrid?.[address.subcellY]?.[address.subcellX] ?? SAFE_TERRAIN_MATERIAL.materialId;
  const material = terrain.generator.materials.get(materialId) ?? SAFE_TERRAIN_MATERIAL;
  const height = tile.semantic?.heightGrid?.[address.subcellY]?.[address.subcellX] ?? 0;
  const fluid = tile.semantic?.fluidGrid?.[address.subcellY]?.[address.subcellX] ?? null;
  return materialToSample(material, {
    height,
    fluidType: fluid?.type ?? fluid ?? 'none',
    fluidDepth: fluid?.depth ?? 0,
    chunkX: address.chunkX,
    chunkY: address.chunkY,
    tileX: address.tileX,
    tileY: address.tileY,
    worldTileX: address.worldTileX,
    worldTileY: address.worldTileY,
    subcellX: address.subcellX,
    subcellY: address.subcellY,
    tileAssetId: tile.sourceAssetId,
    tileRotation: tile.rotation,
    fallback: tile.fallback === true,
  });
}

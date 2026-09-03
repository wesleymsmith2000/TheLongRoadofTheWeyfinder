import coreGroundSetsAtlas from '../../content/resources/terrain/atlas.terrain_1_core_ground_sets.json' with { type: 'json' };
import pathsEdgesTransitionsAtlas from '../../content/resources/terrain/atlas.terrain_2_paths_edges_transitions.json' with { type: 'json' };
import wideRoadsPathsAtlas from '../../content/resources/terrain/atlas.terrain_3_wide_roads_paths.json' with { type: 'json' };
import environmentLandformsWaterAtlas from '../../content/resources/terrain/atlas.terrain_4_environment_landforms_water.json' with { type: 'json' };
import coreGroundSetsUrl from '../../assets/images/terrain_1_spritesheet.png';
import pathsEdgesTransitionsUrl from '../../assets/images/terrain_2_spritesheet.png';
import wideRoadsPathsUrl from '../../assets/images/terrain__wide_roads_and_paths__spritesheet.png';
import environmentLandformsWaterUrl from '../../assets/images/terrain__environment_landforms_and_water__spritesheet.png';

const ATLAS_IMAGE_URLS = Object.freeze({
  [coreGroundSetsAtlas.assetId]: coreGroundSetsUrl,
  [pathsEdgesTransitionsAtlas.assetId]: pathsEdgesTransitionsUrl,
  [wideRoadsPathsAtlas.assetId]: wideRoadsPathsUrl,
  [environmentLandformsWaterAtlas.assetId]: environmentLandformsWaterUrl,
});

export function createTerrainAtlasLibrary() {
  return new TerrainAtlasLibrary([coreGroundSetsAtlas, pathsEdgesTransitionsAtlas, wideRoadsPathsAtlas, environmentLandformsWaterAtlas], ATLAS_IMAGE_URLS);
}

export class TerrainAtlasLibrary {
  constructor(atlases, urls) {
    this.atlases = new Map();
    this.images = new Map();
    for (const atlas of atlases) {
      this.atlases.set(atlas.assetId, atlas);
      const url = urls[atlas.assetId];
      if (url && typeof Image !== 'undefined') {
        const image = new Image();
        image.src = url;
        this.images.set(atlas.assetId, image);
      }
    }
  }

  resolve(ref) {
    const match = /^atlas:([^#]+)#(.+)$/.exec(ref ?? '');
    if (!match) return null;
    const [, atlasId, spriteId] = match;
    const atlas = this.atlases.get(atlasId);
    const sprite = atlas?.sprites?.[spriteId];
    if (!atlas || !sprite) return null;
    const row = atlas.rows?.[sprite.row];
    const column = atlas.columns?.[sprite.column];
    if (!row || !column) return null;
    const image = this.images.get(atlasId);
    return {
      atlas,
      spriteId,
      image,
      source: {
        x: sprite.x ?? column.x,
        y: sprite.y ?? row.y,
        width: sprite.width ?? atlas.sourceTileSize.width,
        height: sprite.height ?? atlas.sourceTileSize.height,
      },
    };
  }

  ready() {
    if (this.images.size === 0) return false;
    return [...this.images.values()].every((image) => image.complete && image.naturalWidth > 0);
  }
}

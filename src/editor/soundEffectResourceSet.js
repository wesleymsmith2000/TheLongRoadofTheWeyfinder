import manifest from '../../content/packs/canon.prototype0_sound_effects.json' with { type: 'json' };

const soundResourceModules = import.meta.glob('../../content/resources/sounds/*.json', { eager: true, import: 'default' });

const soundResources = Object.values(soundResourceModules).sort((a, b) => a.assetId.localeCompare(b.assetId));

export const SOUND_EFFECT_RESOURCE_BUNDLE = Object.freeze({
  manifests: [manifest],
  assets: soundResources.map((definition) => ({ kind: 'sound', definition, sourcePack: manifest.packId })),
  files: [
    { path: 'content/packs/canon.prototype0_sound_effects.json', name: 'canon.prototype0_sound_effects.json' },
    ...soundResources.map((definition) => ({
      path: `content/resources/sounds/${definition.assetId}.json`,
      name: `${definition.assetId}.json`,
    })),
  ],
  errors: [],
  warnings: [],
});

export const SOUND_EFFECT_RESOURCES_BY_ID = new Map(soundResources.map((definition) => [definition.assetId, definition]));

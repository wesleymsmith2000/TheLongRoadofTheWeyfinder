import { validateConstructDefinition } from './constructDefinition.js';
import { CANON_STATUSES, isCompatibleSchemaVersion, isNonEmptyString, isPlainObject, isStringArray } from './contentSchema.js';
import { collectLevelDependencies, validateLevelDefinition } from './levelDefinition.js';
import { validateEnemyArchetypePack } from './enemyArchetypeDefinition.js';
import { validatePatternDefinition } from './patternDefinition.js';
import { validateWeaponDefinition } from './weaponDefinition.js';

export const CONTENT_ASSET_KINDS = ['construct', 'weapon', 'pattern', 'enemyArchetype', 'behavior', 'encounter', 'route', 'level', 'image', 'sound', 'music', 'voxelModel'];
export const CONTENT_MANIFEST_ASSET_KEYS = ['constructs', 'weapons', 'patterns', 'enemyArchetypes', 'behaviors', 'encounters', 'routes', 'levels', 'images', 'sounds', 'music', 'voxelModels'];
export const RESOURCE_ASSET_KINDS = ['image', 'sound', 'music', 'voxelModel'];

const KIND_TO_MANIFEST_KEY = Object.freeze({
  construct: 'constructs',
  weapon: 'weapons',
  pattern: 'patterns',
  enemyArchetype: 'enemyArchetypes',
  behavior: 'behaviors',
  encounter: 'encounters',
  route: 'routes',
  level: 'levels',
  image: 'images',
  sound: 'sounds',
  music: 'music',
  voxelModel: 'voxelModels',
});

const MANIFEST_KEY_TO_KIND = Object.freeze(Object.fromEntries(Object.entries(KIND_TO_MANIFEST_KEY).map(([kind, key]) => [key, kind])));

const VALIDATORS = Object.freeze({
  construct: validateConstructDefinition,
  weapon: validateWeaponDefinition,
  pattern: validatePatternDefinition,
  enemyArchetype: validateEnemyArchetypePack,
  level: validateLevelDefinition,
});

export function createContentRegistry() {
  return {
    assets: new Map(CONTENT_ASSET_KINDS.map((kind) => [kind, new Map()])),
    packs: new Map(),
    warnings: [],
  };
}

export function validateContentPack(manifest, assetResolver) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(manifest)) return { valid: false, errors: ['Content pack manifest must be an object.'], warnings };

  if (!isCompatibleSchemaVersion(manifest.schemaVersion)) {
    errors.push(`Unsupported content pack schemaVersion "${manifest.schemaVersion ?? 'missing'}". Expected 0.x.`);
  }
  if (!isNonEmptyString(manifest.packId)) errors.push('packId must be a non-empty string.');
  if (!isNonEmptyString(manifest.displayName)) errors.push('displayName must be a non-empty string.');
  if (manifest.canonStatus != null && !CANON_STATUSES.includes(manifest.canonStatus)) {
    errors.push(`canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
  }
  if (manifest.tags != null && !isStringArray(manifest.tags)) warnings.push('tags should be an array of strings.');
  if (manifest.dependencies != null && !Array.isArray(manifest.dependencies)) errors.push('dependencies must be an array when provided.');

  if (!isPlainObject(manifest.assets)) {
    errors.push('assets must be an object.');
  } else {
    validateManifestAssets(manifest.assets, errors, warnings, assetResolver);
  }

  if (!manifest.author) warnings.push('Content pack has no author metadata.');
  if (!manifest.provenance) warnings.push('Content pack has no provenance metadata.');
  return { valid: errors.length === 0, errors, warnings };
}

export function loadContentBundle(bundle, options = {}) {
  const registry = options.registry ?? createContentRegistry();
  const errors = [];
  const warnings = [];
  const manifests = Array.isArray(bundle?.manifests) ? bundle.manifests : bundle?.manifest ? [bundle.manifest] : [];

  for (const manifest of manifests) {
    const report = validateContentPack(manifest);
    errors.push(...report.errors);
    warnings.push(...report.warnings.map((warning) => `${manifest?.packId ?? 'unknown pack'}: ${warning}`));
    if (report.valid) registry.packs.set(manifest.packId, freezeDefinition(manifest));
  }

  for (const asset of bundle?.assets ?? []) {
    try {
      registerContentAsset(registry, asset.kind, asset.definition, asset.sourcePack);
    } catch (error) {
      errors.push(error.message);
    }
  }

  registry.warnings.push(...warnings);
  return { registry, valid: errors.length === 0, errors, warnings };
}

export function registerContentAsset(registry, kind, definition, sourcePack = null) {
  if (!registry?.assets) throw new Error('A content registry is required.');
  if (!CONTENT_ASSET_KINDS.includes(kind)) throw new Error(`Unknown content asset kind "${kind}".`);
  if (!registry.assets.has(kind)) registry.assets.set(kind, new Map());

  const assetId = resourceAssetId(definition) ?? definition?.assetId;
  if (!isNonEmptyString(assetId)) throw new Error(`${kind} asset must include a non-empty assetId.`);

  const validator = VALIDATORS[kind];
  if (validator) {
    const report = validator(definition);
    if (!report.valid) throw new Error(`Invalid ${kind} "${assetId}": ${report.errors.join(' ')}`);
    registry.warnings.push(...report.warnings.map((warning) => `${kind}:${assetId}: ${warning}`));
  } else if (RESOURCE_ASSET_KINDS.includes(kind)) {
    validateResourceAsset(kind, definition);
  }

  const registered = freezeDefinition({ ...definition, assetId, sourcePack: sourcePack ?? definition.sourcePack ?? null });
  registry.assets.get(kind).set(assetId, registered);
  return registered;
}

export function getAvailableContent(registry, kind, filters = {}) {
  const assets = [...(registry?.assets?.get(kind)?.values() ?? [])];
  return assets.filter((asset) => matchesFilters(asset, filters));
}

export function resolveContentDependencies(rootAssetRefs, registry) {
  const missing = [];
  const resolved = [];
  const warnings = [];
  const queue = [...normalizeAssetRefs(rootAssetRefs)];
  const seen = new Set();

  while (queue.length > 0) {
    const ref = queue.shift();
    if (!ref?.kind) continue;
    const assetKey = ref.kind === 'pack' ? ref.packId : ref.assetId;
    const key = `${ref.kind}:${assetKey}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (ref.kind === 'pack') {
      const pack = registry?.packs?.get(ref.packId);
      if (!pack) {
        missing.push(ref);
      } else {
        resolved.push({ ref, asset: pack });
      }
      continue;
    }

    const asset = registry?.assets?.get(ref.kind)?.get(ref.assetId);
    if (!asset) {
      if (ref.required === false && RESOURCE_ASSET_KINDS.includes(ref.kind)) {
        warnings.push(`Optional ${ref.kind} asset "${ref.assetId}" is unavailable.`);
      } else {
        missing.push(ref);
      }
      continue;
    }
    resolved.push({ ref, asset });
    if (ref.kind === 'level') queue.push(...collectLevelDependencies(asset));
  }

  return { ok: missing.length === 0, resolved, missing, warnings };
}

export function instantiateLevel(levelId, registry, seed = 0) {
  const level = registry?.assets?.get('level')?.get(levelId);
  if (!level) throw new Error(`Level "${levelId}" is not registered.`);
  const report = validateLevelDefinition(level);
  if (!report.valid) throw new Error(`Invalid level "${levelId}": ${report.errors.join(' ')}`);

  const dependencies = resolveContentDependencies([{ kind: 'level', assetId: levelId }], registry);
  if (!dependencies.ok) {
    const missing = dependencies.missing.map((ref) => `${ref.kind}:${ref.assetId ?? ref.packId}`).join(', ');
    throw new Error(`Level "${levelId}" has unresolved dependencies: ${missing}`);
  }

  return {
    seed,
    definition: level,
    dependencies: dependencies.resolved,
  };
}

function validateManifestAssets(assets, errors, warnings, assetResolver) {
  let assetCount = 0;
  for (const [key, entries] of Object.entries(assets)) {
    if (!CONTENT_MANIFEST_ASSET_KEYS.includes(key)) {
      warnings.push(`assets.${key} is reserved or not recognized by Prototype 0.`);
      continue;
    }
    if (!Array.isArray(entries)) {
      errors.push(`assets.${key} must be an array.`);
      continue;
    }
    assetCount += entries.length;
    for (const [index, entry] of entries.entries()) {
      if (typeof entry !== 'string' && !isPlainObject(entry)) {
        errors.push(`assets.${key}[${index}] must be a path string or resource descriptor.`);
      }
      if (assetResolver && typeof entry === 'string' && assetResolver(entry, MANIFEST_KEY_TO_KIND[key]) == null) {
        warnings.push(`assets.${key}[${index}] could not be resolved by the current asset resolver.`);
      }
    }
  }
  if (assetCount === 0) warnings.push('Content pack has no assets.');
}

function validateResourceAsset(kind, definition) {
  if (!isPlainObject(definition)) throw new Error(`${kind} asset must be an object.`);
  if (!isNonEmptyString(resourceAssetId(definition))) throw new Error(`${kind} asset must include assetId.`);
  if (!isNonEmptyString(definition.path) && !isNonEmptyString(definition.uri)) throw new Error(`${kind} asset must include path or uri.`);
}

function normalizeAssetRefs(refs) {
  return (Array.isArray(refs) ? refs : [refs]).filter(Boolean).map((ref) => {
    if (typeof ref === 'string') return { kind: 'pack', packId: ref };
    return ref;
  });
}

function resourceAssetId(definition) {
  return definition?.assetId ?? definition?.id;
}

function matchesFilters(asset, filters) {
  if (filters.sourcePack != null && asset.sourcePack !== filters.sourcePack) return false;
  if (filters.canonStatus != null && asset.canonStatus !== filters.canonStatus) return false;
  if (filters.tag != null && !(asset.tags ?? []).includes(filters.tag)) return false;
  return true;
}

function freezeDefinition(value) {
  return deepFreeze(structuredClone(value));
}

function deepFreeze(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

import {
  CONTENT_MANIFEST_ASSET_KEYS,
  createContentRegistry,
  contentKindForManifestKey,
  instantiateLevel,
  loadContentBundle,
  manifestKeyForContentKind,
} from './contentRegistry.js';
import { CONTENT_SCHEMA_VERSION, isPlainObject } from './contentSchema.js';

export const LOCAL_CONTENT_STORAGE_KEY = 'weyfinder.prototype0.localContentPacks';

export async function readLocalContentFiles(fileList) {
  const files = Array.from(fileList ?? []);
  return Promise.all(
    files.map(async (file) => ({
      name: file.name ?? '',
      path: normalizeContentPath(file.webkitRelativePath || file.relativePath || file.path || file.name || ''),
      type: file.type ?? '',
      text: typeof file.text === 'function' ? await file.text() : String(file.text ?? ''),
    })),
  );
}

export async function installLocalContentFiles(fileList, options = {}) {
  const files = await readLocalContentFiles(fileList);
  const bundle = createLocalContentBundleFromFiles(files, options);
  return installLocalContentBundle(bundle, options);
}

export function createLocalContentBundleFromFiles(files, options = {}) {
  const parsedFiles = parseJsonContentFiles(files);
  const manifests = parsedFiles.filter((file) => isContentPackManifest(file.json));
  if (manifests.length === 0) return createLooseAssetBundle(parsedFiles, options);

  const assets = [];
  const errors = [];
  const warnings = [];
  for (const manifestFile of manifests) {
    for (const [assetKey, entries] of Object.entries(manifestFile.json.assets ?? {})) {
      const kind = contentKindForManifestKey(assetKey);
      if (!kind || !CONTENT_MANIFEST_ASSET_KEYS.includes(assetKey) || !Array.isArray(entries)) continue;
      for (const entry of entries) {
        const result = resolveManifestAsset(entry, manifestFile, parsedFiles, kind);
        if (result.error) errors.push(result.error);
        if (result.warning) warnings.push(result.warning);
        if (result.asset) assets.push({ ...result.asset, sourcePack: manifestFile.json.packId });
      }
    }
  }

  return {
    manifests: manifests.map((file) => withLocalMetadata(file.json, file.path, options)),
    assets,
    files: parsedFiles.map(({ path, name }) => ({ path, name })),
    errors,
    warnings,
  };
}

export function installLocalContentBundle(bundle, options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const validation = loadContentBundle(bundle, { registry: createContentRegistry() });
  if (!validation.valid || (bundle.errors ?? []).length > 0) {
    return {
      ok: false,
      registry: validation.registry,
      errors: [...(bundle.errors ?? []), ...validation.errors],
      warnings: [...(bundle.warnings ?? []), ...validation.warnings],
    };
  }

  const library = loadLocalContentLibrary(storage);
  for (const manifest of bundle.manifests ?? []) {
    const packId = manifest.packId;
    library.packs[packId] = {
      manifest,
      assets: (bundle.assets ?? [])
        .filter((asset) => asset.sourcePack === packId)
        .map(({ kind, definition, sourcePack }) => ({ kind, definition, sourcePack })),
      installedAt: options.installedAt ?? new Date().toISOString(),
    };
  }
  saveLocalContentLibrary(storage, library);

  return {
    ok: true,
    registry: validation.registry,
    installedPacks: (bundle.manifests ?? []).map((manifest) => manifest.packId),
    errors: [],
    warnings: [...(bundle.warnings ?? []), ...validation.warnings],
  };
}

export function loadLocalContentLibrary(storage = globalThis.localStorage) {
  const empty = { schemaVersion: CONTENT_SCHEMA_VERSION, packs: {} };
  if (!storage) return empty;
  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_CONTENT_STORAGE_KEY) ?? 'null');
    if (!isPlainObject(parsed) || !isPlainObject(parsed.packs)) return empty;
    return { schemaVersion: parsed.schemaVersion ?? CONTENT_SCHEMA_VERSION, packs: parsed.packs };
  } catch {
    return empty;
  }
}

export function saveLocalContentLibrary(storage, library) {
  if (!storage) return;
  storage.setItem(LOCAL_CONTENT_STORAGE_KEY, JSON.stringify(library));
}

export function listLocalContentPacks(storage = globalThis.localStorage) {
  return Object.values(loadLocalContentLibrary(storage).packs).map((entry) => ({
    packId: entry.manifest?.packId,
    displayName: entry.manifest?.displayName ?? entry.manifest?.packId,
    canonStatus: entry.manifest?.canonStatus ?? 'COMMUNITY',
    assetCounts: countAssetsByKind(entry.assets),
    installedAt: entry.installedAt ?? null,
  }));
}

export function removeLocalContentPack(packId, storage = globalThis.localStorage) {
  const library = loadLocalContentLibrary(storage);
  const existed = Object.prototype.hasOwnProperty.call(library.packs, packId);
  delete library.packs[packId];
  saveLocalContentLibrary(storage, library);
  return existed;
}

export function createRegistryWithLocalContent(storage = globalThis.localStorage, baseRegistry = createContentRegistry()) {
  const library = loadLocalContentLibrary(storage);
  const reports = [];
  for (const entry of Object.values(library.packs)) {
    reports.push(loadContentBundle({ manifests: [entry.manifest], assets: entry.assets }, { registry: baseRegistry }));
  }
  return {
    registry: baseRegistry,
    reports,
    ok: reports.every((report) => report.valid),
    errors: reports.flatMap((report) => report.errors),
    warnings: reports.flatMap((report) => report.warnings),
  };
}

export function instantiateLocalLevel(levelId, options = {}) {
  const { registry } = createRegistryWithLocalContent(options.storage, options.registry ?? createContentRegistry());
  return instantiateLevel(levelId, registry, options.seed ?? 0);
}

export function inferContentKind(definition) {
  if (!isPlainObject(definition)) return null;
  if (isContentPackManifest(definition)) return 'pack';
  if (Array.isArray(definition.archetypes)) return 'enemyArchetype';
  if (definition.emitter) return 'pattern';
  if (definition.projectile && definition.ammo != null) return 'weapon';
  if (definition.background && definition.route) return 'level';
  if (Array.isArray(definition.cells) && Array.isArray(definition.connections)) return 'construct';
  if (definition.path || definition.uri) return definition.kind ?? null;
  return null;
}

export function normalizeContentPath(path) {
  const parts = String(path ?? '')
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part && part !== '.');
  const normalized = [];
  for (const part of parts) {
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }
  return normalized.join('/');
}

function parseJsonContentFiles(files) {
  return (files ?? [])
    .map((file) => {
      try {
        return {
          name: file.name ?? basename(file.path),
          path: normalizeContentPath(file.path || file.name || ''),
          json: JSON.parse(file.text),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isContentPackManifest(definition) {
  return isPlainObject(definition) && isPlainObject(definition.assets) && typeof definition.packId === 'string';
}

function createLooseAssetBundle(parsedFiles, options) {
  const packId = options.packId ?? `local.${Date.now()}`;
  const assets = [];
  const manifestAssets = Object.fromEntries(CONTENT_MANIFEST_ASSET_KEYS.map((key) => [key, []]));
  for (const file of parsedFiles) {
    const kind = inferContentKind(file.json);
    if (!kind || kind === 'pack') continue;
    const assetKey = manifestKeyForContentKind(kind);
    if (!assetKey) continue;
    manifestAssets[assetKey].push(file.path || file.name);
    assets.push({ kind, definition: file.json, sourcePack: packId });
  }
  const manifest = {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    packId,
    displayName: options.displayName ?? 'Local Content Pack',
    author: options.author ?? 'Local creator',
    provenance: 'Imported from local browser storage.',
    canonStatus: options.canonStatus ?? 'COMMUNITY',
    description: options.description ?? 'Loose local assets grouped by the runtime importer.',
    tags: options.tags ?? ['local'],
    dependencies: [],
    assets: Object.fromEntries(Object.entries(manifestAssets).filter(([, entries]) => entries.length > 0)),
  };
  return { manifests: [withLocalMetadata(manifest, null, options)], assets, files: parsedFiles.map(({ path, name }) => ({ path, name })), errors: [], warnings: [] };
}

function resolveManifestAsset(entry, manifestFile, parsedFiles, kind) {
  if (typeof entry !== 'string') {
    return { asset: { kind, definition: entry } };
  }
  const resolvedPath = resolveRelativeContentPath(manifestFile.path, entry);
  const file = findParsedFile(parsedFiles, resolvedPath, entry);
  if (!file) return { error: `${manifestFile.json.packId}: could not find ${kind} asset "${entry}".` };
  return { asset: { kind, definition: file.json } };
}

function resolveRelativeContentPath(basePath, relativePath) {
  const base = dirname(basePath);
  return normalizeContentPath(`${base}/${relativePath}`);
}

function findParsedFile(files, resolvedPath, originalPath) {
  const normalizedOriginal = normalizeContentPath(originalPath);
  const direct = files.find((file) => file.path === resolvedPath || file.path === normalizedOriginal);
  if (direct) return direct;
  const name = basename(normalizedOriginal);
  const matches = files.filter((file) => basename(file.path) === name);
  return matches.length === 1 ? matches[0] : null;
}

function withLocalMetadata(manifest, sourcePath, options) {
  return {
    ...manifest,
    canonStatus: manifest.canonStatus ?? options.canonStatus ?? 'COMMUNITY',
    sourcePath: sourcePath ?? manifest.sourcePath ?? null,
    localOnly: true,
  };
}

function countAssetsByKind(assets = []) {
  const counts = {};
  for (const asset of assets) counts[asset.kind] = (counts[asset.kind] ?? 0) + 1;
  return counts;
}

function dirname(path) {
  const normalized = normalizeContentPath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

function basename(path) {
  const normalized = normalizeContentPath(path);
  const index = normalized.lastIndexOf('/');
  return index < 0 ? normalized : normalized.slice(index + 1);
}

import {
  createContentRegistry,
  loadContentBundle,
  manifestKeyForContentKind,
} from '../core/contentRegistry.js';
import { collectLevelDependencies } from '../core/levelDefinition.js';
import { sandboxDefinitionFromEnemy, sandboxDefinitionFromLevel } from '../core/sandboxMode.js';

export const CREATOR_ASSET_HANDOFF_STORAGE_KEY = 'weyfinder.creator.assetHandoff';
export const CREATOR_TEST_REQUEST_STORAGE_KEY = 'weyfinder.creator.testRequest';
export const SANDBOX_DEFINITION_STORAGE_KEY = 'weyfinder.prototype0.sandboxDefinition';

const EDITOR_ROUTES = Object.freeze({
  construct: './construct-workshop.html',
  enemy: './enemy-editor.html',
  weapon: './weapon-pattern-lab.html',
  pattern: './weapon-pattern-lab.html',
  statusEffect: './weapon-pattern-lab.html',
  level: './level-editor.html',
  encounter: './encounter-editor.html',
  material: './material-lighting-editor.html',
  lightingPreset: './material-lighting-editor.html',
});

export function listPackAssets(packEntry) {
  const entries = [];
  for (const asset of packEntry?.assets ?? []) {
    if (asset.kind === 'enemyArchetype' && Array.isArray(asset.definition?.archetypes)) {
      for (const archetype of asset.definition.archetypes) {
        entries.push({
          key: `enemy:${archetype.id}`,
          kind: 'enemy',
          assetId: archetype.id,
          displayName: archetype.displayName ?? archetype.id,
          definition: archetype,
          containerDefinition: asset.definition,
          sourcePack: asset.sourcePack,
        });
      }
      continue;
    }
    const assetId = asset.definition?.assetId ?? asset.definition?.id;
    entries.push({
      key: `${asset.kind}:${assetId}`,
      kind: asset.kind,
      assetId,
      displayName: asset.definition?.displayName ?? asset.definition?.label ?? assetId,
      definition: asset.definition,
      sourcePack: asset.sourcePack,
    });
  }
  return entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.displayName.localeCompare(right.displayName));
}

export function validatePackEntry(packEntry) {
  if (!packEntry) return { valid: false, errors: ['Select an installed pack.'], warnings: [] };
  const report = loadContentBundle(
    { manifests: [packEntry.manifest], assets: packEntry.assets },
    { registry: createContentRegistry() },
  );
  return { valid: report.valid, errors: report.errors, warnings: report.warnings };
}

export function createPackDependencyReport(packEntry, library) {
  const refs = [];
  for (const dependency of packEntry?.manifest?.dependencies ?? []) refs.push(normalizeDependency(dependency));
  for (const asset of packEntry?.assets ?? []) {
    if (asset.kind === 'level') refs.push(...collectLevelDependencies(asset.definition));
    if (asset.kind === 'enemyArchetype') {
      for (const archetype of asset.definition?.archetypes ?? []) {
        if (archetype.construct) refs.push({ kind: 'construct', assetId: archetype.construct, required: true });
        for (const pattern of archetype.patterns ?? []) refs.push({ kind: 'pattern', assetId: pattern, required: true });
      }
    }
  }

  const localPacks = library?.packs ?? {};
  const localAssets = new Set();
  for (const entry of Object.values(localPacks)) {
    for (const asset of entry.assets ?? []) {
      const id = asset.definition?.assetId ?? asset.definition?.id;
      if (id) localAssets.add(`${asset.kind}:${id}`);
      if (asset.kind === 'enemyArchetype') {
        for (const archetype of asset.definition?.archetypes ?? []) localAssets.add(`enemy:${archetype.id}`);
      }
    }
  }

  const unique = new Map();
  for (const ref of refs.filter(Boolean)) {
    const id = ref.kind === 'pack' ? ref.packId : ref.assetId;
    if (!ref.kind || !id) continue;
    const key = `${ref.kind}:${id}`;
    if (!unique.has(key)) {
      const local = ref.kind === 'pack' ? Boolean(localPacks[id]) : localAssets.has(key);
      unique.set(key, { ...ref, id, key, local, status: local ? 'INSTALLED LOCAL' : 'BUNDLED / EXTERNAL' });
    }
  }
  return [...unique.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function createPortablePack(packEntry) {
  if (!packEntry?.manifest) throw new Error('Select an installed pack before exporting.');
  const assets = {};
  for (const asset of packEntry.assets ?? []) {
    const key = manifestKeyForContentKind(asset.kind);
    if (!key) continue;
    (assets[key] ??= []).push(clone(asset.definition));
  }
  const { sourcePath, localOnly, ...manifest } = packEntry.manifest;
  return { ...clone(manifest), assets };
}

export function editorRouteForAsset(asset) {
  return EDITOR_ROUTES[asset?.kind] ?? null;
}

export function createEditorAssetHandoff(asset) {
  const route = editorRouteForAsset(asset);
  if (!route) throw new Error(`No matching editor is available for ${asset?.kind ?? 'this asset'}.`);
  return {
    schemaVersion: '0.1',
    kind: asset.kind,
    assetId: asset.assetId,
    definition: clone(asset.definition),
    containerDefinition: asset.containerDefinition ? clone(asset.containerDefinition) : null,
  };
}

export function createCreatorTestRequest(asset) {
  if (!asset) throw new Error('Select an asset to test.');
  let sandboxDefinition;
  if (asset.kind === 'enemy') {
    sandboxDefinition = sandboxDefinitionFromEnemy(asset.assetId, { title: `Test Enemy: ${asset.displayName}` });
  } else if (asset.kind === 'level') {
    sandboxDefinition = sandboxDefinitionFromLevel(asset.definition);
  } else if (asset.kind === 'encounter') {
    sandboxDefinition = {
      schemaVersion: '0.1',
      title: `Test Encounter: ${asset.displayName}`,
      duration: 300,
      level: 1,
      completeOnEmpty: false,
      spawns: [],
      events: [
        { id: 'no-combat-spawn', type: 'spawn', at: 0, spawns: [] },
        { id: 'starting-scrap', type: 'setScrap', at: 0, value: 120 },
        { id: 'test-encounter', type: 'encounter', at: 0.1, encounter: clone(asset.definition) },
      ],
    };
  } else {
    throw new Error('Sandbox tests are available for enemies, levels, and encounters.');
  }
  return {
    schemaVersion: '0.1',
    requestedAt: new Date().toISOString(),
    kind: asset.kind,
    assetId: asset.assetId,
    sandboxDefinition,
  };
}

function normalizeDependency(dependency) {
  if (typeof dependency === 'string') return { kind: 'pack', packId: dependency, required: true };
  if (!dependency || typeof dependency !== 'object') return null;
  return { required: dependency.required !== false, ...dependency };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

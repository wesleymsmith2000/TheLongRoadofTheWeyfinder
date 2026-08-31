import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createLocalContentBundleFromFiles, createRegistryWithLocalContent, installLocalContentBundle, instantiateLocalLevel, listLocalContentPacks, removeLocalContentPack } from '../src/core/localContentLibrary.js';

const construct = {
  schemaVersion: '0.1',
  assetId: 'community.basic_turret',
  displayName: 'Community Turret',
  cells: [
    { id: 'core', type: 'core', gridX: 0, gridY: 0 },
    { id: 'gun', type: 'gun', gridX: 1, gridY: 0 },
  ],
  connections: [{ a: 'core', b: 'gun', aSide: 'right' }],
  modules: [],
};

const pattern = {
  schemaVersion: '0.1',
  assetId: 'community.aimed',
  interval: 1,
  emitter: {
    kind: 'aimed',
    target: 'player',
    count: 1,
    speed: 50,
    projectile: {
      team: 'enemy',
      behavior: 'ballistic',
      radius: 1,
      damage: 1,
      impulse: 1,
      lifetime: 1,
    },
  },
};

const level = {
  schemaVersion: '0.1',
  assetId: 'community.test_level',
  background: {
    mode: 'procedural',
    layers: [{ id: 'grid', source: 'procedural', generator: 'roadGrid', parallax: 1 }],
  },
  route: {
    startHeading: 0,
    segments: [{ id: 'straight', length: 100, turnRadians: 0 }],
  },
  waves: [
    {
      id: 'wave1',
      atDistance: 10,
      spawn: [{ construct: 'community.basic_turret', count: 1, laneOffset: 0, spacing: 0, patterns: ['community.aimed'] }],
    },
  ],
  obstacles: [],
  triggers: [],
};

const enemyArchetypePack = {
  schemaVersion: '0.1',
  assetId: 'community.enemy_archetypes',
  displayName: 'Community Enemy Archetypes',
  canonStatus: 'COMMUNITY',
  archetypes: [
    {
      id: 'community.fabric_raider',
      displayName: 'Fabric Raider',
      runtimeFactory: 'createEnemy',
      construct: 'community.basic_turret',
      patterns: ['community.aimed'],
      entry: { kind: 'aheadDrift', direction: 'roadForward', speed: 32 },
      movementProfiles: [{ id: 'weave', kind: 'weave', target: 'player', amplitude: 14, frequency: 0.8 }],
      aggregate: { kind: 'singleBody' },
      cellAnimations: [{ selector: 'type:armor', kind: 'fabricWeave', amplitude: 9, frequency: 1.1, opacityMin: 0.4, opacityMax: 0.85 }],
      editable: ['construct', 'patterns', 'movementProfiles', 'cellAnimations'],
    },
  ],
};

test('local manifest files become a validated content bundle', () => {
  const manifest = {
    schemaVersion: '0.1',
    packId: 'community.test_pack',
    displayName: 'Community Test Pack',
    author: 'Test',
    provenance: 'Unit test',
    canonStatus: 'COMMUNITY',
    assets: {
      constructs: ['../constructs/turret.json'],
      patterns: ['../patterns/aimed.json'],
      levels: ['../levels/test.json'],
    },
  };
  const bundle = createLocalContentBundleFromFiles([
    file('content/packs/community.test_pack.json', manifest),
    file('content/constructs/turret.json', construct),
    file('content/patterns/aimed.json', pattern),
    file('content/levels/test.json', level),
  ]);

  assert.deepEqual(bundle.errors, []);
  assert.equal(bundle.manifests[0].packId, 'community.test_pack');
  assert.equal(bundle.assets.length, 3);
});

test('local content packs persist, rehydrate, and instantiate levels', () => {
  const storage = memoryStorage();
  const bundle = createLocalContentBundleFromFiles([
    file('turret.json', construct),
    file('aimed.json', pattern),
    file('test.json', level),
  ], { packId: 'local.loose_pack', displayName: 'Loose Pack' });

  const installed = installLocalContentBundle(bundle, { storage, installedAt: '2026-08-31T00:00:00.000Z' });
  assert.equal(installed.ok, true);
  assert.deepEqual(listLocalContentPacks(storage).map((pack) => pack.packId), ['local.loose_pack']);

  const hydrated = createRegistryWithLocalContent(storage);
  assert.equal(hydrated.ok, true);
  assert.equal(hydrated.registry.assets.get('construct').has('community.basic_turret'), true);

  const runPackage = instantiateLocalLevel('community.test_level', { storage, seed: 7 });
  assert.equal(runPackage.seed, 7);
  assert.equal(runPackage.definition.assetId, 'community.test_level');
  assert.equal(removeLocalContentPack('local.loose_pack', storage), true);
  assert.deepEqual(listLocalContentPacks(storage), []);
});

test('local content packs register enemy archetype descriptors', () => {
  const storage = memoryStorage();
  const manifest = {
    schemaVersion: '0.1',
    packId: 'community.enemy_pack',
    displayName: 'Community Enemy Pack',
    author: 'Test',
    provenance: 'Unit test',
    canonStatus: 'COMMUNITY',
    assets: {
      enemyArchetypes: ['enemies/enemy_archetypes.json'],
    },
  };
  const installed = installLocalContentBundle({
    manifests: [manifest],
    assets: [{ kind: 'enemyArchetype', definition: enemyArchetypePack, sourcePack: 'community.enemy_pack' }],
    files: [],
    errors: [],
    warnings: [],
  }, { storage, installedAt: '2026-08-31T00:00:00.000Z' });

  assert.equal(installed.ok, true);
  assert.deepEqual(listLocalContentPacks(storage)[0].assetCounts, { enemyArchetype: 1 });

  const hydrated = createRegistryWithLocalContent(storage);
  assert.equal(hydrated.ok, true);
  assert.equal(hydrated.registry.assets.get('enemyArchetype').has('community.enemy_archetypes'), true);
});

test('loose local status effect assets are grouped into packs', () => {
  const bundle = createLocalContentBundleFromFiles(
    [file('fire.json', { schemaVersion: '0.1', id: 'creator.fire', type: 'fire' })],
    { packId: 'local.effects' },
  );
  assert.equal(bundle.assets[0].kind, 'statusEffect');
  assert.deepEqual(bundle.manifests[0].assets.statusEffects, ['fire.json']);
});

test('example prototype module set imports as a local content pack', () => {
  const files = readJsonFiles(join(process.cwd(), 'content', 'examples', 'prototype0-module-set'));
  const bundle = createLocalContentBundleFromFiles(files);

  assert.deepEqual(bundle.errors, []);
  assert.equal(bundle.manifests[0].packId, 'example.prototype0_module_set');
  assert.equal(bundle.assets.length, 11);

  const storage = memoryStorage();
  const installed = installLocalContentBundle(bundle, { storage, installedAt: '2026-08-31T00:00:00.000Z' });
  assert.equal(installed.ok, true);

  const hydrated = createRegistryWithLocalContent(storage);
  assert.equal(hydrated.ok, true);
  assert.equal(hydrated.registry.assets.get('level').has('example.prototype0_road_trial'), true);
  assert.equal(hydrated.registry.assets.get('statusEffect').has('example.acid_splash'), true);

  const runPackage = instantiateLocalLevel('example.prototype0_road_trial', { storage, seed: 19 });
  assert.equal(runPackage.definition.assetId, 'example.prototype0_road_trial');
  assert.equal(runPackage.seed, 19);
});

function file(path, json) {
  return { name: path.split('/').at(-1), path, text: JSON.stringify(json) };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function readJsonFiles(root) {
  const files = [];
  visit(root);
  return files;

  function visit(directory) {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      if (statSync(absolutePath).isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.endsWith('.json')) continue;
      const path = relative(process.cwd(), absolutePath).replaceAll('\\', '/');
      files.push({ name: entry, path, text: readFileSync(absolutePath, 'utf8') });
    }
  }
}

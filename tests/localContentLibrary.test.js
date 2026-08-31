import test from 'node:test';
import assert from 'node:assert/strict';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import prototypeLevel from '../content/levels/prototype0_road_trial.json' with { type: 'json' };
import sampleEncounter from '../content/encounters/moonlit_beacon_choice_vignette.json' with { type: 'json' };
import { createLocalContentBundleFromFiles } from '../src/core/localContentLibrary.js';
import { consumeEditorAssetHandoff, queueEditorAssetHandoff } from '../src/editor/editorAssetHandoff.js';
import {
  createCreatorTestRequest,
  createEditorAssetHandoff,
  createPackDependencyReport,
  createPortablePack,
  editorRouteForAsset,
  listPackAssets,
} from '../src/editor/modTestBench.js';

const enemyPack = {
  schemaVersion: '0.1',
  assetId: 'local.enemy.examples',
  displayName: 'Local Enemy Examples',
  archetypes: [
    {
      id: 'local.enemy.test',
      displayName: 'Test Enemy',
      runtimeFactory: 'createEnemy',
      construct: 'local.construct.test',
      patterns: ['local.pattern.test'],
      entry: { kind: 'aheadDrift' },
    },
  ],
};

function packEntry() {
  return {
    manifest: {
      schemaVersion: '0.1',
      packId: 'local.test.pack',
      displayName: 'Local Test Pack',
      author: 'Test',
      provenance: 'Test fixture',
      assets: {
        enemyArchetypes: ['enemies.json'],
        levels: ['level.json'],
        encounters: ['encounter.json'],
      },
      dependencies: [{ kind: 'pack', packId: 'canon.prototype0', required: true }],
    },
    assets: [
      { kind: 'enemyArchetype', definition: enemyPack, sourcePack: 'local.test.pack' },
      { kind: 'level', definition: prototypeLevel, sourcePack: 'local.test.pack' },
      { kind: 'encounter', definition: sampleEncounter, sourcePack: 'local.test.pack' },
    ],
  };
}

test('test bench expands enemy packs into directly selectable enemies', () => {
  const assets = listPackAssets(packEntry());
  const enemy = assets.find((asset) => asset.kind === 'enemy');

  assert.equal(enemy.assetId, 'local.enemy.test');
  assert.equal(enemy.containerDefinition.assetId, 'local.enemy.examples');
  assert.equal(editorRouteForAsset(enemy), './enemy-editor.html');
});

test('portable pack export can be parsed as a single-file inline manifest', () => {
  const portable = createPortablePack(packEntry());
  const bundle = createLocalContentBundleFromFiles([
    { name: 'local.test.pack.json', path: 'local.test.pack.json', text: JSON.stringify(portable) },
  ]);

  assert.equal(bundle.manifests[0].packId, 'local.test.pack');
  assert.equal(bundle.assets.length, 3);
  assert.equal(bundle.assets.every((asset) => asset.sourcePack === 'local.test.pack'), true);
});

test('test bench creates prepared sandbox scripts for supported asset kinds', () => {
  const assets = listPackAssets(packEntry());
  const enemyRequest = createCreatorTestRequest(assets.find((asset) => asset.kind === 'enemy'));
  const levelRequest = createCreatorTestRequest(assets.find((asset) => asset.kind === 'level'));
  const encounterRequest = createCreatorTestRequest(assets.find((asset) => asset.kind === 'encounter'));

  assert.equal(enemyRequest.sandboxDefinition.spawns[0].archetype, 'local.enemy.test');
  assert.equal(levelRequest.sandboxDefinition.sourceLevelId, prototypeLevel.assetId);
  assert.equal(encounterRequest.sandboxDefinition.events.some((event) => event.type === 'encounter'), true);
});

test('dependency report distinguishes installed local assets from external dependencies', () => {
  const entry = packEntry();
  const library = { packs: { 'local.test.pack': entry } };
  const report = createPackDependencyReport(entry, library);

  assert.equal(report.find((dependency) => dependency.key === 'pack:canon.prototype0').status, 'BUNDLED / EXTERNAL');
  assert.equal(report.find((dependency) => dependency.key === 'construct:local.construct.test').local, false);
});

test('editor asset handoffs are single-use and kind-scoped', () => {
  const storage = memoryStorage();
  const enemy = listPackAssets(packEntry()).find((asset) => asset.kind === 'enemy');
  queueEditorAssetHandoff(storage, createEditorAssetHandoff(enemy));

  assert.equal(consumeEditorAssetHandoff(['level'], { storage }), null);
  assert.equal(consumeEditorAssetHandoff(['enemy'], { storage }).assetId, 'local.enemy.test');
  assert.equal(consumeEditorAssetHandoff(['enemy'], { storage }), null);
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

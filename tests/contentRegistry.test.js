import test from 'node:test';
import assert from 'node:assert/strict';
import canonPackManifest from '../content/packs/canon.prototype0.json' with { type: 'json' };
import basicTurretDefinition from '../content/constructs/basic_turret.json' with { type: 'json' };
import prototypeLevelDefinition from '../content/levels/prototype0_road_trial.json' with { type: 'json' };
import aimedPatternDefinition from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import radialPatternDefinition from '../content/patterns/enemy_radial_burst.json' with { type: 'json' };
import { createContentRegistry, getAvailableContent, instantiateLevel, registerContentAsset, resolveContentDependencies, validateContentPack } from '../src/core/contentRegistry.js';

test('canon content pack manifest validates for registry import', () => {
  const report = validateContentPack(canonPackManifest);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('content registry registers immutable runtime asset definitions', () => {
  const registry = createContentRegistry();
  const registered = registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);

  assert.equal(registered.assetId, 'basic_turret');
  assert.equal(registered.sourcePack, 'canon.prototype0');
  assert.equal(Object.isFrozen(registered), true);
  assert.deepEqual(
    getAvailableContent(registry, 'construct', { tag: 'enemy' }).map((definition) => definition.assetId),
    ['basic_turret'],
  );
});

test('level dependency resolution reports missing simulation assets before play', () => {
  const registry = createContentRegistry();
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const report = resolveContentDependencies([{ kind: 'level', assetId: 'prototype0_road_trial' }], registry);
  assert.equal(report.ok, false);
  assert.equal(report.missing.some((dependency) => dependency.kind === 'construct' && dependency.assetId === 'basic_turret'), true);
  assert.equal(report.missing.some((dependency) => dependency.kind === 'pattern' && dependency.assetId === 'enemy_aimed_shot'), true);
});

test('instantiateLevel returns a validated level package once required dependencies are registered', () => {
  const registry = createContentRegistry();
  registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', aimedPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', radialPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const runPackage = instantiateLevel('prototype0_road_trial', registry, 1147);
  assert.equal(runPackage.seed, 1147);
  assert.equal(runPackage.definition.assetId, 'prototype0_road_trial');
  assert.equal(runPackage.dependencies.some(({ ref }) => ref.kind === 'level' && ref.assetId === 'prototype0_road_trial'), true);
  assert.equal(runPackage.dependencies.some(({ ref }) => ref.kind === 'sound' && ref.assetId === 'voiceover.prototype0.intro'), false);
});

test('optional level resources warn instead of blocking dependency resolution', () => {
  const registry = createContentRegistry();
  registerContentAsset(registry, 'construct', basicTurretDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', aimedPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'pattern', radialPatternDefinition, canonPackManifest.packId);
  registerContentAsset(registry, 'level', prototypeLevelDefinition, canonPackManifest.packId);

  const report = resolveContentDependencies([{ kind: 'level', assetId: 'prototype0_road_trial' }], registry);
  assert.equal(report.ok, true);
  assert.equal(report.warnings.some((warning) => warning.includes('voiceover.prototype0.intro')), true);
});

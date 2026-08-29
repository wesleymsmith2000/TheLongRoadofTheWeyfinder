import test from 'node:test';
import assert from 'node:assert/strict';
import prototypeLevelDefinition from '../content/levels/prototype0_road_trial.json' with { type: 'json' };
import { collectLevelDependencies, createLevelPackagePlan, validateLevelDefinition } from '../src/core/levelDefinition.js';

test('prototype level asset validates', () => {
  const report = validateLevelDefinition(prototypeLevelDefinition);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
});

test('level dependency collection includes referenced waves, patterns, and trigger resources', () => {
  const dependencies = collectLevelDependencies(prototypeLevelDefinition);
  assert.deepEqual(
    dependencies.filter((dependency) => dependency.kind === 'construct').map((dependency) => dependency.assetId),
    ['basic_turret'],
  );
  assert.equal(dependencies.some((dependency) => dependency.kind === 'pattern' && dependency.assetId === 'enemy_aimed_shot'), true);
  assert.equal(dependencies.some((dependency) => dependency.kind === 'sound' && dependency.assetId === 'voiceover.prototype0.intro' && dependency.required === false), true);
});

test('level package plan groups simulation assets and resources for bundled import', () => {
  const plan = createLevelPackagePlan(prototypeLevelDefinition);
  assert.equal(plan.levelId, 'prototype0_road_trial');
  assert.equal(plan.assetGroups.simulation.includes('construct'), true);
  assert.equal(plan.assetGroups.resources.includes('music'), true);
  assert.equal(plan.dependencies.length >= prototypeLevelDefinition.dependencies.length, true);
});

test('level validation rejects missing route segment lengths', () => {
  const report = validateLevelDefinition({
    ...prototypeLevelDefinition,
    route: { ...prototypeLevelDefinition.route, segments: [{ id: 'broken', turnRadians: 0 }] },
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('route.segments[0].length')), true);
});

test('level validation warns for declared external pack dependencies', () => {
  const report = validateLevelDefinition({
    ...prototypeLevelDefinition,
    dependencies: ['community.soundtrack-pack'],
  });
  assert.equal(report.valid, true);
  assert.equal(report.warnings.some((warning) => warning.includes('Pack dependency resolution')), true);
});

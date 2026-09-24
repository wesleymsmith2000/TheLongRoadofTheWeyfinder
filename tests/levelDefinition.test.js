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
  assert.equal(dependencies.some((dependency) => dependency.kind === 'encounter' && dependency.assetId === 'encounter.moonlit_beacon_choice_vignette'), true);
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

test('level validation accepts optional lighting presets', () => {
  const report = validateLevelDefinition({
    ...prototypeLevelDefinition,
    lighting: {
      preset: 'MOONLIGHT',
      ambientIntensity: 0.42,
      keyLightDirection: { x: -0.5, y: -1 },
      darknessOverlay: 0.3,
    },
  });

  assert.equal(report.valid, true);
});

test('level validation rejects unknown lighting presets', () => {
  const report = validateLevelDefinition({
    ...prototypeLevelDefinition,
    lighting: { preset: 'FULL_WEBGL_RAY_TRACING' },
  });

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('lighting.preset')), true);
});

test('level validation requires encounter trigger asset references', () => {
  const report = validateLevelDefinition({
    ...prototypeLevelDefinition,
    triggers: [{ id: 'choice-without-asset', kind: 'encounter', atDistance: 120 }],
  });

  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('assetRef is required for encounter triggers')), true);
});

test('level validation accepts obstacle motion and contact effects but rejects unknown motion verbs', () => {
  const level = structuredClone(prototypeLevelDefinition);
  level.obstacles = [{
    id: 'ash-front',
    kind: 'hazard',
    assetRef: 'voxel.ash_front',
    atDistance: 40,
    laneOffset: 0,
    motion: { mode: 'chase', targetGap: 120, triggerSpeed: 30, catchUpAcceleration: 55 },
    collision: { mode: 'trigger', shape: 'circle', radius: 80 },
    effects: { damagePerSecond: 5, accelerationScale: 0.6, primaryFireRateScale: 0, spinoutSeconds: 1 },
  }];

  assert.equal(validateLevelDefinition(level).valid, true);
  level.obstacles[0].motion.mode = 'teleportBehindPlayer';
  const invalid = validateLevelDefinition(level);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.some((error) => error.includes('motion.mode')), true);
});

test('level definitions validate relay navigation graphs and collect linked levels', () => {
  const level = structuredClone(prototypeLevelDefinition);
  level.navigationGraph = {
    schemaVersion: '0.1',
    assetId: 'navigation.prototype',
    initialNode: 'here',
    nodes: [
      { id: 'here', kind: 'level', levelId: level.assetId },
      { id: 'next', kind: 'level', levelId: 'community.next_level', destination: true },
    ],
    edges: [{ id: 'continue', from: 'here', to: 'next' }],
  };
  const report = validateLevelDefinition(level);
  const dependencies = collectLevelDependencies(level);
  assert.equal(report.valid, true);
  assert.equal(dependencies.some((dependency) => dependency.kind === 'level' && dependency.assetId === 'community.next_level'), true);
});

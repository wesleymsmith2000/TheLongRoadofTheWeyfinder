import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startNextLevel, stepGame } from '../src/core/game.js';
import { normalizeSandboxDefinition, sandboxDefinitionFromEnemy, sandboxDefinitionFromLevel, validateSandboxDefinition } from '../src/core/sandboxMode.js';
import { validateLevelDefinition } from '../src/core/levelDefinition.js';
import { emergencyPrimaryState } from '../src/core/emergencyWeapon.js';
import { stepDiverWaves } from '../src/core/diverEnemy.js';
import { ARCADE_TERRAIN_CONFIG, DEFAULT_TERRAIN_CONFIG } from '../src/core/terrainConfig.js';
import trial from '../content/levels/ghost_forrest_music_trial.json' with { type: 'json' };
import ghost from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import pattern from '../content/examples/prototype0-zone-enemy-set/patterns/example.ghost_phase_homing_radial.json' with { type: 'json' };

test('Sandbox selects Arcade rules at the simulation boundary and preserves legacy/default input', () => {
  assert.equal(normalizeSandboxDefinition({ runMode: 'lite' }).runMode, 'arcade');
  assert.equal(normalizeSandboxDefinition({}).runMode, 'normal');
  assert.equal(validateSandboxDefinition({ runMode: 'unknown', spawns: [] }).valid, false);
  const definition = sandboxDefinitionFromEnemy('mortar_skiff.prototype0', { runMode: 'arcade', music: 'GhostForrestPathway_1' });
  const game = createGame(17, { sandbox: definition });
  assert.equal(game.runMode, 'arcade');
  assert.equal(game.vehicleDefinition.assetId, 'arcade_starting_vehicle');
  assert.equal(game.targetingMode, 'guided');
  assert.equal(game.currentMusic, definition.music);
  assert.equal(game.terrain.generator.config.tileSize, ARCADE_TERRAIN_CONFIG.tileSize);
  assert.equal(game.road.baseSpeed, 60);
  assert.equal(game.diverWaves, null);
  assert.equal(game.arcadeBossStage, null);
  assert.equal(emergencyPrimaryState(game).enabled, true);
  const reset = stepGame(game, { resetPressed: true }, 0);
  assert.equal(reset.runMode, 'arcade');
  assert.equal(reset.currentMusic, definition.music);
  assert.equal(reset.sandbox.enabled, true);
  const normal = createGame(17, { sandbox: sandboxDefinitionFromEnemy('mortar_skiff.prototype0') });
  assert.equal(normal.terrain.generator.config.tileSize, DEFAULT_TERRAIN_CONFIG.tileSize);
  assert.equal(normal.targetingMode, 'mixed');
  assert.equal(emergencyPrimaryState(normal).enabled, false);
});

test('campaign preview matches the live Arcade schedule and spawns GhostForrest Diver flavor', () => {
  const options = { runMode: 'arcade', level: 19, useLevelSchedule: true, spawns: [], events: [] };
  const game = createGame(42, { sandbox: options });
  const live = createGame(42, { runMode: 'arcade', startLevel: 19 });
  assert.equal(game.currentMusic, 'GhostForrestPathway_1');
  assert.deepEqual(game.enemySpawnQueue.map(entry => entry.at), live.enemySpawnQueue.map(entry => entry.at));
  assert.deepEqual(game.diverWaves, live.diverWaves);
  game.diverWaves.nextIn = 0;
  stepDiverWaves(game, 0);
  const divers = game.enemies.filter(enemy => enemy.diver);
  assert.ok(divers.length > 0);
  assert.ok(divers.every(enemy => enemy.diver.theme === 'ghost' && enemy.diver.zone === 'GhostForrest'));
  game.levelComplete = true;
  startNextLevel(game);
  assert.equal(game.sandbox.enabled, true);
  assert.equal(game.sandbox.definition.level, 20);
  assert.equal(game.sandbox.definition.title, 'Campaign Level 20');
  assert.ok(game.arcadeBossStage?.pending.length > 0);
  assert.equal(game.diverWaves.stopAfterRequired, true);
  assert.equal(game.levelsCompleted, 0);
  assert.equal(game.bossLevelsCompleted, 0);
});

test('authored GhostForrest levels retain music, route-distance spawns and lighting in both rulesets', () => {
  assert.equal(validateLevelDefinition(trial).valid, true);
  assert.equal(validateLevelDefinition({ ...trial, music: 123 }).valid, false);
  for (const runMode of ['normal', 'arcade']) {
    const definition = sandboxDefinitionFromLevel(trial, { runMode });
    const game = createGame(19, { sandbox: definition, constructDefinitions: [ghost], patternDefinitions: [pattern] });
    assert.equal(game.currentMusic, trial.music);
    assert.deepEqual(game.road.route, trial.route);
    assert.deepEqual(game.environmentLighting, trial.lighting);
    assert.equal(game.road.baseSpeed, runMode === 'arcade' ? 60 : 30);
    assert.equal(game.enemySpawnQueue[0].triggerDistance, 120);
    assert.equal(game.enemySpawnQueue[2].triggerDistance, 1680);
    assert.equal(game.diverWaves, null);
    assert.equal(game.arcadeBossStage, null);
    game.road.routeDistance = 120;
    stepGame(game, {}, 0);
    assert.ok(game.enemies.some(enemy => enemy.assetId === ghost.assetId));
  }
});

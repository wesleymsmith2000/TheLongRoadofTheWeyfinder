import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createSandboxEnemySchedule, stepGame } from '../src/core/game.js';
import { Rng } from '../src/core/rng.js';
import { sandboxDefinitionFromEnemy, sandboxDefinitionFromLevel, validateSandboxDefinition } from '../src/core/sandboxMode.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';

const ROAD = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };

test('sandbox definitions normalize quick enemy frequency into spawn intervals', () => {
  const definition = sandboxDefinitionFromEnemy('mortar_skiff.prototype0', { count: 3, frequency: 2, spread: 48, level: 4 });
  assert.equal(definition.level, 4);
  assert.equal(definition.spawns[0].archetype, 'mortar_skiff.prototype0');
  assert.equal(definition.spawns[0].count, 3);
  assert.equal(definition.spawns[0].interval, 0.5);
  assert.equal(definition.spawns[0].spread, 48);
});

test('sandbox validation rejects unusable spawn and event records', () => {
  const report = validateSandboxDefinition({
    title: 'Bad Sandbox',
    spawns: [{}],
    events: [{ type: 'teleport', at: 1 }],
  });
  assert.equal(report.valid, false);
  assert.equal(report.errors.some((error) => error.includes('spawns[0] must include archetype')), true);
  assert.equal(report.errors.some((error) => error.includes('events[0].type')), true);
});

test('sandbox schedules include one queued spawn per requested count', () => {
  const definition = sandboxDefinitionFromEnemy('mortar_skiff.prototype0', { count: 3, interval: 1 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(7));
  assert.deepEqual(queue.map((entry) => entry.at), [0, 1, 2]);
  assert.equal(queue.every((entry) => entry.enemy.archetypeId === 'mortar_skiff.prototype0'), true);
});

test('sandbox race strafe enemies spawn from the side and keep finite motion', () => {
  const definition = sandboxDefinitionFromEnemy('weyfinder_road_flechette_racer.prototype0', { count: 1, interval: 0 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(19));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].enemy.archetypeId, 'weyfinder_road_flechette_racer.prototype0');
  assert.equal(Math.abs(queue[0].enemy.y) > ROAD.halfWidth, true);
  assert.equal(Number.isFinite(queue[0].enemy.carRuntime.side), true);
  assert.equal(queue[0].enemy.renderHeadingOffset, Math.PI / 2);

  const game = createGame(1147, { sandbox: definition });
  game.autofire = false;
  for (let index = 0; index < 180; index += 1) stepGame(game, { fireHeld: false }, 1 / 60);
  const racer = game.enemies.find((enemy) => enemy.archetypeId === 'weyfinder_road_flechette_racer.prototype0');
  assert.equal(Number.isFinite(racer.x), true);
  assert.equal(Number.isFinite(racer.y), true);
  assert.equal(Number.isFinite(racer.vx), true);
  assert.equal(Number.isFinite(racer.vy), true);
  assert.equal(game.gameOver, false);
  assert.equal(game.vehicle.alive, true);
});

test('sandbox initial pirate ships play their randomized warning barks', () => {
  const definition = sandboxDefinitionFromEnemy('pirate_ship.prototype0', { count: 1, interval: 0 });
  const game = createGame(1147, { sandbox: definition });
  const sounds = consumeSoundEvents(game).map((event) => event.id);
  assert.equal(
    sounds.some((id) => [SOUND_EVENTS.PIRATE_YARGH, SOUND_EVENTS.PIRATE_BROADSIDE, SOUND_EVENTS.PIRATE_AVAST].includes(id)),
    true,
  );
  assert.equal(game.enemies[0].entranceBarkPlayed, true);
});

test('sandbox can schedule the runtime zeppelin boss archetype', () => {
  const definition = sandboxDefinitionFromEnemy('boss.zeppelin.prototype0', { count: 1, interval: 0 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(11));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].enemy.kind, 'zeppelinBoss');
  assert.equal(queue[0].enemy.archetypeId, 'boss.zeppelin.prototype0');
});

test('sandbox can schedule the runtime pirate boss archetype', () => {
  const definition = sandboxDefinitionFromEnemy('boss.pirate_dreadnought.prototype0', { count: 1, interval: 0 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(12));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].enemy.kind, 'pirateBoss');
  assert.equal(queue[0].enemy.archetypeId, 'boss.pirate_dreadnought.prototype0');
  assert.equal(queue[0].enemy.cells.some((cell) => cell.role === 'pirateBossFrontGun'), true);
});

test('sandbox can schedule the Weyfinder Road hotrod boss archetype', () => {
  const definition = sandboxDefinitionFromEnemy('boss.weyfinder_road_hotrod.prototype0', { count: 1, interval: 0 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(14));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].enemy.kind, 'roadBossCar');
  assert.equal(queue[0].enemy.archetypeId, 'boss.weyfinder_road_hotrod.prototype0');
  assert.equal(queue[0].enemy.cells.some((cell) => cell.role === 'roadBossBladeLauncher'), true);
});

test('sandbox can schedule Shadowed Road mine dropper and boss runtime archetypes', () => {
  const mineDefinition = sandboxDefinitionFromEnemy('shadowed_road_mine_dropper.prototype0', { count: 1, interval: 0 });
  const mineQueue = createSandboxEnemySchedule(ROAD, mineDefinition, new Rng(15));
  assert.equal(mineQueue[0].enemy.archetypeId, 'shadowed_road_mine_dropper.prototype0');
  assert.equal(mineQueue[0].enemy.carBehavior.movement, 'mineDropper');

  const bossDefinition = sandboxDefinitionFromEnemy('boss.shadowed_road_hotrod.prototype0', { count: 1, interval: 0 });
  const bossQueue = createSandboxEnemySchedule(ROAD, bossDefinition, new Rng(16));
  assert.equal(bossQueue[0].enemy.kind, 'roadBossCar');
  assert.equal(bossQueue[0].enemy.archetypeId, 'boss.shadowed_road_hotrod.prototype0');
  assert.equal(bossQueue[0].enemy.roadBossCar.variant, 'shadowedRoad');
});

test('sandbox can schedule the octopus boss archetype alias as a real boss', () => {
  const definition = sandboxDefinitionFromEnemy('boss.octopus.prototype0', { count: 1, interval: 0 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(13));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].enemy.kind, 'boss');
  assert.equal(queue[0].enemy.assetId, 'boss.octopus.prototype0');
  assert.equal(queue[0].enemy.archetypeId, 'boss.octagon.prototype0');
  assert.equal(queue[0].enemy.arms.length, 8);
});

test('sandbox schedules linked inchworm head and body segments together', () => {
  const definition = sandboxDefinitionFromEnemy('inchworm_carrier.freedoms_pass', { count: 1, interval: 0, level: 1 });
  const queue = createSandboxEnemySchedule(ROAD, definition, new Rng(17));
  const headEntries = queue.filter((entry) => entry.enemy.archetypeId === 'inchworm_carrier.freedoms_pass');
  const segmentEntries = queue.filter((entry) => entry.enemy.archetypeId === 'inchworm_segment.freedoms_pass');
  assert.equal(headEntries.length, 1);
  assert.equal(segmentEntries.length >= 4, true);
  assert.equal(headEntries[0].enemy.inchworm.role, 'head');
  assert.equal(headEntries[0].enemy.inchworm.segmentIds.length, segmentEntries.length);
  assert.equal(segmentEntries.every((entry) => entry.at === headEntries[0].at), true);
  assert.equal(segmentEntries.every((entry) => entry.enemy.inchworm.suppressDeathBlast), true);
});

test('sandbox runtime fires scripted events and avoids normal level completion', () => {
  const game = createGame(1147, {
    sandbox: {
      title: 'Script Test',
      spawns: [],
      events: [
        { id: 'cash', type: 'setScrap', at: 0.01, value: 77 },
        {
          id: 'wave',
          type: 'spawn',
          at: 0.01,
          spawns: [{ archetype: 'mortar_skiff.prototype0', count: 2, interval: 0.5, roadY: -180 }],
        },
      ],
    },
  });
  assert.equal(game.sandbox.enabled, true);
  assert.equal(game.enemies.length, 0);

  stepGame(game, {}, 1 / 60);

  assert.equal(game.scrap, 77);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemySpawnQueue.length, 1);
  assert.equal(game.levelComplete, false);
});

test('custom levels translate waves and construct obstacles into playable sandbox spawns', () => {
  const level = {
    schemaVersion: '0.1',
    assetId: 'community.obstacle_trial',
    displayName: 'Obstacle Trial',
    background: { mode: 'procedural', layers: [{ id: 'road', source: 'procedural', generator: 'roadGrid', parallax: 1 }] },
    route: { startHeading: 0, segments: [{ id: 'curve', length: 300, turnRadians: 0.2 }] },
    waves: [{ id: 'wave', atDistance: 0, spawn: [{ construct: 'community.masked_enemy', count: 1, laneOffset: -20, spacing: 0, patterns: [] }] }],
    obstacles: [{ id: 'barrier', kind: 'construct', assetRef: 'community.masked_enemy', atDistance: 0, laneOffset: 30 }],
    triggers: [],
  };
  const definition = sandboxDefinitionFromLevel(level);
  const construct = {
    schemaVersion: '0.1',
    assetId: 'community.masked_enemy',
    cells: [
      { id: 'core', type: 'core', gridX: 0, gridY: 0, voxelModel: 'community.core_mask' },
    ],
    connections: [],
  };
  const voxelModels = [{
    schemaVersion: '0.1',
    assetId: 'community.core_mask',
    kind: 'voxelModel',
    voxels: [
      ['empty', 'anchor', 'anchor', 'empty'],
      ['anchor', 'device', 'device', 'anchor'],
      ['anchor', 'device', 'device', 'anchor'],
      ['empty', 'anchor', 'anchor', 'empty'],
    ],
  }];
  const game = createGame(33, { sandbox: definition, constructDefinitions: [construct], voxelModels });

  assert.equal(definition.sourceLevelId, level.assetId);
  assert.equal(game.enemies.length, 2);
  assert.equal(game.enemies.some((enemy) => enemy.staticObstacle), true);
  assert.equal(game.enemies.every((enemy) => enemy.assetId === construct.assetId), true);
  assert.equal(game.enemies[0].cells[0].mask[0][0].role, 'empty');
  assert.equal(game.enemies[0].cells[0].state.mass > 0, true);
});

test('custom hazard obstacles apply data-driven effects and remain terrain anchored', () => {
  const level = {
    schemaVersion: '0.1',
    assetId: 'community.hazard_trial',
    displayName: 'Hazard Trial',
    background: { mode: 'procedural', layers: [{ id: 'road', source: 'procedural', generator: 'roadGrid', parallax: 1 }] },
    route: { startHeading: 0, segments: [{ id: 'straight', length: 300, turnRadians: 0 }] },
    waves: [],
    obstacles: [{
      id: 'ash-front',
      kind: 'hazard',
      assetRef: 'community.ash_mask',
      atDistance: 0,
      laneOffset: 0,
      motion: { mode: 'terrain' },
      collision: { mode: 'trigger', shape: 'circle', radius: 200 },
      effects: {
        damagePerSecond: 5,
        accelerationScale: 0.25,
        brakingScale: 0.5,
        primaryFireRateScale: 0,
        secondaryFireRateScale: 0,
        impulse: { lateral: 20, forward: 0 },
        spinoutSeconds: 1,
      },
    }],
    triggers: [],
  };
  const voxelModels = [{
    schemaVersion: '0.1',
    assetId: 'community.ash_mask',
    kind: 'voxelModel',
    voxels: Array.from({ length: 4 }, () => Array(4).fill('anchor')),
  }];
  const definition = sandboxDefinitionFromLevel(level, { obstacleRoadY: 0 });
  const game = createGame(77, { sandbox: definition, voxelModels });
  const obstacle = game.enemies.find((enemy) => enemy.staticObstacle);
  const start = { x: obstacle.x, y: obstacle.y };

  stepGame(game, { x: 1, brake: true, fireHeld: true, secondaryFirePressed: true }, 0.1);

  assert.equal(game.obstacleEffects.accelerationScale, 0.25);
  assert.equal(game.obstacleEffects.brakingScale, 0.5);
  assert.equal(game.obstacleEffects.primaryFireRateScale, 0);
  assert.equal(game.obstacleEffects.secondaryFireRateScale, 0);
  assert.equal(game.vehicle.obstacleSpinoutTimer > 0, true);
  assert.equal(game.playerProjectiles.length, 0);
  assert.equal(obstacle.x, start.x);
  assert.equal(obstacle.y, start.y);
});

test('supplied level definitions replace the legacy schedule and use route-distance spawns', () => {
  const level = {
    schemaVersion: '0.1',
    assetId: 'community.authoritative_level',
    displayName: 'Authoritative Level',
    background: { mode: 'procedural', layers: [{ id: 'road', source: 'procedural', generator: 'roadGrid', parallax: 1 }] },
    route: { startHeading: 0.4, segments: [{ id: 'short', length: 120, turnRadians: 0 }] },
    waves: [{ id: 'only-wave', atDistance: 30, spawn: [{ construct: 'community.only_enemy', count: 1, spacing: 0 }] }],
    obstacles: [],
    triggers: [],
  };
  const construct = {
    schemaVersion: '0.1',
    assetId: 'community.only_enemy',
    cells: [{ id: 'core', type: 'core', gridX: 0, gridY: 0 }],
    connections: [],
  };
  const game = createGame(91, { levelDefinition: level, constructDefinitions: [construct] });

  assert.equal(game.sandbox, null);
  assert.equal(game.levelDefinition.assetId, level.assetId);
  assert.equal(game.road.route, level.route);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.enemySpawnQueue.length, 1);
  assert.equal(game.enemySpawnQueue[0].triggerDistance, 30);
  assert.equal(game.enemySpawnQueue[0].enemy.assetId, construct.assetId);

  game.road.routeDistance = 30;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.enemies.some((enemy) => enemy.assetId === construct.assetId), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createSandboxEnemySchedule, stepGame } from '../src/core/game.js';
import { Rng } from '../src/core/rng.js';
import { sandboxDefinitionFromEnemy, validateSandboxDefinition } from '../src/core/sandboxMode.js';

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

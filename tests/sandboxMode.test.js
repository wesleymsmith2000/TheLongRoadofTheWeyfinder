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

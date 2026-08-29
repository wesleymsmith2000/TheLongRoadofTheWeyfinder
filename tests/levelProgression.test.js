import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createLevelEnemySchedule, startNextLevel, stepGame } from '../src/core/game.js';

test('starting the next level schedules one more enemy over time', () => {
  const game = createGame();
  game.levelComplete = true;
  startNextLevel(game);
  assert.equal(game.level, 2);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemySpawnQueue.length, 1);
  assert.equal(game.levelComplete, false);
});

test('clearing all enemies records level time and completion count', () => {
  const game = createGame();
  game.time = 12.5;
  for (const enemy of game.enemies) enemy.destroyed = true;
  stepGame(game, {}, 0.016);
  assert.equal(game.levelComplete, true);
  assert.equal(game.levelsCompleted, 1);
  assert.equal(game.levelTime > 12, true);
});

test('enemy pushed outside the center lane accelerates back toward view center', () => {
  const game = createGame();
  const enemy = game.enemies[0];
  enemy.x = game.road.x + game.road.halfWidth + 300;
  stepGame(game, {}, 0.1);
  assert.equal(enemy.vx < 0, true);
});

test('level enemy schedule spaces entrants over an approximately three minute run', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const schedule = createLevelEnemySchedule(road, 8, ['road'], { next: () => 0.42 });
  assert.equal(schedule.length, 8);
  assert.equal(schedule[0].at, 0);
  assert.equal(schedule.every((entry) => entry.at >= 0 && entry.at <= 174), true);
  assert.equal(schedule.some((entry) => entry.at > 20), true);
});

test('scheduled enemy spawns after its warning marker appears', () => {
  const game = createGame();
  game.enemySpawnQueue = [
    {
      at: 1,
      type: 'standard',
      markerShown: false,
      enemy: createLevelEnemySchedule(game.road, 1, ['road'], game.rng)[0].enemy,
    },
  ];
  game.enemies = [];
  stepGame(game, { gunnerEnabled: false }, 0.016);
  assert.equal(game.incomingMarkers.length, 1);
  game.time = 0.99;
  stepGame(game, { gunnerEnabled: false }, 0.016);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemySpawnQueue.length, 0);
});

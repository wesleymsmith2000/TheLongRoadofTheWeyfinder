import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startNextLevel, stepGame } from '../src/core/game.js';

test('starting the next level adds one more enemy', () => {
  const game = createGame();
  game.levelComplete = true;
  startNextLevel(game);
  assert.equal(game.level, 2);
  assert.equal(game.enemies.length, 2);
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

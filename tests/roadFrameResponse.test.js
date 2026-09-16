import test from 'node:test';
import assert from 'node:assert/strict';
import { roadOffsetToWorld } from '../src/core/camera.js';
import { createGame, stepGame } from '../src/core/game.js';

function createEmptySandboxGame() {
  const game = createGame(1147, {
    sandbox: {
      level: 1,
      spawns: [],
      events: [],
      completeOnEmpty: false,
    },
  });
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  return game;
}

test('rear edge pressure currently slows traversal but clamps to a positive minimum', () => {
  const game = createEmptySandboxGame();
  const rearEdge = roadOffsetToWorld({ x: 0, y: game.road.halfHeight * 0.98 }, game.road);
  game.vehicle.x = rearEdge.x;
  game.vehicle.y = rearEdge.y;

  for (let index = 0; index < 900; index += 1) {
    stepGame(game, { x: 0, y: 1, gunnerEnabled: false }, 1 / 60);
  }

  assert.equal(game.levelComplete, false);
  assert.equal(game.gameOver, false);
  assert.equal(game.road.speed >= game.road.baseSpeed / 8, true);
  assert.equal(game.road.speed < game.road.baseSpeed * 0.14, true);
});

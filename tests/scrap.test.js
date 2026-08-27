import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';

test('vehicle collects scrap pickups by driving over them', () => {
  const game = createGame();
  game.enemies = [];
  game.scrapPickups = [{ x: game.vehicle.x, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 3, life: 8 }];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.scrap, 1);
  assert.equal(game.scrapPickups.length, 0);
});

test('level completion waits until dropped scrap is collected or gone', () => {
  const game = createGame();
  game.enemies = [];
  game.scrapPickups = [{ x: game.vehicle.x + 200, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 3, life: 8 }];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.levelComplete, false);
  game.scrapPickups[0].x = game.vehicle.x;
  game.scrapPickups[0].y = game.vehicle.y;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.levelComplete, true);
});

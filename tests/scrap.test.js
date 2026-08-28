import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

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

test('nearby scrap magnetizes toward the vehicle before collection', () => {
  const game = createGame();
  game.enemies = [];
  game.scrapPickups = [{ x: game.vehicle.x + CELL_SIZE * 4, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 3, life: 8 }];
  const before = Math.abs(game.scrapPickups[0].x - game.vehicle.x);
  stepGame(game, {}, 1 / 60);
  const after = Math.abs(game.scrapPickups[0].x - game.vehicle.x);
  assert.equal(after < before, true);
});

test('scrap collection upgrades extend magnet pull and capture radius', () => {
  const captureGame = createGame();
  captureGame.enemies = [];
  captureGame.upgrades.scrapCaptureRadius = 4;
  captureGame.scrapPickups = [{ x: captureGame.vehicle.x + CELL_SIZE * 2.5, y: captureGame.vehicle.y, vx: 0, vy: 0, value: 1, radius: 1, life: 8 }];
  stepGame(captureGame, {}, 1 / 60);
  assert.equal(captureGame.scrap, 1);

  const magnetGame = createGame();
  magnetGame.enemies = [];
  magnetGame.upgrades.scrapMagnetDistance = 10;
  magnetGame.scrapPickups = [{ x: magnetGame.vehicle.x + CELL_SIZE * 8, y: magnetGame.vehicle.y, vx: 0, vy: 0, value: 1, radius: 1, life: 8 }];
  stepGame(magnetGame, {}, 1 / 60);
  assert.equal(magnetGame.scrapPickups[0].vx < 0, true);
});

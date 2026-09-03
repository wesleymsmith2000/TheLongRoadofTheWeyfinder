import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createProjectile } from '../src/core/projectile.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('vehicle collects scrap pickups by driving over them', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.scrapPickups = [{ x: game.vehicle.x, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 3, life: 8 }];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.scrap, 1);
  assert.equal(game.scrapPickups.length, 0);
});

test('level completion waits until dropped scrap is collected or gone', () => {
  const game = createGame();
  game.autofire = false;
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
  game.enemySpawnQueue = [{ at: game.time + 20, enemy: null, markerShown: false, type: 'standard' }];
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

test('remaining scrap b-lines toward the vehicle once the field is clear', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.scrapPickups = [{ x: game.vehicle.x + CELL_SIZE * 80, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 1, life: 1 }];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.scrapPickups[0].vx < -200, true);
  assert.equal(game.scrapPickups[0].life > 1, true);
});

test('clear-field scrap sweep reaches distant pickups before they expire', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.scrapPickups = [{ x: game.vehicle.x + CELL_SIZE * 120, y: game.vehicle.y, vx: 0, vy: 0, value: 3, radius: 1, life: 1 }];
  for (let index = 0; index < 260 && game.scrapPickups.length > 0; index += 1) {
    stepGame(game, {}, 1 / 60);
  }
  assert.equal(game.scrap, 3);
  assert.equal(game.scrapPickups.length, 0);
});

test('scrap waits for live projectiles before clear-field collection starts', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [createProjectile(game.vehicle.x, game.vehicle.y - 20, 0, -20, { team: 'player', damage: 1, lifetime: 1 })];
  game.enemyProjectiles = [];
  game.scrapPickups = [{ x: game.vehicle.x + CELL_SIZE * 80, y: game.vehicle.y, vx: 0, vy: 0, value: 1, radius: 1, life: 8 }];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.scrapPickups[0].vx, 0);
});

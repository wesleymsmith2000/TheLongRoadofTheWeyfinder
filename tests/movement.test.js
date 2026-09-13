import test from 'node:test';
import assert from 'node:assert/strict';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { stepVehicle } from '../src/core/physics.js';
import { createGame, stepGame } from '../src/core/game.js';
import { roadOffsetToWorld } from '../src/core/camera.js';

test('keyboard-style movement input produces visible vehicle motion', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10);
  assert.equal(vehicle.y < -0.5, true);
  assert.equal(Math.abs(vehicle.vy) > 5, true);
});

test('movement input is relative to terrain coordinates, not craft spin', () => {
  const vehicle = createStartingVehicle();
  vehicle.heading = Math.PI / 2;
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10, 0);
  assert.equal(vehicle.y < -0.5, true);
  assert.equal(Math.abs(vehicle.x) < 1, true);
});

test('movement input stays in terrain coordinates when the road frame turns', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, { x: 0, y: -1, turn: 0, brake: false }, 1 / 10, Math.PI / 2);
  assert.equal(vehicle.y < -0.5, true);
  assert.equal(Math.abs(vehicle.x) < 1, true);
});

test('vehicle physics tolerates partial input snapshots', () => {
  const vehicle = createStartingVehicle();
  stepVehicle(vehicle, {}, 1 / 60, 0);
  assert.equal(Number.isFinite(vehicle.x), true);
  assert.equal(Number.isFinite(vehicle.heading), true);
});

test('engine acceleration upgrade increases movement response', () => {
  const base = createStartingVehicle();
  const upgraded = createStartingVehicle();
  stepVehicle(base, { x: 0, y: -1 }, 1 / 10, 0);
  stepVehicle(upgraded, { x: 0, y: -1 }, 1 / 10, 0, { engineAcceleration: 2 });
  assert.equal(Math.abs(upgraded.vy) > Math.abs(base.vy), true);
});

test('wheel inertia compensation improves release deceleration', () => {
  const base = createStartingVehicle();
  const upgraded = createStartingVehicle();
  base.vx = 100;
  upgraded.vx = 100;
  stepVehicle(base, {}, 0.5, 0);
  stepVehicle(upgraded, {}, 0.5, 0, { wheelInertiaCompensation: 3 });
  assert.equal(Math.abs(upgraded.vx) < Math.abs(base.vx), true);
});

test('low-traction terrain reduces vehicle acceleration response', () => {
  const normal = createStartingVehicle();
  const slippery = createStartingVehicle();
  stepVehicle(normal, { x: 0, y: -1 }, 1 / 10, 0, {}, { traction: 1, rollingResistance: 0.05 });
  stepVehicle(slippery, { x: 0, y: -1 }, 1 / 10, 0, {}, { traction: 0.42, rollingResistance: 0.02 });
  assert.equal(Math.abs(slippery.vy) < Math.abs(normal.vy), true);
});

test('vehicle heading turns toward its travel direction', () => {
  const vehicle = createStartingVehicle();
  vehicle.heading = 0;
  vehicle.vx = 0;
  vehicle.vy = 140;
  const before = Math.abs(Math.atan2(Math.sin(Math.PI / 2 - vehicle.heading), Math.cos(Math.PI / 2 - vehicle.heading)));
  stepVehicle(vehicle, {}, 0.25, 0);
  const after = Math.abs(Math.atan2(Math.sin(Math.PI / 2 - vehicle.heading), Math.cos(Math.PI / 2 - vehicle.heading)));
  assert.equal(after < before, true);
  assert.equal(vehicle.heading > 0, true);
});

test('pushing against play area edges adjusts road speed and lateral slide', () => {
  const fastGame = createGame();
  fastGame.autofire = false;
  fastGame.enemySpawnQueue = [];
  fastGame.enemies = [];
  fastGame.vehicle.x = roadOffsetToWorld({ x: 0, y: -fastGame.road.halfHeight }, fastGame.road).x;
  fastGame.vehicle.y = roadOffsetToWorld({ x: 0, y: -fastGame.road.halfHeight }, fastGame.road).y;
  const baseSpeed = fastGame.road.speed;
  stepGame(fastGame, { x: 0, y: -1, gunnerEnabled: false }, 1 / 30);
  assert.equal(fastGame.road.speed > baseSpeed, true);

  const slowGame = createGame();
  slowGame.autofire = false;
  slowGame.enemySpawnQueue = [];
  slowGame.enemies = [];
  const bottom = roadOffsetToWorld({ x: 0, y: slowGame.road.halfHeight }, slowGame.road);
  slowGame.vehicle.x = bottom.x;
  slowGame.vehicle.y = bottom.y;
  stepGame(slowGame, { x: 0, y: 1, gunnerEnabled: false }, 1 / 30);
  assert.equal(slowGame.road.speed < baseSpeed, true);

  const slideGame = createGame();
  slideGame.autofire = false;
  slideGame.enemySpawnQueue = [];
  slideGame.enemies = [];
  const right = roadOffsetToWorld({ x: slideGame.road.halfWidth, y: 0 }, slideGame.road);
  slideGame.vehicle.x = right.x;
  slideGame.vehicle.y = right.y;
  stepGame(slideGame, { x: 1, y: 0, gunnerEnabled: false }, 1 / 30);
  assert.equal(slideGame.road.lateralOffset > 0, true);
});

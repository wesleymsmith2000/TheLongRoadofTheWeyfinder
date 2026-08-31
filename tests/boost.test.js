import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoostState, boostRechargeFactor, dodgeDirection, stepBoost } from '../src/core/boost.js';
import { createStartingVehicle } from '../src/core/vehicle.js';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createCell } from '../src/core/cell.js';
import { createConnection } from '../src/core/connections.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('boost dodge spends fuel and pushes in the requested direction', () => {
  const vehicle = createStartingVehicle();
  const boost = createBoostState();
  const used = stepBoost(vehicle, boost, { dodgePressed: true, dodgeX: 1, dodgeY: 0 }, 0, 0.016);
  assert.equal(used, true);
  assert.equal(boost.fuel < boost.maxFuel, true);
  assert.equal(vehicle.vx > 25, true);
  assert.equal(boost.activeTime > 0, true);
});

test('additional engines scale boost drive reserve recharge and duration', () => {
  const lightGame = createGame();
  const engineGame = createGame();
  addAttachedCell(engineGame.vehicle, createCell('engine-extra', 'engine', 0, 2), 'engine');

  stepGame(lightGame, { gunnerEnabled: false }, 1 / 60);
  stepGame(engineGame, { gunnerEnabled: false }, 1 / 60);
  assert.equal(engineGame.boost.maxFuel > lightGame.boost.maxFuel, true);
  assert.equal(engineGame.boost.rechargeRate > lightGame.boost.rechargeRate, true);
  assert.equal(engineGame.boost.maxDuration > lightGame.boost.maxDuration, true);
  assert.equal(engineGame.boost.maxSpeed > lightGame.boost.maxSpeed, true);

  const lightBoost = stepBoost(lightGame.vehicle, lightGame.boost, { dodgePressed: true, dodgeX: 1, dodgeY: 0 }, 0, 1 / 60);
  const engineBoost = stepBoost(engineGame.vehicle, engineGame.boost, { dodgePressed: true, dodgeX: 1, dodgeY: 0 }, 0, 1 / 60);
  assert.equal(lightBoost, true);
  assert.equal(engineBoost, true);
  assert.equal(engineGame.vehicle.vx > lightGame.vehicle.vx, true);
});

test('boost drive emits large bluish exhaust particles while active', () => {
  const game = createGame();
  game.rng.next = () => 0.9;
  game.rng.range = (min, max) => min + (max - min) * game.rng.next();
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 10, enemy: createEnemy(game.vehicle.x + 800, game.vehicle.y), markerShown: false, type: 'standard' }];
  game.upgrades.boostAcceleration = 4;
  game.upgrades.boostDuration = 4;
  addAttachedCell(game.vehicle, createCell('engine-extra', 'engine', 0, 2), 'engine');

  stepGame(game, { dodgePressed: true, dodgeX: 0, dodgeY: -1, gunnerEnabled: false }, 1 / 60);
  for (let index = 0; index < 3; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);

  const exhaust = game.smokeParticles.filter((particle) => particle.weapon === 'boost-exhaust');
  assert.equal(exhaust.length > 0, true);
  assert.equal(exhaust.some((particle) => particle.radius > 6.4), true);
  assert.equal(exhaust.every((particle) => ['#e8fbff', '#b8ecff', '#8fa4aa', '#5f686d'].includes(particle.color)), true);
});

test('boost exhaust particles can damage enemies behind the craft', () => {
  const game = createGame();
  game.rng.next = () => 0.2;
  game.rng.range = (min, max) => min + (max - min) * game.rng.next();
  game.upgrades.boostAcceleration = 4;
  game.upgrades.boostDuration = 4;
  const enemy = createEnemy(game.vehicle.x - CELL_SIZE * 0.9, game.vehicle.y + CELL_SIZE * 2.6);
  game.enemies = [enemy];
  game.enemySpawnQueue = [];

  stepGame(game, { dodgePressed: true, dodgeX: 0, dodgeY: -1, gunnerEnabled: false }, 1 / 60);
  for (let index = 0; index < 3; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(enemy.damageTaken > 0, true);
  assert.equal(game.score.damageDone > 0, true);
});

test('boost defaults to forward dodge without a movement direction', () => {
  const direction = dodgeDirection({ dodgePressed: true, x: 0, y: 0 });
  assert.equal(direction.x, 0);
  assert.equal(direction.y, -1);
});

test('damaged engine integrity slows boost recharge', () => {
  const vehicle = createStartingVehicle();
  const engine = vehicle.cells.find((cell) => cell.type === 'engine');
  engine.state.deviceIntegrity = 0.2;
  engine.state.wiringIntegrity = 0.1;
  assert.equal(boostRechargeFactor(vehicle) < 0.5, true);
});

test('active boost shield deflects nearby enemy projectiles', () => {
  const game = createGame();
  game.enemies = [];
  game.enemyProjectiles = [
    createProjectile(game.vehicle.x + 10, game.vehicle.y, -80, 0, {
      team: 'enemy',
      radius: 4,
      damage: 10,
      impulse: 100,
      lifetime: 4,
    }),
  ];
  game.boost.activeTime = 0.08;
  game.boost.maxDuration = 0.08;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemyProjectiles[0].vx > 0, true);
  assert.equal(game.vehicle.alive, true);
});

test('additional guns scale boost shield duration and absorption', () => {
  const lightGame = createGame();
  const gunGame = createGame();
  addAttachedCell(gunGame.vehicle, createCell('gun-extra', 'gun', 0, -2), 'gun');

  stepGame(lightGame, { gunnerEnabled: false }, 1 / 60);
  stepGame(gunGame, { gunnerEnabled: false }, 1 / 60);

  assert.equal(gunGame.boost.shieldDuration > lightGame.boost.shieldDuration, true);
  assert.equal(gunGame.boost.shieldScale > lightGame.boost.shieldScale, true);
});

function addAttachedCell(vehicle, cell, connectTo = 'core') {
  vehicle.cells.push(cell);
  vehicle.connections.push(createConnection(connectTo, cell.id, 'bottom'));
}

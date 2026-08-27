import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { fireSecondary, stepSecondaryWeapon } from '../src/core/secondaryWeapon.js';

test('secondary weapon can be fired manually and spends ammo', () => {
  const game = createGame();
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles.length, 1);
  assert.equal(game.secondary.ammo.rocket, 11);
});

test('secondary weapon can cycle selection', () => {
  const game = createGame();
  stepSecondaryWeapon(game, { secondaryCycle: 1 }, 0.016);
  assert.equal(game.secondary.selected, 'cannon');
});

test('beam secondary creates a short beam blast instead of a traveling shot', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles[0].behavior, 'beam');
  assert.equal(game.playerProjectiles[0].length > 300, true);
  assert.equal(game.playerProjectiles[0].vx, game.vehicle.vx);
});

test('rocket secondary creates a homing missile with longer flight time', () => {
  const game = createGame();
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles[0].behavior, 'homing');
  assert.equal(game.playerProjectiles[0].lifetime > 5, true);
});

test('beam stores a render endpoint when it hits an enemy voxel', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  game.enemies[0].x = game.vehicle.x + 60;
  game.enemies[0].y = game.vehicle.y;
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'beam' }, 0.016);
  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  const tracedLength = Math.hypot(beam.renderEndX - beam.x, beam.renderEndY - beam.y);
  assert.equal(tracedLength < beam.length, true);
});

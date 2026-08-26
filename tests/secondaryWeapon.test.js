import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
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

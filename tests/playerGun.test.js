import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';

test('standard turret bullets use boosted damage', () => {
  const game = createGame();
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullet.damage, 10);
});

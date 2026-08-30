import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';

test('standard turret bullets use boosted damage', () => {
  const game = createGame();
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullet.damage, 8);
});

test('main gun damage upgrade increases bullet damage', () => {
  const game = createGame();
  game.upgrades.gunDamage = 1;
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullet.damage.toFixed(1), '8.4');
});

test('main gun velocity upgrade increases bullet speed', () => {
  const base = createGame();
  base.autofire = true;
  stepGame(base, {}, 1 / 60);
  const baseBullet = base.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');

  const upgraded = createGame();
  upgraded.upgrades.gunVelocity = 2;
  upgraded.autofire = true;
  stepGame(upgraded, {}, 1 / 60);
  const upgradedBullet = upgraded.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');

  assert.equal(Math.hypot(upgradedBullet.vx, upgradedBullet.vy) > Math.hypot(baseBullet.vx, baseBullet.vy), true);
});

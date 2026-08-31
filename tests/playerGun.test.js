import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';

test('standard turret bullets use boosted damage', () => {
  const game = createGame();
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullet.damage, 8);
  assert.equal(bullet.radius, 1.5);
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

test('additional gun modules add firing points and improve fire interval', () => {
  const game = createGame();
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.playerProjectiles.filter((projectile) => projectile.weapon === 'bullet').length, 1);
  const singleGunInterval = game.playerFireTimer;

  const extraGun = game.vehicle.cells.find((cell) => cell.type === 'armor');
  extraGun.type = 'gun';
  game.playerFireTimer = 0;
  stepGame(game, {}, 1 / 60);
  const bullets = game.playerProjectiles.filter((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullets.length >= 3, true);
  assert.equal(game.playerFireTimer < singleGunInterval, true);
});

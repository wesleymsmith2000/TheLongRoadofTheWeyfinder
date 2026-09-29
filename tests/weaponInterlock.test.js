import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { applyWeaponInterlock, stepWeaponInterlock, weaponFireBlocked } from '../src/core/weaponInterlock.js';

test('weapon interlock uses max duration and clears after time elapses', () => {
  const game = {};
  applyWeaponInterlock(game, 0.9, 'wavelet');
  applyWeaponInterlock(game, 0.2, 'other');
  assert.equal(game.weaponInterlock.remaining, 0.9);
  assert.equal(weaponFireBlocked(game), true);
  stepWeaponInterlock(game, 0.9);
  assert.equal(weaponFireBlocked(game), false);
  assert.equal(game.weaponInterlock.source, null);
});

test('global interlock blocks primary defensive and secondary fire while timers keep cooling', () => {
  const game = createGame();
  game.enemies = [createEnemy(game.vehicle.x + 20, game.vehicle.y)];
  game.enemySpawnQueue = [];
  game.secondary.cooldown = 0.4;
  applyWeaponInterlock(game, 0.5, 'wavelet');

  stepGame(game, { secondaryFirePressed: true }, 0.1);

  assert.equal(game.playerProjectiles.length, 0);
  assert.equal(game.secondary.cooldown < 0.4, true);
  game.weaponInterlock.remaining = 0;
  game.secondary.cooldown = 0;
  assert.equal(fireSecondary(game), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { gunMuzzleWorld } from '../src/core/vehicle.js';
import { fireSecondary, stepSecondaryWeapon } from '../src/core/secondaryWeapon.js';

test('secondary weapon can be fired manually and spends ammo', () => {
  const game = createGame();
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles.length, 1);
  assert.equal(game.playerProjectiles[0].damage, 36);
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
  assert.equal(game.playerProjectiles[0].frames, 9);
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
  stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 0.016);
  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  const tracedLength = Math.hypot(beam.renderEndX - beam.x, beam.renderEndY - beam.y);
  assert.equal(tracedLength < beam.length, true);
});

test('beam applies repeated contact damage over its firing frames', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  game.enemies[0].x = game.vehicle.x + 60;
  game.enemies[0].y = game.vehicle.y;
  fireSecondary(game);
  for (let i = 0; i < 5; i += 1) stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemies[0].damageTaken > 25, true);
});

test('cannon impact creates blast shrapnel', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  game.vehicle.turretHeading = 0;
  game.enemies[0].x = game.vehicle.x + 45;
  game.enemies[0].y = game.vehicle.y;
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'cannon' }, 0.08);
  const shrapnel = game.playerProjectiles.filter((projectile) => projectile.weapon === 'cannon-shrapnel');
  const blast = game.playerProjectiles.find((projectile) => projectile.weapon === 'cannon-blast');
  assert.equal(shrapnel.length >= 20, true);
  assert.equal(blast.behavior, 'blast');
  assert.equal(game.score.damageDone > 18, true);
});

test('cannon uses boosted base damage', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  fireSecondary(game);
  assert.equal(game.playerProjectiles[0].damage, 36);
});

test('beam stays locked to the moving turret while firing', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  fireSecondary(game);
  stepGame(game, { x: 1, y: 0, secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  const muzzle = gunMuzzleWorld(game.vehicle);
  assert.equal(Math.abs(beam.x - muzzle.x) < 0.001, true);
  assert.equal(Math.abs(beam.y - muzzle.y) < 0.001, true);
  assert.equal(beam.angle, game.vehicle.turretHeading);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { gunMuzzleWorld } from '../src/core/vehicle.js';
import { fireSecondary, stepSecondaryWeapon } from '../src/core/secondaryWeapon.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

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
  assert.equal(game.playerProjectiles[0].frames, 5);
  assert.equal(game.playerProjectiles[0].vx, game.vehicle.vx);
});

test('rocket secondary creates a homing missile with longer flight time', () => {
  const game = createGame();
  game.vehicle.vx = 12;
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles[0].behavior, 'homing');
  assert.equal(game.playerProjectiles[0].vx, game.vehicle.vx);
  assert.equal(game.playerProjectiles[0].maxSpeed, 130);
  assert.equal(game.playerProjectiles[0].radius, 3);
  assert.equal(game.playerProjectiles[0].hull.sections.length, 2);
  assert.equal(game.playerProjectiles[0].lifetime > 5, true);
});

test('enemy bullets can destroy a rocket and trigger its blast', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  fireSecondary(game);
  const rocket = game.playerProjectiles[0];
  rocket.x = 0;
  rocket.y = 0;
  rocket.vx = 0;
  rocket.vy = 0;
  rocket.angle = 0;
  rocket.blastRadius = 20;
  game.enemyProjectiles = [{ x: 6.5, y: 0, vx: 0, vy: 0, radius: 3, damage: 200, lifetime: 1, team: 'enemy', weapon: 'bullet' }];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(rocket.lifetime <= 0, true);
  assert.equal(game.playerProjectiles.some((projectile) => projectile.weapon === 'rocket-blast'), true);
  assert.equal(game.enemyProjectiles.every((projectile) => projectile.lifetime <= 0), true);
});

test('rocket contrail emits short-lived smoke particles', () => {
  const game = createGame();
  game.autofire = false;
  fireSecondary(game);
  const rocket = game.playerProjectiles[0];
  rocket.contrail = { ...rocket.contrail, emissionMeanPerSevenFrames: 14 };
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.smokeParticles.length > 0, true);
  assert.equal(game.smokeParticles.length <= 5, true);
  rocket.lifetime = 0;
  for (let index = 0; index < 6; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.smokeParticles.length, 0);
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
  game.enemies[0].x = game.vehicle.x + CELL_SIZE * 2.25;
  game.enemies[0].y = game.vehicle.y;
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'cannon' }, 0.08);
  const shrapnel = game.playerProjectiles.filter((projectile) => projectile.weapon === 'cannon-shrapnel');
  const blast = game.playerProjectiles.find((projectile) => projectile.weapon === 'cannon-blast');
  assert.equal(shrapnel.length >= 20, true);
  assert.equal(blast.behavior, 'blast');
  assert.equal(game.score.damageDone > 18, true);
});

test('cannon impact blast shoves nearby enemies without requiring a direct hit', () => {
  const game = createGame();
  game.road.halfWidth = 1000;
  game.road.halfHeight = 1000;
  game.secondary.selected = 'cannon';
  game.vehicle.turretHeading = 0;
  game.enemies[0].x = game.vehicle.x + CELL_SIZE * 2.25;
  game.enemies[0].y = game.vehicle.y;
  game.enemies.push(createEnemy(game.vehicle.x + CELL_SIZE * 4.6, game.vehicle.y));
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'cannon' }, 0.08);
  assert.equal(game.enemies[1].vx > 0, true);
  assert.equal(game.enemies[1].vx < 140, true);
});

test('cannon uses boosted base damage', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  fireSecondary(game);
  assert.equal(game.playerProjectiles[0].damage, 18);
});

test('secondary upgrades alter projectile stats', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  game.upgrades.cannonImpactDamage = 1;
  game.upgrades.cannonShrapnelCount = 2;
  fireSecondary(game);
  assert.equal(game.playerProjectiles[0].damage.toFixed(1), '18.9');
  assert.equal(game.playerProjectiles[0].shrapnelCount, 30);
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

test('beam stays locked after lane containment moves a fast vehicle', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  game.road.halfWidth = 20;
  game.road.halfHeight = 20;
  game.vehicle.x = game.road.x + 80;
  game.vehicle.vx = 240;
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  const muzzle = gunMuzzleWorld(game.vehicle);
  assert.equal(Math.abs(beam.x - muzzle.x) < 0.001, true);
  assert.equal(Math.abs(beam.y - muzzle.y) < 0.001, true);
});

test('beam-selected manual aim ignores ballistic compensation at high vehicle velocity', () => {
  const beamGame = createGame();
  const cannonGame = createGame();
  beamGame.secondary.selected = 'beam';
  cannonGame.secondary.selected = 'cannon';
  beamGame.vehicle.vx = 220;
  beamGame.vehicle.vy = -180;
  cannonGame.vehicle.vx = 220;
  cannonGame.vehicle.vy = -180;
  const target = { x: beamGame.vehicle.x + 160, y: beamGame.vehicle.y - 40 };
  for (let i = 0; i < 14; i += 1) {
    stepGame(
      beamGame,
      { secondarySelect: 'beam', aimWorld: target, manualAimActive: true, gunnerEnabled: false, compensatedAim: true },
      1 / 60,
    );
    stepGame(
      cannonGame,
      { secondarySelect: 'cannon', aimWorld: target, manualAimActive: true, gunnerEnabled: false, compensatedAim: true },
      1 / 60,
    );
  }
  assert.equal(beamGame.vehicle.turretHeading < cannonGame.vehicle.turretHeading, true);
});

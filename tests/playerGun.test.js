import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };
import { setGunLoadoutSlot } from '../src/core/weaponLoadout.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';

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

test('additional gun modules fire in succession and improve fire interval', () => {
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
  assert.equal(bullets.length, 2);
  assert.notEqual(bullets[0].sourceCellId, bullets[1].sourceCellId);
  assert.equal(game.playerFireTimer < singleGunInterval, true);
});

test('primary gun loadouts can fire mini beam slots', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 1, 'mini_beam').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  game.playerFireTimer = 0;
  stepGame(game, {}, 1 / 60);
  const beam = game.playerProjectiles.find((projectile) => projectile.weapon === 'mini_beam');
  assert.equal(beam.behavior, 'beam');
  assert.equal(beam.sourceCellId, 'gun');
});

test('mini beam uses its own shorter slower firing profile and gunfire sound', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mini_beam').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.autofire = true;
  stepGame(game, {}, 1 / 60);

  const beam = game.playerProjectiles.find((projectile) => projectile.weapon === 'mini_beam');
  assert.equal(beam.length, 64);
  assert.equal(beam.frames, 5);
  assert.equal(beam.radius, 0.8);
  assert.equal(game.primaryHeat.heat.toFixed(1), '10.0');
  assert.equal(game.playerFireTimer.toFixed(2), ((2.48 / Math.sqrt(2)) / 0.9).toFixed(2));
  const events = consumeSoundEvents(game).map((event) => event.id);
  assert.equal(events.includes(SOUND_EVENTS.PLAYER_MAIN_GUN), true);
  assert.equal(events.includes(SOUND_EVENTS.PLAYER_BEAM), false);
});

test('mini beam upgrades affect active beam combat attributes', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mini_beam').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.upgrades.miniBeamDamage = 2;
  game.upgrades.miniBeamLength = 1;
  game.upgrades.miniBeamPierce = 3;
  game.upgrades.miniBeamFireRate = 2;
  game.upgrades.miniBeamHeatEfficiency = 1;
  game.autofire = true;
  stepGame(game, {}, 1 / 60);

  const beam = game.playerProjectiles.find((projectile) => projectile.weapon === 'mini_beam');
  assert.equal(beam.damage.toFixed(3), (0.9 * 1.05 ** 2).toFixed(3));
  assert.equal(beam.length.toFixed(2), (64 * 1.12).toFixed(2));
  assert.equal(beam.pierce, 3);
  assert.equal(game.primaryHeat.heat.toFixed(1), '9.5');
  assert.equal(game.playerFireTimer < (2.48 / Math.sqrt(2)) / 0.9, true);
});

test('advanced primary weapon loadouts fire from runtime weapon definitions', () => {
  const mortarDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mortar').definition;
  const mortarGame = createGame(1147, { vehicleDefinition: mortarDefinition });
  mortarGame.autofire = true;
  stepGame(mortarGame, {}, 1 / 60);
  const mortar = mortarGame.playerProjectiles.find((projectile) => projectile.weapon === 'mortar');
  assert.equal(mortar.behavior, 'arc');
  assert.equal(mortar.blastRadius > 0, true);

  const flechetteDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'tracking_flechette').definition;
  const flechetteGame = createGame(1147, { vehicleDefinition: flechetteDefinition });
  flechetteGame.autofire = true;
  stepGame(flechetteGame, {}, 1 / 60);
  const flechette = flechetteGame.playerProjectiles.find((projectile) => projectile.weapon === 'tracking_flechette');
  assert.equal(flechette.behavior, 'homing');
  assert.equal(flechette.pierce, 2);
});

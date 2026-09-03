import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };
import { setGunLoadoutSlot } from '../src/core/weaponLoadout.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

test('standard turret bullets use boosted damage', () => {
  const game = createGame();
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.equal(bullet.damage, 8);
  assert.equal(bullet.radius, 1.5);
});

test('primary guns hold fire when there are no active or inbound enemies', () => {
  const game = createGame();
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.playerProjectiles.some((projectile) => projectile.owner === 'player'), false);
});

test('primary guns fire while enemies are inbound', () => {
  const game = createGame();
  game.enemies = [];
  game.enemySpawnQueue = [{ at: game.time + 30, enemy: createEnemy(game.vehicle.x + 900, game.vehicle.y), markerShown: true, type: 'standard' }];
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.playerProjectiles.some((projectile) => projectile.weapon === 'bullet'), true);
});

test('primary guns hold fire before inbound warnings begin', () => {
  const game = createGame();
  game.enemies = [];
  game.enemySpawnQueue = [{ at: game.time + 30, enemy: createEnemy(game.vehicle.x + 900, game.vehicle.y), markerShown: false, type: 'standard' }];
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  assert.equal(game.playerProjectiles.some((projectile) => projectile.weapon === 'bullet'), false);
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
  assert.equal(mortar.blastRadius.toFixed(3), (19.125 * CELL_SIZE).toFixed(3));

  const flechetteDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'tracking_flechette').definition;
  const flechetteGame = createGame(1147, { vehicleDefinition: flechetteDefinition });
  flechetteGame.autofire = true;
  const aimAngle = flechetteGame.vehicle.turretHeading;
  stepGame(flechetteGame, {}, 1 / 60);
  const flechette = flechetteGame.playerProjectiles.find((projectile) => projectile.weapon === 'tracking_flechette');
  assert.equal(flechette.behavior, 'homing');
  assert.equal(flechette.radius, 1.65);
  assert.equal(Math.hypot(flechette.vx, flechette.vy).toFixed(2), '161.25');
  assert.equal(flechette.lifetime > 3.8, true);
  assert.equal(flechette.maxSpeed, 322.5);
  assert.equal(flechette.acceleration, 105);
  assert.equal(flechette.pierce, 2);
  assert.deepEqual(flechette.sprite.displaySize, [11, 4]);
  assert.equal(flechette.stopBeforeAcceleration, true);
  assert.equal(flechette.launchWhenFacingTarget, true);
  assert.equal(flechette.delayBeforeAcceleration > 0.32, true);
  assert.equal(Math.abs(Math.abs(angleDelta(aimAngle, flechette.angle)) - Math.PI / 2) <= Math.PI / 6, true);

  const bladeDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'blade_launcher').definition;
  const bladeGame = createGame(1147, { vehicleDefinition: bladeDefinition });
  bladeGame.autofire = true;
  stepGame(bladeGame, {}, 1 / 60);
  const blade = bladeGame.playerProjectiles.find((projectile) => projectile.weapon === 'blade_launcher');
  assert.equal(blade.damagePiercesUntilSpent, true);
  assert.equal(blade.maxRicochets, 1);
  assert.equal(blade.ricochetFactor, 0.5);
  assert.equal(blade.ricochetOnEnemyExit, true);
  assert.equal(blade.absorbsEnemyProjectiles, true);
  assert.equal(blade.projectileDeflectionProbability, 0.25);
  assert.equal(bladeGame.playerFireTimer > 0.22 / Math.sqrt(2) * 4, true);
});

test('tracking flechette upgrades scale primary weapon stats', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'tracking_flechette').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.upgrades.trackingFlechetteFireRate = 2;
  game.upgrades.trackingFlechettePierce = 2;
  game.upgrades.trackingFlechetteAcceleration = 1;
  game.upgrades.trackingFlechetteImpactDamage = 1;
  game.upgrades.trackingFlechetteTurningRate = 1;
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const flechette = game.playerProjectiles.find((projectile) => projectile.weapon === 'tracking_flechette');
  assert.equal(flechette.damage.toFixed(2), (12 * 1.05).toFixed(2));
  assert.equal(flechette.pierce, 4);
  assert.equal(flechette.acceleration.toFixed(2), (105 * 1.05).toFixed(2));
  assert.equal(flechette.turnRate.toFixed(2), (7.5 * 1.05).toFixed(2));
  assert.equal(game.playerFireTimer < 0.38 / Math.sqrt(2), true);
});

test('mortar primary arcs land on the selected aim reticle', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mortar').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.autofire = true;
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 99, enemy: createEnemy(game.vehicle.x + 900, game.vehicle.y), markerShown: true, type: 'standard' }];
  const target = { x: game.vehicle.x + 72, y: game.vehicle.y - 96 };
  stepGame(game, { aimWorld: target, manualAimActive: true, gunnerEnabled: false }, 1 / 60);
  game.autofire = false;
  const mortar = game.playerProjectiles.find((projectile) => projectile.weapon === 'mortar');
  const fuseTarget = mortar.targetHint;
  let blast = null;
  for (let index = 0; index < 220 && !blast; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    blast = game.playerProjectiles.find((projectile) => projectile.weapon === 'mortar-blast');
  }
  assert.equal(Boolean(blast), true);
  assert.equal(Math.hypot(blast.x - fuseTarget.x, blast.y - fuseTarget.y) < 0.001, true);
});

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

test('mortar upgrades scale impact and blast stats', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'mortar').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.upgrades.mortarFireRate = 2;
  game.upgrades.mortarImpactDamage = 1;
  game.upgrades.mortarBlastDamage = 2;
  game.upgrades.mortarBlastRadius = 1;
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const mortar = game.playerProjectiles.find((projectile) => projectile.weapon === 'mortar');
  assert.equal(mortar.damage.toFixed(2), (24 * 1.05).toFixed(2));
  assert.equal(mortar.blastDamage.toFixed(2), (90 * 1.05 ** 2).toFixed(2));
  assert.equal(mortar.blastRadius.toFixed(3), (19.125 * CELL_SIZE * 1.05).toFixed(3));
  assert.equal(game.playerFireTimer.toFixed(3), (((1.8666666667 / 1.05 ** 2) / Math.sqrt(2)) * 1.25).toFixed(3));
});

test('blade launcher upgrades scale primary blade stats', () => {
  const vehicleDefinition = setGunLoadoutSlot(startingVehicleDefinition, 'gun', 'primary', 0, 'blade_launcher').definition;
  const game = createGame(1147, { vehicleDefinition });
  game.upgrades.bladeLauncherFireRate = 2;
  game.upgrades.bladeLauncherMaxRicochets = 2;
  game.upgrades.bladeLauncherImpactDamage = 1;
  game.upgrades.bladeLauncherPierce = 3;
  game.upgrades.bladeLauncherRicochetFactor = 2;
  game.upgrades.bladeLauncherProjectileDeflection = 2;
  game.autofire = true;
  stepGame(game, {}, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'blade_launcher');
  assert.equal(blade.damage.toFixed(2), (22 * 1.05).toFixed(2));
  assert.equal(blade.pierce, 7);
  assert.equal(blade.maxRicochets, 3);
  assert.equal(blade.ricochetFactor.toFixed(4), (0.5 * 1.05 ** 2).toFixed(4));
  assert.equal(blade.projectileDeflectionProbability.toFixed(4), (1 - 0.75 * 0.95 ** 2).toFixed(4));
  assert.equal(game.playerFireTimer < (0.88 / Math.sqrt(2)) * 1.064, true);
});

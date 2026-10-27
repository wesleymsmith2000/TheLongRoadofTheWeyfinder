import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { createCombatProjectile, applyArcadeProjectileScaling } from '../src/core/arcadeMode.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { stepProjectiles } from '../src/core/projectile.js';
import { carrySpatialFields, pinPlayerWaveletCharge, stepSpatialFields, waveletBeamCoordinates } from '../src/core/spatialWaveletBeam.js';
import { beamBurstDamage } from '../src/core/beamDamage.js';
import { waveletDisplacement } from '../src/render/waveletDistortion.js';
import starter from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };

const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function weaponGame(weapon = 'vortex_wavelet_beam', runMode = 'arcade', upgrades = {}) {
  const definition = structuredClone(starter);
  for (const gun of definition.gunLoadouts) { gun.primary = [null]; gun.secondary = [null]; }
  definition.gunLoadouts[0].secondary = [weapon];
  definition.modules = [];
  const game = createGame(42, { vehicleDefinition: definition, runMode });
  Object.assign(game.upgrades, upgrades);
  game.secondary.selected = weapon;
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 1000, enemy: createEnemy(0, -2000), type: 'standard' }];
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  game.road.speed = game.road.baseSpeed = 0;
  return game;
}
function start(game) {
  assert.equal(fireSecondary(game), true);
  return game.spatialFields[0];
}
function point(field, along, perpendicular) {
  const ux = Math.cos(field.lockedAngle), uy = Math.sin(field.lockedAngle);
  return { x: field.lockedOrigin.x + ux * along - uy * perpendicular,
    y: field.lockedOrigin.y + uy * along + ux * perpendicular };
}

test('all Arcade wavelet tiers are longer, narrower and triple-distorted without changing Normal tiers', () => {
  for (let tier = 0; tier <= 4; tier++) {
    const arcade = start(weaponGame('vortex_wavelet_beam', 'arcade', { waveletTier: tier }));
    const normal = start(weaponGame('vortex_wavelet_beam', 'normal', { waveletTier: tier }));
    near(arcade.length, normal.length * 1.5);
    near(arcade.config.captureHalfWidth, normal.config.captureHalfWidth * 0.75);
    near(arcade.config.pulseHalfWidth, normal.config.pulseHalfWidth * 0.75);
    near(arcade.config.maxVisualStrengthPx, normal.config.maxVisualStrengthPx * 3);
    near(arcade.config.chargePullAcceleration, normal.config.chargePullAcceleration * 2);
    assert.equal(arcade.config.showGuides, false);
    assert.equal(arcade.config.distortionEnabled, true);
    assert.equal(normal.config.pinSourceDuringCharge, false);
    assert.equal(normal.config.showGuides, true);
  }
});

test('charging pulls live hostile bullets and missiles from both sides and the extended range, leaving distant shots alone', () => {
  const game = weaponGame();
  const field = start(game);
  field.chargeElapsed = field.config.chargeDurationSeconds * 0.75;
  const shots = [point(field, 700, 20), point(field, 70, -20), point(field, 70, 200)].map((position, index) =>
    createCombatProjectile(game, position.x, position.y, 0, 0, {
      team: 'enemy', weapon: index === 1 ? 'boss-missile' : 'bullet', lifetime: 5,
    }));
  game.enemyProjectiles = shots;
  stepSpatialFields(game, 0.1);
  const lateral = shot => shot.vx * -Math.sin(field.lockedAngle) + shot.vy * Math.cos(field.lockedAngle);
  assert.ok(lateral(shots[0]) < 0);
  assert.ok(lateral(shots[1]) > 0);
  near(lateral(shots[2]), 0);
});

test('charging holds position through road carry, movement, boost and incoming impulses, then releases with one backward kick', () => {
  const game = weaponGame();
  game.road.speed = game.road.baseSpeed = 60;
  game.vehicle.vx = 180; game.vehicle.vy = -50;
  const field = start(game);
  const offset = { x: game.vehicle.x - game.road.x, y: game.vehicle.y - game.road.y };
  const fuel = game.boost.fuel;
  for (let frame = 0; frame < 20; frame++) {
    game.vehicle.vx = 200; game.vehicle.vy = -200;
    stepGame(game, { x: 1, y: -1, dodgePressed: true }, 1 / 60);
    near(game.vehicle.x - game.road.x, offset.x);
    near(game.vehicle.y - game.road.y, offset.y);
    near(game.vehicle.vx, 0); near(game.vehicle.vy, 0);
  }
  assert.equal(game.boost.driveTime, 0);
  assert.ok(game.boost.fuel >= fuel);
  field.chargeElapsed = field.config.chargeDurationSeconds - 0.001;
  stepGame(game, { x: 1, y: -1 }, 1 / 60);
  near(game.vehicle.vx, -Math.cos(field.lockedAngle) * 140);
  near(game.vehicle.vy, -Math.sin(field.lockedAngle) * 140);
  assert.equal(pinPlayerWaveletCharge(game), false);
  const before = { x: game.vehicle.x, y: game.vehicle.y };
  stepGame(game, {}, 1 / 60);
  assert.ok((game.vehicle.x - before.x) * -Math.cos(field.lockedAngle) +
    (game.vehicle.y - before.y + 1) * -Math.sin(field.lockedAngle) > 0);
  // The anchor follows the same pure road translation as the locked firing path.
  const anchor = { ...field.sourcePosition };
  carrySpatialFields([field], 7, -9);
  near(field.sourcePosition.x, anchor.x + 7); near(field.sourcePosition.y, anchor.y - 9);
});

test('destroying the charging source releases the player without a recoil kick', () => {
  const game = weaponGame();
  const field = start(game);
  game.vehicle.cells.find(cell => cell.id === field.sourceCellId).state.destroyed = true;
  assert.equal(pinPlayerWaveletCharge(game), false);
  stepSpatialFields(game, 0.1);
  assert.equal(game.spatialFields.length, 0);
  assert.equal(game.secondary.waveletCommitment, null);
  near(game.vehicle.vx, 0); near(game.vehicle.vy, 0);
});

test('the final blast converts hostile shots on either side and on the axis, preserving exactly triple speed without homing back', () => {
  const game = weaponGame();
  const field = start(game);
  field.chargeElapsed = field.config.chargeDurationSeconds * 0.8;
  for (const perpendicular of [-10, 0, 10]) {
    const p = point(field, 80, perpendicular);
    game.enemyProjectiles.push(createCombatProjectile(game, p.x, p.y, 0, 100, {
      team: 'enemy', weapon: 'boss-missile', behavior: 'homing', turnRate: 5,
      acceleration: 50, maxSpeed: 400, delayedAcceleration: true,
      targetHint: game.vehicle, lifetime: 5,
    }));
  }
  // Freeze missile thrust while the wave passes so normal incoming speed is 100.
  for (const shot of game.enemyProjectiles) { shot.acceleration = 0; shot.turnRate = 0; shot.delayedAcceleration = true; }
  stepGame(game, {}, 1 / 60);
  assert.ok(game.enemyProjectiles.some(shot => Math.abs(Math.hypot(shot.vx, shot.vy) - 100) > 0.001));
  field.chargeElapsed = field.config.chargeDurationSeconds - 0.001;
  stepGame(game, {}, 1 / 60);
  for (let frame = 0; frame < 20; frame++) stepGame(game, {}, 1 / 60);
  const returned = game.playerProjectiles.filter(shot => shot.deflected);
  assert.equal(returned.length, 3);
  assert.equal(game.enemyProjectiles.length, 0);
  for (const shot of returned) {
    near(Math.hypot(shot.vx, shot.vy), 300);
    assert.equal(shot.team, 'player');
    assert.equal(shot.sourceWeaponId, 'vortex_wavelet_beam');
    assert.equal(shot.behavior, 'ballistic');
    assert.equal(shot.delayedAcceleration, false);
    assert.ok(shot.vx * Math.cos(field.lockedAngle) + shot.vy * Math.sin(field.lockedAngle) > 0);
    stepProjectiles([shot], 0.1, [game.vehicle]);
    near(Math.hypot(shot.vx, shot.vy), 300);
  }
});

test('each enemy intersecting the pulse receives at least a complete level-ten particle beam burst', () => {
  const beamGame = weaponGame('beam', 'arcade', { beamDamage: 10, beamFireTime: 10 });
  assert.equal(fireSecondary(beamGame), true);
  const beam = beamGame.playerProjectiles[0];
  const referenceDamage = beamBurstDamage(beam.damage, beam.frames);
  const game = weaponGame();
  const field = start(game);
  assert.ok(field.config.frontDamage >= referenceDamage);
  const construct = { schemaVersion: '0.1', assetId: 'target', cells: [
    { id: 'core', type: 'core', gridX: 0, gridY: 0 },
  ], connections: [] };
  game.enemies = [40, 41, 160].map(along => {
    const p = point(field, along, 0);
    const enemy = createEnemy(p.x, p.y, construct, [], { moduleScale: 1 });
    for (const cell of enemy.cells) for (const row of cell.mask) for (const voxel of row) if (voxel.hp > 0) voxel.hp = 10000;
    return enemy;
  });
  stepSpatialFields(game, field.config.chargeDurationSeconds);
  stepSpatialFields(game, 0.2);
  for (const enemy of game.enemies) {
    const damage = enemy.cells.flatMap(cell => cell.mask.flat()).filter(voxel => voxel.hp > 0 && voxel.hp < 10000);
    assert.ok(damage.length > 0);
    assert.ok(damage.every(voxel => 10000 - voxel.hp >= referenceDamage - 1e-7));
  }
});

test('distortion peaks at triple the authored amplitude and fades at field edges', () => {
  const field = start(weaponGame());
  field.chargeElapsed = field.config.chargeDurationSeconds;
  const along = Math.PI / 2 / field.config.spatialFrequency;
  near(waveletDisplacement(field, along, 0, 0), 54);
  near(waveletDisplacement(field, along, field.config.captureHalfWidth, 0), 0);
  near(waveletDisplacement(field, field.length + 1, 0, 0), 0);
  field.chargeElapsed = 0;
  near(waveletDisplacement(field, along, 0, 0), 0);
});

test('bullets from either team and player flechettes enlarge and speed up once, including their acceleration caps', () => {
  for (const [team, weapon] of [['player', 'bullet'], ['enemy', 'bullet'], ['enemy', 'road-boss-bullet'],
    ['enemy', 'diver-gun'], ['player', 'tracking_flechette'], ['player', 'blade_flechette'], ['player', 'cannon-shrapnel']]) {
    const options = { team, weapon, radius: 2, damage: 10, acceleration: 40, maxSpeed: 200,
      sprite: { displaySize: [12, 4] } };
    const normal = createCombatProjectile({ runMode: 'normal' }, 0, 0, 30, 40, options);
    const shot = createCombatProjectile({ runMode: 'arcade' }, 0, 0, 30, 40, options);
    near(shot.radius, normal.radius * 1.5);
    near(Math.hypot(shot.vx, shot.vy), 75);
    near(shot.acceleration, 60); near(shot.maxSpeed, 300);
    assert.deepEqual(shot.sprite.displaySize, [18, 6]);
    near(shot.damage, normal.damage * (team === 'enemy' ? 3 : 1.5));
    applyArcadeProjectileScaling({ runMode: 'arcade' }, shot);
    near(shot.radius, 3); near(Math.hypot(shot.vx, shot.vy), 75);
    assert.deepEqual(options.sprite.displaySize, [12, 4]);
  }
  const enemyFlechette = createCombatProjectile({ runMode: 'arcade' }, 0, 0, 30, 40,
    { team: 'enemy', weapon: 'enemy-tracking-flechette', radius: 2, damage: 10 });
  near(enemyFlechette.radius, 2); near(Math.hypot(enemyFlechette.vx, enemyFlechette.vy), 50);
  near(enemyFlechette.damage, 30);
});

test('derived fragments inherit boosted damage instead of multiplying it again', () => {
  const game = weaponGame('cannon');
  game.performanceDiagnostics.disableCollisions = false;
  game.aimReticle = { x: game.vehicle.x, y: game.vehicle.y - 80 };
  assert.equal(fireSecondary(game), true);
  const shell = game.playerProjectiles[0];
  shell.readyToExplode = true;
  stepGame(game, {}, 0);
  const fragments = game.playerProjectiles.filter(shot => shot.weapon === 'cannon-shrapnel');
  assert.ok(fragments.length > 0);
  for (const shot of fragments) {
    assert.ok(shot.damage >= shell.damage * 0.2 && shot.damage <= shell.damage * 0.36);
  }
});

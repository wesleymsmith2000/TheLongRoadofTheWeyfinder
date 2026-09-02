import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createBossEnemy, createEnemy } from '../src/core/enemy.js';
import { gunMuzzleWorld } from '../src/core/vehicle.js';
import { fireSecondary, stepSecondaryWeapon } from '../src/core/secondaryWeapon.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';
import startingVehicleDefinition from '../content/constructs/starting_vehicle.json' with { type: 'json' };

test('secondary weapon can be fired manually and spends ammo', () => {
  const game = createGame();
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles.length, 1);
  assert.equal(game.playerProjectiles[0].damage, 54);
  assert.equal(game.secondary.ammo.rocket, 16);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.PLAYER_SECONDARY_LAUNCH), true);
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
  assert.equal(game.playerProjectiles[0].length, 256);
  assert.equal(game.playerProjectiles[0].frames, 5);
  assert.equal(game.playerProjectiles[0].vx, game.vehicle.vx);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.PLAYER_BEAM), true);
});

test('rocket secondary creates a homing missile with longer flight time', () => {
  const game = createGame();
  game.vehicle.vx = 12;
  const fired = fireSecondary(game);
  assert.equal(fired, true);
  assert.equal(game.playerProjectiles[0].behavior, 'homing');
  assert.equal(game.playerProjectiles[0].vx, game.vehicle.vx);
  assert.equal(game.playerProjectiles[0].maxSpeed, 97.5);
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
  assert.equal(game.enemies[0].damageTaken > 4, true);
  assert.equal(game.enemies[0].destroyed, false);
});

test('wide beam strips multiple outer voxels without piercing to the core', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.upgrades.beamWidth = 8;
  game.vehicle.turretHeading = 0;
  game.enemies = [createEnemy(game.vehicle.x + 60, game.vehicle.y)];
  fireSecondary(game);
  for (let i = 0; i < 5; i += 1) stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  const enemy = game.enemies[0];
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const removedOuter = enemy.cells
    .filter((cell) => cell !== core)
    .flatMap((cell) => cell.mask.flat())
    .filter((voxel) => voxel.hp <= 0).length;
  const removedCore = core.mask.flat().filter((voxel) => voxel.hp <= 0).length;
  assert.equal(removedOuter > 0, true);
  assert.equal(removedCore, 0);
});

test('boss core survives a single no-pierce beam burst', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.enemies = [createBossEnemy(muzzle.x + 70, muzzle.y - CELL_SIZE / 2)];
  fireSecondary(game);
  for (let i = 0; i < 5; i += 1) stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemies[0].destroyed, false);
});

test('beam is absorbed by enemy shielding ring shots before reaching enemies', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = 0;
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.enemies = [createEnemy(muzzle.x + 90, muzzle.y)];
  game.enemyProjectiles = [
    {
      x: muzzle.x + 45,
      y: muzzle.y,
      vx: 0,
      vy: 0,
      radius: 3,
      damage: 7,
      lifetime: 2,
      team: 'enemy',
      weapon: 'bullet',
      absorbsPlayerProjectiles: true,
      absorbHp: 18,
    },
  ];
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'beam', gunnerEnabled: false }, 1 / 60);
  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  assert.equal(Math.abs(beam.renderEndX - game.enemyProjectiles[0].x) < 0.001, true);
  assert.equal(game.enemies[0].damageTaken, 0);
  assert.equal(game.enemyProjectiles[0].absorbHp < 18, true);
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

test('cannon flechettes inherit pierce and doubled fragment velocity', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  game.vehicle.turretHeading = 0;
  game.upgrades.cannonFlechettePierce = 2;
  game.enemies[0].x = game.vehicle.x + CELL_SIZE * 2.25;
  game.enemies[0].y = game.vehicle.y;
  fireSecondary(game);
  stepGame(game, { secondarySelect: 'cannon' }, 0.08);
  const shrapnel = game.playerProjectiles.filter((projectile) => projectile.weapon === 'cannon-shrapnel');
  assert.equal(shrapnel.every((projectile) => projectile.pierce === 2), true);
  assert.equal(shrapnel.some((projectile) => Math.hypot(projectile.vx, projectile.vy) > 80), true);
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
  assert.equal(game.playerProjectiles[0].damage, 36);
  assert.equal(game.playerProjectiles[0].radius, 4);
  assert.equal(game.playerProjectiles[0].hull.sections.length, 2);
});

test('secondary upgrades alter projectile stats', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  game.upgrades.cannonImpactDamage = 1;
  game.upgrades.cannonVelocity = 2;
  game.upgrades.cannonShrapnelCount = 2;
  game.upgrades.cannonFlechettePierce = 3;
  fireSecondary(game);
  assert.equal(game.playerProjectiles[0].damage.toFixed(1), '37.8');
  assert.equal(Math.hypot(game.playerProjectiles[0].vx, game.playerProjectiles[0].vy) > 135, true);
  assert.equal(game.playerProjectiles[0].shrapnelCount, 30);
  assert.equal(game.playerProjectiles[0].pierce, 3);
});

test('cannon detonates when it reaches the selected aim reticle', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  game.vehicle.turretHeading = Math.PI;
  const muzzle = gunMuzzleWorld(game.vehicle);
  const target = { x: muzzle.x + 47.5, y: muzzle.y };
  game.aimReticle = { ...target, active: true, source: 'pointer' };
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 10, enemy: createEnemy(game.vehicle.x + 800, game.vehicle.y), markerShown: false, type: 'standard' }];
  fireSecondary(game);
  const fuseTarget = game.playerProjectiles[0].targetHint;
  for (let index = 0; index < 16; index += 1) stepGame(game, { secondarySelect: 'cannon', gunnerEnabled: false }, 1 / 60);
  const blast = game.playerProjectiles.find((projectile) => projectile.weapon === 'cannon-blast');
  assert.equal(Boolean(blast), true);
  assert.equal(Math.hypot(blast.x - fuseTarget.x, blast.y - fuseTarget.y) < 8, true);
});

test('cannon detonates instead of vanishing when its target fuse expires short', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.aimReticle = { x: muzzle.x + 800, y: muzzle.y, active: true, source: 'pointer' };
  game.enemies = [];
  game.enemySpawnQueue = [];
  fireSecondary(game);
  game.playerProjectiles[0].lifetime = 0.001;
  stepGame(game, { secondarySelect: 'cannon', gunnerEnabled: false }, 1 / 60);
  assert.equal(game.playerProjectiles.some((projectile) => projectile.weapon === 'cannon-blast'), true);
});

test('detonated cannon shell is removed and cannot spawn repeated blasts', () => {
  const game = createGame();
  game.secondary.selected = 'cannon';
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.aimReticle = { x: muzzle.x + 30, y: muzzle.y, active: true, source: 'pointer' };
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 10, enemy: createEnemy(game.vehicle.x + 800, game.vehicle.y), markerShown: false, type: 'standard' }];
  fireSecondary(game);
  for (let index = 0; index < 30; index += 1) stepGame(game, { secondarySelect: 'cannon', gunnerEnabled: false }, 1 / 60);
  const cannonShells = game.playerProjectiles.filter((projectile) => projectile.weapon === 'cannon');
  const cannonBlasts = game.playerProjectiles.filter((projectile) => projectile.weapon === 'cannon-blast');
  assert.equal(cannonShells.length, 0);
  assert.equal(cannonBlasts.length <= 1, true);
});

test('beam upgrades reduce width growth and base damage while ammo upgrades expand reserve', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.upgrades.beamWidth = 2;
  game.upgrades.beamLength = 1;
  game.upgrades.beamAmmo = 1;
  fireSecondary(game);
  assert.equal(game.playerProjectiles[0].damage, 1.875);
  assert.equal(game.playerProjectiles[0].radius, 1.4);
  assert.equal(game.playerProjectiles[0].length > 256, true);
  assert.equal(game.secondary.ammo.beam, 56);
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

test('beam-selected manual aim points from the muzzle through the reticle at high vehicle velocity', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.vx = 220;
  game.vehicle.vy = -180;
  let target = { x: game.vehicle.x + 160, y: game.vehicle.y - 40 };
  for (let i = 0; i < 40; i += 1) {
    target = { x: game.vehicle.x + 160, y: game.vehicle.y - 40 };
    stepGame(
      game,
      { secondarySelect: 'beam', aimWorld: target, manualAimActive: true, gunnerEnabled: false, compensatedAim: true },
      1 / 60,
    );
  }
  const muzzle = gunMuzzleWorld(game.vehicle, game.vehicle.turretHeading);
  const headingToReticle = Math.atan2(target.y - muzzle.y, target.x - muzzle.x);
  const delta = Math.atan2(Math.sin(headingToReticle - game.vehicle.turretHeading), Math.cos(headingToReticle - game.vehicle.turretHeading));
  assert.equal(Math.abs(delta) < 0.05, true);
});

test('AI aimed beam fires through the visible reticle even before turret turn catches up', () => {
  const game = createGame();
  game.secondary.selected = 'beam';
  game.vehicle.turretHeading = Math.PI;
  game.enemies = [createEnemy(game.vehicle.x + 70, game.vehicle.y + 25)];
  game.enemySpawnQueue = [];

  stepGame(game, { secondarySelect: 'beam', secondaryFirePressed: true, gunnerEnabled: true }, 1 / 60);

  const beam = game.playerProjectiles.find((projectile) => projectile.behavior === 'beam');
  assert.equal(Boolean(beam?.targetHint), true);
  assert.equal(game.aimReticle.source, 'ai');
  const dx = beam.targetHint.x - beam.x;
  const dy = beam.targetHint.y - beam.y;
  const cross = Math.cos(beam.angle) * dy - Math.sin(beam.angle) * dx;
  assert.equal(Math.abs(cross) < 0.001, true);
});

test('new secondary weapons are live runtime choices', () => {
  const staGame = createGame();
  staGame.secondary.selected = 'sta_missile';
  assert.equal(fireSecondary(staGame), true);
  assert.equal(staGame.playerProjectiles[0].weapon, 'sta_missile');
  assert.equal(staGame.playerProjectiles[0].behavior, 'arc');
  assert.equal(staGame.playerProjectiles[0].tracksReticleInArc, true);
  assert.deepEqual(staGame.playerProjectiles[0].sprite.displaySize, [22, 8]);
  assert.equal(staGame.playerProjectiles[0].contrail.particleRadiusScale, 1.5);
  assert.equal(staGame.secondary.ammo.sta_missile, 15);

  const orbGame = createGame();
  orbGame.secondary.selected = 'orb_of_blades';
  orbGame.aimReticle = { x: orbGame.vehicle.x + 120, y: orbGame.vehicle.y, active: true, source: 'pointer' };
  assert.equal(fireSecondary(orbGame), true);
  assert.equal(orbGame.playerProjectiles[0].emitsProjectiles.kind, 'sequentialRadial');
  assert.equal(orbGame.playerProjectiles[0].emitsProjectiles.continuous, true);
  assert.equal(orbGame.playerProjectiles[0].detonateAtTarget, true);
  assert.equal(orbGame.secondary.ammo.orb_of_blades, 11);
  for (let index = 0; index < 5; index += 1) stepGame(orbGame, { secondarySelect: 'orb_of_blades', gunnerEnabled: false }, 1 / 60);
  const blade = orbGame.playerProjectiles.find((projectile) => projectile.weapon === 'orb_flechette');
  assert.equal(Boolean(blade), true);
  assert.equal(blade.radius, 5.8);
  assert.equal(blade.damagePiercesUntilSpent, true);
  assert.equal(blade.absorbsEnemyProjectiles, true);
});

test('STA missile arcs track the live aim reticle while flying', () => {
  const game = createGame();
  game.secondary.selected = 'sta_missile';
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 99, enemy: createEnemy(game.vehicle.x + 900, game.vehicle.y), markerShown: false, type: 'standard' }];
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.aimReticle = { x: muzzle.x + 84, y: muzzle.y - 42, active: true, source: 'pointer' };
  assert.equal(fireSecondary(game), true);
  const movedTarget = { x: muzzle.x - 96, y: muzzle.y + 76 };
  let blast = null;
  for (let index = 0; index < 240 && !blast; index += 1) {
    stepGame(game, { secondarySelect: 'sta_missile', aimWorld: movedTarget, gunnerEnabled: false }, 1 / 60);
    blast = game.playerProjectiles.find((projectile) => projectile.weapon === 'sta_missile-blast');
  }
  assert.equal(Boolean(blast), true);
  assert.equal(Math.hypot(blast.x - movedTarget.x, blast.y - movedTarget.y) < 0.001, true);
});

test('STA missile contrail uses larger blue-grey smoke particles', () => {
  const game = createGame();
  game.autofire = false;
  game.secondary.selected = 'sta_missile';
  game.aimReticle = { x: game.vehicle.x + 120, y: game.vehicle.y, active: true, source: 'pointer' };
  assert.equal(fireSecondary(game), true);
  const missile = game.playerProjectiles[0];
  missile.contrail = { ...missile.contrail, emissionMeanPerSevenFrames: 14 };
  stepGame(game, { aimWorld: game.aimReticle, gunnerEnabled: false }, 1 / 60);
  assert.equal(game.smokeParticles.length > 0, true);
  assert.equal(game.smokeParticles.every((particle) => particle.radius >= 1.05), true);
  assert.equal(game.smokeParticles.every((particle) => missile.contrail.colors.includes(particle.color)), true);
});

test('STA missile upgrades scale impact and blast stats', () => {
  const game = createGame();
  game.secondary.selected = 'sta_missile';
  game.upgrades.staMissileImpactDamage = 1;
  game.upgrades.staMissileBlastDamage = 2;
  game.upgrades.staMissileBlastRadius = 1;
  fireSecondary(game);
  const missile = game.playerProjectiles[0];
  assert.equal(missile.damage.toFixed(2), (24 * 1.05).toFixed(2));
  assert.equal(missile.blastDamage.toFixed(2), (28 * 1.05 ** 2).toFixed(2));
  assert.equal(missile.blastRadius.toFixed(3), (4.5 * CELL_SIZE * 1.05).toFixed(3));
});

test('orb of blades emits continuously until reticle impact and bursts bullets plus flechettes', () => {
  const game = createGame();
  game.secondary.selected = 'orb_of_blades';
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 99, enemy: createEnemy(game.vehicle.x + 900, game.vehicle.y), markerShown: false, type: 'standard' }];
  const muzzle = gunMuzzleWorld(game.vehicle);
  game.aimReticle = { x: muzzle.x + 260, y: muzzle.y, active: true, source: 'pointer' };
  assert.equal(fireSecondary(game), true);
  assert.equal(Math.hypot(game.playerProjectiles[0].vx, game.playerProjectiles[0].vy).toFixed(1), '90.0');
  for (let index = 0; index < 80; index += 1) stepGame(game, { secondarySelect: 'orb_of_blades', gunnerEnabled: false }, 1 / 60);
  assert.equal(game.playerProjectiles.filter((projectile) => projectile.weapon === 'orb_flechette').length > 10, true);

  let bullets = [];
  for (let index = 0; index < 160 && bullets.length === 0; index += 1) {
    stepGame(game, { secondarySelect: 'orb_of_blades', gunnerEnabled: false }, 1 / 60);
    bullets = game.playerProjectiles.filter((projectile) => projectile.weapon === 'orb_bullet');
  }
  assert.equal(game.playerProjectiles.filter((projectile) => projectile.weapon === 'orb_bullet').length, 16);
  assert.equal(game.playerProjectiles.filter((projectile) => projectile.weapon === 'orb_flechette').length >= 12, true);
});

test('orb of blades upgrades scale blade emission and combat stats', () => {
  const game = createGame();
  game.secondary.selected = 'orb_of_blades';
  game.upgrades.orbOfBladesEmissionRate = 1;
  game.upgrades.orbOfBladesBladeDamage = 2;
  game.upgrades.orbOfBladesBladesPerCycle = 2;
  game.upgrades.orbOfBladesBladeKnockback = 1;
  game.aimReticle = { x: game.vehicle.x + 180, y: game.vehicle.y, active: true, source: 'pointer' };
  assert.equal(fireSecondary(game), true);
  const orb = game.playerProjectiles[0];
  assert.equal(orb.emitsProjectiles.count, 12);
  assert.equal(orb.emitsProjectiles.interval.toFixed(4), (0.056 / 1.05).toFixed(4));
  assert.equal(orb.emitsProjectiles.damage.toFixed(2), (18 * 1.05 ** 2).toFixed(2));
  assert.equal(Math.abs(orb.emitsProjectiles.impulse - 31.5 * 1.05) < 0.001, true);
  assert.equal(orb.detonationBurst.groups[0].count, 14);
});

test('orb blade damage pool absorbs enemy projectiles before continuing', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    {
      x: 500,
      y: 0,
      previousX: 484,
      previousY: 0,
      vx: 160,
      vy: 0,
      radius: 5.8,
      damage: 18,
      lifetime: 1,
      team: 'player',
      weapon: 'orb_flechette',
      behavior: 'ballistic',
      absorbsEnemyProjectiles: true,
      damagePiercesUntilSpent: true,
    },
  ];
  game.enemyProjectiles = [{ x: 501.4, y: 0, vx: 0, vy: 0, radius: 2, damage: 7, lifetime: 1, team: 'enemy', weapon: 'enemy-bullet' }];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'orb_flechette');
  assert.equal(game.enemyProjectiles.every((projectile) => projectile.lifetime <= 0), true);
  assert.equal(blade.damage, 11);
  assert.equal(blade.lifetime > 0, true);
});

test('tractor beam is a secondary utility beam with unlimited reserve', () => {
  const game = createGame();
  game.secondary.selected = 'tractor_beam';
  game.aimReticle = { x: game.vehicle.x + 80, y: game.vehicle.y, active: true, source: 'pointer' };
  assert.equal(fireSecondary(game), true);
  const beam = game.playerProjectiles[0];
  assert.equal(beam.weapon, 'tractor_beam');
  assert.equal(beam.behavior, 'beam');
  assert.equal(beam.forceMode, 'pull');
  assert.equal(game.secondary.ammo.tractor_beam, Infinity);
});

test('repulsor primary only fires when close threats are present and aims at them', () => {
  const definition = structuredClone(startingVehicleDefinition);
  definition.gunLoadouts = [{ cellId: 'gun', primary: ['repulsor_beam'], secondary: ['rocket', null, null] }];
  const game = createGame(1147, { vehicleDefinition: definition });
  game.autofire = true;
  game.vehicle.turretHeading = Math.PI;
  game.enemies = [createEnemy(game.vehicle.x + CELL_SIZE * 4, game.vehicle.y)];
  game.enemySpawnQueue = [];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const beam = game.playerProjectiles.find((projectile) => projectile.weapon === 'repulsor_beam');
  assert.equal(Boolean(beam), true);
  assert.equal(beam.forceMode, 'push');
  assert.equal(beam.alpha, 0.5);
  assert.equal(beam.impulse, 10.625);
  assert.equal(game.playerFireTimer > 0.5, true);
  const expectedAngle = Math.atan2(game.enemies[0].y - beam.y, game.enemies[0].x - beam.x);
  const angleDelta = Math.atan2(Math.sin(expectedAngle - beam.angle), Math.cos(expectedAngle - beam.angle));
  assert.equal(Math.abs(angleDelta) < 0.001, true);

  const upgradedGame = createGame(1147, { vehicleDefinition: definition });
  upgradedGame.upgrades.repulsorKnockback = 2;
  upgradedGame.upgrades.repulsorFireRate = 2;
  upgradedGame.enemies = [createEnemy(upgradedGame.vehicle.x + CELL_SIZE * 4, upgradedGame.vehicle.y)];
  upgradedGame.enemySpawnQueue = [];
  stepGame(upgradedGame, { gunnerEnabled: false }, 1 / 60);
  const upgradedBeam = upgradedGame.playerProjectiles.find((projectile) => projectile.weapon === 'repulsor_beam');
  assert.equal(upgradedBeam.impulse.toFixed(3), (85 * 0.125 * 1.05 ** 2).toFixed(3));
  assert.equal(upgradedGame.playerFireTimer < game.playerFireTimer, true);

  const quietGame = createGame(1147, { vehicleDefinition: definition });
  quietGame.enemies = [];
  quietGame.enemySpawnQueue = [];
  stepGame(quietGame, { gunnerEnabled: false }, 1 / 60);
  assert.equal(quietGame.playerProjectiles.some((projectile) => projectile.weapon === 'repulsor_beam'), false);
});

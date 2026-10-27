import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { stepProjectiles } from '../src/core/projectile.js';
import { stepVehicle, vehicleMaxSpeed } from '../src/core/physics.js';
import { arcadeForwardHeading, applyArcadeEnemyFrontBias, containArcadeBoss, arcadePlayBounds } from '../src/core/arcadeMode.js';
import { arcadeLevelProgress, arcadeObjectVisible, retireArcadeGapDivers, stepArcadeGapDivers } from '../src/core/arcadePacing.js';
import { createDiverEnemy, stepDiverEnemy, stepDiverWaves, diverWavesCleared } from '../src/core/diverEnemy.js';
import { worldToRoadOffset, roadOffsetToWorld, configureRoadLaneForViewport } from '../src/core/camera.js';
import { angleDelta } from '../src/core/math.js';
import starter from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };

const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function gapGame() {
  const game = createGame(42, { runMode: 'arcade' });
  game.enemies = [];
  game.enemySpawnQueue = [{ at: 100, enemy: createEnemy(game.road.x, game.road.y - 2000), type: 'standard' }];
  game.autofire = false;
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  return game;
}

test('new Arcade and legacy Lite runs default to Guided AI while Normal defaults to Mixed', () => {
  for (const runMode of ['arcade', 'lite']) {
    const game = createGame(1, { runMode });
    assert.equal(game.targetingMode, 'guided');
    stepGame(game, {}, 0);
    assert.equal(game.targetingMode, 'guided');
  }
  assert.equal(createGame().targetingMode, 'mixed');
});

test('Arcade cannon reaches and detonates once at an off-axis reticle even beyond the original lifetime range', () => {
  for (const distance of [180, 1200]) {
    const game = createGame(42, { runMode: 'arcade' });
    game.autofire = false;
    game.enemies = [];
    game.enemySpawnQueue = [{ at: 100, enemy: createEnemy(0, -2000), type: 'standard' }];
    game.performanceDiagnostics = { freezeTerrainStreaming: true };
    game.vehicle.vx = 240; game.vehicle.vy = -70;
    game.aimReticle = { x: game.vehicle.x + distance, y: game.vehicle.y - 100 };
    game.secondary.selected = 'cannon';
    assert.equal(fireSecondary(game), true);
    const shell = game.playerProjectiles[0];
    const target = shell.targetHint;
    near(angleDelta(Math.atan2(target.y - shell.y, target.x - shell.x), shell.angle), 0);
    assert.ok(Math.abs(angleDelta(shell.angle, arcadeForwardHeading(game))) > 0.5);
    const flightTime = Math.hypot(target.x - shell.x, target.y - shell.y) / Math.hypot(shell.vx, shell.vy);
    assert.ok(shell.maxLifetime > flightTime);
    let blast;
    for (let i = 0; i < 300 && !blast; i++) {
      game.playerProjectiles = stepProjectiles(game.playerProjectiles, 1 / 60, []);
      stepGame(game, { targetingMode: 'manual' }, 0);
      blast = game.playerProjectiles.find(shot => shot.weapon === 'cannon-blast');
    }
    assert.ok(blast);
    near(blast.x, target.x); near(blast.y, target.y);
    assert.equal(shell.detonated, true);
    for (let i = 0; i < 30; i++) stepGame(game, { targetingMode: 'manual' }, 1 / 60);
    assert.equal(game.playerProjectiles.some(shot => shot.weapon === 'cannon'), false);
    assert.equal(game.playerProjectiles.some(shot => shot.weapon === 'cannon-blast'), false);
  }
});

test('Arcade handling gives the same hull 50 percent more acceleration and braking and double top speed', () => {
  const normal = createGame(42, { vehicleDefinition: starter });
  const arcade = createGame(42, { vehicleDefinition: starter, runMode: 'arcade' });
  near(vehicleMaxSpeed(arcade.vehicle), vehicleMaxSpeed(normal.vehicle) * 2);
  stepVehicle(normal.vehicle, { x: 1 }, 0.01);
  stepVehicle(arcade.vehicle, { x: 1 }, 0.01);
  near(arcade.vehicle.vx, normal.vehicle.vx * 1.5);
  const coast = structuredClone(normal.vehicle);
  for (const vehicle of [normal.vehicle, arcade.vehicle, coast]) { vehicle.vx = 100; vehicle.vy = 0; }
  stepVehicle(normal.vehicle, { brake: true }, 0.1);
  stepVehicle(arcade.vehicle, { brake: true }, 0.1);
  stepVehicle(coast, {}, 0.1);
  near(arcade.vehicle.vx / coast.vx, (normal.vehicle.vx / coast.vx) ** 1.5);
  for (const game of [normal, arcade]) { game.vehicle.vx = 100000; stepVehicle(game.vehicle, {}, 0); }
  near(arcade.vehicle.vx, normal.vehicle.vx * 2);
});

test('scrolling carries the Arcade cannon fuse origin along with the shell and locked target', () => {
  const game = gapGame();
  game.secondary.selected = 'cannon';
  game.aimReticle = { x: game.vehicle.x, y: game.vehicle.y - 300 };
  fireSecondary(game);
  const shell = game.playerProjectiles[0];
  const initialOrigin = { x: shell.startX, y: shell.startY };
  const initialTarget = { ...shell.targetHint };
  const roadBefore = { x: game.road.x, y: game.road.y };
  stepGame(game, {}, 0.03);
  near(shell.startX - initialOrigin.x, game.road.x - roadBefore.x);
  near(shell.startY - initialOrigin.y, game.road.y - roadBefore.y);
  near(shell.targetHint.x - initialTarget.x, game.road.x - roadBefore.x);
  near(shell.targetHint.y - initialTarget.y, game.road.y - roadBefore.y);
});

test('all boss families stage forward and remain within the reachable lateral lane on curved roads', () => {
  for (const heading of [0, 0.8]) for (const kind of ['boss', 'roadBossCar', 'pirateBoss', 'zeppelinBoss']) {
    const game = gapGame();
    game.road.heading = heading;
    configureRoadLaneForViewport(game.road, 1000, 700);
    const point = roadOffsetToWorld({ x: 0, y: 0 }, game.road);
    const boss = { ...point, kind, radius: 80, vx: 0, vy: 0 };
    for (let i = 0; i < 600; i++) {
      applyArcadeEnemyFrontBias(game, boss, 1 / 60);
      boss.x += boss.vx / 60; boss.y += boss.vy / 60;
      containArcadeBoss(game, boss);
      assert.ok(Math.abs(worldToRoadOffset(boss, game.road).x) < game.road.halfWidth);
    }
    assert.ok(worldToRoadOffset(boss, game.road).y < -arcadePlayBounds(game.road).ahead * 0.66);
    boss.vx = Math.cos(heading) * 10000; boss.vy = Math.sin(heading) * 10000;
    boss.x += boss.vx / 60; boss.y += boss.vy / 60;
    containArcadeBoss(game, boss);
    assert.ok(Math.abs(worldToRoadOffset(boss, game.road).x) < game.road.halfWidth);
  }
});

test('Arcade boss staging leaves specified strafes and dives in control', () => {
  const game = gapGame();
  for (const boss of [
    { kind: 'roadBossCar', roadBossCar: { phase: 'strafe' } },
    { kind: 'zeppelinBoss', zeppelin: { phase: 'strafe' } },
    { kind: 'boss', charge: { state: 'charging' } },
  ]) {
    Object.assign(boss, { x: 250, y: 100, vx: 180, vy: 40, radius: 50, arcadeBossEnteredLane: true });
    const before = structuredClone(boss);
    applyArcadeEnemyFrontBias(game, boss, 1 / 60);
    containArcadeBoss(game, boss);
    assert.deepEqual({ x: boss.x, y: boss.y, vx: boss.vx, vy: boss.vy }, { x: before.x, y: before.y, vx: before.vx, vy: before.vy });
    assert.equal(boss.arcadeBossEnteredLane, false);
  }
});

test('a single gap Diver appears after two quiet seconds without changing scheduled wave timers or RNG', () => {
  const game = gapGame();
  const timer = game.diverWaves.nextIn;
  const random = JSON.stringify(game.rng);
  stepArcadeGapDivers(game, 1.99);
  assert.equal(game.enemies.length, 0);
  stepArcadeGapDivers(game, 0.011);
  const filler = game.enemies[0];
  assert.equal(game.enemies.length, 1);
  assert.equal(filler.arcadeGapDiver, true);
  assert.equal(filler.countsForCompletion, false);
  assert.equal(game.diverWaves.wavesSpawned, 0);
  assert.equal(game.diverWaves.nextIn, timer);
  assert.equal(game.enemySpawnQueue[0].at, 100);
  assert.equal(JSON.stringify(game.rng), random);
  stepDiverEnemy(game, filler, 0.01);
  assert.equal(JSON.stringify(game.rng), random);
  stepDiverWaves(game, 1);
  near(game.diverWaves.nextIn, timer - 1);
  stepArcadeGapDivers(game, 10);
  assert.equal(game.enemies.length, 1);
});

test('visible scrap or enemies reset the gap timer while offscreen scrap does not block it', () => {
  const game = gapGame();
  game.arcadeGapQuietSeconds = 1.99;
  game.scrapPickups = [{ x: game.camera.x, y: game.camera.y, radius: 2 }];
  stepArcadeGapDivers(game, 0.1);
  assert.equal(game.arcadeGapQuietSeconds, 0);
  assert.equal(game.enemies.length, 0);
  game.scrapPickups[0].x += 10000;
  stepArcadeGapDivers(game, 2);
  assert.equal(game.enemies.length, 1);
  const other = gapGame();
  other.enemies = [createEnemy(other.camera.x, other.camera.y)];
  stepArcadeGapDivers(other, 2);
  assert.equal(other.enemies.some(enemy => enemy.arcadeGapDiver), false);
});

test('scheduled normal and Diver waves send gap Divers straight out without explosion or scrap', () => {
  for (const wave of ['normal', 'diver']) {
    const game = gapGame();
    configureRoadLaneForViewport(game.road, 1000, 700);
    stepArcadeGapDivers(game, 2);
    const filler = game.enemies[0];
    filler.diver.fireTimer = 0;
    if (wave === 'normal') game.enemySpawnQueue[0].at = 0;
    else game.diverWaves.nextIn = 0;
    stepGame(game, {}, 0);
    assert.equal(filler.diver.gapExit, true);
    assert.equal(game.enemyProjectiles.some(shot => shot.sourceEnemy === filler), false);
    for (let i = 0; i < 600 && game.enemies.includes(filler); i++) stepGame(game, {}, 1 / 60);
    assert.equal(game.enemies.includes(filler), false);
    assert.equal(arcadeObjectVisible(game, filler), false);
    assert.equal(filler.explosionStart, null);
    assert.equal(game.scrapPickups.length, 0);
  }
});

test('gap Divers never block required waves or completion, and do not hide the fifteen-second watchdog', () => {
  const game = gapGame();
  stepArcadeGapDivers(game, 2);
  const filler = game.enemies[0];
  game.arcadeEmptyScreenSeconds = 14.99;
  stepGame(game, {}, 0.033);
  assert.equal(game.enemySpawnQueue.length, 0);
  assert.equal(filler.diver.gapExit, true);
  game.enemies = [filler]; game.enemySpawnQueue = [];
  game.diverWaves.wavesSpawned = 2;
  assert.equal(diverWavesCleared(game), true);
  game.victoryBanner = { elapsed: 3, minDuration: 3 };
  stepGame(game, {}, 0);
  assert.equal(game.levelComplete, true);
});

test('Arcade progress includes required wave clears and partial kills and excludes gap Divers', () => {
  const game = gapGame();
  const filler = createDiverEnemy(0, 0); filler.arcadeGapDiver = true;
  game.enemies = [filler];
  near(arcadeLevelProgress(game, 1).fraction, 0.5);
  game.diverWaves = { wavesCleared: 0, waitingForClear: true, currentWaveSize: 4, wavesSpawned: 1 };
  game.enemies.push(createDiverEnemy(0, 0), createDiverEnemy(0, 0));
  near(arcadeLevelProgress(game, 1).fraction, 0.625);
  game.enemies = [filler];
  const first = arcadeLevelProgress(game, 1);
  near(first.fraction, 0.75); assert.equal(first.wavesCleared, 1);
  game.diverWaves.wavesCleared = 1; game.diverWaves.wavesSpawned = 2;
  const second = arcadeLevelProgress(game, 1);
  assert.equal(second.wavesCleared, 2); near(second.fraction, 0.985);
  game.levelComplete = true;
  near(arcadeLevelProgress(game, 1).fraction, 1);
});

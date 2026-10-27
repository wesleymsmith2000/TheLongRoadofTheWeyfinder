import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy, createRoadBossCarEnemy, createMortarSkiffEnemy, createZeppelinBossEnemy } from '../src/core/enemy.js';
import { createProjectile, stepProjectiles } from '../src/core/projectile.js';
import { arcadeProjectileVelocity } from '../src/core/projectileLaunch.js';
import { arcadeForwardHeading, arcadeForwardVector, applyArcadeEnemyFrontBias, applyArcadeProjectileScaling, createCombatProjectile } from '../src/core/arcadeMode.js';
import { roadOffsetToWorld, worldToRoadOffset } from '../src/core/camera.js';
import { setGunLoadoutSlot } from '../src/core/weaponLoadout.js';
import { createWeaponBayState } from '../src/core/weaponBay.js';
import { localToWorld, angleDelta } from '../src/core/math.js';
import { Rng } from '../src/core/rng.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import startingVehicle from '../content/constructs/starting_vehicle.json' with { type: 'json' };
import arcadeVehicle from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };
import aimedShot from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };
import mothConstruct from '../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };

const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const core = {
  schemaVersion: '0.1', assetId: 'test.arcade_core',
  cells: [{ id: 'core', type: 'core', gridX: 0, gridY: 0 }], connections: [],
};

function weaponGame(weapon, runMode = 'arcade') {
  const definition = setGunLoadoutSlot(startingVehicle, 'gun', 'primary', 0, weapon).definition;
  const game = createGame(1147, { vehicleDefinition: definition, runMode });
  game.enemies = [createEnemy(game.vehicle.x + 300, game.vehicle.y, core, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.autofire = true;
  game.performanceDiagnostics = { disableCollisions: true };
  return game;
}

function firstShot(game, weapon) {
  stepGame(game, { gunnerEnabled: false, aimWorld: { x: game.vehicle.x + 400, y: game.vehicle.y } }, 1 / 60);
  return game.playerProjectiles.find(p => p.sourceWeaponId === weapon);
}

test('legacy Lite normalizes to Arcade and retains slot locks; default remains Normal', () => {
  const legacy = createGame(1147, { runMode: 'lite', vehicleDefinition: arcadeVehicle });
  assert.equal(legacy.runMode, 'arcade');
  assert.equal(createGame().runMode, 'normal');
  assert.deepEqual(createWeaponBayState(arcadeVehicle, 'lite'), createWeaponBayState(arcadeVehicle, 'arcade'));
  assert.equal(legacy.weaponBay.unlockedSlots['gun-support'].primary[0], false);
  assert.equal(stepGame(legacy, { resetPressed: true }, 0).runMode, 'arcade');
});

test('Arcade locks the body to current road-forward through turns, spin input and translation', () => {
  for (const heading of [0, Math.PI / 3, -Math.PI / 2]) {
    const route = { startHeading: heading, segments: [
      { length: 2, turnRadians: 0 }, { length: 100, turnRadians: Math.PI / 2 },
    ] };
    const game = createGame(1147, { runMode: 'arcade', terrainRoute: route });
    game.autofire = false;
    game.performanceDiagnostics = { disableCollisions: true };
    game.road.speed = game.road.baseSpeed = 60;
    game.vehicle.angularVelocity = 20;
    for (let frame = 0; frame < 8; frame++) {
      stepGame(game, { turn: 1, x: 1 }, 1 / 60);
      near(game.vehicle.heading, game.road.heading);
      const nose = localToWorld({ x: 0, y: -1 }, game.vehicle);
      const forward = arcadeForwardVector(game);
      near(nose.x - game.vehicle.x, forward.x);
      near(nose.y - game.vehicle.y, forward.y);
      assert.equal(game.vehicle.angularVelocity, 0);
    }
    assert.ok(Math.abs(game.road.heading - heading) > 0.01);
    assert.ok(Math.hypot(game.vehicle.vx, game.vehicle.vy) > 0);
  }
});

test('Arcade launch is axial, ignores sideways/backward velocity, and has a smooth 50% spacing floor', () => {
  for (const velocity of [{ x: 0, y: 0 }, { x: -300, y: 0 }, { x: 0, y: 500 }]) {
    assert.deepEqual(arcadeProjectileVelocity(velocity, { x: 2, y: 0 }, 160), { x: 160, y: 0 });
  }
  let lastRelative = 160;
  for (const speed of [0.001, 10, 100, 1000, 100000]) {
    const shot = arcadeProjectileVelocity({ x: speed, y: 20 }, { x: 1, y: 0 }, 160);
    const relative = shot.x - speed;
    assert.ok(shot.x > 160);
    assert.equal(shot.y, 0);
    assert.ok(relative >= 80 && relative <= lastRelative);
    lastRelative = relative;
  }
  near(lastRelative, 80);
  assert.deepEqual(arcadeProjectileVelocity({}, { x: 0, y: 0 }, 160), { x: 0, y: 0 });
  assert.deepEqual(arcadeProjectileVelocity({}, { x: 1, y: 0 }, 0), { x: 0, y: 0 });
  const step = 1e-5;
  near(arcadeProjectileVelocity({ x: step, y: 0 }, { x: 1, y: 0 }, 160).x, 160 + step / 2);
});

for (const weapon of ['main.basic', 'blade_launcher', 'tracking_flechette']) {
  test(`Arcade ${weapon} fires road-forward regardless of cursor or turret`, () => {
    const game = weaponGame(weapon);
    game.vehicle.turretHeading = 0;
    game.road.route = { ...game.road.route, startHeading: 0.8 };
    const shot = firstShot(game, weapon);
    assert.ok(shot);
    const deviation = angleDelta(arcadeForwardHeading(game), shot.angle);
    if (weapon === 'main.basic') assert.ok(Math.abs(deviation) <= Math.PI / 18);
    else near(deviation, 0);
    if (shot.behavior !== 'beam' && weapon !== 'main.basic') {
      const forward = arcadeForwardVector(game);
      near(shot.vx * forward.y - shot.vy * forward.x, 0);
    }
    if (weapon === 'mini_beam') {
      stepGame(game, { aimWorld: { x: game.vehicle.x - 400, y: game.vehicle.y } }, 1 / 60);
      near(shot.angle, arcadeForwardHeading(game));
    }
  });
}

test('Arcade Main Gun spray is seeded on both sides of road-forward and tightens with accuracy upgrades', () => {
  function sample(accuracy = 0) {
    const game = weaponGame('main.basic');
    game.road.route = { ...game.road.route, startHeading: 0.65 };
    game.rng = new Rng(42);
    game.upgrades.gunAccuracy = accuracy;
    const offsets = [];
    for (let i = 0; i < 80; i++) {
      game.primaryWeaponCooldowns = {};
      game.playerProjectiles = [];
      stepGame(game, { gunnerEnabled: false, aimWorld: { x: game.vehicle.x - 500, y: game.vehicle.y } }, 0);
      const shot = game.playerProjectiles.find(p => p.weapon === 'bullet');
      offsets.push(angleDelta(arcadeForwardHeading(game), shot.angle));
    }
    return offsets;
  }
  const offsets = sample();
  assert.deepEqual(sample(), offsets);
  assert.ok(offsets.some(a => a > 0.02) && offsets.some(a => a < -0.02));
  assert.ok(offsets.every(a => Math.abs(a) <= Math.PI / 18));
  assert.ok(Math.abs(offsets.reduce((a, b) => a + b, 0) / offsets.length) < 0.03);
  assert.ok(Math.max(...sample(8).map(Math.abs)) < Math.max(...offsets.map(Math.abs)));
});

test('Arcade Main Gun bullets retain double flight duration and now travel three times the Normal range', () => {
  const normal = weaponGame('main.basic', 'normal');
  const arcade = weaponGame('main.basic');
  const a = firstShot(arcade, 'main.basic');
  const n = firstShot(normal, 'main.basic');
  near(a.maxLifetime, n.maxLifetime * 2);
  near(a.maxLifetime, 4.4);
  near(Math.hypot(a.vx, a.vy) * a.maxLifetime, Math.hypot(n.vx, n.vy) * n.maxLifetime * 3);
});

for (const weapon of ['main.basic', 'blade_launcher', 'tracking_flechette', 'mortar']) {
  test(`Arcade ${weapon} triples upgraded primary damage and doubles cooldown exactly once`, () => {
    const normal = weaponGame(weapon, 'normal');
    const arcade = weaponGame(weapon);
    for (const game of [normal, arcade]) {
      game.upgrades.gunDamage = 2;
      game.upgrades.mortarBlastDamage = 2;
      game.upgrades.bladeLauncherImpactDamage = 2;
      game.upgrades.trackingFlechetteImpactDamage = 2;
      game.upgrades.miniBeamDamage = 2;
    }
    const a = firstShot(arcade, weapon), n = firstShot(normal, weapon);
    near(a.damage, n.damage * 3);
    near(Object.values(arcade.primaryWeaponCooldowns)[0], Object.values(normal.primaryWeaponCooldowns)[0] * 2);
    if (weapon === 'mortar') {
      near(a.blastDamage, n.blastDamage * 3);
      near(a.blastRadius, n.blastRadius * 1.5);
      near(a.vx, (a.targetHint.x - a.previousX) / a.arcFlightTime);
      near(a.vy, (a.targetHint.y - a.previousY) / a.arcFlightTime);
      assert.ok(Math.abs(a.angle - arcadeForwardHeading(arcade)) > 0.1);
    }
  });
}

test('Arcade Blade scales speed, hitbox and sprite and applies deflection upgrades from 33%', () => {
  const normal = weaponGame('blade_launcher', 'normal');
  const arcade = weaponGame('blade_launcher');
  normal.upgrades.bladeLauncherProjectileDeflection = 2;
  arcade.upgrades.bladeLauncherProjectileDeflection = 2;
  const a = firstShot(arcade, 'blade_launcher'), n = firstShot(normal, 'blade_launcher');
  near(Math.hypot(a.vx, a.vy), Math.hypot(n.vx, n.vy) * 0.5);
  near(a.radius, n.radius * 1.25);
  near(a.sprite.displaySize[0], n.sprite.displaySize[0] * 1.25);
  near(a.projectileDeflectionProbability, 1 - 0.67 * 0.95 ** 2);
  assert.equal(a.ricochetProbability, 0.5);
  assert.equal(n.ricochetProbability, 1);
});

test('Arcade Flechettes acquire nearest enemy to the moving player after delay, ignoring cursor and projectile proximity', () => {
  const game = weaponGame('tracking_flechette');
  const shot = firstShot(game, 'tracking_flechette');
  assert.equal(shot.tracksReticleInHoming, false);
  assert.equal(shot.homingReference, game.vehicle);
  shot.x = game.vehicle.x + 500;
  shot.y = game.vehicle.y;
  const nearestPlayer = { x: game.vehicle.x + 10, y: game.vehicle.y };
  const nearestShot = { x: shot.x + 10, y: shot.y + 10 };
  const dead = { x: game.vehicle.x, y: game.vehicle.y, destroyed: true };
  shot.delayBeforeAcceleration = 0;
  stepProjectiles([shot], 0.3, [nearestPlayer, nearestShot, dead]);
  near(Math.abs(shot.angle), Math.PI);
  assert.ok(shot.vx < 0);
  assert.equal(shot.accelerationLocked, true);
  game.vehicle.x = nearestShot.x;
  // Once launched, steering follows the nearest enemy to the new player position.
  shot.x = game.vehicle.x - 100;
  shot.y = nearestShot.y;
  stepProjectiles([shot], 0.3, [nearestPlayer, nearestShot]);
  assert.ok(Math.abs(shot.angle) < Math.PI);
});

test('the utility repulsor retains threat aim and cooldown with the common Arcade damage boost', () => {
  const games = ['normal', 'arcade'].map(mode => {
    const game = createGame(1147, { runMode: mode });
    game.autofire = true;
    game.enemies = [createEnemy(game.vehicle.x + CELL_SIZE * 8, game.vehicle.y, core, [], { moduleScale: 1 })];
    game.enemySpawnQueue = [];
    game.performanceDiagnostics = { disableCollisions: true };
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    return game;
  });
  const [normal, arcade] = games;
  const n = normal.playerProjectiles.find(p => p.weapon === 'repulsor_beam');
  const a = arcade.playerProjectiles.find(p => p.weapon === 'repulsor_beam');
  assert.ok(n && a);
  assert.equal(a.arcadeForwardLocked, false);
  near(a.damage, n.damage * 1.5);
  near(arcade.primaryWeaponCooldowns['utility:0:repulsor_beam'], normal.primaryWeaponCooldowns['utility:0:repulsor_beam']);
  near(arcade.playerDefensiveFireTimer, normal.playerDefensiveFireTimer);
  near(a.angle, Math.atan2(arcade.enemies[0].y - a.y, arcade.enemies[0].x - a.x));
});

test('both teams scale explosive radii and the new damage boost exactly once', () => {
  for (const team of ['player', 'enemy']) {
    const game = { runMode: 'arcade' };
    const shot = createCombatProjectile(game, 0, 0, 1, 0, { team, damage: 7, blastDamage: 8, blastRadius: 20, blastOnExpire: { radius: 30, damage: 9 } });
    near(shot.blastRadius, 30);
    near(shot.blastOnExpire.radius, 45);
    near(shot.damage, team === 'enemy' ? 21 : 10.5);
    near(shot.blastDamage, team === 'enemy' ? 24 : 12);
    near(shot.blastOnExpire.damage, team === 'enemy' ? 27 : 13.5);
    applyArcadeProjectileScaling(game, shot);
    near(shot.blastOnExpire.radius, 45);
    near(shot.blastOnExpire.damage, team === 'enemy' ? 27 : 13.5);
  }
  const expiryGame = weaponGame('main.basic');
  expiryGame.autofire = false;
  const shell = createCombatProjectile(expiryGame, 1000, 1000, 0, 0, {
    team: 'enemy', weapon: 'expiry-test', lifetime: 0.01, explodeOnExpire: true,
    blastOnExpire: { radius: 20, damage: 9, impulse: 0 },
  });
  expiryGame.enemyProjectiles = [shell];
  stepGame(expiryGame, { gunnerEnabled: false }, 0.02);
  const blast = expiryGame.enemyProjectiles.find(p => p.weapon === 'enemy-pulse-blast');
  assert.ok(blast);
  near(blast.maxRadius, 30);
  for (const weapon of ['cannon', 'rocket', 'sta_missile']) {
    const games = ['normal', 'arcade'].map(mode => {
      const definition = setGunLoadoutSlot(startingVehicle, 'gun', 'secondary', 0, weapon).definition;
      const game = createGame(1147, { runMode: mode, vehicleDefinition: definition });
      game.autofire = false;
      stepGame(game, { targetingMode: 'manual', aimWorld: { x: game.vehicle.x + 800, y: game.vehicle.y - 100 }, secondarySelect: weapon, secondaryFirePressed: true }, 1 / 60);
      return game;
    });
    const [normal, arcade] = games;
    const n = normal.playerProjectiles.find(p => p.weapon === weapon), a = arcade.playerProjectiles.find(p => p.weapon === weapon);
    near(a.blastRadius, n.blastRadius * 1.5);
    near(a.damage, n.damage * 1.5);
    near(a.blastDamage, n.blastDamage * 1.5);
    near(arcade.secondary.cooldown, normal.secondary.cooldown);
  }
});

test('pattern enemies and bespoke bosses halve projectile timer speed and triple projectile damage', () => {
  for (const factory of [() => createEnemy(250, 0, undefined, [aimedShot]), () => createRoadBossCarEnemy(250, 0), () => createMortarSkiffEnemy(250, 0)]) {
    const games = ['normal', 'arcade'].map(mode => {
      const game = weaponGame('main.basic', mode);
      game.autofire = false;
      game.enemies = [factory()];
      return game;
    });
    const [normal, arcade] = games;
    for (const game of games) {
      const enemy = game.enemies[0];
      for (const pattern of enemy.patterns) pattern.timer = 1;
      enemy.artilleryTimer = 1;
      enemy.roadBossCar = { phase: 'orbit', phaseTimer: 5, gunIndex: 0, bulletCooldown: 1, bladeCooldown: 1, mortarCooldown: 1, mineCooldown: 1 };
      stepGame(game, { gunnerEnabled: false }, 0.02);
    }
    const n = normal.enemies[0], a = arcade.enemies[0];
    if (n.patterns.length) near(1 - a.patterns[0].timer, (1 - n.patterns[0].timer) / 2);
    if (n.kind === 'roadBossCar') near(1 - a.roadBossCar.bulletCooldown, (1 - n.roadBossCar.bulletCooldown) / 2);
    if (n.artilleryTimer < 1) near(1 - a.artilleryTimer, (1 - n.artilleryTimer) / 2);
    // Fire from both paths with matching upgraded content.
    for (const game of games) {
      const enemy = game.enemies[0];
      for (const pattern of enemy.patterns) pattern.timer = 0;
      enemy.artilleryTimer = 0;
      enemy.roadBossCar.bulletCooldown = 0;
      stepGame(game, { gunnerEnabled: false }, 0);
    }
    assert.ok(normal.enemyProjectiles.length > 0);
    for (let i = 0; i < normal.enemyProjectiles.length; i++) {
      const n = normal.enemyProjectiles[i], a = arcade.enemyProjectiles[i];
      near(a.damage, n.damage * 3);
      if (n.blastOnExpire) {
        near(a.blastOnExpire.radius, n.blastOnExpire.radius * 1.5);
        near(a.blastOnExpire.damage, n.blastOnExpire.damage * 3);
      }
    }
  }
});

test('front recovery is road-relative, preserves a top band and permits temporary maneuvers', () => {
  for (const heading of [0, 1.2, -1.4]) {
    const game = { runMode: 'arcade', road: { x: 10, y: 20, heading, halfHeight: 100, halfWidth: 150 }, vehicle: { vx: 0, vy: 0 } };
    Object.assign(game.vehicle, roadOffsetToWorld({ x: 15, y: 20 }, game.road));
    const behind = { ...roadOffsetToWorld({ x: 0, y: 70 }, game.road), vx: 0, vy: 0 };
    const forward = arcadeForwardVector(game);
    applyArcadeEnemyFrontBias(game, behind, 0.1);
    assert.ok(behind.vx * forward.x + behind.vy * forward.y > 0);
    for (const y of [-75, -60]) {
      const ahead = { ...roadOffsetToWorld({ x: 0, y }, game.road), vx: 13, vy: 4 };
      applyArcadeEnemyFrontBias(game, ahead, 0.1);
      assert.deepEqual({ vx: ahead.vx, vy: ahead.vy }, { vx: 13, vy: 4 });
    }
    for (const exemption of [{ staticObstacle: true }, { terrainAnchored: true }, { charge: { state: 'charging' } }, { mothBomber: { phase: 'dive' } }, { arcadeBehindEntry: true }, { dizzyTimer: 2 }, { zeppelin: { phase: 'strafe' } }]) {
      const enemy = { ...roadOffsetToWorld({ x: 0, y: 70 }, game.road), vx: 0, vy: 0, ...exemption };
      applyArcadeEnemyFrontBias(game, enemy, 0.1);
      near(Math.hypot(enemy.vx, enemy.vy), 0);
    }
    const enemy = { ...roadOffsetToWorld({ x: 0, y: 70 }, game.road), vx: 0, vy: 0, charge: { state: 'idle' } };
    for (let frame = 0; frame < 180; frame++) {
      applyArcadeEnemyFrontBias(game, enemy, 1 / 60);
      enemy.x += enemy.vx / 60;
      enemy.y += enemy.vy / 60;
    }
    assert.ok(worldToRoadOffset(enemy, game.road).y < 20 - 15);
  }
});

test('Arcade Moth dive and Zeppelin flyover hand movement back to front recovery', () => {
  const game = weaponGame('main.basic');
  game.autofire = false;
  const moth = createEnemy(game.vehicle.x, game.vehicle.y + 20, mothConstruct, [], { moduleScale: 1 });
  moth.archetypeId = 'moth_bomber.freedoms_pass';
  moth.mothBomber = {
    phase: 'dive', fuseRemaining: 5, diveTarget: { x: moth.x, y: moth.y - 5 },
    diveAngle: Math.PI / 2, edgeTurnTimer: 0, edgeReactionTimer: 0, orbitSign: 1,
  };
  game.enemies = [moth];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(moth.mothBomber.phase, 'orbit');
  assert.ok(moth.vy < 0);

  const boss = createZeppelinBossEnemy(0, 0);
  Object.assign(boss, roadOffsetToWorld({ x: 0, y: game.road.halfHeight + 200 }, game.road));
  boss.zeppelin.phase = 'strafe';
  boss.zeppelin.strafeAngle = Math.PI / 2;
  game.enemies = [boss];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.phase, 'recover');
  const initial = worldToRoadOffset(boss, game.road).y;
  for (let frame = 0; frame < 45; frame++) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.ok(worldToRoadOffset(boss, game.road).y < initial);
});

test('a first side entry can cross before bias resumes, and Normal ignores front bias', () => {
  const game = { runMode: 'arcade', road: { x: 0, y: 0, heading: 0, halfWidth: 120, halfHeight: 100 }, vehicle: { x: 0, y: 0, vx: 0, vy: 0 } };
  const enemy = { x: 100, y: 50, vx: -100, vy: 0, arcadeEntryCrossing: 1 };
  applyArcadeEnemyFrontBias(game, enemy, 0.1);
  assert.equal(enemy.vy, 0);
  enemy.x = -5;
  applyArcadeEnemyFrontBias(game, enemy, 0.1);
  assert.ok(enemy.vy < 0);
  const normalEnemy = { x: 0, y: 100, vx: 0, vy: 0 };
  applyArcadeEnemyFrontBias({ ...game, runMode: 'normal' }, normalEnemy, 0.1);
  assert.equal(normalEnemy.vy, 0);
  const delayedEntry = { x: 0, y: 100, vx: 0, vy: 0, arcadeBehindEntry: true };
  for (let frame = 0; frame < 180; frame++) applyArcadeEnemyFrontBias(game, delayedEntry, 1 / 60);
  assert.ok(delayedEntry.vy < 0, 'an entry that cannot catch the player still resumes recovery after its grace period');
});

test('seeded ricochet rolls can succeed or fail without confusing probability with retained damage', () => {
  const results = [];
  for (const seed of [1, 1147, 10000, 100000, 123456789, 987654321, 2222222222, 3333333333]) {
    const game = createGame(seed, { runMode: 'arcade' });
    game.autofire = false;
    game.enemies = [createEnemy(0, 0, core, [], { moduleScale: 1 }), createEnemy(0, CELL_SIZE * 10, core, [], { moduleScale: 1 })];
    game.enemySpawnQueue = [];
    const blade = createProjectile(-CELL_SIZE * 5, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player', weapon: 'orb_flechette', damage: 400, radius: 4.2, pierce: 48,
      pierceDamageFalloff: 1, damagePiercesUntilSpent: true, maxRicochets: 2,
      ricochetFactor: 0.5, ricochetProbability: 0.5, ricochetOnEnemyExit: true, lifetime: 1,
    });
    game.playerProjectiles = [blade];
    game.rng = new Rng(seed);
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    results.push(blade.ricochetCount);
    if (!blade.ricochetCount) {
      assert.equal(blade.vx, CELL_SIZE * 5 * 60);
      assert.equal(blade.vy, 0);
      assert.ok(blade.lifetime > 0);
    }
    assert.ok(blade.ricochetCount <= 2);
  }
  assert.ok(results.includes(0));
  assert.ok(results.includes(1));
});

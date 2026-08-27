import { createStartingVehicle, gunMuzzleWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle } from './physics.js';
import { createProjectile, stepProjectiles } from './projectile.js';
import { hitVehicleWithProjectile } from './damage.js';
import { distanceSquared } from './math.js';
import { Rng } from './rng.js';
import {
  containVehicleInRoadFrame,
  createRoadCamera,
  createRoadFrame,
  roadOffsetToWorld,
  stepRoadCamera,
  stepRoadFrame,
  worldToRoadOffset,
} from './camera.js';
import { CELL_SIZE } from './voxelMask.js';
import { stepTurretAim } from './turret.js';
import { createBoostState, stepBoost } from './boost.js';
import { applyEnemyDamage, createEnemy, traceEnemyVoxelRay } from './enemy.js';
import { createSecondaryState, stepSecondaryWeapon } from './secondaryWeapon.js';

export function createGame(seed = 1147) {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  return {
    rng: new Rng(seed),
    vehicle,
    road,
    camera: createRoadCamera(road),
    enemies: createLevelEnemies(road, 1),
    boost: createBoostState(),
    secondary: createSecondaryState(),
    playerProjectiles: [],
    enemyProjectiles: [],
    autofire: true,
    playerFireTimer: 0,
    levelComplete: false,
    levelTime: 0,
    level: 1,
    levelStartTime: 0,
    levelTimes: [],
    levelsCompleted: 0,
    score: { damageDone: 0 },
    time: 0,
    fps: 60,
    gameOver: false,
  };
}

export function stepGame(game, input, dt) {
  dt = Math.min(dt, 0.033);
  game.time += dt;
  if (input.resetPressed) return createGame(1147);
  if (input.nextLevelPressed && game.levelComplete) return startNextLevel(game);
  if (game.levelComplete || game.gameOver) {
    stepRoadCamera(game.camera, game.road, game.vehicle, dt);
    return game;
  }
  if (input.fireTogglePressed) game.autofire = !game.autofire;
  game.inputFireHeld = Boolean(input.fireHeld);

  const roadDelta = stepRoadFrame(game.road, dt);
  carryRoadObjects(game, roadDelta);
  stepVehicle(game.vehicle, input, dt, game.road.heading);
  stepBoost(game.vehicle, game.boost, input, game.road.heading, dt);
  stepTurretAim(game.vehicle, activeEnemies(game), input, dt);
  stepEnemies(game, dt);
  stepPlayerGun(game, dt);
  stepSecondaryWeapon(game, input, dt);

  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt, activeEnemies(game));
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleCollisions(game);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  game.gameOver = !game.vehicle.alive;
  if (activeEnemies(game).length === 0) {
    game.levelComplete = true;
    game.levelTime = game.time - game.levelStartTime;
    game.levelTimes.push(game.levelTime);
    game.levelsCompleted = game.level;
  }
  return game;
}

export function startNextLevel(game) {
  game.level += 1;
  game.levelComplete = false;
  game.levelTime = 0;
  game.levelStartTime = game.time;
  game.enemies = createLevelEnemies(game.road, game.level);
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  return game;
}

export function createLevelEnemies(road, count) {
  const enemies = [];
  for (let i = 0; i < count; i += 1) {
    const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 90;
    const row = Math.floor(i / 4) * 70;
    const world = roadOffsetToWorld({ x: spread, y: -190 - row }, road);
    enemies.push(createEnemy(world.x, world.y));
  }
  return enemies;
}

function activeEnemies(game) {
  return game.enemies.filter((enemy) => !enemy.destroyed);
}

function carryRoadObjects(game, delta) {
  const objects = [game.vehicle, ...game.enemies, ...game.playerProjectiles, ...game.enemyProjectiles, ...game.vehicle.detachedPieces];
  for (const object of objects) {
    object.x += delta.dx;
    object.y += delta.dy;
  }
}

function stepPlayerGun(game, dt) {
  game.playerFireTimer -= dt;
  if ((!game.autofire && !game.inputFireHeld) || game.playerFireTimer > 0 || game.gameOver || !hasFunctionalGun(game.vehicle)) return;
  const muzzle = gunMuzzleWorld(game.vehicle);
  if (!muzzle) return;
  const speed = 430;
  const angle = game.vehicle.turretHeading;
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, Math.cos(angle) * speed + game.vehicle.vx, Math.sin(angle) * speed + game.vehicle.vy, {
      team: 'player',
      radius: 3,
      damage: 5,
      impulse: 120,
      lifetime: 2.2,
    }),
  );
  game.playerFireTimer = 0.18;
}

function stepEnemies(game, dt) {
  for (const enemy of game.enemies) stepEnemy(game, enemy, dt);
}

function stepEnemy(game, enemy, dt) {
  if (enemy.destroyed) return;
  steerEnemyBackToLaneCenter(enemy, game.road, dt);
  enemy.fireTimer -= dt;
  enemy.burstTimer -= dt;
  const target = game.vehicle;
  const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  if (enemy.fireTimer <= 0) {
    const spread = game.rng.range(-0.12, 0.12);
    const speed = 210;
    game.enemyProjectiles.push(
      createProjectile(enemy.x, enemy.y, Math.cos(angle + spread) * speed, Math.sin(angle + spread) * speed, {
        team: 'enemy',
        radius: 5,
        damage: 10,
        impulse: 350,
        lifetime: 4,
      }),
    );
    enemy.fireTimer = 0.75;
  }
  if (enemy.burstTimer <= 0) {
    for (let i = 0; i < 12; i += 1) {
      const a = (Math.PI * 2 * i) / 12 + game.rng.range(-0.04, 0.04);
      game.enemyProjectiles.push(
        createProjectile(enemy.x, enemy.y, Math.cos(a) * 160, Math.sin(a) * 160, {
          team: 'enemy',
          radius: 4,
          damage: 7,
          impulse: 210,
          lifetime: 4,
        }),
      );
    }
    enemy.burstTimer = 6.8;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.pow(0.78, dt);
  enemy.vy *= Math.pow(0.78, dt);
}

function handleCollisions(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0) continue;
    const vehicleHitRange = CELL_SIZE * 3.8 + projectile.radius;
    if (distanceSquared(projectile, game.vehicle) < vehicleHitRange * vehicleHitRange) {
      const hit = hitVehicleWithProjectile(game.vehicle, projectile);
      if (hit.hit) projectile.lifetime = 0;
    }
  }

  for (const projectile of game.playerProjectiles) {
    if (projectile.lifetime <= 0) continue;
    if (projectile.behavior === 'beam') {
      hitEnemiesWithBeam(game, projectile);
      continue;
    }
    for (const enemy of activeEnemies(game)) {
      if (distanceSquared(projectile, enemy) >= (enemy.radius + projectile.radius) ** 2) continue;
      const hit = applyEnemyDamage(enemy, projectile);
      if (hit.hit) {
        game.score.damageDone += Math.round(projectile.damage + hit.removed * 3);
        projectile.lifetime = 0;
        enemy.vx += projectile.vx * 0.004;
        enemy.vy += projectile.vy * 0.004;
        break;
      }
    }
  }
}

function hitEnemiesWithBeam(game, projectile) {
  projectile.hitApplied ??= false;
  const trace = traceEnemyVoxelRay(activeEnemies(game), projectile, projectile.angle, projectile.length);
  projectile.renderEndX = trace.x;
  projectile.renderEndY = trace.y;
  if (!trace.enemy || projectile.hitApplied) return;
  projectile.hitApplied = true;
  const hit = applyEnemyDamage(trace.enemy, { ...projectile, x: trace.x, y: trace.y });
  if (hit.hit) {
    game.score.damageDone += Math.round(projectile.damage + hit.removed * 3);
    trace.enemy.vx += Math.cos(projectile.angle) * projectile.impulse * 0.01;
    trace.enemy.vy += Math.sin(projectile.angle) * projectile.impulse * 0.01;
  }
}

function steerEnemyBackToLaneCenter(enemy, road, dt) {
  const offset = worldToRoadOffset(enemy, road);
  const centerHalfWidth = road.halfWidth * 0.48;
  const centerHalfHeight = road.halfHeight * 0.44;
  if (Math.abs(offset.x) <= centerHalfWidth && Math.abs(offset.y) <= centerHalfHeight) return;
  const target = {
    x: Math.max(-centerHalfWidth, Math.min(centerHalfWidth, offset.x)),
    y: Math.max(-centerHalfHeight, Math.min(centerHalfHeight, offset.y)),
  };
  const dx = target.x - offset.x;
  const dy = target.y - offset.y;
  const length = Math.hypot(dx, dy) || 1;
  const accel = roadOffsetToWorld({ x: dx / length, y: dy / length }, { ...road, x: 0, y: 0 });
  enemy.vx += accel.x * 90 * dt;
  enemy.vy += accel.y * 90 * dt;
}

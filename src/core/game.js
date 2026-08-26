import { createStartingVehicle, gunMuzzleWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle } from './physics.js';
import { createProjectile, stepProjectiles } from './projectile.js';
import { hitVehicleWithProjectile } from './damage.js';
import { distanceSquared } from './math.js';
import { Rng } from './rng.js';
import { containVehicleInRoadFrame, createRoadCamera, createRoadFrame, stepRoadCamera, stepRoadFrame } from './camera.js';
import { CELL_SIZE } from './voxelMask.js';
import { stepTurretAim } from './turret.js';
import { createBoostState, stepBoost } from './boost.js';
import { applyEnemyDamage, createEnemy } from './enemy.js';
import { createSecondaryState, stepSecondaryWeapon } from './secondaryWeapon.js';

export function createGame(seed = 1147) {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  return {
    rng: new Rng(seed),
    vehicle,
    road,
    camera: createRoadCamera(road),
    enemy: createEnemy(road.x + 250, road.y - 210),
    boost: createBoostState(),
    secondary: createSecondaryState(),
    playerProjectiles: [],
    enemyProjectiles: [],
    autofire: true,
    playerFireTimer: 0,
    levelComplete: false,
    levelTime: 0,
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
  stepTurretAim(game.vehicle, [game.enemy], input, dt);
  stepEnemy(game, dt);
  stepPlayerGun(game, dt);
  stepSecondaryWeapon(game, input, dt);

  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleCollisions(game);
  containVehicleInRoadFrame(game.vehicle, game.road);
  recalculateVehicle(game.vehicle);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  game.gameOver = !game.vehicle.alive;
  if (game.enemy.destroyed) {
    game.levelComplete = true;
    game.levelTime = game.time;
  }
  return game;
}

function carryRoadObjects(game, delta) {
  const objects = [game.vehicle, game.enemy, ...game.playerProjectiles, ...game.enemyProjectiles, ...game.vehicle.detachedPieces];
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

function stepEnemy(game, dt) {
  const enemy = game.enemy;
  if (enemy.destroyed) return;
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
    if (distanceSquared(projectile, game.enemy) < (game.enemy.radius + projectile.radius) ** 2) {
      const hit = applyEnemyDamage(game.enemy, projectile);
      if (hit.hit) {
        game.score.damageDone = Math.round(game.enemy.damageTaken);
        projectile.lifetime = 0;
        game.enemy.vx += projectile.vx * 0.004;
        game.enemy.vy += projectile.vy * 0.004;
      }
    }
  }
  game.enemy.x += game.enemy.vx * 0.016;
  game.enemy.y += game.enemy.vy * 0.016;
  game.enemy.vx *= 0.96;
  game.enemy.vy *= 0.96;
}

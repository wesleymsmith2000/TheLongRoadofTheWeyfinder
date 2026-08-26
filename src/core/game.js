import { createStartingVehicle, gunMuzzleWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle } from './physics.js';
import { createProjectile, stepProjectiles } from './projectile.js';
import { hitVehicleWithProjectile } from './damage.js';
import { distanceSquared } from './math.js';
import { Rng } from './rng.js';
import { createRoadCamera, createRoadFrame, stepRoadCamera, stepRoadFrame } from './camera.js';

export function createGame(seed = 1147) {
  const vehicle = createStartingVehicle();
  const road = createRoadFrame(vehicle);
  return {
    rng: new Rng(seed),
    vehicle,
    road,
    camera: createRoadCamera(road),
    enemy: { x: road.x + 250, y: road.y - 210, vx: 0, vy: 0, radius: 22, fireTimer: 0.4, burstTimer: 5.5 },
    playerProjectiles: [],
    enemyProjectiles: [],
    autofire: true,
    playerFireTimer: 0,
    time: 0,
    fps: 60,
    gameOver: false,
  };
}

export function stepGame(game, input, dt) {
  dt = Math.min(dt, 0.033);
  game.time += dt;
  if (input.resetPressed) return createGame(1147);
  if (input.fireTogglePressed) game.autofire = !game.autofire;

  const roadDelta = stepRoadFrame(game.road, dt);
  carryRoadObjects(game, roadDelta);
  stepVehicle(game.vehicle, input, dt);
  stepEnemy(game, dt);
  stepPlayerGun(game, dt);

  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleCollisions(game);
  recalculateVehicle(game.vehicle);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  game.gameOver = !game.vehicle.alive;
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
  if (!game.autofire || game.playerFireTimer > 0 || game.gameOver || !hasFunctionalGun(game.vehicle)) return;
  const muzzle = gunMuzzleWorld(game.vehicle);
  if (!muzzle) return;
  const speed = 430;
  const angle = game.vehicle.heading - Math.PI / 2;
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
    if (distanceSquared(projectile, game.vehicle) < 150 * 150) {
      const hit = hitVehicleWithProjectile(game.vehicle, projectile);
      if (hit.hit) projectile.lifetime = 0;
    }
  }

  for (const projectile of game.playerProjectiles) {
    if (projectile.lifetime <= 0) continue;
    if (distanceSquared(projectile, game.enemy) < (game.enemy.radius + projectile.radius) ** 2) {
      projectile.lifetime = 0;
      game.enemy.x += projectile.vx * 0.01;
      game.enemy.y += projectile.vy * 0.01;
    }
  }
}

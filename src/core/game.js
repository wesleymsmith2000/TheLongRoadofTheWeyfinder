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
import { applyEnemyBlastDamage, applyEnemyDamage, createEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from './enemy.js';
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
    scrap: 0,
    scrapPickups: [],
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
    game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
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
  syncBeamProjectiles(game);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleCollisions(game);
  stepScrapPickups(game, dt);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  game.gameOver = !game.vehicle.alive;
  if (activeEnemies(game).length === 0 && game.scrapPickups.length === 0) {
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
  game.scrapPickups = [];
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

function decayNonBlockingEffects(projectiles, dt) {
  for (const projectile of projectiles) {
    if (projectile.behavior === 'blast' || projectile.behavior === 'beam') projectile.lifetime -= dt;
  }
  return projectiles.filter((projectile) => projectile.lifetime > 0 || (projectile.behavior !== 'blast' && projectile.behavior !== 'beam'));
}

function carryRoadObjects(game, delta) {
  const objects = [
    game.vehicle,
    ...game.enemies,
    ...game.scrapPickups,
    ...game.playerProjectiles,
    ...game.enemyProjectiles,
    ...game.vehicle.detachedPieces,
  ];
  for (const object of objects) {
    object.x += delta.dx;
    object.y += delta.dy;
  }
}

function stepScrapPickups(game, dt) {
  const collectRange = CELL_SIZE * 2.1;
  const kept = [];
  for (const pickup of game.scrapPickups) {
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.pow(0.18, dt);
    pickup.vy *= Math.pow(0.18, dt);
    pickup.life -= dt;
    if (distanceSquared(pickup, game.vehicle) <= (collectRange + pickup.radius) ** 2) {
      game.scrap += pickup.value;
      continue;
    }
    if (pickup.life > 0) kept.push(pickup);
  }
  game.scrapPickups = kept;
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
      damage: 10,
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
    if (projectile.behavior === 'blast') continue;
    for (const enemy of activeEnemies(game)) {
      if (distanceSquared(projectile, enemy) >= (enemy.radius + projectile.radius) ** 2) continue;
      const hit = applyEnemyDamage(enemy, projectile);
      if (hit.hit) {
        game.score.damageDone += Math.round(projectile.damage + hit.removed * 3);
        projectile.lifetime = 0;
        enemy.vx += projectile.vx * 0.004;
        enemy.vy += projectile.vy * 0.004;
        if (hit.destroyedNow) explodeEnemy(game, enemy);
        if (projectile.weapon === 'cannon') spawnCannonImpact(game, projectile, enemy);
        break;
      }
    }
  }
}

function hitEnemiesWithBeam(game, projectile) {
  const trace = traceEnemyVoxelRay(activeEnemies(game), projectile, projectile.angle, projectile.length);
  projectile.renderEndX = trace.x;
  projectile.renderEndY = trace.y;
  if (!trace.enemy) return;
  const scale = beamDamageScale(projectile);
  const hit = applyEnemyDamage(trace.enemy, {
    ...projectile,
    x: trace.x,
    y: trace.y,
    damage: projectile.damage * scale,
    radius: projectile.radius + (CELL_SIZE / 6) * Math.max(0, scale - 1),
  });
  if (hit.hit) {
    game.score.damageDone += Math.round(projectile.damage * scale + hit.removed * 3);
    trace.enemy.vx += Math.cos(projectile.angle) * projectile.impulse * 0.004 * scale;
    trace.enemy.vy += Math.sin(projectile.angle) * projectile.impulse * 0.004 * scale;
    if (hit.destroyedNow) explodeEnemy(game, trace.enemy);
  }
}

function syncBeamProjectiles(game) {
  const muzzle = gunMuzzleWorld(game.vehicle);
  for (const projectile of game.playerProjectiles) {
    if (projectile.behavior !== 'beam') continue;
    if (!muzzle) {
      projectile.lifetime = 0;
      continue;
    }
    projectile.x = muzzle.x;
    projectile.y = muzzle.y;
    projectile.angle = game.vehicle.turretHeading;
  }
}

function beamDamageScale(projectile) {
  const frames = projectile.frames || 9;
  const age = 1 - Math.max(0, projectile.lifetime / projectile.maxLifetime);
  const frame = Math.max(0, Math.min(frames - 1, Math.floor(age * frames)));
  const centerDistance = Math.abs(frame - (frames - 1) / 2);
  if (centerDistance <= 1) return 3;
  return 1 + (1 - centerDistance / ((frames - 1) / 2)) * 2;
}

function spawnCannonImpact(game, projectile, enemy) {
  game.playerProjectiles.push(
    createProjectile(projectile.x, projectile.y, 0, 0, {
      team: 'player',
      weapon: 'cannon-blast',
      behavior: 'blast',
      radius: 1,
      maxRadius: CELL_SIZE * 3.4,
      damage: 0,
      impulse: 0,
      lifetime: 0.22,
    }),
  );

  const blastRadius = CELL_SIZE * 3.34;
  for (const blastTarget of activeEnemies(game)) {
    const distance = Math.hypot(blastTarget.x - projectile.x, blastTarget.y - projectile.y);
    if (distance > blastRadius + blastTarget.radius) continue;
    const hit = applyEnemyBlastDamage(blastTarget, projectile, {
      maxVoxelDistance: 20,
      closeVoxelDistance: 5,
      closePenetration: 3,
      farPenetration: 1,
      damage: projectile.damage * 0.56,
    });
    if (hit.hit) {
      game.score.damageDone += Math.round(projectile.damage * 0.22 + hit.removed * 3);
      if (hit.destroyedNow) explodeEnemy(game, blastTarget);
    }
    knockEnemyFromPoint(blastTarget, projectile, CELL_SIZE * 4.6, 220);
  }

  const fragmentCount = 28;
  const baseAngle = projectile.angle;
  for (let index = 0; index < fragmentCount; index += 1) {
    const fan = ((index / (fragmentCount - 1)) - 0.5) * Math.PI * 1.35;
    const angle = baseAngle + fan + game.rng.range(-0.08, 0.08);
    const speed = game.rng.range(170, 310);
    game.playerProjectiles.push(
      createProjectile(projectile.x, projectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        team: 'player',
        weapon: 'cannon-shrapnel',
        radius: game.rng.range(1.4, 2.2),
        damage: projectile.damage * game.rng.range(0.1, 0.18),
        impulse: projectile.impulse * 0.08,
        lifetime: game.rng.range(0.22, 0.42),
      }),
    );
  }
}

function explodeEnemy(game, enemy) {
  enemy.explosionStart = game.time;
  game.scrapPickups.push(...harvestEnemyScrap(enemy, game.rng));
  game.playerProjectiles.push(
    createProjectile(enemy.x, enemy.y, 0, 0, {
      team: 'player',
      weapon: 'enemy-explosion',
      behavior: 'blast',
      radius: 1,
      maxRadius: CELL_SIZE * 5.2,
      damage: 0,
      impulse: 0,
      lifetime: 0.32,
    }),
  );

  const radius = CELL_SIZE * 7.5;
  const impulse = 390;
  for (const other of game.enemies) {
    if (other === enemy || other.destroyed) continue;
    knockEnemyFromPoint(other, enemy, radius, impulse);
  }
}

function knockEnemyFromPoint(enemy, point, radius, impulse) {
  const dx = enemy.x - point.x;
  const dy = enemy.y - point.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0 || distance > radius) return;
  const falloff = 1 - distance / radius;
  enemy.vx += (dx / distance) * impulse * falloff;
  enemy.vy += (dy / distance) * impulse * falloff;
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

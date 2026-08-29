import { applyVehicleDamage, createStartingVehicle, gunMuzzleWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle } from './physics.js';
import { createProjectile, stepProjectiles } from './projectile.js';
import { hitVehicleWithProjectile } from './damage.js';
import { clamp, distanceSquared } from './math.js';
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
import { PRIMARY_PROJECTILE_SPEED, stepTurretAim } from './turret.js';
import { createBoostState, stepBoost } from './boost.js';
import { applyEnemyBlastDamage, applyEnemyDamage, createEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from './enemy.js';
import { firePattern } from './patternDefinition.js';
import { createSecondaryState, stepSecondaryWeapon } from './secondaryWeapon.js';
import {
  SHOP_COSTS,
  buyUpgradeWithScrap,
  createUpgradeState,
  refillAmmoWithScrap,
  repairVehicleWithScrap,
  replaceDetachedWithScrap,
  upgradeMultiplier,
  upgradeReduction,
} from './economy.js';

export function createGame(seed = 1147, options = {}) {
  const vehicle = createStartingVehicle(options.vehicleDefinition);
  const road = createRoadFrame(vehicle);
  return {
    rng: new Rng(seed),
    vehicleDefinition: options.vehicleDefinition,
    vehicle,
    road,
    camera: createRoadCamera(road),
    enemies: createLevelEnemies(road, 1),
    boost: createBoostState(),
    secondary: createSecondaryState(),
    upgrades: createUpgradeState(),
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
    aiAimReticle: null,
    aimReticle: null,
    time: 0,
    fps: 60,
    gameOver: false,
  };
}

export function stepGame(game, input, dt) {
  dt = Math.min(dt, 0.033);
  game.time += dt;
  if (input.resetPressed) return createGame(1147, { vehicleDefinition: game.vehicleDefinition });
  if (input.nextLevelPressed && game.levelComplete) return startNextLevel(game);
  if (game.levelComplete || game.gameOver) {
    stepShop(game, input);
    game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
    stepRoadCamera(game.camera, game.road, game.vehicle, dt);
    return game;
  }
  if (input.fireTogglePressed) game.autofire = !game.autofire;
  game.inputFireHeld = Boolean(input.fireHeld);

  const roadDelta = stepRoadFrame(game.road, dt);
  carryRoadObjects(game, roadDelta);
  stepVehicle(game.vehicle, input, dt, game.road.heading);
  configureBoostFromUpgrades(game);
  stepBoost(game.vehicle, game.boost, input, game.road.heading, dt);
  const turretInput = aimInputForTurret(game, input, dt);
  stepTurretAim(game.vehicle, activeEnemies(game), turretInput, dt);
  stepEnemies(game, dt);
  stepPlayerGun(game, dt);
  handleBoostRams(game);
  handleBoostShieldRepel(game, dt);
  stepSecondaryWeapon(game, input, dt);

  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt, activeEnemies(game));
  syncBeamProjectiles(game);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleCollisions(game);
  stepScrapPickups(game, dt);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  syncBeamProjectiles(game);
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
  const collectRange = CELL_SIZE * 2.1 * upgradeMultiplier(game, 'scrapCaptureRadius');
  const magnetRange = (CELL_SIZE / 6) * SHOP_COSTS.scrapMagnetVoxels * upgradeMultiplier(game, 'scrapMagnetDistance');
  const magnetStrength = upgradeMultiplier(game, 'scrapMagnetStrength');
  const kept = [];
  for (const pickup of game.scrapPickups) {
    const dx = game.vehicle.x - pickup.x;
    const dy = game.vehicle.y - pickup.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance <= magnetRange) {
      const pull = 1 - distance / magnetRange;
      pickup.vx += (dx / distance) * (130 + pull * 260) * magnetStrength * dt;
      pickup.vy += (dy / distance) * (130 + pull * 260) * magnetStrength * dt;
    }
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

function stepShop(game, input) {
  if (!game.levelComplete) return;
  if (input.shopRepairPressed) repairVehicleWithScrap(game, input.shopRepairTarget);
  if (input.shopReplacePressed) replaceDetachedWithScrap(game);
  if (input.shopRefillAmmoPressed) refillAmmoWithScrap(game, input.shopAmmoWeapon ?? game.secondary.selected);
  if (input.shopBuyUpgradePressed) buyUpgradeWithScrap(game, input.shopUpgradeId);
}

function aimInputForTurret(game, input, dt) {
  if (input.aimWorld) {
    game.aimReticle = { ...input.aimWorld, active: true, source: input.aimSource ?? 'manual' };
    if ((input.secondarySelect ?? game.secondary.selected) === 'beam') return { ...input, compensatedAim: false };
    return input;
  }
  if (input.gunnerEnabled === false || (game.vehicle.manualAimGrace ?? 0) > 0 || activeEnemies(game).length === 0) {
    game.aimReticle = null;
    return input;
  }

  const target = gunnerAimTarget(game);
  if (!target) return input;
  game.aiAimReticle = moveToward(game.aiAimReticle ?? { x: game.vehicle.x, y: game.vehicle.y }, target, 260 * dt);
  game.aimReticle = { ...game.aiAimReticle, active: true, source: 'ai' };
  return { ...input, aimWorld: game.aiAimReticle, manualAimActive: false };
}

function gunnerAimTarget(game) {
  const target = activeEnemies(game).reduce((nearest, enemy) => {
    if (!nearest) return enemy;
    return distanceSquared(game.vehicle, enemy) < distanceSquared(game.vehicle, nearest) ? enemy : nearest;
  }, null);
  if (!target) return null;
  const distance = Math.hypot(target.x - game.vehicle.x, target.y - game.vehicle.y);
  const leadTime = Math.min(0.75, distance / PRIMARY_PROJECTILE_SPEED);
  return { x: target.x + (target.vx ?? 0) * leadTime, y: target.y + (target.vy ?? 0) * leadTime };
}

function moveToward(from, to, maxDistance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance || distance <= 0.001) return { ...to };
  return { x: from.x + (dx / distance) * maxDistance, y: from.y + (dy / distance) * maxDistance };
}

function configureBoostFromUpgrades(game) {
  game.boost.maxFuel = 100 * upgradeMultiplier(game, 'boostCapacity');
  game.boost.cost = 51 * upgradeReduction(game, 'boostEfficiency');
  game.boost.rechargeRate = 16 * upgradeMultiplier(game, 'boostRecharge');
  game.boost.acceleration = 70 * upgradeMultiplier(game, 'boostAcceleration');
  game.boost.maxDuration = (5 / 60) * upgradeMultiplier(game, 'boostDuration');
  game.boost.cooldownDuration = (20 / 60) * upgradeReduction(game, 'boostCooldown');
}

function stepPlayerGun(game, dt) {
  game.playerFireTimer -= dt;
  if ((!game.autofire && !game.inputFireHeld) || game.playerFireTimer > 0 || game.gameOver || !hasFunctionalGun(game.vehicle)) return;
  const muzzle = gunMuzzleWorld(game.vehicle);
  if (!muzzle) return;
  const spread = (Math.PI / 18) * upgradeReduction(game, 'gunAccuracy');
  const angle = game.vehicle.turretHeading + game.rng.range(-spread, spread);
  const damage = 8 * upgradeMultiplier(game, 'gunDamage');
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, Math.cos(angle) * PRIMARY_PROJECTILE_SPEED + game.vehicle.vx, Math.sin(angle) * PRIMARY_PROJECTILE_SPEED + game.vehicle.vy, {
      team: 'player',
      radius: 3,
      damage,
      impulse: 60,
      lifetime: 2.2,
    }),
  );
  game.playerFireTimer = playerGunFireInterval(game);
}

function playerGunFireInterval(game) {
  return 0.22 / upgradeMultiplier(game, 'gunFireRate');
}

function stepEnemies(game, dt) {
  for (const enemy of game.enemies) stepEnemy(game, enemy, dt);
}

function stepEnemy(game, enemy, dt) {
  if (enemy.destroyed) return;
  steerEnemyBackToLaneCenter(enemy, game.road, dt);
  stepEnemyPatterns(game, enemy, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.pow(0.78, dt);
  enemy.vy *= Math.pow(0.78, dt);
}

function stepEnemyPatterns(game, enemy, dt) {
  for (const patternState of enemy.patterns ?? []) {
    patternState.timer -= dt;
    if (patternState.timer > 0) continue;
    game.enemyProjectiles.push(...firePattern(patternState.definition, enemy, game.vehicle, game.rng));
    patternState.timer = patternState.definition.interval;
  }
}

function handleBoostRams(game) {
  if (game.boost.activeTime <= 0) return;
  for (const enemy of activeEnemies(game)) {
    const range = enemy.radius + CELL_SIZE * 1.6;
    if (distanceSquared(enemy, game.vehicle) > range * range) continue;
    if (enemy.lastRammedAt != null && game.time - enemy.lastRammedAt < 0.24) continue;
    enemy.lastRammedAt = game.time;

    const direction = directionFromTo(game.vehicle, enemy);
    const damage = 18 * upgradeMultiplier(game, 'boostRamDamage');
    const hit = applyEnemyDamage(enemy, {
      x: enemy.x,
      y: enemy.y,
      radius: 8,
      damage,
      vx: direction.x * 250,
      vy: direction.y * 250,
    });
    if (hit.hit) game.score.damageDone += Math.round(damage + hit.removed * 3);
    if (hit.destroyedNow) explodeEnemy(game, enemy);
    enemy.vx += direction.x * 110 * upgradeMultiplier(game, 'boostRamDamage');
    enemy.vy += direction.y * 110 * upgradeMultiplier(game, 'boostRamDamage');

    const recoilDamage = damage * 0.25 * upgradeReduction(game, 'boostRecoilDamage');
    const recoilImpulse = 110 * upgradeReduction(game, 'boostRecoilKnockback');
    applyVehicleDamage(game.vehicle, game.vehicle, CELL_SIZE * 0.5, recoilDamage, recoilImpulse, {
      x: -direction.x,
      y: -direction.y,
    });
  }
}

function handleBoostShieldRepel(game, dt) {
  if (game.boost.activeTime <= 0) return;
  const radius = boostShieldRadius(game);
  const enemyImpulse = 180 * upgradeMultiplier(game, 'boostShielding');
  const projectileImpulse = 360 * upgradeMultiplier(game, 'boostShielding');
  for (const enemy of activeEnemies(game)) knockEnemyFromPoint(enemy, game.vehicle, radius + enemy.radius, enemyImpulse * dt);
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0) continue;
    const dx = projectile.x - game.vehicle.x;
    const dy = projectile.y - game.vehicle.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001 || distance > radius + projectile.radius) continue;
    const nx = dx / distance;
    const ny = dy / distance;
    const speed = Math.hypot(projectile.vx, projectile.vy);
    projectile.vx = nx * Math.max(speed, projectileImpulse);
    projectile.vy = ny * Math.max(speed, projectileImpulse);
    projectile.x = game.vehicle.x + nx * (radius + projectile.radius + 0.5);
    projectile.y = game.vehicle.y + ny * (radius + projectile.radius + 0.5);
    projectile.lifetime *= 0.72;
  }
}

function boostShieldRadius(game) {
  return CELL_SIZE * 3.8 * upgradeMultiplier(game, 'boostShielding');
}

function handleCollisions(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0) continue;
    const vehicleHitRange = CELL_SIZE * 3.8 + projectile.radius;
    if (distanceSquared(projectile, game.vehicle) < vehicleHitRange * vehicleHitRange) {
      const hit = hitVehicleWithProjectile(game.vehicle, shieldedProjectile(game, projectile));
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
        if (projectile.weapon === 'rocket') spawnRocketImpact(game, projectile, enemy);
        break;
      }
    }
  }
}

function shieldedProjectile(game, projectile) {
  if (game.boost.activeTime <= 0) return projectile;
  const shield = clamp(0.25 * upgradeMultiplier(game, 'boostShielding'), 0, 0.8);
  return { ...projectile, damage: projectile.damage * (1 - shield), impulse: projectile.impulse * (1 - shield) };
}

function hitEnemiesWithBeam(game, projectile) {
  const trace = traceEnemyVoxelRay(activeEnemies(game), projectile, projectile.angle, projectile.length, projectile.pierce ?? 0);
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
      maxRadius: projectile.blastRadius || CELL_SIZE * 2.55,
      damage: 0,
      impulse: 0,
      lifetime: 0.22,
    }),
  );

  const blastRadius = projectile.blastRadius || CELL_SIZE * 2.55;
  for (const blastTarget of activeEnemies(game)) {
    const distance = Math.hypot(blastTarget.x - projectile.x, blastTarget.y - projectile.y);
    if (distance > blastRadius + blastTarget.radius) continue;
    const hit = applyEnemyBlastDamage(blastTarget, projectile, {
      maxVoxelDistance: 20,
      closeVoxelDistance: 5,
      closePenetration: 3,
      farPenetration: 1,
      damage: projectile.blastDamage || projectile.damage * 0.28,
    });
    if (hit.hit) {
      game.score.damageDone += Math.round((projectile.blastDamage || projectile.damage * 0.28) * 0.22 + hit.removed * 3);
      if (hit.destroyedNow) explodeEnemy(game, blastTarget);
    }
    knockEnemyFromPoint(blastTarget, projectile, CELL_SIZE * 4.6, projectile.blastKnockback || 55);
  }

  const fragmentCount = projectile.shrapnelCount || 28;
  const baseAngle = projectile.angle;
  for (let index = 0; index < fragmentCount; index += 1) {
    const fan = ((index / (fragmentCount - 1)) - 0.5) * Math.PI * 1.35;
    const angle = baseAngle + fan + game.rng.range(-0.08, 0.08);
    const speed = game.rng.range(85, 155);
    game.playerProjectiles.push(
      createProjectile(projectile.x, projectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        team: 'player',
        weapon: 'cannon-shrapnel',
        radius: game.rng.range(1.4, 2.2),
        damage: projectile.damage * (projectile.shrapnelDamageScale ?? 1) * game.rng.range(0.1, 0.18),
        impulse: projectile.impulse * 0.08,
        lifetime: game.rng.range(0.22, 0.42),
      }),
    );
  }
}

function spawnRocketImpact(game, projectile, enemy) {
  if ((projectile.blastRadius ?? 0) <= 0) return;
  game.playerProjectiles.push(
    createProjectile(projectile.x, projectile.y, 0, 0, {
      team: 'player',
      weapon: 'rocket-blast',
      behavior: 'blast',
      radius: 1,
      maxRadius: projectile.blastRadius,
      damage: 0,
      impulse: 0,
      lifetime: 0.18,
    }),
  );

  for (const blastTarget of activeEnemies(game)) {
    const distance = Math.hypot(blastTarget.x - projectile.x, blastTarget.y - projectile.y);
    if (distance > projectile.blastRadius + blastTarget.radius) continue;
    const hit = applyEnemyBlastDamage(blastTarget, projectile, {
      maxVoxelDistance: Math.max(1, projectile.blastRadius / (CELL_SIZE / 6)),
      closeVoxelDistance: 3,
      closePenetration: 2,
      farPenetration: 1,
      damage: projectile.blastDamage,
    });
    if (hit.hit) {
      game.score.damageDone += Math.round(projectile.blastDamage * 0.22 + hit.removed * 3);
      if (hit.destroyedNow) explodeEnemy(game, blastTarget);
    }
    knockEnemyFromPoint(blastTarget, projectile, projectile.blastRadius + CELL_SIZE, projectile.blastKnockback);
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
  const impulse = 195;
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

function directionFromTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return { x: 0, y: -1 };
  return { x: dx / distance, y: dy / distance };
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
  enemy.vx += accel.x * 45 * dt;
  enemy.vy += accel.y * 45 * dt;
}

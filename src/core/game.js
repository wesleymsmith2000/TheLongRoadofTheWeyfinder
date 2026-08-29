import { applyVehicleDamage, createStartingVehicle, gunMuzzleWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle } from './physics.js';
import { applyRocketHullDamage, createProjectile, stepProjectiles } from './projectile.js';
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
import { applyEnemyBlastDamage, applyEnemyDamage, createBossEnemy, createEnemy, createEnhancedEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from './enemy.js';
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
import { DEFAULT_LEVEL_MUSIC, hasBossMusicBeforeLevel, isBossMusic, musicForLevel } from './levelMusic.js';

const LEVEL_TARGET_DURATION = 180;
const SPAWN_WARNING_LEAD = 2.4;

export function createGame(seed = 1147, options = {}) {
  const vehicle = createStartingVehicle(options.vehicleDefinition);
  const road = createRoadFrame(vehicle);
  const levelMusic = options.levelMusic ?? DEFAULT_LEVEL_MUSIC;
  const rng = new Rng(seed);
  const enemySpawnQueue = createLevelEnemySchedule(road, 1, levelMusic, rng);
  const initialSpawns = dequeueReadySpawns(enemySpawnQueue, 0);
  return {
    rng,
    levelMusic,
    currentMusic: musicForLevel(1, levelMusic),
    vehicleDefinition: options.vehicleDefinition,
    vehicle,
    road,
    camera: createRoadCamera(road),
    enemies: initialSpawns,
    enemySpawnQueue,
    incomingMarkers: [],
    boost: createBoostState(),
    secondary: createSecondaryState(),
    upgrades: createUpgradeState(),
    scrap: 0,
    scrapPickups: [],
    playerProjectiles: [],
    enemyProjectiles: [],
    smokeParticles: [],
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
  if (input.resetPressed) return createGame(1147, { vehicleDefinition: game.vehicleDefinition, levelMusic: game.levelMusic });
  if (input.nextLevelPressed && game.levelComplete) return startNextLevel(game);
  if (game.levelComplete || game.gameOver) {
    stepShop(game, input);
    game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
    stepSmokeParticles(game, dt);
    stepRoadCamera(game.camera, game.road, game.vehicle, dt);
    return game;
  }
  if (input.fireTogglePressed) game.autofire = !game.autofire;
  game.inputFireHeld = Boolean(input.fireHeld);

  const roadDelta = stepRoadFrame(game.road, dt);
  carryRoadObjects(game, roadDelta);
  stepEnemySpawner(game, dt);
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
  handleEnemyRamShields(game);

  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt, activeEnemies(game));
  syncBeamProjectiles(game);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  handleEnemyProjectileSpecials(game);
  stepSmokeParticles(game, dt);
  stepRocketContrails(game, dt);
  handleCollisions(game);
  stepScrapPickups(game, dt);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  syncBeamProjectiles(game);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  game.gameOver = !game.vehicle.alive;
  if (activeEnemies(game).length === 0 && game.enemySpawnQueue.length === 0 && game.scrapPickups.length === 0) {
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
  game.currentMusic = musicForLevel(game.level, game.levelMusic);
  game.enemySpawnQueue = createLevelEnemySchedule(game.road, game.level, game.levelMusic, game.rng);
  game.enemies = dequeueReadySpawns(game.enemySpawnQueue, 0);
  game.incomingMarkers = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.smokeParticles = [];
  game.scrapPickups = [];
  return game;
}

export function createLevelEnemySchedule(road, level, levelMusic = DEFAULT_LEVEL_MUSIC, rng = new Rng(level * 9973)) {
  const entries = createLevelEnemies(road, level, levelMusic);
  const duration = LEVEL_TARGET_DURATION;
  const meanInterval = duration / Math.max(1, entries.length + 1);
  let at = 0;
  return entries
    .map((enemy, index) => {
      if (index > 0) at += exponentialInterval(rng, meanInterval);
      at = Math.min(duration - 6, Math.max(index * 0.45, at));
      return { at, enemy, markerShown: false, type: enemy.kind ?? 'standard' };
    })
    .sort((a, b) => a.at - b.at);
}

function dequeueReadySpawns(queue, elapsed) {
  const ready = [];
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (queue[index].at > elapsed) continue;
    ready.unshift(queue[index].enemy);
    queue.splice(index, 1);
  }
  return ready;
}

export function createLevelEnemies(road, level, levelMusic = DEFAULT_LEVEL_MUSIC) {
  const enemies = [];
  const isBoss = isBossLevel(level, levelMusic);
  const count = isBoss ? Math.max(1, Math.ceil(level / 2)) : level;
  const enhancedCount = !isBoss && hasBossMusicBeforeLevel(level, levelMusic) ? Math.floor(count / 2) : 0;
  const standardCount = count - enhancedCount;
  for (let i = 0; i < count; i += 1) {
    const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 90;
    const row = Math.floor(i / 4) * 70;
    const kind = i < standardCount ? 'standard' : 'enhanced';
    const world =
      kind === 'enhanced'
        ? roadOffsetToWorld({ x: spread, y: road.halfHeight + 95 + row }, road)
        : roadOffsetToWorld({ x: spread, y: -road.halfHeight - 95 - row }, road);
    const enemy = kind === 'enhanced' ? createEnhancedEnemy(world.x, world.y) : createEnemy(world.x, world.y);
    if (kind === 'enhanced') {
      const velocity = roadDirectionToWorld(0, -1, road);
      enemy.vx = velocity.x * 310;
      enemy.vy = velocity.y * 310;
      enemy.charge = { state: 'charging', timer: 1.15, x: velocity.x, y: velocity.y };
      enemy.shieldActive = true;
    } else {
      const velocity = roadDirectionToWorld(0, 1, road);
      enemy.vx = velocity.x * 35;
      enemy.vy = velocity.y * 35;
    }
    enemies.push(enemy);
  }
  if (isBoss) {
    const bossWorld = roadOffsetToWorld({ x: 0, y: -road.halfHeight - 180 }, road);
    enemies.push(createBossEnemy(bossWorld.x, bossWorld.y));
  }
  return enemies;
}

export function isBossLevel(level, levelMusic = DEFAULT_LEVEL_MUSIC) {
  return isBossMusic(musicForLevel(level, levelMusic));
}

function activeEnemies(game) {
  return game.enemies.filter((enemy) => !enemy.destroyed);
}

function stepEnemySpawner(game, dt) {
  const elapsed = game.time - game.levelStartTime;
  for (const entry of game.enemySpawnQueue) {
    if (!entry.markerShown && entry.at - elapsed <= SPAWN_WARNING_LEAD) {
      entry.markerShown = true;
      game.incomingMarkers.push(createIncomingMarker(entry.enemy, entry.type));
    }
  }
  const ready = [];
  const pending = [];
  for (const entry of game.enemySpawnQueue) {
    if (entry.at <= elapsed) ready.push(entry);
    else pending.push(entry);
  }
  for (const entry of ready) game.enemies.push(entry.enemy);
  game.enemySpawnQueue = pending;
  stepIncomingMarkers(game, dt);
}

function createIncomingMarker(enemy, type) {
  return {
    x: enemy.x,
    y: enemy.y,
    type,
    age: 0,
    lifetime: SPAWN_WARNING_LEAD + 0.6,
  };
}

function stepIncomingMarkers(game, dt) {
  for (const marker of game.incomingMarkers) {
    marker.age += dt;
    marker.lifetime -= dt;
  }
  game.incomingMarkers = game.incomingMarkers.filter((marker) => marker.lifetime > 0);
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
    ...game.enemySpawnQueue.map((entry) => entry.enemy),
    ...game.scrapPickups,
    ...game.playerProjectiles,
    ...game.enemyProjectiles,
    ...game.smokeParticles,
    ...game.incomingMarkers,
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
      radius: 1.5,
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
  if (enemy.kind === 'enhanced') stepEnhancedEnemy(game, enemy, dt);
  if (enemy.kind === 'boss') stepBossEnemy(game, enemy, dt);
  stepEnemyPatterns(game, enemy, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.pow(0.78, dt);
  enemy.vy *= Math.pow(0.78, dt);
}

function stepEnhancedEnemy(game, enemy, dt) {
  const charge = enemy.charge ?? { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.charge = charge;
  charge.timer -= dt;
  enemy.shieldActive = charge.state === 'charging';
  if (charge.state === 'charging') {
    enemy.vx += charge.x * 165 * dt;
    enemy.vy += charge.y * 165 * dt;
    const offset = worldToRoadOffset(enemy, game.road);
    if (Math.abs(offset.x) > game.road.halfWidth * 0.45 || Math.abs(offset.y) > game.road.halfHeight * 0.42) charge.timer = Math.min(charge.timer, 0);
  }
  if (charge.timer > 0) return;
  if (charge.state === 'idle') {
    const direction = directionFromTo(enemy, game.vehicle);
    charge.x = direction.x;
    charge.y = direction.y;
    charge.state = 'charging';
    charge.timer = 1.15;
    enemy.shieldActive = true;
  } else {
    charge.state = 'idle';
    charge.timer = game.rng.range(4.2, 7.4);
    enemy.shieldActive = false;
  }
}

function stepBossEnemy(game, boss, dt) {
  boss.centerPulseTimer -= dt;
  stepBossArms(game, boss, dt);
  if (boss.centerPulseTimer <= 0) {
    fireBossCenterPulse(game, boss);
    boss.centerPulseTimer = 6.8;
  }
}

function stepBossArms(game, boss, dt) {
  for (const arm of boss.arms ?? []) {
    if (detonateBrokenBossArm(game, boss, arm)) continue;
    arm.phase += dt * game.rng.range(2.2, 3.8);
    arm.aim.x += (game.vehicle.x - arm.aim.x) * 0.08 * dt + Math.cos(arm.phase) * 18 * dt;
    arm.aim.y += (game.vehicle.y - arm.aim.y) * 0.08 * dt + Math.sin(arm.phase * 0.7) * 18 * dt;
    arm.fireTimer = (arm.fireTimer ?? game.rng.range(0.2, 1.5)) - dt;
    if (arm.fireTimer > 0) continue;
    arm.fireTimer = game.rng.range(4.8, 8.9);
    const liveGun = boss.cells.find((cell) => cell.id.startsWith(`arm-${arm.index}-`) && cell.type === 'gun' && !cell.state.destroyed);
    if (!liveGun) continue;
    const source = { x: boss.x + liveGun.gridX * CELL_SIZE, y: boss.y + liveGun.gridY * CELL_SIZE };
    const angle = Math.atan2(arm.aim.y - source.y, arm.aim.x - source.x);
    game.enemyProjectiles.push(
      createProjectile(source.x, source.y, Math.cos(angle) * 105, Math.sin(angle) * 105, {
        team: 'enemy',
        weapon: 'boss-tentacle',
        radius: 2.2,
        damage: 10,
        impulse: 150,
        lifetime: 4,
        angle,
      }),
    );
  }
}

function detonateBrokenBossArm(game, boss, arm) {
  if (arm.detonated) return true;
  const cells = boss.cells.filter((cell) => cell.id.startsWith(`arm-${arm.index}-`));
  if (!cells.some((cell) => cell.state.destroyed)) return false;
  arm.detonated = true;
  for (const cell of cells) {
    const origin = { x: boss.x + cell.gridX * CELL_SIZE, y: boss.y + cell.gridY * CELL_SIZE };
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    cell.state.destroyed = true;
    game.enemyProjectiles.push(
      ...spawnEnemyPulseBlast(game, {
        ...origin,
        blastOnExpire: { radius: CELL_SIZE * 1.4, damage: 6, impulse: 85 },
      }),
    );
    for (let index = 0; index < 4; index += 1) {
      const angle = game.rng.range(0, Math.PI * 2);
      game.enemyProjectiles.push(
        createProjectile(origin.x, origin.y, Math.cos(angle) * game.rng.range(75, 150), Math.sin(angle) * game.rng.range(75, 150), {
          team: 'enemy',
          weapon: 'boss-arm-shrapnel',
          radius: 1.4,
          damage: 5,
          impulse: 70,
          lifetime: game.rng.range(0.3, 0.55),
        }),
      );
    }
  }
  updateEnemyDestroyedAfterArmLoss(boss);
  return true;
}

function updateEnemyDestroyedAfterArmLoss(boss) {
  const liveCore = boss.cells.some((cell) => cell.id.startsWith('core-') && !cell.state.destroyed);
  if (!liveCore) boss.destroyed = true;
}

function fireBossCenterPulse(game, boss) {
  const count = 12;
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    game.enemyProjectiles.push(
      createProjectile(boss.x, boss.y, Math.cos(angle) * 55, Math.sin(angle) * 55, {
        team: 'enemy',
        weapon: 'boss-missile',
        radius: 3,
        damage: 9,
        impulse: 115,
        lifetime: 7,
        angle,
        delayBeforeAcceleration: 3,
        stopBeforeAcceleration: true,
        acceleration: 135,
        accelerationDuration: 10,
        accelerationTarget: { x: game.vehicle.x, y: game.vehicle.y },
        accelerationJitter: game.rng.range(-Math.PI / 18, Math.PI / 18),
        maxSpeed: 280,
        vanishOffscreen: true,
      }),
    );
  }
}

function stepEnemyPatterns(game, enemy, dt) {
  for (const patternState of enemy.patterns ?? []) {
    patternState.timer -= dt;
    if (patternState.timer > 0) continue;
    game.enemyProjectiles.push(...firePattern(patternState, enemy, game.vehicle, game.rng));
    patternState.timer = nextPatternTimer(patternState);
  }
}

function nextPatternTimer(patternState) {
  const emitter = patternState.definition.emitter;
  if (emitter.kind === 'sequentialRadial' && patternState.sequenceIndex === 0) return emitter.sequenceRest ?? patternState.definition.interval;
  return patternState.definition.interval;
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
    if (hitPlayerRocketWithProjectile(game, projectile)) {
      projectile.lifetime = 0;
      continue;
    }
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
      if (enemyShieldBlocks(enemy, projectile)) {
        projectile.lifetime = 0;
        break;
      }
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

function handleEnemyProjectileSpecials(game) {
  const kept = [];
  const spawned = [];
  for (const projectile of game.enemyProjectiles) {
    if (projectile.vanishOffscreen && isOutsideRoadArea(projectile, game.road)) {
      projectile.lifetime = 0;
      continue;
    }
    if (projectile.readyToExplode) {
      spawned.push(...spawnEnemyPulseBlast(game, projectile));
      projectile.lifetime = 0;
      continue;
    }
    kept.push(projectile);
  }
  game.enemyProjectiles = [...kept, ...spawned];
}

function spawnEnemyPulseBlast(game, projectile) {
  const blast = projectile.blastOnExpire ?? { radius: CELL_SIZE * 1.275, damage: 4.5, impulse: 55 };
  const effects = [
    createProjectile(projectile.x, projectile.y, 0, 0, {
      team: 'enemy',
      weapon: 'enemy-pulse-blast',
      behavior: 'blast',
      radius: 1,
      maxRadius: blast.radius,
      damage: 0,
      impulse: 0,
      lifetime: 0.18,
    }),
  ];
  for (const enemy of activeEnemies(game)) {
    if (distanceSquared(enemy, projectile) > (enemy.radius + blast.radius) ** 2) continue;
    const hit = applyEnemyBlastDamage(enemy, projectile, {
      maxVoxelDistance: Math.max(1, blast.radius / (CELL_SIZE / 6)),
      closeVoxelDistance: 3,
      closePenetration: 1,
      farPenetration: 1,
      damage: blast.damage,
    });
    if (hit.destroyedNow) explodeEnemy(game, enemy);
    knockEnemyFromPoint(enemy, projectile, blast.radius + enemy.radius, blast.impulse ?? 0);
  }
  if (distanceSquared(game.vehicle, projectile) <= (blast.radius + CELL_SIZE * 3.8) ** 2) {
    applyVehicleDamage(game.vehicle, projectile, blast.radius, blast.damage, blast.impulse ?? 0, directionFromTo(projectile, game.vehicle));
  }
  return effects;
}

function isOutsideRoadArea(projectile, road) {
  const offset = worldToRoadOffset(projectile, road);
  return Math.abs(offset.x) > road.halfWidth * 1.28 || Math.abs(offset.y) > road.halfHeight * 1.28;
}

function hitPlayerRocketWithProjectile(game, enemyProjectile) {
  for (const rocket of game.playerProjectiles) {
    if (rocket.weapon !== 'rocket' || rocket.lifetime <= 0 || !rocket.hull) continue;
    const hit = applyRocketHullDamage(rocket, enemyProjectile);
    if (!hit.hit) continue;
    if (hit.destroyed) {
      rocket.lifetime = 0;
      spawnRocketImpact(game, rocket);
    }
    return true;
  }
  return false;
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
  if (enemyShieldBlocks(trace.enemy, trace)) return;
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

function handleEnemyRamShields(game) {
  for (const enemy of activeEnemies(game)) {
    if (!enemy.shieldActive || !enemy.charge) continue;
    if (distanceSquared(enemy, game.vehicle) > (enemy.radius + CELL_SIZE * 3.1) ** 2) continue;
    const toVehicle = directionFromTo(enemy, game.vehicle);
    const dot = toVehicle.x * enemy.charge.x + toVehicle.y * enemy.charge.y;
    if (dot < Math.cos(Math.PI / 8)) continue;
    if (enemy.lastShieldRamAt != null && game.time - enemy.lastShieldRamAt < 0.65) continue;
    enemy.lastShieldRamAt = game.time;
    applyVehicleDamage(game.vehicle, game.vehicle, CELL_SIZE * 0.9, 16, 230, toVehicle);
  }
}

function enemyShieldBlocks(enemy, point) {
  if (!enemy.shieldActive || !enemy.charge) return false;
  const dx = point.x - enemy.x;
  const dy = point.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001 || distance > enemy.radius + CELL_SIZE * 1.6) return false;
  const dot = (dx / distance) * enemy.charge.x + (dy / distance) * enemy.charge.y;
  return dot >= Math.cos(Math.PI / 8);
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

function stepRocketContrails(game, dt) {
  const frameCount = Math.max(0, dt * 60);
  for (const projectile of game.playerProjectiles) {
    if (projectile.weapon !== 'rocket' || projectile.lifetime <= 0 || !projectile.contrail) continue;
    const meanPerSevenFrames = projectile.contrail.emissionMeanPerSevenFrames ?? 2;
    const mean = (meanPerSevenFrames / 7) * frameCount;
    const count = Math.min(projectile.contrail.maxParticlesPerStep ?? 5, samplePoisson(game.rng, mean));
    for (let index = 0; index < count; index += 1) spawnRocketSmokeParticle(game, projectile);
  }
}

function spawnRocketSmokeParticle(game, projectile) {
  const colors = projectile.contrail.colors ?? ['#8a8a86', '#1f2020', '#df6f2e'];
  const angle = projectile.angle + Math.PI + game.rng.range(-0.42, 0.42);
  const speed = game.rng.range(5, 18);
  const backOffset = projectile.radius * game.rng.range(2.2, 4.1);
  const sideOffset = game.rng.range(-projectile.radius, projectile.radius);
  const cos = Math.cos(projectile.angle);
  const sin = Math.sin(projectile.angle);
  const lifetimeFrames = game.rng.chance(0.5) ? 4 : 5;
  game.smokeParticles.push({
    x: projectile.x - cos * backOffset - sin * sideOffset,
    y: projectile.y - sin * backOffset + cos * sideOffset,
    vx: Math.cos(angle) * speed + projectile.vx * 0.05,
    vy: Math.sin(angle) * speed + projectile.vy * 0.05,
    radius: game.rng.range(0.7, 1.6),
    color: colors[Math.floor(game.rng.range(0, colors.length))] ?? colors[0],
    lifetime: lifetimeFrames / 60,
    maxLifetime: lifetimeFrames / 60,
  });
}

function stepSmokeParticles(game, dt) {
  const kept = [];
  for (const particle of game.smokeParticles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.22, dt);
    particle.vy *= Math.pow(0.22, dt);
    particle.radius += 3.4 * dt;
    particle.lifetime -= dt;
    if (particle.lifetime > 0) kept.push(particle);
  }
  game.smokeParticles = kept;
}

function samplePoisson(rng, mean) {
  if (mean <= 0) return 0;
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= rng.next();
  } while (product > limit);
  return count - 1;
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

function roadDirectionToWorld(x, y, road) {
  const cos = Math.cos(road.heading);
  const sin = Math.sin(road.heading);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function exponentialInterval(rng, mean) {
  return -Math.log(Math.max(0.0001, 1 - rng.next())) * mean;
}

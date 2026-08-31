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
import {
  applyEnemyBlastDamage,
  applyEnemyDamage,
  applyEnemyVoxelDamage,
  createBossEnemy,
  createEnemy,
  createEnhancedEnemy,
  createEnhancedPirateShipEnemy,
  createPirateShipEnemy,
  harvestEnemyScrap,
  traceEnemyVoxelBeam,
  traceEnemyVoxelRay,
} from './enemy.js';
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
import { enhancedEnemyPaletteForMusic } from './levelStyle.js';
import { emitSoundEvent, SOUND_EVENTS } from './soundEvents.js';

export const LEVEL_TARGET_DURATION = 180;
const SPAWN_WARNING_LEAD = 2.4;
const BOSS_LASER_CHARGE_TIME = 3;
const BOSS_LASER_LOCK_TIME = 1;

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
    soundEvents: [],
    autofire: true,
    playerFireTimer: 0,
    levelComplete: false,
    levelTime: 0,
    level: 1,
    levelStartTime: 0,
    levelTimes: [],
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    score: { damageDone: 0, scrapCollected: 0 },
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
  accelerateNextSpawnWhenArenaEmpty(game);
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
    if (isBossLevel(game.level, game.levelMusic)) game.bossLevelsCompleted += 1;
    emitSoundEvent(game, SOUND_EVENTS.STAGE_VICTORY);
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
  game.soundEvents = [];
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
  const currentMusic = musicForLevel(level, levelMusic);
  const count = isBoss ? Math.max(1, Math.ceil(level / 2)) : level;
  const enhancedCount = !isBoss && hasBossMusicBeforeLevel(level, levelMusic) ? Math.floor(count / 2) : 0;
  const standardCount = count - enhancedCount;
  for (let i = 0; i < count; i += 1) {
    const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 45;
    const row = Math.floor(i / 4) * 35;
    const kind = i < standardCount ? 'standard' : 'enhanced';
    const world =
      kind === 'enhanced'
        ? roadOffsetToWorld({ x: spread, y: road.halfHeight + 47.5 + row }, road)
        : roadOffsetToWorld({ x: spread, y: -road.halfHeight - 47.5 - row }, road);
    const pirateShip = usesBoatSilhouetteEnemy(currentMusic, level);
    const enemy =
      kind === 'enhanced'
        ? pirateShip
          ? createEnhancedPirateShipEnemy(world.x, world.y)
          : createEnhancedEnemy(world.x, world.y)
        : pirateShip
          ? createPirateShipEnemy(world.x, world.y)
          : createEnemy(world.x, world.y);
    if (kind === 'enhanced') {
      enemy.palette = enhancedEnemyPaletteForMusic(currentMusic);
      const velocity = roadDirectionToWorld(0, -1, road);
      enemy.vx = velocity.x * 155;
      enemy.vy = velocity.y * 155;
      enemy.charge = { state: 'charging', timer: 1.15, x: velocity.x, y: velocity.y };
      enemy.shieldActive = true;
    } else {
      const velocity = roadDirectionToWorld(0, 1, road);
      enemy.vx = velocity.x * 17.5;
      enemy.vy = velocity.y * 17.5;
    }
    enemies.push(enemy);
  }
  if (isBoss) {
    const bossWorld = roadOffsetToWorld({ x: 0, y: -road.halfHeight - 90 }, road);
    const boss = createBossEnemy(bossWorld.x, bossWorld.y);
    boss.vx = roadDirectionToWorld(0, 1, road).x * 18;
    boss.vy = roadDirectionToWorld(0, 1, road).y * 18;
    enemies.push(boss);
  }
  return enemies;
}

function usesBoatSilhouetteEnemy(trackName, level) {
  return level <= 6 || /^(?:TheWeyfindersRoad|DigitizedStream|PiratesRoad)_/i.test(trackName ?? '');
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

function accelerateNextSpawnWhenArenaEmpty(game) {
  if (activeEnemies(game).length > 0 || game.enemySpawnQueue.length === 0) return;
  const elapsed = game.time - game.levelStartTime;
  game.enemySpawnQueue[0].at = Math.min(game.enemySpawnQueue[0].at, elapsed + 3);
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
    ...game.playerProjectiles.map((projectile) => projectile.detonateAtTarget && projectile.targetHint).filter(Boolean),
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
      pickup.vx += (dx / distance) * (65 + pull * 130) * magnetStrength * dt;
      pickup.vy += (dy / distance) * (65 + pull * 130) * magnetStrength * dt;
    }
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.pow(0.18, dt);
    pickup.vy *= Math.pow(0.18, dt);
    pickup.life -= dt;
    if (distanceSquared(pickup, game.vehicle) <= (collectRange + pickup.radius) ** 2) {
      game.scrap += pickup.value;
      game.score.scrapCollected += pickup.value;
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
    if ((input.secondarySelect ?? game.secondary.selected) === 'beam') return { ...input, compensatedAim: true, aimProjectileSpeed: 1_000_000 };
    return input;
  }
  if (input.gunnerEnabled === false || (game.vehicle.manualAimGrace ?? 0) > 0 || activeEnemies(game).length === 0) {
    game.aimReticle = null;
    return input;
  }

  const target = gunnerAimTarget(game);
  if (!target) return input;
  game.aiAimReticle = moveToward(game.aiAimReticle ?? { x: game.vehicle.x, y: game.vehicle.y }, target, 130 * dt);
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
  game.boost.acceleration = 35 * upgradeMultiplier(game, 'boostAcceleration');
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
  const speed = PRIMARY_PROJECTILE_SPEED * upgradeMultiplier(game, 'gunVelocity');
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, Math.cos(angle) * speed + game.vehicle.vx, Math.sin(angle) * speed + game.vehicle.vy, {
      team: 'player',
      radius: 0.75,
      damage,
      impulse: 30,
      lifetime: 2.2,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_MAIN_GUN);
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
  updateEnemyVisualHeading(enemy, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.pow(0.78, dt);
  enemy.vy *= Math.pow(0.78, dt);
}

function updateEnemyVisualHeading(enemy, dt) {
  if (enemy.kind === 'boss' || enemy.silhouette !== 'pirateShip') return;
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed <= 8) return;
  const target = Math.atan2(enemy.vy, enemy.vx);
  enemy.visualHeading = turnTowardAngle(enemy.visualHeading ?? target, target, 5.8 * dt);
}

function stepEnhancedEnemy(game, enemy, dt) {
  const charge = enemy.charge ?? { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.charge = charge;
  charge.timer -= dt;
  enemy.shieldActive = charge.state === 'charging';
  if (charge.state === 'charging') {
    enemy.vx += charge.x * 82.5 * dt;
    enemy.vy += charge.y * 82.5 * dt;
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
  updateBossArmUnfurl(game, boss, dt);
  steerBossBackToViewArea(game, boss, dt);
  boss.centerPulseTimer -= dt;
  stepBossArms(game, boss, dt);
  if (boss.centerPulseTimer <= 0) {
    fireBossCenterPulse(game, boss);
    boss.centerPulseTimer = 6.8;
  }
}

function updateBossArmUnfurl(game, boss, dt) {
  const offset = worldToRoadOffset(boss, game.road);
  const visibleProgress = clamp((offset.y + game.road.halfHeight + 80) / 130, 0, 1);
  boss.armUnfurl = clamp((boss.armUnfurl ?? 0) + dt * (0.26 + visibleProgress * 0.72), 0, 1);
}

function steerBossBackToViewArea(game, boss, dt) {
  const offset = worldToRoadOffset(boss, game.road);
  const targetOffset = {
    x: clamp(offset.x, -game.road.halfWidth * 0.42, game.road.halfWidth * 0.42),
    y: clamp(offset.y, -game.road.halfHeight * 0.48, game.road.halfHeight * 0.04),
  };
  const dxOffset = targetOffset.x - offset.x;
  const dyOffset = targetOffset.y - offset.y;
  const distance = Math.hypot(dxOffset, dyOffset);
  if (distance <= 4) {
    boss.vx *= Math.pow(0.08, dt);
    boss.vy *= Math.pow(0.08, dt);
    return;
  }
  const targetWorld = roadOffsetToWorld(targetOffset, game.road);
  const dx = targetWorld.x - boss.x;
  const dy = targetWorld.y - boss.y;
  const worldDistance = Math.hypot(dx, dy) || 1;
  const desiredSpeed = clamp(worldDistance * 3.1, 40, 310);
  const desiredVx = (dx / worldDistance) * desiredSpeed;
  const desiredVy = (dy / worldDistance) * desiredSpeed;
  const steer = clamp(8.5 * dt, 0, 1);
  boss.vx += (desiredVx - boss.vx) * steer;
  boss.vy += (desiredVy - boss.vy) * steer;
}

function stepBossArms(game, boss, dt) {
  for (const arm of boss.arms ?? []) {
    if (detonateBrokenBossArm(game, boss, arm)) continue;
    arm.phase += dt * game.rng.range(5.2, 8.4);
    arm.aim.x += (game.vehicle.x - arm.aim.x) * 0.18 * dt + Math.cos(arm.phase) * 32 * dt;
    arm.aim.y += (game.vehicle.y - arm.aim.y) * 0.18 * dt + Math.sin(arm.phase * 0.7) * 32 * dt;
    if ((boss.armUnfurl ?? 1) < 0.55) continue;
    if (stepBossLaser(game, boss, arm, dt)) continue;
    arm.fireTimer = (arm.fireTimer ?? game.rng.range(0.2, 1.5)) - dt;
    if (arm.fireTimer > 0) continue;
    arm.fireTimer = game.rng.range(1.8, 4.3);
    fireBossArmAttack(game, boss, arm);
  }
}

function stepBossLaser(game, boss, arm, dt) {
  const laser = arm.laser;
  if (!laser) return false;
  const source = bossArmSource(boss, arm);
  if (!source) {
    arm.laser = null;
    return false;
  }
  laser.timer -= dt;
  if (laser.timer > BOSS_LASER_LOCK_TIME) {
    laser.target = { x: game.vehicle.x, y: game.vehicle.y };
  }
  laser.source = source;
  if (laser.timer > 0) return true;
  const angle = Math.atan2(laser.target.y - source.y, laser.target.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, 0, 0, {
      team: 'enemy',
      weapon: 'boss-laser',
      behavior: 'beam',
      radius: 1.5,
      damage: 7.5,
      impulse: 80,
      lifetime: 15 / 60,
      length: 380,
      frames: 15,
      angle,
      color: '#ff2626',
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BEAM);
  arm.laser = null;
  return false;
}

function fireBossArmAttack(game, boss, arm) {
  const source = bossArmSource(boss, arm);
  if (!source) return;
  const roll = game.rng.next();
  if (roll > 0.9) {
    arm.laser = { source, target: { x: game.vehicle.x, y: game.vehicle.y }, timer: BOSS_LASER_CHARGE_TIME, duration: BOSS_LASER_CHARGE_TIME };
    return;
  }
  if (roll > 0.72) {
    fireBossProtectiveShot(game, source, arm);
    return;
  }
  if (roll > 0.42) {
    fireBossDelayedShot(game, source, arm);
    return;
  }
  fireBossStandardShot(game, source, arm);
}

function fireBossStandardShot(game, source, arm) {
  const angle = Math.atan2(arm.aim.y - source.y, arm.aim.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, Math.cos(angle) * 56, Math.sin(angle) * 56, {
      team: 'enemy',
      weapon: 'boss-tentacle',
      radius: 1.1,
      damage: 10,
      impulse: 75,
      lifetime: 4,
      angle,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireBossDelayedShot(game, source, arm) {
  const angle = Math.atan2(arm.aim.y - source.y, arm.aim.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, Math.cos(angle) * 27.5, Math.sin(angle) * 27.5, {
      team: 'enemy',
      weapon: 'boss-drifter',
      radius: 1.1,
      damage: 9,
      impulse: 62.5,
      lifetime: 6.5,
      angle,
      delayBeforeAcceleration: game.rng.range(1.4, 2.6),
      stopBeforeAcceleration: true,
      acceleration: 75,
      accelerationDuration: 3,
      accelerationTarget: game.vehicle,
      accelerationJitter: game.rng.range(-0.04, 0.04),
      maxSpeed: 137.5,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireBossProtectiveShot(game, source, arm) {
  const angle = Math.atan2(arm.aim.y - source.y, arm.aim.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, Math.cos(angle) * 41, Math.sin(angle) * 41, {
      team: 'enemy',
      weapon: 'boss-shield-shot',
      radius: 1.6,
      damage: 7,
      impulse: 52.5,
      lifetime: 4.8,
      angle,
      color: '#3d6f8f',
      absorbsPlayerProjectiles: true,
      absorbHp: 24,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function bossArmSource(boss, arm) {
  const liveGun = boss.cells.find((cell) => cell.id.startsWith(`arm-${arm.index}-`) && cell.type === 'gun' && !cell.state.destroyed);
  if (!liveGun) return null;
  return { x: boss.x + liveGun.gridX * CELL_SIZE, y: boss.y + liveGun.gridY * CELL_SIZE };
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
        blastOnExpire: { radius: CELL_SIZE * 1.4, damage: 6, impulse: 42.5 },
      }),
    );
    for (let index = 0; index < 4; index += 1) {
      const angle = game.rng.range(0, Math.PI * 2);
      game.enemyProjectiles.push(
        createProjectile(origin.x, origin.y, Math.cos(angle) * game.rng.range(37.5, 75), Math.sin(angle) * game.rng.range(37.5, 75), {
          team: 'enemy',
          weapon: 'boss-arm-shrapnel',
          radius: 0.7,
          damage: 5,
          impulse: 35,
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
      createProjectile(boss.x, boss.y, Math.cos(angle) * 27.5, Math.sin(angle) * 27.5, {
        team: 'enemy',
        weapon: 'boss-missile',
        radius: 1.5,
        damage: 9,
        impulse: 57.5,
        lifetime: 7,
        angle,
        delayBeforeAcceleration: 3,
        stopBeforeAcceleration: true,
        acceleration: 67.5,
        accelerationDuration: 10,
        accelerationTarget: game.vehicle,
        accelerationJitter: 0,
        maxSpeed: 280,
        vanishOffscreen: true,
      }),
    );
  }
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepEnemyPatterns(game, enemy, dt) {
  for (const patternState of enemy.patterns ?? []) {
    patternState.timer -= dt;
    if (patternState.timer > 0) continue;
    const projectiles = firePattern(patternState, enemy, game.vehicle, game.rng);
    game.enemyProjectiles.push(...projectiles);
    if (projectiles.length > 0) {
      enemy.lastFiredAt = game.time;
      enemy.attackHeading = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
      emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
    }
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
      radius: 4,
      damage,
      vx: direction.x * 125,
      vy: direction.y * 125,
    });
    if (hit.hit) game.score.damageDone += Math.round(damage + hit.removed * 3);
    if (hit.destroyedNow) explodeEnemy(game, enemy);
    enemy.vx += direction.x * 55 * upgradeMultiplier(game, 'boostRamDamage');
    enemy.vy += direction.y * 55 * upgradeMultiplier(game, 'boostRamDamage');

    const recoilDamage = damage * 0.25 * upgradeReduction(game, 'boostRecoilDamage');
    const recoilImpulse = 55 * upgradeReduction(game, 'boostRecoilKnockback');
    applyVehicleDamage(game.vehicle, game.vehicle, CELL_SIZE * 0.5, recoilDamage, recoilImpulse, {
      x: -direction.x,
      y: -direction.y,
    });
  }
}

function handleBoostShieldRepel(game, dt) {
  if (game.boost.activeTime <= 0) return;
  const radius = boostShieldRadius(game);
  const enemyImpulse = 90 * upgradeMultiplier(game, 'boostShielding');
  const projectileImpulse = 180 * upgradeMultiplier(game, 'boostShielding');
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
    if (projectile.behavior === 'beam') {
      hitVehicleWithEnemyBeam(game, projectile);
      continue;
    }
    if (hitDestructiblePlayerProjectile(game, projectile)) {
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
    if (playerProjectileAbsorbedByEnemyProjectile(game, projectile)) {
      projectile.lifetime = 0;
      continue;
    }
    if (projectileReachedDetonationTarget(projectile)) {
      projectile.lifetime = 0;
      if (projectile.weapon === 'cannon') spawnCannonImpact(game, projectile);
      continue;
    }
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

function playerProjectileAbsorbedByEnemyProjectile(game, playerProjectile) {
  for (const enemyProjectile of game.enemyProjectiles) {
    if (!enemyProjectile.absorbsPlayerProjectiles || enemyProjectile.lifetime <= 0) continue;
    const hitRange = enemyProjectile.radius + playerProjectile.radius;
    if (distanceSquared(enemyProjectile, playerProjectile) > hitRange * hitRange) continue;
    enemyProjectile.absorbHp -= playerProjectile.damage;
    if (enemyProjectile.absorbHp <= 0) enemyProjectile.lifetime = 0;
    return true;
  }
  return false;
}

function traceAbsorbingEnemyProjectileRay(projectiles, origin, angle, length, beamHalfWidth = 0) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  let nearest = null;
  for (const projectile of projectiles) {
    if (!projectile.absorbsPlayerProjectiles || projectile.lifetime <= 0) continue;
    const dx = projectile.x - origin.x;
    const dy = projectile.y - origin.y;
    const along = dx * dir.x + dy * dir.y;
    if (along < 0 || along > length) continue;
    const perpendicular = Math.abs(dx * dir.y - dy * dir.x);
    if (perpendicular > projectile.radius + beamHalfWidth) continue;
    if (!nearest || along < nearest.distance) {
      nearest = {
        projectile,
        distance: along,
        x: origin.x + dir.x * along,
        y: origin.y + dir.y * along,
      };
    }
  }
  return nearest;
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
  const blast = projectile.blastOnExpire ?? { radius: CELL_SIZE * 1.275, damage: 4.5, impulse: 27.5 };
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

function hitDestructiblePlayerProjectile(game, enemyProjectile) {
  for (const projectile of game.playerProjectiles) {
    if (projectile.lifetime <= 0 || !projectile.hull) continue;
    const hit = applyRocketHullDamage(projectile, enemyProjectile);
    if (!hit.hit) continue;
    if (hit.destroyed) {
      projectile.lifetime = 0;
      if (projectile.weapon === 'rocket') spawnRocketImpact(game, projectile);
      if (projectile.weapon === 'cannon') spawnCannonImpact(game, projectile);
    }
    return true;
  }
  return false;
}

function projectileReachedDetonationTarget(projectile) {
  if (!projectile.detonateAtTarget || !projectile.targetHint) return false;
  const target = projectile.targetHint;
  const dx = projectile.x - projectile.previousX;
  const dy = projectile.y - projectile.previousY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.001) return distanceSquared(projectile, target) <= projectile.radius ** 2;
  const along = ((target.x - projectile.previousX) * dx + (target.y - projectile.previousY) * dy) / lengthSquared;
  const t = clamp(along, 0, 1);
  const closest = { x: projectile.previousX + dx * t, y: projectile.previousY + dy * t };
  return distanceSquared(closest, target) <= Math.max(projectile.radius, 5) ** 2 && along >= 0;
}

function shieldedProjectile(game, projectile) {
  if (game.boost.activeTime <= 0) return projectile;
  const shield = clamp(0.25 * upgradeMultiplier(game, 'boostShielding'), 0, 0.8);
  return { ...projectile, damage: projectile.damage * (1 - shield), impulse: projectile.impulse * (1 - shield) };
}

function hitVehicleWithEnemyBeam(game, projectile) {
  const step = CELL_SIZE / 3;
  const dx = Math.cos(projectile.angle);
  const dy = Math.sin(projectile.angle);
  projectile.renderEndX = projectile.x + dx * projectile.length;
  projectile.renderEndY = projectile.y + dy * projectile.length;
  for (let distance = 0; distance <= projectile.length; distance += step) {
    const point = { x: projectile.x + dx * distance, y: projectile.y + dy * distance };
    if (distanceSquared(point, game.vehicle) > (CELL_SIZE * 4.2) ** 2) continue;
    const hit = hitVehicleWithProjectile(game.vehicle, { ...projectile, x: point.x, y: point.y });
    if (!hit.hit) continue;
    projectile.renderEndX = point.x;
    projectile.renderEndY = point.y;
    return true;
  }
  return false;
}

function hitEnemiesWithBeam(game, projectile) {
  const halfWidth = beamHalfWidth(projectile);
  const shieldTrace = traceAbsorbingEnemyProjectileRay(game.enemyProjectiles, projectile, projectile.angle, projectile.length, halfWidth);
  if (shieldTrace) {
    projectile.renderEndX = shieldTrace.x;
    projectile.renderEndY = shieldTrace.y;
    shieldTrace.projectile.absorbHp -= projectile.damage * beamDamageScale(projectile);
    if (shieldTrace.projectile.absorbHp <= 0) shieldTrace.projectile.lifetime = 0;
    return;
  }
  const trace = traceEnemyVoxelBeam(activeEnemies(game), projectile, projectile.angle, projectile.length, halfWidth, projectile.pierce ?? 0);
  projectile.renderEndX = trace.x;
  projectile.renderEndY = trace.y;
  if (trace.hits.length === 0) return;
  const scale = beamDamageScale(projectile);
  for (const voxelHit of trace.hits) {
    if (enemyShieldBlocks(voxelHit.enemy, voxelHit)) continue;
    const hit = applyEnemyVoxelDamage(voxelHit.enemy, voxelHit, projectile.damage * scale);
    if (hit.hit) {
      game.score.damageDone += Math.round(projectile.damage * scale + hit.removed * 3);
      voxelHit.enemy.vx += Math.cos(projectile.angle) * projectile.impulse * 0.0015 * scale;
      voxelHit.enemy.vy += Math.sin(projectile.angle) * projectile.impulse * 0.0015 * scale;
      if (hit.destroyedNow) explodeEnemy(game, voxelHit.enemy);
    }
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
    applyVehicleDamage(game.vehicle, game.vehicle, CELL_SIZE * 0.9, 16, 115, toVehicle);
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

function beamHalfWidth(projectile) {
  const frames = projectile.frames || 9;
  const age = 1 - Math.max(0, projectile.lifetime / projectile.maxLifetime);
  const frame = Math.max(0, Math.min(frames - 1, Math.floor(age * frames)));
  const envelope = Math.sin(((frame + 0.5) / frames) * Math.PI);
  const voxelWidth = (projectile.radius ?? 1) + envelope * 2.8;
  return ((CELL_SIZE / 6) * voxelWidth) / 2;
}

function spawnCannonImpact(game, projectile, enemy) {
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_EXPLOSION);
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
    knockEnemyFromPoint(blastTarget, projectile, CELL_SIZE * 4.6, projectile.blastKnockback || 27.5);
  }

  const fragmentCount = projectile.shrapnelCount || 28;
  const baseAngle = projectile.angle;
  for (let index = 0; index < fragmentCount; index += 1) {
    const fan = ((index / (fragmentCount - 1)) - 0.5) * Math.PI * 1.35;
    const angle = baseAngle + fan + game.rng.range(-0.08, 0.08);
    const speed = game.rng.range(42.5, 77.5);
    game.playerProjectiles.push(
      createProjectile(projectile.x, projectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        team: 'player',
        weapon: 'cannon-shrapnel',
          radius: game.rng.range(0.7, 1.1),
        damage: projectile.damage * (projectile.shrapnelDamageScale ?? 1) * game.rng.range(0.1, 0.18),
        impulse: projectile.impulse * 0.08,
        lifetime: game.rng.range(0.22, 0.42),
      }),
    );
  }
}

function spawnRocketImpact(game, projectile, enemy) {
  if ((projectile.blastRadius ?? 0) <= 0) return;
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_EXPLOSION);
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
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_DEATH);
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
  const impulse = 97.5;
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

function turnTowardAngle(current, target, maxStep) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
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
  enemy.vx += accel.x * 22.5 * dt;
  enemy.vy += accel.y * 22.5 * dt;
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

import { applyVehicleDamage, createStartingVehicle, gunMuzzleWorld, gunMuzzlesWorld, hasFunctionalGun, recalculateVehicle } from './vehicle.js';
import { stepVehicle, typedModulePower } from './physics.js';
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
import { CELL_SIZE, VOXEL_SIZE } from './voxelMask.js';
import { recalculateCell as recalculateEnemyCell } from './cell.js';
import { PRIMARY_PROJECTILE_SPEED, stepTurretAim } from './turret.js';
import { createBoostState, stepBoost } from './boost.js';
import {
  applyEnemyBlastDamage,
  applyEnemyDamage,
  applyEnemyProjectilePierceDamage,
  applyEnemyVoxelDamage,
  createBossEnemy,
  createEnemy,
  createEnhancedEnemy,
  createEnhancedPirateShipEnemy,
  createMortarSkiffEnemy,
  createPirateShipEnemy,
  enemyCoreEfficiency,
  enemyEngineEfficiency,
  enemyGunEfficiency,
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
  upgradeLevel,
  upgradeMultiplier,
  upgradeReduction,
} from './economy.js';
import { DEFAULT_LEVEL_MUSIC, hasBossMusicBeforeLevel, isBossMusic, musicForLevel } from './levelMusic.js';
import { enhancedEnemyPaletteForMusic } from './levelStyle.js';
import { emitSoundEvent, SOUND_EVENTS } from './soundEvents.js';
import { createCombatEventStats, recordEnemyDefeat } from './combatEvents.js';
import { getEnemyArchetype, listEnemyArchetypes } from './enemyArchetypeDefinition.js';
import { createTerrainGenerator } from './terrainGenerator.js';
import { sampleTerrain } from './terrainQuery.js';
import { createTerrainState, updateTerrainStreaming } from './terrainStreaming.js';
import { normalizeGunLoadouts } from './weaponLoadout.js';
import { runtimeWeaponDefinition } from './weaponDefinition.js';
import { normalizeSandboxDefinition, validateSandboxDefinition } from './sandboxMode.js';
import trackingFlechetteDefinition from '../../content/weapons/tracking_flechette.json' with { type: 'json' };
import mortarDefinition from '../../content/weapons/mortar.json' with { type: 'json' };
import miniBeamDefinition from '../../content/weapons/mini_beam.json' with { type: 'json' };
import repulsorBeamDefinition from '../../content/weapons/repulsor_beam.json' with { type: 'json' };
import startingVehicleDefinition from '../../content/constructs/starting_vehicle.json' with { type: 'json' };

export const LEVEL_TARGET_DURATION = 180;
export const TARGETING_MODES = ['manual', 'guided', 'mixed'];
const SPAWN_WARNING_LEAD = 2.4;
const BOSS_LASER_CHARGE_TIME = 3;
const BOSS_LASER_LOCK_TIME = 1;
const PRIMARY_WEAPON_DEFINITIONS = {
  tracking_flechette: runtimeWeaponDefinition(trackingFlechetteDefinition),
  mortar: runtimeWeaponDefinition(mortarDefinition),
  mini_beam: runtimeWeaponDefinition(miniBeamDefinition),
  repulsor_beam: runtimeWeaponDefinition(repulsorBeamDefinition),
};
const ENEMY_UPGRADE_TYPES = ['damage', 'attackRate', 'armor', 'movementSpeed'];
const HOPPER_FROG_VISUAL_SCALE = 1.5;
const HOPPER_FROG_HOP_IMPULSE = 71.25;
const PHANTOM_OVERLOAD_DURATION = 3;
const PHANTOM_OVERLOAD_SPEED = 195;
const PHANTOM_OVERLOAD_DAMAGE = 22;
const PHANTOM_OVERLOAD_RADIUS = CELL_SIZE * 3.2;
const PHANTOM_OVERLOAD_IMPULSE = 140;
const ENEMY_MORTAR_LINE_FIRST_IMPACT_SECONDS = 1.55;
const ENEMY_MORTAR_LINE_IMPACT_SPACING_SECONDS = 0.22;
const RUNTIME_ENEMY_ARCHETYPES = {
  'mortar_skiff.prototype0': {
    id: 'mortar_skiff.prototype0',
    displayName: 'Dizzy Mortar Skiff',
    zone: 'PiratesRoad',
    runtimeFactory: 'createMortarSkiffEnemy',
  },
};
const MORTAR_ENEMY_SHELL_SPRITE = {
  assetId: 'sprite.weapon.mortar_enemy_shell',
  path: 'assets/images/weapons/mortar_enemy_shell.png',
  sourceSheet: 'assets/stylesheets/weapons__mortar__sprite_stylesheet.png',
  nativeSize: [44, 61],
  displaySize: [7.5, 10.5],
  anchor: [0.5, 0.6],
  alignToVelocity: false,
};
const MORTAR_ENEMY_MARKER_SPRITE = {
  assetId: 'sprite.weapon.mortar_enemy_marker',
  path: 'assets/images/weapons/mortar_enemy_marker.png',
  sourceSheet: 'assets/stylesheets/weapons__mortar__sprite_stylesheet.png',
  nativeSize: [126, 53],
  displaySize: [58, 24],
  anchor: [0.5, 0.5],
  alignToVelocity: false,
};

export function createGame(seed = 1147, options = {}) {
  const vehicleDefinition = options.vehicleDefinition ?? startingVehicleDefinition;
  const vehicle = createStartingVehicle(vehicleDefinition);
  const road = createRoadFrame(vehicle);
  const terrainGenerator = createTerrainGenerator({ seed: options.terrainSeed ?? seed, route: options.terrainRoute });
  const terrain = createTerrainState(terrainGenerator);
  updateTerrainStreaming(terrain, road);
  const terrainSample = sampleTerrain(terrain, vehicle.x, vehicle.y);
  const levelMusic = options.levelMusic ?? DEFAULT_LEVEL_MUSIC;
  const startLevel = Math.max(1, Math.floor(options.startLevel ?? options.level ?? 1));
  const rng = new Rng(seed);
  const sandboxDefinition = options.sandbox ? normalizeSandboxDefinition(options.sandbox) : null;
  const enemySpawnQueue = sandboxDefinition
    ? createSandboxEnemySchedule(road, sandboxDefinition, rng, options)
    : createLevelEnemySchedule(road, startLevel, levelMusic, rng);
  const initialSpawns = dequeueReadySpawns(enemySpawnQueue, 0);
  return {
    rng,
    levelMusic,
    currentMusic: sandboxDefinition ? options.music ?? 'Sandbox' : musicForLevel(startLevel, levelMusic),
    vehicleDefinition,
    vehicle,
    road,
    camera: createRoadCamera(road),
    terrain,
    terrainSample,
    enemies: initialSpawns,
    enemySpawnQueue,
    incomingMarkers: [],
    boost: createBoostState(),
    secondary: createSecondaryState(vehicleDefinition),
    upgrades: createUpgradeState(),
    scrap: 0,
    scrapPickups: [],
    playerProjectiles: [],
    enemyProjectiles: [],
    smokeParticles: [],
    soundEvents: [],
    autofire: true,
    primaryHeat: { heat: 0, maxHeat: 100 },
    repulsor: { charges: 5, maxCharges: 5, rechargeTimer: 0, cooldown: 4.5 },
    playerFireTimer: 0,
    playerGunIndex: 0,
    levelComplete: false,
    levelTime: 0,
    level: sandboxDefinition?.level ?? startLevel,
    levelStartTime: 0,
    levelTimes: [],
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    score: { damageDone: 0, scrapCollected: 0, ...createCombatEventStats() },
    aiAimReticle: null,
    aimReticle: null,
    time: 0,
    fps: 60,
    gameOver: false,
    paused: false,
    targetingMode: 'mixed',
    guidedTargetId: null,
    sandbox: sandboxDefinition ? createSandboxRuntimeState(sandboxDefinition, [], options.enemyArchetypes) : null,
  };
}

export function stepGame(game, input, dt) {
  dt = Math.min(dt, 0.033);
  if (input.targetingMode && TARGETING_MODES.includes(input.targetingMode)) game.targetingMode = input.targetingMode;
  if (input.pausePressed) game.paused = !game.paused;
  if (input.targetCycle) cycleGuidedTarget(game, input.targetCycle);
  if (game.paused) {
    stepPausedGame(game, input, dt);
    return game;
  }
  game.time += dt;
  if (input.resetPressed) {
    return createGame(1147, {
      vehicleDefinition: game.vehicleDefinition,
      levelMusic: game.levelMusic,
      sandbox: game.sandbox?.definition,
      enemyArchetypes: game.sandbox?.enemyArchetypes,
    });
  }
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
  applyRoadTurnDizziness(game, roadDelta.turnAngle);
  stepSandboxEvents(game);
  stepEnemySpawner(game, dt);
  game.terrainSample = sampleTerrain(game.terrain, game.vehicle.x, game.vehicle.y);
  stepVehicle(game.vehicle, input, dt, game.road.heading, game.upgrades, game.terrainSample);
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

  trackReticleArcProjectiles(game);
  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt, activeEnemies(game));
  stepPlayerProjectileEmitters(game, dt);
  syncBeamProjectiles(game);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  syncEnemyBeamProjectiles(game);
  handleEnemyProjectileSpecials(game);
  stepSmokeParticles(game, dt);
  stepRocketContrails(game, dt);
  stepBoostContrails(game, dt);
  handleCollisions(game);
  handleBoostExhaustDamage(game);
  accelerateNextSpawnWhenArenaEmpty(game);
  stepScrapPickups(game, dt);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  syncBeamProjectiles(game);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  updateTerrainStreaming(game.terrain, game.camera);
  game.terrainSample = sampleTerrain(game.terrain, game.vehicle.x, game.vehicle.y);
  game.gameOver = !game.vehicle.alive;
  if (shouldCompleteRun(game) && activeEnemies(game).length === 0 && game.enemySpawnQueue.length === 0 && game.scrapPickups.length === 0) finishLevel(game);
  return game;
}

function stepPausedGame(game, input, dt) {
  stepSecondaryWeapon(game, { ...input, secondaryFirePressed: false, secondaryAutofire: false }, dt);
  const turretInput = aimInputForTurret(game, { ...input, secondaryFirePressed: false }, dt);
  stepTurretAim(game.vehicle, activeEnemies(game), turretInput, dt);
  game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
  stepSmokeParticles(game, dt);
}

function shouldCompleteRun(game) {
  if (!game.sandbox?.enabled) return true;
  return game.sandbox.definition.completeOnEmpty === true || game.sandbox.completeRequested === true;
}

function finishLevel(game) {
  game.levelComplete = true;
  game.levelTime = game.time - game.levelStartTime;
  game.levelTimes.push(game.levelTime);
  if (!game.sandbox?.enabled) {
    game.levelsCompleted = game.level;
    if (isBossLevel(game.level, game.levelMusic)) game.bossLevelsCompleted += 1;
  }
  emitSoundEvent(game, SOUND_EVENTS.STAGE_VICTORY);
}

export function startNextLevel(game) {
  game.level += 1;
  game.levelComplete = false;
  game.levelTime = 0;
  game.levelStartTime = game.time;
  game.sandbox = null;
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

export function applySandboxDefinitionToGame(game, definition, options = {}) {
  const report = validateSandboxDefinition(definition);
  if (!report.valid) throw new Error(`Invalid sandbox definition: ${report.errors.join(' ')}`);
  const sandboxDefinition = report.definition;
  game.sandbox = createSandboxRuntimeState(sandboxDefinition, report.warnings, options.enemyArchetypes);
  game.level = sandboxDefinition.level;
  game.currentMusic = options.music ?? 'Sandbox';
  game.levelComplete = false;
  game.levelTime = 0;
  game.levelStartTime = game.time;
  game.enemySpawnQueue = createSandboxEnemySchedule(game.road, sandboxDefinition, game.rng, options);
  game.enemies = dequeueReadySpawns(game.enemySpawnQueue, 0);
  game.incomingMarkers = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.smokeParticles = [];
  game.scrapPickups = [];
  game.soundEvents = [];
  game.guidedTargetId = null;
  return { game, report };
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

export function createSandboxEnemySchedule(road, definition, rng = new Rng(1147), options = {}) {
  const sandboxDefinition = normalizeSandboxDefinition(definition);
  return createSandboxSpawnEntries(road, sandboxDefinition.spawns, rng, {
    ...options,
    level: sandboxDefinition.level,
  }).sort((a, b) => a.at - b.at);
}

function createSandboxRuntimeState(definition, warnings = [], enemyArchetypes = []) {
  return {
    enabled: true,
    definition: structuredClone(definition),
    events: definition.events.map((event) => ({ ...structuredClone(event), fired: false })),
    enemyArchetypes: structuredClone(enemyArchetypes ?? []),
    warnings: [...warnings],
    lastMessage: '',
  };
}

function stepSandboxEvents(game) {
  if (!game.sandbox?.enabled) return;
  const elapsed = game.time - game.levelStartTime;
  for (const event of game.sandbox.events) {
    if (event.fired || event.at > elapsed) continue;
    event.fired = true;
    applySandboxEvent(game, event, elapsed);
  }
}

function applySandboxEvent(game, event, elapsed) {
  if (event.type === 'spawn') {
    const entries = createSandboxSpawnEntries(game.road, event.spawns, game.rng, {
      level: game.sandbox?.definition.level ?? game.level,
      enemyArchetypes: game.sandbox?.enemyArchetypes,
      timeOffset: elapsed,
    });
    game.enemySpawnQueue.push(...entries);
    game.enemySpawnQueue.sort((a, b) => a.at - b.at);
    game.sandbox.lastMessage = `${event.id}: queued ${entries.length} enemies.`;
  } else if (event.type === 'clearEnemies') {
    game.enemies = [];
    game.enemyProjectiles = [];
    game.incomingMarkers = [];
    game.sandbox.lastMessage = `${event.id}: arena cleared.`;
  } else if (event.type === 'setScrap') {
    game.scrap = Math.max(0, Math.floor(event.value ?? 0));
    game.sandbox.lastMessage = `${event.id}: scrap set to ${game.scrap}.`;
  } else if (event.type === 'addScrap') {
    game.scrap = Math.max(0, Math.floor(game.scrap + (event.value ?? 0)));
    game.sandbox.lastMessage = `${event.id}: scrap is ${game.scrap}.`;
  } else if (event.type === 'setTargetingMode' && TARGETING_MODES.includes(event.mode)) {
    game.targetingMode = event.mode;
    game.sandbox.lastMessage = `${event.id}: targeting ${event.mode}.`;
  } else if (event.type === 'complete') {
    game.sandbox.completeRequested = true;
    game.sandbox.lastMessage = `${event.id}: completion armed.`;
    if (!game.levelComplete) finishLevel(game);
  } else if (event.text) {
    game.sandbox.lastMessage = event.text;
  }
}

function createSandboxSpawnEntries(road, spawns, rng, options = {}) {
  const entries = [];
  for (const spawn of spawns ?? []) {
    const count = Math.max(1, spawn.count ?? 1);
    const interval = Math.max(0, spawn.interval ?? 0);
    for (let index = 0; index < count; index += 1) {
      const laneOffset = sandboxLaneOffset(spawn, index, count, rng);
      const roadY = spawn.roadY ?? sandboxRoadY(spawn, road);
      const world = roadOffsetToWorld({ x: laneOffset, y: roadY }, road);
      const enemy = createSandboxEnemy(spawn, world.x, world.y, road, options);
      const at = Math.max(0, (options.timeOffset ?? 0) + (spawn.at ?? 0) + index * interval);
      entries.push({ at, enemy, markerShown: false, type: enemy.kind ?? spawn.kind ?? 'standard', sandbox: true, source: spawn.id });
    }
  }
  return entries;
}

function createSandboxEnemy(spawn, x, y, road, options = {}) {
  const archetype = sandboxArchetypeForSpawn(spawn, options.enemyArchetypes ?? []);
  const kind = spawn.kind ?? 'standard';
  const enemy = archetype ? createEnemyForArchetype(archetype, x, y, kind) : createEnemy(x, y);
  if (archetype) applyArchetypeRuntimeMetadata(enemy, archetype);
  enemy.sandboxSource = { archetype: spawn.archetype ?? null, construct: spawn.construct ?? null };
  const velocitySign = spawn.entry === 'behind' ? -1 : 1;
  const direction = roadDirectionToWorld(0, velocitySign, road);
  const speed = spawn.speed ?? (spawn.entry === 'behind' ? 155 : 24);
  enemy.vx = direction.x * speed;
  enemy.vy = direction.y * speed;
  applyEnemyLevelUpgrades(enemy, spawn.level ?? options.level ?? 1);
  return enemy;
}

function sandboxArchetypeForSpawn(spawn, extraArchetypes = []) {
  const archetypeId = spawn.archetype ?? spawn.enemy;
  if (archetypeId) {
    const match = extraArchetypes.find((archetype) => archetype.id === archetypeId || archetype.assetIdAlias === archetypeId);
    return match ?? runtimeArchetype(archetypeId);
  }
  if (spawn.construct) {
    return (
      extraArchetypes.find((archetype) => archetype.construct === spawn.construct) ??
      listCanonEnemyArchetypes().find((archetype) => archetype.construct === spawn.construct) ??
      null
    );
  }
  return null;
}

function runtimeArchetype(id) {
  return getEnemyArchetype(id) ?? RUNTIME_ENEMY_ARCHETYPES[id] ?? null;
}

function listCanonEnemyArchetypes() {
  return listEnemyArchetypes();
}

function sandboxLaneOffset(spawn, index, count, rng) {
  const centeredIndex = index - (count - 1) / 2;
  const spread = spawn.spread ?? 0;
  const random = spawn.randomLaneOffset ? rng.range(-spawn.randomLaneOffset, spawn.randomLaneOffset) : 0;
  return (spawn.laneOffset ?? 0) + centeredIndex * spread + random;
}

function sandboxRoadY(spawn, road) {
  if (spawn.entry === 'behind') return road.halfHeight + 47.5;
  return -road.halfHeight - 47.5;
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
    const archetype = zoneArchetypeForMusic(currentMusic, kind, i);
    const world =
      kind === 'enhanced'
        ? roadOffsetToWorld({ x: spread, y: road.halfHeight + 47.5 + row }, road)
        : roadOffsetToWorld({ x: spread, y: -road.halfHeight - 47.5 - row }, road);
    const pirateShip = usesBoatSilhouetteEnemy(currentMusic, level);
    const enemy = archetype
      ? createEnemyForArchetype(archetype, world.x, world.y, kind)
      : kind === 'enhanced'
        ? pirateShip
          ? createEnhancedPirateShipEnemy(world.x, world.y)
          : createEnhancedEnemy(world.x, world.y)
        : pirateShip
          ? createPirateShipEnemy(world.x, world.y)
          : createEnemy(world.x, world.y);
    if (archetype) applyArchetypeRuntimeMetadata(enemy, archetype);
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
    applyEnemyLevelUpgrades(enemy, level);
    enemies.push(enemy);
  }
  if (isBoss) {
    const bossWorld = roadOffsetToWorld({ x: 0, y: -road.halfHeight - 90 }, road);
    const boss = createBossEnemy(bossWorld.x, bossWorld.y);
    boss.vx = roadDirectionToWorld(0, 1, road).x * 18;
    boss.vy = roadDirectionToWorld(0, 1, road).y * 18;
    applyEnemyLevelUpgrades(boss, level);
    enemies.push(boss);
  }
  return enemies;
}

function enemyLevelUpgradeCounts(level) {
  const counts = Object.fromEntries(ENEMY_UPGRADE_TYPES.map((type) => [type, 0]));
  const rng = new Rng(level * 1009 + 77);
  for (let round = 2; round <= level; round += 1) {
    const picks = new Set();
    while (picks.size < 2) picks.add(ENEMY_UPGRADE_TYPES[Math.floor(rng.range(0, ENEMY_UPGRADE_TYPES.length))]);
    for (const pick of picks) counts[pick] += 1;
  }
  return counts;
}

function applyEnemyLevelUpgrades(enemy, level) {
  const counts = enemyLevelUpgradeCounts(level);
  enemy.levelUpgrades = counts;
  enemy.combatScale = {
    damage: 1.05 ** counts.damage,
    attackRate: 1.05 ** counts.attackRate,
    armor: 1.05 ** counts.armor,
    movementSpeed: 1.05 ** counts.movementSpeed,
  };
  if (counts.armor > 0) scaleEnemyArmor(enemy, enemy.combatScale.armor);
  enemy.vx *= enemy.combatScale.movementSpeed;
  enemy.vy *= enemy.combatScale.movementSpeed;
}

function scaleEnemyArmor(enemy, scale) {
  for (const cell of enemy.cells) {
    for (const voxel of cell.mask.flat()) {
      if (voxel.hp <= 0 || voxel.maxHp <= 0) continue;
      voxel.maxHp *= scale;
      voxel.hp *= scale;
    }
    recalculateEnemyCell(cell);
  }
}

function zoneArchetypeForMusic(trackName, kind, index) {
  if (kind === 'enhanced') return null;
  const zone = zoneNameFromTrack(trackName);
  const ids = {
    GhostForrest: ['ghost_phaser.ghost_forrest'],
    GhostForrestPathway: ['ghost_phaser.ghost_forrest'],
    DigitizedStream: ['hopping_stream_mob.digitized_stream'],
    PiratesRoad: ['heavy_mortar_boat.pirates_road', 'mortar_skiff.prototype0'],
    StarlightRoad: ['starlight_walker.prototype0'],
    TwilightCrossroads: ['twilight_walker.prototype0'],
    ShadowedDesert: ['scrap_buzzard.shadowed_desert'],
    ShadowedDessert: ['scrap_buzzard.shadowed_desert'],
    FreedomsPass: ['inchworm_carrier.freedoms_pass'],
  }[zone];
  if (!ids?.length) return null;
  const id = ids[index % ids.length];
  return getEnemyArchetype(id) ?? RUNTIME_ENEMY_ARCHETYPES[id] ?? null;
}

function zoneNameFromTrack(trackName = '') {
  const match = String(trackName).match(/^([A-Za-z]+(?:[A-Z][a-z]+)*)(?:_|$)/);
  return match?.[1] ?? trackName;
}

function createEnemyForArchetype(archetype, x, y, kind) {
  const factory = archetype.runtimeFactory;
  if (factory === 'createMortarSkiffEnemy') return createMortarSkiffEnemy(x, y);
  if (factory === 'createPirateShipEnemy') return createPirateShipEnemy(x, y, { kind });
  if (factory === 'createEnhancedPirateShipEnemy') return createEnhancedPirateShipEnemy(x, y);
  if (factory === 'createEnhancedEnemy') return createEnhancedEnemy(x, y);
  return createEnemy(x, y);
}

function applyArchetypeRuntimeMetadata(enemy, archetype) {
  enemy.archetypeId = archetype.id;
  enemy.displayName = archetype.displayName;
  enemy.zone = archetype.zone;
  if (archetype.palette) enemy.palette = { ...archetype.palette };
  if (archetype.presentation) enemy.presentation = structuredClone(archetype.presentation);
  if (archetype.elevation) enemy.elevation = structuredClone(archetype.elevation);
  if (archetype.phase) enemy.phase = structuredClone(archetype.phase);
  if (archetype.targeting) enemy.targeting = structuredClone(archetype.targeting);
  if (archetype.artillery) enemy.artillery = structuredClone(archetype.artillery);
  if (archetype.id === 'hopping_stream_mob.digitized_stream') {
    enemy.hopperVisualBias = HOPPER_FROG_VISUAL_SCALE;
  }
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
  const magnetRange = VOXEL_SIZE * SHOP_COSTS.scrapMagnetVoxels * upgradeMultiplier(game, 'scrapMagnetDistance');
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
  const mode = input.targetingMode ?? game.targetingMode ?? 'mixed';
  if (mode === 'manual') {
    if (!input.aimWorld) {
      game.aimReticle = null;
      return { ...input, gunnerEnabled: false };
    }
    game.aimReticle = { ...input.aimWorld, active: true, source: input.aimSource ?? 'manual' };
    if ((input.secondarySelect ?? game.secondary.selected) === 'beam') return { ...input, gunnerEnabled: false, compensatedAim: true, aimProjectileSpeed: 1_000_000 };
    return { ...input, gunnerEnabled: false };
  }
  if (mode === 'guided') return guidedAimInput(game, input, dt);
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

function guidedAimInput(game, input, dt) {
  const target = guidedAimTarget(game);
  if (!target) {
    game.aimReticle = null;
    return { ...input, aimWorld: null, manualAimActive: false };
  }
  game.aiAimReticle = moveToward(game.aiAimReticle ?? { x: game.vehicle.x, y: game.vehicle.y }, target, 160 * dt);
  game.aimReticle = { ...game.aiAimReticle, active: true, source: 'ai' };
  return { ...input, aimWorld: game.aiAimReticle, manualAimActive: false, compensatedAim: game.secondary.selected !== 'beam' };
}

function guidedAimTarget(game) {
  const target = guidedTarget(game) ?? nearestTargetedEnemy(game);
  if (!target) return null;
  const beamSelected = game.secondary.selected === 'beam';
  const projectileSpeed = beamSelected ? 1_000_000 : PRIMARY_PROJECTILE_SPEED;
  const distance = Math.hypot(target.x - game.vehicle.x, target.y - game.vehicle.y);
  const leadTime = Math.min(beamSelected ? 0.05 : 0.75, distance / projectileSpeed);
  return { x: target.x + (target.vx ?? 0) * leadTime, y: target.y + (target.vy ?? 0) * leadTime };
}

function gunnerAimTarget(game) {
  const target = nearestTargetedEnemy(game);
  if (!target) return null;
  const beamSelected = game.secondary.selected === 'beam';
  const projectileSpeed = beamSelected ? 1_000_000 : PRIMARY_PROJECTILE_SPEED;
  const distance = Math.hypot(target.x - game.vehicle.x, target.y - game.vehicle.y);
  const leadTime = Math.min(beamSelected ? 0.05 : 0.75, distance / projectileSpeed);
  return { x: target.x + (target.vx ?? 0) * leadTime, y: target.y + (target.vy ?? 0) * leadTime };
}

function nearestTargetedEnemy(game) {
  return activeEnemies(game).reduce((nearest, enemy) => {
    if (!nearest) return enemy;
    return distanceSquared(game.vehicle, enemy) < distanceSquared(game.vehicle, nearest) ? enemy : nearest;
  }, null);
}

function cycleGuidedTarget(game, direction = 1) {
  const enemies = activeEnemies(game);
  if (enemies.length === 0) {
    game.guidedTargetId = null;
    return null;
  }
  const current = enemies.findIndex((enemy) => enemyTargetId(enemy) === game.guidedTargetId);
  const next = (current + Math.sign(direction || 1) + enemies.length) % enemies.length;
  game.guidedTargetId = enemyTargetId(enemies[next]);
  return enemies[next];
}

function guidedTarget(game) {
  const enemies = activeEnemies(game);
  if (enemies.length === 0) {
    game.guidedTargetId = null;
    return null;
  }
  let target = enemies.find((enemy) => enemyTargetId(enemy) === game.guidedTargetId);
  if (!target) target = cycleGuidedTarget(game, 1);
  return target;
}

function enemyTargetId(enemy) {
  enemy.targetId ??= `${enemy.assetId ?? enemy.kind ?? 'enemy'}:${Math.round(enemy.x * 100)}:${Math.round(enemy.y * 100)}`;
  return enemy.targetId;
}

function moveToward(from, to, maxDistance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance || distance <= 0.001) return { ...to };
  return { x: from.x + (dx / distance) * maxDistance, y: from.y + (dy / distance) * maxDistance };
}

function configureBoostFromUpgrades(game) {
  const engineScale = Math.sqrt(Math.max(1, typedModulePower(game.vehicle, 'engine')));
  const gunScale = Math.sqrt(Math.max(1, typedModulePower(game.vehicle, 'gun')));
  game.boost.maxFuel = 100 * upgradeMultiplier(game, 'boostCapacity') * engineScale;
  game.boost.cost = 51 * upgradeReduction(game, 'boostEfficiency');
  game.boost.rechargeRate = 16 * upgradeMultiplier(game, 'boostRecharge') * engineScale;
  game.boost.acceleration = 35 * upgradeMultiplier(game, 'boostAcceleration') * engineScale;
  game.boost.sustainAcceleration = 350 * upgradeMultiplier(game, 'boostAcceleration') * engineScale;
  game.boost.maxSpeed = 240 * upgradeMultiplier(game, 'boostAcceleration') * engineScale;
  game.boost.maxDuration = (5 / 60) * upgradeMultiplier(game, 'boostDuration') * engineScale;
  game.boost.shieldDuration = (5 / 60) * upgradeMultiplier(game, 'boostDuration') * gunScale;
  game.boost.shieldScale = gunScale;
  game.boost.cooldownDuration = (20 / 60) * upgradeReduction(game, 'boostCooldown');
}

function stepPlayerGun(game, dt) {
  game.primaryHeat ??= { heat: 0, maxHeat: 100 };
  game.primaryHeat.heat = Math.max(0, game.primaryHeat.heat - primaryHeatSinkRate(game) * dt);
  stepRepulsorRecharge(game, dt);
  game.playerFireTimer -= dt;
  if ((!game.autofire && !game.inputFireHeld) || game.playerFireTimer > 0 || game.gameOver || !hasFunctionalGun(game.vehicle)) return;
  const mounts = primaryFiringMounts(game);
  if (mounts.length === 0) return;
  const spread = (Math.PI / 18) * upgradeReduction(game, 'gunAccuracy');
  const damage = 8 * upgradeMultiplier(game, 'gunDamage');
  const speed = PRIMARY_PROJECTILE_SPEED * upgradeMultiplier(game, 'gunVelocity');
  const mount = mounts[game.playerGunIndex % mounts.length];
  game.playerGunIndex = (game.playerGunIndex + 1) % mounts.length;
  const muzzle = mount.muzzle;
  const angle = game.vehicle.turretHeading + (mount.weaponId === 'main.basic' ? game.rng.range(-spread, spread) : 0);
  if (mount.weaponId !== 'main.basic') {
    const def = upgradedPrimaryWeaponDefinition(game, mount.weaponId);
    if (!def || game.primaryHeat.heat + def.heat > game.primaryHeat.maxHeat) return;
    if (mount.weaponId === 'repulsor_beam' && !repulsorReadyForThreat(game, muzzle)) return;
    firePrimaryWeapon(game, muzzle, def);
    if (mount.weaponId === 'repulsor_beam') consumeRepulsorCharge(game);
    game.primaryHeat.heat += def.heat;
    game.playerFireTimer = primaryWeaponFireInterval(game, def, mounts.length) * primaryHeatCooldownScale(game.primaryHeat);
    return;
  }
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, Math.cos(angle) * speed + game.vehicle.vx, Math.sin(angle) * speed + game.vehicle.vy, {
      team: 'player',
      weapon: 'bullet',
      radius: 1.5,
      damage,
      impulse: 30,
      lifetime: 2.2,
      sourceCellId: muzzle.cellId,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_MAIN_GUN);
  game.playerFireTimer = playerGunFireInterval(game, mounts.length);
}

function firePrimaryWeapon(game, muzzle, def) {
  if (def.behavior === 'beam') {
    firePrimaryBeam(game, muzzle, def);
    return;
  }
  const targetHint = def.targetHint === 'aimReticle' && game.aimReticle ? { x: game.aimReticle.x, y: game.aimReticle.y } : null;
  const angle = targetHint ? Math.atan2(targetHint.y - muzzle.y, targetHint.x - muzzle.x) : game.vehicle.turretHeading;
  const launch = primaryProjectileLaunch(game, muzzle, def, targetHint, angle);
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, launch.vx, launch.vy, {
      team: 'player',
      weapon: def.id,
      behavior: def.behavior,
      angle: launch.angle,
      sourceCellId: muzzle.cellId,
      startX: muzzle.x,
      startY: muzzle.y,
      targetHint,
      detonateDistance: launch.detonateDistance,
      detonateAtTarget: def.detonateAtTarget,
      radius: def.radius,
      damage: def.damage,
      impulse: def.impulse,
      lifetime: def.lifetime,
      turnRate: def.behavior === 'homing' ? def.turnRate : 0,
      acceleration: def.behavior === 'homing' ? def.acceleration : 0,
      maxSpeed: def.behavior === 'homing' ? def.maxSpeed : Infinity,
      delayBeforeAcceleration: def.delayBeforeAcceleration ?? 0,
      stopBeforeAcceleration: def.stopBeforeAcceleration,
      accelerationDuration: def.accelerationDuration ?? Infinity,
      accelerationJitter: game.rng.range(-(def.accelerationSpreadRadians ?? 0), def.accelerationSpreadRadians ?? 0),
      launchWhenFacingTarget: def.launchWhenFacingTarget,
      verticalVelocity: def.verticalVelocity ?? 0,
      gravity: def.gravity ?? 0,
      maxArcHeight: def.maxArcHeight ?? 1,
      shadowRadius: def.shadowRadius ?? def.radius,
      blastDamage: def.blastDamage ?? 0,
      blastRadius: def.blastRadius ?? 0,
      blastKnockback: def.blastKnockback ?? 0,
      pierce: def.pierce ?? 0,
      pierceDamageScale: def.pierceDamageScale,
      pierceDamageFalloff: def.pierceDamageFalloff,
      damagePiercesUntilSpent: def.damagePiercesUntilSpent,
      emitsProjectiles: def.emitsProjectiles,
      detonationBurst: def.detonationBurst,
      forceMode: def.forceMode,
      affects: def.affects,
      sprite: def.sprite,
      landingMarkerSprite: def.landingMarkerSprite,
      zCollision: def.zCollision,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_MAIN_GUN);
}

function primaryProjectileLaunch(game, muzzle, def, targetHint, angle) {
  if (def.behavior === 'arc' && def.detonateAtTarget && targetHint) {
    const flightTime = arcFlightTime(def);
    if (flightTime > 0) {
      return {
        vx: (targetHint.x - muzzle.x) / flightTime,
        vy: (targetHint.y - muzzle.y) / flightTime,
        angle: Math.atan2(targetHint.y - muzzle.y, targetHint.x - muzzle.x),
        detonateDistance: null,
      };
    }
  }
  const launchAngle = def.launchAngleMode === 'orthogonal' ? orthogonalLaunchAngle(game, angle, def.launchAngleSpreadRadians ?? 0) : angle;
  return {
    vx: Math.cos(launchAngle) * def.projectileSpeed + game.vehicle.vx,
    vy: Math.sin(launchAngle) * def.projectileSpeed + game.vehicle.vy,
    angle: launchAngle,
    detonateDistance: def.detonateAtTarget && targetHint ? Math.hypot(targetHint.x - muzzle.x, targetHint.y - muzzle.y) : null,
  };
}

function orthogonalLaunchAngle(game, aimAngle, spreadRadians) {
  const side = game.rng.next() < 0.5 ? -1 : 1;
  return aimAngle + side * (Math.PI / 2) + game.rng.range(-spreadRadians, spreadRadians);
}

function arcFlightTime(def) {
  const gravity = def.gravity ?? 0;
  const verticalVelocity = def.verticalVelocity ?? 0;
  if (gravity <= 0 || verticalVelocity <= 0) return 0;
  return (2 * verticalVelocity) / gravity;
}

function firePrimaryBeam(game, muzzle, def) {
  const threat = def.id === 'repulsor_beam' ? nearestRepulsorThreat(game, muzzle) : null;
  const targetHint = def.targetHint === 'aimReticle' && game.aimReticle ? { x: game.aimReticle.x, y: game.aimReticle.y } : null;
  const angle = threat ? Math.atan2(threat.y - muzzle.y, threat.x - muzzle.x) : targetHint ? Math.atan2(targetHint.y - muzzle.y, targetHint.x - muzzle.x) : game.vehicle.turretHeading;
  game.playerProjectiles.push(
    createProjectile(muzzle.x, muzzle.y, 0, 0, {
      team: 'player',
      weapon: def.id,
      behavior: 'beam',
      angle,
      sourceCellId: muzzle.cellId,
      targetHint,
      length: def.length,
      radius: def.radius,
      damage: def.damage,
      impulse: def.impulse,
      pierce: def.pierce,
      color: def.color,
      alpha: def.alpha,
      forceMode: def.forceMode,
      affects: def.affects,
      sprite: def.sprite,
      frames: def.frames,
      lifetime: Math.max(1, def.frames) / 60,
      maxLifetime: Math.max(1, def.frames) / 60,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_MAIN_GUN);
}

function upgradedPrimaryWeaponDefinition(game, weaponId) {
  const base = PRIMARY_WEAPON_DEFINITIONS[weaponId] ? { ...PRIMARY_WEAPON_DEFINITIONS[weaponId], id: weaponId } : null;
  if (!base) return null;
  if (weaponId === 'mini_beam') {
    return {
      ...base,
      cooldown: base.cooldown / upgradeMultiplier(game, 'miniBeamFireRate'),
      heat: Math.max(1, base.heat * upgradeReduction(game, 'miniBeamHeatEfficiency')),
      damage: base.damage * upgradeMultiplier(game, 'miniBeamDamage'),
      length: base.length * upgradeMultiplier(game, 'miniBeamLength', 0.12),
      pierce: upgradeLevel(game, 'miniBeamPierce'),
    };
  }
  if (weaponId === 'repulsor_beam') {
    return {
      ...base,
      radius: base.radius * 3,
      impulse: base.impulse * 0.125 * upgradeMultiplier(game, 'repulsorKnockback'),
      color: '#5cff9a',
      alpha: 0.5,
      targetHint: null,
      cooldown: 0.72 / upgradeMultiplier(game, 'repulsorFireRate'),
    };
  }
  if (weaponId === 'mortar') {
    return {
      ...base,
      damage: base.damage * upgradeMultiplier(game, 'mortarImpactDamage'),
      blastDamage: base.blastDamage * upgradeMultiplier(game, 'mortarBlastDamage'),
      blastRadius: base.blastRadius * upgradeMultiplier(game, 'mortarBlastRadius'),
    };
  }
  if (weaponId === 'tracking_flechette') {
    return {
      ...base,
      cooldown: base.cooldown / upgradeMultiplier(game, 'trackingFlechetteFireRate'),
      damage: base.damage * upgradeMultiplier(game, 'trackingFlechetteImpactDamage'),
      pierce: base.pierce + upgradeLevel(game, 'trackingFlechettePierce'),
      acceleration: base.acceleration * upgradeMultiplier(game, 'trackingFlechetteAcceleration'),
      turnRate: base.turnRate * upgradeMultiplier(game, 'trackingFlechetteTurningRate'),
    };
  }
  return base;
}

function primaryFiringMounts(game) {
  const muzzles = gunMuzzlesWorld(game.vehicle);
  if (muzzles.length === 0) return [];
  const definition = game.vehicleDefinition?.cells ? game.vehicleDefinition : { cells: game.vehicle.cells.map((cell) => ({ id: cell.id, type: cell.type })) };
  const loadouts = new Map(normalizeGunLoadouts(definition).map((loadout) => [loadout.cellId, loadout]));
  return muzzles.flatMap((muzzle) => {
    const weapons = (loadouts.get(muzzle.cellId)?.primary ?? ['main.basic']).filter(Boolean);
    return (weapons.length ? weapons : ['main.basic']).map((weaponId) => ({ muzzle, weaponId }));
  });
}

function playerGunFireInterval(game, activeMounts = primaryFiringMounts(game).length) {
  return 0.22 / (upgradeMultiplier(game, 'gunFireRate') * Math.sqrt(Math.max(1, activeMounts + 1)));
}

function primaryWeaponFireInterval(game, def, activeMounts) {
  return def.cooldown / Math.sqrt(Math.max(1, activeMounts + 1));
}

function primaryHeatSinkRate(game) {
  return 22 * upgradeMultiplier(game, 'miniBeamHeatSink', 0.1);
}

function primaryHeatCooldownScale(primaryHeat) {
  return 1 / Math.max(0.08, 1 - primaryHeat.heat / primaryHeat.maxHeat);
}

function stepRepulsorRecharge(game, dt) {
  game.repulsor ??= { charges: 5, maxCharges: 5, rechargeTimer: 0, cooldown: 4.5 };
  if (game.repulsor.charges > 0) return;
  game.repulsor.rechargeTimer -= dt;
  if (game.repulsor.rechargeTimer > 0) return;
  game.repulsor.charges = game.repulsor.maxCharges;
}

function repulsorReadyForThreat(game, muzzle) {
  game.repulsor ??= { charges: 5, maxCharges: 5, rechargeTimer: 0, cooldown: 4.5 };
  if (game.repulsor.charges <= 0) return false;
  return Boolean(nearestRepulsorThreat(game, muzzle));
}

function nearestRepulsorThreat(game, muzzle) {
  const range = CELL_SIZE * 18;
  let best = null;
  let bestDistance = Infinity;
  for (const enemy of activeEnemies(game)) {
    const distance = distanceSquared(enemy, muzzle);
    if (distance > (enemy.radius + range) ** 2 || distance >= bestDistance) continue;
    best = enemy;
    bestDistance = distance;
  }
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0 || projectile.behavior === 'beam' || projectile.behavior === 'blast') continue;
    const distance = distanceSquared(projectile, muzzle);
    if (distance > (projectile.radius + range) ** 2 || distance >= bestDistance) continue;
    best = projectile;
    bestDistance = distance;
  }
  return best;
}

function consumeRepulsorCharge(game) {
  game.repulsor.charges -= 1;
  if (game.repulsor.charges <= 0) game.repulsor.rechargeTimer = game.repulsor.cooldown;
}

function stepEnemies(game, dt) {
  for (const enemy of game.enemies) stepEnemy(game, enemy, dt);
}

function stepEnemy(game, enemy, dt) {
  if (enemy.destroyed) return;
  if ((enemy.dizzyTimer ?? 0) > 0) {
    stepDizzyEnemy(enemy, dt);
    return;
  }
  steerEnemyBackToLaneCenter(enemy, game.road, dt);
  stepArchetypeEnemy(game, enemy, dt);
  if (enemy.kind === 'enhanced') stepEnhancedEnemy(game, enemy, dt);
  if (enemy.kind === 'boss') stepBossEnemy(game, enemy, dt);
  if (enemy.destroyed) return;
  stepEnemyPatterns(game, enemy, dt);
  updateEnemyVisualHeading(enemy, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.vx *= Math.pow(0.78, dt);
  enemy.vy *= Math.pow(0.78, dt);
}

function stepArchetypeEnemy(game, enemy, dt) {
  if (enemy.archetypeId === 'ghost_phaser.ghost_forrest') stepGhostPhaser(game, enemy, dt);
  if (enemy.archetypeId === 'hopping_stream_mob.digitized_stream') stepHopperFrog(game, enemy, dt);
  if (enemy.archetypeId === 'heavy_mortar_boat.pirates_road') stepMortarBoat(game, enemy, dt);
  if (enemy.archetypeId === 'mortar_skiff.prototype0') stepMortarSkiff(game, enemy, dt);
  if (enemy.archetypeId === 'starlight_walker.prototype0' || enemy.archetypeId === 'twilight_walker.prototype0') stepWalkerEnemy(game, enemy, dt);
  if (enemy.archetypeId === 'scrap_buzzard.shadowed_desert') stepScrapBuzzard(game, enemy, dt);
  if (enemy.archetypeId === 'inchworm_carrier.freedoms_pass') stepInchwormCarrier(game, enemy, dt);
}

function stepDizzyEnemy(enemy, dt) {
  enemy.dizzyTimer = Math.max(0, (enemy.dizzyTimer ?? 0) - dt);
  enemy.vx *= Math.pow(0.03, dt);
  enemy.vy *= Math.pow(0.03, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

function applyRoadTurnDizziness(game, turnAngle = 0) {
  if (Math.abs(turnAngle) <= 0.0001) return;
  for (const enemy of activeEnemies(game)) {
    if (enemy.archetypeId !== 'mortar_skiff.prototype0') continue;
    enemy.dizzyTimer = game.rng.range(2.4, 3.6);
    enemy.dizzyPhase = game.rng.range(0, Math.PI * 2);
    enemy.artilleryTimer = Math.max(enemy.artilleryTimer ?? 0, enemy.dizzyTimer);
  }
}

function stepGhostPhaser(game, enemy, dt) {
  if (enemy.phantomOverload) {
    stepPhantomOverload(game, enemy, dt);
    return;
  }
  if (enemyFireTimerScale(enemy) <= 0) {
    startPhantomOverload(enemy);
    stepPhantomOverload(game, enemy, dt);
    return;
  }
  enemy.phaseTimer = (enemy.phaseTimer ?? 2.5) - dt;
  if (enemy.phaseTimer <= 0) {
    enemy.phasedOut = !enemy.phasedOut;
    enemy.phaseTimer = enemy.phasedOut ? game.rng.range(2.4, 4.6) : game.rng.range(1.1, 1.8);
    if (enemy.phasedOut) {
      const offset = { x: game.rng.range(-game.road.halfWidth * 0.55, game.road.halfWidth * 0.55), y: game.rng.range(-game.road.halfHeight * 0.35, game.road.halfHeight * 0.25) };
      const world = roadOffsetToWorld(offset, game.road);
      enemy.x = world.x;
      enemy.y = world.y;
    }
  }
  enemy.renderAlpha = enemy.phasedOut ? 0.24 : 0.88;
}

function startPhantomOverload(enemy) {
  enemy.phantomOverload = {
    timer: PHANTOM_OVERLOAD_DURATION,
    duration: PHANTOM_OVERLOAD_DURATION,
  };
  enemy.phasedOut = false;
  enemy.phaseTimer = Infinity;
  enemy.renderAlpha = 1;
}

function stepPhantomOverload(game, enemy, dt) {
  const overload = enemy.phantomOverload;
  overload.timer -= dt;
  enemy.phasedOut = false;
  enemy.phaseTimer = Infinity;
  const progress = 1 - clamp(overload.timer / Math.max(0.001, overload.duration), 0, 1);
  const flash = Math.sin(game.time * (9 + progress * 24)) * 0.5 + 0.5;
  enemy.renderAlpha = 0.62 + flash * 0.38;

  const direction = directionFromTo(enemy, game.vehicle);
  const desiredSpeed = PHANTOM_OVERLOAD_SPEED * enemyMovementUpgradeScale(enemy);
  const steer = clamp((4.8 + progress * 5.4) * dt, 0, 1);
  enemy.vx += (direction.x * desiredSpeed - enemy.vx) * steer;
  enemy.vy += (direction.y * desiredSpeed - enemy.vy) * steer;

  const contactRange = enemy.radius + CELL_SIZE * 2.4;
  if (overload.timer <= 0 || distanceSquared(enemy, game.vehicle) <= contactRange * contactRange) {
    detonatePhantomOverload(game, enemy);
  }
}

function stepHopperFrog(game, enemy, dt) {
  enemy.hopTimer = (enemy.hopTimer ?? game.rng.range(0.5, 1.2)) - dt;
  enemy.elevation ??= { z: 0, arcCollision: true, canBeHitByGroundFire: true };
  enemy.elevation.z = Math.max(0, Math.sin(Math.max(0, enemy.hopTimer) * Math.PI * 2) * 18);
  if (enemy.hopTimer > 0) return;
  const direction = directionFromTo(enemy, game.vehicle);
  enemy.vx += direction.x * HOPPER_FROG_HOP_IMPULSE * enemyMovementUpgradeScale(enemy);
  enemy.vy += direction.y * HOPPER_FROG_HOP_IMPULSE * enemyMovementUpgradeScale(enemy);
  enemy.hopTimer = game.rng.range(0.65, 1.25);
  fireShortEnemyBeam(game, enemy, '#f26cff', 0.65);
}

function stepMortarBoat(game, enemy, dt) {
  enemy.artilleryTimer = (enemy.artilleryTimer ?? game.rng.range(1.2, 2.4)) - dt * enemyAttackRateUpgradeScale(enemy);
  if (enemy.artilleryTimer > 0) return;
  enemy.artilleryTimer = game.rng.range(4.8, 7.2);
  fireEnemyMortarLine(game, enemy, 7);
}

function stepMortarSkiff(game, enemy, dt) {
  enemy.roamTimer = (enemy.roamTimer ?? 0) - dt;
  if (!enemy.roamTarget || enemy.roamTimer <= 0 || distanceSquared(enemy, enemy.roamTarget) < CELL_SIZE * 1.6) {
    const targetOffset = {
      x: game.rng.range(-game.road.halfWidth * 0.62, game.road.halfWidth * 0.62),
      y: game.rng.range(-game.road.halfHeight * 0.42, game.road.halfHeight * 0.42),
    };
    enemy.roamTarget = roadOffsetToWorld(targetOffset, game.road);
    enemy.roamTimer = game.rng.range(2.2, 4.2);
  }
  const direction = directionFromTo(enemy, enemy.roamTarget);
  const desiredSpeed = 44 * enemyMovementUpgradeScale(enemy);
  const steer = clamp(3.4 * dt, 0, 1);
  enemy.vx += (direction.x * desiredSpeed - enemy.vx) * steer;
  enemy.vy += (direction.y * desiredSpeed - enemy.vy) * steer;

  enemy.artilleryTimer = (enemy.artilleryTimer ?? game.rng.range(1.4, 2.6)) - dt * enemyAttackRateUpgradeScale(enemy);
  if (enemy.artilleryTimer > 0) return;
  enemy.artilleryTimer = game.rng.range(2.8, 4.4);
  const target = inaccuratePlayerMortarTarget(game, CELL_SIZE * 7.5);
  fireEnemyArcShell(game, enemy, target, '#ff5a54');
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function inaccuratePlayerMortarTarget(game, radius) {
  const angle = game.rng.range(0, Math.PI * 2);
  const distance = radius * Math.sqrt(game.rng.next());
  return {
    x: game.vehicle.x + game.vehicle.vx * 0.42 + Math.cos(angle) * distance,
    y: game.vehicle.y + game.vehicle.vy * 0.42 + Math.sin(angle) * distance,
  };
}

function stepWalkerEnemy(game, enemy, dt) {
  enemy.elevation ??= { z: enemy.archetypeId === 'twilight_walker.prototype0' ? 64 : 52, canBeHitByGroundFire: false, arcCollision: true };
  enemy.walkPhase = (enemy.walkPhase ?? 0) + dt * 4.4 * enemyMovementUpgradeScale(enemy);
  enemy.vx += Math.sin(enemy.walkPhase) * 6 * dt;
}

function stepScrapBuzzard(game, enemy, dt) {
  enemy.elevation ??= { z: 110, canBeHitByGroundFire: false, arcCollision: true };
  enemy.renderAlpha = 0.92;
  enemy.buzzardTimer = (enemy.buzzardTimer ?? game.rng.range(0.8, 1.8)) - dt * enemyAttackRateUpgradeScale(enemy);
  if (enemy.buzzardTimer <= 0) {
    enemy.buzzardTimer = game.rng.range(1.4, 2.2);
    fireEnemyArcShell(game, enemy, { x: enemy.x - enemy.vx * 0.55, y: enemy.y - enemy.vy * 0.55 }, '#d6cfb9');
  }
  const offset = worldToRoadOffset(enemy, game.road);
  if (Math.abs(offset.x) > game.road.halfWidth * 0.62) enemy.vx *= -0.75;
}

function stepInchwormCarrier(game, enemy, dt) {
  enemy.wormPhase = (enemy.wormPhase ?? 0) + dt * 2.8;
  enemy.vx += Math.sin(enemy.wormPhase) * 12 * dt * enemyMovementUpgradeScale(enemy);
  enemy.spawnTimer = (enemy.spawnTimer ?? game.rng.range(2.2, 4.4)) - dt;
  if (enemy.spawnTimer > 0) return;
  enemy.spawnTimer = game.rng.range(5.5, 8.5);
  const moth = createEnemy(enemy.x + game.rng.range(-CELL_SIZE, CELL_SIZE), enemy.y + CELL_SIZE * 1.4);
  moth.archetypeId = 'moth_bomber.freedoms_pass';
  moth.displayName = 'Freedoms Pass Moth Bomber';
  moth.palette = { core: '#f4eee4', armor: '#b9d990', gun: '#ff7a1a' };
  moth.elevation = { z: 35, canBeHitByGroundFire: true, arcCollision: true };
  moth.radius *= 0.7;
  const direction = directionFromTo(moth, game.vehicle);
  moth.vx = direction.x * 170 * enemyMovementUpgradeScale(enemy);
  moth.vy = direction.y * 170 * enemyMovementUpgradeScale(enemy);
  applyEnemyLevelUpgrades(moth, game.level);
  game.enemies.push(moth);
}

function updateEnemyVisualHeading(enemy, dt) {
  if (enemy.kind === 'boss' || enemy.silhouette !== 'pirateShip') return;
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed <= 8) return;
  const target = Math.atan2(enemy.vy, enemy.vx);
  enemy.visualHeading = turnTowardAngle(enemy.visualHeading ?? target, target, 5.8 * dt);
}

function stepEnhancedEnemy(game, enemy, dt) {
  const engineScale = enemyMobilityScale(enemy);
  const charge = enemy.charge ?? { state: 'idle', timer: 1.8, x: 0, y: 1 };
  enemy.charge = charge;
  charge.timer -= dt;
  enemy.shieldActive = charge.state === 'charging';
  if (charge.state === 'charging') {
    enemy.vx += charge.x * 82.5 * engineScale * enemyMovementUpgradeScale(enemy) * dt;
    enemy.vy += charge.y * 82.5 * engineScale * enemyMovementUpgradeScale(enemy) * dt;
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
  boss.centerPulseTimer -= dt * enemyCoreTimerScale(boss);
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
  const desiredSpeed = clamp(worldDistance * 3.1, 40, 310) * enemyMovementUpgradeScale(boss);
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
    fireBossNoduleShots(game, boss, arm, dt);
    if (stepBossLaser(game, boss, arm, dt)) continue;
    arm.fireTimer = (arm.fireTimer ?? game.rng.range(0.2, 1.5)) - dt * bossArmGunTimerScale(boss, arm);
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
      damage: 7.5 * enemyDamageUpgradeScale(boss),
      impulse: 80,
      lifetime: 15 / 60,
      length: 380,
      frames: 15,
      angle,
      color: '#ff2626',
      sourceEnemy: boss,
      sourceCellId: source.cellId,
      sourceOffset: { x: source.localX, y: source.localY },
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
    createProjectile(source.x, source.y, Math.cos(angle) * 112 * enemyMovementUpgradeScale(source.enemy ?? {}), Math.sin(angle) * 112 * enemyMovementUpgradeScale(source.enemy ?? {}), {
      team: 'enemy',
      weapon: 'boss-tentacle',
      radius: 2.2,
      damage: 10 * enemyDamageUpgradeScale(source.enemy ?? {}),
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
      damage: 9 * enemyDamageUpgradeScale(source.enemy ?? {}),
      impulse: 62.5,
      lifetime: 6.5,
      angle,
      delayBeforeAcceleration: game.rng.range(1.4, 2.6),
      stopBeforeAcceleration: true,
      acceleration: 225 * enemyMovementUpgradeScale(source.enemy ?? {}),
      accelerationDuration: 3,
      accelerationTarget: game.vehicle,
      accelerationJitter: game.rng.range(-0.04, 0.04),
      maxSpeed: 412.5 * enemyMovementUpgradeScale(source.enemy ?? {}),
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
      radius: 3.2,
      damage: 7 * enemyDamageUpgradeScale(source.enemy ?? {}),
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
  return {
    x: boss.x + liveGun.gridX * CELL_SIZE,
    y: boss.y + liveGun.gridY * CELL_SIZE,
      cellId: liveGun.id,
      localX: liveGun.gridX * CELL_SIZE,
      localY: liveGun.gridY * CELL_SIZE,
      enemy: boss,
  };
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
          radius: 1.4,
        damage: 5 * enemyDamageUpgradeScale(boss),
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
        radius: 3,
        damage: 9 * enemyDamageUpgradeScale(boss),
        impulse: 57.5,
        lifetime: 7,
        angle,
        delayBeforeAcceleration: 3,
        stopBeforeAcceleration: true,
        acceleration: 202.5 * enemyMovementUpgradeScale(boss),
        accelerationDuration: 10,
        accelerationTarget: game.vehicle,
        accelerationJitter: 0,
        maxSpeed: 840 * enemyMovementUpgradeScale(boss),
        vanishOffscreen: true,
      }),
    );
  }
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireShortEnemyBeam(game, enemy, color = '#83f7ff', damageScale = 1) {
  const source = { x: enemy.x, y: enemy.y };
  const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, 0, 0, {
      team: 'enemy',
      weapon: 'enemy-short-beam',
      behavior: 'beam',
      radius: 0.75,
      damage: 2.5 * damageScale * enemyDamageUpgradeScale(enemy),
      impulse: 35,
      lifetime: 6 / 60,
      length: CELL_SIZE * 7.5,
      frames: 6,
      angle,
      color,
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BEAM);
}

function fireEnemyMortarLine(game, enemy, count = 7) {
  const target = {
    x: game.vehicle.x + game.vehicle.vx * 0.35,
    y: game.vehicle.y + game.vehicle.vy * 0.35,
  };
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 1 : (index + 1) / count;
    points.push({
      x: enemy.x + (target.x - enemy.x) * t + game.rng.range(-CELL_SIZE * 0.35, CELL_SIZE * 0.35),
      y: enemy.y + (target.y - enemy.y) * t + game.rng.range(-CELL_SIZE * 0.35, CELL_SIZE * 0.35),
    });
  }
  points
    .sort((a, b) => distanceSquared(enemy, a) - distanceSquared(enemy, b))
    .forEach((point, index) => {
      const flightTime = ENEMY_MORTAR_LINE_FIRST_IMPACT_SECONDS + index * ENEMY_MORTAR_LINE_IMPACT_SPACING_SECONDS;
      fireEnemyArcShell(game, enemy, point, '#ffb25f', { flightTime });
    });
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireEnemyArcShell(game, enemy, target, color = '#ffb25f', options = {}) {
  const gravity = options.gravity ?? 92;
  const flightTime = Math.max(0.001, options.flightTime ?? (2 * (options.verticalVelocity ?? 118)) / gravity);
  const horizontalScale = enemyMovementUpgradeScale(enemy);
  const vx = ((target.x - enemy.x) / flightTime) * horizontalScale;
  const vy = ((target.y - enemy.y) / flightTime) * horizontalScale;
  const verticalVelocity = options.verticalVelocity ?? (gravity * flightTime) / 2;
  const shell = createProjectile(enemy.x, enemy.y, vx, vy, {
    team: 'enemy',
    weapon: 'enemy-mortar',
    behavior: 'arc',
    radius: 3.2,
    color,
    sprite: MORTAR_ENEMY_SHELL_SPRITE,
    landingMarkerSprite: MORTAR_ENEMY_MARKER_SPRITE,
    damage: 8 * enemyDamageUpgradeScale(enemy),
    impulse: 80,
    lifetime: flightTime + 0.35,
    verticalVelocity,
    gravity,
    maxArcHeight: 110,
    shadowRadius: 4,
    targetHint: { x: target.x, y: target.y },
    detonateAtTarget: true,
    arcFlightTime: flightTime,
    blastOnExpire: {
      radius: CELL_SIZE * 2.55,
      damage: 4.5 * enemyDamageUpgradeScale(enemy),
      impulse: 34,
    },
  });
  game.enemyProjectiles.push(shell);
}

function stepEnemyPatterns(game, enemy, dt) {
  if (enemy.phantomOverload) return;
  const fireScale = enemyFireTimerScale(enemy);
  if (fireScale <= 0) return;
  for (const patternState of enemy.patterns ?? []) {
    patternState.timer -= dt * fireScale;
    if (patternState.timer > 0) continue;
    const projectiles = firePattern(patternState, enemy, game.vehicle, game.rng).map((projectile) => scaleEnemyProjectile(enemy, projectile));
    game.enemyProjectiles.push(...projectiles);
    if (projectiles.length > 0) {
      enemy.lastFiredAt = game.time;
      enemy.attackHeading = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
      emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
    }
    patternState.timer = nextPatternTimer(patternState);
  }
}

function fireBossNoduleShots(game, boss, arm, dt) {
  const fireScale = bossArmGunTimerScale(boss, arm);
  if (fireScale <= 0) return;
  const chancePerSecond = 0.18 * fireScale;
  for (const gun of boss.cells.filter((cell) => cell.id.startsWith(`arm-${arm.index}-`) && cell.type === 'gun' && !cell.state.destroyed)) {
    if (!game.rng.chance(chancePerSecond * dt)) continue;
    const source = { x: boss.x + gun.gridX * CELL_SIZE, y: boss.y + gun.gridY * CELL_SIZE };
    const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x) + game.rng.range(-0.08, 0.08);
    game.enemyProjectiles.push(
      createProjectile(source.x, source.y, Math.cos(angle) * 112, Math.sin(angle) * 112, {
        team: 'enemy',
        weapon: 'boss-nodule',
        radius: 2.2,
        damage: 8 * enemyDamageUpgradeScale(boss),
        impulse: 55,
        lifetime: 3.2,
        angle,
      }),
    );
    emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
  }
}

function enemyFireTimerScale(enemy) {
  const gun = enemyGunEfficiency(enemy);
  if (gun <= 0.05) return 0;
  return clamp(0.18 + gun * 0.82, 0, 1) * enemyAttackRateUpgradeScale(enemy);
}

function enemyMobilityScale(enemy) {
  const engine = enemyEngineEfficiency(enemy);
  return clamp(0.25 + engine * 0.75, 0.25, 1) * enemyMovementUpgradeScale(enemy);
}

function enemyCoreTimerScale(enemy) {
  const core = enemyCoreEfficiency(enemy);
  return clamp(0.3 + core * 0.7, 0.3, 1) * enemyAttackRateUpgradeScale(enemy);
}

function bossArmGunTimerScale(boss, arm) {
  const cells = boss.cells.filter((cell) => cell.id.startsWith(`arm-${arm.index}-`) && cell.type === 'gun');
  if (cells.length === 0) return 0;
  const integrity = cells.reduce((sum, cell) => sum + Math.min(cell.state.deviceIntegrity, cell.state.wiringIntegrity, cell.state.structureIntegrity), 0) / cells.length;
  if (integrity <= 0.05) return 0;
  return clamp(0.18 + integrity * 0.82, 0, 1) * enemyAttackRateUpgradeScale(boss);
}

function scaleEnemyProjectile(enemy, projectile) {
  projectile.damage *= enemyDamageUpgradeScale(enemy);
  projectile.impulse *= enemyDamageUpgradeScale(enemy);
  projectile.vx *= enemyMovementUpgradeScale(enemy);
  projectile.vy *= enemyMovementUpgradeScale(enemy);
  projectile.maxSpeed *= enemyMovementUpgradeScale(enemy);
  projectile.acceleration *= enemyMovementUpgradeScale(enemy);
  if (projectile.blastOnExpire) {
    projectile.blastOnExpire = {
      ...projectile.blastOnExpire,
      damage: projectile.blastOnExpire.damage * enemyDamageUpgradeScale(enemy),
      impulse: (projectile.blastOnExpire.impulse ?? 0) * enemyDamageUpgradeScale(enemy),
    };
  }
  return projectile;
}

function enemyDamageUpgradeScale(enemy) {
  return enemy.combatScale?.damage ?? 1;
}

function enemyAttackRateUpgradeScale(enemy) {
  return enemy.combatScale?.attackRate ?? 1;
}

function enemyMovementUpgradeScale(enemy) {
  return enemy.combatScale?.movementSpeed ?? 1;
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
  const shieldScale = game.boost.shieldScale ?? 1;
  const enemyImpulse = 90 * upgradeMultiplier(game, 'boostShielding') * shieldScale;
  const projectileImpulse = 180 * upgradeMultiplier(game, 'boostShielding') * shieldScale;
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
  return CELL_SIZE * 3.8 * upgradeMultiplier(game, 'boostShielding') * Math.sqrt(game.boost.shieldScale ?? 1);
}

function handleCollisions(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0) continue;
    if (projectile.behavior === 'arc' && !projectile.arcLanded) continue;
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
    if (projectile.readyToExplode) {
      projectile.lifetime = 0;
      projectile.readyToExplode = false;
      detonatePlayerProjectile(game, projectile);
      continue;
    }
    if (projectile.lifetime <= 0) continue;
    if (projectile.behavior === 'arc' && !projectile.arcLanded) continue;
    if (projectile.behavior === 'beam') {
      hitEnemiesWithBeam(game, projectile);
      continue;
    }
    if (projectile.behavior === 'blast') continue;
    if (playerProjectileAbsorbedByEnemyProjectile(game, projectile)) {
      projectile.lifetime = 0;
      continue;
    }
    playerProjectileAbsorbsEnemyProjectile(game, projectile);
    if (projectile.lifetime <= 0) continue;
    if (projectileReachedDetonationTarget(projectile)) {
      projectile.lifetime = 0;
      detonatePlayerProjectile(game, projectile);
      continue;
    }
    if (projectile.behavior === 'arc' && projectile.arcLanded) {
      projectile.lifetime = 0;
      detonatePlayerProjectile(game, projectile);
      continue;
    }
    if (projectile.damagePiercesUntilSpent) {
      hitEnemiesWithDamageBudgetProjectile(game, projectile);
      continue;
    }
    for (const enemy of activeEnemies(game)) {
      if (!enemyCanBeHitByProjectile(enemy, projectile)) continue;
      if (!projectileIntersectsPoint(projectile, enemy, enemy.radius + projectile.radius)) continue;
      if (enemyShieldBlocks(enemy, projectile)) {
        projectile.lifetime = 0;
        break;
      }
      const hit = applyEnemyDamage(enemy, projectile);
      if (hit.hit) {
        game.score.damageDone += Math.round(projectile.damage + hit.removed * 3);
        const pierce = applyEnemyProjectilePierceDamage(activeEnemies(game), projectile);
        if (pierce.hit) {
          game.score.damageDone += Math.round(projectile.damage * 0.35 + pierce.removed * 3);
          for (const piercedEnemy of pierce.destroyedEnemies) explodeEnemy(game, piercedEnemy);
        }
        projectile.lifetime = 0;
        enemy.vx += projectile.vx * 0.004;
        enemy.vy += projectile.vy * 0.004;
        if (hit.destroyedNow) explodeEnemy(game, enemy);
        detonatePlayerProjectile(game, projectile, enemy);
        break;
      }
    }
  }
  game.playerProjectiles = game.playerProjectiles.filter((projectile) => !projectile.detonated);
}

function enemyCanBeHitByProjectile(enemy, projectile) {
  if (enemy.phasedOut && projectile.behavior !== 'arc') return false;
  if (enemy.elevation?.canBeHitByGroundFire === false && projectile.behavior !== 'arc') return false;
  return true;
}

function hitEnemiesWithDamageBudgetProjectile(game, projectile) {
  const travel = Math.hypot(projectile.x - projectile.previousX, projectile.y - projectile.previousY);
  const pierce = applyEnemyProjectilePierceDamage(
    activeEnemies(game).filter((enemy) => enemyCanBeHitByProjectile(enemy, projectile)),
    projectile,
    {
      start: { x: projectile.previousX, y: projectile.previousY },
      maxLength: Math.max(VOXEL_SIZE, travel + (projectile.radius ?? 0) * 2),
      maxHits: 48,
      halfWidth: Math.max(projectile.radius ?? 0, VOXEL_SIZE),
      damageScale: 1,
    },
  );
  if (!pierce.hit) return false;
  game.score.damageDone += Math.round((pierce.damage ?? projectile.damage) + pierce.removed * 3);
  for (const piercedEnemy of pierce.destroyedEnemies) explodeEnemy(game, piercedEnemy);
  projectile.damage = pierce.remainingDamage ?? 0;
  if (projectile.damage <= 0.05) projectile.lifetime = 0;
  return true;
}

function detonatePlayerProjectile(game, projectile, enemy) {
  if (projectile.detonated) return;
  projectile.detonated = true;
  projectile.lifetime = 0;
  projectile.readyToExplode = false;
  projectile.vx = 0;
  projectile.vy = 0;
  if (projectile.detonationBurst) spawnPlayerDetonationBurst(game, projectile);
  if (projectile.weapon === 'cannon') spawnCannonImpact(game, projectile, enemy);
  if (projectile.weapon === 'rocket') spawnRocketImpact(game, projectile, enemy);
  if (projectile.weapon !== 'cannon' && projectile.weapon !== 'rocket' && (projectile.blastRadius ?? 0) > 0) spawnGenericPlayerBlast(game, projectile);
}

function spawnPlayerDetonationBurst(game, projectile) {
  const burst = projectile.detonationBurst;
  const groups = Array.isArray(burst.groups) ? burst.groups : [burst];
  for (const group of groups) {
    const count = Math.max(0, Math.floor(group.count ?? 0));
    if (count <= 0) continue;
    const angleOffset = group.angleOffset ?? 0;
    const jitter = group.angleJitter ?? 0;
    for (let index = 0; index < count; index += 1) {
      const angle = projectile.angle + angleOffset + (Math.PI * 2 * index) / count + (jitter > 0 ? game.rng.range(-jitter, jitter) : 0);
      const speed = group.projectileSpeed ?? group.speed ?? 180;
      game.playerProjectiles.push(
        createProjectile(projectile.x, projectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
          team: 'player',
          weapon: group.weapon ?? 'detonation-burst',
          radius: group.radius ?? 1,
          damage: group.damage ?? projectile.damage,
          color: group.color,
          impulse: group.impulse ?? projectile.impulse * 0.35,
          lifetime: group.lifetime ?? 0.9,
          angle,
          pierce: group.pierce ?? 0,
          pierceDamageScale: group.pierceDamageScale ?? 0.85,
          pierceDamageFalloff: group.pierceDamageFalloff ?? 0.72,
          damagePiercesUntilSpent: group.damagePiercesUntilSpent,
          absorbsEnemyProjectiles: group.absorbsEnemyProjectiles,
          sprite: group.sprite,
        }),
      );
    }
  }
}

function spawnGenericPlayerBlast(game, projectile) {
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_EXPLOSION);
  game.playerProjectiles.push(
    createProjectile(projectile.x, projectile.y, 0, 0, {
      team: 'player',
      weapon: `${projectile.weapon}-blast`,
      behavior: 'blast',
      radius: 1,
      maxRadius: projectile.blastRadius,
      damage: 0,
      impulse: 0,
      lifetime: 0.22,
    }),
  );

  for (const blastTarget of activeEnemies(game)) {
    const distance = Math.hypot(blastTarget.x - projectile.x, blastTarget.y - projectile.y);
    if (distance > projectile.blastRadius + blastTarget.radius) continue;
    const hit = applyEnemyBlastDamage(blastTarget, projectile, {
      maxVoxelDistance: Math.max(1, projectile.blastRadius / VOXEL_SIZE),
      closeVoxelDistance: 5,
      closePenetration: 3,
      farPenetration: 1,
      damage: projectile.blastDamage || projectile.damage,
    });
    if (hit.hit) {
      game.score.damageDone += Math.round((projectile.blastDamage || projectile.damage) * 0.22 + hit.removed * 3);
      if (hit.destroyedNow) explodeEnemy(game, blastTarget);
    }
    knockEnemyFromPoint(blastTarget, projectile, projectile.blastRadius + CELL_SIZE, projectile.blastKnockback ?? projectile.impulse ?? 0);
  }
}

function stepPlayerProjectileEmitters(game, dt) {
  const spawned = [];
  for (const projectile of game.playerProjectiles) {
    const emitter = projectile.emitsProjectiles;
    if (!emitter || projectile.lifetime <= 0) continue;
    projectile.emitTimer -= dt;
    const interval = Math.max(0.001, emitter.interval ?? 0.1);
    const continuous = emitter.continuous === true;
    let guard = 0;
    while (projectile.emitTimer <= 0 && (continuous || projectile.emitIndex < (emitter.count ?? 0)) && guard < 16) {
      spawned.push(createEmittedPlayerProjectile(game, projectile, emitter));
      projectile.emitIndex += 1;
      projectile.emitTimer += interval;
      guard += 1;
    }
  }
  if (spawned.length > 0) game.playerProjectiles.push(...spawned);
}

function createEmittedPlayerProjectile(game, source, emitter) {
  const spokeCount = Math.max(1, emitter.count ?? 1);
  const angle = source.angle + ((Math.PI * 2 * (source.emitIndex % spokeCount)) / spokeCount);
  const speed = emitter.projectileSpeed ?? 180;
  return createProjectile(source.x, source.y, Math.cos(angle) * speed + source.vx * 0.25, Math.sin(angle) * speed + source.vy * 0.25, {
    team: 'player',
    weapon: emitter.weapon ?? 'emitted-projectile',
    radius: emitter.radius ?? 1,
    damage: emitter.damage ?? source.damage,
    color: emitter.color,
    impulse: emitter.impulse ?? source.impulse * 0.35,
    lifetime: emitter.lifetime ?? 0.9,
    angle,
    pierce: emitter.pierce ?? 0,
    pierceDamageScale: 0.85,
    pierceDamageFalloff: 0.72,
    damagePiercesUntilSpent: emitter.damagePiercesUntilSpent,
    absorbsEnemyProjectiles: emitter.absorbsEnemyProjectiles,
    sprite: emitter.sprite,
  });
}

function trackReticleArcProjectiles(game) {
  if (!game.aimReticle) return;
  for (const projectile of game.playerProjectiles) {
    if (!projectile.tracksReticleInArc || projectile.behavior !== 'arc' || projectile.arcLanded || projectile.lifetime <= 0) continue;
    projectile.targetHint = { x: game.aimReticle.x, y: game.aimReticle.y };
    const flightTime = remainingArcFlightTime(projectile);
    projectile.vx = (projectile.targetHint.x - projectile.x) / flightTime;
    projectile.vy = (projectile.targetHint.y - projectile.y) / flightTime;
    projectile.angle = Math.atan2(projectile.vy, projectile.vx);
  }
}

function remainingArcFlightTime(projectile) {
  const gravity = projectile.gravity ?? 0;
  if (gravity <= 0) return Math.max(0.001, projectile.lifetime ?? 1);
  const z = Math.max(0, projectile.z ?? 0);
  const vz = projectile.vz ?? 0;
  const discriminant = vz * vz + 2 * gravity * z;
  return Math.max(0.001, (vz + Math.sqrt(discriminant)) / gravity);
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

function playerProjectileAbsorbsEnemyProjectile(game, playerProjectile) {
  if (!playerProjectile.absorbsEnemyProjectiles || playerProjectile.lifetime <= 0 || playerProjectile.damage <= 0) return false;
  let absorbed = false;
  for (const enemyProjectile of game.enemyProjectiles) {
    if (enemyProjectile.lifetime <= 0 || enemyProjectile.behavior === 'beam' || enemyProjectile.behavior === 'blast') continue;
    if (enemyProjectile.behavior === 'arc' && !enemyProjectile.arcLanded) continue;
    const hitRange = enemyProjectile.radius + playerProjectile.radius;
    if (!projectileIntersectsPoint(playerProjectile, enemyProjectile, hitRange)) continue;
    enemyProjectile.lifetime = 0;
    playerProjectile.damage = Math.max(0, playerProjectile.damage - (enemyProjectile.damage ?? 0));
    if (playerProjectile.damage <= 0.05) playerProjectile.lifetime = 0;
    absorbed = true;
  }
  return absorbed;
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

function syncEnemyBeamProjectiles(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.behavior !== 'beam' || !projectile.sourceEnemy || !projectile.sourceCellId) continue;
    const sourceCell = projectile.sourceEnemy.cells.find((cell) => cell.id === projectile.sourceCellId);
    if (!sourceCell || sourceCell.state.destroyed || projectile.sourceEnemy.destroyed) {
      projectile.lifetime = 0;
      continue;
    }
    projectile.x = projectile.sourceEnemy.x + (projectile.sourceOffset?.x ?? sourceCell.gridX * CELL_SIZE);
    projectile.y = projectile.sourceEnemy.y + (projectile.sourceOffset?.y ?? sourceCell.gridY * CELL_SIZE);
  }
}

function spawnEnemyPulseBlast(game, projectile) {
  const blast = projectile.blastOnExpire ?? { radius: CELL_SIZE * 2.55, damage: 9, impulse: 55 };
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
      maxVoxelDistance: Math.max(1, blast.radius / VOXEL_SIZE),
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
      detonatePlayerProjectile(game, projectile);
    }
    return true;
  }
  return false;
}

function projectileIntersectsPoint(projectile, target, radius) {
  const dx = projectile.x - projectile.previousX;
  const dy = projectile.y - projectile.previousY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.001) return distanceSquared(projectile, target) <= radius * radius;
  const along = ((target.x - projectile.previousX) * dx + (target.y - projectile.previousY) * dy) / lengthSquared;
  const t = clamp(along, 0, 1);
  const closest = { x: projectile.previousX + dx * t, y: projectile.previousY + dy * t };
  return distanceSquared(closest, target) <= radius * radius;
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
  if (distanceSquared(closest, target) <= Math.max(projectile.radius, 5) ** 2 && along >= 0) return true;
  if (projectile.detonateDistance != null && projectile.startX != null && projectile.startY != null) {
    return Math.hypot(projectile.x - projectile.startX, projectile.y - projectile.startY) >= projectile.detonateDistance;
  }
  return false;
}

function shieldedProjectile(game, projectile) {
  if (game.boost.activeTime <= 0) return projectile;
  const shield = clamp(0.25 * upgradeMultiplier(game, 'boostShielding') * Math.sqrt(game.boost.shieldScale ?? 1), 0, 0.85);
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
  if (projectile.forceMode === 'push') repelEnemyProjectilesWithBeam(game, projectile, halfWidth);
  const shieldTrace = traceAbsorbingEnemyProjectileRay(game.enemyProjectiles, projectile, projectile.angle, projectile.length, halfWidth);
  if (shieldTrace) {
    projectile.renderEndX = shieldTrace.x;
    projectile.renderEndY = shieldTrace.y;
    shieldTrace.projectile.absorbHp -= projectile.damage * beamDamageScale(projectile);
    if (shieldTrace.projectile.absorbHp <= 0) shieldTrace.projectile.lifetime = 0;
    return;
  }
  const trace = traceEnemyVoxelBeam(activeEnemies(game).filter((enemy) => enemyCanBeHitByProjectile(enemy, projectile)), projectile, projectile.angle, projectile.length, halfWidth, projectile.pierce ?? 0);
  projectile.renderEndX = trace.x;
  projectile.renderEndY = trace.y;
  if (trace.hits.length === 0) return;
  const scale = beamDamageScale(projectile);
  for (const voxelHit of trace.hits) {
    if (enemyShieldBlocks(voxelHit.enemy, voxelHit)) continue;
    const hit = applyEnemyVoxelDamage(voxelHit.enemy, voxelHit, projectile.damage * scale);
    if (hit.hit) {
      game.score.damageDone += Math.round(projectile.damage * scale + hit.removed * 3);
      const forceDirection = projectile.forceMode === 'pull' ? -1 : 1;
      const forceScale = projectile.forceMode ? 0.035 : 0.0015;
      voxelHit.enemy.vx += Math.cos(projectile.angle) * projectile.impulse * forceScale * scale * forceDirection;
      voxelHit.enemy.vy += Math.sin(projectile.angle) * projectile.impulse * forceScale * scale * forceDirection;
      if (hit.destroyedNow) explodeEnemy(game, voxelHit.enemy);
    }
  }
}

function repelEnemyProjectilesWithBeam(game, projectile, halfWidth) {
  const dx = Math.cos(projectile.angle);
  const dy = Math.sin(projectile.angle);
  for (const target of game.enemyProjectiles) {
    if (target.lifetime <= 0 || target.behavior === 'beam' || target.behavior === 'blast') continue;
    const along = (target.x - projectile.x) * dx + (target.y - projectile.y) * dy;
    if (along < 0 || along > projectile.length) continue;
    const closest = { x: projectile.x + dx * along, y: projectile.y + dy * along };
    if (distanceSquared(target, closest) > (halfWidth + target.radius) ** 2) continue;
    const speed = Math.max(90, Math.hypot(target.vx, target.vy));
    target.vx = dx * (speed + projectile.impulse * 0.95);
    target.vy = dy * (speed + projectile.impulse * 0.95);
    target.angle = projectile.angle;
    target.lifetime = Math.min(target.lifetime, 1.2);
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
  for (const projectile of game.playerProjectiles) {
    if (projectile.behavior !== 'beam') continue;
    const muzzle = beamSourceMuzzle(game, projectile);
    if (!muzzle) {
      projectile.lifetime = 0;
      continue;
    }
    projectile.x = muzzle.x;
    projectile.y = muzzle.y;
    const threat = projectile.weapon === 'repulsor_beam' ? nearestRepulsorThreat(game, muzzle) : null;
    projectile.angle = threat
      ? Math.atan2(threat.y - muzzle.y, threat.x - muzzle.x)
      : projectile.targetHint
        ? Math.atan2(projectile.targetHint.y - muzzle.y, projectile.targetHint.x - muzzle.x)
        : game.vehicle.turretHeading;
  }
}

function beamSourceMuzzle(game, projectile) {
  if (!projectile.sourceCellId) return gunMuzzleWorld(game.vehicle);
  return gunMuzzlesWorld(game.vehicle).find((muzzle) => muzzle.cellId === projectile.sourceCellId) ?? null;
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
  return (VOXEL_SIZE * voxelWidth) / 2;
}

function spawnCannonImpact(game, projectile, enemy) {
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_EXPLOSION);
  game.playerProjectiles.push(
    createProjectile(projectile.x, projectile.y, 0, 0, {
      team: 'player',
      weapon: 'cannon-blast',
      behavior: 'blast',
      radius: 1,
      maxRadius: projectile.blastRadius || CELL_SIZE * 5.1,
      damage: 0,
      impulse: 0,
      lifetime: 0.22,
    }),
  );

  const blastRadius = projectile.blastRadius || CELL_SIZE * 5.1;
  for (const blastTarget of activeEnemies(game)) {
    const distance = Math.hypot(blastTarget.x - projectile.x, blastTarget.y - projectile.y);
    if (distance > blastRadius + blastTarget.radius) continue;
    const hit = applyEnemyBlastDamage(blastTarget, projectile, {
      maxVoxelDistance: 20,
      closeVoxelDistance: 5,
      closePenetration: 3,
      farPenetration: 1,
      damage: projectile.blastDamage || projectile.damage * 0.5,
    });
    if (hit.hit) {
      game.score.damageDone += Math.round((projectile.blastDamage || projectile.damage * 0.5) * 0.22 + hit.removed * 3);
      if (hit.destroyedNow) explodeEnemy(game, blastTarget);
    }
    knockEnemyFromPoint(blastTarget, projectile, CELL_SIZE * 4.6, projectile.blastKnockback || 27.5);
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
        radius: game.rng.range(0.7, 1.1),
        damage: projectile.damage * (projectile.shrapnelDamageScale ?? 1) * game.rng.range(0.1, 0.18),
        impulse: projectile.impulse * 0.08,
        pierce: projectile.pierce,
        pierceDamageScale: projectile.pierceDamageScale,
        pierceDamageFalloff: projectile.pierceDamageFalloff,
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
      maxVoxelDistance: Math.max(1, projectile.blastRadius / VOXEL_SIZE),
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
    if (projectile.lifetime <= 0 || !projectile.contrail) continue;
    const meanPerSevenFrames = projectile.contrail.emissionMeanPerSevenFrames ?? 2;
    const mean = (meanPerSevenFrames / 7) * frameCount;
    const count = Math.min(projectile.contrail.maxParticlesPerStep ?? 5, samplePoisson(game.rng, mean));
    for (let index = 0; index < count; index += 1) spawnRocketSmokeParticle(game, projectile);
  }
}

function stepBoostContrails(game, dt) {
  if (game.boost.driveTime <= 0 || !game.boost.driveDirection) return;
  const frameCount = Math.max(0, dt * 60);
  const upgradeCount =
    upgradeLevel(game, 'boostAcceleration') +
    upgradeLevel(game, 'boostDuration') +
    upgradeLevel(game, 'boostRecharge') +
    upgradeLevel(game, 'boostCapacity');
  const enginePower = typedModulePower(game.vehicle, 'engine');
  const scale = 1 + Math.log1p(enginePower + upgradeCount) * 0.85;
  const mean = (1.5 * scale / 7) * frameCount;
  const count = Math.min(10, samplePoisson(game.rng, mean));
  for (let index = 0; index < count; index += 1) spawnBoostSmokeParticle(game, scale);
}

function spawnBoostSmokeParticle(game, scale = 1) {
  const colors = ['#e8fbff', '#b8ecff', '#8fa4aa', '#5f686d'];
  const direction = game.boost.driveDirection ?? { x: Math.cos(game.vehicle.heading), y: Math.sin(game.vehicle.heading) };
  const exhaustAngle = Math.atan2(-direction.y, -direction.x) + game.rng.range(-0.55, 0.55);
  const speed = game.rng.range(18, 54);
  const backOffset = CELL_SIZE * game.rng.range(2.5, 4.4);
  const sideOffset = game.rng.range(-CELL_SIZE * 0.9, CELL_SIZE * 0.9);
  const nx = -direction.y;
  const ny = direction.x;
  const lifetime = game.rng.range(7, 12) / 60;
  game.smokeParticles.push({
    x: game.vehicle.x - direction.x * backOffset + nx * sideOffset,
    y: game.vehicle.y - direction.y * backOffset + ny * sideOffset,
    vx: Math.cos(exhaustAngle) * speed + game.vehicle.vx * 0.08,
    vy: Math.sin(exhaustAngle) * speed + game.vehicle.vy * 0.08,
    radius: game.rng.range(2.8, 6.4) * Math.min(1.8, scale),
    color: colors[Math.floor(game.rng.range(0, colors.length))] ?? colors[0],
    lifetime,
    maxLifetime: lifetime,
    team: 'player',
    weapon: 'boost-exhaust',
    damage: 2.4 * Math.min(2.4, scale),
    impulse: 24 * Math.min(2.4, scale),
    growth: 13.6,
  });
}

function handleBoostExhaustDamage(game) {
  for (const particle of game.smokeParticles) {
    if (particle.weapon !== 'boost-exhaust' || particle.lifetime <= 0 || particle.damageApplied) continue;
    for (const enemy of activeEnemies(game)) {
      if (distanceSquared(particle, enemy) > (particle.radius + enemy.radius) ** 2) continue;
      const hit = applyEnemyDamage(enemy, particle);
      if (hit.hit) {
        particle.damageApplied = true;
        game.score.damageDone += Math.round(particle.damage + hit.removed * 3);
        enemy.vx += (particle.vx ?? 0) * 0.01;
        enemy.vy += (particle.vy ?? 0) * 0.01;
        if (hit.destroyedNow) explodeEnemy(game, enemy);
        break;
      }
    }
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
  const lifetimeRange = projectile.contrail.particleLifetimeFrames;
  const lifetimeFrames = Array.isArray(lifetimeRange) ? game.rng.range(lifetimeRange[0], lifetimeRange[1]) : game.rng.chance(0.5) ? 4 : 5;
  const radiusScale = projectile.contrail.particleRadiusScale ?? 1;
  game.smokeParticles.push({
    x: projectile.x - cos * backOffset - sin * sideOffset,
    y: projectile.y - sin * backOffset + cos * sideOffset,
    vx: Math.cos(angle) * speed + projectile.vx * 0.05,
    vy: Math.sin(angle) * speed + projectile.vy * 0.05,
    radius: game.rng.range(0.7, 1.6) * radiusScale,
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
    particle.radius += (particle.growth ?? 3.4) * dt;
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
  recordEnemyDefeat(game.score, enemy);
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

function detonatePhantomOverload(game, enemy) {
  if (enemy.destroyed) return;
  const direction = directionFromTo(enemy, game.vehicle);
  if (distanceSquared(enemy, game.vehicle) <= (PHANTOM_OVERLOAD_RADIUS + CELL_SIZE * 3.8) ** 2) {
    applyVehicleDamage(game.vehicle, game.vehicle, PHANTOM_OVERLOAD_RADIUS, PHANTOM_OVERLOAD_DAMAGE, PHANTOM_OVERLOAD_IMPULSE, direction);
  }
  enemy.destroyed = true;
  explodeEnemy(game, enemy);
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

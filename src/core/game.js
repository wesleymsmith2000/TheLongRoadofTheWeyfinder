import { applyVehicleDamage, createStartingVehicle, gunMuzzleWorld, gunMuzzlesWorld, hasFunctionalGun, recalculateVehicle, repairVehicleDamage } from './vehicle.js';
import { stepVehicle, typedModulePower } from './physics.js';
import { applyRocketHullDamage, createProjectile, stepProjectiles } from './projectile.js';
import { hitVehicleWithProjectile } from './damage.js';
import { clamp, distanceSquared } from './math.js';
import { Rng } from './rng.js';
import {
  addCameraShake,
  containVehicleInRoadFrame,
  createRoadCamera,
  createRoadFrame,
  roadOffsetToWorld,
  stepRoadCamera,
  stepRoadFrame,
  worldToRoadOffset,
} from './camera.js';
import { CELL_LAYER_HEIGHT, CELL_SIZE, VOXELS, VOXEL_SIZE } from './voxelMask.js';
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
  createPirateBossEnemy,
  createRoadBossCarEnemy,
  createZeppelinBossEnemy,
  createEnhancedEnemy,
  createEnhancedPirateShipEnemy,
  createMortarSkiffEnemy,
  createPirateShipEnemy,
  drainEnemyDetachEvents,
  enemyCoreEfficiency,
  enemyEngineEfficiency,
  enemyGunEfficiency,
  harvestEnemyScrap,
  livePirateBossGunPodCount,
  traceEnemyVoxelBeam,
  traceEnemyVoxelRay,
} from './enemy.js';
import { firePattern } from './patternDefinition.js';
import { createSecondaryState, stepSecondaryWeapon } from './secondaryWeapon.js';
import {
  SHOP_COSTS,
  buyUpgradeWithScrap,
  ammoCapacityWithUpgrades,
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
import { createProceduralMusicState, setProceduralMusicBaseTrack, stepProceduralMusic } from './proceduralMusic.js';
import { normalizeGunLoadouts } from './weaponLoadout.js';
import { runtimeWeaponDefinition } from './weaponDefinition.js';
import { normalizeSandboxDefinition, validateSandboxDefinition } from './sandboxMode.js';
import { createProceduralRoadRoute } from './roadRoute.js';
import { createWalkerStridePoseRig } from './poseAnimation.js';
import { beginEncounter, createEncounterRuntimeState, encounterPausePolicy, stepEncounters } from './encounterRuntime.js';
import trackingFlechetteDefinition from '../../content/weapons/tracking_flechette.json' with { type: 'json' };
import mortarDefinition from '../../content/weapons/mortar.json' with { type: 'json' };
import bladeLauncherDefinition from '../../content/weapons/blade_launcher.json' with { type: 'json' };
import miniBeamDefinition from '../../content/weapons/mini_beam.json' with { type: 'json' };
import repulsorBeamDefinition from '../../content/weapons/repulsor_beam.json' with { type: 'json' };
import staMissileDefinition from '../../content/weapons/sta_missile.json' with { type: 'json' };
import startingVehicleDefinition from '../../content/constructs/starting_vehicle.json' with { type: 'json' };
import ghostPhaserSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.ghost_phaser_sculpted.json' with { type: 'json' };
import tractorFrogSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.tractor_frog_sculpted.json' with { type: 'json' };
import heavyMortarBoatSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.heavy_mortar_boat_sculpted.json' with { type: 'json' };
import weyfinderRoadCarSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_car_sculpted.json' with { type: 'json' };
import weyfinderRoadArmoredCarSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_armored_car_sculpted.json' with { type: 'json' };
import weyfinderRoadFlechetteRacerSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.weyfinder_road_flechette_racer_sculpted.json' with { type: 'json' };
import spiderWalkerSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spider_walker_sculpted.json' with { type: 'json' };
import spideryWalkerSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.spidery_walker_sculpted.json' with { type: 'json' };
import scrapBuzzardSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.scrap_buzzard_sculpted.json' with { type: 'json' };
import inchwormHeadSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_head_sculpted.json' with { type: 'json' };
import inchwormSegmentSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.inchworm_body_segment_sculpted.json' with { type: 'json' };
import mothBomberSculptedDefinition from '../../content/examples/prototype0-zone-enemy-set/constructs/example.construct.moth_bomber_sculpted.json' with { type: 'json' };

export const LEVEL_TARGET_DURATION = 180;
export const TARGETING_MODES = ['manual', 'guided', 'mixed'];
const SPAWN_WARNING_LEAD = 2.4;
const BOSS_LASER_CHARGE_TIME = 3;
const BOSS_LASER_LOCK_TIME = 1;
const DESTROYED_ENEMY_REMNANT_SECONDS = 3.8;
const ROAD_EDGE_SIDE_SLIDE_SPEED = 42;
const ROAD_EDGE_SPEED_RETURN_SECONDS = 2.6;
const ROAD_EDGE_ACCEL_SECONDS = 2.3;
const ROAD_EDGE_BRAKE_SECONDS = 1.6;
const SHADOWED_ROAD_1_SECONDS = 129;
const SHADOWED_ROAD_2_SECONDS = 107;
const PRIMARY_WEAPON_DEFINITIONS = {
  tracking_flechette: runtimeWeaponDefinition(trackingFlechetteDefinition),
  mortar: runtimeWeaponDefinition(mortarDefinition),
  blade_launcher: runtimeWeaponDefinition(bladeLauncherDefinition),
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
const PLAYER_MORTAR_BASE_BLAST_RADIUS_CELLS = mortarDefinition.projectile.blastRadiusCells ?? 7.5;
const ENEMY_MORTAR_BASE_BLAST_RADIUS = CELL_SIZE * PLAYER_MORTAR_BASE_BLAST_RADIUS_CELLS;
const ENEMY_SINGLE_MORTAR_BLAST_RADIUS = ENEMY_MORTAR_BASE_BLAST_RADIUS * 1.5;
const MORTAR_LEVEL_5_RADIUS_MULTIPLIER = (Math.sqrt(1.05)) ** 5;
const MORTAR_LEVEL_5_DAMAGE_MULTIPLIER = 1.05 ** 5;
const MOTH_BOMBER_BLAST_RADIUS = ENEMY_MORTAR_BASE_BLAST_RADIUS * MORTAR_LEVEL_5_RADIUS_MULTIPLIER;
const MOTH_BOMBER_BLAST_DAMAGE = 4.5 * MORTAR_LEVEL_5_DAMAGE_MULTIPLIER;
const MOTH_BOMBER_DIVE_ACCELERATION = 420;
const MOTH_BOMBER_DIVE_SPEED = 315;
const MOTH_BOMBER_FUSE_SECONDS = 3;
const MOTH_BOMBER_HOVER_Z = CELL_LAYER_HEIGHT * 0.65;
const MOTH_BOMBER_EDGE_TURN_SECONDS = 0.22;
const MOTH_BOMBER_FRIENDLY_FIRE_IGNORE_TAGS = ['inchworm', 'moth'];
const BUZZARD_AIR_Z = CELL_LAYER_HEIGHT * 9.2;
const BUZZARD_LAND_Z = 0;
const BUZZARD_FEED_RANGE = CELL_SIZE * 2.8;
const BUZZARD_PANIC_TAKEOFF_SECONDS = 1;
const BUZZARD_PANIC_CUES = [
  String.fromCodePoint(0x1f623),
  String.fromCodePoint(0x1f615),
  String.fromCodePoint(0x1f4ab),
  String.fromCodePoint(0x1f630),
  String.fromCodePoint(0x1f9b6),
];
const ZEPPELIN_HARPOON_CHARGE_SECONDS = 3;
const ZEPPELIN_HARPOON_FIELD_SECONDS = 10;
const ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS = 15;
const ZEPPELIN_HARPOON_POWERUP_LIFETIME_SECONDS = 5;
const ZEPPELIN_HARPOON_POWERUP_FLASH_START_SECONDS = 3;
const ZEPPELIN_HARPOON_POWERUP_RADIUS = CELL_SIZE * 2.4;
const HARPOON_SHOT_SPEED = 720;
const HARPOON_SHOT_MIN_SECONDS = 0.22;
const HARPOON_SHOT_MAX_SECONDS = 0.75;
const HARPOON_CHARGE_PARTICLE_COLORS = ['#79e6ff', '#b9f4ff', '#3ea5ff', '#d7fbff'];
const HARPOON_PROJECTILE_SPRITE = {
  ...staMissileDefinition.projectile.sprite,
  tint: '#5fdfff',
  tintAlpha: 0.28,
  displaySize: [28, 10],
};
const ZEPPELIN_STRAFE_SPEED = 92;
const ZEPPELIN_STRAFE_EXIT_MARGIN = CELL_SIZE * 13;
const ZEPPELIN_SUMMONED_WALKER_LIMIT = 3;
const ZEPPELIN_ORBIT_SPEED = 70;
const ZEPPELIN_ORBIT_MARGIN = CELL_SIZE * 18;
const ZEPPELIN_ATS_ROCKET_BLAST_RADIUS = CELL_SIZE * 5.1 * (1.05 ** 12);
const ZEPPELIN_ATS_ROCKET_BLAST_DAMAGE = 9 * (1.05 ** 12);
const ZEPPELIN_ATS_LAUNCH_SPEED_SCALE = 0.5;
const ZEPPELIN_CURSED_TRAIL_DAMAGE = 1.1;
const ZEPPELIN_CURSED_TRAIL_RADIUS = CELL_SIZE * 1.8;
const ZEPPELIN_GROUND_LASER_WARNING_SECONDS = 5;
const ZEPPELIN_GROUND_LASER_LOCK_SECONDS = 2;
const ZEPPELIN_GROUND_LASER_FIRE_SECONDS = 3;
const ZEPPELIN_GROUND_LASER_SEQUENCE_COOLDOWN = 15;
const ZEPPELIN_GROUND_LASER_LENGTH = CELL_SIZE * 54;
const ZEPPELIN_WALKER_ROUT_SPEED = 215;
const ZEPPELIN_WALKER_ROUT_CUE_INTERVAL = 0.32;
const BOSS_INTERNAL_DESTRUCTION_SECONDS = 3.2;
const OCTOPUS_ARM_PHASE_DELAY_SECONDS = 0.55;
const OCTOPUS_ARM_EVADE_RUN_SECONDS = 1.6;
const OCTOPUS_ARM_EVADE_DEPHASE_SECONDS = 1.15;
const OCTOPUS_ARM_REACTION_OUCH_SECONDS = 0.9;
const OCTOPUS_ARM_REACTION_SCARED_SECONDS = 1.1;
const OCTOPUS_ARM_REACTION_ANGER_SECONDS = 1.6;
const OCTOPUS_ARM_REACTION_SECONDS = OCTOPUS_ARM_REACTION_OUCH_SECONDS + OCTOPUS_ARM_REACTION_SCARED_SECONDS + OCTOPUS_ARM_REACTION_ANGER_SECONDS;
const OCTOPUS_NAKED_PANIC_SECONDS = 10;
const OCTOPUS_RETREAT_SPEED = 118;
const OCTOPUS_RETREAT_EXIT_MARGIN = CELL_SIZE * 12;
const PIRATE_BOSS_ORBIT_SPEED = 58;
const PIRATE_BOSS_FRONT_MORTAR_RADIUS = ENEMY_MORTAR_BASE_BLAST_RADIUS * 2;
const PIRATE_BOSS_SIDE_LONG_RANGE = CELL_SIZE * 26;
const PIRATE_BOSS_SHIP_LENGTH = CELL_SIZE * 25;
const ROAD_BOSS_CAR_ORBIT_SPEED = 66;
const ROAD_BOSS_CAR_STRAFE_SPEED = 165;
const ROAD_BOSS_CAR_ORBIT_SECONDS = 5.5;
const ROAD_BOSS_CAR_STRAFE_SECONDS = 6.5;
const ROAD_BOSS_CAR_ESCAPE_PODS = 5;
const SHADOWED_MINE_DROPPER_SPEED = 118;
const SHADOWED_MINE_COOLDOWN = [1.65, 2.45];
const SHADOWED_MINE_FUSE_SECONDS = 5;
const SHADOWED_MINE_BLAST_RADIUS = ENEMY_SINGLE_MORTAR_BLAST_RADIUS;
const SHADOWED_MINE_BLAST_DAMAGE = 4.5;
const SHADOWED_MINE_RADIUS = 7;
const MINE_DROPPER_MAX_VISUAL_LEAN = 0.38;
const RACE_CAR_STRAFE_SPEED = 185;
const RACE_CAR_FLECHETTE_COOLDOWN = 0.58;
const RACE_CAR_SPINOUT_SECONDS = 3;
const RACE_CAR_PANIC_SECONDS = 1;
const LIVE_TERRAIN_CHUNK_GENERATION_BUDGET = 1;
const WALKER_SWEEP_BEAM_CHARGE_SECONDS = 1.35;
const WALKER_SWEEP_BEAM_FIRE_SECONDS = 4;
const WALKER_SWEEP_BEAM_LENGTH = CELL_SIZE * 48;
const WALKER_SWEEP_BEAM_COOLDOWN = [5.2, 7.4];
const WALKER_STA_MISSILE_COOLDOWN = [3.8, 5.8];
const WALKER_STA_GRAVITY = 330;
const WALKER_STA_VERTICAL_VELOCITY = 245;
const WALKER_STA_DIRECT_DESCENT_SECONDS = 0.78;
const WALKER_STA_BLAST_RADIUS = CELL_SIZE * 4.5;
const WALKER_FALL_DROP_SECONDS = 1.25;
const WALKER_FALL_HANG_SECONDS = 5;
const WALKER_FALL_ANIMATION_SECONDS = WALKER_FALL_HANG_SECONDS + WALKER_FALL_DROP_SECONDS;
const WALKER_FALL_IMPACT_PROGRESS = 0.82;
const WALKER_FALL_ANGER_SECONDS = 2.4;
const WALKER_STA_MISSILE_SPRITE = {
  ...staMissileDefinition.projectile.sprite,
  tint: '#801a28',
  tintAlpha: 0.5,
};
const ENEMY_RED_BLACK_CONTRAIL = {
  emissionMeanPerSevenFrames: 3,
  maxParticlesPerStep: 6,
  particleLifetimeFrames: [5, 8],
  particleRadiusScale: 1.65,
  colors: ['#050506', '#171011', '#68151c', '#b32632'],
};
const WALKER_GROUNDED_SPIRAL_INTERVAL = 0.24;
const WALKER_GROUNDED_SPIRAL_COUNT = 12;
const WALKER_GROUNDED_SPIRAL_REST = 1.2;
const WALKER_GROUNDED_REPULSOR_COOLDOWN = [0.9, 1.25];
const BROODABLE_ARCHETYPES = new Set([
  'ghost_phaser.ghost_forrest',
  'hopping_stream_mob.digitized_stream',
  'heavy_mortar_boat.pirates_road',
  'starlight_walker.prototype0',
  'twilight_walker.prototype0',
  'scrap_buzzard.shadowed_desert',
  'inchworm_carrier.freedoms_pass',
]);
const RUNTIME_SCULPTED_CONSTRUCTS = {
  'ghost_phaser.ghost_forrest': ghostPhaserSculptedDefinition,
  'hopping_stream_mob.digitized_stream': tractorFrogSculptedDefinition,
  'heavy_mortar_boat.pirates_road': heavyMortarBoatSculptedDefinition,
  'weyfinder_road_car.prototype0': weyfinderRoadCarSculptedDefinition,
  'weyfinder_road_armored_car.prototype0': weyfinderRoadArmoredCarSculptedDefinition,
  'weyfinder_road_flechette_racer.prototype0': weyfinderRoadFlechetteRacerSculptedDefinition,
  'starlight_walker.prototype0': spideryWalkerSculptedDefinition,
  'twilight_walker.prototype0': spiderWalkerSculptedDefinition,
  'scrap_buzzard.shadowed_desert': scrapBuzzardSculptedDefinition,
  'moth_bomber.freedoms_pass': mothBomberSculptedDefinition,
};
const RUNTIME_CONSTRUCT_DEFINITIONS = new Map(
  Object.values(RUNTIME_SCULPTED_CONSTRUCTS).map((definition) => [definition.assetId, definition]),
);
const INCHWORM_HEAD_CONSTRUCT = inchwormHeadSculptedDefinition;
const INCHWORM_SEGMENT_CONSTRUCT = inchwormSegmentSculptedDefinition;
const ENEMY_MORTAR_LINE_IMPACT_SPACING_SECONDS = 0.22;
const TARGETING_AI_BASE_SPEED = 145;
const TARGETING_AI_SPEED_PER_RANK = 12;
const TARGETING_AI_XP_PER_RANK = 45;
const TARGETING_AI_BASE_WOBBLE = 18;
const MAX_SMOKE_PARTICLES = 180;
const MAX_GROUND_BEAM_SCORCH_PARTICLES = 72;
const MAX_DETACHED_SUPPORT_SCRAP = 24;
const OCTOPUS_DESTRUCTION_CUE_CODEPOINTS = [0x1f622, 0x1f623, 0x1f621, 0x1f92f, 0x1fae5];
const PIRATE_ENTRANCE_SOUND_IDS = [
  SOUND_EVENTS.PIRATE_YARGH,
  SOUND_EVENTS.PIRATE_BROADSIDE,
  SOUND_EVENTS.PIRATE_AVAST,
];
const PIRATE_ENTRANCE_CUE_TEXTS = [
  `${String.fromCodePoint(0x2620)} !`,
  `${String.fromCodePoint(0x2694)} !`,
  'Yargh!',
];
const PIRATE_GUN_LOSS_CUE_TEXTS = [
  `${String.fromCodePoint(0x1f623)} !`,
  `${String.fromCodePoint(0x1f621)} ${String.fromCodePoint(0x1f4a2)}`,
];
const ZEPPELIN_WALKER_ROUT_CUES = [
  String.fromCodePoint(0x1f92f),
  String.fromCodePoint(0x1f62d),
  String.fromCodePoint(0x1f61f),
  String.fromCodePoint(0x1f630),
  String.fromCodePoint(0x1f628),
  String.fromCodePoint(0x1f631),
];
const CAR_SPINOUT_CUE_TEXTS = [
  `${String.fromCodePoint(0x1f635)} ${String.fromCodePoint(0x1f615)}`,
  `${String.fromCodePoint(0x1f4ab)} ?`,
];
const CAR_PANIC_CUE_TEXTS = [
  `${String.fromCodePoint(0x1f623)} !`,
  `${String.fromCodePoint(0x1f631)} !`,
];
const ROAD_BOSS_DESTRUCTION_CUE_TEXTS = [
  String.fromCodePoint(0x1f621),
  String.fromCodePoint(0x1f615),
  String.fromCodePoint(0x1f623),
  '!',
];
const ROAD_BOSS_TAUNT_CUE_TEXT = String.fromCodePoint(0x1f61b);
const RUNTIME_ENEMY_ARCHETYPES = {
  'mortar_skiff.prototype0': {
    id: 'mortar_skiff.prototype0',
    displayName: 'Dizzy Mortar Skiff',
    zone: 'PiratesRoad',
    runtimeFactory: 'createMortarSkiffEnemy',
  },
  'boss.zeppelin.prototype0': {
    id: 'boss.zeppelin.prototype0',
    displayName: 'Prototype Zeppelin Boss',
    zone: 'StarlightRoad',
    runtimeFactory: 'createZeppelinBossEnemy',
  },
  'boss.weyfinder_road_hotrod.prototype0': {
    id: 'boss.weyfinder_road_hotrod.prototype0',
    displayName: 'Weyfinder Road Hotrod Boss',
    zone: 'TheWeyfindersRoad',
    runtimeFactory: 'createRoadBossCarEnemy',
  },
  'shadowed_road_mine_dropper.prototype0': {
    id: 'shadowed_road_mine_dropper.prototype0',
    displayName: 'Shadowed Road Mine Dropper',
    zone: 'ShadowedRoad',
    construct: weyfinderRoadArmoredCarSculptedDefinition.assetId,
    carBehavior: {
      movement: 'mineDropper',
      speed: SHADOWED_MINE_DROPPER_SPEED,
      spinout: { wheelBlocksDestroyed: 2 },
    },
  },
  'boss.shadowed_road_hotrod.prototype0': {
    id: 'boss.shadowed_road_hotrod.prototype0',
    displayName: 'Shadowed Road Hotrod Boss',
    zone: 'ShadowedRoad',
    runtimeFactory: 'createRoadBossCarEnemy',
    carBehavior: { kind: 'bossRoadster', variant: 'shadowedRoad', spinout: { wheelBlocksDestroyed: 2 } },
  },
  'boss.pirate_dreadnought.prototype0': {
    id: 'boss.pirate_dreadnought.prototype0',
    displayName: 'Pirate Dreadnought Boss',
    zone: 'PiratesRoad',
    runtimeFactory: 'createPirateBossEnemy',
    entranceBarks: {
      trigger: 'warning',
      sounds: [SOUND_EVENTS.PIRATE_BOSS_ENTRANCE],
      cues: [`${String.fromCodePoint(0x2620)} No quarter!`],
      random: false,
    },
    reactionCues: [
      {
        trigger: 'gunDestroyed',
        texts: PIRATE_GUN_LOSS_CUE_TEXTS,
        duration: 1.9,
        rise: CELL_SIZE * 1.7,
        growth: 2.4,
      },
      {
        trigger: 'corePhasedIn',
        texts: [`${String.fromCodePoint(0x1f621)} No quarter!`],
        sound: SOUND_EVENTS.PIRATE_NO_QUARTER,
        duration: 2.2,
      },
    ],
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
  const terrainRoute =
    options.terrainRoute ??
    createProceduralRoadRoute(options.terrainSeed ?? seed, {
      startX: vehicle.x,
      startY: vehicle.y,
      startHeading: vehicle.heading,
    });
  const road = createRoadFrame(vehicle, { route: terrainRoute });
  const terrainGenerator = createTerrainGenerator({ seed: options.terrainSeed ?? seed, route: terrainRoute });
  const terrain = createTerrainState(terrainGenerator);
  updateTerrainStreaming(terrain, road);
  terrain.maxGeneratedChunksPerUpdate = options.terrainChunkBudget ?? LIVE_TERRAIN_CHUNK_GENERATION_BUDGET;
  const terrainSample = sampleTerrain(terrain, vehicle.x, vehicle.y);
  const levelMusic = options.levelMusic ?? DEFAULT_LEVEL_MUSIC;
  const startLevel = Math.max(1, Math.floor(options.startLevel ?? options.level ?? 1));
  const rng = new Rng(seed);
  const sandboxDefinition = options.sandbox ? normalizeSandboxDefinition(options.sandbox) : null;
  const enemySpawnQueue = sandboxDefinition
    ? createSandboxEnemySchedule(road, sandboxDefinition, rng, options)
    : createLevelEnemySchedule(road, startLevel, levelMusic, rng);
  const initialSpawns = dequeueReadySpawns(enemySpawnQueue, 0);
  const currentMusic = sandboxDefinition ? options.music ?? 'Sandbox' : musicForLevel(startLevel, levelMusic);
  const traversal = sandboxDefinition ? null : traversalTargetForTrack(currentMusic, road);
  const game = {
    rng,
    levelMusic,
    currentMusic,
    music: createProceduralMusicState({ baseTrack: currentMusic }),
    environmentLighting: options.environmentLighting ?? options.lighting ?? 'DAY',
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
    harpoonShots: [],
    smokeParticles: [],
    soundEvents: [],
    autofire: true,
    primaryHeat: { heat: 0, maxHeat: 100 },
    repulsor: { charges: 5, maxCharges: 5, rechargeTimer: 0, cooldown: 4.5 },
    playerFireTimer: 0,
    playerGunIndex: 0,
    levelComplete: false,
    victoryBanner: null,
    traversal,
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
    targetingAi: createTargetingAiState(options.targetingAi),
    playerDamageShake: { timer: 0, lostCells: 0 },
    encounters: createEncounterRuntimeState(options.encounters ?? []),
    sandbox: sandboxDefinition ? createSandboxRuntimeState(sandboxDefinition, [], options.enemyArchetypes) : null,
  };
  if (sandboxDefinition) {
    for (const enemy of initialSpawns) triggerEnemyEntranceBark(game, enemy, 'warning');
  }
  return game;
}

export function stepGame(game, input, dt) {
  dt = Math.min(dt, 0.033);
  if (input.targetingMode && TARGETING_MODES.includes(input.targetingMode)) {
    if (input.targetingMode === 'guided' && game.targetingMode !== 'guided') resetAiAimReticle(game);
    game.targetingMode = input.targetingMode;
  }
  if (input.pausePressed) game.paused = !game.paused;
  if (input.targetCycle) cycleGuidedTarget(game, input.targetCycle);
  if (game.paused) {
    stepPausedGame(game, input, dt);
    stepProceduralMusic(game, dt);
    return game;
  }
  game.time += dt;
  stepEncounters(game, input, dt);
  if (input.resetPressed) {
    return createGame(1147, {
      vehicleDefinition: game.vehicleDefinition,
      levelMusic: game.levelMusic,
      sandbox: game.sandbox?.definition,
      enemyArchetypes: game.sandbox?.enemyArchetypes,
      encounters: Object.values(game.encounters?.definitions ?? {}),
    });
  }
  if (input.nextLevelPressed && game.levelComplete) return startNextLevel(game);
  if (game.levelComplete || game.gameOver) {
    stepShop(game, input);
    stepScrapPickups(game, dt);
    game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
    stepSmokeParticles(game, dt);
    stepRoadCamera(game.camera, game.road, game.vehicle, dt);
    stepProceduralMusic(game, dt);
    return game;
  }
  if (input.fireTogglePressed) game.autofire = !game.autofire;
  game.inputFireHeld = Boolean(input.fireHeld);
  stepSandboxEvents(game);

  const encounterPolicy = encounterPausePolicy(game);
  if (!encounterPolicy.advanceTerrain || !encounterPolicy.advanceEnemies || !encounterPolicy.advanceProjectiles || !encounterPolicy.advanceVehicle) {
    return stepEncounterHeldGame(game, input, dt, encounterPolicy);
  }

  stepRoadEdgePressure(game, input, dt);
  const roadDelta = stepRoadFrame(game.road, dt);
  carryRoadObjects(game, roadDelta);
  applyRoadTurnDizziness(game, roadDelta.turnAngle);
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

  trackReticleProjectiles(game);
  stepHarpoonShots(game, dt);
  attractPlayerProjectilesToZeppelinHarpoons(game, dt);
  game.playerProjectiles = stepProjectiles(game.playerProjectiles, dt, activeEnemies(game));
  stepPlayerProjectileEmitters(game, dt);
  syncBeamProjectiles(game);
  lockEnemyStaMissileDescents(game);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, dt);
  syncEnemyBeamProjectiles(game);
  stepGroundBeamScorchParticles(game, dt);
  const livePlayerCellsBeforeDamage = countLiveAttachedVehicleCells(game.vehicle);
  handleEnemyProjectileSpecials(game);
  stepSmokeParticles(game, dt);
  stepRocketContrails(game, dt);
  stepBoostContrails(game, dt);
  if (!game.performanceDiagnostics?.disableCollisions) {
    handleCollisions(game);
    handleBoostExhaustDamage(game);
    handleSmokeHazardDamage(game);
  }
  updatePlayerDamageCameraShake(game, livePlayerCellsBeforeDamage, dt);
  collectEnemyDetachScrapEvents(game);
  accelerateNextSpawnWhenArenaEmpty(game);
  stepScrapPickups(game, dt);
  containVehicleInRoadFrame(game.vehicle, game.road, dt);
  recalculateVehicle(game.vehicle);
  syncBeamProjectiles(game);
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  if (!game.performanceDiagnostics?.freezeTerrainStreaming) updateTerrainStreaming(game.terrain, game.camera);
  game.terrainSample = sampleTerrain(game.terrain, game.vehicle.x, game.vehicle.y);
  game.gameOver = !game.vehicle.alive;
  const traversalClear = traversalTargetReached(game);
  if (traversalClear) game.enemySpawnQueue = [];
  const arenaClear = traversalClear || (shouldCompleteRun(game) && activeEnemies(game).length === 0 && game.enemySpawnQueue.length === 0);
  stepVictoryBanner(game, arenaClear, dt);
  if (arenaClear && victoryBannerHasPlayed(game) && game.scrapPickups.length === 0) finishLevel(game);
  stepProceduralMusic(game, dt);
  return game;
}

function stepEncounterHeldGame(game, input, dt, policy) {
  if (input.fireTogglePressed) game.autofire = !game.autofire;
  game.inputFireHeld = false;
  if (policy.advanceAmbient) {
    game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
    stepSmokeParticles(game, dt);
    stepGroundBeamScorchParticles(game, dt);
  }
  stepRoadCamera(game.camera, game.road, game.vehicle, dt);
  if (policy.advanceMusic) stepProceduralMusic(game, dt);
  return game;
}

function stepPausedGame(game, input, dt) {
  stepSecondaryWeapon(game, { ...input, secondaryFirePressed: false, secondaryAutofire: false }, dt);
  const turretInput = aimInputForTurret(game, { ...input, secondaryFirePressed: false }, dt);
  stepTurretAim(game.vehicle, activeEnemies(game), turretInput, dt);
  game.playerProjectiles = decayNonBlockingEffects(game.playerProjectiles, dt);
  stepSmokeParticles(game, dt);
}

function stepRoadEdgePressure(game, input, dt) {
  const road = game.road;
  const baseSpeed = road.baseSpeed ?? 30;
  const offset = worldToRoadOffset(game.vehicle, road);
  const localInput = worldDirectionToRoad({ x: input.x ?? 0, y: input.y ?? 0 }, road);
  const edgeX = edgePressure(offset.x, road.halfWidth);
  const edgeY = edgePressure(offset.y, road.halfHeight);
  const sidePush = edgeX > 0 && Math.sign(localInput.x) === Math.sign(offset.x) ? localInput.x * edgeX : 0;
  if (Math.abs(sidePush) > 0.01) {
    road.lateralOffset = clamp(
      (road.lateralOffset ?? 0) + sidePush * ROAD_EDGE_SIDE_SLIDE_SPEED * dt,
      -road.halfWidth * 0.72,
      road.halfWidth * 0.72,
    );
  } else {
    const recenter = Math.min(1, dt / ROAD_EDGE_SPEED_RETURN_SECONDS);
    road.lateralOffset = (road.lateralOffset ?? 0) * (1 - recenter);
  }

  let targetSpeed = baseSpeed;
  const pushingTop = edgeY > 0 && offset.y < 0 && localInput.y < -0.2;
  const pushingBottom = edgeY > 0 && offset.y > 0 && localInput.y > 0.2;
  if (pushingTop) targetSpeed = baseSpeed * (1 + edgeY * 2);
  else if (pushingBottom) targetSpeed = baseSpeed * (1 - edgeY * 0.875);
  road.targetSpeed = targetSpeed;
  const seconds = targetSpeed > road.speed ? ROAD_EDGE_ACCEL_SECONDS : targetSpeed < road.speed ? ROAD_EDGE_BRAKE_SECONDS : ROAD_EDGE_SPEED_RETURN_SECONDS;
  const blend = Math.min(1, dt / seconds);
  road.speed += (targetSpeed - road.speed) * blend;
  road.speed = clamp(road.speed, baseSpeed / 8, baseSpeed * 3);
}

function edgePressure(value, halfSize) {
  const start = halfSize * 0.86;
  return clamp((Math.abs(value) - start) / Math.max(1, halfSize - start), 0, 1);
}

function traversalTargetForTrack(trackName, road) {
  const seconds = traversalSecondsForTrack(trackName);
  if (!seconds) return null;
  const baseSpeed = road?.baseSpeed ?? road?.speed ?? 30;
  return {
    trackName,
    startDistance: road?.routeDistance ?? 0,
    targetDistance: baseSpeed * seconds,
    targetSeconds: seconds,
  };
}

function traversalSecondsForTrack(trackName = '') {
  if (/^ShadowedRoad_1$/i.test(trackName)) return SHADOWED_ROAD_1_SECONDS;
  if (/^ShadowedRoad_2$/i.test(trackName)) return SHADOWED_ROAD_2_SECONDS;
  return 0;
}

function traversalTargetReached(game) {
  if (!game.traversal || game.levelComplete) return false;
  const traveled = (game.road.routeDistance ?? 0) - (game.traversal.startDistance ?? 0);
  return traveled >= (game.traversal.targetDistance ?? Infinity);
}

function shouldCompleteRun(game) {
  if (!game.sandbox?.enabled) return true;
  return game.sandbox.definition.completeOnEmpty === true || game.sandbox.completeRequested === true;
}

function finishLevel(game) {
  game.levelComplete = true;
  game.levelTime = game.time - game.levelStartTime;
  game.levelTimes.push(game.levelTime);
  updateTargetingAiLevelGain(game);
  if (!game.sandbox?.enabled) {
    game.levelsCompleted = game.level;
    if (isBossLevel(game.level, game.levelMusic)) game.bossLevelsCompleted += 1;
  }
  emitSoundEvent(game, SOUND_EVENTS.STAGE_VICTORY);
}

function stepVictoryBanner(game, arenaClear, dt) {
  if (!arenaClear || game.levelComplete || game.gameOver) {
    game.victoryBanner = null;
    return;
  }
  game.victoryBanner ??= {
    kind: isBossLevel(game.level, game.levelMusic) ? 'boss' : 'level',
    elapsed: 0,
    minDuration: 3,
  };
  game.victoryBanner.elapsed += dt;
}

function victoryBannerHasPlayed(game) {
  return (game.victoryBanner?.elapsed ?? 0) >= (game.victoryBanner?.minDuration ?? 3);
}

export function startNextLevel(game) {
  game.level += 1;
  game.levelComplete = false;
  game.levelTime = 0;
  game.levelStartTime = game.time;
  game.sandbox = null;
  game.currentMusic = musicForLevel(game.level, game.levelMusic);
  setProceduralMusicBaseTrack(game.music, game.currentMusic);
  game.traversal = traversalTargetForTrack(game.currentMusic, game.road);
  game.enemySpawnQueue = createLevelEnemySchedule(game.road, game.level, game.levelMusic, game.rng);
  game.enemies = dequeueReadySpawns(game.enemySpawnQueue, 0);
  game.incomingMarkers = [];
  game.victoryBanner = null;
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.harpoonShots = [];
  game.smokeParticles = [];
  game.soundEvents = [];
  game.scrapPickups = [];
  startTargetingAiLevel(game);
  return game;
}

export function applySandboxDefinitionToGame(game, definition, options = {}) {
  const report = validateSandboxDefinition(definition);
  if (!report.valid) throw new Error(`Invalid sandbox definition: ${report.errors.join(' ')}`);
  const sandboxDefinition = report.definition;
  game.sandbox = createSandboxRuntimeState(sandboxDefinition, report.warnings, options.enemyArchetypes);
  game.level = sandboxDefinition.level;
  game.currentMusic = options.music ?? 'Sandbox';
  game.music = createProceduralMusicState({ baseTrack: game.currentMusic });
  game.traversal = null;
  game.levelComplete = false;
  game.levelTime = 0;
  game.levelStartTime = game.time;
  game.enemySpawnQueue = createSandboxEnemySchedule(game.road, sandboxDefinition, game.rng, options);
  game.enemies = dequeueReadySpawns(game.enemySpawnQueue, 0);
  game.incomingMarkers = [];
  game.victoryBanner = null;
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  game.harpoonShots = [];
  game.smokeParticles = [];
  game.scrapPickups = [];
  game.soundEvents = [];
  game.guidedTargetId = null;
  resetAiAimReticle(game);
  startTargetingAiLevel(game);
  return { game, report };
}

export function createLevelEnemySchedule(road, level, levelMusic = DEFAULT_LEVEL_MUSIC, rng = new Rng(level * 9973)) {
  const entries = createLevelEnemies(road, level, levelMusic);
  const duration = traversalSecondsForTrack(musicForLevel(level, levelMusic)) || LEVEL_TARGET_DURATION;
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
  } else if (event.type === 'encounter') {
    beginEncounter(game, event.encounter ?? event.encounterId, {
      presentationMode: event.presentationMode,
      pausePolicy: event.pausePolicy,
    });
    game.sandbox.lastMessage = `${event.id}: encounter started.`;
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
      const at = Math.max(0, (options.timeOffset ?? 0) + (spawn.at ?? 0) + index * interval);
      for (const enemy of createSandboxEnemies(spawn, world.x, world.y, road, { ...options, spawnIndex: index })) {
        entries.push({ at, enemy, markerShown: false, type: enemy.kind ?? spawn.kind ?? 'standard', sandbox: true, source: spawn.id });
      }
    }
  }
  return entries;
}

function createSandboxEnemies(spawn, x, y, road, options = {}) {
  const archetype = sandboxArchetypeForSpawn(spawn, options.enemyArchetypes ?? []);
  const kind = spawn.kind ?? 'standard';
  const sideStrafeEntry = archetypeUsesRaceStrafe(archetype);
  const raceStrafeSide = sideStrafeEntry ? sandboxRaceStrafeSpawnSide(spawn, options.spawnIndex ?? 0) : 0;
  const spawnPoint = sideStrafeEntry ? sandboxRaceStrafeSpawnPoint(x, y, road, raceStrafeSide, options.spawnIndex ?? 0) : { x, y };
  const enemy = archetype ? createEnemyForArchetype(archetype, spawnPoint.x, spawnPoint.y, kind) : createEnemy(spawnPoint.x, spawnPoint.y);
  if (archetype) applyArchetypeRuntimeMetadata(enemy, archetype);
  enemy.sandboxSource = { archetype: spawn.archetype ?? null, construct: spawn.construct ?? null };
  applyDefaultEnemyCueHooks(enemy);
  if (sideStrafeEntry) {
    configureRaceStrafeEntry(enemy, archetype, road, raceStrafeSide, spawn.speed, 0.45);
  } else {
    const velocitySign = spawn.entry === 'behind' ? -1 : 1;
    const direction = roadDirectionToWorld(0, velocitySign, road);
    const speed = spawn.speed ?? (spawn.entry === 'behind' ? 155 : 24);
    enemy.vx = direction.x * speed;
    enemy.vy = direction.y * speed;
  }
  const level = spawn.level ?? options.level ?? 1;
  applyEnemyLevelUpgrades(enemy, level);
  const enemies =
    archetype?.id === 'inchworm_carrier.freedoms_pass'
      ? createLinkedInchwormEnemies(enemy, archetype, road, level, options.spawnIndex ?? 0)
      : [enemy];
  for (const spawned of enemies) {
    spawned.sandboxSource = { archetype: spawn.archetype ?? null, construct: spawn.construct ?? null };
  }
  return enemies;
}

function sandboxRaceStrafeSpawnSide(spawn, index = 0) {
  if (spawn.side === 'right' || spawn.entry === 'right') return 1;
  if (spawn.side === 'left' || spawn.entry === 'left') return -1;
  return index % 2 === 0 ? -1 : 1;
}

function sandboxRaceStrafeSpawnPoint(x, y, road, side, index = 0) {
  const offset = worldToRoadOffset({ x, y }, road);
  const row = Math.floor(index / 2) * 35;
  return roadOffsetToWorld({ x: side * (road.halfWidth + 85 + row), y: offset.y }, road);
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
    const sideStrafeEntry = archetypeUsesRaceStrafe(archetype);
    const spawnSide = i % 2 === 0 ? -1 : 1;
    const offset = sideStrafeEntry
      ? { x: spawnSide * (road.halfWidth + 85 + row), y: spread }
      : kind === 'enhanced'
        ? { x: spread, y: road.halfHeight + 47.5 + row }
        : { x: spread, y: -road.halfHeight - 47.5 - row };
    const world = roadOffsetToWorld(offset, road);
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
    else applyDefaultEnemyCueHooks(enemy);
    if (sideStrafeEntry) {
      configureRaceStrafeEntry(enemy, archetype, road, spawnSide, null, 0.25);
    } else if (kind === 'enhanced') {
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
    if (archetype?.id === 'inchworm_carrier.freedoms_pass') {
      enemies.push(...createLinkedInchwormEnemies(enemy, archetype, road, level, i));
    } else {
      enemies.push(enemy);
    }
    if (archetype && isBroodableArchetype(archetype)) {
      enemies.push(...createBroodTurretsForEnemy(archetype, road, offset, level, i, kind));
    }
  }
  if (isBoss) {
    const bossWorld = roadOffsetToWorld({ x: 0, y: -road.halfHeight - 90 }, road);
    const boss = usesWeyfinderRoadBoss(currentMusic)
      ? createRoadBossCarEnemy(bossWorld.x, bossWorld.y)
      : usesPirateBoss(currentMusic)
      ? createPirateBossEnemy(bossWorld.x, bossWorld.y)
      : usesZeppelinBoss(currentMusic)
      ? createZeppelinBossEnemy(bossWorld.x, bossWorld.y)
      : createBossEnemy(bossWorld.x, bossWorld.y);
    if (zoneNameFromTrack(currentMusic) === 'ShadowedRoad' && boss.kind === 'roadBossCar') {
      boss.archetypeId = 'boss.shadowed_road_hotrod.prototype0';
      boss.displayName = 'Shadowed Road Hotrod Boss';
      boss.roadBossCar ??= {};
      boss.roadBossCar.variant = 'shadowedRoad';
      boss.roadBossCar.escapeCar = /^ShadowedRoad_BossFight_1$/i.test(currentMusic);
      boss.roadBossCar.mineCooldown = 1.2;
    }
    applyDefaultEnemyCueHooks(boss);
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
  const zone = zoneNameFromTrack(trackName);
  if (zone === 'TheWeyfindersRoad') {
    const ids = kind === 'enhanced'
      ? ['weyfinder_road_armored_car.prototype0']
      : /_3$/i.test(trackName)
        ? ['weyfinder_road_car.prototype0', 'weyfinder_road_flechette_racer.prototype0']
        : ['weyfinder_road_car.prototype0'];
    const id = ids[index % ids.length];
    return getEnemyArchetype(id) ?? RUNTIME_ENEMY_ARCHETYPES[id] ?? null;
  }
  if (zone === 'ShadowedRoad') {
    const ids = kind === 'enhanced'
      ? ['weyfinder_road_armored_car.prototype0']
      : ['weyfinder_road_car.prototype0', 'shadowed_road_mine_dropper.prototype0', 'weyfinder_road_flechette_racer.prototype0'];
    const id = ids[index % ids.length];
    return getEnemyArchetype(id) ?? RUNTIME_ENEMY_ARCHETYPES[id] ?? null;
  }
  if (kind === 'enhanced') return null;
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

function archetypeUsesRaceStrafe(archetype) {
  const behavior = archetype?.carBehavior;
  return Boolean(behavior && (behavior.movement ?? behavior.kind) === 'raceStrafe');
}

function configureRaceStrafeEntry(enemy, archetype, road, spawnSide, speedOverride = null, flechetteCooldown = 0.25) {
  const velocity = roadDirectionToWorld(-spawnSide, 0, road);
  const speed = speedOverride ?? archetype?.entry?.speed ?? archetype?.carBehavior?.speed ?? RACE_CAR_STRAFE_SPEED;
  enemy.vx = velocity.x * speed;
  enemy.vy = velocity.y * speed;
  enemy.carRuntime = {
    ...(enemy.carRuntime ?? {}),
    side: -spawnSide,
    flechetteCooldown: Math.max(enemy.carRuntime?.flechetteCooldown ?? 0, flechetteCooldown),
  };
  enemy.visualHeading = Math.atan2(enemy.vy, enemy.vx);
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
  enemy.renderHeadingOffset = Math.PI / 2;
}

function zoneNameFromTrack(trackName = '') {
  const match = String(trackName).match(/^([A-Za-z]+(?:[A-Z][a-z]+)*)(?:_|$)/);
  return match?.[1] ?? trackName;
}

function usesZeppelinBoss(trackName = '') {
  const zone = zoneNameFromTrack(trackName);
  return zone === 'StarlightRoad' || zone === 'TwilightCrossroads';
}

function usesPirateBoss(trackName = '') {
  return zoneNameFromTrack(trackName) === 'PiratesRoad';
}

function usesWeyfinderRoadBoss(trackName = '') {
  const name = String(trackName ?? '');
  const zone = zoneNameFromTrack(name);
  return /^BossFight_1$/i.test(name) || ((zone === 'TheWeyfindersRoad' || zone === 'ShadowedRoad') && isBossMusic(name));
}

function createEnemyForArchetype(archetype, x, y, kind) {
  const runtimeConstruct = RUNTIME_CONSTRUCT_DEFINITIONS.get(archetype.construct) ?? RUNTIME_SCULPTED_CONSTRUCTS[archetype.id];
  if (runtimeConstruct) {
    const enemy = createEnemy(x, y, runtimeConstruct, undefined, { moduleScale: 1 });
    if (kind === 'enhanced') enemy.kind = 'enhanced';
    if (archetype.id === 'heavy_mortar_boat.pirates_road') enemy.silhouette = 'pirateShip';
    return enemy;
  }
  if (archetype.id === 'inchworm_carrier.freedoms_pass') {
    return createEnemy(x, y, INCHWORM_HEAD_CONSTRUCT, undefined, { moduleScale: 1 });
  }
  const factory = archetype.runtimeFactory;
  if (factory === 'createMortarSkiffEnemy') return createMortarSkiffEnemy(x, y);
  if (factory === 'createRoadBossCarEnemy') return createRoadBossCarEnemy(x, y);
  if (factory === 'createPirateBossEnemy') return createPirateBossEnemy(x, y);
  if (factory === 'createZeppelinBossEnemy') return createZeppelinBossEnemy(x, y);
  if (factory === 'createBossEnemy') return createBossEnemy(x, y);
  if (factory === 'createPirateShipEnemy') return createPirateShipEnemy(x, y, { kind });
  if (factory === 'createEnhancedPirateShipEnemy') return createEnhancedPirateShipEnemy(x, y);
  if (factory === 'createEnhancedEnemy') return createEnhancedEnemy(x, y);
  return createEnemy(x, y);
}

function isBroodableArchetype(archetype) {
  return BROODABLE_ARCHETYPES.has(archetype.id);
}

function createBroodTurretsForEnemy(archetype, road, offset, level, index, kind) {
  if (kind !== 'standard') return [];
  if (isWalkerEnemy(archetype)) return createWalkerBroodEscorts(archetype, road, offset, level, index);
  const count = 1 + ((level + index + archetype.id.length) % 3);
  const velocity = roadDirectionToWorld(0, 1, road);
  const sideDirection = roadDirectionToWorld(1, 0, road);
  const escorts = [];
  for (let i = 0; i < count; i += 1) {
    const side = i - (count - 1) / 2;
    const stagger = CELL_SIZE * (5.2 + i * 1.1);
    const world = roadOffsetToWorld({
      x: offset.x + side * CELL_SIZE * 5.4,
      y: offset.y - stagger,
    }, road);
    const escort = createEnemy(world.x, world.y);
    escort.archetypeId = `${archetype.id}.brood_turret`;
    escort.displayName = `${archetype.displayName ?? 'Enemy'} Brood Turret`;
    escort.zone = archetype.zone;
    escort.palette = archetype.palette ? { ...archetype.palette } : escort.palette;
    escort.vx = velocity.x * 17.5 + sideDirection.x * side * 8;
    escort.vy = velocity.y * 17.5 + sideDirection.y * side * 8;
    applyEnemyLevelUpgrades(escort, level);
    escorts.push(escort);
  }
  return escorts;
}

function createWalkerBroodEscorts(archetype, road, offset, level, index) {
  const alternate = getEnemyArchetype('starlight_walker.prototype0') ?? RUNTIME_ENEMY_ARCHETYPES['starlight_walker.prototype0'];
  if (!alternate) return [];
  const count = 1 + ((level + index + archetype.id.length) % 3);
  const velocity = roadDirectionToWorld(0, 1, road);
  const sideDirection = roadDirectionToWorld(1, 0, road);
  const escorts = [];
  for (let i = 0; i < count; i += 1) {
    const side = i - (count - 1) / 2;
    const stagger = CELL_SIZE * (6.2 + i * 1.2);
    const world = roadOffsetToWorld({
      x: offset.x + side * CELL_SIZE * 6.2,
      y: offset.y - stagger,
    }, road);
    const escort = createEnemyForArchetype(alternate, world.x, world.y, 'standard');
    applyArchetypeRuntimeMetadata(escort, alternate);
    escort.archetypeId = `${archetype.id}.brood_walker`;
    escort.displayName = `${archetype.displayName ?? 'Walker'} Brood Walker`;
    escort.zone = archetype.zone;
    escort.palette = archetype.palette ? { ...archetype.palette } : escort.palette;
    escort.vx = velocity.x * 18 + sideDirection.x * side * 8;
    escort.vy = velocity.y * 18 + sideDirection.y * side * 8;
    applyEnemyLevelUpgrades(escort, level);
    escorts.push(escort);
  }
  return escorts;
}

function createLinkedInchwormEnemies(head, archetype, road, level, index) {
  const segmentCount = Math.min(archetype.segments?.maxCount ?? 8, Math.max(archetype.segments?.minCount ?? 4, 4 + (level + index) % 5));
  const chainId = `inchworm:${level}:${index}:${Math.round(head.x)}:${Math.round(head.y)}`;
  const heading = Math.atan2(head.vy, head.vx);
  head.assetId = INCHWORM_HEAD_CONSTRUCT.assetId;
  head.inchworm = {
    chainId,
    role: 'head',
    segmentIds: [],
    phase: 0,
    heading: Number.isFinite(heading) ? heading : 0,
    baseSpacing: CELL_SIZE * 3.1,
  };
  head.targetId = `${chainId}:head`;
  const backward = roadDirectionToWorld(0, -1, road);
  const segments = [];
  for (let i = 0; i < segmentCount; i += 1) {
    const segment = createEnemy(
      head.x + backward.x * CELL_SIZE * 2.2 * (i + 1),
      head.y + backward.y * CELL_SIZE * 2.2 * (i + 1),
      INCHWORM_SEGMENT_CONSTRUCT,
      [],
      { moduleScale: 1 },
    );
    segment.archetypeId = 'inchworm_segment.freedoms_pass';
    segment.displayName = 'Freedoms Pass Inchworm Segment';
    segment.zone = archetype.zone;
    segment.palette = archetype.palette ? { ...archetype.palette, core: archetype.palette.armor ?? archetype.palette.core } : segment.palette;
    segment.presentation = { variant: 'inchwormCarrier' };
    segment.inchworm = {
      chainId,
      role: 'segment',
      headId: head.targetId,
      chainIndex: i,
      heading: head.inchworm.heading,
      suppressDeathBlast: true,
    };
    segment.targetId = `${chainId}:segment:${i}`;
    segment.vx = head.vx;
    segment.vy = head.vy;
    applyEnemyLevelUpgrades(segment, level);
    head.inchworm.segmentIds.push(segment.targetId);
    segments.push(segment);
  }
  return [head, ...segments];
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
  if (archetype.carBehavior) enemy.carBehavior = structuredClone(archetype.carBehavior);
  if (archetype.scrapFeeding) enemy.scrapFeeding = structuredClone(archetype.scrapFeeding);
  if (enemy.kind === 'roadBossCar' && archetype.carBehavior?.variant) {
    enemy.roadBossCar ??= {};
    enemy.roadBossCar.variant = archetype.carBehavior.variant;
  }
  if (archetype.poseRig) enemy.poseRig = structuredClone(archetype.poseRig);
  if (archetype.entranceBarks) enemy.entranceBarks = structuredClone(archetype.entranceBarks);
  if (archetype.reactionCues) enemy.reactionCues = structuredClone(archetype.reactionCues);
  if ((archetype.movementProfiles ?? []).some((profile) => profile.kind === 'walkerLegs')) {
    const animation = archetype.cellAnimations?.find((entry) => entry.kind === 'legStride') ?? {};
    enemy.poseRig ??= createWalkerStridePoseRig(enemy, {
      amplitude: animation.amplitude ?? CELL_SIZE * 1.6,
      frequency: animation.frequency ?? 0.9,
    });
  }
  if (archetype.id === 'heavy_mortar_boat.pirates_road') enemy.silhouette = 'pirateShip';
  if (archetype.id === 'hopping_stream_mob.digitized_stream') {
    enemy.hopperVisualBias = HOPPER_FROG_VISUAL_SCALE;
  }
  applyDefaultEnemyCueHooks(enemy);
}

function applyDefaultEnemyCueHooks(enemy) {
  if (isOctopusBoss(enemy)) {
    enemy.entranceBarks ??= {
      trigger: 'warning',
      sounds: [SOUND_EVENTS.KRAKEN_ENTER],
      cues: [`${String.fromCodePoint(0x1f419)} !`],
      random: false,
    };
    return enemy;
  }
  if (enemy.kind === 'pirateBoss') {
    enemy.entranceBarks ??= {
      trigger: 'warning',
      sounds: [SOUND_EVENTS.PIRATE_BOSS_ENTRANCE],
      cues: [`${String.fromCodePoint(0x2620)} No quarter!`],
      random: false,
    };
    enemy.reactionCues ??= [
      {
        trigger: 'gunDestroyed',
        texts: PIRATE_GUN_LOSS_CUE_TEXTS,
        duration: 1.9,
        rise: CELL_SIZE * 1.7,
        growth: 2.4,
      },
      {
        trigger: 'corePhasedIn',
        texts: [`${String.fromCodePoint(0x1f621)} No quarter!`],
        sound: SOUND_EVENTS.PIRATE_NO_QUARTER,
        duration: 2.2,
      },
    ];
    return enemy;
  }
  if (isBoatShapedEnemy(enemy)) {
    enemy.entranceBarks ??= {
      trigger: 'warning',
      sounds: PIRATE_ENTRANCE_SOUND_IDS,
      cues: PIRATE_ENTRANCE_CUE_TEXTS,
      random: true,
    };
  }
  if (isCarLikeEnemy(enemy)) {
    enemy.reactionCues ??= [
      { trigger: 'carSpinout', texts: CAR_SPINOUT_CUE_TEXTS, duration: 1.8, rise: CELL_SIZE * 1.6, growth: 2.3 },
      { trigger: 'carPanic', texts: CAR_PANIC_CUE_TEXTS, duration: 1.25, rise: CELL_SIZE * 1.35, growth: 2.2 },
    ];
  }
  return enemy;
}

function isBoatShapedEnemy(enemy) {
  const id = `${enemy?.archetypeId ?? ''} ${enemy?.assetId ?? ''} ${enemy?.displayName ?? ''}`.toLowerCase();
  return enemy?.silhouette === 'pirateShip' || id.includes('pirate') || id.includes('mortar_skiff') || id.includes('mortar boat');
}

function isCarLikeEnemy(enemy) {
  if (enemy?.carBehavior) return true;
  const id = `${enemy?.archetypeId ?? ''} ${enemy?.assetId ?? ''} ${enemy?.displayName ?? ''}`.toLowerCase();
  return /(^|[._\-\s])(?:racecar|race_car|race-car|race car|car|roadster)(?:$|[._\-\s])/.test(id);
}

function usesBoatSilhouetteEnemy(trackName, level) {
  return /^(?:DigitizedStream|PiratesRoad)_/i.test(trackName ?? '');
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
      triggerEnemyEntranceBark(game, entry.enemy, 'warning');
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

function triggerEnemyEntranceBark(game, enemy, trigger) {
  const barks = enemy?.entranceBarks;
  if (!barks || enemy.entranceBarkPlayed || (barks.trigger ?? 'warning') !== trigger) return;
  enemy.entranceBarkPlayed = true;
  const soundId = chooseCueValue(game.rng, barks.sounds, barks.random !== false);
  if (soundId) emitSoundEvent(game, soundId);
  const text = chooseCueValue(game.rng, barks.cues, barks.random !== false);
  if (text) addEnemyReactionCue(enemy, text, barks);
}

function triggerEnemyReactionCue(game, enemy, trigger) {
  const definition = (enemy?.reactionCues ?? []).find((candidate) => candidate.trigger === trigger);
  if (!definition) return;
  const text = chooseCueValue(game.rng, definition.texts ?? definition.cues, definition.random !== false);
  if (text) addEnemyReactionCue(enemy, text, definition);
  if (definition.sound) emitSoundEvent(game, definition.sound);
}

function chooseCueValue(rng, values, random = true) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (!random) return values[0];
  return values[Math.floor((rng?.range(0, values.length) ?? 0))] ?? values[0];
}

function addEnemyReactionCue(enemy, text, definition = {}) {
  enemy.reactionCueQueue ??= [];
  enemy.reactionCueQueue.push({
    text,
    age: 0,
    lifetime: definition.duration ?? 1.8,
    x: definition.x ?? 0,
    y: definition.y ?? -Math.max(CELL_SIZE * 2.8, (enemy.radius ?? CELL_SIZE) * 0.34),
    rise: definition.rise ?? CELL_SIZE * 1.5,
    size: definition.size ?? CELL_SIZE * 0.92,
    growth: definition.growth ?? 2.2,
  });
}

function stepEnemyCueQueue(enemy, dt) {
  const queue = enemy.reactionCueQueue;
  if (!Array.isArray(queue)) return;
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    const cue = queue[index];
    cue.age = (cue.age ?? 0) + dt;
    if (cue.age >= (cue.lifetime ?? 1)) queue.splice(index, 1);
  }
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
    ...game.enemies.map(activeEnemyHarpoonPowerup).filter(Boolean),
    ...game.enemySpawnQueue.map((entry) => entry.enemy),
    ...game.scrapPickups,
    ...(game.harpoonShots ?? []),
    ...game.playerProjectiles,
    ...game.playerProjectiles.map((projectile) => projectile.detonateAtTarget && projectile.targetHint).filter(Boolean),
    ...game.enemyProjectiles.filter((projectile) => !projectile.terrainAnchored),
    ...game.smokeParticles,
    ...game.incomingMarkers,
    ...game.vehicle.detachedPieces,
    game.aiAimReticle,
  ];
  for (const object of objects) {
    if (!object) continue;
    object.x += delta.dx;
    object.y += delta.dy;
  }
}

function activeEnemyHarpoonPowerup(enemy) {
  return enemy?.zeppelin?.harpoonPowerup ?? enemy?.harpoonPowerup ?? null;
}

function stepScrapPickups(game, dt) {
  const collectRange = CELL_SIZE * 2.1 * upgradeMultiplier(game, 'scrapCaptureRadius');
  const magnetRange = VOXEL_SIZE * SHOP_COSTS.scrapMagnetVoxels * upgradeMultiplier(game, 'scrapMagnetDistance');
  const magnetStrength = upgradeMultiplier(game, 'scrapMagnetStrength');
  const clearFieldSweep = shouldSweepRemainingScrap(game);
  const kept = [];
  for (const pickup of game.scrapPickups) {
    const dx = game.vehicle.x - pickup.x;
    const dy = game.vehicle.y - pickup.y;
    const distance = Math.hypot(dx, dy);
    if (clearFieldSweep && distance > 0) {
      const sweepAge = pickup.clearFieldSweepAge ?? 0;
      const sweepScale = 0.25 + Math.min(1, sweepAge / 4) * 0.75;
      const sweepSpeed = clamp(distance * 1.15, 420, 1200);
      const speed = Math.max(sweepSpeed * sweepScale, Math.hypot(pickup.vx, pickup.vy));
      pickup.vx = (dx / distance) * speed;
      pickup.vy = (dy / distance) * speed;
      pickup.clearFieldSweepAge = sweepAge + dt;
      pickup.life = Math.max(pickup.life, distance / speed + 1.1);
    } else if (distance > 0 && distance <= magnetRange) {
      pickup.clearFieldSweepAge = 0;
      const pull = 1 - distance / magnetRange;
      pickup.vx += (dx / distance) * (65 + pull * 130) * magnetStrength * dt;
      pickup.vy += (dy / distance) * (65 + pull * 130) * magnetStrength * dt;
    } else {
      pickup.clearFieldSweepAge = 0;
    }
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.vx *= Math.pow(0.18, dt);
    pickup.vy *= Math.pow(0.18, dt);
    pickup.life -= dt;
    if (distanceSquared(pickup, game.vehicle) <= (collectRange + pickup.radius) ** 2) {
      collectPickup(game, pickup);
      continue;
    }
    if (pickup.life > 0) kept.push(pickup);
  }
  game.scrapPickups = kept;
}

function collectPickup(game, pickup) {
  if (pickup.kind === 'ammoPack') {
    const weapon = game.secondary.selected;
    const capacity = ammoCapacityWithUpgrades(game, weapon);
    if (Number.isFinite(capacity) && capacity > 0 && game.secondary.ammo[weapon] != null) {
      const amount = Math.max(1, Math.ceil(capacity * (pickup.fraction ?? 0.1)));
      game.secondary.ammo[weapon] = Math.min(capacity, game.secondary.ammo[weapon] + amount);
    }
    return;
  }
  if (pickup.kind === 'repairPack') {
    repairVehicleDamage(game.vehicle, pickup.repairPower ?? pickup.value ?? 0, 'all');
    return;
  }
  game.scrap += pickup.value;
  game.score.scrapCollected += pickup.value;
}

function countLiveAttachedVehicleCells(vehicle) {
  return vehicle.cells.filter((cell) => cell.attached && !cell.state?.destroyed).length;
}

function updatePlayerDamageCameraShake(game, liveCellsBeforeDamage, dt) {
  game.playerDamageShake ??= { timer: 0, lostCells: 0 };
  const window = game.playerDamageShake;
  window.timer = Math.max(0, (window.timer ?? 0) - dt);
  if (window.timer <= 0) window.lostCells = 0;
  const lostThisFrame = Math.max(0, liveCellsBeforeDamage - countLiveAttachedVehicleCells(game.vehicle));
  if (lostThisFrame <= 0) return;
  window.timer = 0.5;
  window.lostCells = (window.lostCells ?? 0) + lostThisFrame;
  if (window.lostCells >= 2) {
    addCameraShake(game.camera, Math.min(0.85, 0.25 + window.lostCells * 0.12), 0.36);
    window.lostCells = 0;
  }
}

function shouldSweepRemainingScrap(game) {
  return !activeEnemies(game).some((enemy) => enemyHasLiveCore(enemy));
}

function enemyHasLiveCore(enemy) {
  return enemy.cells?.some((cell) => cell.type === 'core' && !cell.state.destroyed);
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

  const target = gunnerAimTarget(game, input.aiShotLeading !== false);
  if (!target) return input;
  game.aiAimReticle = moveToward(game.aiAimReticle ?? { x: game.vehicle.x, y: game.vehicle.y }, target, 130 * dt);
  game.aimReticle = { ...game.aiAimReticle, active: true, source: 'ai' };
  return { ...input, aimWorld: game.aiAimReticle, manualAimActive: false };
}

function guidedAimInput(game, input, dt) {
  const target = guidedAimTarget(game, input.aiShotLeading !== false);
  if (!target) {
    game.aimReticle = null;
    return { ...input, aimWorld: null, manualAimActive: false };
  }
  if (!game.aiAimReticle || game.aiAimMode !== 'guided' || game.aiAimTargetId !== target.targetId) resetAiAimReticle(game);
  game.aiAimMode = 'guided';
  game.aiAimTargetId = target.targetId;
  const stats = targetingAiStats(game);
  const aimPoint = applyTargetingAiWobble(game, target, stats);
  game.aiAimReticle = moveToward(game.aiAimReticle, aimPoint, stats.reticleSpeed * dt);
  game.aimReticle = { ...game.aiAimReticle, active: true, source: 'ai' };
  stepTargetingAiExperience(game, target.enemy, dt);
  return { ...input, aimWorld: game.aiAimReticle, manualAimActive: false, compensatedAim: game.secondary.selected !== 'beam' };
}

function guidedAimTarget(game, shotLeading = true) {
  const enemy = guidedTarget(game) ?? nearestTargetedEnemy(game);
  if (!enemy) return null;
  if (!shotLeading) {
    return {
      x: enemy.x,
      y: enemy.y,
      enemy,
      targetId: enemyTargetId(enemy),
    };
  }
  const beamSelected = game.secondary.selected === 'beam';
  const projectileSpeed = beamSelected ? 1_000_000 : PRIMARY_PROJECTILE_SPEED;
  const distance = Math.hypot(enemy.x - game.vehicle.x, enemy.y - game.vehicle.y);
  const leadTime = Math.min(beamSelected ? 0.05 : 0.75, distance / projectileSpeed);
  return {
    x: enemy.x + (enemy.vx ?? 0) * leadTime,
    y: enemy.y + (enemy.vy ?? 0) * leadTime,
    enemy,
    targetId: enemyTargetId(enemy),
  };
}

function gunnerAimTarget(game, shotLeading = true) {
  const target = nearestTargetedEnemy(game);
  if (!target) return null;
  if (!shotLeading) return { x: target.x, y: target.y };
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
    resetAiAimReticle(game);
    return null;
  }
  const current = enemies.findIndex((enemy) => enemyTargetId(enemy) === game.guidedTargetId);
  const next = (current + Math.sign(direction || 1) + enemies.length) % enemies.length;
  game.guidedTargetId = enemyTargetId(enemies[next]);
  resetAiAimReticle(game);
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

function createTargetingAiState(initial = {}) {
  const xp = Math.max(0, Number(initial?.xp ?? 0));
  return {
    xp,
    levelStartXp: Math.max(0, Number(initial?.levelStartXp ?? xp)),
    lastLevelXp: Math.max(0, Number(initial?.lastLevelXp ?? 0)),
    activeSeconds: Math.max(0, Number(initial?.activeSeconds ?? 0)),
  };
}

function targetingAiStats(game) {
  const ai = createTargetingAiState(game.targetingAi);
  game.targetingAi = ai;
  const rank = Math.floor(ai.xp / TARGETING_AI_XP_PER_RANK);
  return {
    rank,
    reticleSpeed: TARGETING_AI_BASE_SPEED + rank * TARGETING_AI_SPEED_PER_RANK,
    wobbleRadius: Math.max(2, TARGETING_AI_BASE_WOBBLE * 0.87 ** rank),
  };
}

function stepTargetingAiExperience(game, target, dt) {
  if (!target || dt <= 0) return;
  const ai = createTargetingAiState(game.targetingAi);
  const targetSpeed = Math.hypot(target.vx ?? 0, target.vy ?? 0);
  const fastTargetBonus = clamp(targetSpeed / 180, 0, 1.5) * 0.55;
  ai.xp += dt * (1 + fastTargetBonus);
  ai.activeSeconds += dt;
  game.targetingAi = ai;
}

function updateTargetingAiLevelGain(game) {
  const ai = createTargetingAiState(game.targetingAi);
  ai.lastLevelXp = Math.max(0, ai.xp - (ai.levelStartXp ?? 0));
  game.targetingAi = ai;
}

function startTargetingAiLevel(game) {
  const ai = createTargetingAiState(game.targetingAi);
  ai.levelStartXp = ai.xp;
  ai.lastLevelXp = 0;
  game.targetingAi = ai;
}

function resetAiAimReticle(game) {
  game.aiAimReticle = { x: game.vehicle.x, y: game.vehicle.y };
  game.aiAimTargetId = null;
  game.aiAimMode = null;
}

function applyTargetingAiWobble(game, target, stats) {
  const radius = stats.wobbleRadius;
  if (radius <= 0.1) return { x: target.x, y: target.y };
  const phase = hashStringUnit(target.targetId ?? 'target') * Math.PI * 2;
  const wobbleTime = game.time * (1.15 + stats.rank * 0.04) + phase;
  return {
    x: target.x + Math.cos(wobbleTime) * radius,
    y: target.y + Math.sin(wobbleTime * 0.73 + phase) * radius * 0.72,
  };
}

function hashStringUnit(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 2 ** 32;
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
  if (!hasActiveOrInboundEnemies(game)) return;
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
      tracksReticleInHoming: def.tracksReticleInHoming,
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
      maxRicochets: def.maxRicochets,
      ricochetFactor: def.ricochetFactor,
      ricochetOnEnemyExit: def.ricochetOnEnemyExit,
      absorbsEnemyProjectiles: def.absorbsEnemyProjectiles,
      projectileDeflectionProbability: def.projectileDeflectionProbability,
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
      cooldown: base.cooldown / upgradeMultiplier(game, 'mortarFireRate'),
      damage: base.damage * upgradeMultiplier(game, 'mortarImpactDamage'),
      blastDamage: base.blastDamage * upgradeMultiplier(game, 'mortarBlastDamage'),
      blastRadius: base.blastRadius * upgradeMultiplier(game, 'mortarBlastRadius', Math.sqrt(1.05) - 1),
    };
  }
  if (weaponId === 'blade_launcher') {
    const baseDeflectChance = base.projectileDeflectionProbability ?? 0.25;
    return {
      ...base,
      cooldown: base.cooldown / upgradeMultiplier(game, 'bladeLauncherFireRate'),
      damage: base.damage * upgradeMultiplier(game, 'bladeLauncherImpactDamage'),
      pierce: base.pierce + upgradeLevel(game, 'bladeLauncherPierce'),
      maxRicochets: base.maxRicochets + upgradeLevel(game, 'bladeLauncherMaxRicochets'),
      ricochetFactor: base.ricochetFactor * upgradeMultiplier(game, 'bladeLauncherRicochetFactor'),
      projectileDeflectionProbability: projectileDeflectionChance(baseDeflectChance, upgradeLevel(game, 'bladeLauncherProjectileDeflection')),
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

function hasActiveOrInboundEnemies(game) {
  return activeEnemies(game).length > 0 || game.enemySpawnQueue.some((entry) => entry.markerShown && !entry.enemy?.destroyed);
}

function playerGunFireInterval(game, activeMounts = primaryFiringMounts(game).length) {
  return 0.22 / (upgradeMultiplier(game, 'gunFireRate') * Math.sqrt(Math.max(1, activeMounts + 1)));
}

function primaryWeaponFireInterval(game, def, activeMounts) {
  return def.cooldown / Math.sqrt(Math.max(1, activeMounts + 1));
}

function projectileDeflectionChance(baseChance, levels) {
  return clamp(1 - (1 - clamp(baseChance, 0, 1)) * 0.95 ** Math.max(0, levels), 0, 0.98);
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
  game.enemies = game.enemies.filter((enemy) => shouldKeepEnemyRemnant(game, enemy));
}

function shouldKeepEnemyRemnant(game, enemy) {
  if (!enemy.destroyed) return true;
  if (bossUsesInternalDestruction(enemy) && !enemy.internalDestructionComplete) return true;
  if (enemy.zeppelinWalkerRout && enemy.zeppelinWalkerRout.phase !== 'flee' && !enemy.escaped) return true;
  if (enemy.explosionStart == null) return false;
  return game.time - enemy.explosionStart < (enemy.remnantSeconds ?? DESTROYED_ENEMY_REMNANT_SECONDS);
}

function stepEnemy(game, enemy, dt) {
  applyDefaultEnemyCueHooks(enemy);
  stepEnemyCueQueue(enemy, dt);
  if (enemy.internalDestruction) {
    stepBossInternalDestruction(game, enemy, dt);
    return;
  }
  if (enemy.destroyed) {
    if (bossUsesInternalDestruction(enemy) && !enemy.internalDestructionComplete) {
      startBossInternalDestruction(game, enemy);
      stepBossInternalDestruction(game, enemy, dt);
    }
    return;
  }
  if (enemy.zeppelinWalkerRout) {
    stepZeppelinWalkerRout(game, enemy, dt);
    return;
  }
  if ((enemy.dizzyTimer ?? 0) > 0) {
    stepDizzyEnemy(enemy, dt);
    return;
  }
  if (stepCarSpinout(game, enemy, dt)) return;
  if (enemy.walkerFallAnimation) {
    stepWalkerFallAnimation(game, enemy, dt);
    return;
  }
  enemy.walkerAngerTimer = Math.max(0, (enemy.walkerAngerTimer ?? 0) - dt);
  if (enemy.kind !== 'zeppelinBoss' && enemy.kind !== 'roadBossCar' && enemy.kind !== 'escapePodBoat') steerEnemyBackToLaneCenter(enemy, game.road, dt);
  stepArchetypeEnemy(game, enemy, dt);
  if (enemy.kind === 'enhanced') stepEnhancedEnemy(game, enemy, dt);
  if (enemy.kind === 'boss') stepBossEnemy(game, enemy, dt);
  if (enemy.kind === 'roadBossCar') stepRoadBossCar(game, enemy, dt);
  if (enemy.kind === 'pirateBoss') stepPirateBoss(game, enemy, dt);
  if (enemy.kind === 'zeppelinBoss') stepZeppelinBoss(game, enemy, dt);
  if (enemy.kind === 'escapePodBoat') stepEscapePodBoat(game, enemy, dt);
  triggerEnemyEntranceBark(game, enemy, 'active');
  if (enemy.destroyed) return;
  if (enemyCanFire(enemy) && (enemy.patterns?.length ?? 0) > 0 && !walkerUsesElevatedSpecialWeapon(enemy) && !walkerUsesGroundedSpiralMissiles(enemy)) stepEnemyPatterns(game, enemy, dt);
  updateEnemyVisualHeading(enemy, dt);
  updateEnemyCollisionRotation(enemy, game.time);
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
  if (isWalkerEnemy(enemy)) stepWalkerEnemy(game, enemy, dt);
  if (enemy.archetypeId === 'scrap_buzzard.shadowed_desert') stepScrapBuzzard(game, enemy, dt);
  if (enemy.archetypeId === 'inchworm_carrier.freedoms_pass') stepInchwormCarrier(game, enemy, dt);
  if (enemy.archetypeId === 'inchworm_segment.freedoms_pass') stepInchwormSegment(enemy, dt);
  if (enemy.archetypeId === 'moth_bomber.freedoms_pass') stepMothBomber(game, enemy, dt);
  if (enemy.carBehavior?.movement === 'mineDropper') stepShadowedMineDropper(game, enemy, dt);
  else if (isCarLikeEnemy(enemy)) stepRaceCarEnemy(game, enemy, dt);
}

function stepDizzyEnemy(enemy, dt) {
  enemy.dizzyTimer = Math.max(0, (enemy.dizzyTimer ?? 0) - dt);
  enemy.vx *= Math.pow(0.03, dt);
  enemy.vy *= Math.pow(0.03, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  updateEnemyCollisionRotation(enemy);
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
  enemy.renderAlpha = enemy.phasedOut ? 0.24 : 1;
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
  if (enemyCanFire(enemy)) fireShortEnemyBeam(game, enemy, '#f26cff', 0.65);
}

function stepMortarBoat(game, enemy, dt) {
  if (!enemyCanFire(enemy)) return;
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

  if (!enemyCanFire(enemy)) return;
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
  walkerRuntime(enemy);
  enemy.elevation ??= { z: 0, canBeHitByGroundFire: true, arcCollision: true, layeredExposure: true };
  enemy.elevation.z = 0;
  enemy.elevation.canBeHitByGroundFire = true;
  enemy.elevation.layeredExposure = true;
  enemy.walkPhase = (enemy.walkPhase ?? 0) + dt * 4.4 * enemyMovementUpgradeScale(enemy);
  enemy.vx += Math.sin(enemy.walkPhase) * 6 * dt;
  if (walkerUsesElevatedStaMissile(enemy)) {
    stepWalkerStaMissile(game, enemy, dt);
    enemy.walkerSweepWarning = null;
  } else if (walkerUsesElevatedSweepBeam(enemy)) {
    stepWalkerSweepBeam(game, enemy, dt);
  } else {
    enemy.walkerSweepWarning = null;
    if (walkerUsesGroundedSpiralMissiles(enemy)) stepGroundedWalkerSpiralMissiles(game, enemy, dt);
    if (walkerUsesGroundedRepulsor(enemy)) stepGroundedWalkerRepulsor(game, enemy, dt);
  }
}

function stepWalkerStaMissile(game, enemy, dt) {
  const source = walkerBeamSource(enemy);
  const fireScale = walkerSweepFireScale(enemy, source);
  if (!source || fireScale <= 0 || !enemyCanFire(enemy)) return;

  enemy.walkerStaCooldown = Math.max(0, (enemy.walkerStaCooldown ?? game.rng.range(0.7, 1.8)) - dt * fireScale);
  if (enemy.walkerStaCooldown > 0) return;

  fireWalkerStaMissile(game, enemy, source);
  enemy.walkerStaCooldown = game.rng.range(WALKER_STA_MISSILE_COOLDOWN[0], WALKER_STA_MISSILE_COOLDOWN[1]);
}

function fireWalkerStaMissile(game, enemy, source) {
  const shell = createProjectile(source.x, source.y, 0, 0, {
    team: 'enemy',
    weapon: 'walker-sta-missile',
    behavior: 'arc',
    radius: 3,
    color: '#ff334f',
    sprite: WALKER_STA_MISSILE_SPRITE,
    landingMarkerSprite: MORTAR_ENEMY_MARKER_SPRITE,
    damage: 10 * enemyDamageUpgradeScale(enemy),
    impulse: 82,
    lifetime: 5.2,
    z: source.z,
    verticalVelocity: WALKER_STA_VERTICAL_VELOCITY,
    gravity: WALKER_STA_GRAVITY,
    maxArcHeight: 230,
    shadowRadius: 3.5,
    targetHint: null,
    detonateAtTarget: false,
    descentMode: 'direct',
    directDescentDuration: WALKER_STA_DIRECT_DESCENT_SECONDS,
    hideLandingMarkerUntilTargetHint: true,
    blastOnExpire: {
      radius: WALKER_STA_BLAST_RADIUS,
      damage: 5.5 * enemyDamageUpgradeScale(enemy),
      impulse: 46,
    },
    contrail: ENEMY_RED_BLACK_CONTRAIL,
    zCollision: true,
  });
  shell.angle = -Math.PI / 2;
  game.enemyProjectiles.push(shell);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepGroundedWalkerSpiralMissiles(game, enemy, dt) {
  const source = walkerBeamSource(enemy);
  const fireScale = walkerSweepFireScale(enemy, source);
  if (!source || fireScale <= 0 || !enemyCanFire(enemy)) return;

  enemy.walkerGroundedSpiralCooldown = Math.max(0, (enemy.walkerGroundedSpiralCooldown ?? game.rng.range(0.25, 0.8)) - dt * fireScale);
  if (enemy.walkerGroundedSpiralCooldown > 0) return;

  fireGroundedWalkerSpiralMissile(game, enemy, source);
  enemy.walkerGroundedSpiralIndex = ((enemy.walkerGroundedSpiralIndex ?? 0) + 1) % WALKER_GROUNDED_SPIRAL_COUNT;
  enemy.walkerGroundedSpiralCooldown =
    enemy.walkerGroundedSpiralIndex === 0
      ? WALKER_GROUNDED_SPIRAL_REST
      : WALKER_GROUNDED_SPIRAL_INTERVAL;
}

function fireGroundedWalkerSpiralMissile(game, enemy, source) {
  const index = enemy.walkerGroundedSpiralIndex ?? 0;
  enemy.walkerGroundedSpiralOffset ??= game.rng.range(0, Math.PI * 2);
  const angle = enemy.walkerGroundedSpiralOffset + (Math.PI * 2 * index) / WALKER_GROUNDED_SPIRAL_COUNT;
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, Math.cos(angle) * 27.5, Math.sin(angle) * 27.5, {
      team: 'enemy',
      weapon: 'boss-missile',
      radius: 3,
      color: '#ff5b72',
      sprite: WALKER_STA_MISSILE_SPRITE,
      damage: 9 * enemyDamageUpgradeScale(enemy),
      impulse: 57.5,
      lifetime: 7,
      angle,
      delayBeforeAcceleration: 3,
      stopBeforeAcceleration: true,
      launchWhenFacingTarget: true,
      turnRate: Math.PI * 3.5,
      acceleration: 202.5 * enemyMovementUpgradeScale(enemy),
      accelerationDuration: 10,
      accelerationTarget: game.vehicle,
      accelerationJitter: 0,
      maxSpeed: 840 * enemyMovementUpgradeScale(enemy),
      detonateAtTarget: true,
      blastOnExpire: {
        radius: CELL_SIZE * 2.8,
        damage: 5.5 * enemyDamageUpgradeScale(enemy),
        impulse: 48,
      },
      contrail: ENEMY_RED_BLACK_CONTRAIL,
      vanishOffscreen: true,
    }),
  );
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepGroundedWalkerRepulsor(game, enemy, dt) {
  const source = walkerBeamSource(enemy);
  const fireScale = walkerSweepFireScale(enemy, source);
  if (!source || fireScale <= 0 || !enemyCanFire(enemy) || enemyBeamIsActive(game, enemy, 'walker-repulsor-beam')) return;

  enemy.walkerRepulsorCooldown = Math.max(0, (enemy.walkerRepulsorCooldown ?? game.rng.range(0.35, 1)) - dt * fireScale);
  if (enemy.walkerRepulsorCooldown > 0) return;

  const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, 0, 0, {
      team: 'enemy',
      weapon: 'walker-repulsor-beam',
      behavior: 'beam',
      radius: repulsorBeamDefinition.projectile.radius,
      damage: repulsorBeamDefinition.projectile.damage * enemyDamageUpgradeScale(enemy),
      impulse: repulsorBeamDefinition.projectile.impulse,
      lifetime: Math.max(1, repulsorBeamDefinition.projectile.frames) / 60,
      maxLifetime: Math.max(1, repulsorBeamDefinition.projectile.frames) / 60,
      length: repulsorBeamDefinition.projectile.length,
      frames: repulsorBeamDefinition.projectile.frames,
      angle,
      color: '#dff75d',
      alpha: 0.55,
      pierce: repulsorBeamDefinition.projectile.pierce,
      forceMode: 'push',
      affects: ['player', 'projectile'],
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
      sourceOffset: { x: source.localX, y: source.localY },
      sourceZ: source.z,
    }),
  );
  enemy.walkerRepulsorCooldown = game.rng.range(WALKER_GROUNDED_REPULSOR_COOLDOWN[0], WALKER_GROUNDED_REPULSOR_COOLDOWN[1]);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BEAM);
}

function stepWalkerSweepBeam(game, enemy, dt) {
  const source = walkerBeamSource(enemy);
  const fireScale = walkerSweepFireScale(enemy, source);
  if (!source || fireScale <= 0 || !enemyCanFire(enemy)) {
    enemy.walkerSweepWarning = null;
    return;
  }
  if (enemyBeamIsActive(game, enemy, 'walker-ground-sweep')) return;

  enemy.walkerBeamCooldown = Math.max(0, (enemy.walkerBeamCooldown ?? game.rng.range(0.45, 1.4)) - dt * fireScale);
  if (enemy.walkerBeamCooldown > 0) return;

  const warning = enemy.walkerSweepWarning ?? createWalkerSweepWarning(game, enemy, source);
  enemy.walkerSweepWarning = warning;
  warning.timer -= dt * fireScale;
  warning.source = source;
  warning.source.z = source.z;
  if (warning.timer > 0.45) {
    const targetAngle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
    warning.angle = targetAngle;
    warning.target = {
      x: source.x + Math.cos(targetAngle) * warning.length,
      y: source.y + Math.sin(targetAngle) * warning.length,
    };
  }
  if (warning.timer > 0) return;

  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, 0, 0, {
      team: 'enemy',
      weapon: 'walker-ground-sweep',
      behavior: 'beam',
      radius: 0.75,
      damage: 3.75 * enemyDamageUpgradeScale(enemy),
      impulse: 40,
      lifetime: WALKER_SWEEP_BEAM_FIRE_SECONDS,
      length: Math.max(1, Math.hypot(enemy.x - source.x, enemy.y - source.y)),
      frames: 60,
      angle: Math.atan2(enemy.y - source.y, enemy.x - source.x),
      color: '#ffe36a',
      alpha: 0.86,
      pierce: 1,
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
      sourceOffset: { x: source.localX, y: source.localY },
      sourceZ: source.z,
      endZ: 0,
      widthEnvelopeScale: 0.5,
      sweepBeam: true,
      sweepStart: { x: enemy.x, y: enemy.y },
      sweepTarget: { ...warning.target },
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BEAM);
  enemy.walkerSweepWarning = null;
  enemy.walkerBeamCooldown = game.rng.range(WALKER_SWEEP_BEAM_COOLDOWN[0], WALKER_SWEEP_BEAM_COOLDOWN[1]);
}

function createWalkerSweepWarning(game, enemy, source) {
  const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  const length = WALKER_SWEEP_BEAM_LENGTH;
  return {
    source,
    angle,
    length,
    target: {
      x: source.x + Math.cos(angle) * length,
      y: source.y + Math.sin(angle) * length,
    },
    timer: WALKER_SWEEP_BEAM_CHARGE_SECONDS,
    duration: WALKER_SWEEP_BEAM_CHARGE_SECONDS,
  };
}

function enemyBeamIsActive(game, enemy, weapon) {
  return game.enemyProjectiles.some((projectile) => projectile.weapon === weapon && projectile.sourceEnemy === enemy && projectile.lifetime > 0);
}

function walkerSweepFireScale(enemy, source) {
  if (!source) return 0;
  if (source.fromGun) return enemyFireTimerScale(enemy);
  return enemy.cells.some((cell) => cell.type === 'gun') ? 0 : enemyCoreTimerScale(enemy);
}

function walkerUsesElevatedSweepBeam(enemy) {
  if (walkerUsesElevatedStaMissile(enemy)) return false;
  return walkerUsesElevatedSpecialWeapon(enemy);
}

function walkerUsesElevatedStaMissile(enemy) {
  if (!walkerUsesElevatedSpecialWeapon(enemy)) return false;
  const id = String(enemy.archetypeId ?? '');
  return id.startsWith('starlight_walker.prototype0') || enemy.assetId === spideryWalkerSculptedDefinition.assetId;
}

function walkerUsesGroundedSpiralMissiles(enemy) {
  if (!isWalkerEnemy(enemy) || !walkerBodyIsGrounded(enemy)) return false;
  const id = String(enemy.archetypeId ?? '');
  return id.startsWith('starlight_walker.prototype0') || enemy.assetId === spideryWalkerSculptedDefinition.assetId;
}

function walkerUsesGroundedRepulsor(enemy) {
  if (!isWalkerEnemy(enemy) || !walkerBodyIsGrounded(enemy)) return false;
  return !walkerUsesGroundedSpiralMissiles(enemy);
}

function walkerUsesElevatedSpecialWeapon(enemy) {
  if (!isWalkerEnemy(enemy)) return false;
  const runtime = walkerRuntime(enemy);
  if (!runtime.hasLiveBody) return false;
  return !walkerBodyIsGrounded(enemy);
}

function isWalkerEnemy(enemy) {
  const id = String(enemy?.archetypeId ?? enemy?.id ?? '');
  return id.startsWith('starlight_walker.prototype0') || id.startsWith('twilight_walker.prototype0');
}

function walkerBodyIsGrounded(enemy) {
  return walkerRuntime(enemy).bodyGrounded;
}

function walkerBeamSource(enemy) {
  const runtime = walkerRuntime(enemy);
  const sourceCell = runtime.sourceCell;
  if (!sourceCell) return null;
  const localX = sourceCell.gridX * CELL_SIZE;
  const localY = sourceCell.gridY * CELL_SIZE;
  const world = enemyLocalToWorldPoint(enemy, { x: localX, y: localY });
  return {
    ...world,
    z: enemyCellWorldHeight(enemy, sourceCell),
    cellId: sourceCell.id,
    localX,
    localY,
    fromGun: runtime.sourceFromGun,
  };
}

function enemyCellWorldHeight(enemy, cell) {
  const lowest = isWalkerEnemy(enemy) && enemy.walkerRuntime
    ? enemy.walkerRuntime.lowestLayer
    : lowestLiveCellLayer(enemy);
  const baseElevation = enemy.elevation?.z ?? 0;
  return baseElevation + Math.max(0, cellLayer(cell) - lowest) * CELL_LAYER_HEIGHT * (enemy.visualScale ?? 1);
}

function lowestLiveCellLayer(enemy) {
  const live = enemy.cells?.filter((candidate) => !candidate.state?.destroyed) ?? [];
  return live.length > 0 ? Math.min(...live.map(cellLayer)) : 0;
}

function walkerRuntime(enemy) {
  return enemy.walkerRuntime ?? refreshWalkerRuntime(enemy);
}

function refreshWalkerRuntime(enemy) {
  const live = enemy.cells?.filter((cell) => !cell.state?.destroyed) ?? [];
  const body = [];
  const guns = [];
  const cores = [];
  let lowestLayer = Infinity;
  for (const cell of live) {
    const layer = cellLayer(cell);
    if (layer < lowestLayer) lowestLayer = layer;
    if (cell.type === 'gun' || cell.role === 'turretGun') guns.push(cell);
    if (cell.type === 'core') cores.push(cell);
    if (cell.type === 'core' || cell.type === 'gun' || cell.role === 'elevatedBody' || cell.role === 'turretGun') body.push(cell);
  }
  if (!Number.isFinite(lowestLayer)) lowestLayer = 0;
  const lowestBodyLayer = body.length > 0 ? Math.min(...body.map(cellLayer)) : lowestLayer;
  const sourceFromGun = guns.length > 0;
  const candidates = sourceFromGun ? guns : cores;
  let sourceCell = null;
  for (const candidate of candidates) {
    if (
      !sourceCell ||
      cellLayer(candidate) > cellLayer(sourceCell) ||
      (cellLayer(candidate) === cellLayer(sourceCell) && (
        candidate.gridY < sourceCell.gridY ||
        (candidate.gridY === sourceCell.gridY && (
          candidate.gridX < sourceCell.gridX ||
          (candidate.gridX === sourceCell.gridX && candidate.id.localeCompare(sourceCell.id) < 0)
        ))
      ))
    ) {
      sourceCell = candidate;
    }
  }
  enemy.walkerRuntime = {
    live,
    lowestLayer,
    lowestBodyLayer,
    hasLiveBody: body.length > 0,
    bodyGrounded: body.length === 0 || lowestLayer >= lowestBodyLayer,
    sourceCell,
    sourceFromGun,
  };
  return enemy.walkerRuntime;
}

function cellLayer(cell) {
  return Number.isFinite(cell?.gridZ) ? cell.gridZ : Number.isFinite(cell?.layer) ? cell.layer : 0;
}

function enemyLocalToWorldPoint(enemy, point) {
  const scale = enemy.visualScale ?? 1;
  const rotation = Number.isFinite(enemy.collisionRotation) ? enemy.collisionRotation : 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: enemy.x + (point.x * cos - point.y * sin) * scale,
    y: enemy.y + (point.x * sin + point.y * cos) * scale,
  };
}

function liveEnemyCellWorldCenters(enemy, predicate = () => true) {
  return (enemy.cells ?? [])
    .filter((cell) => !cell.state?.destroyed && predicate(cell))
    .map((cell) => {
      const localX = cell.gridX * CELL_SIZE;
      const localY = cell.gridY * CELL_SIZE;
      return {
        ...enemyLocalToWorldPoint(enemy, { x: localX, y: localY }),
        cellId: cell.id,
        localX,
        localY,
        z: enemyCellWorldHeight(enemy, cell),
      };
    });
}

function stepScrapBuzzard(game, enemy, dt) {
  const state = enemy.buzzard ?? {
    mode: 'air',
    feedValue: 0,
    panicTimer: 0,
    landedLiveCells: 0,
    panicCued: false,
    harpoonSpawnTimer: game.rng.range(2.5, 5),
  };
  enemy.buzzard = state;
  enemy.elevation ??= { z: BUZZARD_AIR_Z, canBeHitByGroundFire: false, arcCollision: true };
  enemy.renderAlpha = 1;
  stepBuzzardHarpoonPowerup(game, enemy, state, dt);
  const scrap = nearestLooseScrap(game, enemy);
  if (scrap && state.mode === 'air') startBuzzardLanding(enemy, state);
  if (state.mode === 'landed') {
    stepLandedBuzzard(game, enemy, state, scrap, dt);
    return;
  }
  if (state.mode === 'takeoff') {
    stepBuzzardTakeoff(game, enemy, state, dt);
    return;
  }
  enemy.elevation.z = BUZZARD_AIR_Z;
  enemy.elevation.canBeHitByGroundFire = false;
  enemy.elevation.arcCollision = true;
  if (scrap) steerBuzzardTowardScrap(game, enemy, scrap, dt);
  enemy.buzzardTimer = (enemy.buzzardTimer ?? game.rng.range(0.8, 1.8)) - dt * enemyAttackRateUpgradeScale(enemy);
  if (enemy.buzzardTimer <= 0) {
    enemy.buzzardTimer = game.rng.range(1.4, 2.2);
    fireEnemyArcShell(game, enemy, { x: enemy.x - enemy.vx * 0.55, y: enemy.y - enemy.vy * 0.55 }, '#d6cfb9');
  }
  const offset = worldToRoadOffset(enemy, game.road);
  if (Math.abs(offset.x) > game.road.halfWidth * 0.62) enemy.vx *= -0.75;
}

function startBuzzardLanding(enemy, state) {
  state.mode = 'landed';
  state.landedLiveCells = liveEnemyCellCount(enemy);
  state.panicTimer = 0;
  state.panicCued = false;
  enemy.patterns = [];
}

function stepLandedBuzzard(game, enemy, state, scrap, dt) {
  enemy.patterns = [];
  enemy.elevation.canBeHitByGroundFire = true;
  enemy.elevation.z += (BUZZARD_LAND_Z - enemy.elevation.z) * Math.min(1, dt * 5.5);
  if (enemy.elevation.z < CELL_LAYER_HEIGHT * 0.9) {
    enemy.elevation.z = BUZZARD_LAND_Z;
  }
  enemy.elevation.arcCollision = true;
  enemy.vx *= Math.pow(0.08, dt);
  enemy.vy *= Math.pow(0.08, dt);
  if (scrap) {
    const direction = directionFromTo(enemy, scrap);
    const speed = 42 * enemyMovementUpgradeScale(enemy);
    enemy.vx += (direction.x * speed - enemy.vx) * Math.min(1, dt * 2.8);
    enemy.vy += (direction.y * speed - enemy.vy) * Math.min(1, dt * 2.8);
    if (distanceSquared(enemy, scrap) <= BUZZARD_FEED_RANGE ** 2) feedBuzzardScrap(game, enemy, state, scrap);
  }
  const liveCells = liveEnemyCellCount(enemy);
  if (!state.panicTimer && state.landedLiveCells > 0 && liveCells < state.landedLiveCells * (2 / 3)) {
    startBuzzardPanicTakeoff(game, enemy, state);
  }
  if (state.panicTimer > 0) {
    state.panicTimer = Math.max(0, state.panicTimer - dt);
    if (state.panicTimer <= 0) state.mode = 'takeoff';
  }
}

function startBuzzardPanicTakeoff(game, enemy, state) {
  state.panicTimer = BUZZARD_PANIC_TAKEOFF_SECONDS;
  if (state.panicCued) return;
  state.panicCued = true;
  for (const [index, text] of BUZZARD_PANIC_CUES.entries()) {
    addEnemyReactionCue(enemy, text, {
      duration: 1.35,
      rise: CELL_SIZE * 1.9,
      size: CELL_SIZE * 0.95,
      growth: 2.5,
      x: (index - 2) * CELL_SIZE * 0.55,
      y: -Math.max(CELL_SIZE * 2.8, enemy.radius * 0.34),
    });
  }
}

function stepBuzzardTakeoff(game, enemy, state, dt) {
  enemy.patterns = [];
  enemy.elevation.canBeHitByGroundFire = true;
  enemy.elevation.z += (BUZZARD_AIR_Z - enemy.elevation.z) * Math.min(1, dt * 3.4);
  const away = directionFromTo(game.vehicle, enemy);
  const speed = 96 * enemyMovementUpgradeScale(enemy);
  enemy.vx += (away.x * speed - enemy.vx) * Math.min(1, dt * 2.4);
  enemy.vy += (away.y * speed - enemy.vy) * Math.min(1, dt * 2.4);
  if (enemy.elevation.z < BUZZARD_AIR_Z * 0.82) return;
  enemy.elevation.z = BUZZARD_AIR_Z;
  enemy.elevation.canBeHitByGroundFire = false;
  state.mode = 'air';
  state.landedLiveCells = liveEnemyCellCount(enemy);
  state.panicTimer = 0;
  state.panicCued = false;
}

function steerBuzzardTowardScrap(game, enemy, scrap, dt) {
  const direction = directionFromTo(enemy, scrap);
  const speed = 92 * enemyMovementUpgradeScale(enemy);
  enemy.vx += (direction.x * speed - enemy.vx) * Math.min(1, dt * 1.9);
  enemy.vy += (direction.y * speed - enemy.vy) * Math.min(1, dt * 1.9);
}

function nearestLooseScrap(game, source) {
  return (game.scrapPickups ?? []).reduce((nearest, pickup) => {
    if (pickup.kind) return nearest;
    if (!nearest) return pickup;
    return distanceSquared(source, pickup) < distanceSquared(source, nearest) ? pickup : nearest;
  }, null);
}

function feedBuzzardScrap(game, enemy, state, pickup) {
  const index = game.scrapPickups.indexOf(pickup);
  if (index >= 0) game.scrapPickups.splice(index, 1);
  const value = Math.max(1, pickup.value ?? 1);
  state.feedValue = (state.feedValue ?? 0) + value;
  healEnemyVoxels(enemy, value * (enemy.scrapFeeding?.scrapHealPerPiece ?? 8));
}

function healEnemyVoxels(enemy, amount) {
  let remaining = Math.max(0, amount);
  for (const cell of enemy.cells ?? []) {
    if (remaining <= 0 || cell.state?.destroyed) continue;
    for (const voxel of cell.mask.flat()) {
      if (remaining <= 0) break;
      if (voxel.hp <= 0 || voxel.hp >= voxel.maxHp) continue;
      const restored = Math.min(remaining, voxel.maxHp - voxel.hp);
      voxel.hp += restored;
      remaining -= restored;
    }
    recalculateEnemyCell(cell);
  }
}

function liveEnemyCellCount(enemy) {
  return (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed).length;
}

function stepInchwormCarrier(game, enemy, dt) {
  const state = enemy.inchworm ?? {
    role: 'head',
    segmentIds: [],
    phase: 0,
    heading: Math.atan2(enemy.vy, enemy.vx),
    baseSpacing: CELL_SIZE * 3.1,
  };
  enemy.inchworm = state;
  state.phase = (state.phase + dt * 0.7 * enemyMovementUpgradeScale(enemy)) % 1;
  const targetHeading = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
  state.heading = turnTowardAngle(Number.isFinite(state.heading) ? state.heading : targetHeading, targetHeading, 0.95 * dt);
  const stretch = 0.5 - Math.cos(state.phase * Math.PI * 2) * 0.5;
  const forward = { x: Math.cos(state.heading), y: Math.sin(state.heading) };
  const desiredSpeed = (18 + stretch * 38) * enemyMovementUpgradeScale(enemy);
  const steer = clamp((2.6 + stretch * 2.2) * dt, 0, 1);
  enemy.vx += (forward.x * desiredSpeed - enemy.vx) * steer;
  enemy.vy += (forward.y * desiredSpeed - enemy.vy) * steer;
  enemy.visualHeading = state.heading;
  stepLinkedInchwormSegments(game, enemy, stretch, dt);
  enemy.spawnTimer = (enemy.spawnTimer ?? game.rng.range(2.2, 4.4)) - dt;
  if (enemy.spawnTimer > 0) return;
  enemy.spawnTimer = game.rng.range(5.5, 8.5);
  const mothArchetype = getEnemyArchetype('moth_bomber.freedoms_pass');
  const moth = mothArchetype
    ? createEnemyForArchetype(mothArchetype, enemy.x + game.rng.range(-CELL_SIZE, CELL_SIZE), enemy.y + CELL_SIZE * 1.4, 'standard')
    : createEnemy(enemy.x + game.rng.range(-CELL_SIZE, CELL_SIZE), enemy.y + CELL_SIZE * 1.4);
  if (mothArchetype) applyArchetypeRuntimeMetadata(moth, mothArchetype);
  else {
    moth.archetypeId = 'moth_bomber.freedoms_pass';
    moth.displayName = 'Freedoms Pass Moth Bomber';
    moth.palette = { core: '#f4eee4', armor: '#b9d990', gun: '#ff7a1a' };
  }
  moth.elevation = { z: MOTH_BOMBER_HOVER_Z, canBeHitByGroundFire: true, arcCollision: true };
  moth.visualScale = Math.min(moth.visualScale ?? 1, 0.62);
  const direction = directionFromTo(moth, game.vehicle);
  moth.vx = direction.x * 112 * enemyMovementUpgradeScale(enemy);
  moth.vy = direction.y * 112 * enemyMovementUpgradeScale(enemy);
  applyEnemyLevelUpgrades(moth, game.level);
  game.enemies.push(moth);
}

function stepLinkedInchwormSegments(game, head, stretch, dt) {
  const ids = head.inchworm?.segmentIds ?? [];
  if (ids.length === 0) return;
  const segments = ids
    .map((id) => game.enemies.find((enemy) => !enemy.destroyed && enemy.targetId === id))
    .filter(Boolean)
    .sort((a, b) => (a.inchworm?.chainIndex ?? 0) - (b.inchworm?.chainIndex ?? 0));
  const heading = head.inchworm?.heading ?? Math.atan2(head.vy, head.vx);
  const forward = { x: Math.cos(heading), y: Math.sin(heading) };
  const baseSpacing = head.inchworm?.baseSpacing ?? CELL_SIZE * 3.1;
  const spacing = baseSpacing * (0.5 + stretch * 0.5);
  let anchor = head;
  for (const segment of segments) {
    segment.inchworm.heading = heading;
    const target = {
      x: anchor.x - forward.x * spacing,
      y: anchor.y - forward.y * spacing,
    };
    const pull = clamp((7.5 + (1 - stretch) * 3.5) * dt, 0, 1);
    segment.vx += ((target.x - segment.x) * 5.5 - segment.vx) * pull;
    segment.vy += ((target.y - segment.y) * 5.5 - segment.vy) * pull;
    segment.visualHeading = heading;
    anchor = segment;
  }
}

function stepInchwormSegment(enemy, dt) {
  enemy.vx *= Math.pow(0.72, dt);
  enemy.vy *= Math.pow(0.72, dt);
}

function stepMothBomber(game, enemy, dt) {
  enemy.patterns = [];
  enemy.elevation ??= { z: MOTH_BOMBER_HOVER_Z, canBeHitByGroundFire: true, arcCollision: true };
  enemy.elevation.z = MOTH_BOMBER_HOVER_Z + Math.sin(game.time * 13 + (enemy.targetId ?? 0)) * CELL_LAYER_HEIGHT * 0.12;
  enemy.elevation.canBeHitByGroundFire = true;
  enemy.elevation.arcCollision = true;
  enemy.visualScale = Math.min(enemy.visualScale ?? 1, 0.62);
  const state = enemy.mothBomber ?? {
    phase: 'orbit',
    fuseRemaining: MOTH_BOMBER_FUSE_SECONDS,
    timer: game.rng.range(0.85, 1.35),
    orbitSign: game.rng.chance(0.5) ? 1 : -1,
    diveTarget: null,
    diveAngle: 0,
    edgeTurnTimer: 0,
    edgeReactionTimer: 0,
    countdownSecond: null,
  };
  enemy.mothBomber = state;
  if (state.detonated) return;

  state.fuseRemaining = Math.max(0, (state.fuseRemaining ?? MOTH_BOMBER_FUSE_SECONDS) - dt);
  state.edgeReactionTimer = Math.max(0, (state.edgeReactionTimer ?? 0) - dt);
  const countdownSecond = Math.max(0, Math.ceil(state.fuseRemaining));
  if (countdownSecond > 0 && countdownSecond !== state.countdownSecond) {
    state.countdownSecond = countdownSecond;
    emitSoundEvent(game, SOUND_EVENTS.MOTH_COUNTDOWN);
  }
  if (state.fuseRemaining <= 0) {
    detonateMothBomber(game, enemy);
    return;
  }

  if ((state.edgeTurnTimer ?? 0) > 0) {
    state.edgeTurnTimer = Math.max(0, state.edgeTurnTimer - dt);
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.visualHeading = state.diveAngle ?? Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
    return;
  }
  if (redirectMothFromPlayAreaEdge(game, enemy, state)) return;

  if (state.phase !== 'dive') {
    state.timer -= dt * enemyAttackRateUpgradeScale(enemy);
    const aim = game.vehicle.turretHeading ?? game.vehicle.heading ?? 0;
    const behind = {
      x: game.vehicle.x - Math.cos(aim) * CELL_SIZE * 10,
      y: game.vehicle.y - Math.sin(aim) * CELL_SIZE * 10,
    };
    const side = CELL_SIZE * (3.5 + Math.sin(game.time * 2.4 + state.orbitSign) * 1.7) * state.orbitSign;
    const target = {
      x: behind.x + Math.cos(aim + Math.PI / 2) * side,
      y: behind.y + Math.sin(aim + Math.PI / 2) * side,
    };
    const direction = directionFromTo(enemy, target);
    const desiredSpeed = 74 * enemyMovementUpgradeScale(enemy);
    const steer = clamp(3.6 * dt, 0, 1);
    enemy.vx += (direction.x * desiredSpeed - enemy.vx) * steer;
    enemy.vy += (direction.y * desiredSpeed - enemy.vy) * steer;
    enemy.visualHeading = Math.atan2(enemy.vy, enemy.vx);
    if (state.timer > 0 && distanceSquared(enemy, target) > (CELL_SIZE * 3.8) ** 2) return;

    state.phase = 'dive';
    state.diveTarget = {
      x: game.vehicle.x + game.vehicle.vx * 0.22,
      y: game.vehicle.y + game.vehicle.vy * 0.22,
    };
    state.diveAngle = Math.atan2(state.diveTarget.y - enemy.y, state.diveTarget.x - enemy.x);
    const speed = Math.max(78, Math.hypot(enemy.vx, enemy.vy));
    enemy.vx = Math.cos(state.diveAngle) * speed;
    enemy.vy = Math.sin(state.diveAngle) * speed;
  }

  if (state.phase === 'dive' && state.diveTarget) {
    const remainingDistance = Math.hypot(state.diveTarget.x - enemy.x, state.diveTarget.y - enemy.y);
    if (remainingDistance > CELL_SIZE * 1.15) {
      enemy.vx += Math.cos(state.diveAngle) * MOTH_BOMBER_DIVE_ACCELERATION * dt * enemyMovementUpgradeScale(enemy);
      enemy.vy += Math.sin(state.diveAngle) * MOTH_BOMBER_DIVE_ACCELERATION * dt * enemyMovementUpgradeScale(enemy);
      const speed = Math.hypot(enemy.vx, enemy.vy);
      const maxSpeed = MOTH_BOMBER_DIVE_SPEED * enemyMovementUpgradeScale(enemy);
      if (speed > maxSpeed) {
        enemy.vx = (enemy.vx / speed) * maxSpeed;
        enemy.vy = (enemy.vy / speed) * maxSpeed;
      }
    } else {
      enemy.vx *= Math.pow(0.12, dt);
      enemy.vy *= Math.pow(0.12, dt);
    }
  }
  if (state.phase === 'dive') enemy.visualHeading = state.diveAngle;
}

function stepRoadBossCar(game, enemy, dt) {
  const state = enemy.roadBossCar ?? {
    phase: 'orbit',
    phaseTimer: ROAD_BOSS_CAR_ORBIT_SECONDS,
    orbitSide: 1,
    strafeSide: game.rng.chance(0.5) ? 1 : -1,
    bladeCooldown: 0.8,
    bulletCooldown: 0.25,
    gunIndex: 0,
  };
  enemy.roadBossCar = state;
  enemy.patterns = [];
  state.phaseTimer = Math.max(0, (state.phaseTimer ?? ROAD_BOSS_CAR_ORBIT_SECONDS) - dt);
  if (state.phase === 'strafe') stepRoadBossCarStrafe(game, enemy, state, dt);
  else stepRoadBossCarOrbit(game, enemy, state, dt);
  if (state.phaseTimer <= 0) toggleRoadBossCarPhase(game, enemy, state);
  if (!enemyCanFire(enemy)) return;
  stepRoadBossCarAttacks(game, enemy, state, dt);
}

function stepRoadBossCarOrbit(game, enemy, state, dt) {
  const toPlayer = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
  const orbitDistance = Math.max(CELL_SIZE * 17, enemy.radius * 0.82);
  const preferred = {
    x: game.vehicle.x + Math.cos(toPlayer + Math.PI / 2) * orbitDistance * (state.orbitSide ?? 1),
    y: game.vehicle.y + Math.sin(toPlayer + Math.PI / 2) * orbitDistance * (state.orbitSide ?? 1),
  };
  const direction = directionFromTo(enemy, preferred);
  const desiredSpeed = ROAD_BOSS_CAR_ORBIT_SPEED * enemyMovementUpgradeScale(enemy);
  const steer = clamp(2.8 * dt, 0, 1);
  enemy.vx += (direction.x * desiredSpeed - enemy.vx) * steer;
  enemy.vy += (direction.y * desiredSpeed - enemy.vy) * steer;
  const movementHeading = Math.atan2(enemy.vy, enemy.vx);
  enemy.visualHeading = Number.isFinite(movementHeading) ? movementHeading : toPlayer;
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
}

function stepRoadBossCarStrafe(game, enemy, state, dt) {
  const offset = worldToRoadOffset(enemy, game.road);
  const exitMargin = Math.max(CELL_SIZE * 7, (enemy.radius ?? CELL_SIZE) * 0.34);
  if (Math.abs(offset.x) > game.road.halfWidth + exitMargin) {
    state.strafeSide = -(state.strafeSide || 1);
    state.strafeRoadY = worldToRoadOffset(game.vehicle, game.road).y + game.rng.range(-CELL_SIZE * 5, CELL_SIZE * 5);
  }
  state.strafeRoadY ??= worldToRoadOffset(game.vehicle, game.road).y;
  const sideVector = roadDirectionToWorld(state.strafeSide || 1, 0, game.road);
  const forwardVector = roadDirectionToWorld(0, 1, game.road);
  const yCorrection = clamp((state.strafeRoadY - offset.y) * 0.9, -ROAD_BOSS_CAR_STRAFE_SPEED * 0.38, ROAD_BOSS_CAR_STRAFE_SPEED * 0.38);
  const desiredSpeed = ROAD_BOSS_CAR_STRAFE_SPEED * enemyMovementUpgradeScale(enemy);
  const desired = {
    x: sideVector.x * desiredSpeed + forwardVector.x * yCorrection,
    y: sideVector.y * desiredSpeed + forwardVector.y * yCorrection,
  };
  const steer = clamp(3.3 * dt, 0, 1);
  enemy.vx += (desired.x - enemy.vx) * steer;
  enemy.vy += (desired.y - enemy.vy) * steer;
  enemy.visualHeading = Math.atan2(enemy.vy, enemy.vx);
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
  enemy.renderHeadingOffset ??= Math.PI / 2;
}

function toggleRoadBossCarPhase(game, enemy, state) {
  if (state.phase === 'strafe') {
    state.phase = 'orbit';
    state.phaseTimer = ROAD_BOSS_CAR_ORBIT_SECONDS;
    state.orbitSide = -(state.orbitSide || 1);
    return;
  }
  state.phase = 'strafe';
  state.phaseTimer = ROAD_BOSS_CAR_STRAFE_SECONDS;
  const offset = worldToRoadOffset(enemy, game.road);
  state.strafeSide = offset.x >= 0 ? -1 : 1;
  state.strafeRoadY = worldToRoadOffset(game.vehicle, game.road).y + game.rng.range(-CELL_SIZE * 4, CELL_SIZE * 4);
}

function stepRoadBossCarAttacks(game, enemy, state, dt) {
  if (state.variant === 'shadowedRoad') stepShadowedRoadBossAttacks(game, enemy, state, dt);
  state.bulletCooldown = Math.max(0, (state.bulletCooldown ?? 0.2) - dt * enemyFireTimerScale(enemy));
  if (state.bulletCooldown <= 0) {
    fireRoadBossBulletBarrage(game, enemy, state);
    state.bulletCooldown = state.phase === 'strafe' ? 0.22 : 0.34;
  }
  state.bladeCooldown = Math.max(0, (state.bladeCooldown ?? 0.8) - dt * enemyFireTimerScale(enemy));
  if (state.bladeCooldown <= 0) {
    fireRoadBossBladeBarrage(game, enemy, state);
    state.bladeCooldown = state.phase === 'strafe' ? 1.15 : 1.55;
  }
}

function stepShadowedRoadBossAttacks(game, enemy, state, dt) {
  state.mineCooldown = Math.max(0, (state.mineCooldown ?? 1.2) - dt * enemyFireTimerScale(enemy));
  if (state.mineCooldown <= 0) {
    dropShadowedRoadMine(game, enemy);
    state.mineCooldown = game.rng.range(1.1, 1.85);
  }
  state.mortarCooldown = Math.max(0, (state.mortarCooldown ?? 0.7) - dt * enemyFireTimerScale(enemy));
  if (state.phase !== 'strafe' || state.mortarCooldown > 0) return;
  state.mortarCooldown = 1.25;
  const source = liveEnemyCellWorldCenters(enemy, (cell) => cell.type === 'gun' && !cell.state?.destroyed)[0] ?? enemy;
  const target = inaccuratePlayerMortarTarget(game, CELL_SIZE * 2.2);
  fireEnemyArcShell(game, { ...enemy, x: source.x, y: source.y }, target, '#ff6d4b', {
    weapon: 'shadowed-road-boss-mortar',
    blastRadius: ENEMY_MORTAR_BASE_BLAST_RADIUS,
    blastDamage: 5.2,
    blastImpulse: 38,
    flightTime: 1.35,
  });
}

function fireRoadBossBulletBarrage(game, enemy, state) {
  const sources = liveEnemyCellWorldCenters(enemy, (cell) => cell.role === 'roadBossBulletGun' && cell.type === 'gun' && !cell.state?.destroyed);
  if (sources.length === 0) return;
  const source = sources[state.gunIndex % sources.length];
  state.gunIndex = (state.gunIndex + 1) % sources.length;
  const baseAngle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  for (let index = 0; index < 5; index += 1) {
    const angle = baseAngle + (index - 2) * 0.075 + game.rng.range(-0.03, 0.03);
    game.enemyProjectiles.push(createProjectile(source.x, source.y, Math.cos(angle) * 176, Math.sin(angle) * 176, {
      team: 'enemy',
      weapon: 'road-boss-bullet',
      radius: 3,
      damage: 8.5 * enemyDamageUpgradeScale(enemy),
      impulse: 56,
      lifetime: 3.6,
      angle,
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
    }));
  }
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = baseAngle;
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireRoadBossBladeBarrage(game, enemy, state) {
  const blade = PRIMARY_WEAPON_DEFINITIONS.blade_launcher;
  const sources = liveEnemyCellWorldCenters(enemy, (cell) => cell.role === 'roadBossBladeLauncher' && cell.type === 'gun' && !cell.state?.destroyed);
  if (sources.length === 0) return;
  const source = sources[state.gunIndex % sources.length];
  state.gunIndex = (state.gunIndex + 1) % sources.length;
  const baseAngle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  for (let index = 0; index < 3; index += 1) {
    const angle = baseAngle + (index - 1) * 0.16 + game.rng.range(-0.04, 0.04);
    game.enemyProjectiles.push(createProjectile(source.x, source.y, Math.cos(angle) * (blade.projectileSpeed * 0.86), Math.sin(angle) * (blade.projectileSpeed * 0.86), {
      team: 'enemy',
      weapon: 'road-boss-blade',
      behavior: blade.behavior,
      radius: blade.radius * 1.5,
      damage: blade.damage * 0.8 * enemyDamageUpgradeScale(enemy),
      impulse: blade.impulse * 1.1,
      lifetime: blade.lifetime,
      angle,
      pierce: blade.pierce,
      pierceDamageScale: blade.pierceDamageScale,
      pierceDamageFalloff: blade.pierceDamageFalloff,
      damagePiercesUntilSpent: blade.damagePiercesUntilSpent,
      sprite: blade.sprite ? {
        ...blade.sprite,
        displaySize: [blade.sprite.displaySize[0] * 1.5, blade.sprite.displaySize[1] * 1.5],
      } : null,
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
    }));
  }
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = baseAngle;
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepEscapePodBoat(game, enemy, dt) {
  const state = enemy.escapePod ?? {};
  enemy.escapePod = state;
  enemy.patterns = [];
  state.cueTimer = Math.max(0, (state.cueTimer ?? 0) - dt);
  if (state.cueTimer <= 0) {
    addEnemyReactionCue(enemy, chooseCueValue(game.rng, [`${String.fromCodePoint(0x2620)} !`, 'Yargh!', ROAD_BOSS_TAUNT_CUE_TEXT], true), {
      duration: 1.7,
      rise: CELL_SIZE * 1.5,
      growth: 2.2,
    });
    state.cueTimer = game.rng.range(0.65, 1.05);
  }
  const angle = state.heading ?? enemy.visualHeading ?? 0;
  const speed = (state.speed ?? 120) * enemyMovementUpgradeScale(enemy);
  enemy.vx += (Math.cos(angle) * speed - enemy.vx) * clamp(4.2 * dt, 0, 1);
  enemy.vy += (Math.sin(angle) * speed - enemy.vy) * clamp(4.2 * dt, 0, 1);
  enemy.visualHeading = angle;
  enemy.collisionRotation = angle - Math.PI / 2;
  const offset = worldToRoadOffset(enemy, game.road);
  if (Math.abs(offset.x) > game.road.halfWidth + CELL_SIZE * 24 || Math.abs(offset.y) > game.road.halfHeight + CELL_SIZE * 24) {
    enemy.destroyed = true;
    enemy.explosionStart = game.time;
  }
}

function stepPirateBoss(game, enemy, dt) {
  const state = enemy.pirateBoss ?? {
    orbitSide: 1,
    mortarCooldown: 1.1,
    sideCooldown: 0.35,
    sideIndex: 0,
    noQuarterPlayed: false,
    liveGunIds: [],
  };
  enemy.pirateBoss = state;
  stepPirateBossGunLossReactions(game, enemy, state);
  stepPirateBossMovement(game, enemy, state, dt);
  if (!enemyCanFire(enemy)) return;
  stepPirateBossMortars(game, enemy, state, dt);
  stepPirateBossSideGuns(game, enemy, state, dt);
}

function stepRaceCarEnemy(game, enemy, dt) {
  const config = enemy.carBehavior;
  if (!config || (config.movement ?? config.kind) !== 'raceStrafe') return;
  enemy.patterns = [];
  const state = enemy.carRuntime ?? {};
  if (!Number.isFinite(state.side) || state.side === 0) state.side = game.rng.chance(0.5) ? 1 : -1;
  if (!Number.isFinite(state.flechetteCooldown)) state.flechetteCooldown = game.rng.range(0.15, 0.45);
  enemy.carRuntime = state;
  const offset = worldToRoadOffset(enemy, game.road);
  const exitMargin = Math.max(enemy.radius ?? CELL_SIZE, CELL_SIZE * 5);
  if (offset.x * state.side > game.road.halfWidth + exitMargin) state.side *= -1;
  const sideVector = roadDirectionToWorld(state.side, 0, game.road);
  const playerDirection = directionFromTo(enemy, game.vehicle);
  const desiredSpeed = (config.speed ?? RACE_CAR_STRAFE_SPEED) * enemyMovementUpgradeScale(enemy);
  const driftBias = config.playerDriftBias ?? 0.18;
  const desired = {
    x: sideVector.x * desiredSpeed + playerDirection.x * desiredSpeed * driftBias,
    y: sideVector.y * desiredSpeed + playerDirection.y * desiredSpeed * driftBias,
  };
  const steer = clamp((config.steer ?? 4.8) * dt, 0, 1);
  enemy.vx += (desired.x - enemy.vx) * steer;
  enemy.vy += (desired.y - enemy.vy) * steer;
  enemy.visualHeading = Math.atan2(enemy.vy, enemy.vx);
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;

  if (!enemyCanFire(enemy)) return;
  state.flechetteCooldown = Math.max(0, (state.flechetteCooldown ?? RACE_CAR_FLECHETTE_COOLDOWN) - dt * enemyFireTimerScale(enemy));
  if (state.flechetteCooldown > 0) return;
  state.flechetteCooldown = config.flechetteCooldown ?? RACE_CAR_FLECHETTE_COOLDOWN;
  fireRaceCarFlechetteStrafe(game, enemy);
}

function stepShadowedMineDropper(game, enemy, dt) {
  const config = enemy.carBehavior ?? {};
  const state = enemy.carRuntime ?? {};
  enemy.carRuntime = state;
  enemy.patterns = [];
  const playerOffset = worldToRoadOffset(game.vehicle, game.road);
  const currentOffset = worldToRoadOffset(enemy, game.road);
  const targetOffset = {
    x: clamp(playerOffset.x + Math.sin(game.time * 0.9 + (enemy.targetId ?? 0)) * CELL_SIZE * 6, -game.road.halfWidth * 0.84, game.road.halfWidth * 0.84),
    y: -game.road.halfHeight - Math.max(CELL_SIZE * 2.5, (enemy.radius ?? CELL_SIZE) * 0.24),
  };
  const target = roadOffsetToWorld(targetOffset, game.road);
  const direction = directionFromTo(enemy, target);
  const speed = (config.speed ?? SHADOWED_MINE_DROPPER_SPEED) * enemyMovementUpgradeScale(enemy);
  const steer = clamp(2.7 * dt, 0, 1);
  enemy.vx += (direction.x * speed - enemy.vx) * steer;
  enemy.vy += (direction.y * speed - enemy.vy) * steer;
  if (Math.abs(currentOffset.x) > game.road.halfWidth * 0.96) enemy.vx *= 0.5;
  const roadForward = roadDirectionToWorld(0, 1, game.road);
  const localVelocity = worldDirectionToRoad({ x: enemy.vx, y: enemy.vy }, game.road);
  const lateralLean = clamp(localVelocity.x / Math.max(1, speed), -1, 1) * MINE_DROPPER_MAX_VISUAL_LEAN;
  const targetVisualHeading = Math.atan2(roadForward.y, roadForward.x) + lateralLean;
  enemy.visualHeading = turnTowardAngle(enemy.visualHeading ?? targetVisualHeading, targetVisualHeading, 2.4 * dt);
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
  enemy.renderHeadingOffset ??= Math.PI / 2;
  if (!enemyCanFire(enemy)) return;
  state.mineCooldown = Math.max(0, (state.mineCooldown ?? game.rng.range(...SHADOWED_MINE_COOLDOWN)) - dt * enemyFireTimerScale(enemy));
  if (state.mineCooldown > 0) return;
  state.mineCooldown = game.rng.range(...SHADOWED_MINE_COOLDOWN);
  dropShadowedRoadMine(game, enemy);
}

function dropShadowedRoadMine(game, enemy) {
  const source = liveEnemyCellWorldCenters(enemy, (cell) => cell.type === 'gun' && !cell.state?.destroyed)[0] ?? enemy;
  const drift = roadDirectionToWorld(0, 1, game.road);
  const mine = createProjectile(source.x + drift.x * CELL_SIZE * 1.8, source.y + drift.y * CELL_SIZE * 1.8, 0, 0, {
    team: 'enemy',
    weapon: 'shadowed-road-mine',
    behavior: 'ballistic',
    radius: SHADOWED_MINE_RADIUS,
    color: '#ff5a54',
    sprite: {
      ...MORTAR_ENEMY_SHELL_SPRITE,
      displaySize: MORTAR_ENEMY_SHELL_SPRITE.displaySize.map((value) => value * 1.45),
    },
    landingMarkerSprite: MORTAR_ENEMY_MARKER_SPRITE,
    damage: 0,
    impulse: 0,
    lifetime: SHADOWED_MINE_FUSE_SECONDS,
    targetHint: null,
    explodeOnExpire: true,
    terrainAnchored: true,
    countdown: true,
    blastOnExpire: {
      radius: SHADOWED_MINE_BLAST_RADIUS,
      damage: SHADOWED_MINE_BLAST_DAMAGE * enemyDamageUpgradeScale(enemy),
      impulse: 42,
    },
    sourceEnemy: enemy,
  });
  game.enemyProjectiles.push(mine);
  enemy.lastFiredAt = game.time;
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepCarSpinout(game, enemy, dt) {
  if (!isCarLikeEnemy(enemy)) return false;
  const state = enemy.carRuntime ?? {};
  enemy.carRuntime = state;
  state.wheelGroups ??= buildWheelBlockGroups(enemy);
  if (!state.spinout) {
    const destroyedBlocks = countDestroyedWheelBlockGroups(state.wheelGroups);
    const threshold = enemy.carBehavior?.spinout?.wheelBlocksDestroyed ?? 2;
    if (destroyedBlocks <= threshold) return false;
    startCarSpinout(game, enemy, state);
  }
  stepActiveCarSpinout(game, enemy, state, dt);
  return true;
}

function startCarSpinout(game, enemy, state) {
  state.spinout = {
    phase: 'spin',
    timer: RACE_CAR_SPINOUT_SECONDS,
    duration: RACE_CAR_SPINOUT_SECONDS,
    cueTimer: 0,
    explosionTimer: 0,
    spinRate: (state.side || 1) * game.rng.range(Math.PI * 3.2, Math.PI * 4.7),
  };
  enemy.patterns = [];
  triggerEnemyReactionCue(game, enemy, 'carSpinout');
}

function stepActiveCarSpinout(game, enemy, state, dt) {
  const spinout = state.spinout;
  spinout.timer = Math.max(0, spinout.timer - dt);
  spinout.cueTimer = Math.max(0, (spinout.cueTimer ?? 0) - dt);
  enemy.vx *= Math.pow(0.34, dt);
  enemy.vy *= Math.pow(0.34, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.visualHeading = (enemy.visualHeading ?? 0) + (spinout.spinRate ?? Math.PI * 3.8) * dt;
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
  if (spinout.phase === 'spin') {
    if (spinout.cueTimer <= 0) {
      triggerEnemyReactionCue(game, enemy, 'carSpinout');
      spinout.cueTimer = 0.52;
    }
    if (spinout.timer > 0) return;
    spinout.phase = 'panic';
    spinout.timer = RACE_CAR_PANIC_SECONDS;
    spinout.duration = RACE_CAR_PANIC_SECONDS;
    spinout.cueTimer = 0;
    spinout.explosionTimer = 0;
    return;
  }

  spinout.explosionTimer = Math.max(0, (spinout.explosionTimer ?? 0) - dt);
  if (spinout.explosionTimer <= 0) {
    emitRandomBossInternalExplosionSound(game);
    spawnBossInternalBlastEffect(game, enemy);
    spinout.explosionTimer = game.rng.range(0.15, 0.28);
  }
  if (spinout.cueTimer <= 0) {
    triggerEnemyReactionCue(game, enemy, 'carPanic');
    spinout.cueTimer = 0.22;
  }
  if (spinout.timer > 0) return;
  enemy.destroyed = true;
  explodeEnemy(game, enemy);
}

function buildWheelBlockGroups(enemy) {
  const wheelCells = (enemy.cells ?? []).filter(isWheelCell);
  const unvisited = new Set(wheelCells);
  const groups = [];
  while (unvisited.size > 0) {
    const start = unvisited.values().next().value;
    const queue = [start];
    const cells = [];
    unvisited.delete(start);
    while (queue.length > 0) {
      const cell = queue.shift();
      cells.push(cell);
      for (const neighbor of wheelCells) {
        if (!unvisited.has(neighbor) || !wheelCellsConnected(enemy, cell, neighbor)) continue;
        unvisited.delete(neighbor);
        queue.push(neighbor);
      }
    }
    groups.push({ cells });
  }
  return groups;
}

function isWheelCell(cell) {
  const marker = `${cell?.type ?? ''} ${cell?.role ?? ''} ${cell?.wheelBlockId ?? ''} ${cell?.damageGroup ?? ''}`.toLowerCase();
  return marker.includes('wheel');
}

function wheelCellsConnected(enemy, a, b) {
  if (!a || !b || a === b) return false;
  if (a.wheelBlockId && b.wheelBlockId && a.wheelBlockId === b.wheelBlockId) return true;
  if (a.damageGroup && b.damageGroup && a.damageGroup === b.damageGroup && a.damageGroup !== 'wheels') return true;
  if (explicitlyConnected(enemy, a.id, b.id)) return true;
  const sameLayer = cellLayer(a) === cellLayer(b);
  return sameLayer && Math.abs(a.gridX - b.gridX) + Math.abs(a.gridY - b.gridY) === 1;
}

function explicitlyConnected(enemy, aId, bId) {
  return (enemy.connections ?? []).some((connection) => (
    (connection.a === aId && connection.b === bId) ||
    (connection.a === bId && connection.b === aId)
  ));
}

function countDestroyedWheelBlockGroups(groups) {
  return (groups ?? []).filter((group) => group.cells.length > 0 && group.cells.every((cell) => cell.state?.destroyed)).length;
}

function fireRaceCarFlechetteStrafe(game, enemy) {
  const sources = liveEnemyCellWorldCenters(enemy, (cell) => cell.type === 'gun' && !cell.state?.destroyed);
  const source = sources[Math.floor(game.rng.range(0, sources.length))] ?? { x: enemy.x, y: enemy.y };
  const baseAngle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  for (let index = 0; index < 5; index += 1) {
    const angle = baseAngle + (index - 2) * 0.12 + game.rng.range(-0.035, 0.035);
    game.enemyProjectiles.push(
      createProjectile(source.x, source.y, Math.cos(angle) * 172, Math.sin(angle) * 172, {
        team: 'enemy',
        weapon: 'race-car-flechette',
        behavior: 'homing',
        radius: 1.35,
        damage: 4.5 * enemyDamageUpgradeScale(enemy),
        impulse: 32,
        lifetime: 4.2,
        pierce: 1,
        angle,
        color: '#ffd166',
        sprite: trackingFlechetteDefinition.projectile.sprite,
        delayBeforeAcceleration: 0.35,
        stopBeforeAcceleration: true,
        acceleration: 450 * enemyMovementUpgradeScale(enemy),
        accelerationDuration: 3,
        maxSpeed: 825 * enemyMovementUpgradeScale(enemy),
        accelerationTarget: { x: game.vehicle.x, y: game.vehicle.y },
        accelerationJitter: game.rng.range(-0.04, 0.04),
        sourceEnemy: enemy,
        sourceCellId: source.cellId,
      }),
    );
  }
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = baseAngle;
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepPirateBossGunLossReactions(game, enemy, state) {
  const liveGuns = (enemy.cells ?? []).filter((cell) => cell.type === 'gun' && !cell.state?.destroyed);
  const liveIds = new Set(liveGuns.map((cell) => cell.id));
  const previous = Array.isArray(state.liveGunIds) ? state.liveGunIds : [];
  const lostCount = previous.filter((id) => !liveIds.has(id)).length;
  for (let index = 0; index < Math.min(3, lostCount); index += 1) triggerEnemyReactionCue(game, enemy, 'gunDestroyed');
  state.liveGunIds = [...liveIds];
  state.liveGunPods = livePirateBossGunPodCount(enemy);
  state.coreProtected = state.liveGunPods >= 2;
  if (!state.coreProtected && !state.noQuarterPlayed) {
    state.noQuarterPlayed = true;
    triggerEnemyReactionCue(game, enemy, 'corePhasedIn');
  }
}

function stepPirateBossMovement(game, enemy, state, dt) {
  const toPlayer = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
  const orbitDistance = Math.max(CELL_SIZE * 18, enemy.radius * 0.86);
  const preferred = {
    x: game.vehicle.x + Math.cos(toPlayer + Math.PI / 2) * orbitDistance * (state.orbitSide ?? 1),
    y: game.vehicle.y + Math.sin(toPlayer + Math.PI / 2) * orbitDistance * (state.orbitSide ?? 1),
  };
  const offset = worldToRoadOffset(enemy, game.road);
  if (Math.abs(offset.x) > game.road.halfWidth * 0.72) state.orbitSide = -(state.orbitSide || 1);
  const direction = directionFromTo(enemy, preferred);
  const desiredSpeed = PIRATE_BOSS_ORBIT_SPEED * enemyMovementUpgradeScale(enemy);
  const steer = clamp(2.6 * dt, 0, 1);
  enemy.vx += (direction.x * desiredSpeed - enemy.vx) * steer;
  enemy.vy += (direction.y * desiredSpeed - enemy.vy) * steer;
  enemy.visualHeading = closestBroadsideHeading(enemy.visualHeading ?? toPlayer + Math.PI / 2, toPlayer);
  enemy.collisionRotation = enemy.visualHeading - Math.PI / 2;
}

function stepPirateBossMortars(game, enemy, state, dt) {
  state.mortarCooldown = Math.max(0, (state.mortarCooldown ?? 1) - dt * enemyFireTimerScale(enemy));
  if (state.mortarCooldown > 0) return;
  state.mortarCooldown = state.mortarMode === 'frontHeavy' ? 2.4 : 1.25;
  if (state.mortarMode === 'frontHeavy') {
    const source = averageSource(pirateBossGunSources(enemy, 'pirateBossFrontGun')) ?? enemy;
    const target = inaccuratePlayerMortarTarget(game, CELL_SIZE * 2.6);
    fireEnemyArcShell(game, { ...enemy, x: source.x, y: source.y }, target, '#ff8a3d', {
      weapon: 'pirate-boss-heavy-mortar',
      blastRadius: PIRATE_BOSS_FRONT_MORTAR_RADIUS,
      blastDamage: 7.5,
      blastImpulse: 42,
    });
    enemy.attackHeading = Math.atan2(target.y - source.y, target.x - source.x);
    state.mortarMode = 'rearLine';
  } else {
    const rearSources = pirateBossGunSources(enemy, 'pirateBossRearGun');
    const source = rearSources[Math.floor(game.rng.range(0, rearSources.length))] ?? averageSource(rearSources) ?? enemy;
    fireEnemyMortarLineFromSource(game, enemy, source, 5, {
      weapon: 'pirate-boss-line-mortar',
      blastRadius: ENEMY_MORTAR_BASE_BLAST_RADIUS,
      firstImpactSeconds: 1.1,
      spacingSeconds: 0.18,
      spread: CELL_SIZE * 0.9,
    });
    enemy.attackHeading = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
    state.mortarMode = 'frontHeavy';
  }
  enemy.lastFiredAt = game.time;
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function stepPirateBossSideGuns(game, enemy, state, dt) {
  state.sideCooldown = Math.max(0, (state.sideCooldown ?? 0.4) - dt * enemyFireTimerScale(enemy));
  if (state.sideCooldown > 0) return;
  const sources = pirateBossBroadsideSources(enemy, game.vehicle);
  if (sources.length === 0) return;
  const source = sources[state.sideIndex % sources.length];
  state.sideIndex = (state.sideIndex + 1) % sources.length;
  const range = Math.hypot(game.vehicle.x - enemy.x, game.vehicle.y - enemy.y);
  if (range > PIRATE_BOSS_SHIP_LENGTH) {
    firePirateBossBroadsideBullet(game, enemy, source);
    state.sideCooldown = 0.16;
  } else {
    firePirateBossShotgunFlechettes(game, enemy, source);
    state.sideCooldown = 0.62;
  }
  enemy.lastFiredAt = game.time;
  enemy.attackHeading = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function pirateBossBroadsideSources(enemy, target) {
  const all = pirateBossGunSources(enemy, 'pirateBossSideGun');
  if (all.length <= 1) return all;
  const rotation = Number.isFinite(enemy.collisionRotation)
    ? enemy.collisionRotation
    : Number.isFinite(enemy.visualHeading)
      ? enemy.visualHeading - Math.PI / 2
      : 0;
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
  const side = localY >= 0 ? 1 : -1;
  const matching = all.filter((source) => Math.sign(source.localY || 0) === side);
  return matching.length > 0 ? matching : all;
}

function pirateBossGunSources(enemy, role) {
  return (enemy.cells ?? [])
    .filter((cell) => cell.role === role && cell.type === 'gun' && !cell.state?.destroyed)
    .map((cell) => {
      const localX = cell.gridX * CELL_SIZE;
      const localY = cell.gridY * CELL_SIZE;
      return {
        ...enemyLocalToWorldPoint(enemy, { x: localX, y: localY }),
        localX,
        localY,
        cellId: cell.id,
      };
    });
}

function averageSource(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null;
  return {
    x: sources.reduce((sum, source) => sum + source.x, 0) / sources.length,
    y: sources.reduce((sum, source) => sum + source.y, 0) / sources.length,
    localX: sources.reduce((sum, source) => sum + (source.localX ?? 0), 0) / sources.length,
    localY: sources.reduce((sum, source) => sum + (source.localY ?? 0), 0) / sources.length,
  };
}

function firePirateBossBroadsideBullet(game, enemy, source) {
  const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x) + game.rng.range(-0.045, 0.045);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, Math.cos(angle) * 152, Math.sin(angle) * 152, {
      team: 'enemy',
      weapon: 'pirate-boss-broadside',
      radius: 3.4,
      damage: 11 * enemyDamageUpgradeScale(enemy),
      impulse: 82,
      lifetime: 4,
      angle,
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
    }),
  );
}

function firePirateBossShotgunFlechettes(game, enemy, source) {
  const baseAngle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  for (let index = 0; index < 7; index += 1) {
    const spread = (index - 3) * 0.13 + game.rng.range(-0.035, 0.035);
    const angle = baseAngle + spread;
    game.enemyProjectiles.push(
      createProjectile(source.x, source.y, Math.cos(angle) * 182, Math.sin(angle) * 182, {
        team: 'enemy',
        weapon: 'pirate-boss-flechette',
        radius: 1.55,
        damage: 5.5 * enemyDamageUpgradeScale(enemy),
        impulse: 38,
        lifetime: 2.8,
        pierce: 1,
        angle,
        color: '#ffd166',
        sourceEnemy: enemy,
        sourceCellId: source.cellId,
      }),
    );
  }
}

function redirectMothFromPlayAreaEdge(game, enemy, state) {
  const offset = worldToRoadOffset(enemy, game.road);
  const visualScale = enemy.radiusIncludesVisualScale ? 1 : enemy.visualScale ?? 1;
  const visualRadius = Math.max(CELL_SIZE * 0.75, (enemy.radius ?? CELL_SIZE) * visualScale);
  const halfWidth = Math.max(CELL_SIZE, game.road.halfWidth - visualRadius * 0.9);
  const halfHeight = Math.max(CELL_SIZE, game.road.halfHeight - visualRadius * 0.9);
  const clamped = {
    x: clamp(offset.x, -halfWidth, halfWidth),
    y: clamp(offset.y, -halfHeight, halfHeight),
  };
  if (Math.abs(clamped.x - offset.x) <= 0.001 && Math.abs(clamped.y - offset.y) <= 0.001) return false;

  const world = roadOffsetToWorld(clamped, game.road);
  enemy.x = world.x;
  enemy.y = world.y;
  enemy.vx = 0;
  enemy.vy = 0;
  state.phase = 'dive';
  state.diveTarget = {
    x: game.vehicle.x + game.vehicle.vx * 0.12,
    y: game.vehicle.y + game.vehicle.vy * 0.12,
  };
  state.diveAngle = Math.atan2(state.diveTarget.y - enemy.y, state.diveTarget.x - enemy.x);
  state.edgeTurnTimer = MOTH_BOMBER_EDGE_TURN_SECONDS;
  state.edgeReactionTimer = 0.85;
  enemy.visualHeading = state.diveAngle;
  return true;
}

function detonateMothBomber(game, enemy) {
  if (enemy.mothBomber?.detonated) return;
  enemy.mothBomber ??= {};
  enemy.mothBomber.detonated = true;
  const origin = { x: enemy.x, y: enemy.y };
  game.enemyProjectiles.push(
    createProjectile(origin.x, origin.y, 0, 0, {
      team: 'enemy',
      weapon: 'moth-bomber-blast',
      behavior: 'blast',
      radius: 1,
      maxRadius: MOTH_BOMBER_BLAST_RADIUS,
      damage: 0,
      impulse: 0,
      lifetime: 0.22,
      color: '#ff8a3d',
      sourceEnemy: enemy,
    }),
  );
  damageEnemiesFromMothBlast(game, enemy, origin);
  if (distanceSquared(game.vehicle, origin) <= (MOTH_BOMBER_BLAST_RADIUS + CELL_SIZE * 3.8) ** 2) {
    applyVehicleDamage(game.vehicle, origin, MOTH_BOMBER_BLAST_RADIUS, MOTH_BOMBER_BLAST_DAMAGE, 92, directionFromTo(origin, game.vehicle));
  }
  for (let index = 0; index < 7; index += 1) {
    const angle = game.rng.range(0, Math.PI * 2);
    const distance = Math.sqrt(game.rng.next()) * MOTH_BOMBER_BLAST_RADIUS * 3;
    const target = {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
    };
    fireEnemyArcShell(game, { ...enemy, x: origin.x, y: origin.y }, target, '#ff6d4b', {
      weapon: 'moth-scatter-mortar',
      flightTime: game.rng.range(0.7, 1.25),
      gravity: 116,
      blastRadius: MOTH_BOMBER_BLAST_RADIUS,
      blastDamage: MOTH_BOMBER_BLAST_DAMAGE,
      blastImpulse: 52,
      enemyIgnoreTags: MOTH_BOMBER_FRIENDLY_FIRE_IGNORE_TAGS,
    });
  }
  enemy.destroyed = true;
  explodeEnemy(game, enemy);
}

function damageEnemiesFromMothBlast(game, sourceEnemy, origin) {
  for (const target of activeEnemies(game)) {
    if (target === sourceEnemy || enemyHasAnyTag(target, MOTH_BOMBER_FRIENDLY_FIRE_IGNORE_TAGS)) continue;
    if (distanceSquared(target, origin) > (target.radius + MOTH_BOMBER_BLAST_RADIUS) ** 2) continue;
    const hit = applyEnemyBlastDamage(target, origin, {
      maxVoxelDistance: Math.max(1, MOTH_BOMBER_BLAST_RADIUS / VOXEL_SIZE),
      closeVoxelDistance: 3,
      closePenetration: 2,
      farPenetration: 1,
      damage: MOTH_BOMBER_BLAST_DAMAGE,
    });
    if (hit.destroyedNow) explodeEnemy(game, target);
    knockEnemyFromPoint(target, origin, target.radius + MOTH_BOMBER_BLAST_RADIUS, 52);
  }
}

function stepZeppelinBoss(game, enemy, dt) {
  enemy.elevation ??= { z: CELL_LAYER_HEIGHT * 14, canBeHitByGroundFire: false, arcCollision: true, layeredExposure: true };
  enemy.elevation.z ??= CELL_LAYER_HEIGHT * 14;
  enemy.elevation.canBeHitByGroundFire = Boolean(enemy.harpoonField);
  const state = enemy.zeppelin ?? {
    phase: 'turn',
    runCount: 0,
    turnTimer: 0,
    atsCooldown: 1.4,
    laserCooldown: 2.2,
    harpoonSpawnTimer: 0,
    innerLiningTotal: Math.max(1, zeppelinDamageGroupCells(enemy, 'innerLining').length),
    meltdownTimer: null,
  };
  enemy.zeppelin = state;
  state.harpoonSpawnTimer ??= 0;
  stepZeppelinHarpoon(game, enemy, dt);
  if (stepZeppelinMeltdown(game, enemy, dt)) return;
  stepZeppelinStrafe(game, enemy, state, dt);
  stepZeppelinCannons(game, enemy, state, dt);
}

function stepZeppelinStrafe(game, enemy, state, dt) {
  const summonedWalkers = activeZeppelinSummonedWalkers(game, enemy);
  if (summonedWalkers.length >= ZEPPELIN_SUMMONED_WALKER_LIMIT) {
    state.phase = 'orbit';
    state.walkerDropPending = false;
  } else if (state.phase === 'orbit') {
    state.phase = 'turn';
    state.turnTimer = 0.45;
  }
  if (state.phase === 'orbit') {
    stepZeppelinSupportOrbit(game, enemy, state, dt);
    return;
  }
  const offset = worldToRoadOffset(enemy, game.road);
  if (state.phase === 'strafe') {
    if (
      Math.abs(offset.x) > game.road.halfWidth + ZEPPELIN_STRAFE_EXIT_MARGIN ||
      Math.abs(offset.y) > game.road.halfHeight + ZEPPELIN_STRAFE_EXIT_MARGIN
    ) {
      state.phase = 'turn';
      state.turnTimer = 0.75;
      state.runCount += 1;
      if (activeZeppelinSummonedWalkers(game, enemy).length < ZEPPELIN_SUMMONED_WALKER_LIMIT) state.walkerDropPending = true;
    }
  }
  if (state.phase === 'turn') {
    state.turnTimer -= dt;
    enemy.vx *= Math.pow(0.08, dt);
    enemy.vy *= Math.pow(0.08, dt);
    const angle = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
    enemy.visualHeading = turnTowardAngle(enemy.visualHeading ?? angle, angle, 2.8 * dt);
    if (state.turnTimer > 0) return;
    state.phase = 'strafe';
    state.strafeAngle = angle;
  }
  const angle = state.strafeAngle ?? Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
  const speed = ZEPPELIN_STRAFE_SPEED * enemyMovementUpgradeScale(enemy);
  const steer = clamp(2.8 * dt, 0, 1);
  enemy.vx += (Math.cos(angle) * speed - enemy.vx) * steer;
  enemy.vy += (Math.sin(angle) * speed - enemy.vy) * steer;
  const moveAngle = Math.hypot(enemy.vx, enemy.vy) > 4 ? Math.atan2(enemy.vy, enemy.vx) : angle;
  enemy.visualHeading = moveAngle;
  if (state.walkerDropPending) dropZeppelinWalker(game, enemy, state);
}

function stepZeppelinSupportOrbit(game, enemy, state, dt) {
  const orbitRadiusX = game.road.halfWidth + ZEPPELIN_ORBIT_MARGIN;
  const orbitRadiusY = game.road.halfHeight + ZEPPELIN_ORBIT_MARGIN * 0.72;
  state.orbitAngle ??= Math.atan2(enemy.y - game.road.y, enemy.x - game.road.x);
  state.orbitAngle += dt * 0.34;
  const target = roadOffsetToWorld({
    x: Math.cos(state.orbitAngle) * orbitRadiusX,
    y: Math.sin(state.orbitAngle) * orbitRadiusY,
  }, game.road);
  const direction = directionFromTo(enemy, target);
  const speed = ZEPPELIN_ORBIT_SPEED * enemyMovementUpgradeScale(enemy);
  const steer = clamp(2.4 * dt, 0, 1);
  enemy.vx += (direction.x * speed - enemy.vx) * steer;
  enemy.vy += (direction.y * speed - enemy.vy) * steer;
  if (Math.hypot(enemy.vx, enemy.vy) > 4) enemy.visualHeading = Math.atan2(enemy.vy, enemy.vx);
}

function dropZeppelinWalker(game, enemy, state) {
  const walkerCount = activeZeppelinSummonedWalkers(game, enemy).length;
  if (walkerCount >= ZEPPELIN_SUMMONED_WALKER_LIMIT) {
    state.walkerDropPending = false;
    return;
  }
  const archetype = zeppelinWalkerArchetypeForMusic(game.currentMusic, state.runCount);
  if (!archetype || !isWalkerEnemy(archetype)) {
    state.walkerDropPending = false;
    return;
  }
  const walker = createEnemyForArchetype(archetype, enemy.x + game.rng.range(-CELL_SIZE * 4, CELL_SIZE * 4), enemy.y + CELL_SIZE * 3.5, 'standard');
  applyArchetypeRuntimeMetadata(walker, archetype);
  applyEnemyLevelUpgrades(walker, game.level);
  walker.summonedByZeppelin = enemy.assetId ?? enemy.archetypeId ?? 'boss.zeppelin.prototype0';
  walker.dropProfile = 'zeppelinWalker';
  walker.vx = enemy.vx * 0.25;
  walker.vy = enemy.vy * 0.25;
  game.enemies.push(walker);
  state.walkerDropPending = false;
}

function zeppelinWalkerArchetypeForMusic(trackName, index) {
  const archetype = zoneArchetypeForMusic(trackName, 'standard', index);
  if (archetype && isWalkerEnemy(archetype)) return archetype;
  const fallbackId = zoneNameFromTrack(trackName) === 'TwilightCrossroads' ? 'twilight_walker.prototype0' : 'starlight_walker.prototype0';
  return getEnemyArchetype(fallbackId) ?? RUNTIME_ENEMY_ARCHETYPES[fallbackId] ?? null;
}

function activeZeppelinSummonedWalkers(game, zeppelin) {
  const id = zeppelin.assetId ?? zeppelin.archetypeId ?? 'boss.zeppelin.prototype0';
  return activeEnemies(game).filter((enemy) => enemy.summonedByZeppelin === id && isWalkerEnemy(enemy));
}

function startZeppelinWalkerRout(game, zeppelin) {
  for (const walker of activeZeppelinSummonedWalkers(game, zeppelin)) {
    const direction = zeppelinWalkerRoutDirection(game, walker);
    walker.zeppelinWalkerRout = {
      direction,
      phase: 'panic',
      cueIndex: 0,
      cueTimer: 0,
      speed: ZEPPELIN_WALKER_ROUT_SPEED * enemyMovementUpgradeScale(walker),
    };
    walker.patterns = [];
    walker.walkerSweepWarning = null;
    walker.walkerStaCooldown = 999;
    walker.walkerBeamCooldown = 999;
    walker.walkerGroundedSpiralCooldown = 999;
    walker.walkerRepulsorCooldown = 999;
    walker.dropNoScrap = true;
  }
  for (const projectile of game.enemyProjectiles) {
    if (projectile.sourceEnemy?.summonedByZeppelin !== (zeppelin.assetId ?? zeppelin.archetypeId ?? 'boss.zeppelin.prototype0')) continue;
    projectile.lifetime = 0;
  }
}

function stepZeppelinWalkerRout(game, walker, dt) {
  const state = walker.zeppelinWalkerRout;
  state.cueTimer -= dt;
  if (state.cueTimer <= 0 && state.cueIndex < ZEPPELIN_WALKER_ROUT_CUES.length) {
    addEnemyReactionCue(walker, ZEPPELIN_WALKER_ROUT_CUES[state.cueIndex], {
      duration: 1.25,
      rise: CELL_SIZE * 1.9,
      size: CELL_SIZE * 0.95,
      growth: 2.4,
      x: game.rng.range(-walker.radius * 0.16, walker.radius * 0.16),
      y: -Math.max(CELL_SIZE * 2.9, walker.radius * 0.34),
    });
    state.cueIndex += 1;
    state.cueTimer = ZEPPELIN_WALKER_ROUT_CUE_INTERVAL;
  } else if (state.cueTimer <= 0 && state.phase !== 'flee') {
    state.phase = 'flee';
  }
  if (state.phase !== 'flee') {
    walker.vx *= Math.pow(0.14, dt);
    walker.vy *= Math.pow(0.14, dt);
    walker.x += walker.vx * dt;
    walker.y += walker.vy * dt;
    updateEnemyCollisionRotation(walker, game.time);
    return;
  }
  const steer = clamp(4.2 * dt, 0, 1);
  walker.vx += (state.direction.x * state.speed - walker.vx) * steer;
  walker.vy += (state.direction.y * state.speed - walker.vy) * steer;
  walker.x += walker.vx * dt;
  walker.y += walker.vy * dt;
  walker.vx *= Math.pow(0.9, dt);
  walker.vy *= Math.pow(0.9, dt);
  if (Math.hypot(walker.vx, walker.vy) > 2) walker.visualHeading = Math.atan2(walker.vy, walker.vx);
  updateEnemyCollisionRotation(walker, game.time);
  if (!zeppelinWalkerHasLeftPlayArea(game, walker)) return;
  walker.destroyed = true;
  walker.escaped = true;
  walker.explosionStart = null;
  recordEnemyDefeat(game.score, walker);
}

function zeppelinWalkerRoutDirection(game, walker) {
  const offset = worldToRoadOffset(walker, game.road);
  const xRatio = Math.abs(offset.x) / Math.max(1, game.road.halfWidth);
  const yRatio = Math.abs(offset.y) / Math.max(1, game.road.halfHeight);
  let local = xRatio >= yRatio
    ? { x: offset.x >= 0 ? 1 : -1, y: 0 }
    : { x: 0, y: offset.y >= 0 ? 1 : -1 };
  if (xRatio < 0.12 && yRatio < 0.12) {
    const away = directionFromTo(game.vehicle, walker);
    local = worldDirectionToRoad(away, game.road);
  }
  const world = roadDirectionToWorld(local.x, local.y, game.road);
  const length = Math.hypot(world.x, world.y) || 1;
  return { x: world.x / length, y: world.y / length };
}

function worldDirectionToRoad(direction, road) {
  const cos = Math.cos(road.heading);
  const sin = Math.sin(road.heading);
  return {
    x: direction.x * cos + direction.y * sin,
    y: -direction.x * sin + direction.y * cos,
  };
}

function zeppelinWalkerHasLeftPlayArea(game, walker) {
  const offset = worldToRoadOffset(walker, game.road);
  const margin = Math.max(CELL_SIZE * 8, walker.radius ?? CELL_SIZE);
  return Math.abs(offset.x) > game.road.halfWidth + margin || Math.abs(offset.y) > game.road.halfHeight + margin;
}

function stepZeppelinCannons(game, enemy, state, dt) {
  if (!enemyCanFire(enemy)) {
    state.laserWarning = null;
    return;
  }
  const sources = zeppelinCannonSources(enemy);
  if (sources.length === 0) return;
  state.atsCooldown = Math.max(0, (state.atsCooldown ?? 1.4) - dt * enemyFireTimerScale(enemy));
  if (state.atsCooldown <= 0) {
    fireZeppelinAtsRocket(game, enemy, sources[Math.floor(game.rng.range(0, sources.length))] ?? sources[0]);
    state.atsCooldown = game.rng.range(2.2, 3.4);
  }
  stepZeppelinGroundLaserSequence(game, enemy, state, sources, dt);
}

function stepZeppelinGroundLaserSequence(game, enemy, state, sources, dt) {
  const fireScale = enemyFireTimerScale(enemy);
  if (enemyBeamIsActive(game, enemy, 'zeppelin-ground-laser')) return;
  if (state.laserWarning) {
    stepZeppelinLaserWarning(game, enemy, state, sources, dt * fireScale);
    return;
  }
  if ((state.laserQueue?.length ?? 0) > 0) {
    startNextZeppelinLaserWarning(game, enemy, state, sources);
    return;
  }
  state.laserCooldown = Math.max(0, (state.laserCooldown ?? 2.2) - dt * fireScale);
  if (state.laserCooldown > 0) return;
  state.laserQueue = zeppelinEligibleCannonSources(game, enemy, sources).map((source) => source.cellId);
  if (state.laserQueue.length === 0) {
    state.laserCooldown = 2;
    return;
  }
  startNextZeppelinLaserWarning(game, enemy, state, sources);
}

function startNextZeppelinLaserWarning(game, enemy, state, sources) {
  const nextId = state.laserQueue?.shift();
  const source = sources.find((candidate) => candidate.cellId === nextId);
  if (!source) {
    state.laserWarning = null;
    if ((state.laserQueue?.length ?? 0) === 0) state.laserCooldown = ZEPPELIN_GROUND_LASER_SEQUENCE_COOLDOWN;
    return;
  }
  state.laserWarning = createZeppelinLaserWarning(game, enemy, source);
}

function stepZeppelinLaserWarning(game, enemy, state, sources, scaledDt) {
  const warning = state.laserWarning;
  const source = sources.find((candidate) => candidate.cellId === warning.cellId);
  if (!source) {
    state.laserWarning = null;
    return;
  }
  warning.timer -= scaledDt;
  warning.source = source;
  warning.source.z = source.z;
  if (warning.timer > warning.lockSeconds) updateZeppelinLaserWarningTarget(game, warning, source);
  if (warning.timer > 0) return;
  fireZeppelinGroundLaser(game, enemy, source, warning);
  state.laserWarning = null;
  if ((state.laserQueue?.length ?? 0) === 0) state.laserCooldown = ZEPPELIN_GROUND_LASER_SEQUENCE_COOLDOWN;
}

function createZeppelinLaserWarning(game, enemy, source) {
  const warning = {
    kind: 'zeppelin-ground-laser',
    cellId: source.cellId,
    source,
    length: ZEPPELIN_GROUND_LASER_LENGTH,
    timer: ZEPPELIN_GROUND_LASER_WARNING_SECONDS,
    duration: ZEPPELIN_GROUND_LASER_WARNING_SECONDS,
    lockSeconds: ZEPPELIN_GROUND_LASER_LOCK_SECONDS,
    color: '#ff2626',
  };
  updateZeppelinLaserWarningTarget(game, warning, source);
  return warning;
}

function updateZeppelinLaserWarningTarget(game, warning, source) {
  const angle = Math.atan2(game.vehicle.y - source.y, game.vehicle.x - source.x);
  warning.angle = angle;
  warning.target = {
    x: source.x + Math.cos(angle) * warning.length,
    y: source.y + Math.sin(angle) * warning.length,
  };
}

function zeppelinEligibleCannonSources(game, enemy, sources) {
  const eligible = sources.filter((source) => !zeppelinCannonFacesAwayFromPlayer(game, enemy, source));
  return (eligible.length > 0 ? eligible : sources).sort((a, b) => {
    const aAngle = Math.atan2(a.y - enemy.y, a.x - enemy.x);
    const bAngle = Math.atan2(b.y - enemy.y, b.x - enemy.x);
    const toPlayer = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
    return Math.abs(angleDelta(aAngle, toPlayer)) - Math.abs(angleDelta(bAngle, toPlayer));
  });
}

function zeppelinCannonFacesAwayFromPlayer(game, enemy, source) {
  const outwardX = source.x - enemy.x;
  const outwardY = source.y - enemy.y;
  const outwardDistance = Math.hypot(outwardX, outwardY) || 1;
  const toPlayerX = game.vehicle.x - source.x;
  const toPlayerY = game.vehicle.y - source.y;
  const playerDistance = Math.hypot(toPlayerX, toPlayerY) || 1;
  return (outwardX / outwardDistance) * (toPlayerX / playerDistance) + (outwardY / outwardDistance) * (toPlayerY / playerDistance) < -0.2;
}

function zeppelinCannonSources(enemy) {
  const sourceByGroup = new Map();
  for (const cell of (enemy.cells ?? [])
    .filter((cell) => !cell.state?.destroyed && cell.role === 'zeppelinCannon')
  ) {
    const localX = cell.gridX * CELL_SIZE;
    const localY = cell.gridY * CELL_SIZE;
    const world = enemyLocalToWorldPoint(enemy, { x: localX, y: localY });
    const source = {
      ...world,
      z: enemyCellWorldHeight(enemy, cell),
      cellId: cell.id,
      cannonGroup: cell.id.split(':')[0],
      localX,
      localY,
    };
    const current = sourceByGroup.get(source.cannonGroup);
    if (!current || source.z > current.z) sourceByGroup.set(source.cannonGroup, source);
  }
  return [...sourceByGroup.values()];
}

function fireZeppelinAtsRocket(game, enemy, source) {
  const rocket = createProjectile(source.x, source.y, 0, 0, {
    team: 'enemy',
    weapon: 'ats-grav-rocket',
    behavior: 'arc',
    radius: 4.2,
    color: '#ff4b35',
    sprite: WALKER_STA_MISSILE_SPRITE,
    landingMarkerSprite: MORTAR_ENEMY_MARKER_SPRITE,
    damage: 10 * enemyDamageUpgradeScale(enemy),
    impulse: 72,
    lifetime: 5.2,
    z: source.z,
    verticalVelocity: -18,
    gravity: 28,
    maxArcHeight: Math.max(90, source.z),
    shadowRadius: 5,
    targetHint: null,
    detonateAtTarget: false,
    blastOnExpire: {
      radius: ZEPPELIN_ATS_ROCKET_BLAST_RADIUS,
      damage: ZEPPELIN_ATS_ROCKET_BLAST_DAMAGE * enemyDamageUpgradeScale(enemy),
      impulse: 115,
    },
    sourceEnemy: enemy,
    contrail: {
      ...ENEMY_RED_BLACK_CONTRAIL,
      emissionMeanPerSevenFrames: 5,
      maxParticlesPerStep: 8,
      particleRadiusScale: 2.2,
    },
  });
  rocket.angle = Math.PI / 2;
  game.enemyProjectiles.push(rocket);
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireZeppelinGroundLaser(game, enemy, source, warning) {
  const start = { x: source.x, y: source.y };
  const target = warning?.target ?? {
    x: source.x + Math.cos(warning?.angle ?? 0) * ZEPPELIN_GROUND_LASER_LENGTH,
    y: source.y + Math.sin(warning?.angle ?? 0) * ZEPPELIN_GROUND_LASER_LENGTH,
  };
  const angle = warning?.angle ?? Math.atan2(target.y - source.y, target.x - source.x);
  game.enemyProjectiles.push(
    createProjectile(source.x, source.y, 0, 0, {
      team: 'enemy',
      weapon: 'zeppelin-ground-laser',
      behavior: 'beam',
      radius: 1.5,
      damage: 7.5 * enemyDamageUpgradeScale(enemy),
      impulse: 80,
      lifetime: ZEPPELIN_GROUND_LASER_FIRE_SECONDS,
      maxLifetime: ZEPPELIN_GROUND_LASER_FIRE_SECONDS,
      length: 1,
      frames: 60,
      angle,
      color: '#ff2626',
      alpha: 0.9,
      sourceEnemy: enemy,
      sourceCellId: source.cellId,
      sourceOffset: { x: source.localX, y: source.localY },
      sourceZ: source.z,
      endZ: 0,
      widthEnvelopeScale: 1,
      sweepBeam: true,
      sweepStart: start,
      sweepTarget: { ...target },
    }),
  );
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BEAM);
}

function stepZeppelinHarpoon(game, enemy, dt) {
  if (enemy.harpoonField) {
    enemy.harpoonField.timer -= dt;
    enemy.harpoonField.x = enemy.x;
    enemy.harpoonField.y = enemy.y;
    enemy.harpoonField.z = enemy.elevation?.z ?? CELL_LAYER_HEIGHT * 14;
    if (enemy.harpoonField.timer <= 0) enemy.harpoonField = null;
    return;
  }
  if (enemy.zeppelin.harpoonCharge) {
    const result = stepHarpoonCharge(game, enemy, enemy.zeppelin.harpoonCharge, dt);
    if (result !== 'charging') {
      enemy.zeppelin.harpoonCharge = null;
      enemy.zeppelin.harpoonSpawnTimer = ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS;
    }
    return;
  }
  if (enemy.zeppelin.harpoonPowerup) {
    const powerup = enemy.zeppelin.harpoonPowerup;
    enemy.zeppelin.harpoonSpawnTimer = Math.max(0, (enemy.zeppelin.harpoonSpawnTimer ?? ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS) - dt);
    const result = stepCollectiblePowerup(game, powerup, dt);
    if (result === 'collected') {
      enemy.zeppelin.harpoonPowerup = null;
      enemy.zeppelin.harpoonCharge = createHarpoonCharge();
      return;
    }
    if (result === 'expired') enemy.zeppelin.harpoonPowerup = null;
    return;
  }
  enemy.zeppelin.harpoonSpawnTimer = Math.max(0, (enemy.zeppelin.harpoonSpawnTimer ?? 0) - dt);
  if (enemy.zeppelin.harpoonSpawnTimer > 0) return;
  enemy.zeppelin.harpoonPowerup = createZeppelinHarpoonPowerup(game);
  enemy.zeppelin.harpoonSpawnTimer = ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS;
}

function createZeppelinHarpoonPowerup(game) {
  const margin = CELL_SIZE * 8;
  const offset = {
    x: game.rng.range(-Math.max(margin, game.road.halfWidth - margin), Math.max(margin, game.road.halfWidth - margin)),
    y: game.rng.range(-Math.max(margin, game.road.halfHeight - margin), Math.max(margin, game.road.halfHeight - margin)),
  };
  const world = roadOffsetToWorld(offset, game.road);
  return {
    kind: 'zeppelinHarpoon',
    x: world.x,
    y: world.y,
    radius: ZEPPELIN_HARPOON_POWERUP_RADIUS,
    timer: ZEPPELIN_HARPOON_POWERUP_LIFETIME_SECONDS,
    duration: ZEPPELIN_HARPOON_POWERUP_LIFETIME_SECONDS,
    flashStart: ZEPPELIN_HARPOON_POWERUP_FLASH_START_SECONDS,
    age: 0,
  };
}

function stepBuzzardHarpoonPowerup(game, enemy, state, dt) {
  if (enemy.harpoonField) {
    enemy.harpoonField.timer -= dt;
    enemy.harpoonField.x = enemy.x;
    enemy.harpoonField.y = enemy.y;
    enemy.harpoonField.z = enemy.elevation?.z ?? BUZZARD_AIR_Z;
    if (enemy.harpoonField.timer <= 0) enemy.harpoonField = null;
  }
  if (enemy.harpoonCharge) {
    const result = stepHarpoonCharge(game, enemy, enemy.harpoonCharge, dt);
    if (result !== 'charging') enemy.harpoonCharge = null;
  }
  if (enemy.harpoonPowerup) {
    const result = stepCollectiblePowerup(game, enemy.harpoonPowerup, dt);
    if (result === 'collected') {
      const target = nearestBuzzardForHarpoon(game, enemy.harpoonPowerup) ?? enemy;
      target.harpoonCharge = createHarpoonCharge({ affectsProjectiles: true });
      enemy.harpoonPowerup = null;
      state.harpoonSpawnTimer = ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS;
    } else if (result === 'expired') {
      enemy.harpoonPowerup = null;
    }
    return;
  }
  state.harpoonSpawnTimer = Math.max(0, (state.harpoonSpawnTimer ?? ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS) - dt);
  if (state.harpoonSpawnTimer > 0) return;
  enemy.harpoonPowerup = createZeppelinHarpoonPowerup(game);
  enemy.harpoonPowerup.kind = 'buzzardHarpoon';
  state.harpoonSpawnTimer = ZEPPELIN_HARPOON_POWERUP_INTERVAL_SECONDS;
}

function createHarpoonCharge(fieldOptions = {}) {
  return {
    timer: ZEPPELIN_HARPOON_CHARGE_SECONDS,
    duration: ZEPPELIN_HARPOON_CHARGE_SECONDS,
    fieldOptions,
  };
}

function stepHarpoonCharge(game, target, charge, dt) {
  if (!target || target.destroyed) return 'cancelled';
  charge.timer = Math.max(0, charge.timer - dt);
  emitHarpoonChargeParticles(game, charge, dt);
  if (charge.timer > 0) return 'charging';
  launchHarpoonShot(game, target, charge.fieldOptions ?? {});
  return 'launched';
}

function emitHarpoonChargeParticles(game, charge, dt) {
  const muzzles = gunMuzzlesWorld(game.vehicle, game.vehicle.turretHeading);
  if (muzzles.length === 0) {
    const muzzle = gunMuzzleWorld(game.vehicle, game.vehicle.turretHeading);
    if (muzzle) muzzles.push(muzzle);
  }
  if (muzzles.length === 0) return;
  const progress = 1 - charge.timer / Math.max(0.001, charge.duration);
  const mean = (7 + progress * 9) * dt * Math.min(3, muzzles.length);
  charge.particleDebt = (charge.particleDebt ?? 0) + mean;
  let count = Math.min(9, Math.floor(charge.particleDebt));
  charge.particleDebt -= count;
  if (count === 0 && game.rng.chance(charge.particleDebt)) {
    count = 1;
    charge.particleDebt = 0;
  }
  for (let index = 0; index < count; index += 1) {
    const muzzle = muzzles[Math.floor(game.rng.range(0, muzzles.length))] ?? muzzles[0];
    const angle = game.rng.range(0, Math.PI * 2);
    const distance = game.rng.range(CELL_SIZE * (2.2 + progress), CELL_SIZE * (7.2 - progress * 2.2));
    const lifetime = game.rng.range(0.34, 0.62);
    const x = muzzle.x + Math.cos(angle) * distance;
    const y = muzzle.y + Math.sin(angle) * distance;
    pushSmokeParticle(game, {
      kind: 'harpoon-charge',
      x,
      y,
      vx: (muzzle.x - x) / lifetime + game.rng.range(-12, 12),
      vy: (muzzle.y - y) / lifetime + game.rng.range(-12, 12),
      radius: game.rng.range(1.2, 2.8) * (0.75 + progress * 0.45),
      color: HARPOON_CHARGE_PARTICLE_COLORS[Math.floor(game.rng.range(0, HARPOON_CHARGE_PARTICLE_COLORS.length))],
      lifetime,
      maxLifetime: lifetime,
      growth: game.rng.range(-0.6, 1.2),
      light: { radius: CELL_SIZE * 3.5, intensity: 0.18, color: '#7fe8ff', priority: 18 },
    });
  }
}

function launchHarpoonShot(game, target, fieldOptions = {}) {
  const muzzles = gunMuzzlesWorld(game.vehicle, game.vehicle.turretHeading);
  const muzzle =
    muzzles.reduce((nearest, candidate) => (
      !nearest || distanceSquared(candidate, target) < distanceSquared(nearest, target) ? candidate : nearest
    ), null) ??
    gunMuzzleWorld(game.vehicle, game.vehicle.turretHeading) ??
    { x: game.vehicle.x, y: game.vehicle.y };
  const z = target.elevation?.z ?? (target.archetypeId === 'scrap_buzzard.shadowed_desert' ? BUZZARD_AIR_Z : CELL_LAYER_HEIGHT * 14);
  const distance = Math.max(1, Math.hypot(target.x - muzzle.x, target.y - muzzle.y));
  const duration = clamp(distance / HARPOON_SHOT_SPEED, HARPOON_SHOT_MIN_SECONDS, HARPOON_SHOT_MAX_SECONDS);
  game.harpoonShots.push({
    kind: 'electricHarpoon',
    x: muzzle.x,
    y: muzzle.y,
    z: 0,
    startX: muzzle.x,
    startY: muzzle.y,
    target,
    targetZ: z,
    timer: duration,
    duration,
    lifetime: duration,
    maxLifetime: duration,
    angle: Math.atan2(target.y - muzzle.y, target.x - muzzle.x),
    radius: 4.2,
    color: '#7fe8ff',
    sprite: structuredClone(HARPOON_PROJECTILE_SPRITE),
    fieldOptions: { ...fieldOptions },
  });
  emitSoundEvent(game, SOUND_EVENTS.PLAYER_MAIN_GUN);
}

function stepHarpoonShots(game, dt) {
  const kept = [];
  for (const shot of game.harpoonShots ?? []) {
    if (!shot.target || shot.target.destroyed) continue;
    shot.previousX = shot.x;
    shot.previousY = shot.y;
    shot.timer = Math.max(0, shot.timer - dt);
    shot.lifetime = shot.timer;
    const progress = 1 - shot.timer / Math.max(0.001, shot.duration);
    const targetZ = shot.target.elevation?.z ?? shot.targetZ ?? 0;
    shot.targetZ = targetZ;
    shot.x = shot.startX + (shot.target.x - shot.startX) * progress;
    shot.y = shot.startY + (shot.target.y - shot.startY) * progress;
    shot.z = targetZ * progress;
    shot.angle = Math.atan2(shot.target.y - shot.previousY, shot.target.x - shot.previousX);
    emitHarpoonShotTrail(game, shot, dt);
    if (shot.timer <= 0) {
      applyHarpoonField(shot.target, shot.fieldOptions ?? {});
      continue;
    }
    kept.push(shot);
  }
  game.harpoonShots = kept;
}

function emitHarpoonShotTrail(game, shot, dt) {
  const count = Math.min(5, samplePoisson(game.rng, 18 * dt));
  for (let index = 0; index < count; index += 1) {
    const angle = shot.angle + Math.PI + game.rng.range(-0.8, 0.8);
    const speed = game.rng.range(12, 42);
    pushSmokeParticle(game, {
      kind: 'harpoon-electric-trail',
      x: shot.x + game.rng.range(-2.5, 2.5),
      y: shot.y + game.rng.range(-2.5, 2.5),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: game.rng.range(0.9, 2.2),
      color: HARPOON_CHARGE_PARTICLE_COLORS[Math.floor(game.rng.range(0, HARPOON_CHARGE_PARTICLE_COLORS.length))],
      lifetime: game.rng.range(0.12, 0.24),
      maxLifetime: 0.24,
      growth: game.rng.range(1.8, 3.4),
      light: { radius: CELL_SIZE * 4.2, intensity: 0.24, color: '#83f7ff', priority: 32 },
    });
  }
}

function applyHarpoonField(target, fieldOptions = {}) {
  target.harpoonField = {
    timer: ZEPPELIN_HARPOON_FIELD_SECONDS,
    duration: ZEPPELIN_HARPOON_FIELD_SECONDS,
    x: target.x,
    y: target.y,
    z: target.elevation?.z ?? (target.archetypeId === 'scrap_buzzard.shadowed_desert' ? BUZZARD_AIR_Z : CELL_LAYER_HEIGHT * 14),
    affectsProjectiles: Boolean(fieldOptions.affectsProjectiles),
    electricGlow: true,
  };
}

function stepCollectiblePowerup(game, powerup, dt) {
  powerup.timer -= dt;
  powerup.age = powerup.duration - powerup.timer;
  const dx = game.vehicle.x - powerup.x;
  const dy = game.vehicle.y - powerup.y;
  const distance = Math.hypot(dx, dy);
  const collectRange = CELL_SIZE * 3.6 * upgradeMultiplier(game, 'scrapCaptureRadius');
  if (distance <= powerup.radius + collectRange) return 'collected';
  const magnetRange = VOXEL_SIZE * SHOP_COSTS.scrapMagnetVoxels * upgradeMultiplier(game, 'scrapMagnetDistance');
  if (distance > 0 && distance <= magnetRange) {
    const pull = 1 - distance / magnetRange;
    const strength = upgradeMultiplier(game, 'scrapMagnetStrength');
    powerup.vx = (powerup.vx ?? 0) + (dx / distance) * (72 + pull * 150) * strength * dt;
    powerup.vy = (powerup.vy ?? 0) + (dy / distance) * (72 + pull * 150) * strength * dt;
  }
  powerup.x += (powerup.vx ?? 0) * dt;
  powerup.y += (powerup.vy ?? 0) * dt;
  powerup.vx = (powerup.vx ?? 0) * Math.pow(0.2, dt);
  powerup.vy = (powerup.vy ?? 0) * Math.pow(0.2, dt);
  return powerup.timer <= 0 ? 'expired' : 'active';
}

function nearestBuzzardForHarpoon(game, source) {
  return activeEnemies(game)
    .filter((enemy) => enemy.archetypeId === 'scrap_buzzard.shadowed_desert')
    .reduce((nearest, enemy) => {
      if (!nearest) return enemy;
      return distanceSquared(source, enemy) < distanceSquared(source, nearest) ? enemy : nearest;
    }, null);
}

function stepZeppelinMeltdown(game, enemy, dt) {
  const state = enemy.zeppelin;
  if (state.meltdownTimer == null) {
    const lining = zeppelinDamageGroupCells(enemy, 'innerLining');
    const total = state.innerLiningTotal ?? Math.max(1, lining.length);
    const destroyed = lining.filter((cell) => cell.state?.destroyed).length;
    if (destroyed / Math.max(1, total) > 0.33) {
      state.meltdownTimer = 3.2;
      state.meltdownSoundTimer = 0;
    }
    else return false;
  }
  state.meltdownTimer -= dt;
  state.meltdownSoundTimer = (state.meltdownSoundTimer ?? 0) - dt;
  if (state.meltdownSoundTimer <= 0) {
    emitRandomBossInternalExplosionSound(game);
    state.meltdownSoundTimer = game.rng.range(0.34, 0.62);
  }
  if (game.rng.chance(8 * dt)) {
    const live = zeppelinLiveShellCells(enemy);
    const cell = live[Math.floor(game.rng.range(0, live.length))];
    if (cell) {
      const local = { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE };
      const world = enemyLocalToWorldPoint(enemy, local);
      game.enemyProjectiles.push(createProjectile(world.x, world.y, 0, 0, {
        team: 'enemy',
        weapon: 'zeppelin-internal-blast',
        behavior: 'blast',
        radius: 1,
        maxRadius: CELL_SIZE * 2.8,
        damage: 0,
        impulse: 0,
        lifetime: 0.16,
        color: '#ff8038',
      }));
    }
  }
  if (state.meltdownTimer > 0) return true;
  game.enemyProjectiles.push(...spawnEnemyPulseBlast(game, {
    x: enemy.x,
    y: enemy.y,
    blastOnExpire: { radius: CELL_SIZE * 18, damage: 18, impulse: 140 },
  }));
  enemy.internalDestructionComplete = true;
  enemy.destroyed = true;
  explodeEnemy(game, enemy);
  return true;
}

function zeppelinDamageGroupCells(enemy, groupId) {
  const cells = enemy.damageGroups?.[groupId];
  if (Array.isArray(cells)) return cells;
  return (enemy.cells ?? []).filter((cell) => (
    cell.role === groupId ||
    cell.damageGroup === groupId ||
    (Array.isArray(cell.damageGroups) && cell.damageGroups.includes(groupId))
  ));
}

function zeppelinLiveShellCells(enemy) {
  const cells = [
    ...zeppelinDamageGroupCells(enemy, 'innerLining'),
    ...zeppelinDamageGroupCells(enemy, 'zeppelinHull'),
  ];
  const unique = new Set();
  return cells.filter((cell) => {
    if (!cell || cell.state?.destroyed || unique.has(cell.id)) return false;
    unique.add(cell.id);
    return true;
  });
}

function updateEnemyVisualHeading(enemy, dt) {
  if (enemy.kind === 'boss' || enemy.silhouette !== 'pirateShip') return;
  if (enemy.carBehavior?.movement === 'mineDropper') return;
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed <= 8) return;
  const target = Math.atan2(enemy.vy, enemy.vx);
  enemy.visualHeading = turnTowardAngle(enemy.visualHeading ?? target, target, 5.8 * dt);
}

function updateEnemyCollisionRotation(enemy, time = Infinity) {
  if (enemy.inchworm?.role) {
    enemy.collisionRotation = (enemy.inchworm.heading ?? enemy.visualHeading ?? 0) - Math.PI;
    return;
  }
  if (enemy.kind === 'zeppelinBoss') {
    enemy.collisionRotation = (enemy.visualHeading ?? 0) - Math.PI / 2;
    return;
  }
  if (enemy.kind === 'boss' || enemy.silhouette !== 'pirateShip') {
    enemy.collisionRotation = 0;
    return;
  }
  let heading = enemy.visualHeading ?? Math.PI / 2;
  const firedAge = enemy.lastFiredAt == null ? Infinity : time - enemy.lastFiredAt;
  if (firedAge >= 0 && firedAge < 0.85 && Number.isFinite(enemy.attackHeading)) {
    heading = closestBroadsideHeading(heading, enemy.attackHeading);
  }
  enemy.collisionRotation = heading - Math.PI / 2;
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
  stepOctopusArmReaction(boss, dt);
  if (stepOctopusEvade(game, boss, dt)) return;
  if ((boss.armPhaseOutTimer ?? 0) > 0) {
    boss.armPhaseOutTimer = Math.max(0, boss.armPhaseOutTimer - dt);
    boss.phasedOut = true;
    boss.renderAlpha = 0.18 + (Math.sin(game.time * 18) * 0.5 + 0.5) * 0.12;
    boss.vx *= Math.pow(0.16, dt);
    boss.vy *= Math.pow(0.16, dt);
    if (boss.armPhaseOutTimer <= 0) {
      boss.phasedOut = false;
      boss.renderAlpha = 1;
    }
    return;
  }
  if (boss.octopusRetreat) {
    stepOctopusRetreat(game, boss, dt);
    return;
  }
  boss.bossAngerTimer = Math.max(0, (boss.bossAngerTimer ?? 0) - dt);
  boss.phasedOut = false;
  boss.renderAlpha = 1;
  updateBossArmUnfurl(game, boss, dt);
  steerBossBackToViewArea(game, boss, dt);
  if (!enemyCanFire(boss)) {
    boss.centerPulseTimer = Math.max(boss.centerPulseTimer ?? 0, 1);
    return;
  }
  boss.centerPulseTimer -= dt * enemyCoreTimerScale(boss);
  stepBossArms(game, boss, dt);
  if (boss.centerPulseTimer <= 0) {
    fireBossCenterPulse(game, boss);
    boss.centerPulseTimer = 6.8;
  }
}

function stepOctopusArmReaction(boss, dt) {
  if (!boss.octopusArmReaction) return;
  boss.octopusArmReaction.timer = Math.max(0, boss.octopusArmReaction.timer - dt);
  if (boss.octopusArmReaction.timer <= 0) boss.octopusArmReaction = null;
}

function stepOctopusEvade(game, boss, dt) {
  const state = boss.octopusEvade;
  if (!state) return false;
  boss.centerPulseTimer = Math.max(boss.centerPulseTimer ?? 0, 1);
  boss.bossAngerTimer = 0;
  state.timer = Math.max(0, state.timer - dt);

  if (state.phase === 'delay') {
    boss.phasedOut = false;
    boss.renderAlpha = 1;
    boss.vx *= Math.pow(0.04, dt);
    boss.vy *= Math.pow(0.04, dt);
    if (state.timer > 0) return true;
    state.phase = 'run';
    state.timer = OCTOPUS_ARM_EVADE_RUN_SECONDS;
    state.duration = OCTOPUS_ARM_EVADE_RUN_SECONDS;
    boss.phasedOut = true;
    cancelBossArmAttacks(boss);
    spawnBlackSmokeCloud(game, boss, 58);
    emitRandomBossInternalExplosionSound(game);
    return true;
  }

  if (state.phase === 'run') {
    boss.phasedOut = true;
    const pulse = Math.sin(game.time * 20) * 0.5 + 0.5;
    boss.renderAlpha = 0.14 + pulse * 0.16;
    boss.armUnfurl = clamp((boss.armUnfurl ?? 1) - dt * 2.7, 0.08, 1);
    const target = roadOffsetToWorld(state.targetOffset, game.road);
    const direction = directionFromTo(boss, target);
    const desiredSpeed = OCTOPUS_RETREAT_SPEED * 1.25 * enemyMovementUpgradeScale(boss);
    const steer = clamp(4.2 * dt, 0, 1);
    boss.vx += (direction.x * desiredSpeed - boss.vx) * steer;
    boss.vy += (direction.y * desiredSpeed - boss.vy) * steer;
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    boss.vx *= Math.pow(0.78, dt);
    boss.vy *= Math.pow(0.78, dt);
    if (game.rng.chance(14 * dt)) spawnBlackSmokeCloud(game, boss, 2);
    if (state.timer > 0 && distanceSquared(boss, target) > (CELL_SIZE * 5.5) ** 2) return true;
    state.phase = 'dephase';
    state.timer = OCTOPUS_ARM_EVADE_DEPHASE_SECONDS;
    state.duration = OCTOPUS_ARM_EVADE_DEPHASE_SECONDS;
    boss.vx *= 0.12;
    boss.vy *= 0.12;
    spawnBlackSmokeCloud(game, boss, 20);
    return true;
  }

  boss.phasedOut = true;
  const progress = 1 - clamp(state.timer / Math.max(0.001, state.duration), 0, 1);
  boss.renderAlpha = 0.2 + progress * 0.8;
  boss.armUnfurl = clamp((boss.armUnfurl ?? 0.08) + dt * 1.15, 0.08, 1);
  boss.vx *= Math.pow(0.08, dt);
  boss.vy *= Math.pow(0.08, dt);
  if (state.timer > 0) return true;
  boss.octopusEvade = null;
  boss.phasedOut = false;
  boss.renderAlpha = 1;
  boss.armUnfurl = 1;
  boss.bossAngerTimer = 1.8;
  return false;
}

function stepOctopusRetreat(game, boss, dt) {
  const state = boss.octopusRetreat;
  if (!state) return;
  boss.phasedOut = false;
  boss.centerPulseTimer = Math.max(boss.centerPulseTimer ?? 0, 1);
  boss.bossAngerTimer = 0;
  if (state.phase === 'panic') {
    state.timer = Math.max(0, state.timer - dt);
    const pulse = Math.sin(game.time * 9) * 0.5 + 0.5;
    boss.renderAlpha = 0.82 + pulse * 0.18;
    boss.vx *= Math.pow(0.06, dt);
    boss.vy *= Math.pow(0.06, dt);
    boss.x += boss.vx * dt;
    boss.y += boss.vy * dt;
    if (state.timer > 0) return;
    const offset = worldToRoadOffset(boss, game.road);
    state.phase = 'retreat';
    state.targetOffset = {
      x: clamp(offset.x, -game.road.halfWidth * 0.5, game.road.halfWidth * 0.5),
      y: -game.road.halfHeight - OCTOPUS_RETREAT_EXIT_MARGIN,
    };
    spawnBlackSmokeCloud(game, boss, 62);
    emitRandomBossInternalExplosionSound(game);
    boss.armUnfurl = 0;
    boss.phasedOut = true;
    cancelBossArmAttacks(boss);
    return;
  }

  boss.phasedOut = true;
  boss.armUnfurl = clamp((boss.armUnfurl ?? 0) - dt * 0.8, 0, 1);
  boss.renderAlpha = 0.58 + (Math.sin(game.time * 18) * 0.5 + 0.5) * 0.28;
  const target = roadOffsetToWorld(state.targetOffset, game.road);
  const direction = directionFromTo(boss, target);
  const desiredSpeed = OCTOPUS_RETREAT_SPEED * enemyMovementUpgradeScale(boss);
  const steer = clamp(2.6 * dt, 0, 1);
  boss.vx += (direction.x * desiredSpeed - boss.vx) * steer;
  boss.vy += (direction.y * desiredSpeed - boss.vy) * steer;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.vx *= Math.pow(0.86, dt);
  boss.vy *= Math.pow(0.86, dt);
  if (game.rng.chance(11 * dt)) spawnBlackSmokeCloud(game, boss, 3);

  const offset = worldToRoadOffset(boss, game.road);
  if (offset.y > -game.road.halfHeight - OCTOPUS_RETREAT_EXIT_MARGIN * 0.85) return;
  boss.destroyed = true;
  boss.escaped = true;
  boss.renderAlpha = 0;
  boss.internalDestructionComplete = true;
  emitSoundEvent(game, SOUND_EVENTS.KRAKEN_DEFEATED);
  recordEnemyDefeat(game.score, boss);
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
    if (!enemyCanFire(boss) || boss.octopusEvade || boss.octopusRetreat || boss.internalDestruction) continue;
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
  const diagnostics = game.performanceDiagnostics ?? {};
  if (!diagnostics.disableArmDetonationFx) {
    spawnBossArmPartialScrap(game, boss, cells);
    spawnBlackSmokeCloud(game, {
      x: boss.x + arm.direction.x * CELL_SIZE * 8,
      y: boss.y + arm.direction.y * CELL_SIZE * 8,
    }, 34);
  }
  for (const cell of cells) {
    const origin = { x: boss.x + cell.gridX * CELL_SIZE, y: boss.y + cell.gridY * CELL_SIZE };
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    cell.state.destroyed = true;
    if (!diagnostics.disableArmDetonationFx) {
      game.enemyProjectiles.push(
        ...spawnEnemyPulseBlast(game, {
          ...origin,
          blastOnExpire: { radius: CELL_SIZE * 1.4, damage: 6, impulse: 42.5 },
        }),
      );
    }
    if (!diagnostics.disableArmShrapnel) {
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
  }
  startOctopusArmReaction(boss);
  updateEnemyDestroyedAfterArmLoss(game, boss);
  if (!boss.octopusRetreat && !boss.internalDestruction) startOctopusArmLossEvade(game, boss);
  return true;
}

function startOctopusArmReaction(boss) {
  boss.octopusArmReaction = {
    timer: OCTOPUS_ARM_REACTION_SECONDS,
    duration: OCTOPUS_ARM_REACTION_SECONDS,
    ouchSeconds: OCTOPUS_ARM_REACTION_OUCH_SECONDS,
    scaredSeconds: OCTOPUS_ARM_REACTION_SCARED_SECONDS,
    angerSeconds: OCTOPUS_ARM_REACTION_ANGER_SECONDS,
  };
  boss.bossAngerTimer = 0;
}

function updateEnemyDestroyedAfterArmLoss(game, boss) {
  const liveCore = boss.cells.some((cell) => cell.id.startsWith('core-') && !cell.state.destroyed);
  if (!liveCore) {
    startBossInternalDestruction(game, boss);
    return;
  }
  const allArmsLost = (boss.arms ?? []).length > 0 && boss.arms.every((arm) => arm.detonated);
  if (allArmsLost) startOctopusNakedRetreat(game, boss);
}

function startOctopusNakedRetreat(game, boss) {
  if (boss.octopusRetreat || boss.destroyed || boss.internalDestruction) return;
  boss.octopusEvade = null;
  boss.armPhaseOutTimer = 0;
  cancelBossArmAttacks(boss);
  boss.octopusRetreat = {
    phase: 'panic',
    timer: OCTOPUS_NAKED_PANIC_SECONDS,
    duration: OCTOPUS_NAKED_PANIC_SECONDS,
  };
  boss.bossAngerTimer = 0;
  boss.centerPulseTimer = Math.max(boss.centerPulseTimer ?? 0, OCTOPUS_NAKED_PANIC_SECONDS + 1);
  boss.vx *= 0.08;
  boss.vy *= 0.08;
}

function startOctopusArmLossEvade(game, boss) {
  if (boss.octopusEvade || boss.octopusRetreat || boss.destroyed || boss.internalDestruction) return;
  const offset = worldToRoadOffset(boss, game.road);
  const targetOffset = {
    x: clamp(offset.x + game.rng.range(-game.road.halfWidth * 0.42, game.road.halfWidth * 0.42), -game.road.halfWidth * 0.48, game.road.halfWidth * 0.48),
    y: clamp(offset.y + game.rng.range(-game.road.halfHeight * 0.26, game.road.halfHeight * 0.26), -game.road.halfHeight * 0.44, game.road.halfHeight * 0.08),
  };
  boss.octopusEvade = {
    phase: 'delay',
    timer: OCTOPUS_ARM_PHASE_DELAY_SECONDS,
    duration: OCTOPUS_ARM_PHASE_DELAY_SECONDS,
    targetOffset,
  };
  boss.bossAngerTimer = 0;
  boss.centerPulseTimer = Math.max(boss.centerPulseTimer ?? 0, OCTOPUS_ARM_PHASE_DELAY_SECONDS + OCTOPUS_ARM_EVADE_RUN_SECONDS + OCTOPUS_ARM_EVADE_DEPHASE_SECONDS + 0.4);
}

function cancelBossArmAttacks(boss) {
  for (const arm of boss.arms ?? []) arm.laser = null;
}

function spawnBossArmPartialScrap(game, boss, cells) {
  const unit = CELL_SIZE / VOXELS;
  let scrapIndex = 0;
  for (const cell of cells) {
    for (let vy = 0; vy < VOXELS; vy += 1) {
      for (let vx = 0; vx < VOXELS; vx += 1) {
        const voxel = cell.mask[vy][vx];
        if (voxel.hp <= 0) continue;
        scrapIndex += 1;
        if (scrapIndex % 4 !== 0) continue;
        const local = {
          x: cell.gridX * CELL_SIZE - CELL_SIZE / 2 + (vx + 0.5) * unit,
          y: cell.gridY * CELL_SIZE - CELL_SIZE / 2 + (vy + 0.5) * unit,
        };
        const world = enemyLocalToWorldPoint(boss, local);
        game.scrapPickups.push({
          x: world.x + game.rng.range(-unit, unit),
          y: world.y + game.rng.range(-unit, unit),
          vx: game.rng.range(-38, 38) + boss.vx * 0.12,
          vy: game.rng.range(-38, 38) + boss.vy * 0.12,
          value: 1,
          radius: Math.max(1.1, unit * 0.55),
          life: 18,
        });
      }
    }
  }
}

function startBossInternalDestruction(game, boss) {
  if (boss.internalDestruction || boss.internalDestructionComplete) return;
  boss.destroyed = false;
  boss.phasedOut = false;
  boss.renderAlpha = 1;
  boss.octopusEvade = null;
  boss.octopusRetreat = null;
  cancelBossArmAttacks(boss);
  boss.internalDestruction = {
    timer: BOSS_INTERNAL_DESTRUCTION_SECONDS,
    duration: BOSS_INTERNAL_DESTRUCTION_SECONDS,
    soundTimer: 0,
    smokeTimer: 0,
    cueTimer: isOctopusBoss(boss) || boss.kind === 'roadBossCar' ? 0 : null,
    cues: isOctopusBoss(boss) ? [] : undefined,
    escapePodsLaunched: false,
  };
  boss.vx *= 0.25;
  boss.vy *= 0.25;
  if (boss.kind === 'pirateBoss') emitSoundEvent(game, SOUND_EVENTS.PIRATE_BOSS_DEFEAT);
  emitRandomBossInternalExplosionSound(game);
}

function stepBossInternalDestruction(game, boss, dt) {
  const state = boss.internalDestruction;
  if (!state) return;
  state.timer -= dt;
  state.soundTimer -= dt;
  state.smokeTimer -= dt;
  boss.vx *= Math.pow(0.08, dt);
  boss.vy *= Math.pow(0.08, dt);
  if (isOctopusBoss(boss)) {
    stepOctopusInternalDestructionCues(game, boss, state, dt);
    boss.phasedOut = true;
    boss.armUnfurl = clamp((boss.armUnfurl ?? 1) - dt * 0.55, 0, 1);
    const progress = 1 - clamp(state.timer / Math.max(0.001, state.duration), 0, 1);
    const flicker = (Math.sin(game.time * 24) * 0.5 + 0.5) * 0.16;
    boss.renderAlpha = clamp(1 - progress * 0.9 + flicker, 0.06, 1);
  } else if (boss.kind === 'roadBossCar') {
    stepRoadBossCarInternalDestruction(game, boss, state, dt);
    boss.renderAlpha = 0.72 + (Math.sin(game.time * 26) * 0.5 + 0.5) * 0.28;
  } else {
    boss.renderAlpha = 0.72 + (Math.sin(game.time * 24) * 0.5 + 0.5) * 0.28;
  }
  if (state.soundTimer <= 0) {
    emitRandomBossInternalExplosionSound(game);
    state.soundTimer = game.rng.range(0.32, 0.58);
  }
  if (state.smokeTimer <= 0) {
    if (isOctopusBoss(boss)) spawnBlackSmokeCloud(game, boss, 7);
    else spawnBossInternalBlastEffect(game, boss);
    state.smokeTimer = game.rng.range(0.08, 0.18);
  }
  if (state.timer > 0) return;
  boss.internalDestruction = null;
  boss.internalDestructionComplete = true;
  boss.destroyed = true;
  if (isOctopusBoss(boss)) {
    boss.renderAlpha = 0;
    boss.escaped = true;
    emitSoundEvent(game, SOUND_EVENTS.KRAKEN_DEFEATED);
    recordEnemyDefeat(game.score, boss);
    game.scrapPickups.push(...enemyDeathPickups(game, boss));
    spawnBlackSmokeCloud(game, boss, 70);
  } else {
    boss.renderAlpha = 1;
    explodeEnemy(game, boss);
    if (boss.kind === 'zeppelinBoss') startZeppelinWalkerRout(game, boss);
  }
}

function stepOctopusInternalDestructionCues(game, boss, state, dt) {
  state.cues ??= [];
  for (let index = state.cues.length - 1; index >= 0; index -= 1) {
    const cue = state.cues[index];
    cue.age = (cue.age ?? 0) + dt;
    if (cue.age >= cue.lifetime) state.cues.splice(index, 1);
  }
  state.cueTimer = (state.cueTimer ?? 0) - dt;
  if (state.cueTimer > 0) return;
  state.cueTimer = game.rng.range(0.09, 0.18);
  const codePoint = OCTOPUS_DESTRUCTION_CUE_CODEPOINTS[Math.floor(game.rng.range(0, OCTOPUS_DESTRUCTION_CUE_CODEPOINTS.length))] ?? 0x1f622;
  state.cues.push({
    text: String.fromCodePoint(codePoint),
    age: 0,
    lifetime: 2,
    x: game.rng.range(-boss.radius * 0.16, boss.radius * 0.16),
    y: -Math.max(CELL_SIZE * 2.6, boss.radius * 0.28) + game.rng.range(-CELL_SIZE * 0.4, CELL_SIZE * 0.25),
    rise: game.rng.range(CELL_SIZE * 1.2, CELL_SIZE * 2.2),
    size: game.rng.range(CELL_SIZE * 0.74, CELL_SIZE * 1.02),
    growth: 3,
  });
}

function stepRoadBossCarInternalDestruction(game, boss, state, dt) {
  state.cueTimer = (state.cueTimer ?? 0) - dt;
  if (state.cueTimer <= 0) {
    state.cueTimer = game.rng.range(0.12, 0.22);
    addEnemyReactionCue(boss, chooseCueValue(game.rng, ROAD_BOSS_DESTRUCTION_CUE_TEXTS, true), {
      duration: 1.4,
      rise: CELL_SIZE * 2.1,
      size: CELL_SIZE,
      growth: 2.7,
      x: game.rng.range(-boss.radius * 0.18, boss.radius * 0.18),
      y: -Math.max(CELL_SIZE * 2.8, boss.radius * 0.32),
    });
  }
  if (!state.escapePodsLaunched && state.timer <= 0.72) {
    state.escapePodsLaunched = true;
    addEnemyReactionCue(boss, ROAD_BOSS_TAUNT_CUE_TEXT, {
      duration: 1.2,
      rise: CELL_SIZE * 2.5,
      size: CELL_SIZE * 1.15,
      growth: 3,
    });
    if (boss.roadBossCar?.variant === 'shadowedRoad') launchShadowedRoadEscapeCar(game, boss);
    else launchRoadBossEscapeBoats(game, boss);
  }
}

function launchShadowedRoadEscapeCar(game, boss) {
  if (!boss.roadBossCar?.escapeCar) return;
  const forward = roadDirectionToWorld(0, -1, game.road);
  const car = createEnemy(
    boss.x + forward.x * CELL_SIZE * 4,
    boss.y + forward.y * CELL_SIZE * 4,
    weyfinderRoadArmoredCarSculptedDefinition,
    [],
    { moduleScale: 1 },
  );
  car.kind = 'escapePodBoat';
  car.archetypeId = 'escape_car.shadowed_road_boss';
  car.displayName = 'Taunting Escape Car';
  car.patterns = [];
  car.carBehavior = { movement: 'escapeCar' };
  car.escapePod = {
    heading: Math.atan2(forward.y, forward.x),
    speed: 220,
    cueTimer: 0,
  };
  car.vx = forward.x * 180;
  car.vy = forward.y * 180;
  car.visualHeading = car.escapePod.heading;
  car.collisionRotation = car.visualHeading - Math.PI / 2;
  car.renderHeadingOffset = Math.PI / 2;
  car.dropNoScrap = true;
  addEnemyReactionCue(car, `${String.fromCodePoint(0x1f621)} ${ROAD_BOSS_TAUNT_CUE_TEXT}`, {
    duration: 1.8,
    rise: CELL_SIZE * 1.6,
    growth: 2.4,
  });
  game.enemies.push(car);
}

function launchRoadBossEscapeBoats(game, boss) {
  const oceanSide = roadDirectionToWorld(1, 0, game.road);
  const forward = roadDirectionToWorld(0, 1, game.road);
  const heading = Math.atan2(oceanSide.y, oceanSide.x) + game.rng.range(-0.18, 0.18);
  for (let index = 0; index < ROAD_BOSS_CAR_ESCAPE_PODS; index += 1) {
    const offset = (index - (ROAD_BOSS_CAR_ESCAPE_PODS - 1) / 2) * CELL_SIZE * 2.2;
    const boat = createMortarSkiffEnemy(
      boss.x - oceanSide.x * CELL_SIZE * 1.6 + forward.x * offset,
      boss.y - oceanSide.y * CELL_SIZE * 1.6 + forward.y * offset,
    );
    boat.kind = 'escapePodBoat';
    boat.archetypeId = 'escape_pod_boat.weyfinder_road_boss';
    boat.displayName = 'Taunting Escape Boat';
    boat.patterns = [];
    boat.escapePod = {
      heading: heading + game.rng.range(-0.22, 0.22),
      speed: game.rng.range(112, 154),
      cueTimer: game.rng.range(0, 0.3),
    };
    boat.vx = oceanSide.x * game.rng.range(75, 105) + forward.x * game.rng.range(-18, 18);
    boat.vy = oceanSide.y * game.rng.range(75, 105) + forward.y * game.rng.range(-18, 18);
    boat.visualHeading = boat.escapePod.heading;
    boat.collisionRotation = boat.visualHeading - Math.PI / 2;
    boat.dropNoScrap = true;
    addEnemyReactionCue(boat, chooseCueValue(game.rng, [`${String.fromCodePoint(0x2620)} !`, 'Yargh!', ROAD_BOSS_TAUNT_CUE_TEXT], true), {
      duration: 1.8,
      rise: CELL_SIZE * 1.6,
      growth: 2.3,
    });
    game.enemies.push(boat);
  }
  emitSoundEvent(game, SOUND_EVENTS.PIRATE_YARGH);
}

function spawnBossInternalBlastEffect(game, boss) {
  const live = (boss.cells ?? []).filter((cell) => !cell.state?.destroyed);
  const cell = live[Math.floor(game.rng.range(0, live.length))];
  const origin = cell
    ? enemyLocalToWorldPoint(boss, { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE })
    : { x: boss.x, y: boss.y };
  game.enemyProjectiles.push(createProjectile(origin.x, origin.y, 0, 0, {
    team: 'enemy',
    weapon: 'boss-internal-blast',
    behavior: 'blast',
    radius: 1,
    maxRadius: CELL_SIZE * game.rng.range(1.5, 3.3),
    damage: 0,
    impulse: 0,
    lifetime: 0.14,
    color: '#ff8f38',
  }));
  spawnBlackSmokeCloud(game, origin, 5);
}

function spawnBlackSmokeCloud(game, origin, count = 20) {
  for (let index = 0; index < count; index += 1) {
    const angle = game.rng.range(0, Math.PI * 2);
    const speed = game.rng.range(16, 95);
    const distance = game.rng.range(0, CELL_SIZE * 2.4);
    pushSmokeParticle(game, {
      x: origin.x + Math.cos(angle) * distance,
      y: origin.y + Math.sin(angle) * distance,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: game.rng.range(3.4, 9.5),
      color: game.rng.chance(0.28) ? '#1b1718' : '#050506',
      lifetime: game.rng.range(0.45, 0.95),
      maxLifetime: game.rng.range(0.45, 0.95),
      growth: game.rng.range(7, 18),
    });
  }
}

function emitRandomBossInternalExplosionSound(game) {
  emitSoundEvent(
    game,
    game.rng.chance(0.5) ? SOUND_EVENTS.BOSS_INTERNAL_EXPLOSION_1 : SOUND_EVENTS.BOSS_INTERNAL_EXPLOSION_2,
  );
}

function emitRandomBossMainExplosionSound(game) {
  emitSoundEvent(
    game,
    game.rng.chance(0.5) ? SOUND_EVENTS.BOSS_MAIN_EXPLOSION_1 : SOUND_EVENTS.BOSS_MAIN_EXPLOSION_2,
  );
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
  fireEnemyMortarLineFromSource(game, enemy, enemy, count, {
    blastRadius: ENEMY_MORTAR_BASE_BLAST_RADIUS,
    firstImpactSeconds: ENEMY_MORTAR_LINE_FIRST_IMPACT_SECONDS,
    spacingSeconds: ENEMY_MORTAR_LINE_IMPACT_SPACING_SECONDS,
    spread: CELL_SIZE * 0.35,
  });
  emitSoundEvent(game, SOUND_EVENTS.ENEMY_BULLET);
}

function fireEnemyMortarLineFromSource(game, enemy, source, count = 7, options = {}) {
  const target = {
    x: game.vehicle.x + game.vehicle.vx * 0.35,
    y: game.vehicle.y + game.vehicle.vy * 0.35,
  };
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 1 : (index + 1) / count;
    const spread = options.spread ?? CELL_SIZE * 0.35;
    points.push({
      x: source.x + (target.x - source.x) * t + game.rng.range(-spread, spread),
      y: source.y + (target.y - source.y) * t + game.rng.range(-spread, spread),
    });
  }
  points
    .sort((a, b) => distanceSquared(source, a) - distanceSquared(source, b))
    .forEach((point, index) => {
      const flightTime = (options.firstImpactSeconds ?? ENEMY_MORTAR_LINE_FIRST_IMPACT_SECONDS) + index * (options.spacingSeconds ?? ENEMY_MORTAR_LINE_IMPACT_SPACING_SECONDS);
      fireEnemyArcShell(game, { ...enemy, x: source.x, y: source.y }, point, options.color ?? '#ffb25f', {
        ...options,
        flightTime,
        blastRadius: options.blastRadius ?? ENEMY_MORTAR_BASE_BLAST_RADIUS,
        sourceEnemy: enemy,
      });
    });
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
    weapon: options.weapon ?? 'enemy-mortar',
    behavior: 'arc',
    radius: 3.2,
    color,
    sprite: MORTAR_ENEMY_SHELL_SPRITE,
    landingMarkerSprite: MORTAR_ENEMY_MARKER_SPRITE,
    damage: (options.damage ?? 8) * enemyDamageUpgradeScale(enemy),
    impulse: options.impulse ?? 80,
    lifetime: flightTime + 0.35,
    verticalVelocity,
    gravity,
    maxArcHeight: 110,
    shadowRadius: 4,
    targetHint: { x: target.x, y: target.y },
    detonateAtTarget: true,
    arcFlightTime: flightTime,
    sourceEnemy: options.sourceEnemy ?? enemy,
    blastOnExpire: {
      radius: options.blastRadius ?? ENEMY_SINGLE_MORTAR_BLAST_RADIUS,
      damage: (options.blastDamage ?? 4.5) * enemyDamageUpgradeScale(enemy),
      impulse: options.blastImpulse ?? 34,
      enemyIgnoreTags: options.enemyIgnoreTags ?? [],
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

function enemyCanFire(enemy) {
  return !enemy?.phasedOut || enemy.canFireWhilePhased === true;
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
    const projectileAbsorb = playerProjectileAbsorbsEnemyProjectile(game, projectile);
    if (projectileAbsorb.damageLost > 0) {
      handleDamageBudgetProjectileRicochet(game, projectile, null);
    }
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
  if (enemy.kind === 'zeppelinBoss' && !enemy.harpoonField && projectile.behavior !== 'arc') return false;
  if (enemyUsesLayeredCellExposure(enemy)) return true;
  if (enemy.elevation?.canBeHitByGroundFire === false && projectile.behavior !== 'arc') return false;
  return true;
}

function enemyUsesLayeredCellExposure(enemy) {
  return Boolean(enemy.elevation?.layeredExposure) || enemy.cells?.some((cell) => (cell.gridZ ?? cell.layer ?? 0) > 0);
}

function hitEnemiesWithDamageBudgetProjectile(game, projectile) {
  const travel = Math.hypot(projectile.x - projectile.previousX, projectile.y - projectile.previousY);
  const travelAngle = travel > 0.001 ? Math.atan2(projectile.y - projectile.previousY, projectile.x - projectile.previousX) : (projectile.angle ?? Math.atan2(projectile.vy, projectile.vx));
  const contactRadius = playerProjectileContactRadius(projectile);
  const pierce = applyEnemyProjectilePierceDamage(
    activeEnemies(game).filter((enemy) => enemyCanBeHitByProjectile(enemy, projectile)),
    projectile,
    {
      start: { x: projectile.previousX, y: projectile.previousY },
      angle: travelAngle,
      maxLength: Math.max(VOXEL_SIZE, travel + contactRadius * 2),
      maxHits: 48,
      halfWidth: Math.max(contactRadius, VOXEL_SIZE),
      damageScale: 1,
    },
  );
  if (!pierce.hit) return maybeRicochetDamageBudgetProjectile(game, projectile);
  game.score.damageDone += Math.round((pierce.damage ?? projectile.damage) + pierce.removed * 3);
  const previousDamage = projectile.damage;
  for (const hitEnemy of pierce.hitEnemies ?? []) {
    hitEnemy.vx += Math.cos(travelAngle) * (projectile.impulse ?? 0) * 0.004;
    hitEnemy.vy += Math.sin(travelAngle) * (projectile.impulse ?? 0) * 0.004;
  }
  for (const piercedEnemy of pierce.destroyedEnemies) explodeEnemy(game, piercedEnemy);
  projectile.damage = pierce.remainingDamage ?? 0;
  const previousEnemy = pierce.hitEnemies?.[pierce.hitEnemies.length - 1] ?? null;
  if (previousDamage - projectile.damage > 0.05) handleDamageBudgetProjectileRicochet(game, projectile, previousEnemy);
  if (projectile.damage <= 0.05) projectile.lifetime = 0;
  return true;
}

function handleDamageBudgetProjectileRicochet(game, projectile, previousEnemy = null) {
  if (!projectile.damagePiercesUntilSpent || !projectile.ricochetOnEnemyExit || projectile.lifetime <= 0 || projectile.damage <= 0.05) return false;
  if ((projectile.ricochetCount ?? 0) >= (projectile.maxRicochets ?? 0)) {
    burstSpentBladeIntoFlechettes(game, projectile);
    projectile.lifetime = 0;
    return true;
  }
  const target = nearestRicochetTarget(game, projectile, previousEnemy);
  if (!target) return false;
  projectile.ricochetCount = (projectile.ricochetCount ?? 0) + 1;
  projectile.damage *= projectile.ricochetFactor ?? 0.5;
  if (projectile.damage <= 0.05) {
    projectile.lifetime = 0;
    return true;
  }
  const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
  projectile.angle = Math.atan2(target.point.y - projectile.y, target.point.x - projectile.x);
  projectile.vx = Math.cos(projectile.angle) * speed;
  projectile.vy = Math.sin(projectile.angle) * speed;
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  projectile.ricochetContactEnemy = null;
  return true;
}

function maybeRicochetDamageBudgetProjectile(game, projectile) {
  if (!projectile.ricochetOnEnemyExit || !projectile.ricochetContactEnemy) return false;
  const previousEnemy = projectile.ricochetContactEnemy;
  projectile.ricochetContactEnemy = null;
  if ((projectile.ricochetCount ?? 0) >= (projectile.maxRicochets ?? 0)) return false;
  const target = nearestRicochetTarget(game, projectile, previousEnemy);
  if (!target) return false;
  projectile.ricochetCount = (projectile.ricochetCount ?? 0) + 1;
  projectile.damage *= projectile.ricochetFactor ?? 0.5;
  if (projectile.damage <= 0.05) {
    projectile.lifetime = 0;
    return true;
  }
  const speed = Math.max(1, Math.hypot(projectile.vx, projectile.vy));
  projectile.angle = Math.atan2(target.point.y - projectile.y, target.point.x - projectile.x);
  projectile.vx = Math.cos(projectile.angle) * speed;
  projectile.vy = Math.sin(projectile.angle) * speed;
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  return true;
}

function nearestRicochetTarget(game, projectile, previousEnemy = null) {
  return activeEnemies(game).reduce((nearest, enemy) => {
    if (enemy === previousEnemy) return nearest;
    const point = enemyCoreWorldPoint(enemy);
    if (!nearest) return { enemy, point };
    return distanceSquared(projectile, point) < distanceSquared(projectile, nearest.point) ? { enemy, point } : nearest;
  }, null);
}

function enemyCoreWorldPoint(enemy) {
  const core = enemy.cells?.find((cell) => cell.type === 'core' && !cell.state?.destroyed) ?? enemy.cells?.find((cell) => !cell.state?.destroyed);
  if (!core) return { x: enemy.x, y: enemy.y };
  const scale = Math.max(0.001, enemy.visualScale ?? 1);
  const localX = core.gridX * CELL_SIZE;
  const localY = core.gridY * CELL_SIZE;
  const rotation = Number.isFinite(enemy.collisionRotation) ? enemy.collisionRotation : 0;
  if (Math.abs(rotation) <= 0.000001) {
    return { x: enemy.x + localX * scale, y: enemy.y + localY * scale };
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: enemy.x + (localX * cos - localY * sin) * scale,
    y: enemy.y + (localX * sin + localY * cos) * scale,
  };
}

function burstSpentBladeIntoFlechettes(game, projectile) {
  const count = Math.max(8, Math.min(16, Math.floor(game.rng.range(8, 17))));
  const damage = projectile.damage / count;
  if (damage <= 0.05) return;
  const baseAngle = projectile.angle ?? Math.atan2(projectile.vy, projectile.vx);
  const speed = Math.max(120, Math.hypot(projectile.vx, projectile.vy) * 0.72);
  for (let index = 0; index < count; index += 1) {
    const angle = baseAngle + (Math.PI * 2 * index) / count + game.rng.range(-0.12, 0.12);
    game.playerProjectiles.push(
      createProjectile(projectile.x, projectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
        team: 'player',
        weapon: 'blade_flechette',
        behavior: 'ballistic',
        radius: Math.max(1, (projectile.radius ?? 2) * 0.42),
        damage,
        impulse: (projectile.impulse ?? 0) * 0.25,
        lifetime: 0.55,
        angle,
        pierce: projectile.pierce ?? 0,
        pierceDamageScale: 1,
        pierceDamageFalloff: projectile.pierceDamageFalloff ?? 0.72,
        damagePiercesUntilSpent: true,
        sprite: projectile.sprite,
        color: projectile.color ?? '#9be5ff',
      }),
    );
  }
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
          maxRicochets: group.maxRicochets,
          ricochetFactor: group.ricochetFactor,
          ricochetOnEnemyExit: group.ricochetOnEnemyExit,
          absorbsEnemyProjectiles: group.absorbsEnemyProjectiles,
          projectileDeflectionProbability: group.projectileDeflectionProbability,
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
  const vx = Math.cos(angle) * speed + source.vx * 0.25;
  const vy = Math.sin(angle) * speed + source.vy * 0.25;
  const travelAngle = Math.atan2(vy, vx);
  return createProjectile(source.x, source.y, vx, vy, {
    team: 'player',
    weapon: emitter.weapon ?? 'emitted-projectile',
    radius: emitter.radius ?? 1,
    damage: emitter.damage ?? source.damage,
    color: emitter.color,
    impulse: emitter.impulse ?? source.impulse * 0.35,
    lifetime: emitter.lifetime ?? 0.9,
    angle: travelAngle,
    pierce: emitter.pierce ?? 0,
    pierceDamageScale: 0.85,
    pierceDamageFalloff: 0.72,
    damagePiercesUntilSpent: emitter.damagePiercesUntilSpent,
    maxRicochets: emitter.maxRicochets,
    ricochetFactor: emitter.ricochetFactor,
    ricochetOnEnemyExit: emitter.ricochetOnEnemyExit,
    absorbsEnemyProjectiles: emitter.absorbsEnemyProjectiles,
    projectileDeflectionProbability: emitter.projectileDeflectionProbability,
    sprite: emitter.sprite,
  });
}

function trackReticleProjectiles(game) {
  if (!game.aimReticle) return;
  for (const projectile of game.playerProjectiles) {
    if (projectile.lifetime <= 0) continue;
    if (projectile.tracksReticleInArc && projectile.behavior === 'arc' && !projectile.arcLanded) {
      projectile.targetHint = { x: game.aimReticle.x, y: game.aimReticle.y };
      const flightTime = remainingArcFlightTime(projectile);
      projectile.vx = (projectile.targetHint.x - projectile.x) / flightTime;
      projectile.vy = (projectile.targetHint.y - projectile.y) / flightTime;
      projectile.angle = Math.atan2(projectile.vy, projectile.vx);
    } else if (projectile.tracksReticleInHoming && projectile.behavior === 'homing') {
      projectile.targetHint = { x: game.aimReticle.x, y: game.aimReticle.y };
    }
  }
}

function lockEnemyStaMissileDescents(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.weapon !== 'walker-sta-missile' || projectile.descentLocked || projectile.arcLanded) continue;
    if (projectile.vz > 0) continue;
    projectile.descentLocked = true;
    projectile.targetHint = { x: game.vehicle.x, y: game.vehicle.y };
    projectile.detonateAtTarget = true;
    projectile.directDescentStartZ = Math.max(1, projectile.z);
    projectile.directDescentElapsed = 0;
    const flightTime = Math.max(0.001, projectile.directDescentDuration ?? remainingArcFlightTime(projectile));
    projectile.vx = (projectile.targetHint.x - projectile.x) / flightTime;
    projectile.vy = (projectile.targetHint.y - projectile.y) / flightTime;
    projectile.vz = -projectile.directDescentStartZ / flightTime;
    projectile.gravity = 0;
    projectile.angle = Math.atan2(projectile.vy, projectile.vx);
  }
}

function attractPlayerProjectilesToZeppelinHarpoons(game, dt) {
  const fields = activeEnemies(game)
    .filter((enemy) => enemy.harpoonField && (enemy.kind === 'zeppelinBoss' || enemy.harpoonField.affectsProjectiles))
    .map((enemy) => enemy.harpoonField);
  if (fields.length === 0) return;
  for (const projectile of game.playerProjectiles) {
    if (projectile.lifetime <= 0 || projectile.behavior === 'beam' || projectile.behavior === 'blast') continue;
    if (projectile.weapon === 'repulsor_beam' || projectile.weapon === 'tractor_beam') continue;
    const field = fields.reduce((nearest, candidate) => (
      !nearest || distanceSquared(projectile, candidate) < distanceSquared(projectile, nearest) ? candidate : nearest
    ), null);
    if (!field) continue;
    const dx = field.x - projectile.x;
    const dy = field.y - projectile.y;
    const distance = Math.hypot(dx, dy) || 1;
    const pull = 920 * dt;
    projectile.vx += (dx / distance) * pull;
    projectile.vy += (dy / distance) * pull;
    projectile.targetHint = { x: field.x, y: field.y };
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
    const hitRange = enemyProjectile.radius + playerProjectileContactRadius(playerProjectile);
    if (distanceSquared(enemyProjectile, playerProjectile) > hitRange * hitRange) continue;
    enemyProjectile.absorbHp -= playerProjectile.damage;
    if (enemyProjectile.absorbHp <= 0) enemyProjectile.lifetime = 0;
    return true;
  }
  return false;
}

function playerProjectileAbsorbsEnemyProjectile(game, playerProjectile) {
  const deflectionChance = playerProjectile.projectileDeflectionProbability ?? 0;
  if ((!playerProjectile.absorbsEnemyProjectiles && deflectionChance <= 0) || playerProjectile.lifetime <= 0 || playerProjectile.damage <= 0) {
    return { absorbed: false, damageLost: 0 };
  }
  let absorbed = false;
  let damageLost = 0;
  const playerContactRadius = playerProjectileContactRadius(playerProjectile);
  for (const enemyProjectile of game.enemyProjectiles) {
    if (enemyProjectile.lifetime <= 0 || enemyProjectile.behavior === 'beam' || enemyProjectile.behavior === 'blast') continue;
    if (enemyProjectile.behavior === 'arc' && !enemyProjectile.arcLanded) continue;
    const hitRange = enemyProjectile.radius + playerContactRadius;
    if (!projectileSegmentsIntersectRange(playerProjectile, enemyProjectile, hitRange)) continue;
    if (deflectionChance > 0 && game.rng.next() < deflectionChance) {
      deflectEnemyProjectile(game, enemyProjectile, playerProjectile);
      absorbed = true;
      continue;
    }
    if (playerProjectile.absorbsEnemyProjectiles) {
      const loss = Math.max(0, enemyProjectile.damage ?? 0);
      enemyProjectile.lifetime = 0;
      playerProjectile.damage = Math.max(0, playerProjectile.damage - loss);
      damageLost += loss;
      if (playerProjectile.damage <= 0.05) playerProjectile.lifetime = 0;
      absorbed = true;
    }
  }
  return { absorbed, damageLost };
}

function playerProjectileContactRadius(projectile) {
  const radius = projectile.radius ?? 0;
  return isBladeProjectile(projectile) ? radius * 1.25 : radius;
}

function isBladeProjectile(projectile) {
  return projectile.weapon === 'orb_flechette'
    || projectile.weapon === 'blade_launcher'
    || projectile.weapon === 'blade_flechette'
    || projectile.sprite?.assetId === 'sprite.weapon.orb_blade_shard';
}

function deflectEnemyProjectile(game, enemyProjectile, playerProjectile) {
  const target = nearestTargetFromPoint(activeEnemies(game), enemyProjectile);
  const fallbackAngle = playerProjectile.angle ?? Math.atan2(playerProjectile.vy, playerProjectile.vx);
  const angle = target ? Math.atan2(target.y - enemyProjectile.y, target.x - enemyProjectile.x) : fallbackAngle;
  const speed = Math.max(120, Math.hypot(enemyProjectile.vx ?? 0, enemyProjectile.vy ?? 0), Math.hypot(playerProjectile.vx ?? 0, playerProjectile.vy ?? 0) * 0.55);
  game.playerProjectiles.push(createProjectile(enemyProjectile.x, enemyProjectile.y, Math.cos(angle) * speed, Math.sin(angle) * speed, {
    team: 'player',
    weapon: `deflected-${enemyProjectile.weapon ?? 'projectile'}`,
    behavior: 'ballistic',
    radius: enemyProjectile.radius ?? 2,
    damage: Math.max(1, enemyProjectile.damage ?? 1),
    impulse: enemyProjectile.impulse ?? 20,
    lifetime: Math.max(0.45, Math.min(2.2, enemyProjectile.lifetime ?? 1.2)),
    angle,
    color: '#9be5ff',
  }));
  enemyProjectile.lifetime = 0;
}

function nearestTargetFromPoint(targets, point) {
  return targets.reduce((nearest, target) => {
    if (target.destroyed) return nearest;
    if (!nearest) return target;
    return distanceSquared(point, target) < distanceSquared(point, nearest) ? target : nearest;
  }, null);
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
    if (projectile.weapon === 'shadowed-road-mine' && mineTriggeredByVehicle(game, projectile)) {
      spawned.push(...spawnEnemyPulseBlast(game, projectile));
      projectile.lifetime = 0;
      continue;
    }
    if (projectile.weapon === 'ats-grav-rocket' && projectile.atsLaunched && projectileReachedDetonationTarget(projectile)) {
      spawned.push(...spawnEnemyPulseBlast(game, projectile));
      projectile.lifetime = 0;
      continue;
    }
    if (projectile.weapon !== 'ats-grav-rocket' && projectile.blastOnExpire && projectile.detonateAtTarget && projectileReachedDetonationTarget(projectile)) {
      spawned.push(...spawnEnemyPulseBlast(game, projectile));
      projectile.lifetime = 0;
      continue;
    }
    if (projectile.readyToExplode && projectile.weapon === 'ats-grav-rocket' && !projectile.atsLaunched) {
      launchAtsGravRocket(game, projectile);
      kept.push(projectile);
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

function mineTriggeredByVehicle(game, projectile) {
  if (projectile.readyToExplode) return true;
  const range = CELL_SIZE * 3.8 + (projectile.radius ?? 0);
  return distanceSquared(projectile, game.vehicle) <= range * range;
}

function launchAtsGravRocket(game, projectile) {
  projectile.readyToExplode = false;
  projectile.arcLanded = false;
  projectile.behavior = 'ballistic';
  projectile.atsLaunched = true;
  projectile.targetHint = { x: game.vehicle.x, y: game.vehicle.y };
  projectile.detonateAtTarget = true;
  projectile.startX = projectile.x;
  projectile.startY = projectile.y;
  const angle = Math.atan2(projectile.targetHint.y - projectile.y, projectile.targetHint.x - projectile.x);
  const distance = Math.max(1, Math.hypot(projectile.targetHint.x - projectile.x, projectile.targetHint.y - projectile.y));
  const speed = clamp(distance / 0.82, 210, 620) * (projectile.weapon === 'ats-grav-rocket' ? ZEPPELIN_ATS_LAUNCH_SPEED_SCALE : 1);
  projectile.vx = Math.cos(angle) * speed;
  projectile.vy = Math.sin(angle) * speed;
  projectile.angle = angle;
  projectile.lifetime = Math.max(0.4, distance / speed + 0.28);
  projectile.maxLifetime = projectile.lifetime;
  projectile.detonateDistance = distance;
  projectile.hideLandingMarkerUntilTargetHint = false;
  projectile.contrail = {
    ...ENEMY_RED_BLACK_CONTRAIL,
    emissionMeanPerSevenFrames: 7,
    maxParticlesPerStep: 9,
    particleLifetimeFrames: [5, 8],
    particleRadiusScale: 3,
    hazardDamage: ZEPPELIN_CURSED_TRAIL_DAMAGE,
    hazardRadius: ZEPPELIN_CURSED_TRAIL_RADIUS,
    hazardSourceEnemy: projectile.sourceEnemy,
    hazardAffectsEnemies: true,
    hazardAffectsPlayer: true,
    colors: ['#050506', '#19080a', '#711018', '#ff5a2d'],
  };
}

function syncEnemyBeamProjectiles(game) {
  for (const projectile of game.enemyProjectiles) {
    if (projectile.behavior !== 'beam' || !projectile.sourceEnemy || !projectile.sourceCellId) continue;
    const sourceCell = projectile.sourceEnemy.cells.find((cell) => cell.id === projectile.sourceCellId);
    if (!sourceCell || sourceCell.state.destroyed || projectile.sourceEnemy.destroyed || (projectile.weapon === 'walker-ground-sweep' && !walkerUsesElevatedSweepBeam(projectile.sourceEnemy))) {
      projectile.lifetime = 0;
      continue;
    }
    const source = enemyLocalToWorldPoint(projectile.sourceEnemy, {
      x: projectile.sourceOffset?.x ?? sourceCell.gridX * CELL_SIZE,
      y: projectile.sourceOffset?.y ?? sourceCell.gridY * CELL_SIZE,
    });
    projectile.x = source.x;
    projectile.y = source.y;
    projectile.sourceZ = enemyCellWorldHeight(projectile.sourceEnemy, sourceCell);
    if (projectile.sweepBeam && projectile.sweepTarget) {
      const progress = easeOutCubic(1 - Math.max(0, projectile.lifetime / Math.max(0.001, projectile.maxLifetime)));
      const start = projectile.sweepStart ?? { x: projectile.sourceEnemy.x, y: projectile.sourceEnemy.y };
      const end = {
        x: start.x + (projectile.sweepTarget.x - start.x) * progress,
        y: start.y + (projectile.sweepTarget.y - start.y) * progress,
      };
      projectile.angle = Math.atan2(end.y - projectile.y, end.x - projectile.x);
      projectile.length = Math.max(1, Math.hypot(end.x - projectile.x, end.y - projectile.y));
    }
  }
}

function easeOutCubic(t) {
  const clamped = clamp(t, 0, 1);
  return 1 - (1 - clamped) ** 3;
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
    if (projectile.sourceEnemy?.kind === 'zeppelinBoss' && enemy.kind === 'zeppelinBoss') continue;
    if (enemyHasAnyTag(enemy, blast.enemyIgnoreTags ?? [])) continue;
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
  shakeCameraFromExplosion(game, projectile, blast.radius, blast.impulse ?? blast.damage ?? 0);
  return effects;
}

function enemyHasAnyTag(enemy, tags = []) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const archetype = enemy.archetypeId ? getEnemyArchetype(enemy.archetypeId) : null;
  const haystack = [
    enemy.archetypeId,
    enemy.assetId,
    enemy.displayName,
    ...(archetype?.tags ?? []),
    ...(enemy.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return tags.some((tag) => haystack.includes(String(tag).toLowerCase()));
}

function shakeCameraFromExplosion(game, origin, radius, strength) {
  const distance = Math.hypot(game.vehicle.x - origin.x, game.vehicle.y - origin.y);
  const range = radius + CELL_SIZE * 24;
  if (distance > range) return;
  const proximity = 1 - distance / Math.max(1, range);
  const impulseScale = clamp((strength ?? 0) / 140, 0.18, 1);
  addCameraShake(game.camera, proximity * impulseScale * 0.55, 0.32);
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

function projectileSegmentsIntersectRange(a, b, radius) {
  const a0 = { x: a.previousX ?? a.x, y: a.previousY ?? a.y };
  const a1 = { x: a.x, y: a.y };
  const b0 = { x: b.previousX ?? b.x, y: b.previousY ?? b.y };
  const b1 = { x: b.x, y: b.y };
  if (segmentsIntersect(a0, a1, b0, b1)) return true;
  const rangeSquared = radius * radius;
  return (
    pointSegmentDistanceSquared(a0, b0, b1) <= rangeSquared ||
    pointSegmentDistanceSquared(a1, b0, b1) <= rangeSquared ||
    pointSegmentDistanceSquared(b0, a0, a1) <= rangeSquared ||
    pointSegmentDistanceSquared(b1, a0, a1) <= rangeSquared
  );
}

function pointSegmentDistanceSquared(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return distanceSquared(point, start);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distanceSquared(point, { x: start.x + dx * t, y: start.y + dy * t });
}

function segmentsIntersect(a0, a1, b0, b1) {
  const o1 = orientation(a0, a1, b0);
  const o2 = orientation(a0, a1, b1);
  const o3 = orientation(b0, b1, a0);
  const o4 = orientation(b0, b1, a1);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function orientation(a, b, c) {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
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
  if (projectile.forceMode === 'push') repelPlayerProjectilesWithEnemyBeam(game, projectile, dx, dy);
  const vehicleHitRange = CELL_SIZE * 4.2 + beamHalfWidth(projectile);
  const end = { x: projectile.x + dx * projectile.length, y: projectile.y + dy * projectile.length };
  if (pointSegmentDistanceSquared(game.vehicle, projectile, end) > vehicleHitRange * vehicleHitRange) return false;
  const along = clamp(((game.vehicle.x - projectile.x) * dx + (game.vehicle.y - projectile.y) * dy), 0, projectile.length);
  const startDistance = Math.max(0, along - vehicleHitRange);
  const endDistance = Math.min(projectile.length, along + vehicleHitRange);
  const collisionProjectile = { ...projectile, vx: dx, vy: dy };
  for (let distance = startDistance; distance <= endDistance; distance += step) {
    collisionProjectile.x = projectile.x + dx * distance;
    collisionProjectile.y = projectile.y + dy * distance;
    if (distanceSquared(collisionProjectile, game.vehicle) > vehicleHitRange * vehicleHitRange) continue;
    const hit = hitVehicleWithProjectile(game.vehicle, collisionProjectile);
    if (!hit.hit) continue;
    projectile.renderEndX = collisionProjectile.x;
    projectile.renderEndY = collisionProjectile.y;
    return true;
  }
  return false;
}

function repelPlayerProjectilesWithEnemyBeam(game, projectile, dx = Math.cos(projectile.angle), dy = Math.sin(projectile.angle)) {
  const halfWidth = beamHalfWidth(projectile);
  for (const target of game.playerProjectiles) {
    if (target.lifetime <= 0 || target.behavior === 'beam' || target.behavior === 'blast') continue;
    const along = (target.x - projectile.x) * dx + (target.y - projectile.y) * dy;
    if (along < 0 || along > projectile.length) continue;
    const closest = { x: projectile.x + dx * along, y: projectile.y + dy * along };
    if (distanceSquared(target, closest) > (halfWidth + target.radius) ** 2) continue;
    const speed = Math.max(70, Math.hypot(target.vx, target.vy));
    target.vx = dx * (speed + projectile.impulse * 0.55);
    target.vy = dy * (speed + projectile.impulse * 0.55);
    target.angle = projectile.angle;
    target.lifetime = Math.min(target.lifetime, 1.4);
  }
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
  const trace = traceEnemyVoxelBeam(
    activeEnemies(game).filter((enemy) => enemyCanBeHitByProjectile(enemy, projectile)),
    projectile,
    projectile.angle,
    projectile.length,
    halfWidth,
    projectile.pierce ?? 0,
    { groundOnly: projectile.behavior !== 'arc' },
  );
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
  const voxelWidth = (projectile.radius ?? 1) + envelope * 2.8 * (projectile.widthEnvelopeScale ?? 1);
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
  stepProjectileContrails(game, game.playerProjectiles, frameCount);
  stepProjectileContrails(game, game.enemyProjectiles, frameCount);
}

function stepProjectileContrails(game, projectiles, frameCount) {
  for (const projectile of projectiles) {
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
  pushSmokeParticle(game, {
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

function collectEnemyDetachScrapEvents(game) {
  for (const enemy of game.enemies) {
    for (const event of drainEnemyDetachEvents(enemy)) {
      if (event.reason === 'walker fall') startWalkerFallAnimation(game, enemy, event);
      spawnDetachedSupportScrap(game, enemy, event);
    }
  }
}

function startWalkerFallAnimation(game, enemy, event) {
  if (enemy.walkerFallAnimation || !isWalkerEnemy(enemy)) return;
  const bodyHeight = Math.max(1, event.gridZ ?? walkerRuntime(enemy).lowestBodyLayer ?? 1);
  const driftAngle = Math.atan2(enemy.vy ?? 0, enemy.vx ?? 0);
  const fallbackAngle = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
  const angle = Math.hypot(enemy.vx ?? 0, enemy.vy ?? 0) > 5 ? driftAngle : fallbackAngle;
  const side = game.rng.chance(0.5) ? 1 : -1;
  enemy.walkerFallAnimation = {
    timer: WALKER_FALL_ANIMATION_SECONDS,
    duration: WALKER_FALL_ANIMATION_SECONDS,
    hangSeconds: WALKER_FALL_HANG_SECONDS,
    impactProgress: WALKER_FALL_IMPACT_PROGRESS,
    startLift: bodyHeight * CELL_LAYER_HEIGHT * (enemy.visualScale ?? 1),
    tiltAngle: side * game.rng.range(0.42, 0.62),
    fallAngle: angle + side * Math.PI / 2,
    blastTimer: 0,
    soundTimer: 0,
    cueTimer: 0,
    cues: [],
    impacted: false,
  };
  enemy.walkerSweepWarning = null;
  enemy.walkerStaCooldown = Math.max(enemy.walkerStaCooldown ?? 0, WALKER_FALL_ANIMATION_SECONDS);
  enemy.walkerBeamCooldown = Math.max(enemy.walkerBeamCooldown ?? 0, WALKER_FALL_ANIMATION_SECONDS);
  enemy.walkerGroundedSpiralCooldown = Math.max(enemy.walkerGroundedSpiralCooldown ?? 0, WALKER_FALL_ANIMATION_SECONDS);
  enemy.walkerRepulsorCooldown = Math.max(enemy.walkerRepulsorCooldown ?? 0, WALKER_FALL_ANIMATION_SECONDS);
  emitRandomBossInternalExplosionSound(game);
}

function stepWalkerFallAnimation(game, enemy, dt) {
  const state = enemy.walkerFallAnimation;
  if (!state) return;
  state.timer = Math.max(0, state.timer - dt);
  const elapsed = state.duration - state.timer;
  const fallTime = Math.max(0.001, state.duration - state.hangSeconds);
  const fallProgress = clamp((elapsed - state.hangSeconds) / fallTime, 0, 1);
  state.progress = fallProgress;
  enemy.walkerSweepWarning = null;
  enemy.vx *= Math.pow(0.03, dt);
  enemy.vy *= Math.pow(0.03, dt);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  stepWalkerFallCues(game, enemy, state, elapsed, dt);

  if (elapsed >= state.hangSeconds) {
    state.soundTimer -= dt;
    state.blastTimer -= dt;
    if (state.soundTimer <= 0 && fallProgress < 0.95) {
      emitRandomBossInternalExplosionSound(game);
      state.soundTimer = game.rng.range(0.24, 0.42);
    }
    if (state.blastTimer <= 0 && fallProgress < 0.95) {
      spawnWalkerFallInternalBlastEffect(game, enemy);
      state.blastTimer = game.rng.range(0.1, 0.18);
    }
  }

  if (!state.impacted && fallProgress >= state.impactProgress) {
    state.impacted = true;
    spawnWalkerFallImpactEffect(game, enemy, state);
    addCameraShake(game.camera, 0.42, 0.32);
    emitSoundEvent(game, SOUND_EVENTS.ENEMY_DEATH);
  }

  updateEnemyCollisionRotation(enemy, game.time);
  if (state.timer > 0) return;
  enemy.walkerFallAnimation = null;
  enemy.walkerAngerTimer = WALKER_FALL_ANGER_SECONDS;
  enemy.walkerStaCooldown = 0;
  enemy.walkerBeamCooldown = 0;
  enemy.walkerGroundedSpiralCooldown = 0;
  enemy.walkerRepulsorCooldown = 0;
  for (const pattern of enemy.patterns ?? []) pattern.timer = Math.min(pattern.timer ?? 0, 0);
}

function stepWalkerFallCues(game, enemy, state, elapsed, dt) {
  state.cues ??= [];
  for (let index = state.cues.length - 1; index >= 0; index -= 1) {
    const cue = state.cues[index];
    cue.age = (cue.age ?? 0) + dt;
    if (cue.age >= cue.lifetime) state.cues.splice(index, 1);
  }
  if (elapsed >= state.hangSeconds) return;
  state.cueTimer -= dt;
  const panic = elapsed >= 3;
  if (state.cueTimer > 0) return;
  state.cueTimer = panic ? game.rng.range(0.07, 0.14) : game.rng.range(0.34, 0.52);
  const text = panic ? walkerPanicCueText(game.rng) : '?';
  state.cues.push({
    text,
    age: 0,
    lifetime: 2,
    x: game.rng.range(-enemy.radius * 0.18, enemy.radius * 0.18),
    y: -Math.max(CELL_SIZE * 2.6, enemy.radius * 0.3) + game.rng.range(-CELL_SIZE * 0.45, CELL_SIZE * 0.2),
    rise: game.rng.range(CELL_SIZE * 1.1, CELL_SIZE * 1.9),
    size: game.rng.range(CELL_SIZE * 0.72, CELL_SIZE * 0.98),
  });
}

function walkerPanicCueText(rng) {
  const scream = String.fromCodePoint(0x1f631);
  const dizzyFace = String.fromCodePoint(0x1f635);
  const choices = ['!', '!!', '!?', scream, dizzyFace];
  return choices[Math.floor(rng.range(0, choices.length))] ?? '!';
}

function spawnWalkerFallInternalBlastEffect(game, enemy) {
  const body = (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed && (cell.type === 'core' || cell.type === 'gun' || cell.role === 'elevatedBody' || cell.role === 'turretGun'));
  const source = body.length > 0 ? body : (enemy.cells ?? []).filter((cell) => !cell.state?.destroyed);
  const cell = source[Math.floor(game.rng.range(0, source.length))];
  const origin = cell
    ? enemyLocalToWorldPoint(enemy, { x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE })
    : { x: enemy.x, y: enemy.y };
  game.enemyProjectiles.push(createProjectile(origin.x, origin.y, 0, 0, {
    team: 'enemy',
    weapon: 'walker-internal-blast',
    behavior: 'blast',
    radius: 1,
    maxRadius: CELL_SIZE * game.rng.range(1.2, 2.6),
    damage: 0,
    impulse: 0,
    lifetime: 0.12,
    color: '#ff8f38',
  }));
  spawnBlackSmokeCloud(game, origin, 3);
}

function spawnWalkerFallImpactEffect(game, enemy, state) {
  const offset = CELL_SIZE * 2.2;
  const origin = {
    x: enemy.x + Math.cos(state.fallAngle ?? 0) * offset,
    y: enemy.y + Math.sin(state.fallAngle ?? 0) * offset,
  };
  game.enemyProjectiles.push(createProjectile(origin.x, origin.y, 0, 0, {
    team: 'enemy',
    weapon: 'walker-fall-impact',
    behavior: 'blast',
    radius: 1,
    maxRadius: CELL_SIZE * 4.2,
    damage: 0,
    impulse: 0,
    lifetime: 0.22,
    color: '#d6b06a',
  }));
  spawnBlackSmokeCloud(game, origin, 8);
}

function spawnDetachedSupportScrap(game, enemy, event) {
  const local = { x: event.gridX * CELL_SIZE, y: event.gridY * CELL_SIZE };
  const world = enemyLocalToWorldPoint(enemy, local);
  const dx = world.x - enemy.x;
  const dy = world.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const outward = { x: dx / distance, y: dy / distance };
  const count = Math.min(MAX_DETACHED_SUPPORT_SCRAP, Math.max(3, Math.ceil((event.cellCount ?? 1) / 4)));
  const value = Math.max(1, Math.round((event.voxels ?? count) / count));
  const fallBoost = event.reason === 'walker fall' ? 56 : 32;
  for (let index = 0; index < count; index += 1) {
    const angle = Math.atan2(outward.y, outward.x) + game.rng.range(-0.9, 0.9);
    const speed = game.rng.range(fallBoost, fallBoost + 74);
    game.scrapPickups.push({
      x: world.x + game.rng.range(-CELL_SIZE * 0.8, CELL_SIZE * 0.8),
      y: world.y + game.rng.range(-CELL_SIZE * 0.8, CELL_SIZE * 0.8),
      vx: enemy.vx * 0.2 + Math.cos(angle) * speed,
      vy: enemy.vy * 0.2 + Math.sin(angle) * speed,
      value,
      radius: Math.max(1.1, VOXEL_SIZE * 0.8),
      life: 18,
    });
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
  const particle = {
    x: projectile.x - cos * backOffset - sin * sideOffset,
    y: projectile.y - sin * backOffset + cos * sideOffset,
    vx: Math.cos(angle) * speed + projectile.vx * 0.05,
    vy: Math.sin(angle) * speed + projectile.vy * 0.05,
    radius: game.rng.range(0.7, 1.6) * radiusScale,
    color: colors[Math.floor(game.rng.range(0, colors.length))] ?? colors[0],
    lifetime: lifetimeFrames / 60,
    maxLifetime: lifetimeFrames / 60,
  };
  if ((projectile.contrail.hazardDamage ?? 0) > 0) {
    particle.weapon = 'cursed-rocket-contrail';
    particle.team = 'enemy';
    particle.damage = projectile.contrail.hazardDamage;
    particle.impulse = projectile.contrail.hazardImpulse ?? 8;
    particle.hazardRadius = projectile.contrail.hazardRadius ?? Math.max(particle.radius, CELL_SIZE);
    particle.hazardAffectsEnemies = projectile.contrail.hazardAffectsEnemies !== false;
    particle.hazardAffectsPlayer = projectile.contrail.hazardAffectsPlayer !== false;
    particle.hazardSourceEnemy = projectile.contrail.hazardSourceEnemy ?? projectile.sourceEnemy ?? null;
  }
  pushSmokeParticle(game, particle);
}

function stepGroundBeamScorchParticles(game, dt) {
  let emitted = false;
  for (const projectile of game.enemyProjectiles) {
    if (projectile.lifetime <= 0 || projectile.behavior !== 'beam' || projectile.endZ !== 0) continue;
    if (projectile.weapon !== 'zeppelin-ground-laser' && projectile.weapon !== 'walker-ground-sweep') continue;
    const length = Math.max(1, Math.hypot((projectile.renderEndX ?? projectile.x) - projectile.x, (projectile.renderEndY ?? projectile.y) - projectile.y) || projectile.length);
    const mean = Math.min(4.2, Math.max(0.8, length / 150)) * dt * 12;
    const count = Math.min(4, samplePoisson(game.rng, mean));
    for (let index = 0; index < count; index += 1) spawnGroundBeamScorchParticle(game, projectile, length);
    emitted ||= count > 0;
  }
  if (emitted) limitSmokeParticlesByKind(game, 'ground-beam-scorch', MAX_GROUND_BEAM_SCORCH_PARTICLES);
}

function spawnGroundBeamScorchParticle(game, projectile, length) {
  const angle = projectile.angle ?? 0;
  const distance = game.rng.range(0, length);
  const lifetimeMean = Math.max(0.08, (projectile.maxLifetime ?? projectile.lifetime ?? 0.25) * 0.42);
  const lifetime = clamp(-Math.log(Math.max(0.001, 1 - game.rng.next())) * lifetimeMean, 0.05, lifetimeMean * 2.4);
  const side = game.rng.range(-beamHalfWidth(projectile) * 0.8, beamHalfWidth(projectile) * 0.8);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  pushSmokeParticle(game, {
    kind: 'ground-beam-scorch',
    x: projectile.x + dx * distance + nx * side,
    y: projectile.y + dy * distance + ny * side,
    vx: nx * game.rng.range(-5, 5),
    vy: -game.rng.range(4, 16),
    radius: game.rng.range(0.9, 2.6),
    color: game.rng.chance(0.55) ? '#090807' : '#2c2520',
    lifetime,
    maxLifetime: lifetime,
    growth: game.rng.range(1.8, 5.2),
  });
}

function limitSmokeParticlesByKind(game, kind, maxCount) {
  let count = 0;
  for (const particle of game.smokeParticles) {
    if (particle.kind === kind) count += 1;
  }
  for (let index = 0; count > maxCount && index < game.smokeParticles.length; ) {
    if (game.smokeParticles[index].kind === kind) {
      game.smokeParticles.splice(index, 1);
      count -= 1;
    } else {
      index += 1;
    }
  }
}

function handleSmokeHazardDamage(game) {
  for (const particle of game.smokeParticles) {
    if ((particle.damage ?? 0) <= 0 || particle.weapon !== 'cursed-rocket-contrail') continue;
    const radius = particle.hazardRadius ?? particle.radius;
    if (particle.hazardAffectsPlayer && !particle.playerDamageApplied && distanceSquared(particle, game.vehicle) <= (radius + CELL_SIZE * 3.8) ** 2) {
      const hit = applyVehicleDamage(game.vehicle, particle, radius, particle.damage, particle.impulse ?? 0, directionFromTo(particle, game.vehicle));
      if (hit.hit) particle.playerDamageApplied = true;
    }
    if (particle.hazardAffectsEnemies && !particle.enemyDamageApplied) {
      for (const enemy of activeEnemies(game)) {
        if (enemy.kind === 'zeppelinBoss' || enemy === particle.hazardSourceEnemy) continue;
        if (distanceSquared(particle, enemy) > (radius + enemy.radius) ** 2) continue;
        const hit = applyEnemyDamage(enemy, {
          ...particle,
          radius,
          behavior: 'blast',
          damage: particle.damage,
          impulse: particle.impulse ?? 0,
        });
        if (!hit.hit) continue;
        particle.enemyDamageApplied = true;
        if (hit.destroyedNow) explodeEnemy(game, enemy);
        break;
      }
    }
  }
}

function pushSmokeParticle(game, particle) {
  game.smokeParticles.push(particle);
  const excess = game.smokeParticles.length - MAX_SMOKE_PARTICLES;
  if (excess > 0) game.smokeParticles.splice(0, excess);
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
  if (bossUsesInternalDestruction(enemy) && !enemy.internalDestructionComplete) {
    startBossInternalDestruction(game, enemy);
    return;
  }
  enemy.explosionStart = game.time;
  recordEnemyDefeat(game.score, enemy);
  game.scrapPickups.push(...enemyDeathPickups(game, enemy));
  if (enemy.inchworm?.role === 'segment' || enemy.inchworm?.suppressDeathBlast) return;
  if (bossUsesInternalDestruction(enemy)) emitRandomBossMainExplosionSound(game);
  else emitSoundEvent(game, SOUND_EVENTS.ENEMY_DEATH);
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

function enemyDeathPickups(game, enemy) {
  if (enemy.dropNoScrap) return [];
  const scrap = harvestEnemyScrap(enemy, game.rng);
  if ((enemy.buzzard?.feedValue ?? 0) > 0) {
    scrap.push(createRewardPickup(game, enemy, 'scrap', {
      value: Math.max(1, Math.floor(enemy.buzzard.feedValue)),
      radius: CELL_SIZE * 1.25,
    }));
  }
  if (enemy.dropProfile !== 'zeppelinWalker') return scrap;
  const totalValue = scrap.reduce((sum, pickup) => sum + (pickup.value ?? 0), 0);
  const reducedScrap = scrap.filter((_, index) => index % 3 === 0);
  const rewardOrigin = reducedScrap[0] ?? { x: enemy.x, y: enemy.y, vx: enemy.vx ?? 0, vy: enemy.vy ?? 0 };
  return [
    ...reducedScrap,
    createRewardPickup(game, rewardOrigin, 'ammoPack', {
      value: 0,
      fraction: 0.1,
      radius: CELL_SIZE * 1.7,
    }),
    createRewardPickup(game, rewardOrigin, 'repairPack', {
      value: Math.max(1, Math.ceil(totalValue / 3)),
      repairPower: Math.max(1, totalValue / 3),
      radius: CELL_SIZE * 1.6,
    }),
  ];
}

function createRewardPickup(game, origin, kind, overrides = {}) {
  const angle = game.rng.range(0, Math.PI * 2);
  const speed = game.rng.range(28, 76);
  return {
    kind,
    x: origin.x + game.rng.range(-CELL_SIZE * 2, CELL_SIZE * 2),
    y: origin.y + game.rng.range(-CELL_SIZE * 2, CELL_SIZE * 2),
    vx: (origin.vx ?? 0) * 0.1 + Math.cos(angle) * speed,
    vy: (origin.vy ?? 0) * 0.1 + Math.sin(angle) * speed,
    life: 18,
    ...overrides,
  };
}

function bossUsesInternalDestruction(enemy) {
  return enemy?.kind === 'boss' || enemy?.kind === 'zeppelinBoss' || enemy?.kind === 'pirateBoss' || enemy?.kind === 'roadBossCar';
}

function isOctopusBoss(enemy) {
  return enemy?.kind === 'boss' && (enemy.assetId === 'boss.octopus.prototype0' || enemy.archetypeId === 'boss.octagon.prototype0');
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

function closestBroadsideHeading(current, attackHeading) {
  const left = attackHeading + Math.PI / 2;
  const right = attackHeading - Math.PI / 2;
  return Math.abs(angleDelta(current, left)) <= Math.abs(angleDelta(current, right)) ? left : right;
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
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

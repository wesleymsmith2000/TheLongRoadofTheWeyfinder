import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEnemyBlastDamage,
  applyEnemyDamage,
  applyEnemyProjectilePierceDamage,
  createBossEnemy,
  createEnemy,
  createEnhancedEnemy,
  ENEMY_MODULE_LINEAR_SCALE,
  createEnhancedPirateShipEnemy,
  createMortarSkiffEnemy,
  createPirateShipEnemy,
  harvestEnemyScrap,
  traceEnemyVoxelRay,
} from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createGame, createLevelEnemies, stepGame } from '../src/core/game.js';
import { recalculateCell } from '../src/core/cell.js';
import { CELL_SIZE, VOXELS } from '../src/core/voxelMask.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';

const SINGLE_CORE_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.single_core_enemy',
  cells: [{ id: 'core', type: 'core', gridX: 0, gridY: 0 }],
  connections: [],
};

const SHELL_FALLBACK_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.shell_fallback_enemy',
  cells: [
    { id: 'core', type: 'core', gridX: 0, gridY: 0 },
    { id: 'shell', type: 'armor', gridX: -1, gridY: -1 },
  ],
  connections: [{ a: 'core', b: 'shell', aSide: 'top', bSide: 'bottom' }],
};

test('enemy takes voxel damage and records score damage', () => {
  const enemy = createEnemy(0, 0);
  const projectile = createProjectile(0, 0, 0, 0, { damage: 20, radius: 8, team: 'player' });
  const hit = applyEnemyDamage(enemy, projectile);
  assert.equal(hit.hit, true);
  assert.equal(enemy.damageTaken > 0, true);
});

test('enemies use doubled module footprints without scaling voxel masks', () => {
  const enemy = createEnemy(0, 0);
  const boss = createBossEnemy(0, 0);
  const gunCells = enemy.cells.filter((cell) => cell.type === 'gun');
  assert.equal(enemy.moduleLinearScale, ENEMY_MODULE_LINEAR_SCALE);
  assert.equal(enemy.cells.length, 33);
  assert.equal(gunCells.length, 4);
  assert.equal(enemy.cells.every((cell) => cell.mask.length === VOXELS && cell.mask.every((row) => row.length === VOXELS)), true);
  assert.equal(enemy.radius > CELL_SIZE * 3, true);
  assert.equal(boss.moduleLinearScale, ENEMY_MODULE_LINEAR_SCALE);
  assert.equal(boss.cells.filter((cell) => cell.type === 'gun').length > 64, true);
});

test('enemy destruction is detected when core is shredded', () => {
  const enemy = createEnemy(0, 0);
  for (let i = 0; i < 6; i += 1) {
    applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 100, radius: 12, team: 'player' }));
  }
  assert.equal(enemy.destroyed, true);
});

test('projectile impacts damage the nearest live voxel inside a hollowed core cell', () => {
  const enemy = createEnemy(0, 0);
  const core = enemy.cells.find((cell) => cell.type === 'core');
  for (const voxel of core.mask.flat()) {
    if (voxel.role === 'device') voxel.hp = 0;
  }
  const before = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const hit = applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 12, radius: 0.25, team: 'player' }));
  const after = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(hit.hit, true);
  assert.equal(after < before, true);
});

test('projectile impacts still damage the nearest voxel when contact lands in an empty cell pocket', () => {
  const enemy = createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 });
  const core = enemy.cells.find((cell) => cell.type === 'core');
  for (const voxel of core.mask.flat()) voxel.hp = 0;
  core.mask[0][0].hp = core.mask[0][0].maxHp;
  core.mask[0][1].hp = core.mask[0][1].maxHp;
  recalculateCell(core);
  const before = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const hit = applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 4, radius: 0.01, team: 'player' }));
  const after = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(hit.hit, true);
  assert.equal(after < before, true);
});

test('destroyed enemies no longer block beam ray tracing', () => {
  const destroyed = createEnemy(40, 0);
  const live = createEnemy(90, 0);
  destroyed.destroyed = true;
  const hit = traceEnemyVoxelRay([destroyed, live], { x: 0, y: 0 }, 0, 160);
  assert.equal(hit.enemy, live);
});

test('destroyed enemies explode and knock nearby enemies back', () => {
  const game = createGame();
  game.road.halfWidth = 1000;
  game.road.halfHeight = 1000;
  game.enemies = [createEnemy(0, 0), createEnemy(CELL_SIZE * 4, 0), createEnemy(CELL_SIZE * 13, 0)];
  game.playerProjectiles = [createProjectile(0, 0, 0, 0, { team: 'player', damage: 1000, radius: 12 })];
  stepGame(game, {}, 1 / 60);
  assert.equal(game.enemies[0].destroyed, true);
  assert.equal(game.enemies[0].explosionStart, game.time);
  assert.equal(game.enemies[1].vx > 0, true);
  assert.equal(game.enemies[1].vx < 220, true);
  assert.equal(game.enemies[2].vx, 0);
});

test('player main gun emits a sound event when firing', () => {
  const game = createGame();
  game.enemies = [createEnemy(game.vehicle.x + CELL_SIZE * 10, game.vehicle.y)];
  game.enemySpawnQueue = [];
  stepGame(game, { fireHeld: true, gunnerEnabled: false }, 1 / 60);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.PLAYER_MAIN_GUN), true);
});

test('cannon-style blast strips nearby outer shell voxels with shallow penetration', () => {
  const enemy = createEnemy(0, 0);
  const result = applyEnemyBlastDamage(enemy, { x: -CELL_SIZE * 1.7, y: 0 }, { damage: 24 });
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const coreRemoved = core.mask.flat().filter((voxel) => voxel.hp <= 0).length;
  assert.equal(result.hit, true);
  assert.equal(result.removed > 0, true);
  assert.equal(coreRemoved, 0);
});

test('blast excess damage propagates through consecutive voxels in range', () => {
  const enemy = createEnemy(0, 0);
  const result = applyEnemyBlastDamage(enemy, { x: -CELL_SIZE * 0.55, y: 0 }, {
    damage: 80,
    maxVoxelDistance: 12,
    closeVoxelDistance: 12,
    closePenetration: 2,
    farPenetration: 2,
  });
  assert.equal(result.hit, true);
  assert.equal(result.removed > 4, true);
});

test('blast overlap damages nearest live voxels when no voxel center is inside the blast', () => {
  const enemy = createEnemy(0, 0, SHELL_FALLBACK_ENEMY, [], { moduleScale: 1 });
  const shell = enemy.cells.find((cell) => cell.id === 'shell');
  for (const voxel of shell.mask.flat()) voxel.hp = 0;
  shell.mask[0][0].hp = shell.mask[0][0].maxHp;
  shell.mask[0][1].hp = shell.mask[0][1].maxHp;
  recalculateCell(shell);
  const before = shell.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const result = applyEnemyBlastDamage(enemy, { x: -CELL_SIZE / 2 - 0.01, y: -CELL_SIZE / 2 - 0.01 }, { damage: 8, maxVoxelDistance: 0.35 });
  const after = shell.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(result.hit, true);
  assert.equal(after < before, true);
});

test('close mortar blast destroys a stripped standard enemy core', () => {
  const enemy = createEnemy(0, 0);
  for (const cell of enemy.cells) {
    if (cell.type === 'core') continue;
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    recalculateCell(cell);
  }
  const result = applyEnemyBlastDamage(enemy, { x: enemy.x, y: enemy.y }, {
    damage: 90,
    maxVoxelDistance: 20,
    closeVoxelDistance: 5,
    closePenetration: 3,
    farPenetration: 1,
  });
  assert.equal(result.hit, true);
  assert.equal(enemy.destroyed, true);
});

test('projectile pierce carries damage into voxels behind the first struck module', () => {
  const enemy = createEnemy(0, 0);
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const before = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const projectile = createProjectile(-CELL_SIZE, 0, 100, 0, {
    team: 'player',
    weapon: 'test-flechette',
    damage: 100,
    radius: 0.4,
    pierce: 12,
    pierceDamageScale: 1,
    pierceDamageFalloff: 0.9,
  });
  const impact = applyEnemyDamage(enemy, projectile);
  const pierce = applyEnemyProjectilePierceDamage([enemy], projectile);
  const after = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(impact.hit, true);
  assert.equal(pierce.hit, true);
  assert.equal(after < before, true);
});

test('damage-budget blades damage nearest live voxel when crossing an empty cell pocket', () => {
  const enemy = createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 });
  const core = enemy.cells.find((cell) => cell.type === 'core');
  for (const voxel of core.mask.flat()) voxel.hp = 0;
  core.mask[0][0].hp = core.mask[0][0].maxHp;
  core.mask[0][1].hp = core.mask[0][1].maxHp;
  recalculateCell(core);
  const before = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const projectile = createProjectile(-CELL_SIZE, 0, 100, 0, {
    team: 'player',
    weapon: 'orb_flechette',
    damage: 18,
    radius: 0.1,
    pierce: 4,
    pierceDamageScale: 1,
    pierceDamageFalloff: 1,
    damagePiercesUntilSpent: true,
  });
  const pierce = applyEnemyProjectilePierceDamage([enemy], projectile, {
    start: { x: -CELL_SIZE, y: 0 },
    maxLength: CELL_SIZE * 2,
    maxHits: 4,
    halfWidth: 0.1,
    damageScale: 1,
  });
  const after = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(pierce.hit, true);
  assert.equal(after < before, true);
});

test('damage-budget blades use rotated enemy collision coordinates', () => {
  const enemy = createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 });
  enemy.collisionRotation = Math.PI / 2;
  const core = enemy.cells.find((cell) => cell.type === 'core');
  for (const voxel of core.mask.flat()) voxel.hp = 0;
  core.mask[0][0].hp = core.mask[0][0].maxHp;
  core.mask[0][1].hp = core.mask[0][1].maxHp;
  recalculateCell(core);
  const unit = CELL_SIZE / VOXELS;
  const localTopLeft = {
    x: 0.5 * unit - CELL_SIZE / 2,
    y: 0.5 * unit - CELL_SIZE / 2,
  };
  const visibleTopLeft = {
    x: -localTopLeft.y,
    y: localTopLeft.x,
  };
  const topLeftBefore = core.mask[0][0].hp;
  const topRightBefore = core.mask[0][1].hp;
  const projectile = createProjectile(visibleTopLeft.x, visibleTopLeft.y, 0, 0, {
    team: 'player',
    weapon: 'orb_flechette',
    damage: 1,
    radius: 0.1,
    pierce: 1,
    pierceDamageScale: 1,
    damagePiercesUntilSpent: true,
  });
  const pierce = applyEnemyProjectilePierceDamage([enemy], projectile, {
    start: visibleTopLeft,
    maxLength: 0,
    maxHits: 1,
    halfWidth: 0,
    damageScale: 1,
  });
  assert.equal(pierce.hit, true);
  assert.equal(core.mask[0][0].hp, topLeftBefore - 1);
  assert.equal(core.mask[0][1].hp, topRightBefore);
});

test('wide damage-budget blades sweep through enemies and keep remaining damage', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [createEnemy(0, 0)];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(-CELL_SIZE * 1.2, CELL_SIZE * 0.42, 2800, 0, {
      team: 'player',
      weapon: 'orb_flechette',
      damage: 1000,
      radius: 5.8,
      pierce: 4,
      pierceDamageFalloff: 1,
      damagePiercesUntilSpent: true,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'orb_flechette');
  assert.equal(Boolean(blade), true);
  assert.equal(blade.damage < 1000, true);
  assert.equal(blade.lifetime > 0, true);
  assert.equal(game.score.damageDone > 0, true);
});

test('damage-budget blades trace along actual frame travel instead of stale sprite angle', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(-CELL_SIZE * 5, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player',
      weapon: 'orb_flechette',
      angle: Math.PI / 2,
      damage: 18,
      radius: 0.1,
      pierce: 4,
      pierceDamageFalloff: 1,
      damagePiercesUntilSpent: true,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.score.damageDone > 0, true);
});

test('damage-budget blades ricochet toward the next enemy core on contact', () => {
  const game = createGame();
  game.autofire = false;
  const first = createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 });
  const second = createEnemy(0, CELL_SIZE * 10, SINGLE_CORE_ENEMY, [], { moduleScale: 1 });
  game.enemies = [first, second];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(-CELL_SIZE * 5, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player',
      weapon: 'orb_flechette',
      damage: 400,
      radius: 4.2,
      pierce: 48,
      pierceDamageFalloff: 1,
      damagePiercesUntilSpent: true,
      maxRicochets: 1,
      ricochetFactor: 0.5,
      ricochetOnEnemyExit: true,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'orb_flechette');
  assert.equal(first.destroyed, true);
  assert.equal(blade.ricochetCount, 1);
  assert.equal(blade.ricochetContactEnemy, null);
  assert.equal(blade.damage < 200, true);
  assert.equal(blade.angle > 1.2, true);
});

test('damage-budget blades ricochet after absorbing enemy projectiles', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [createEnemy(0, CELL_SIZE * 10, SINGLE_CORE_ENEMY, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(0, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player',
      weapon: 'blade_launcher',
      damage: 22,
      radius: 4.2,
      pierce: 4,
      damagePiercesUntilSpent: true,
      absorbsEnemyProjectiles: true,
      maxRicochets: 1,
      ricochetFactor: 0.5,
      ricochetOnEnemyExit: true,
      lifetime: 1,
    }),
  ];
  game.enemyProjectiles = [createProjectile(CELL_SIZE * 2, 0, 0, 0, { team: 'enemy', weapon: 'enemy-bullet', radius: 3, damage: 7, lifetime: 1 })];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'blade_launcher');
  assert.equal(game.enemyProjectiles.every((projectile) => projectile.lifetime <= 0), true);
  assert.equal(blade.ricochetCount, 1);
  assert.equal(blade.damage, 7.5);
  assert.equal(blade.angle > 1.2, true);
});

test('blade contact radius is enlarged for enemy projectile absorption', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(game.vehicle.x + CELL_SIZE * 8, game.vehicle.y, 0, 0, {
      team: 'player',
      weapon: 'blade_launcher',
      damage: 22,
      radius: 4,
      pierce: 4,
      damagePiercesUntilSpent: true,
      absorbsEnemyProjectiles: true,
      maxRicochets: 1,
      ricochetFactor: 0.5,
      ricochetOnEnemyExit: true,
      lifetime: 1,
    }),
  ];
  game.enemyProjectiles = [createProjectile(game.vehicle.x + CELL_SIZE * 8 + 6.8, game.vehicle.y, 0, 0, { team: 'enemy', weapon: 'enemy-bullet', radius: 2, damage: 7, lifetime: 1 })];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const blade = game.playerProjectiles.find((projectile) => projectile.weapon === 'blade_launcher');
  assert.equal(game.enemyProjectiles.every((projectile) => projectile.lifetime <= 0), true);
  assert.equal(blade.damage, 15);
});

test('spent damage-budget blades burst into flechettes after contact', () => {
  const game = createGame();
  game.autofire = false;
  game.rng.range = (min) => min;
  game.enemies = [createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(-CELL_SIZE * 5, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player',
      weapon: 'blade_launcher',
      damage: 80,
      radius: 4.2,
      pierce: 4,
      pierceDamageFalloff: 1,
      damagePiercesUntilSpent: true,
      maxRicochets: 0,
      ricochetOnEnemyExit: true,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const burst = game.playerProjectiles.filter((projectile) => projectile.weapon === 'blade_flechette');
  assert.equal(game.playerProjectiles.find((projectile) => projectile.weapon === 'blade_launcher')?.lifetime <= 0, true);
  assert.equal(burst.length, 8);
  assert.equal(burst.every((projectile) => projectile.damagePiercesUntilSpent && projectile.pierce === 4), true);
  assert.equal(burst.reduce((sum, projectile) => sum + projectile.damage, 0) > 0, true);
});

test('blade deflection converts enemy projectiles into player shots', () => {
  const game = createGame();
  game.autofire = false;
  game.rng.next = () => 0.1;
  game.enemies = [createEnemy(CELL_SIZE * 30, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(CELL_SIZE * 18, 0, 60, 0, {
      team: 'player',
      weapon: 'blade_launcher',
      damage: 22,
      radius: 4.2,
      pierce: 4,
      damagePiercesUntilSpent: true,
      absorbsEnemyProjectiles: true,
      projectileDeflectionProbability: 0.25,
      lifetime: 1,
    }),
  ];
  game.enemyProjectiles = [createProjectile(CELL_SIZE * 18 + 1, 0, -80, 0, { team: 'enemy', weapon: 'enemy-bullet', radius: 2, damage: 7, lifetime: 1 })];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const deflected = game.playerProjectiles.find((projectile) => projectile.weapon === 'deflected-enemy-bullet');
  assert.equal(game.enemyProjectiles.every((projectile) => projectile.lifetime <= 0), true);
  assert.equal(Boolean(deflected), true);
  assert.equal(deflected.team, 'player');
  assert.equal(deflected.vx > 0, true);
});

test('mortar skiff roams, fires inaccurate arcing mortars, and gets dizzy on road turns', () => {
  const game = createGame(1147, {
    terrainRoute: {
      startX: 0,
      startY: 0,
      startHeading: 0,
      segments: [
        { id: 'short.straight', length: 5, turnRadians: 0 },
        { id: 'test.curve', length: 90, turnRadians: Math.PI / 4 },
      ],
    },
  });
  game.autofire = false;
  const skiff = createMortarSkiffEnemy(game.vehicle.x + 120, game.vehicle.y - 80);
  skiff.artilleryTimer = 0;
  game.enemies = [skiff];
  game.enemySpawnQueue = [];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const shell = game.enemyProjectiles.find((projectile) => projectile.weapon === 'enemy-mortar');
  assert.equal(Boolean(shell), true);
  assert.equal(shell.behavior, 'arc');
  assert.equal(shell.detonateAtTarget, true);
  assert.equal(Boolean(shell.targetHint?.x), true);
  assert.equal(Boolean(shell.landingMarkerSprite), true);

  game.enemyProjectiles = [];
  skiff.artilleryTimer = 0;
  skiff.vx = 120;
  game.road.routeDistance = 4.9;
  game.road.routeSegmentIndex = 0;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(skiff.dizzyTimer > 2, true);
  assert.equal(game.enemyProjectiles.length, 0);
  assert.equal(Math.abs(skiff.vx) < 120, true);
});

test('heavy mortar boats fire one shell per warning marker with nearest impacts first', () => {
  const game = createGame();
  game.autofire = false;
  const boat = createEnemy(game.vehicle.x + 210, game.vehicle.y - 120);
  boat.archetypeId = 'heavy_mortar_boat.pirates_road';
  boat.patterns = [];
  boat.artilleryTimer = 0;
  game.enemies = [boat];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  const shells = game.enemyProjectiles.filter((projectile) => projectile.weapon === 'enemy-mortar');
  assert.equal(shells.length, 7);
  for (let index = 1; index < shells.length; index += 1) {
    assert.equal(pointDistanceSquared(boat, shells[index - 1].targetHint) <= pointDistanceSquared(boat, shells[index].targetHint), true);
    assert.equal(shells[index - 1].arcFlightTime < shells[index].arcFlightTime, true);
  }
});

test('digitized stream hopper is enlarged and uses the slower hop impulse', () => {
  const game = createGame();
  const frog = createLevelEnemies(game.road, 1, ['DigitizedStream_1'])[0];
  frog.x = game.vehicle.x - 100;
  frog.y = game.vehicle.y;
  frog.vx = 0;
  frog.vy = 0;
  frog.hopTimer = 0;
  game.enemies = [frog];
  game.enemySpawnQueue = [];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(frog.assetId, 'example.construct.tractor_frog_sculpted');
  assert.equal(frog.hopperVisualBias, 1.5);
  assert.equal(frog.radius > CELL_SIZE * 3, true);
  assert.equal(frog.vx > 70 && frog.vx < 72, true);
});

test('destroyed enemy remaining voxels become collectible scrap', () => {
  const enemy = createEnemy(0, 0);
  enemy.destroyed = true;
  const pickups = harvestEnemyScrap(enemy);
  assert.equal(pickups.length > 0, true);
  assert.equal(enemy.cells.every((cell) => cell.mask.flat().every((voxel) => voxel.hp <= 0)), true);
});

test('sequential enemy pulse projectile explodes after acceleration window', () => {
  const game = createGame();
  game.enemies = [];
  game.enemyProjectiles = [
    createProjectile(game.vehicle.x + 5, game.vehicle.y, 0, 0, {
      team: 'enemy',
      weapon: 'enemy-pulse',
      radius: 2,
      damage: 7,
      impulse: 80,
      lifetime: 6,
      delayBeforeAcceleration: 0.001,
      stopBeforeAcceleration: true,
      acceleration: 140,
      accelerationDuration: 0.001,
      accelerationTarget: game.vehicle,
      explodeAfterAcceleration: true,
      blastOnExpire: { radius: 14, damage: 4.5, impulse: 55 },
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'enemy-pulse-blast'), true);
});

test('boss beam turns off when its source gun is destroyed', () => {
  const game = createGame();
  const boss = createBossEnemy(game.vehicle.x + 120, game.vehicle.y);
  const source = boss.cells.find((cell) => cell.id === 'arm-0-0-gun');
  game.enemies = [boss];
  game.enemyProjectiles = [
    createProjectile(boss.x + source.gridX * CELL_SIZE, boss.y + source.gridY * CELL_SIZE, 0, 0, {
      team: 'enemy',
      weapon: 'boss-laser',
      behavior: 'beam',
      radius: 2,
      damage: 5,
      impulse: 20,
      lifetime: 1,
      length: 120,
      angle: Math.PI,
      sourceEnemy: boss,
      sourceCellId: source.id,
    }),
  ];
  source.state.destroyed = true;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const beam = game.enemyProjectiles.find((projectile) => projectile.weapon === 'boss-laser');
  assert.equal(beam.lifetime <= 0, true);
});

test('enhanced enemy frontal shield absorbs player projectiles while charging', () => {
  const game = createGame();
  game.enemies = [createEnemy(game.vehicle.x + 20, game.vehicle.y)];
  const enemy = game.enemies[0];
  enemy.kind = 'enhanced';
  enemy.shieldActive = true;
  enemy.charge = { state: 'charging', timer: 1, x: -1, y: 0 };
  game.playerProjectiles = [
    createProjectile(enemy.x - 2, enemy.y, 0, 0, {
      team: 'player',
      weapon: 'bullet',
      radius: 2,
      damage: 100,
      impulse: 20,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.playerProjectiles[0]?.lifetime ?? 0, 0);
  assert.equal(enemy.destroyed, false);
});

test('standard enemy radial ring shots absorb player projectiles', () => {
  const game = createGame();
  game.autofire = false;
  game.enemies = [];
  const shieldPoint = { x: game.vehicle.x + 100, y: game.vehicle.y };
  game.enemyProjectiles = [
    createProjectile(shieldPoint.x, shieldPoint.y, 0, 0, {
      team: 'enemy',
      weapon: 'bullet',
      radius: 3,
      damage: 7,
      lifetime: 2,
      color: '#3d6f8f',
      absorbsPlayerProjectiles: true,
      absorbHp: 18,
    }),
  ];
  game.playerProjectiles = [
    createProjectile(shieldPoint.x + 1, shieldPoint.y, 0, 0, {
      team: 'player',
      weapon: 'bullet',
      radius: 1.5,
      damage: 8,
      lifetime: 1,
    }),
  ];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.playerProjectiles[0]?.lifetime ?? 0, 0);
  assert.equal(game.enemyProjectiles[0].lifetime > 0, true);
  assert.equal(game.enemyProjectiles[0].absorbHp, 10);
});

test('boss arm attack mix can schedule and fire a tracking laser', () => {
  const game = createGame();
  const boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y);
  boss.armUnfurl = 1;
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.rng.next = () => 0.96;
  game.rng.range = (min, max) => min + (max - min) * game.rng.next();
  boss.arms[0].fireTimer = 0;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(Boolean(boss.arms[0].laser), true);
  assert.equal(boss.arms[0].laser.duration, 3);
  const initialTarget = { ...boss.arms[0].laser.target };
  game.vehicle.x += 80;
  for (let index = 0; index < 130; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(Math.abs(boss.arms[0].laser.target.x - game.vehicle.x) < 0.001, true);
  for (let index = 0; index < 12; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const lockedTarget = { ...boss.arms[0].laser.target };
  game.vehicle.x += 80;
  for (let index = 0; index < 30; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.deepEqual(boss.arms[0].laser.target, lockedTarget);
  for (let index = 0; index < 10; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'boss-laser' && projectile.behavior === 'beam'), true);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.ENEMY_BEAM), true);
  assert.notDeepEqual(initialTarget, lockedTarget);
});

test('boss accelerates back toward the view area after being knocked away', () => {
  const game = createGame();
  const boss = createBossEnemy(game.road.x + game.road.halfWidth + 360, game.road.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.vx < 0, true);
});

test('enhanced enemies can carry level style palettes', () => {
  const enemy = createEnhancedEnemy(0, 0);
  enemy.palette = { armor: '#123456' };
  assert.equal(enemy.palette.armor, '#123456');
});

test('pirate ship enemies use elongated hulls and enhanced ram bulkheads', () => {
  const standard = createPirateShipEnemy(0, 0);
  const enhanced = createEnhancedPirateShipEnemy(0, 0);
  assert.equal(standard.silhouette, 'pirateShip');
  assert.equal(standard.cells.some((cell) => cell.id === 'bow'), true);
  assert.equal(enhanced.kind, 'enhanced');
  assert.equal(enhanced.ramBulkhead, true);
  assert.equal(enhanced.cells.some((cell) => cell.id === 'skull-bulkhead'), true);
});

test('damaged enemy guns inhibit firing', () => {
  const game = createGame();
  const enemy = createEnemy(game.vehicle.x + 50, game.vehicle.y);
  game.enemies = [enemy];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];
  for (const gun of enemy.cells.filter((cell) => cell.type === 'gun')) destroyDeviceVoxels(gun);

  for (let index = 0; index < 160; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(game.enemyProjectiles.length, 0);
});

test('disarmed ghost phasers phase in, charge, and self detonate', () => {
  const game = createGame();
  const enemy = createEnemy(game.vehicle.x + CELL_SIZE * 6, game.vehicle.y);
  enemy.archetypeId = 'ghost_phaser.ghost_forrest';
  enemy.phasedOut = true;
  enemy.phaseTimer = 10;
  game.enemies = [enemy];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];
  for (const gun of enemy.cells.filter((cell) => cell.type === 'gun')) destroyDeviceVoxels(gun);

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(enemy.phasedOut, false);
  assert.equal(enemy.phantomOverload.timer < 3, true);
  assert.equal(enemy.renderAlpha > 0.6, true);
  assert.equal(enemy.vx < 0, true);
  assert.equal(game.enemyProjectiles.length, 0);

  for (let index = 0; index < 190 && !enemy.destroyed; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
  }

  assert.equal(enemy.destroyed, true);
  assert.equal(enemy.explosionStart != null, true);
});

test('overloaded ghost phasers explode immediately on player contact', () => {
  const game = createGame();
  const enemy = createEnemy(game.vehicle.x, game.vehicle.y);
  enemy.archetypeId = 'ghost_phaser.ghost_forrest';
  enemy.phasedOut = true;
  game.enemies = [enemy];
  game.enemySpawnQueue = [];
  for (const gun of enemy.cells.filter((cell) => cell.type === 'gun')) destroyDeviceVoxels(gun);
  const beforeHp = vehicleHitPoints(game.vehicle);

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(enemy.destroyed, true);
  assert.equal(enemy.explosionStart, game.time);
  assert.equal(vehicleHitPoints(game.vehicle) < beforeHp, true);
});

test('damaged enhanced enemy engines inhibit charge acceleration', () => {
  const healthyGame = createGame();
  const damagedGame = createGame();
  const healthy = createEnhancedEnemy(healthyGame.vehicle.x + 70, healthyGame.vehicle.y);
  const damaged = createEnhancedEnemy(damagedGame.vehicle.x + 70, damagedGame.vehicle.y);
  healthy.charge = { state: 'charging', timer: 1, x: -1, y: 0 };
  damaged.charge = { state: 'charging', timer: 1, x: -1, y: 0 };
  for (const engine of damaged.cells.filter((cell) => cell.type === 'engine')) destroyDeviceVoxels(engine);
  healthyGame.enemies = [healthy];
  damagedGame.enemies = [damaged];
  healthyGame.enemySpawnQueue = [];
  damagedGame.enemySpawnQueue = [];

  stepGame(healthyGame, { gunnerEnabled: false }, 1 / 60);
  stepGame(damagedGame, { gunnerEnabled: false }, 1 / 60);

  assert.equal(Math.abs(damaged.vx) < Math.abs(healthy.vx), true);
});

function destroyDeviceVoxels(cell) {
  for (const row of cell.mask) {
    for (const voxel of row) {
      if (voxel.role === 'device' || voxel.role === 'wire') voxel.hp = 0;
    }
  }
  recalculateCell(cell);
}

function vehicleHitPoints(vehicle) {
  return vehicle.cells.reduce((sum, cell) => sum + cell.mask.flat().reduce((cellSum, voxel) => cellSum + Math.max(0, voxel.hp), 0), 0);
}

function pointDistanceSquared(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

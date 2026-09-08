import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEnemyBlastDamage,
  applyEnemyDamage,
  applyEnemyProjectilePierceDamage,
  createBossEnemy,
  createEnemy,
  createZeppelinBossEnemy,
  createEnhancedEnemy,
  ENEMY_MODULE_LINEAR_SCALE,
  createEnhancedPirateShipEnemy,
  createMortarSkiffEnemy,
  createPirateShipEnemy,
  drainEnemyDetachEvents,
  harvestEnemyScrap,
  traceEnemyVoxelRay,
  updateEnemyDestroyed,
} from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createGame, createLevelEnemies, stepGame } from '../src/core/game.js';
import { recalculateCell } from '../src/core/cell.js';
import { CELL_LAYER_HEIGHT, CELL_SIZE, Roles, VOXELS } from '../src/core/voxelMask.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';
import enemyAimedShotDefinition from '../content/patterns/enemy_aimed_shot.json' with { type: 'json' };

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

const LAYERED_WALKER_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.layered_walker_enemy',
  cells: [
    { id: 'lower-wheel', type: 'wheel', gridX: 0, gridY: 0, gridZ: 0 },
    { id: 'lower-armor', type: 'armor', gridX: 1, gridY: 0, gridZ: 0 },
    { id: 'middle-wheel', type: 'wheel', gridX: 0, gridY: 0, gridZ: 1 },
    { id: 'middle-armor', type: 'armor', gridX: 1, gridY: 0, gridZ: 1 },
    { id: 'raised-core', type: 'core', gridX: 0, gridY: 0, gridZ: 2 },
  ],
  connections: [
    { a: 'lower-wheel', b: 'middle-wheel', aSide: 'above', bSide: 'below' },
    { a: 'middle-wheel', b: 'raised-core', aSide: 'above', bSide: 'below' },
    { a: 'lower-wheel', b: 'lower-armor', aSide: 'right', bSide: 'left' },
    { a: 'middle-wheel', b: 'middle-armor', aSide: 'right', bSide: 'left' },
  ],
};

const MULTI_CORE_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.multi_core_enemy',
  cells: [
    { id: 'core-a', type: 'core', gridX: 0, gridY: 0 },
    { id: 'core-b', type: 'core', gridX: 1, gridY: 0 },
    { id: 'gun', type: 'gun', gridX: 2, gridY: 0 },
  ],
  connections: [
    { a: 'core-a', b: 'core-b', aSide: 'right', bSide: 'left' },
    { a: 'core-b', b: 'gun', aSide: 'right', bSide: 'left' },
  ],
};

const WALKER_SWEEP_TEST_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.walker_sweep_enemy',
  cells: [
    { id: 'lower-wheel', type: 'wheel', gridX: 0, gridY: 0, gridZ: 0, role: 'supportLeg' },
    { id: 'middle-wheel', type: 'wheel', gridX: 0, gridY: 0, gridZ: 1, role: 'supportLeg' },
    { id: 'body', type: 'armor', gridX: 0, gridY: 0, gridZ: 2, role: 'elevatedBody' },
    { id: 'gun', type: 'gun', gridX: 0, gridY: -1, gridZ: 2, role: 'turretGun' },
    { id: 'core', type: 'core', gridX: 0, gridY: 1, gridZ: 2, role: 'core' },
  ],
  connections: [
    { a: 'lower-wheel', b: 'middle-wheel', aSide: 'above', bSide: 'below' },
    { a: 'middle-wheel', b: 'body', aSide: 'above', bSide: 'below' },
    { a: 'body', b: 'gun', aSide: 'top', bSide: 'bottom' },
    { a: 'body', b: 'core', aSide: 'bottom', bSide: 'top' },
  ],
};

const WALKER_STABILITY_TEST_ENEMY = {
  schemaVersion: '0.1',
  assetId: 'test.walker_stability_enemy',
  cells: [
    { id: 'left-front-low', type: 'wheel', gridX: -2, gridY: -1, gridZ: 0, role: 'supportLeg', legId: 'leftFront' },
    { id: 'left-rear-low', type: 'wheel', gridX: -2, gridY: 1, gridZ: 0, role: 'supportLeg', legId: 'leftRear' },
    { id: 'right-front-low', type: 'wheel', gridX: 2, gridY: -1, gridZ: 0, role: 'supportLeg', legId: 'rightFront' },
    { id: 'right-rear-low', type: 'wheel', gridX: 2, gridY: 1, gridZ: 0, role: 'supportLeg', legId: 'rightRear' },
    { id: 'left-front-mid', type: 'wheel', gridX: -2, gridY: -1, gridZ: 1, role: 'supportLeg', legId: 'leftFront' },
    { id: 'left-rear-mid', type: 'wheel', gridX: -2, gridY: 1, gridZ: 1, role: 'supportLeg', legId: 'leftRear' },
    { id: 'right-front-mid', type: 'wheel', gridX: 2, gridY: -1, gridZ: 1, role: 'supportLeg', legId: 'rightFront' },
    { id: 'right-rear-mid', type: 'wheel', gridX: 2, gridY: 1, gridZ: 1, role: 'supportLeg', legId: 'rightRear' },
    { id: 'body', type: 'armor', gridX: 0, gridY: 0, gridZ: 2, role: 'elevatedBody' },
    { id: 'core', type: 'core', gridX: 0, gridY: 1, gridZ: 2, role: 'core' },
  ],
  connections: [
    { a: 'left-front-low', b: 'left-front-mid', aSide: 'above', bSide: 'below' },
    { a: 'left-rear-low', b: 'left-rear-mid', aSide: 'above', bSide: 'below' },
    { a: 'right-front-low', b: 'right-front-mid', aSide: 'above', bSide: 'below' },
    { a: 'right-rear-low', b: 'right-rear-mid', aSide: 'above', bSide: 'below' },
    { a: 'body', b: 'core', aSide: 'bottom', bSide: 'top' },
  ],
};

function destroyTestCells(enemy, ids) {
  const wanted = new Set(ids);
  for (const cell of enemy.cells.filter((candidate) => wanted.has(candidate.id))) {
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    recalculateCell(cell);
  }
}

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

test('standard enemies survive until every original core is destroyed', () => {
  const enemy = createEnemy(0, 0, MULTI_CORE_ENEMY, [], { moduleScale: 1 });
  const coreA = enemy.cells.find((cell) => cell.id === 'core-a');
  const coreB = enemy.cells.find((cell) => cell.id === 'core-b');

  for (const voxel of coreA.mask.flat()) voxel.hp = 0;
  recalculateCell(coreA);
  updateEnemyDestroyed(enemy);
  assert.equal(enemy.destroyed, false);

  for (const voxel of coreB.mask.flat()) voxel.hp = 0;
  recalculateCell(coreB);
  updateEnemyDestroyed(enemy);
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

test('layered walkers expose only the lowest live layer to ground projectile damage', () => {
  const enemy = createEnemy(0, 0, LAYERED_WALKER_ENEMY, [], { moduleScale: 1 });
  enemy.elevation = { z: 0, canBeHitByGroundFire: true, layeredExposure: true };
  const lower = enemy.cells.find((cell) => cell.id === 'lower-wheel');
  const middle = enemy.cells.find((cell) => cell.id === 'middle-wheel');
  const core = enemy.cells.find((cell) => cell.id === 'raised-core');
  const middleBefore = middle.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const coreBefore = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const hit = applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 20, radius: 3, team: 'player' }));
  const lowerAfter = lower.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const middleAfter = middle.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const coreAfter = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(hit.cell.id, 'lower-wheel');
  assert.equal(lowerAfter < middleBefore, true);
  assert.equal(middleAfter, middleBefore);
  assert.equal(coreAfter, coreBefore);
});

test('armor-only lowest walker layers fall away and expose the next layer', () => {
  const enemy = createEnemy(0, 0, LAYERED_WALKER_ENEMY, [], { moduleScale: 1 });
  enemy.elevation = { z: 0, canBeHitByGroundFire: true, layeredExposure: true };
  const lowerArmor = enemy.cells.find((cell) => cell.id === 'lower-armor');
  const middle = enemy.cells.find((cell) => cell.id === 'middle-wheel');
  const middleBefore = middle.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  const first = applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 200, radius: 5, team: 'player' }));
  assert.equal(first.cell.id, 'lower-wheel');
  assert.equal(lowerArmor.state.destroyed, true);
  const second = applyEnemyDamage(enemy, createProjectile(0, 0, 0, 0, { damage: 4, radius: 1, team: 'player' }));
  const middleAfter = middle.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(second.cell.id, 'middle-wheel');
  assert.equal(middleAfter < middleBefore, true);
});

test('unstable walker support slices shear away before the body falls', () => {
  const enemy = createEnemy(0, 0, WALKER_STABILITY_TEST_ENEMY, [], { moduleScale: 1 });
  destroyTestCells(enemy, ['left-rear-low', 'right-front-low', 'right-rear-low']);

  const hit = applyEnemyDamage(enemy, createProjectile(0, CELL_SIZE, 0, 0, { behavior: 'arc', damage: 1, radius: 1, team: 'player' }));

  assert.equal(hit.hit, true);
  assert.equal(enemy.cells.filter((cell) => (cell.gridZ ?? 0) === 0).every((cell) => cell.state.destroyed), true);
  assert.equal(enemy.cells.filter((cell) => (cell.gridZ ?? 0) === 1 && cell.role === 'supportLeg').some((cell) => !cell.state.destroyed), true);
  assert.equal(enemy.stability?.fallen, undefined);
  const events = drainEnemyDetachEvents(enemy);
  assert.equal(events.some((event) => event.reason === 'unstable support slice 0'), true);
});

test('walkers fall when remaining live legs are only on one side', () => {
  const enemy = createEnemy(0, 0, WALKER_STABILITY_TEST_ENEMY, [], { moduleScale: 1 });
  destroyTestCells(enemy, ['right-front-low', 'right-rear-low', 'right-front-mid', 'right-rear-mid']);

  const hit = applyEnemyDamage(enemy, createProjectile(0, CELL_SIZE, 0, 0, { behavior: 'arc', damage: 1, radius: 1, team: 'player' }));

  assert.equal(hit.hit, true);
  assert.equal(enemy.stability.fallen, true);
  assert.equal(enemy.cells.filter((cell) => cell.role === 'supportLeg').every((cell) => cell.state.destroyed), true);
  assert.equal(enemy.cells.find((cell) => cell.id === 'core').state.destroyed, false);
  const events = drainEnemyDetachEvents(enemy);
  assert.equal(events.some((event) => event.reason === 'walker fall'), true);
});

test('walker fall events play an internal collapse animation before grounded recovery', () => {
  const game = createGame();
  game.autofire = false;
  const enemy = createEnemy(game.vehicle.x + CELL_SIZE * 8, game.vehicle.y, WALKER_STABILITY_TEST_ENEMY, [], { moduleScale: 1 });
  enemy.archetypeId = 'twilight_walker.prototype0';
  destroyTestCells(enemy, ['right-front-low', 'right-rear-low', 'right-front-mid', 'right-rear-mid']);
  game.enemies = [enemy];
  game.enemySpawnQueue = [];

  applyEnemyDamage(enemy, createProjectile(enemy.x, enemy.y + CELL_SIZE, 0, 0, { behavior: 'arc', damage: 1, radius: 1, team: 'player' }));
  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(Boolean(enemy.walkerFallAnimation), true);
  assert.equal(enemy.walkerSweepWarning, null);
  assert.equal(consumeSoundEvents(game).some((event) => event.id.startsWith('boss-internal-explosion')), true);

  let sawFallEffect = false;
  for (let index = 0; index < 90; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    sawFallEffect ||= game.enemyProjectiles.some((projectile) => projectile.weapon === 'walker-internal-blast' || projectile.weapon === 'walker-fall-impact');
  }

  assert.equal(enemy.walkerFallAnimation, null);
  assert.equal(enemy.walkerAngerTimer > 0, true);
  assert.equal(enemy.walkerSweepWarning, null);
  assert.equal(sawFallEffect, true);
});

test('blast radius includes walker layer height when damaging raised cells', () => {
  const enemy = createEnemy(0, 0, LAYERED_WALKER_ENEMY, [], { moduleScale: 1 });
  enemy.elevation = { z: 0, canBeHitByGroundFire: true, layeredExposure: true };
  const core = enemy.cells.find((cell) => cell.id === 'raised-core');
  const coreBefore = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  applyEnemyBlastDamage(enemy, { x: 0, y: 0, z: 0 }, {
    damage: 80,
    maxVoxelDistance: CELL_LAYER_HEIGHT / 3,
    closeVoxelDistance: 1,
    closePenetration: 3,
    farPenetration: 3,
  });
  const coreAfterSmallBlast = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(coreAfterSmallBlast, coreBefore);
  applyEnemyBlastDamage(enemy, { x: 0, y: 0, z: 0 }, {
    damage: 80,
    maxVoxelDistance: (CELL_LAYER_HEIGHT * 3) / (CELL_SIZE / VOXELS),
    closeVoxelDistance: 20,
    closePenetration: 3,
    farPenetration: 3,
  });
  const coreAfterLargeBlast = core.mask.flat().reduce((sum, voxel) => sum + voxel.hp, 0);
  assert.equal(coreAfterLargeBlast < coreBefore, true);
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

test('over-penetrating damage-budget blades burst into flechettes after contact with no ricochets left', () => {
  const game = createGame();
  game.autofire = false;
  game.rng.range = (min) => min;
  game.enemies = [createEnemy(0, 0, SINGLE_CORE_ENEMY, [], { moduleScale: 1 })];
  game.enemySpawnQueue = [];
  game.playerProjectiles = [
    createProjectile(-CELL_SIZE * 5, 0, CELL_SIZE * 5 * 60, 0, {
      team: 'player',
      weapon: 'blade_launcher',
      damage: 300,
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
  assert.equal(shell.blastOnExpire.radius.toFixed(3), (CELL_SIZE * 7.5 * 1.5).toFixed(3));
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
  assert.equal(shells.every((shell) => shell.blastOnExpire.radius.toFixed(3) === (CELL_SIZE * 7.5).toFixed(3)), true);
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

test('octopus boss arm destruction drops partial scrap, smoke, and phases out briefly', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.scrapPickups = [];
  game.smokeParticles = [];
  const armCells = boss.cells.filter((cell) => cell.id.startsWith('arm-0-'));
  for (const voxel of armCells[0].mask.flat()) voxel.hp = 0;
  recalculateCell(armCells[0]);
  const remainingLiveVoxels = armCells.reduce(
    (sum, cell) => sum + cell.mask.flat().filter((voxel) => voxel.hp > 0).length,
    0,
  );

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(boss.arms[0].detonated, true);
  assert.equal(boss.phasedOut, true);
  assert.equal(boss.armPhaseOutTimer > 1.8, true);
  assert.equal(game.scrapPickups.length >= Math.floor(remainingLiveVoxels / 4) - 1, true);
  assert.equal(game.smokeParticles.some((particle) => particle.color === '#050506' || particle.color === '#1b1718'), true);
});

test('octopus boss shows anger after limb loss', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  const armCells = boss.cells.filter((cell) => cell.id.startsWith('arm-0-'));
  for (const voxel of armCells[0].mask.flat()) voxel.hp = 0;
  recalculateCell(armCells[0]);

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(boss.arms[0].detonated, true);
  assert.equal(boss.bossAngerTimer > 1.4, true);
  assert.equal(boss.octopusRetreat, undefined);
});

test('octopus boss can retreat and clear the fight after all limbs are lost', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];
  game.smokeParticles = [];
  for (const arm of boss.arms) {
    const cell = boss.cells.find((candidate) => candidate.id.startsWith(`arm-${arm.index}-`));
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    recalculateCell(cell);
  }

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(Boolean(boss.octopusRetreat), true);
  assert.equal(boss.octopusRetreat.phase, 'panic');
  assert.equal(boss.destroyed, false);

  boss.armPhaseOutTimer = 0;
  boss.octopusRetreat.timer = 0;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.octopusRetreat.phase, 'retreat');
  assert.equal(game.smokeParticles.length > 0, true);

  for (let index = 0; index < 520 && !boss.destroyed; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(boss.destroyed, true);
  assert.equal(boss.escaped, true);
  assert.equal(boss.explosionStart, null);
});

test('octopus boss core loss starts an internal destruction sequence before final defeat', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.scrapPickups = [];
  game.playerProjectiles = [];
  game.enemyProjectiles = [];
  for (const core of boss.cells.filter((cell) => cell.id.startsWith('core-'))) {
    for (const voxel of core.mask.flat()) voxel.hp = 0;
    recalculateCell(core);
  }
  boss.destroyed = true;
  const eventsBefore = consumeSoundEvents(game);

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(eventsBefore.length, 0);
  assert.equal(boss.destroyed, false);
  assert.equal(Boolean(boss.internalDestruction), true);
  assert.equal(consumeSoundEvents(game).some((event) => event.id.startsWith('boss-internal-explosion')), true);

  for (let index = 0; index < 220 && !boss.destroyed; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.destroyed, true);
  assert.equal(boss.internalDestructionComplete, true);
  assert.equal(consumeSoundEvents(game).some((event) => event.id.startsWith('boss-main-explosion')), true);
});

test('multileg walkers fire red STA missiles that lock a descent point without tracking', () => {
  const game = createGame();
  game.autofire = false;
  const walker = createEnemy(game.vehicle.x + CELL_SIZE * 12, game.vehicle.y, WALKER_SWEEP_TEST_ENEMY, [enemyAimedShotDefinition], { moduleScale: 1 });
  walker.archetypeId = 'starlight_walker.prototype0';
  walker.walkerStaCooldown = 0;
  for (const pattern of walker.patterns) pattern.timer = 0;
  game.enemies = [walker];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const missile = game.enemyProjectiles.find((projectile) => projectile.weapon === 'walker-sta-missile');
  assert.equal(Boolean(missile), true);
  assert.equal(missile.sprite.tint, '#801a28');
  assert.equal(missile.sprite.tintAlpha, 0.5);
  assert.equal(missile.contrail.colors.includes('#050506'), true);
  assert.equal(missile.targetHint, null);
  assert.equal(missile.descentMode, 'direct');
  assert.equal(missile.hideLandingMarkerUntilTargetHint, true);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'bullet'), false);

  game.vehicle.x += CELL_SIZE * 5;
  game.vehicle.y += CELL_SIZE * 2;
  let playerAtLock = null;
  for (let index = 0; index < 70 && !missile.descentLocked; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    if (missile.descentLocked) playerAtLock = { x: game.vehicle.x, y: game.vehicle.y };
  }
  assert.equal(missile.descentLocked, true);
  assert.equal(missile.vz <= 0, true);
  assert.equal(missile.gravity, 0);
  assert.equal(pointDistanceSquared(missile.targetHint, playerAtLock) < CELL_SIZE * CELL_SIZE, true);
  assert.equal(missile.detonateAtTarget, true);

  const lockedAngle = missile.angle;
  const lockedTarget = { ...missile.targetHint };
  game.vehicle.x -= CELL_SIZE * 5;
  for (let index = 0; index < 8; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.deepEqual(missile.targetHint, lockedTarget);
  assert.equal(missile.angle, lockedAngle);
});

test('large armored walkers charge a yellow ground sweep beam from a raised gun', () => {
  const game = createGame();
  game.autofire = false;
  const walker = createEnemy(game.vehicle.x + CELL_SIZE * 12, game.vehicle.y, WALKER_SWEEP_TEST_ENEMY, [enemyAimedShotDefinition], { moduleScale: 1 });
  walker.archetypeId = 'twilight_walker.prototype0';
  walker.walkerBeamCooldown = 0;
  for (const pattern of walker.patterns) pattern.timer = 0;
  game.enemies = [walker];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(Boolean(walker.walkerSweepWarning), true);
  assert.equal(game.enemyProjectiles.length, 0);

  for (let index = 0; index < 90; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const beam = game.enemyProjectiles.find((projectile) => projectile.weapon === 'walker-ground-sweep');
  assert.equal(Boolean(beam), true);
  assert.equal(beam.color, '#ffe36a');
  assert.equal(beam.maxLifetime, 4);
  assert.equal(beam.pierce, 1);
  assert.equal(beam.radius, 0.75);
  assert.equal(beam.widthEnvelopeScale, 0.5);
  assert.equal(beam.sourceCellId, 'gun');
  assert.equal(beam.sourceZ > 0, true);
  assert.equal(consumeSoundEvents(game).some((event) => event.id === SOUND_EVENTS.ENEMY_BEAM), true);

  const earlyLength = beam.length;
  for (let index = 0; index < 30; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(beam.length > earlyLength, true);
});

test('grounded walkers stop sweep beams and resume standard turret patterns', () => {
  const game = createGame();
  game.autofire = false;
  const walker = createEnemy(game.vehicle.x + CELL_SIZE * 12, game.vehicle.y, WALKER_SWEEP_TEST_ENEMY, [enemyAimedShotDefinition], { moduleScale: 1 });
  walker.archetypeId = 'twilight_walker.prototype0';
  walker.walkerRepulsorCooldown = 0;
  for (const cell of walker.cells.filter((candidate) => candidate.role === 'supportLeg')) {
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    recalculateCell(cell);
  }
  for (const pattern of walker.patterns) pattern.timer = 0;
  game.enemies = [walker];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(Boolean(walker.walkerSweepWarning), false);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'walker-ground-sweep'), false);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'bullet'), true);
  const repulsor = game.enemyProjectiles.find((projectile) => projectile.weapon === 'walker-repulsor-beam');
  assert.equal(Boolean(repulsor), true);
  assert.equal(repulsor.forceMode, 'push');
  assert.equal(repulsor.length, 105);
});

test('grounded multileg walkers stop STA missiles and fire slower spiral tracking missiles', () => {
  const game = createGame();
  game.autofire = false;
  const walker = createEnemy(game.vehicle.x + CELL_SIZE * 12, game.vehicle.y, WALKER_SWEEP_TEST_ENEMY, [enemyAimedShotDefinition], { moduleScale: 1 });
  walker.archetypeId = 'starlight_walker.prototype0';
  walker.walkerStaCooldown = 0;
  walker.walkerGroundedSpiralCooldown = 0;
  for (const cell of walker.cells.filter((candidate) => candidate.role === 'supportLeg')) {
    for (const voxel of cell.mask.flat()) voxel.hp = 0;
    recalculateCell(cell);
  }
  for (const pattern of walker.patterns) pattern.timer = 0;
  game.enemies = [walker];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'walker-sta-missile'), false);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'bullet'), false);
  const missile = game.enemyProjectiles.find((projectile) => projectile.weapon === 'boss-missile');
  assert.equal(Boolean(missile), true);
  assert.equal(missile.behavior, 'ballistic');
  assert.equal(missile.delayedAcceleration, true);
  assert.equal(missile.stopBeforeAcceleration, true);
  assert.equal(missile.launchWhenFacingTarget, true);
  assert.equal(missile.detonateAtTarget, true);
  assert.equal(missile.contrail.colors.includes('#68151c'), true);
  assert.equal(missile.accelerationTarget, game.vehicle);
  assert.equal(walker.walkerGroundedSpiralCooldown, 0.24);

  game.vehicle.x += CELL_SIZE * 5;
  let lockedTarget = null;
  for (let index = 0; index < 240 && !missile.accelerationLocked; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    if (missile.accelerationLocked) lockedTarget = { x: game.vehicle.x, y: game.vehicle.y };
  }
  assert.equal(missile.accelerationLocked, true);
  assert.deepEqual(missile.targetHint, lockedTarget);
  assert.equal(Math.abs(Math.atan2(Math.sin(missile.accelerationAngle - Math.atan2(lockedTarget.y - missile.startY, lockedTarget.x - missile.startX)), Math.cos(missile.accelerationAngle - Math.atan2(lockedTarget.y - missile.startY, lockedTarget.x - missile.startX)))) < 0.001, true);

  missile.previousX = lockedTarget.x - Math.cos(missile.angle) * CELL_SIZE;
  missile.previousY = lockedTarget.y - Math.sin(missile.angle) * CELL_SIZE;
  missile.x = lockedTarget.x;
  missile.y = lockedTarget.y;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'enemy-pulse-blast'), true);
});

test('boss accelerates back toward the view area after being knocked away', () => {
  const game = createGame();
  const boss = createBossEnemy(game.road.x + game.road.halfWidth + 360, game.road.y);
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.vx < 0, true);
});

test('zeppelin boss uses a hollow layered hull with underside cannons and harpoon vulnerability', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 26, game.vehicle.y);
  boss.harpoonField = { x: boss.x, y: boss.y, z: boss.elevation.z, timer: 10, duration: 10 };
  game.enemies = [boss];
  game.enemySpawnQueue = [];

  assert.equal(boss.kind, 'zeppelinBoss');
  assert.equal(boss.cells.filter((cell) => cell.id.startsWith('port-cannon:')).length > 0, true);
  assert.equal(boss.cells.filter((cell) => cell.id.startsWith('starboard-cannon:')).length > 0, true);
  assert.equal(boss.cells.filter((cell) => cell.id.startsWith('forward-cannon:')).length > 0, true);
  assert.equal(boss.cells.filter((cell) => cell.role === 'zeppelinCannon').length >= 3, true);
  assert.equal(boss.cells.filter((cell) => cell.type === 'core').length, 1);
  assert.equal(new Set(boss.cells.map((cell) => `${cell.gridX},${cell.gridY},${cell.gridZ}`)).size, boss.cells.length);
  assert.equal(Math.max(...boss.cells.map((cell) => cell.gridX)) - Math.min(...boss.cells.map((cell) => cell.gridX)) >= 28, true);
  assert.equal(Math.max(...boss.cells.map((cell) => cell.gridY)) - Math.min(...boss.cells.map((cell) => cell.gridY)) >= 22, true);
  assert.equal(boss.cells.some((cell) => cell.id === 'core-undercarriage' && cell.type === 'core'), true);
  assert.equal(boss.cells.some((cell) => cell.role === 'innerLining' && (cell.gridZ ?? 0) > 1), true);
  assert.equal(boss.visualScale, 2.25);
  assert.equal(boss.radiusIncludesVisualScale, true);
  assert.equal(boss.elevation.z, CELL_LAYER_HEIGHT * 14);

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.elevation.canBeHitByGroundFire, true);
});

test('zeppelin boss cannot be core-killed by non-harpooned ground or mortar blasts', () => {
  const boss = createZeppelinBossEnemy(0, 0);
  const core = boss.cells.find((cell) => cell.id === 'core-undercarriage');
  const coreIntegrity = core.state.deviceIntegrity;

  const direct = applyEnemyDamage(boss, createProjectile(boss.x, boss.y, 0, 0, {
    team: 'player',
    weapon: 'main-gun',
    behavior: 'ballistic',
    damage: 5000,
    radius: CELL_SIZE,
  }));
  const blast = applyEnemyBlastDamage(boss, {
    x: boss.x,
    y: boss.y,
    z: boss.elevation.z,
    team: 'player',
    weapon: 'mortar-blast',
  }, {
    damage: 800,
    maxVoxelDistance: 18,
    closeVoxelDistance: 6,
    closePenetration: 3,
    farPenetration: 1,
  });

  assert.equal(direct.hit, false);
  assert.equal(blast.hit, true);
  assert.equal(boss.destroyed, false);
  assert.equal(core.state.deviceIntegrity, coreIntegrity);
});

test('zeppelin boss strafes more slowly, faces travel direction, and switches to support orbit near its walker limit', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 22, game.vehicle.y);
  boss.zeppelin.phase = 'strafe';
  boss.zeppelin.strafeAngle = Math.PI;
  boss.zeppelin.atsCooldown = 99;
  boss.zeppelin.laserCooldown = 99;
  boss.zeppelin.harpoonSpawnTimer = 99;
  game.enemies = [boss];
  game.enemySpawnQueue = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(Math.hypot(boss.vx, boss.vy) < 92, true);
  assert.equal(Math.abs(Math.atan2(Math.sin(boss.visualHeading - Math.atan2(boss.vy, boss.vx)), Math.cos(boss.visualHeading - Math.atan2(boss.vy, boss.vx)))) < 0.001, true);

  for (let index = 0; index < 3; index += 1) {
    const walker = createEnemy(game.vehicle.x + CELL_SIZE * (8 + index), game.vehicle.y);
    walker.archetypeId = 'starlight_walker.prototype0';
    walker.summonedByZeppelin = boss.assetId;
    game.enemies.push(walker);
  }

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.phase, 'orbit');
});

test('zeppelin boss calls walkers from completed strafing runs with reduced scrap reward packs', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.road.x + game.road.halfWidth + CELL_SIZE * 24, game.road.y);
  boss.zeppelin.phase = 'strafe';
  boss.zeppelin.strafeAngle = 0;
  boss.zeppelin.atsCooldown = 99;
  boss.zeppelin.laserCooldown = 99;
  boss.zeppelin.harpoonSpawnTimer = 99;
  game.enemies = [boss];
  game.enemySpawnQueue = [];

  for (let index = 0; index < 90 && game.enemies.filter((enemy) => enemy.summonedByZeppelin === boss.assetId).length === 0; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
  }

  const walker = game.enemies.find((enemy) => enemy.summonedByZeppelin === boss.assetId);
  assert.equal(Boolean(walker), true);
  assert.equal(walker.dropProfile, 'zeppelinWalker');

  const rewardEnemy = createEnemy(game.vehicle.x + CELL_SIZE * 8, game.vehicle.y);
  rewardEnemy.dropProfile = 'zeppelinWalker';
  game.enemies = [rewardEnemy];
  game.playerProjectiles = [createProjectile(rewardEnemy.x, rewardEnemy.y, 0, 0, {
    team: 'player',
    weapon: 'test-kill',
    radius: CELL_SIZE,
    damage: 5000,
    lifetime: 1,
  })];
  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  assert.equal(game.scrapPickups.some((pickup) => pickup.kind === 'ammoPack'), true);
  assert.equal(game.scrapPickups.some((pickup) => pickup.kind === 'repairPack'), true);
});

test('zeppelin ground laser telegraphs then scans from a cannon ground point', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 24, game.vehicle.y - CELL_SIZE * 5);
  boss.zeppelin.phase = 'orbit';
  boss.zeppelin.atsCooldown = 99;
  boss.zeppelin.laserCooldown = 0;
  boss.zeppelin.harpoonSpawnTimer = 99;
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);

  const warning = boss.zeppelin.laserWarning;
  assert.equal(Boolean(warning), true);
  assert.equal(warning.duration, 5);
  assert.equal(warning.lockSeconds, 2);
  assert.equal(warning.timer <= 5, true);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'zeppelin-ground-laser'), false);

  const firstTarget = { ...warning.target };
  game.vehicle.x += CELL_SIZE * 5;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(Math.hypot(warning.target.x - firstTarget.x, warning.target.y - firstTarget.y) > 1, true);

  for (let index = 0; index < 190 && warning.timer > warning.lockSeconds; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
  }
  const lockedTarget = { ...warning.target };
  game.vehicle.x -= CELL_SIZE * 8;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.deepEqual(warning.target, lockedTarget);

  let beam = null;
  for (let index = 0; index < 220 && !beam; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    beam = game.enemyProjectiles.find((projectile) => projectile.weapon === 'zeppelin-ground-laser');
  }

  assert.equal(Boolean(beam), true);
  assert.equal(beam.maxLifetime, 3);
  assert.equal(beam.sweepBeam, true);
  assert.deepEqual(beam.sweepTarget, lockedTarget);
  assert.equal(Math.hypot(beam.sweepStart.x - beam.x, beam.sweepStart.y - beam.y) < CELL_SIZE * 2, true);
  const initialLength = beam.length;
  for (let index = 0; index < 60; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(beam.length > initialLength, true);
});

test('zeppelin shell armor is tougher and harpooned shots strike shell layers before the core', () => {
  const standard = createEnemy(0, 0);
  const standardArmor = standard.cells.find((cell) => cell.type === 'armor').mask.flat().find((voxel) => voxel.role === Roles.ARMOR);
  const boss = createZeppelinBossEnemy(0, 0);
  const shellCell = boss.cells.find((cell) => cell.role === 'zeppelinHull' || cell.role === 'innerLining');
  const shellArmor = shellCell.mask.flat().find((voxel) => voxel.role === Roles.ARMOR);
  boss.harpoonField = { x: boss.x, y: boss.y, z: boss.elevation.z, timer: 10, duration: 10 };
  const core = boss.cells.find((cell) => cell.id === 'core-undercarriage');
  const coreIntegrity = core.state.deviceIntegrity;

  const hit = applyEnemyDamage(boss, createProjectile(boss.x, boss.y, 0, 0, {
    team: 'player',
    weapon: 'test-shot',
    damage: 4,
    radius: 2,
  }));

  assert.equal(shellArmor.maxHp, standardArmor.maxHp * 5);
  assert.notEqual(hit.cell.id, 'core-undercarriage');
  assert.equal(core.state.deviceIntegrity, coreIntegrity);
});

test('zeppelin internal destruction waits until one third of lining is punctured', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 24, game.vehicle.y);
  boss.zeppelin.atsCooldown = 99;
  boss.zeppelin.laserCooldown = 99;
  boss.zeppelin.harpoonSpawnTimer = 99;
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  const lining = boss.damageGroups.innerLining;
  assert.equal(lining.length, boss.zeppelin.innerLiningTotal);
  const destroyCount = Math.floor(lining.length * 0.33);

  for (const cell of lining.slice(0, destroyCount)) {
    for (const row of cell.mask) for (const voxel of row) voxel.hp = 0;
    recalculateCell(cell);
  }
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.meltdownTimer, null);

  const next = lining[destroyCount];
  for (const row of next.mask) for (const voxel of row) voxel.hp = 0;
  recalculateCell(next);
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.meltdownTimer < 3.2, true);
});

test('zeppelin harpoon powerups spawn, expire, and trigger harpoon charge when collected', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 24, game.vehicle.y);
  boss.zeppelin.atsCooldown = 99;
  boss.zeppelin.laserCooldown = 99;
  game.enemies = [boss];
  game.enemySpawnQueue = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.harpoonPowerup?.duration, 5);
  assert.equal(boss.zeppelin.harpoonPowerup.flashStart, 3);
  assert.equal(boss.zeppelin.harpoonSpawnTimer, 15);

  boss.zeppelin.harpoonSpawnTimer = 10.01;
  boss.zeppelin.harpoonPowerup = {
    kind: 'zeppelinHarpoon',
    x: game.vehicle.x + CELL_SIZE * 30,
    y: game.vehicle.y,
    radius: CELL_SIZE * 2.4,
    timer: 0.01,
    duration: 5,
    flashStart: 3,
    age: 4.99,
  };
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.harpoonPowerup, null);
  assert.equal(boss.zeppelin.harpoonSpawnTimer < 10.01, true);
  assert.equal(boss.zeppelin.harpoonSpawnTimer > 9.9, true);

  boss.zeppelin.harpoonSpawnTimer = 99;
  boss.zeppelin.harpoonPowerup = {
    kind: 'zeppelinHarpoon',
    x: game.vehicle.x,
    y: game.vehicle.y,
    radius: CELL_SIZE * 2.4,
    timer: 5,
    duration: 5,
    flashStart: 3,
    age: 0,
  };
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(boss.zeppelin.harpoonPowerup, null);
  assert.equal(Boolean(boss.zeppelin.harpoonCharge), true);

  for (let index = 0; index < 130 && !boss.harpoonField; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
  }
  assert.equal(Boolean(boss.harpoonField), true);
  assert.equal(boss.harpoonField.duration, 10);
});

test('zeppelin ATS grav rockets drop first, then lock a straight ground launch to the player', () => {
  const game = createGame();
  game.autofire = false;
  const boss = createZeppelinBossEnemy(game.vehicle.x + CELL_SIZE * 18, game.vehicle.y - CELL_SIZE * 10);
  boss.zeppelin.atsCooldown = 0;
  boss.zeppelin.laserCooldown = 99;
  boss.zeppelin.harpoonCharge = { timer: 99 };
  game.enemies = [boss];
  game.enemySpawnQueue = [];
  game.enemyProjectiles = [];

  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  const rocket = game.enemyProjectiles.find((projectile) => projectile.weapon === 'ats-grav-rocket');
  assert.equal(Boolean(rocket), true);
  assert.equal(rocket.behavior, 'arc');
  assert.equal(rocket.targetHint, null);

  game.vehicle.x += CELL_SIZE * 5;
  let lockedTarget = null;
  for (let index = 0; index < 360 && !rocket.atsLaunched; index += 1) {
    stepGame(game, { gunnerEnabled: false }, 1 / 60);
    if (rocket.atsLaunched) lockedTarget = { x: game.vehicle.x, y: game.vehicle.y };
  }
  assert.equal(rocket.atsLaunched, true);
  assert.equal(rocket.behavior, 'ballistic');
  assert.deepEqual(rocket.targetHint, lockedTarget);
  assert.equal(Math.hypot(rocket.vx, rocket.vy) < 310, true);
  assert.equal(rocket.contrail.hazardAffectsEnemies, true);
  assert.equal(rocket.contrail.hazardAffectsPlayer, true);
  const launchAngle = rocket.angle;
  game.vehicle.x -= CELL_SIZE * 4;
  stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(rocket.angle, launchAngle);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEnemyBlastDamage,
  applyEnemyDamage,
  applyEnemyProjectilePierceDamage,
  createBossEnemy,
  createEnemy,
  createEnhancedEnemy,
  createEnhancedPirateShipEnemy,
  createPirateShipEnemy,
  harvestEnemyScrap,
  traceEnemyVoxelRay,
} from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createGame, stepGame } from '../src/core/game.js';
import { recalculateCell } from '../src/core/cell.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import { consumeSoundEvents, SOUND_EVENTS } from '../src/core/soundEvents.js';

test('enemy takes voxel damage and records score damage', () => {
  const enemy = createEnemy(0, 0);
  const projectile = createProjectile(0, 0, 0, 0, { damage: 20, radius: 8, team: 'player' });
  const hit = applyEnemyDamage(enemy, projectile);
  assert.equal(hit.hit, true);
  assert.equal(enemy.damageTaken > 0, true);
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
  game.enemies = [];
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEnemyBlastDamage, applyEnemyDamage, createBossEnemy, createEnemy, createEnhancedEnemy, harvestEnemyScrap, traceEnemyVoxelRay } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { createGame, stepGame } from '../src/core/game.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

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

test('cannon-style blast strips nearby outer shell voxels with shallow penetration', () => {
  const enemy = createEnemy(0, 0);
  const result = applyEnemyBlastDamage(enemy, { x: -CELL_SIZE * 1.7, y: 0 }, { damage: 24 });
  const core = enemy.cells.find((cell) => cell.type === 'core');
  const coreRemoved = core.mask.flat().filter((voxel) => voxel.hp <= 0).length;
  assert.equal(result.hit, true);
  assert.equal(result.removed > 0, true);
  assert.equal(coreRemoved, 0);
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
  for (let index = 0; index < 70; index += 1) stepGame(game, { gunnerEnabled: false }, 1 / 60);
  assert.equal(game.enemyProjectiles.some((projectile) => projectile.weapon === 'boss-laser' && projectile.behavior === 'beam'), true);
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

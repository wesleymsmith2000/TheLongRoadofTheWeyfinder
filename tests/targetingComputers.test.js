import test from 'node:test';
import assert from 'node:assert/strict';
import { achievementStatsFromGame, awardAchievements } from '../src/core/achievements.js';
import { createGame, stepGame } from '../src/core/game.js';
import { createPrototypePlayerAccountData } from '../src/core/playerAccount.js';
import { createProjectile } from '../src/core/projectile.js';
import {
  TARGETING_COMPUTER_DEFINITIONS,
  hasTargetingComputer,
  primaryTargetingReticleKey,
  secondaryTargetingReticleKey,
  targetingComputerModuleId,
  targetingComputerUnlocks,
} from '../src/core/targetingComputers.js';

test('guided weapon defeats unlock only the matching targeting computer module', () => {
  const mortar = TARGETING_COMPUTER_DEFINITIONS.find((entry) => entry.weaponId === 'mortar');
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, {
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    scrapCollected: 0,
    damageDone: 0,
    enemyDefeats: {},
    specialDefeats: {},
    guidedWeaponDefeats: { mortar: mortar.defeatThreshold },
  });
  assert.equal(awarded.moduleUnlocks.includes(targetingComputerModuleId('mortar')), true);
  assert.equal(awarded.moduleUnlocks.includes(targetingComputerModuleId('main.basic')), false);
  assert.deepEqual(targetingComputerUnlocks(awarded), ['mortar']);
});

test('old games retain the shared guided reticle fallback', () => {
  const game = createGame();
  assert.equal(hasTargetingComputer(game, 'main.basic'), false);
  stepGame(game, { targetingMode: 'guided', gunnerEnabled: true }, 1 / 60);
  assert.deepEqual(game.independentAimReticles, {});
  assert.equal(game.aimReticle.source, 'ai');
});

test('an unlocked primary computer creates a per-mount reticle and tags its shots', () => {
  const game = createGame(1147, { targetingComputerUnlocks: ['main.basic'] });
  game.targetingAi.xp = 1_000_000;
  const enemy = game.enemies[0];
  enemy.x = game.vehicle.x + 300;
  enemy.y = game.vehicle.y;
  enemy.vy = 240;
  stepGame(game, { targetingMode: 'guided', gunnerEnabled: true }, 1 / 60);

  const bullet = game.playerProjectiles.find((projectile) => projectile.weapon === 'bullet');
  assert.ok(bullet);
  const expectedKey = primaryTargetingReticleKey(bullet.sourceCellId, 0, 'main.basic');
  assert.equal(bullet.sourceWeaponId, 'main.basic');
  assert.equal(bullet.guidedTargeting, true);
  assert.equal(bullet.targetingReticleKey, expectedKey);
  assert.equal(game.independentAimReticles[expectedKey]?.weaponId, 'main.basic');
});

test('guided targeting progress is exposed through achievement stats', () => {
  const game = createGame();
  game.score.guidedWeaponDefeats.mortar = 7;
  assert.equal(achievementStatsFromGame(game).guidedWeaponDefeats.mortar, 7);
});

test('guided projectile defeat credit follows the canonical source weapon', () => {
  const game = createGame();
  game.autofire = false;
  game.enemySpawnQueue = [];
  const enemy = game.enemies[0];
  game.playerProjectiles.push(createProjectile(enemy.x, enemy.y, 0, 0, {
    team: 'player',
    weapon: 'cannon-shrapnel',
    sourceWeaponId: 'cannon',
    guidedTargeting: true,
    radius: enemy.radius,
    damage: 100_000,
  }));
  stepGame(game, { targetingMode: 'manual' }, 1 / 60);
  assert.equal(game.score.guidedWeaponDefeats.cannon, 1);
});

test('a manual finishing hit does not inherit earlier guided defeat credit', () => {
  const game = createGame();
  game.autofire = false;
  game.enemySpawnQueue = [];
  const enemy = game.enemies[0];
  enemy.guidedDefeatWeaponId = 'mortar';
  game.playerProjectiles.push(createProjectile(enemy.x, enemy.y, 0, 0, {
    team: 'player',
    weapon: 'bullet',
    sourceWeaponId: 'main.basic',
    guidedTargeting: false,
    radius: enemy.radius,
    damage: 100_000,
  }));
  stepGame(game, { targetingMode: 'manual' }, 1 / 60);
  assert.equal(game.score.guidedWeaponDefeats.mortar, undefined);
  assert.equal(game.score.guidedWeaponDefeats['main.basic'], undefined);
});

test('primary and instant-hit secondary computers maintain different lead solutions', () => {
  const game = createGame(1147, { targetingComputerUnlocks: ['main.basic', 'beam'] });
  game.autofire = false;
  game.secondary.selected = 'beam';
  game.targetingAi.xp = 1_000_000;
  const enemy = game.enemies[0];
  enemy.x = game.vehicle.x + 300;
  enemy.y = game.vehicle.y;
  enemy.vy = 300;
  stepGame(game, { targetingMode: 'guided', gunnerEnabled: true }, 1 / 60);

  const primaryKey = Object.keys(game.independentAimReticles).find((key) => key.startsWith('primary:'));
  const secondaryKey = secondaryTargetingReticleKey('beam');
  assert.ok(primaryKey);
  assert.ok(game.independentAimReticles[secondaryKey]);
  assert.equal(game.independentAimReticles[primaryKey].y > game.independentAimReticles[secondaryKey].y, true);
  assert.equal(game.showSharedAimReticle, false);
});

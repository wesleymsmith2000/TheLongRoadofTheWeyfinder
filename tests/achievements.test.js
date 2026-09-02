import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createPrototypePlayerAccountData, equipmentLimit } from '../src/core/playerAccount.js';
import { achievementStatsFromGame, awardAchievements } from '../src/core/achievements.js';

test('achievement rewards unlock account equipment for future builds', () => {
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, { levelsCompleted: 3, bossLevelsCompleted: 1, scrapCollected: 60, damageDone: 1200 });
  assert.equal(awarded.achievements.unlocked.length, 5);
  assert.equal(equipmentLimit(awarded, 'armor'), equipmentLimit(account, 'armor') + 10);
  assert.equal(equipmentLimit(awarded, 'gun'), equipmentLimit(account, 'gun') + 2);
  assert.equal(equipmentLimit(awarded, 'engine'), equipmentLimit(account, 'engine') + 2);
  assert.equal(equipmentLimit(awarded, 'wheel'), equipmentLimit(account, 'wheel') + 2);
});

test('enemy achievements unlock new weapon and module rewards', () => {
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, {
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    scrapCollected: 0,
    damageDone: 0,
    enemyDefeats: {
      'heavy_mortar_boat.pirates_road': 4,
      'starlight_walker.prototype0': 1,
      'ghost_phaser.ghost_forrest': 1,
    },
    specialDefeats: {
      inchwormAllSegmentsFirst: 1,
      frogDistractedByConstruct: 1,
      buzzardLandedForScrap: 1,
    },
  });
  assert.equal(awarded.weaponUnlocks.primary.includes('mortar'), true);
  assert.equal(awarded.weaponUnlocks.primary.includes('tracking_flechette'), true);
  assert.equal(awarded.weaponUnlocks.primary.includes('repulsor_beam'), true);
  assert.equal(awarded.weaponUnlocks.secondary.includes('tractor_beam'), true);
  assert.equal(awarded.weaponUnlocks.secondary.includes('sta_missile'), true);
  assert.equal(awarded.weaponUnlocks.secondary.includes('orb_of_blades'), true);
  assert.equal(awarded.moduleUnlocks.includes('cloaking'), true);
});

test('scrap collection unlocks the scrap magnet upgrade family', () => {
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, { levelsCompleted: 0, bossLevelsCompleted: 0, scrapCollected: 100, damageDone: 0 });
  assert.equal(awarded.moduleUnlocks.includes('scrap_magnet'), true);
});

test('later achievements award the next equipment module bundle', () => {
  const account = createPrototypePlayerAccountData();
  account.moduleUnlocks.push('cloaking');
  account.achievements.unlocked.push(
    'calmari',
    'road-tested',
    'first-clear',
    'scrap-hauler',
    'damage-scribe',
    'crouching-weyfinder-hidden-phantom',
  );
  const awarded = awardAchievements(account, {
    levelsCompleted: 12,
    bossLevelsCompleted: 3,
    scrapCollected: 150,
    damageDone: 5000,
    enemyDefeats: {
      'ghost_phaser.ghost_forrest': 3,
    },
    specialDefeats: {},
  });
  assert.equal(equipmentLimit(awarded, 'armor'), equipmentLimit(account, 'armor') + 20);
  assert.equal(equipmentLimit(awarded, 'gun'), equipmentLimit(account, 'gun') + 4);
  assert.equal(equipmentLimit(awarded, 'engine'), equipmentLimit(account, 'engine') + 4);
  assert.equal(equipmentLimit(awarded, 'wheel'), equipmentLimit(account, 'wheel') + 6);
  assert.equal(awarded.modules.cloaking.quantity, 1);
});

test('cloaking module quantity achievement requires the cloak unlock first', () => {
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, {
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    scrapCollected: 0,
    damageDone: 0,
    enemyDefeats: {
      'ghost_phaser.ghost_forrest': 3,
    },
    specialDefeats: {},
  });
  assert.equal(awarded.moduleUnlocks.includes('cloaking'), true);
  assert.equal(awarded.modules.cloaking, undefined);
  const awardedAgain = awardAchievements(awarded, {
    levelsCompleted: 0,
    bossLevelsCompleted: 0,
    scrapCollected: 0,
    damageDone: 0,
    enemyDefeats: {
      'ghost_phaser.ghost_forrest': 3,
    },
    specialDefeats: {},
  });
  assert.equal(awardedAgain.modules.cloaking.quantity, 1);
});

test('achievement awards are not applied twice', () => {
  const account = awardAchievements(createPrototypePlayerAccountData(), { levelsCompleted: 1, bossLevelsCompleted: 0, scrapCollected: 0, damageDone: 0 });
  const awardedAgain = awardAchievements(account, { levelsCompleted: 1, bossLevelsCompleted: 0, scrapCollected: 0, damageDone: 0 });
  assert.equal(awardedAgain, account);
});

test('achievement stats are derived from run state', () => {
  const game = createGame();
  game.levelsCompleted = 2;
  game.bossLevelsCompleted = 1;
  game.score.scrapCollected = 33;
  game.score.damageDone = 444;
  game.score.enemyDefeats = { 'heavy_mortar_boat.pirates_road': 2 };
  game.score.specialDefeats = { buzzardLandedForScrap: 1 };
  assert.deepEqual(achievementStatsFromGame(game), {
    levelsCompleted: 2,
    bossLevelsCompleted: 1,
    scrapCollected: 33,
    damageDone: 444,
    enemyDefeats: { 'heavy_mortar_boat.pirates_road': 2 },
    specialDefeats: { buzzardLandedForScrap: 1 },
  });
});

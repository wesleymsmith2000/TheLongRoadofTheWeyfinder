import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createPrototypePlayerAccountData, equipmentLimit } from '../src/core/playerAccount.js';
import { achievementStatsFromGame, awardAchievements } from '../src/core/achievements.js';

test('achievement rewards unlock account equipment for future builds', () => {
  const account = createPrototypePlayerAccountData();
  const awarded = awardAchievements(account, { levelsCompleted: 3, bossLevelsCompleted: 1, scrapCollected: 60, damageDone: 1200 });
  assert.equal(awarded.achievements.unlocked.length, 5);
  assert.equal(equipmentLimit(awarded, 'armor'), equipmentLimit(account, 'armor') + 5);
  assert.equal(equipmentLimit(awarded, 'gun'), equipmentLimit(account, 'gun') + 1);
  assert.equal(equipmentLimit(awarded, 'engine'), equipmentLimit(account, 'engine') + 1);
  assert.equal(equipmentLimit(awarded, 'wheel'), equipmentLimit(account, 'wheel') + 1);
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
  assert.deepEqual(achievementStatsFromGame(game), {
    levelsCompleted: 2,
    bossLevelsCompleted: 1,
    scrapCollected: 33,
    damageDone: 444,
  });
});

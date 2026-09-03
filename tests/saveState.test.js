import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { createPrototypePlayerAccountData } from '../src/core/playerAccount.js';
import { applySaveStateToGame, createSaveState, validateSaveState } from '../src/core/saveState.js';

test('save states restore run progression and verify checksum', () => {
  const game = createGame();
  const account = createPrototypePlayerAccountData();
  game.level = 4;
  game.scrap = 27;
  game.upgrades.gunDamage = 2;
  game.secondary.selected = 'beam';
  game.score.damageDone = 1234;
  game.targetingAi.xp = 37;
  game.targetingAi.lastLevelXp = 8;
  const save = createSaveState(game, account, { savedAt: '2026-08-31T00:00:00.000Z' });

  const report = validateSaveState(save);
  assert.equal(report.valid, true);
  assert.equal(report.official, true);

  const restored = createGame();
  applySaveStateToGame(restored, save);
  assert.equal(restored.level, 4);
  assert.equal(restored.scrap, 27);
  assert.equal(restored.upgrades.gunDamage, 2);
  assert.equal(restored.secondary.selected, 'beam');
  assert.equal(restored.score.damageDone, 1234);
  assert.equal(restored.targetingAi.xp, 37);
  assert.equal(restored.targetingAi.lastLevelXp, 8);
  assert.equal(restored.paused, true);
});

test('games can initialize at a saved level music and spawn context', () => {
  const game = createGame(1147, { levelMusic: ['road-one', 'road-two', 'BossFight_three'], startLevel: 3 });
  assert.equal(game.level, 3);
  assert.equal(game.currentMusic, 'BossFight_three');
  assert.equal(game.enemySpawnQueue.some((entry) => entry.type === 'boss'), true);
});

test('edited save states become sandbox saves instead of official saves', () => {
  const save = createSaveState(createGame(), createPrototypePlayerAccountData(), { savedAt: '2026-08-31T00:00:00.000Z' });
  save.payload.scrap = 999999;
  const report = validateSaveState(save);
  assert.equal(report.valid, true);
  assert.equal(report.official, false);
  assert.equal(report.sandboxRequired, true);
});

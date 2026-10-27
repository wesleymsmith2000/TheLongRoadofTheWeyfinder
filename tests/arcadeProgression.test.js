import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, startNextLevel } from '../src/core/game.js';
import { ammoCapacityWithUpgrades, buyUpgradeWithScrap, buyAllSystemUpgradesWithScrap, refillAmmoWithScrap, setSandboxUpgradeLevel } from '../src/core/economy.js';
import { awardArcadeBossSlot } from '../src/core/arcadeBossReward.js';
import { arcadeBossPending, resetArcadeBossStage, stepArcadeBossStage } from '../src/core/arcadeBossStage.js';
import { stepDiverWaves } from '../src/core/diverEnemy.js';
import { waveWarnings } from '../src/core/waveWarnings.js';
import { createSaveState, applySaveStateToGame } from '../src/core/saveState.js';
import { validateConstructDefinition } from '../src/core/constructDefinition.js';
import { connectedFromCore } from '../src/core/connections.js';
import starter from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };

function waveletGame(mode = 'arcade', copies = 1) {
  const definition = structuredClone(starter);
  definition.gunLoadouts.forEach((loadout, i) => { loadout.secondary = [i < copies ? 'vortex_wavelet_beam' : null]; });
  const game = createGame(42, { runMode: mode, vehicleDefinition: definition });
  game.scrap = 1e20;
  return game;
}
function bossGame(seed = 42, runMode = 'arcade') {
  const game = createGame(seed, { runMode, levelMusic: ['BossFight_1'] });
  game.autofire = false;
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  return game;
}
const slots = game => Object.values(game.weaponBay.unlockedSlots).flatMap(entry => [...entry.primary, ...entry.secondary]).filter(Boolean).length;

test('wavelet upgrades add one round at 1, 3, 6, 10 and 15, even past the last visual tier', () => {
  for (const copies of [1, 3]) {
    const game = waveletGame('arcade', copies);
    const base = ammoCapacityWithUpgrades(game, 'vortex_wavelet_beam');
    game.secondary.ammo.vortex_wavelet_beam = 2;
    for (let level = 1; level <= 15; level++) {
      assert.equal(buyUpgradeWithScrap(game, 'waveletTier'), true);
      const bonus = [1, 3, 6, 10, 15].filter(threshold => level >= threshold).length;
      assert.equal(ammoCapacityWithUpgrades(game, 'vortex_wavelet_beam'), base + bonus, `capacity at ${level}, ${copies} mounts`);
      assert.equal(game.secondary.ammo.vortex_wavelet_beam, 2 + bonus);
    }
    assert.equal(refillAmmoWithScrap(game, 'vortex_wavelet_beam'), true);
    assert.equal(game.secondary.ammo.vortex_wavelet_beam, base + 5);
    const save = createSaveState(game, {});
    const loaded = createGame(42, { runMode: 'arcade', vehicleDefinition: save.payload.vehicleDefinition });
    applySaveStateToGame(loaded, save);
    assert.equal(ammoCapacityWithUpgrades(loaded, 'vortex_wavelet_beam'), base + 5);
  }
});

test('system upgrade purchases and sandbox level edits share wavelet ammo capacity; Normal is unchanged', () => {
  const game = waveletGame();
  const base = ammoCapacityWithUpgrades(game, 'vortex_wavelet_beam');
  assert.equal(buyAllSystemUpgradesWithScrap(game, 'Vortex Wavelet Beam'), true);
  assert.equal(game.secondary.ammo.vortex_wavelet_beam, base + 1);
  setSandboxUpgradeLevel(game, 'waveletTier', 10);
  assert.equal(game.secondary.ammo.vortex_wavelet_beam, base + 4);
  setSandboxUpgradeLevel(game, 'waveletTier', 0);
  assert.equal(game.secondary.ammo.vortex_wavelet_beam, base);
  const normal = waveletGame('normal');
  const normalBase = ammoCapacityWithUpgrades(normal, 'vortex_wavelet_beam');
  buyUpgradeWithScrap(normal, 'waveletTier');
  assert.equal(ammoCapacityWithUpgrades(normal, 'vortex_wavelet_beam'), normalBase);
  assert.equal(normal.secondary.ammo.vortex_wavelet_beam, normalBase);
});

test('boss finale follows two required Diver waves, then 1–3 final Divers, with warnings and no post-boss waves', () => {
  const game = bossGame();
  assert.equal(arcadeBossPending(game), true);
  assert.equal(game.enemies.some(enemy => /boss/i.test(enemy.kind)), false);
  assert.equal(game.enemySpawnQueue.some(entry => /boss/i.test(entry.enemy.kind)), false);
  game.enemies = []; game.enemySpawnQueue = [];
  for (let wave = 1; wave <= 2; wave++) {
    game.diverWaves.nextIn = 0;
    stepGame(game, {}, 0);
    assert.equal(game.diverWaves.wavesSpawned, wave);
    assert.ok(game.enemies.some(enemy => enemy.diver));
    assert.equal(game.arcadeBossStage.vanguard, null);
    assert.equal(game.levelComplete, false);
    game.enemies = [];
    stepGame(game, {}, 0);
  }
  assert.equal(game.diverWaves.wavesCleared, 2);
  const reservation = game.arcadeBossStage.vanguard;
  assert.ok(reservation.entries.length >= 1 && reservation.entries.length <= 3);
  assert.equal(game.incomingMarkers.filter(marker => marker.type === 'diver').length >= reservation.entries.length, true);
  assert.deepEqual(waveWarnings(game).map(warning => [warning.kind, warning.eta]), [['diver', 2]]);
  stepArcadeBossStage(game, 2);
  const finalDivers = game.enemies.filter(enemy => enemy.bossVanguardDiver);
  assert.equal(finalDivers.length, reservation.entries.length);
  assert.equal(arcadeBossPending(game), true);
  stepGame(game, {}, 0);
  assert.equal(game.enemySpawnQueue.length, 0);
  game.enemies = [];
  stepGame(game, {}, 0);
  assert.equal(arcadeBossPending(game), false);
  assert.equal(game.enemySpawnQueue.length, 1);
  assert.match(game.enemySpawnQueue[0].enemy.kind, /boss/i);
  assert.equal(waveWarnings(game).some(warning => warning.kind === 'standard'), true);
  assert.equal(waveWarnings(game).some(warning => warning.kind === 'diver'), false);
  for (let i = 0; i < 80; i++) stepGame(game, {}, 0.033);
  assert.ok(game.enemies.some(enemy => /boss/i.test(enemy.kind)));
  game.diverWaves.nextIn = 0;
  stepDiverWaves(game, 500);
  assert.equal(game.enemies.some(enemy => enemy.diver && !enemy.arcadeGapDiver), false);
  game.enemies = []; game.scrapPickups = [];
  stepGame(game, {}, 0);
  game.victoryBanner.elapsed = 3;
  stepGame(game, {}, 0);
  assert.equal(game.levelComplete, true);
  assert.equal(game.bossReward.unlocked.length, 1);
  assert.equal(slots(game), 6);
  startNextLevel(game);
  assert.equal(game.bossReward, null);
  assert.equal(arcadeBossPending(game), true);
});

test('the Arcade empty-screen watchdog cannot rush the held boss ahead of Divers', () => {
  const game = bossGame();
  game.enemies = []; game.enemySpawnQueue = [];
  game.arcadeEmptyScreenSeconds = 14.999;
  stepGame(game, {}, 0.033);
  assert.equal(arcadeBossPending(game), true);
  assert.ok(game.enemies.some(enemy => enemy.diver));
  assert.equal(game.enemies.some(enemy => /boss/i.test(enemy.kind)), false);
});

test('every boss family is deferred, including an already-ready boss, and the final group is seeded', () => {
  const kinds = new Set();
  for (const track of ['BossFight_1', 'PiratesRoad_BossFight', 'TwilightCrossroads_BossFight', 'GhostForrestBanshee_BossFight_1']) {
    const game = createGame(42, { runMode: 'arcade', levelMusic: [track] });
    assert.equal(game.arcadeBossStage.pending.length, 1);
    const boss = game.arcadeBossStage.pending[0].enemy;
    kinds.add(boss.kind);
    game.enemySpawnQueue = [];
    game.enemies = [boss];
    resetArcadeBossStage(game, true);
    assert.equal(game.enemies.length, 0);
    assert.equal(game.arcadeBossStage.pending[0].enemy, boss);
  }
  assert.equal(kinds.size, 4);
  const counts = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    const formations = [];
    for (let repeat = 0; repeat < 2; repeat++) {
      const game = bossGame(seed);
      game.enemies = []; game.enemySpawnQueue = [];
      game.diverWaves.wavesSpawned = 2;
      stepArcadeBossStage(game, 0);
      formations.push(game.arcadeBossStage.vanguard.entries);
    }
    assert.deepEqual(formations[0], formations[1]);
    counts.add(formations[0].length);
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3]);
});

test('one slot per boss keeps unlocking beyond the initial hull capacity, without relocking existing slots', () => {
  const game = bossGame();
  for (let boss = 1; boss <= 16; boss++) {
    const before = structuredClone(game.weaponBay.unlockedSlots);
    game.bossLevelsCompleted = boss;
    const reward = awardArcadeBossSlot(game);
    assert.equal(slots(game), 5 + boss);
    assert.equal(reward.unlocked.length, 1);
    for (const [id, kinds] of Object.entries(before)) {
      for (const kind of ['primary', 'secondary']) if (kinds[kind][0]) assert.equal(game.weaponBay.unlockedSlots[id][kind][0], true);
    }
    assert.equal(validateConstructDefinition(game.vehicleDefinition).valid, true);
    if (reward.newCells.length) {
      const id = reward.newCells[0];
      assert.equal(game.vehicle.cells.find(cell => cell.id === id).type, 'gun');
      assert.equal(connectedFromCore(game.vehicle.cells, game.vehicle.connections).has(id), true);
    }
  }
  const save = createSaveState(game, {});
  const loaded = createGame(42, { runMode: 'arcade', vehicleDefinition: save.payload.vehicleDefinition });
  applySaveStateToGame(loaded, save);
  assert.deepEqual(loaded.weaponBay.unlockedSlots, game.weaponBay.unlockedSlots);
});

test('custom small hulls gain exactly one boss slot and explicitly connected cells when needed', () => {
  const definition = { schemaVersion: '0.1', assetId: 'test.core', cells: [{ id: 'core', type: 'core', gridX: 0, gridY: 0 }], connections: [], gunLoadouts: [] };
  const game = createGame(42, { runMode: 'arcade', vehicleDefinition: definition });
  for (let boss = 1; boss <= 4; boss++) {
    game.bossLevelsCompleted = boss;
    const reward = awardArcadeBossSlot(game);
    assert.equal(slots(game), boss);
    assert.equal(reward.unlocked.length, 1);
    assert.equal(connectedFromCore(game.vehicle.cells, game.vehicle.connections).size, game.vehicle.cells.length);
    assert.equal(validateConstructDefinition(game.vehicleDefinition).valid, true);
  }
});

test('Normal and Sandbox keep their boss scheduling and have no automatic finale', () => {
  assert.equal(bossGame(42, 'normal').arcadeBossStage, null);
  const sandbox = createGame(42, { runMode: 'arcade', levelMusic: ['BossFight_1'], sandbox: { schemaVersion: '0.1', assetId: 'test.sandbox', level: 1, spawns: [], events: [] } });
  assert.equal(sandbox.arcadeBossStage, null);
});

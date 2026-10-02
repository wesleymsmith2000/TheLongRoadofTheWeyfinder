import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { equipmentSystemLevel, equipmentUpgradeDefinitions } from '../src/core/equipmentSystemLevel.js';

test('equipment system level is the minimum upgrade in its family', () => {
  const game = createGame();
  const beamUpgrades = equipmentUpgradeDefinitions('beam');
  for (const upgrade of beamUpgrades) game.upgrades[upgrade.id] = 10;
  game.upgrades.beamWidth = 7;
  game.upgrades.beamDamage = 18;
  assert.equal(equipmentSystemLevel(game, 'beam'), 7);
});

test('tractor beam has a complete three-stat system-level family', () => {
  const game = createGame();
  assert.deepEqual(
    equipmentUpgradeDefinitions('tractor_beam').map((upgrade) => upgrade.id),
    ['tractorPullStrength', 'tractorRange', 'tractorWidth'],
  );
  game.upgrades.tractorPullStrength = 5;
  game.upgrades.tractorRange = 4;
  game.upgrades.tractorWidth = 8;
  assert.equal(equipmentSystemLevel(game, 'tractor_beam'), 4);
});

test('equipment without an upgrade family remains at system level zero', () => {
  assert.equal(equipmentSystemLevel(createGame(), 'unknown_equipment'), 0);
});

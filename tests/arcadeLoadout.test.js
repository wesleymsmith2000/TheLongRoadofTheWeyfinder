import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, startNextLevel } from '../src/core/game.js';
import { arcadeForwardHeading, arcadePlayBounds } from '../src/core/arcadeMode.js';
import { arcadeSlotFlags, firingGunLoadouts, gunCellInactive, prepareArcadeLoadout } from '../src/core/arcadeLoadout.js';
import { fireSecondary } from '../src/core/secondaryWeapon.js';
import { moduleMuzzlesWorld } from '../src/core/vehicle.js';
import { angleDelta } from '../src/core/math.js';
import { roadOffsetToWorld, worldToRoadOffset } from '../src/core/camera.js';
import { createEnemy } from '../src/core/enemy.js';
import { createSaveState, applySaveStateToGame } from '../src/core/saveState.js';
import { upgradeAvailable } from '../src/core/economy.js';
import { equipmentIdsForSlotKind, equipmentSlotCapacity, swapEquipmentSlot } from '../src/core/weaponBay.js';
import starter from '../content/constructs/lite_starting_vehicle.json' with { type: 'json' };

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const inert = { schemaVersion: '0.1', assetId: 'test.target', cells: [{ id: 'core', type: 'core', gridX: 0, gridY: 0 }], connections: [] };
function gameWith(definition = starter, options = {}) {
  const game = createGame(1147, { runMode: 'arcade', vehicleDefinition: definition, ...options });
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  return game;
}
function enemyAt(game, x = 0, y = -80) {
  const point = roadOffsetToWorld({ x, y }, game.road);
  return createEnemy(point.x, point.y, inert, [], { moduleScale: 1 });
}
function emptyGuns() {
  const definition = structuredClone(starter);
  definition.emergencyWeapon = null;
  for (const loadout of definition.gunLoadouts) { loadout.primary = [null]; loadout.secondary = [null]; }
  definition.modules = definition.modules.map(module => ({ ...module, slots: [] }));
  return definition;
}

test('Arcade has three active gun cells, five initial slots, and one slot of each kind per cell', () => {
  const game = gameWith();
  const slots = Object.values(game.weaponBay.unlockedSlots);
  assert.equal(slots.filter(slot => slot.primary[0] || slot.secondary[0]).length, 3);
  assert.equal(slots.filter(slot => slot.primary[0]).length, 2);
  assert.equal(slots.filter(slot => slot.secondary[0]).length, 3);
  assert.equal(slots.every(slot => slot.primary.length === 1 && slot.secondary.length === 1), true);
  assert.equal(equipmentSlotCapacity('primary', 'arcade'), 1);
  assert.equal(equipmentSlotCapacity('secondary', 'arcade'), 1);
  assert.equal(equipmentSlotCapacity('primary', 'normal'), 4);
  assert.equal(equipmentIdsForSlotKind('primary', 'arcade').includes('mini_beam'), false);
  assert.equal(equipmentIdsForSlotKind('utility', 'arcade').includes('mini_beam'), true);
  assert.equal(gunCellInactive(game, 'gun-support'), true);
});

test('each actual boss clear opens exactly one slot, primary before secondary, and survives save/load', () => {
  const game = gameWith(starter, { levelMusic: ['TheWeyfindersRoad_Boss'] });
  const ids = game.vehicleDefinition.gunLoadouts.map(loadout => loadout.cellId);
  for (let boss = 1; boss <= 3; boss++) {
    game.arcadeBossStage = null; // Isolate completion rewards from the tested boss-arrival director.
    game.enemies = []; game.enemySpawnQueue = []; game.scrapPickups = [];
    game.diverWaves.wavesSpawned = 2;
    game.victoryBanner = { elapsed: 3, minDuration: 3 };
    stepGame(game, {}, 0);
    assert.equal(game.levelComplete, true);
    assert.equal(game.bossLevelsCompleted, boss);
    const flags = game.weaponBay.unlockedSlots;
    assert.equal(Object.values(flags).flatMap(slot => [...slot.primary, ...slot.secondary]).filter(Boolean).length, 5 + boss);
    assert.equal(flags[ids[2]].primary[0], true);
    if (boss === 2) { assert.equal(flags[ids[3]].primary[0], true); assert.equal(flags[ids[3]].secondary[0], false); }
    const save = createSaveState(game, {});
    assert.equal(save.payload.runMode, 'arcade');
    const loaded = gameWith(save.payload.vehicleDefinition);
    applySaveStateToGame(loaded, save);
    assert.deepEqual(loaded.weaponBay.unlockedSlots, flags);
    startNextLevel(game);
  }
});

test('empty and locked Arcade mounts never synthesize guns, including with autofire held', () => {
  const definition = emptyGuns();
  definition.gunLoadouts.at(-1).primary = ['main.basic'];
  const game = gameWith(definition);
  game.enemies = [enemyAt(game)]; game.enemySpawnQueue = [];
  stepGame(game, { fireHeld: true }, 0);
  assert.equal(game.playerProjectiles.length, 0);
  assert.equal(firingGunLoadouts(game).some(loadout => loadout.primary.some(Boolean)), false);
  game.levelComplete = true;
  assert.equal(swapEquipmentSlot(game, 'gun-main', 'primary', 1, 'main.basic').changed, false);
});

test('Arcade gun cells without authored equipment stay empty', () => {
  for (const missing of ['loadout', 'primary']) {
    const definition = emptyGuns();
    if (missing === 'loadout') definition.gunLoadouts = [];
    else for (const loadout of definition.gunLoadouts) delete loadout.primary;
    const game = gameWith(definition); game.enemies = [enemyAt(game)]; game.enemySpawnQueue = [];
    stepGame(game, { fireHeld: true }, 0);
    assert.equal(game.playerProjectiles.length, 0);
  }
});

test('Arcade secondary fire requires an installed, active, attached mount and uses that mount', () => {
  const definition = emptyGuns();
  const cellId = definition.gunLoadouts[1].cellId;
  definition.gunLoadouts[1].secondary = ['cannon'];
  definition.gunLoadouts.at(-1).secondary = ['beam'];
  const game = gameWith(definition);
  for (const selected of ['rocket', 'beam']) {
    game.secondary.selected = selected;
    const ammo = game.secondary.ammo[selected];
    assert.equal(fireSecondary(game), false);
    assert.equal(game.secondary.ammo[selected], ammo);
  }
  game.secondary.selected = 'cannon';
  assert.equal(fireSecondary(game), true);
  assert.equal(game.playerProjectiles[0].sourceCellId, cellId);
  game.secondary.cooldown = 0;
  game.vehicle.cells.find(cell => cell.id === cellId).attached = false;
  assert.equal(fireSecondary(game), false);
});

for (const weapon of ['beam', 'vortex_wavelet_beam']) {
  test(`Arcade ${weapon} fires forward through side aim and sideways vehicle motion`, () => {
    for (const heading of [0, 0.7, -1]) {
      const definition = emptyGuns(); definition.gunLoadouts[0].secondary = [weapon];
      const game = gameWith(definition, { terrainRoute: { startHeading: heading, segments: [{ length: 5000 }] } });
      game.vehicle.vx = 200; game.vehicle.vy = 80;
      game.aimReticle = { x: game.vehicle.x + 800, y: game.vehicle.y + 100 };
      game.secondary.selected = weapon;
      assert.equal(fireSecondary(game), true);
      if (weapon === 'vortex_wavelet_beam') near(angleDelta(arcadeForwardHeading(game), game.spatialFields[0].lockedAngle), 0);
      else {
        const shot = game.playerProjectiles[0];
        near(angleDelta(arcadeForwardHeading(game), shot.angle), 0);
        if (weapon === 'cannon') near(angleDelta(arcadeForwardHeading(game), Math.atan2(shot.vy, shot.vx)), 0);
        game.enemies = []; game.enemySpawnQueue = [];
        stepGame(game, { aimWorld: { x: 900, y: 400 } }, 0);
        if (weapon === 'beam') near(angleDelta(arcadeForwardHeading(game), shot.angle), 0);
      }
    }
  });
}

test('Mini Beam utility fires without trigger or gun cells only at enemies in range, and stops when detached', () => {
  const definition = emptyGuns();
  definition.modules[0].slots = ['mini_beam'];
  const game = gameWith(definition); game.autofire = false; game.enemySpawnQueue = [];
  const muzzle = moduleMuzzlesWorld(game.vehicle, ['utility'])[0];
  const enemy = createEnemy(muzzle.x + 28, muzzle.y, inert, [], { moduleScale: 1 });
  enemy.stun = 10; game.enemies = [enemy];
  assert.equal(upgradeAvailable(game, 'miniBeamLength'), true);
  stepGame(game, {}, 0);
  const beam = game.playerProjectiles.find(shot => shot.weapon === 'mini_beam');
  assert.ok(beam); assert.equal(beam.sourceCellId, 'utility'); assert.equal(beam.arcadeForwardLocked, false);
  near(beam.angle, Math.atan2(enemy.y - beam.y, enemy.x - beam.x));
  game.playerProjectiles = []; game.primaryWeaponCooldowns = {}; game.primaryHeat.heat = 0;
  enemy.x += 500;
  stepGame(game, {}, 0); assert.equal(game.playerProjectiles.length, 0);
  enemy.x -= 500;
  game.vehicle.cells.find(cell => cell.id === 'utility').attached = false;
  stepGame(game, {}, 0); assert.equal(game.playerProjectiles.length, 0);
});

test('legacy Arcade extra equipment is recovered and Mini Beam moves to a utility', () => {
  const definition = emptyGuns();
  definition.gunLoadouts[0].primary = ['main.basic', 'mini_beam', 'blade_launcher'];
  definition.gunLoadouts[0].secondary = ['rocket', 'cannon'];
  const prepared = prepareArcadeLoadout(definition);
  assert.deepEqual(prepared.recovered.sort(), ['blade_launcher', 'cannon']);
  const game = gameWith(definition);
  assert.equal(game.weaponBay.inventory.blade_launcher, 1);
  assert.equal(game.weaponBay.inventory.cannon, 1);
  assert.equal(game.vehicleDefinition.modules.some(module => module.slots.includes('mini_beam')), true);
  const save = createSaveState(game, {});
  // A legacy save still contains the old vehicle and its pre-migration inventory.
  const legacy = createGame(1147, { vehicleDefinition: definition });
  const legacySave = createSaveState(legacy, {});
  const loaded = gameWith(definition);
  applySaveStateToGame(loaded, legacySave);
  assert.equal(loaded.weaponBay.inventory.blade_launcher, 1);
  assert.equal(loaded.weaponBay.inventory.cannon, 1);
  assert.equal(save.payload.runMode, 'arcade');
});

test('an empty screen advances distance-gated normal waves within 15 seconds despite distant survivors', () => {
  const game = gameWith(emptyGuns());
  game.enemies = [enemyAt(game, 0, -2000)];
  const incoming = enemyAt(game, 0, -2000);
  game.enemySpawnQueue = [{ at: 400, triggerDistance: 100000, enemy: incoming }];
  game.arcadeEmptyScreenSeconds = 14.98;
  stepGame(game, {}, 0.033);
  assert.equal(game.enemySpawnQueue.length, 0);
  assert.equal(game.enemies.includes(incoming), true);
  assert.ok(Math.abs(worldToRoadOffset(incoming, game.road).y) <= game.road.halfHeight);
});

test('an empty screen rushes the next Diver wave into view, including after the previous wave clears', () => {
  for (const waitingForClear of [false, true]) {
    const game = gameWith(emptyGuns()); game.enemies = []; game.enemySpawnQueue = [];
    game.diverWaves.waitingForClear = waitingForClear;
    game.diverWaves.wavesSpawned = waitingForClear ? 1 : 0;
    game.arcadeEmptyScreenSeconds = 14.98;
    stepGame(game, {}, 0.033);
    assert.ok(game.enemies.some(enemy => enemy.diver));
    assert.ok(game.enemies.every(enemy => worldToRoadOffset(enemy, game.road).y > -arcadePlayBounds(game.road).ahead));
  }
});

test('visible enemies reset the empty-screen timer and Normal ignores the Arcade rush', () => {
  const game = gameWith(emptyGuns()); game.enemies = [enemyAt(game)]; game.arcadeEmptyScreenSeconds = 14.98;
  stepGame(game, {}, 0.033); assert.equal(game.arcadeEmptyScreenSeconds, 0);
  const normal = createGame(); normal.enemies = []; normal.arcadeEmptyScreenSeconds = 14.98;
  const count = normal.enemySpawnQueue.length;
  stepGame(normal, {}, 0.033); assert.equal(normal.enemySpawnQueue.length, count);
});

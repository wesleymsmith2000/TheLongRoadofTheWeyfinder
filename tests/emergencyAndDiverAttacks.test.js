import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { createDiverEnemy, stepDiverEnemy } from '../src/core/diverEnemy.js';
import { EMERGENCY_PRIMARY_WEAPONS, emergencyPrimaryState } from '../src/core/emergencyWeapon.js';
import { weaponManifest } from '../src/core/weaponManifest.js';
import { stepProjectiles } from '../src/core/projectile.js';
import { roadOffsetToWorld } from '../src/core/camera.js';
import { arcadePlayBounds } from '../src/core/arcadeMode.js';
import { recalculateCell } from '../src/core/cell.js';
import { createSaveState, applySaveStateToGame } from '../src/core/saveState.js';
import { validateConstructDefinition } from '../src/core/constructDefinition.js';

function gameWithTarget() {
  const game = createGame(42, { runMode: 'arcade' });
  const point = roadOffsetToWorld({ x: 0, y: -200 }, game.road);
  game.enemies = [createEnemy(point.x, point.y)];
  game.enemySpawnQueue = [{ at: 1000, enemy: createEnemy(0, -3000), type: 'standard' }];
  game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
  return game;
}
function disablePrimaryCells(game) {
  for (const cell of game.vehicle.cells.filter(cell => cell.type === 'gun')) cell.state.deviceIntegrity = 0;
}
function clearFire(game) {
  game.playerProjectiles = []; game.playerFireTimer = 0; game.primaryWeaponCooldowns = {};
}

test('the core emergency primary stays on standby until the final primary mount is disabled, and stops after repair', () => {
  const game = gameWithTarget();
  const core = game.vehicle.cells.find(cell => cell.type === 'core');
  assert.equal(emergencyPrimaryState(game).active, false);
  assert.equal(weaponManifest(game).find(entry => entry.emergency).standby, true);
  stepGame(game, { fireHeld: true }, 0);
  assert.equal(game.playerProjectiles.some(shot => shot.sourceCellId === core.id), false);
  disablePrimaryCells(game); clearFire(game);
  assert.equal(emergencyPrimaryState(game).active, true);
  stepGame(game, { fireHeld: true }, 0);
  assert.ok(game.playerProjectiles.some(shot => shot.sourceCellId === core.id && shot.sourceWeaponId === 'main.basic'));
  assert.equal(weaponManifest(game).find(entry => entry.emergency).standby, false);
  const repaired = game.vehicle.cells.find(cell => cell.id === 'gun-main');
  recalculateCell(repaired); repaired.attached = true;
  clearFire(game); stepGame(game, { fireHeld: true }, 0);
  assert.equal(emergencyPrimaryState(game).active, false);
  assert.equal(game.playerProjectiles.some(shot => shot.sourceCellId === core.id), false);
});

test('emergency primary choices fire from the core and obey cooldown, interlock, input and core health', () => {
  for (const weapon of EMERGENCY_PRIMARY_WEAPONS) {
    const game = gameWithTarget();
    game.vehicleDefinition.emergencyWeapon = weapon;
    disablePrimaryCells(game);
    game.autofire = false;
    const core = game.vehicle.cells.find(cell => cell.type === 'core');
    stepGame(game, {}, 0);
    assert.equal(game.playerProjectiles.some(shot => shot.sourceCellId === core.id), false);
    stepGame(game, { fireHeld: true }, 0);
    assert.ok(game.playerProjectiles.some(shot => shot.sourceCellId === core.id && shot.sourceWeaponId === weapon), weapon);
    const before = game.playerProjectiles.length;
    stepGame(game, { fireHeld: true }, 0);
    assert.equal(game.playerProjectiles.length, before);
    clearFire(game); game.weaponInterlock.remaining = 1;
    stepGame(game, { fireHeld: true }, 0);
    assert.equal(game.playerProjectiles.some(shot => shot.sourceCellId === core.id), false);
    game.weaponInterlock.remaining = 0; core.state.deviceIntegrity = 0;
    assert.equal(emergencyPrimaryState(game).active, false);
    game.vehicleDefinition.emergencyWeapon = null;
    assert.equal(emergencyPrimaryState(game).enabled, false);
  }
  const normal = createGame();
  normal.vehicleDefinition.emergencyWeapon = 'main.basic';
  disablePrimaryCells(normal);
  assert.equal(emergencyPrimaryState(normal).active, false);
  normal.runMode = 'arcade'; normal.sandbox = { enabled: true };
  assert.equal(emergencyPrimaryState(normal).enabled, false);
});

test('ordinary cooldowns do not activate emergency mode, and its configured choice survives saves', () => {
  const game = gameWithTarget();
  game.vehicleDefinition.emergencyWeapon = 'blade_launcher';
  game.primaryWeaponCooldowns['gun-main:0:main.basic'] = 100;
  game.primaryHeat.heat = 100;
  assert.equal(emergencyPrimaryState(game).active, false);
  const saved = createSaveState(game, {});
  const restored = createGame(1, { runMode: 'arcade', vehicleDefinition: saved.payload.vehicleDefinition });
  applySaveStateToGame(restored, saved);
  assert.equal(restored.vehicleDefinition.emergencyWeapon, 'blade_launcher');
  assert.equal(validateConstructDefinition({ ...game.vehicleDefinition, emergencyWeapon: 'rocket' }).valid, false);
});

function payloadSample(seed, theme = 'motorcycle') {
  const game = createGame(seed, { runMode: 'arcade' });
  const bounds = arcadePlayBounds(game.road);
  const p = roadOffsetToWorld({ x: 0, y: -bounds.ahead * 0.7 }, game.road);
  const enemy = createDiverEnemy(p.x, p.y, theme);
  game.enemies = [enemy]; game.enemyProjectiles = [];
  enemy.diver.phase = 'dive'; enemy.diver.phaseAge = 0; enemy.diver.roadAngle = Math.PI / 2;
  for (let i = 0; i < 1200 && enemy.diver.phase === 'dive'; i++) stepDiverEnemy(game, enemy, 1 / 60);
  const flechettes = game.enemyProjectiles.filter(shot => shot.weapon === 'diver-tracking-flechette');
  assert.ok(flechettes.length >= 1 && flechettes.length <= 3);
  const start = roadOffsetToWorld({ x: 0, y: bounds.behind * 0.8 }, game.road);
  enemy.x = start.x; enemy.y = start.y;
  enemy.diver.phase = 'return'; enemy.diver.phaseAge = 0; enemy.diver.roadAngle = -Math.PI / 2; enemy.diver.speed = 0;
  for (let i = 0; i < 1200 && enemy.diver.phase === 'return'; i++) stepDiverEnemy(game, enemy, 1 / 60);
  const bombs = game.enemyProjectiles.filter(shot => shot.weapon === 'diver-time-bomb');
  assert.ok(bombs.length >= 1 && bombs.length <= 3);
  return { game, enemy, flechettes, bombs };
}

test('all Diver themes fire one to three tracking flechettes per dive and drop one to three bombs per return', () => {
  for (const theme of ['motorcycle', 'sailboat', 'insect', 'walker', 'ghost', 'snake', 'burrower']) {
    const { bombs, flechettes } = payloadSample(42, theme);
    assert.ok(flechettes.every(shot => shot.tracksHomingTargetHint && shot.behavior === 'homing'));
    for (const bomb of bombs) {
      assert.equal(bomb.lifetime, 3); assert.equal(bomb.countdown, true);
      assert.equal(bomb.explodeOnExpire, true); assert.equal(bomb.terrainAnchored, true);
      assert.equal(bomb.landingMarkerSprite.assetId, 'sprite.weapon.mortar_enemy_marker');
      assert.ok(bomb.blastOnExpire.damage > 0);
    }
  }
  const a = payloadSample(75), b = payloadSample(75);
  assert.deepEqual([a.bombs.length, a.flechettes.length], [b.bombs.length, b.flechettes.length]);
  const { game, flechettes } = a;
  const shot = flechettes[0];
  const angle = shot.angle;
  game.vehicle.x = shot.x + 100; game.vehicle.y = shot.y;
  stepProjectiles([shot], 0.1);
  assert.notEqual(shot.angle, angle);
});

test('Diver bombs keep their three-second fuse through contact and source destruction, then explode once', () => {
  const { game, enemy, bombs } = payloadSample(42);
  const bomb = bombs[0];
  game.enemies = []; game.autofire = false; enemy.destroyed = true;
  game.enemySpawnQueue = [{ at: 1000, enemy: createEnemy(0, -3000), type: 'standard' }];
  game.enemyProjectiles = [bomb];
  game.performanceDiagnostics = { freezeTerrainStreaming: true };
  game.road.speed = game.road.baseSpeed = 0;
  bomb.x = game.vehicle.x; bomb.y = game.vehicle.y;
  stepGame(game, {}, 0);
  assert.equal(bomb.lifetime, 3);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, 2.99);
  stepGame(game, {}, 0);
  assert.equal(game.enemyProjectiles.some(shot => shot.weapon === 'enemy-pulse-blast'), false);
  game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, 0.02);
  stepGame(game, {}, 0);
  assert.equal(game.enemyProjectiles.filter(shot => shot.weapon === 'enemy-pulse-blast').length, 1);
  assert.equal(game.enemyProjectiles.some(shot => shot.weapon === 'diver-time-bomb'), false);
});

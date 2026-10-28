import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { startHostileAttack, stepHostileAttacks, carryHostileAttacks, hostileHazardPoint } from '../src/core/hostileSpatialAttacks.js';
import { validateHostileAttack } from '../src/core/hostileAttackDefinition.js';
import { createProjectile, stepProjectiles } from '../src/core/projectile.js';
import { createBossEnemy, createEnemy } from '../src/core/enemy.js';
import { createCell, recalculateCell } from '../src/core/cell.js';
import { Rng } from '../src/core/rng.js';
import { validatePatternDefinition } from '../src/core/patternDefinition.js';
import { validateLevelDefinition } from '../src/core/levelDefinition.js';
import { validateEnemyArchetypePack } from '../src/core/enemyArchetypeDefinition.js';
import hostileEnemyPack from '../content/enemies/hostile_spatial_weapons.json' with { type: 'json' };
import { sandboxDefinitionFromLevel, sandboxDefinitionFromEnemy } from '../src/core/sandboxMode.js';
import { waveletDisplacement } from '../src/render/waveletDistortion.js';
import { drawHostileAttacks, drawGravityBombMarkers, hostileChargeParticle } from '../src/render/hostileSpatialAttacks.js';
import waveletPattern from '../content/patterns/hostile_wavelet_cannon.json' with { type: 'json' };
import bombPattern from '../content/patterns/gravity_bomb.json' with { type: 'json' };
import trial from '../content/levels/hostile_spatial_hazard_trial.json' with { type: 'json' };

const health = body => body.cells.reduce((sum, cell) => sum + cell.mask.flat().reduce((n, voxel) => n + voxel.hp, 0), 0);
function fixture() {
  const game = createGame(42);
  Object.assign(game.vehicle, { x: 180, y: 40, vx: 0, vy: 0, heading: 0 });
  game.enemies = []; game.enemyProjectiles = []; game.playerProjectiles = [];
  game.autofire = false;
  return game;
}

test('hostile Wavelet warns for two seconds without force or damage, then pulls toward its origin', () => {
  const game = fixture();
  const shot = createProjectile(150, 30, 0, 0, { team: 'player' });
  game.playerProjectiles.push(shot);
  const field = startHostileAttack(game, { kind: 'hostile_wavelet' }, { x: 0, y: 0 }, { x: 600, y: 0 });
  const before = health(game.vehicle);
  stepHostileAttacks(game, 1.99);
  assert.equal(field.state, 'WARNING'); assert.equal(game.vehicle.vx, 0); assert.equal(health(game.vehicle), before);
  stepHostileAttacks(game, 0.01);
  assert.equal(field.state, 'CHARGING'); assert.equal(game.vehicle.vx, 0);
  stepHostileAttacks(game, 0.25);
  assert.ok(game.vehicle.vx < 0 && game.vehicle.vy < 0);
  assert.ok(shot.vx < 0 && shot.vy < 0);
  assert.ok(Math.abs(game.vehicle.vx / game.vehicle.vy - 180 / 40) < 1e-6);
  assert.equal(health(game.vehicle), before);
});

test('destroyed source cancels warnings/suction; the launched flame continues after source loss', () => {
  const game = fixture(), source = createEnemy(0, 0), cell = source.cells.find(cell => cell.type === 'gun');
  const field = startHostileAttack(game, { kind: 'hostile_wavelet' }, source, game.vehicle, { sourceEnemy: source, sourceCellId: cell.id });
  cell.state.destroyed = true;
  stepHostileAttacks(game, 3); assert.equal(field.state, 'DONE'); assert.equal(game.hostileAttacks.length, 0);
  cell.state.destroyed = false;
  const flame = startHostileAttack(game, { kind: 'hostile_wavelet' }, source, game.vehicle, { sourceEnemy: source, sourceCellId: cell.id });
  stepHostileAttacks(game, 5); assert.equal(flame.state, 'DISCHARGING');
  source.destroyed = true; stepHostileAttacks(game, 0.1);
  assert.equal(flame.state, 'DISCHARGING');
});

test('flame front sweeps the vehicle, deals damage once per cell, and knocks it away from the source', () => {
  const game = fixture(); game.vehicle.y = 0;
  const field = startHostileAttack(game, { kind: 'hostile_wavelet', damage: 2 }, { x: 0, y: 0 }, { x: 600, y: 0 });
  stepHostileAttacks(game, 5);
  const before = health(game.vehicle);
  stepHostileAttacks(game, 0.7);
  assert.ok(health(game.vehicle) < before); assert.ok(field.hitCells.size > 0);
  assert.equal(field.knockedBack, true);
  const after = health(game.vehicle), vx = game.vehicle.vx;
  stepHostileAttacks(game, 0.1);
  assert.equal(health(game.vehicle), after); assert.equal(game.vehicle.vx, vx);
});

test('cannon warning and suction stay attached to their moving source; released flame keeps its launch origin', () => {
  const game = fixture(), enemy = createEnemy(0, 0), gun = enemy.cells.find(cell => cell.type === 'gun');
  const field = startHostileAttack(game, { kind: 'hostile_wavelet' }, enemy, game.vehicle, { sourceEnemy: enemy, sourceCellId: gun.id });
  stepHostileAttacks(game, 0);
  const first = { ...field.lockedOrigin }; enemy.x += 40;
  stepHostileAttacks(game, 1);
  assert.equal(field.lockedOrigin.x, first.x + 40);
  stepHostileAttacks(game, 4);
  const launched = { ...field.lockedOrigin }; enemy.x += 40;
  stepHostileAttacks(game, 0.01); assert.deepEqual(field.lockedOrigin, launched);
});

test('a player entering the corridor behind the spent flame front takes no invisible lingering damage', () => {
  const game = fixture(); game.vehicle.y = 500;
  startHostileAttack(game, { kind: 'hostile_wavelet' }, { x: 0, y: 0 }, { x: 600, y: 0 });
  stepHostileAttacks(game, 6);
  game.vehicle.y = 0;
  const before = health(game.vehicle); stepHostileAttacks(game, 0.1);
  assert.equal(health(game.vehicle), before);
});

test('gravity bombs use an arc and cannot form a vortex before impact; landed fields remain ground anchored', () => {
  const game = fixture();
  const shell = startHostileAttack(game, { kind: 'gravity_bomb' }, { x: 0, y: 0 }, { x: 150, y: 10 });
  assert.equal(shell.behavior, 'arc');
  for (let i = 0; i < 140; i++) { game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, 0.01); stepHostileAttacks(game, 0.01); }
  assert.equal(game.hostileAttacks.length, 0); assert.ok(shell.z > 0);
  for (let i = 0; i < 15; i++) { game.enemyProjectiles = stepProjectiles(game.enemyProjectiles, 0.01); stepHostileAttacks(game, 0.01); }
  const vortex = game.hostileAttacks[0];
  assert.equal(vortex.kind, 'gravity_vortex'); assert.equal(vortex.x, 150); assert.equal(vortex.y, 10);
  assert.equal(game.enemyProjectiles.includes(shell), false);
  carryHostileAttacks(game.hostileAttacks, 80, 50);
  assert.equal(vortex.x, 150); assert.equal(vortex.y, 10);
});

test('airborne bomb expiry never creates a vortex or a normal mortar explosion', () => {
  const game = fixture(); const shell = startHostileAttack(game, { kind: 'gravity_bomb' }, { x: 0, y: 0 }, game.vehicle);
  shell.lifetime = 0; shell.readyToExplode = true;
  stepHostileAttacks(game, 0);
  assert.equal(game.enemyProjectiles.length, 0); assert.equal(game.hostileAttacks.length, 0);
});

test('gravity vortex pulls player, enemies, both projectile teams and scrap; static terrain is unaffected', () => {
  const game = fixture(); Object.assign(game.vehicle, { x: 40, y: 0 });
  const enemy = createEnemy(50, 0), obstacle = createEnemy(60, 0);
  obstacle.terrainAnchored = true; obstacle.vx = 0; obstacle.vy = 0;
  enemy.vx = enemy.vy = 0; game.enemies = [enemy, obstacle];
  game.scrapPickups = [{ x: 60, y: 0, vx: 0, vy: 0 }, { x: 300, y: 0, vx: 0, vy: 0 }];
  game.playerProjectiles = [createProjectile(80, 0, 0, 0, { team: 'player' })];
  const shell = startHostileAttack(game, { kind: 'gravity_bomb', damage: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 });
  shell.arcLanded = true; shell.x = shell.y = 0;
  game.enemyProjectiles.push(createProjectile(90, 0, 0, 0));
  stepHostileAttacks(game, 0.5);
  for (const object of [game.vehicle, enemy, game.scrapPickups[0], game.playerProjectiles[0], game.enemyProjectiles[0]]) assert.ok(object.vx < 0);
  assert.equal(obstacle.vx, 0); assert.equal(game.scrapPickups[1].vx, 0);
  stepHostileAttacks(game, 2.5);
  const vortex = game.hostileAttacks[0];
  assert.equal(vortex.exploded, true); assert.ok(game.vehicle.vx > 0);
  const vx = game.vehicle.vx; stepHostileAttacks(game, 0.2); assert.equal(game.vehicle.vx, vx);
});

test('gravity explosion damages both player and enemy and gives centered victims a finite outward kick', () => {
  const game = fixture(); Object.assign(game.vehicle, { x: 0, y: 0 });
  const enemy = createEnemy(20, 0); game.enemies = [enemy];
  const playerHp = health(game.vehicle), enemyHp = health(enemy);
  const shell = startHostileAttack(game, { kind: 'gravity_bomb', damage: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 }); shell.arcLanded = true;
  stepHostileAttacks(game, 3);
  assert.ok(health(game.vehicle) < playerHp); assert.ok(health(enemy) < enemyHp);
  assert.ok(Number.isFinite(game.vehicle.vx) && Number.isFinite(game.vehicle.vy));
  assert.ok(Math.hypot(game.vehicle.vx, game.vehicle.vy) > 500);
});

test('hostile distortion and particles travel toward the origin without changing player Wavelet flow', () => {
  const game = fixture();
  const field = startHostileAttack(game, { kind: 'hostile_wavelet' }, { x: 0, y: 0 }, { x: 600, y: 0 });
  field.state = 'CHARGING'; field.chargeElapsed = 1;
  const speed = 12 / field.config.spatialFrequency, dt = 0.01;
  assert.ok(Math.abs(waveletDisplacement(field, 300, 0, 0.5) - waveletDisplacement(field, 300 - speed * dt, 0, 0.5 + dt)) < 1e-6);
  const a = hostileChargeParticle(field, 0, 0.1), b = hostileChargeParticle(field, 0, 0.11);
  assert.ok(b.remaining < a.remaining);
});

test('distance hazards remain pending until their gate, resolve beyond numeric view bounds, and use the runtime schema', () => {
  assert.equal(validateLevelDefinition(trial).valid, true);
  assert.equal(validateEnemyArchetypePack(hostileEnemyPack).valid, true);
  assert.equal(validatePatternDefinition(waveletPattern).valid, true);
  assert.equal(validatePatternDefinition(bombPattern).valid, true);
  assert.equal(validateHostileAttack({ kind: 'hostile_wavelet', warningSeconds: 1 }).valid, false);
  assert.equal(validateHostileAttack({ kind: 'gravity_bomb', radius: Infinity }).valid, false);
  const game = createGame(42, { sandbox: sandboxDefinitionFromLevel(trial, { runMode: 'arcade' }) });
  game.autofire = false; game.road.viewWidth = 1200; game.road.viewHeight = 800;
  stepGame(game, {}, 0); assert.equal(game.hostileAttacks.length, 0); assert.equal(game.levelComplete, false);
  game.road.routeDistance = 120; stepGame(game, {}, 0);
  assert.equal(game.hostileAttacks.length, 1); assert.equal(game.hostileAttacks[0].state, 'WARNING');
  const point = hostileHazardPoint(game, { edge: 'left', margin: 80 });
  assert.ok(Math.hypot(point.x - game.road.x, point.y - game.road.y) >= 680);
});

test('new enemy archetypes fire their real attack patterns in Sandbox', () => {
  for (const [id, isBomb] of [['hostile_wavelet_cannon.prototype0', false], ['gravity_bombard.prototype0', true]]) {
    const game = createGame(42, { sandbox: sandboxDefinitionFromEnemy(id, { runMode: 'arcade' }) });
    game.autofire = false; game.enemies[0].patterns[0].timer = 0;
    stepGame(game, {}, 0);
    assert.equal(isBomb ? Boolean(game.enemyProjectiles.find(shot => shot.gravityBomb)) : game.hostileAttacks.length === 1, true);
  }
});

test('boss assignment gives gravity bombs to Weyfinder and Pirate bosses, suction to Zeppelin, and preserves Octopus beams', () => {
  for (const [id, expected] of [
    ['boss.weyfinder_road_hotrod.prototype0', 'gravity_bomb'],
    ['boss.pirate_dreadnought.prototype0', 'gravity_bomb'],
    ['boss.zeppelin.prototype0', 'hostile_wavelet'],
    ['boss.octopus.prototype0', null],
    ['boss.shadowed_road_hotrod.prototype0', null],
  ]) {
    const game = createGame(42, { sandbox: sandboxDefinitionFromEnemy(id) });
    game.autofire = false;
    const boss = game.enemies[0]; boss.spatialAttackTimer = 0; boss.armUnfurl = 1;
    stepGame(game, {}, 0);
    if (expected === 'gravity_bomb') assert.ok(game.enemyProjectiles.some(shot => shot.gravityBomb));
    else if (expected === 'hostile_wavelet') assert.equal(game.hostileAttacks[0]?.hostileConfig.kind, expected);
    else { assert.equal(game.hostileAttacks.length, 0); assert.equal(game.enemyProjectiles.some(shot => shot.gravityBomb), false); }
  }
});

test('each octopus arm has exactly one seeded, normal-health weak cell; every other arm cell has sixfold health', () => {
  const boss = createBossEnemy(0, 0, new Rng(12));
  const repeat = createBossEnemy(0, 0, new Rng(12)), different = createBossEnemy(0, 0, new Rng(99));
  assert.deepEqual(boss.arms.map(arm => arm.weakCellId), repeat.arms.map(arm => arm.weakCellId));
  assert.notDeepEqual(boss.arms.map(arm => arm.weakCellId), different.arms.map(arm => arm.weakCellId));
  for (const arm of boss.arms) {
    const cells = boss.cells.filter(cell => cell.id.startsWith(`arm-${arm.index}-`));
    assert.equal(cells.filter(cell => cell.bossArmWeakPoint).length, 1);
    for (const cell of cells) {
      const baseline = createCell('baseline', cell.type, 0, 0);
      assert.equal(cell.mask[1][1].maxHp, baseline.mask[1][1].maxHp * (cell.bossArmWeakPoint ? 1 : 6));
    }
  }
});

test('ordinary arm-cell loss does not detonate an arm; destroying its marked weak point does', () => {
  const game = fixture(), boss = createBossEnemy(game.vehicle.x + 140, game.vehicle.y, new Rng(42));
  game.enemies = [boss]; game.enemySpawnQueue = [];
  game.performanceDiagnostics = { disableCollisions: true, disableArmDetonationFx: true, disableArmShrapnel: true };
  const arm = boss.arms[0], ordinary = boss.cells.find(cell => cell.id.startsWith('arm-0-') && !cell.bossArmWeakPoint);
  for (const voxel of ordinary.mask.flat()) voxel.hp = 0; recalculateCell(ordinary);
  stepGame(game, {}, 0); assert.notEqual(arm.detonated, true);
  const weak = boss.cells.find(cell => cell.id === arm.weakCellId);
  for (const voxel of weak.mask.flat()) voxel.hp = 0; recalculateCell(weak);
  stepGame(game, {}, 0); assert.equal(arm.detonated, true);
  assert.ok(boss.cells.filter(cell => cell.id.startsWith('arm-0-')).every(cell => cell.state.destroyed));
});

test('warning, suction, fireball and vortex render paths accept simulation state without mutating it', () => {
  const gradient = { addColorStop() {} }, ctx = new Proxy({}, { get(target, key) { return target[key] ??= key.startsWith('create') ? () => gradient : () => {}; } });
  const game = fixture(), field = startHostileAttack(game, { kind: 'hostile_wavelet' }, { x: 0, y: 0 }, { x: 600, y: 0 });
  drawHostileAttacks(ctx, game.hostileAttacks, 0);
  stepHostileAttacks(game, 3); drawHostileAttacks(ctx, game.hostileAttacks, 3);
  stepHostileAttacks(game, 2.2); drawHostileAttacks(ctx, game.hostileAttacks, 5.2);
  const shell = startHostileAttack(game, { kind: 'gravity_bomb' }, { x: 0, y: 0 }, { x: 100, y: 0 });
  drawGravityBombMarkers(ctx, [shell], 0); shell.arcLanded = true;
  stepHostileAttacks(game, 1); drawHostileAttacks(ctx, game.hostileAttacks, 1);
  assert.equal(field.state, 'DISCHARGING');
});

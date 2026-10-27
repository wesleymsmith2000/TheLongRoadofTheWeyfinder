import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, startNextLevel, createSandboxEnemySchedule } from '../src/core/game.js';
import { createEnemy } from '../src/core/enemy.js';
import { applyEnemyDamage, applyEnemyBlastDamage, harvestEnemyScrap, updateEnemyDestroyed } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { recalculateCell } from '../src/core/cell.js';
import { validateConstructDefinition } from '../src/core/constructDefinition.js';
import { connectedFromCore } from '../src/core/connections.js';
import { worldToRoadOffset, roadOffsetToWorld, configureRoadLaneForViewport } from '../src/core/camera.js';
import { arcadePlayBounds, applyArcadeEnemyFrontBias } from '../src/core/arcadeMode.js';
import { angleDelta } from '../src/core/math.js';
import { Rng } from '../src/core/rng.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';
import { DEFAULT_LEVEL_MUSIC } from '../src/core/levelMusic.js';
import { sandboxDefinitionFromEnemy } from '../src/core/sandboxMode.js';
import { DIVER_CONSTRUCTS, DIVER_VARIANTS, HOPPER_DIVER_PREY_RANGE, diverLevelContext, validateDiverPack, createDiverEnemy, resetDiverWaves, stepDiverWaves, diverWavesCleared, stepDiverEnemy, nearestHopperDiverPrey, hitDiverWithHopperBeam } from '../src/core/diverEnemy.js';
import { drawDiverUnderlay, drawDiverOverlay, diverCellVisualOffset } from '../src/render/diverRenderer.js';
import pack from '../content/enemies/arcade_divers.json' with { type: 'json' };

const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const road = { x: 0, y: 0, heading: 0, halfHeight: 92, halfWidth: 120 };
function fixture(seed = 123, heading = 0) {
  return { seed, runMode: 'arcade', road: { ...road, heading }, vehicle: { ...roadOffsetToWorld({ x: 50, y: 20 }, { ...road, heading }), vx: 0, vy: 0 }, rng: new Rng(seed), enemies: [], enemyProjectiles: [], smokeParticles: [], soundEvents: [], scrapPickups: [], level: 1, levelMusic: DEFAULT_LEVEL_MUSIC };
}
function at(game, theme, x = 0, y = -210) {
  const p = roadOffsetToWorld({ x, y }, game.road);
  return createDiverEnemy(p.x, p.y, theme, { roadHeading: game.road.heading });
}
function destroy(cell) {
  for (const voxel of cell.mask.flat()) voxel.hp = 0;
  recalculateCell(cell);
}

test('seven Diver variants have valid connected content and distinct physical silhouettes', () => {
  assert.equal(validateDiverPack(pack).valid, true);
  for (const variant of DIVER_VARIANTS) {
    const construct = DIVER_CONSTRUCTS[variant.id];
    assert.equal(validateConstructDefinition(construct).valid, true, variant.id);
    const enemy = createDiverEnemy(0, 0, variant.id);
    assert.equal(connectedFromCore(enemy.cells, enemy.connections).size, enemy.cells.length);
  }
  assert.equal(DIVER_CONSTRUCTS.motorcycle.cells.filter(c => c.type === 'wheel').length, 2);
  assert.equal(DIVER_CONSTRUCTS.insect.cells.filter(c => c.role === 'diverWing').length, 2);
  assert.equal(DIVER_CONSTRUCTS.walker.cells.filter(c => c.id.endsWith('foot')).length, 2);
  assert.equal(Math.max(...DIVER_CONSTRUCTS.walker.cells.map(c => c.gridZ)), 3);
  const invalid = structuredClone(pack);
  invalid.variants[0].profile.trackingSeconds = -1;
  assert.equal(validateDiverPack(invalid).valid, false);
});

test('Diver theme and 1-based zone/local-level counts follow the actual music sequence, including bosses', () => {
  for (const [level, theme, zoneNumber, zoneLevel] of [
    [1, 'motorcycle', 1, 1], [4, 'motorcycle', 1, 4], [5, 'insect', 2, 1],
    [7, 'insect', 2, 3], [8, 'sailboat', 3, 1], [11, 'motorcycle', 4, 1],
    [13, 'walker', 5, 1], [15, 'walker', 6, 1], [19, 'ghost', 7, 1],
    [20, 'ghost', 7, 2], [23, 'snake', 8, 1], [31, 'burrower', 9, 1],
  ]) {
    const context = diverLevelContext(level, DEFAULT_LEVEL_MUSIC);
    assert.deepEqual([context.theme, context.zoneNumber, context.zoneLevel], [theme, zoneNumber, zoneLevel]);
  }
});

for (const theme of Object.keys(DIVER_CONSTRUCTS)) {
  test(`${theme} completes two continuous road-relative Diver cycles with ten seconds of tracking`, () => {
    for (const heading of [0, 0.9]) {
      const game = fixture(7, heading);
      const enemy = at(game, theme);
      let previousPhase = enemy.diver.phase;
      const phases = new Set();
      let trackStarted = null;
      let cycles = 0;
      let furthestTurnY = 0;
      for (let frame = 0; frame < 90 * 60; frame++) {
        const before = { x: enemy.x, y: enemy.y };
        stepDiverEnemy(game, enemy, 1 / 60);
        const local = worldToRoadOffset(enemy, game.road);
        const phase = enemy.diver.phase;
        phases.add(phase);
        assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
        assert.ok(Math.hypot(enemy.x - before.x, enemy.y - before.y) < 10, `teleport in ${phase}`);
        if (phase === 'track') {
          trackStarted ??= frame;
          near(local.y, -game.road.halfHeight * 0.72);
          near(enemy.diver.roadAngle, -Math.PI / 2);
        }
        if (phase === 'topTurn') furthestTurnY = Math.min(furthestTurnY, local.y);
        if (phase === 'climb' && previousPhase === 'track') {
          near((frame - trackStarted) / 60, 10, 0.05);
          trackStarted = null;
        }
        if (phase === 'approach' && previousPhase === 'return') cycles++;
        previousPhase = phase;
        game.enemyProjectiles = [];
        game.smokeParticles = [];
        if (cycles === 2) break;
      }
      assert.equal(cycles, 2);
      for (const phase of ['approach', 'track', 'climb', 'topTurn', 'aim', 'dive', 'bottomTurn', 'return']) assert.ok(phases.has(phase), phase);
      assert.ok(furthestTurnY < -game.road.halfHeight * 0.88);
    }
  });
}

test('tracking has lag and overshoot, with the insect tracking faster than the motorcycle', () => {
  const positions = {};
  for (const theme of ['motorcycle', 'insect']) {
    const game = fixture();
    const enemy = at(game, theme, 0, -road.halfHeight * 0.72);
    enemy.diver.phase = 'track';
    enemy.diver.trackedX = 0;
    let peak = 0;
    for (let i = 0; i < 9 * 60; i++) {
      stepDiverEnemy(game, enemy, 1 / 60);
      peak = Math.max(peak, enemy.x);
      if (i === 5) assert.ok(enemy.x < 1);
      if (i === 59) positions[theme] = enemy.x;
    }
    assert.ok(peak > 50, `${theme} should make a small overcorrection`);
  }
  assert.ok(positions.insect > positions.motorcycle);
});

test('tracking Divers aim at the player with broad seeded spread instead of their forward facing', () => {
  function sample() {
    const game = fixture(42, 0.8);
    const enemy = at(game, 'motorcycle', 0, -road.halfHeight * 0.72);
    enemy.diver.phase = 'track';
    const offsets = [];
    for (let i = 0; i < 100; i++) {
      enemy.diver.fireTimer = 0;
      stepDiverEnemy(game, enemy, 0);
      const shot = game.enemyProjectiles.at(-1);
      const playerAngle = Math.atan2(game.vehicle.y - enemy.y, game.vehicle.x - enemy.x);
      const offset = angleDelta(playerAngle, shot.angle);
      offsets.push(offset);
      assert.ok(Math.abs(offset) <= Math.PI / 6);
      assert.ok(Math.abs(angleDelta(enemy.visualHeading, shot.angle)) > Math.PI / 2);
    }
    assert.ok(offsets.some(offset => offset > 0.3));
    assert.ok(offsets.some(offset => offset < -0.3));
    return offsets;
  }
  assert.deepEqual(sample(), sample());
});

test('Diver acceleration rises by 50 percent while motorcycle speed caps rise by 100', () => {
  const game = fixture();
  const enemy = at(game, 'motorcycle', 0, -road.halfHeight * 0.72);
  Object.assign(enemy.diver, { phase: 'dive', roadAngle: 0, speed: 0 });
  stepDiverEnemy(game, enemy, 0.1);
  near(enemy.diver.speed, 22.5);
  for (let i = 0; i < 200; i++) stepDiverEnemy(game, enemy, 0.01);
  near(enemy.diver.speed, 290);
  enemy.diver.phase = 'climb'; enemy.diver.speed = 165;
  enemy.x = 0; enemy.y = -road.halfHeight * 0.88;
  stepDiverEnemy(game, enemy, 0.01);
  assert.equal(enemy.diver.phase, 'topTurn');
  near(enemy.diver.turn.radius, Math.min(road.halfHeight, road.halfWidth * 0.8) * 0.19);
});

for (const wheelId of ['front-wheel', 'rear-wheel']) {
  test(`destroying only the motorcycle Diver ${wheelId} triggers roadster spin, panic and explosion`, () => {
    const game = createGame(17, { runMode: 'arcade' });
    game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
    game.autofire = false; game.enemySpawnQueue = [];
    const enemy = createDiverEnemy(game.vehicle.x + 45, game.vehicle.y - 60, 'motorcycle');
    enemy.diver.phase = 'track'; enemy.diver.fireTimer = 0;
    game.enemies = [enemy];
    const wheel = enemy.cells.find(cell => cell.id === wheelId);
    wheel.mask.flat()[0].hp = 0; recalculateCell(wheel);
    stepGame(game, {}, 0);
    assert.equal(enemy.carRuntime?.spinout, undefined);
    game.enemyProjectiles = [];
    destroy(wheel);
    stepGame(game, {}, 1 / 60);
    assert.equal(enemy.carRuntime.spinout.phase, 'spin');
    near(enemy.collisionRotation, enemy.visualHeading + enemy.renderHeadingOffset);
    assert.ok(enemy.reactionCueQueue.some(cue => cue.text.includes(String.fromCodePoint(0x1f635)) || cue.text.includes(String.fromCodePoint(0x1f4ab))));
    const heading = enemy.visualHeading;
    let panic = false;
    for (let i = 0; i < 255; i++) {
      stepGame(game, {}, 1 / 60);
      panic ||= enemy.reactionCueQueue.some(cue => cue.text.includes(String.fromCodePoint(0x1f623)) || cue.text.includes(String.fromCodePoint(0x1f631)));
    }
    assert.ok(panic);
    assert.notEqual(enemy.visualHeading, heading);
    assert.equal(enemy.destroyed, true);
    assert.ok(enemy.explosionStart > 0);
    assert.equal(game.enemyProjectiles.some(shot => shot.weapon === 'diver-gun'), false);
  });
}

test('Stream Divers panic within hopper feeding range and show relief only after surviving five seconds', () => {
  const game = fixture();
  const enemy = at(game, 'insect', 0, -road.halfHeight * 0.72);
  enemy.diver.phase = 'track'; enemy.diver.profile.trackingGain = 0;
  const hopper = createEnemy(enemy.x + HOPPER_DIVER_PREY_RANGE - 1, enemy.y);
  hopper.archetypeId = 'hopping_stream_mob.digitized_stream';
  game.enemies = [enemy, hopper];
  stepDiverEnemy(game, enemy, 0);
  assert.ok(enemy.reactionCueQueue.some(cue => cue.text === String.fromCodePoint(0x1f631)));
  for (let i = 0; i < 49; i++) stepDiverEnemy(game, enemy, 0.1);
  assert.ok(enemy.reactionCueQueue.some(cue => cue.text === String.fromCodePoint(0x1f628)));
  assert.equal(enemy.reactionCueQueue.some(cue => cue.text === String.fromCodePoint(0x1f60c)), false);
  stepDiverEnemy(game, enemy, 0.11);
  assert.equal(enemy.reactionCueQueue.filter(cue => cue.text === String.fromCodePoint(0x1f60c)).length, 1);
  stepDiverEnemy(game, enemy, 0.1);
  assert.equal(enemy.reactionCueQueue.filter(cue => cue.text === String.fromCodePoint(0x1f60c)).length, 1);
  const eaten = at(game, 'insect', 0, -road.halfHeight * 0.72);
  eaten.diver.phase = 'track'; game.enemies = [eaten, hopper];
  stepDiverEnemy(game, eaten, 0);
  const beam = createProjectile(hopper.x, hopper.y, 0, 0, { weapon: 'hopper-prey-beam', sourceEnemy: hopper, angle: Math.PI, length: HOPPER_DIVER_PREY_RANGE });
  assert.equal(hitDiverWithHopperBeam(game, beam), true);
  stepDiverEnemy(game, eaten, 6);
  assert.equal(eaten.reactionCueQueue.some(cue => cue.text === String.fromCodePoint(0x1f60c)), false);
});

test('desktop and mobile staging uses the visible top and Diver U-turns begin inside the actual view', () => {
  for (const viewport of [{ width: 1000, height: 700 }, { width: 390, height: 844 }]) {
    const game = fixture();
    configureRoadLaneForViewport(game.road, viewport.width, viewport.height);
    const bounds = arcadePlayBounds(game.road);
    assert.ok(bounds.ahead > game.road.halfHeight * 2);
    const ordinary = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 600; i++) {
      applyArcadeEnemyFrontBias(game, ordinary, 1 / 60);
      ordinary.y += ordinary.vy / 60;
    }
    const screenFraction = 0.58 + ordinary.y / game.road.viewHeight;
    assert.ok(screenFraction > 0.05 && screenFraction < 0.28, `staged at ${screenFraction * 100}% of screen`);
    const enemy = at(game, 'motorcycle', 0, -bounds.ahead - 120);
    let cycles = 0;
    let phase = enemy.diver.phase;
    let visibleTopTurn = false;
    let visibleBottomTurn = false;
    for (let i = 0; i < 240 * 60; i++) {
      stepDiverEnemy(game, enemy, 1 / 60);
      if (enemy.diver.phase === 'topTurn' && phase !== 'topTurn') {
        assert.ok(enemy.y > -bounds.ahead);
        visibleTopTurn = true;
      }
      if (enemy.diver.phase === 'bottomTurn' && phase !== 'bottomTurn') {
        assert.ok(enemy.y < bounds.behind);
        visibleBottomTurn = true;
      }
      if (enemy.diver.phase === 'approach' && phase === 'return') cycles++;
      phase = enemy.diver.phase;
      game.enemyProjectiles = [];
      game.smokeParticles = [];
      if (cycles === 2) break;
    }
    assert.equal(cycles, 2);
    assert.ok(visibleTopTurn && visibleBottomTurn);
  }
});

test('the dive snapshots the player, accelerates without further steering, and shoots along its facing', () => {
  const game = fixture();
  const enemy = at(game, 'motorcycle', 0, -150);
  enemy.diver.phase = 'dive';
  enemy.diver.roadAngle = Math.atan2(170, 50);
  enemy.diver.speed = 30;
  enemy.diver.fireTimer = 0;
  const angle = enemy.diver.roadAngle;
  const initial = { x: enemy.x, y: enemy.y };
  game.vehicle.x = -100;
  for (let i = 0; i < 30; i++) stepDiverEnemy(game, enemy, 1 / 60);
  near(enemy.diver.roadAngle, angle);
  assert.ok(enemy.diver.speed > 30);
  near((enemy.x - initial.x) * Math.sin(angle) - (enemy.y - initial.y) * Math.cos(angle), 0);
  const shot = game.enemyProjectiles.find(p => p.weapon === 'diver-gun');
  near(shot.angle, angle);
  near(shot.vx * Math.sin(angle) - shot.vy * Math.cos(angle), 0);
  near(shot.damage, 16);
});

test('the sailboat fires an exact-target mortar during tracking and drifts in its turn', () => {
  const game = fixture();
  const enemy = at(game, 'sailboat', 0, -road.halfHeight * 0.72);
  enemy.diver.phase = 'track';
  enemy.diver.mortarTimer = 0;
  stepDiverEnemy(game, enemy, 1 / 60);
  const shell = game.enemyProjectiles.find(p => p.weapon === 'diver-mortar');
  assert.ok(shell);
  near(shell.vx * 1.7 + shell.x, game.vehicle.x);
  near(shell.vy * 1.7 + shell.y, game.vehicle.y);
  near(shell.blastOnExpire.radius, CELL_SIZE * 7.5);
  near(shell.blastOnExpire.damage, 24);
  enemy.diver.phase = 'climb';
  enemy.y = -140;
  enemy.diver.lateralSpeed = 10;
  stepDiverEnemy(game, enemy, 1 / 60);
  const originX = enemy.diver.turn.origin.x;
  stepDiverEnemy(game, enemy, 1 / 60);
  assert.ok(enemy.diver.turn.origin.x > originX);
  assert.ok(Math.abs(angleDelta(enemy.diver.roadAngle, enemy.diver.sailVisualAngle)) > 0);
});

test('ghost cell loss immediately triggers one second of protection for each quarter lost', () => {
  const game = fixture();
  const enemy = at(game, 'ghost');
  const armor = enemy.cells.filter(c => c.type === 'armor');
  for (const cell of armor.slice(0, 3)) destroy(cell);
  updateEnemyDestroyed(enemy);
  assert.equal(enemy.phasedOut, true);
  near(enemy.diver.ghostTimer, 1);
  const health = enemy.cells.flatMap(c => c.mask.flat()).reduce((n, v) => n + v.hp, 0);
  assert.equal(applyEnemyDamage(enemy, { x: enemy.x, y: enemy.y, radius: 20, damage: 100 }).hit, false);
  assert.equal(applyEnemyBlastDamage(enemy, enemy, { damage: 100 }).hit, false);
  assert.equal(enemy.cells.flatMap(c => c.mask.flat()).reduce((n, v) => n + v.hp, 0), health);
  stepDiverEnemy(game, enemy, 0.5);
  assert.equal(enemy.phasedOut, true);
  stepDiverEnemy(game, enemy, 0.5);
  assert.equal(enemy.phasedOut, false);
  for (const cell of armor.slice(3, 6)) destroy(cell);
  updateEnemyDestroyed(enemy);
  assert.equal(enemy.phasedOut, true);
  assert.equal(enemy.diver.ghostThreshold, 2);
});

test('mini walker legs can be lost independently before its rear thruster starts', () => {
  const game = fixture();
  const enemy = at(game, 'walker');
  const legs = enemy.cells.filter(c => c.role === 'diverLeg');
  for (const leg of legs.slice(0, 2)) destroy(leg);
  stepDiverEnemy(game, enemy, 1 / 60);
  assert.equal(enemy.diver.thrusterActive, false);
  for (const leg of legs.slice(2)) destroy(leg);
  stepDiverEnemy(game, enemy, 0.1);
  assert.equal(enemy.diver.thrusterActive, true);
  assert.equal(enemy.destroyed, false);
  assert.ok(game.smokeParticles.some(p => p.weapon === 'diver-thruster' && p.color === '#ff9d24'));
  assert.ok(game.smokeParticles.some(p => p.weapon === 'diver-thruster' && p.color === '#e54020'));
});

test('burrowers are protected and represented by dirt until they emerge, then burrow after diving', () => {
  const game = fixture();
  const enemy = at(game, 'burrower', 0, -70);
  stepDiverEnemy(game, enemy, 0.1);
  assert.equal(enemy.diver.burrowed, true);
  assert.equal(applyEnemyBlastDamage(enemy, enemy, { damage: 100 }).hit, false);
  assert.ok(game.smokeParticles.some(p => p.weapon === 'diver-dirt'));
  assert.equal(game.enemyProjectiles.length, 0);
  for (let i = 0; i < 30; i++) stepDiverEnemy(game, enemy, 1 / 60);
  assert.equal(enemy.diver.phase, 'track');
  assert.equal(enemy.diver.burrowed, false);
  assert.ok(game.smokeParticles.some(p => p.weapon === 'diver-burst'));
  enemy.diver.phase = 'dive';
  enemy.diver.roadAngle = Math.PI / 2;
  enemy.diver.speed = 100;
  enemy.y = road.halfHeight * 1.5;
  stepDiverEnemy(game, enemy, 1 / 60);
  assert.equal(enemy.diver.phase, 'bottomTurn');
  assert.equal(enemy.diver.burrowed, true);
});

test('hopper beam consumption requires contact, destroys insect Divers once and banks exactly half their scrap', () => {
  const game = fixture();
  const hopper = createEnemy(0, 0);
  const prey = at(game, 'insect', 25, 0);
  prey.scrapDropScale = 2;
  const expected = harvestEnemyScrap(structuredClone(prey), new Rng(4)).reduce((n, p) => n + p.value * 2, 0);
  game.enemies = [hopper, prey];
  const beam = createProjectile(0, 0, 0, 0, { team: 'enemy', weapon: 'hopper-prey-beam', behavior: 'beam', sourceEnemy: hopper, angle: Math.PI / 2, length: 45 });
  assert.equal(nearestHopperDiverPrey(game, hopper), prey);
  assert.equal(hitDiverWithHopperBeam(game, beam), false);
  beam.angle = 0;
  assert.equal(hitDiverWithHopperBeam(game, beam), true);
  assert.equal(prey.destroyed, true);
  assert.equal(prey.dropNoScrap, true);
  assert.equal(hopper.hopperConsumedScrap, Math.floor(expected / 2));
  assert.equal(game.scrapPickups.length, 0);
  assert.ok(game.smokeParticles.some(p => p.attractorEnemy === hopper));
  assert.equal(hitDiverWithHopperBeam(game, beam), false);
  assert.equal(hopper.hopperConsumedScrap, Math.floor(expected / 2));
});

test('hopper targeting and stored scrap rewards work through the live combat path', () => {
  const game = createGame(1147, { runMode: 'arcade' });
  game.autofire = false;
  game.enemySpawnQueue = [];
  const hopper = createEnemy(1000, 0);
  hopper.archetypeId = 'hopping_stream_mob.digitized_stream';
  hopper.hopTimer = 0;
  const prey = createDiverEnemy(1025, 0, 'insect');
  prey.diver.phase = 'track';
  game.enemies = [hopper, prey];
  stepGame(game, { gunnerEnabled: false }, 0);
  assert.equal(prey.destroyed, true);
  const stored = hopper.hopperConsumedScrap;
  assert.ok(stored > 0);
  assert.equal(game.scrapPickups.length, 0);
  const bomb = createProjectile(hopper.x, hopper.y, 0, 0, {
    team: 'player', weapon: 'cannon', damage: 10000, blastDamage: 10000,
    blastRadius: CELL_SIZE * 30, lifetime: 1,
  });
  bomb.readyToExplode = true;
  game.playerProjectiles = [bomb];
  stepGame(game, { gunnerEnabled: false }, 0);
  assert.equal(hopper.destroyed, true);
  assert.ok(game.scrapPickups.some(p => p.value === stored), 'the banked reward must appear in the hopper death drop');
});

test('Diver waves are seeded, scale by zone and local level, and wait 60–240 seconds after the last Diver dies', () => {
  const snapshots = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    const game = fixture(49);
    game.level = 8;
    resetDiverWaves(game);
    assert.ok(game.diverWaves.nextIn >= 60 && game.diverWaves.nextIn <= 240);
    game.diverWaves.nextIn = 0;
    stepDiverWaves(game, 0);
    const context = diverLevelContext(game.level);
    assert.ok(game.enemies.length >= 1 + context.zoneNumber + context.zoneLevel && game.enemies.length <= 3 + context.zoneNumber + context.zoneLevel);
    assert.ok(game.enemies.every(e => e.diver.theme === 'sailboat'));
    snapshots.push(game.enemies.map(e => [e.x, e.y, e.diver.fireTimer]));
    const count = game.enemies.length;
    stepDiverWaves(game, 1000);
    assert.equal(game.enemies.length, count);
    assert.equal(diverWavesCleared(game), false);
    game.enemies.forEach(e => { e.destroyed = true; });
    stepDiverWaves(game, 0);
    assert.equal(game.diverWaves.wavesCleared, 1);
    assert.ok(game.diverWaves.nextIn >= 60 && game.diverWaves.nextIn <= 240);
    assert.equal(diverWavesCleared(game), false);
    game.diverWaves.nextIn = 0;
    stepDiverWaves(game, 0);
    game.enemies.forEach(e => { e.destroyed = true; });
    assert.equal(diverWavesCleared(game), true);
  }
  assert.deepEqual(snapshots[0], snapshots[1]);
  const sandbox = fixture();
  sandbox.sandbox = { enabled: true };
  resetDiverWaves(sandbox);
  assert.equal(sandbox.diverWaves, null);
});

test('Arcade levels and timed traversal wait for two cleared waves; new levels reset the requirement', () => {
  for (const timed of [false, true]) {
    const game = createGame(1147, { runMode: 'arcade' });
    game.enemies = [];
    game.enemySpawnQueue = [];
    game.performanceDiagnostics = { disableCollisions: true, freezeTerrainStreaming: true };
    game.autofire = false;
    if (timed) game.traversal = { startDistance: 0, targetDistance: 0 };
    for (let frame = 0; frame < 105; frame++) stepGame(game, {}, 0.033);
    assert.equal(game.levelComplete, false);
    game.diverWaves.wavesSpawned = 2;
    for (let frame = 0; frame < 105; frame++) stepGame(game, {}, 0.033);
    assert.equal(game.levelComplete, true);
    startNextLevel(game);
    assert.equal(game.diverWaves.wavesSpawned, 0);
    assert.equal(game.diverWaves.level, 2);
  }
  assert.equal(createGame().diverWaves, null);
});

test('all Diver archetypes can be explicitly spawned by the existing sandbox JSON loader', () => {
  for (const theme of Object.keys(DIVER_CONSTRUCTS)) {
    const schedule = createSandboxEnemySchedule(road, sandboxDefinitionFromEnemy(`diver.${theme}`, { count: 1 }), new Rng(7));
    assert.equal(schedule[0].enemy.diver.theme, theme);
    assert.equal(schedule[0].enemy.kind, 'diver');
  }
});

test('variant presentation follows damage: two insect wings, destructible sail, two walker legs and snake motion', () => {
  const operations = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => operations.push([name, ...args]), set: () => true });
  const bug = createDiverEnemy(0, 0, 'insect');
  drawDiverUnderlay(ctx, bug, 1);
  assert.equal(operations.filter(op => op[0] === 'ellipse').length, 2);
  operations.length = 0;
  destroy(bug.cells.find(c => c.id === 'wing-left'));
  drawDiverUnderlay(ctx, bug, 1);
  assert.equal(operations.filter(op => op[0] === 'ellipse').length, 1);
  const boat = createDiverEnemy(0, 0, 'sailboat');
  operations.length = 0;
  drawDiverOverlay(ctx, boat, 1);
  assert.ok(operations.some(op => op[0] === 'closePath'));
  operations.length = 0;
  destroy(boat.cells.find(c => c.id === 'mast'));
  drawDiverOverlay(ctx, boat, 1);
  assert.equal(operations.length, 2);
  const snake = createDiverEnemy(0, 0, 'snake');
  assert.notEqual(diverCellVisualOffset(snake, snake.cells[2], 0), diverCellVisualOffset(snake, snake.cells[2], 1));
});

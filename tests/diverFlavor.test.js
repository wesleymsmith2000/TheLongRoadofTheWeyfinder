import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import { createDiverEnemy, diverLevelContext, stepDiverEnemy, stepDiverWaves } from '../src/core/diverEnemy.js';
import { configureDiverFlavor, diverBodySpan, diverBodyWidth } from '../src/core/diverFlavor.js';
import { diverContactStats, ensureDiverOrbitBlades, syncDiverOrbitBlades, diverVisibleLimits, startDiverSpiral, stepDiverBurst } from '../src/core/diverAttacks.js';
import { handleDiverContacts, stepAttachedDiver, dislodgeDiverFlies, stepPlayerDiverStatus } from '../src/core/diverContact.js';
import { arcadePlayBounds } from '../src/core/arcadeMode.js';
import { roadOffsetToWorld, worldToRoadOffset, configureRoadLaneForViewport } from '../src/core/camera.js';
import { createEnemy } from '../src/core/enemy.js';
import { createProjectile } from '../src/core/projectile.js';
import { localToWorld } from '../src/core/math.js';
import { applyImpulse } from '../src/core/vehicle.js';
import { vehicleMaxSpeed } from '../src/core/physics.js';
import { diverKickPose } from '../src/render/diverRenderer.js';
import { CELL_SIZE } from '../src/core/voxelMask.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function fixture(zone, seed = 42, heading = 0) {
  const game = createGame(seed, { runMode: 'arcade', levelMusic: [`${zone}_1`], terrainRoute: { startHeading: heading, segments: [{ length: 10000 }] } });
  game.enemies = []; game.enemySpawnQueue = []; game.diverWaves = null;
  game.autofire = false;
  game.performanceDiagnostics = { freezeTerrainStreaming: true };
  const theme = diverLevelContext(1, game.levelMusic).theme;
  const point = roadOffsetToWorld({ x: -50, y: -200 }, game.road);
  const enemy = createDiverEnemy(point.x, point.y, theme, { roadHeading: heading });
  configureDiverFlavor(game, enemy, zone);
  game.enemies = [enemy];
  return { game, enemy };
}
function onPlayer(game, enemy, cell = game.vehicle.cells.find(candidate => candidate.type === 'armor') ?? game.vehicle.cells[0]) {
  const point = localToWorld({ x: cell.gridX * CELL_SIZE, y: cell.gridY * CELL_SIZE }, game.vehicle);
  enemy.x = point.x; enemy.y = point.y;
  enemy.diver.contactOverlapping = false;
  return cell;
}
const health = vehicle => vehicle.cells.flatMap(cell => cell.mask.flat()).reduce((sum, voxel) => sum + voxel.hp, 0);
function advance(game, enemy, seconds, dt = 1 / 60) {
  for (let frame = 0; frame < Math.ceil(seconds / dt); frame++) { game.time += dt; stepDiverEnemy(game, enemy, dt); }
}

test('zone spawns and warnings use rear corners for flies and the three walker zones', () => {
  for (const zone of ['DigitizedStream', 'StarlightRoad', 'TwilightCrossroads', 'ShadowedRoad']) {
    const game = createGame(42, { runMode: 'arcade', levelMusic: [`${zone}_1`] });
    game.enemies = []; game.enemySpawnQueue = [];
    game.diverWaves.nextIn = 2;
    stepDiverWaves(game, 0);
    assert.ok(game.incomingMarkers.every(marker => worldToRoadOffset(marker, game.road).y > 0));
    stepDiverWaves(game, 2);
    for (const enemy of game.enemies) {
      assert.equal(enemy.diver.zone, zone);
      assert.ok(worldToRoadOffset(enemy, game.road).y >= arcadePlayBounds(game.road).behind - 0.01);
      assert.equal(enemy.diver.phase, zone === 'DigitizedStream' ? 'orbitTransit' : 'weave');
      assert.equal(enemy.diver.theme, zone === 'DigitizedStream' ? 'insect' : 'walker');
    }
  }
});

test('flies reach seeded top-quarter points, make four eccentric Brownian-radius orbits, and orbit again on return', () => {
  for (const heading of [0, 0.8]) {
    const { game, enemy } = fixture('DigitizedStream', 25, heading);
    const orbit = enemy.diver.orbit, bounds = arcadePlayBounds(game.road);
    assert.ok(orbit.center.y >= -bounds.ahead && orbit.center.y <= -bounds.ahead + (bounds.ahead + bounds.behind) / 4);
    near(orbit.minRadius, diverBodyWidth(enemy)); near(orbit.maxRadius, diverBodyWidth(enemy) * 5);
    const radii = new Set();
    let seenOrbit = false;
    for (let frame = 0; frame < 2400 && enemy.diver.phase !== 'track'; frame++) {
      stepDiverEnemy(game, enemy, 1 / 60);
      if (enemy.diver.phase === 'orbit') {
        seenOrbit = true;
        radii.add(Math.round(orbit.radius * 100));
        assert.ok(orbit.radius >= orbit.minRadius && orbit.radius <= orbit.maxRadius);
      }
    }
    assert.equal(seenOrbit, true); assert.ok(radii.size > 30);
    assert.ok(orbit.swept >= Math.PI * 8 && orbit.swept < Math.PI * 8 + 0.04);
    assert.equal(enemy.diver.phase, 'track');
    enemy.diver.phase = 'return';
    stepDiverEnemy(game, enemy, 0);
    assert.equal(enemy.diver.phase, 'orbitTransit');
    const repeated = fixture('DigitizedStream', 25, heading);
    assert.deepEqual(repeated.enemy.diver.orbit.center, orbit.center);
  }
});

test('walker zones make 4–5 edge passes, fire every turn, and repeat their weave after a dive', () => {
  for (const [zone, weapon, count] of [['StarlightRoad', 'diver-blade', 12], ['TwilightCrossroads', 'diver-tracking-flechette', 12], ['ShadowedRoad', 'diver-mortar', 7]]) {
    const { game, enemy } = fixture(zone);
    const weave = enemy.diver.weave;
    assert.ok(weave.passes === 4 || weave.passes === 5);
    for (let frame = 0; frame < 3600 && enemy.diver.phase !== 'track'; frame++) stepDiverEnemy(game, enemy, 1 / 60);
    assert.equal(enemy.diver.phase, 'track');
    assert.equal(weave.completed, weave.passes);
    advance(game, enemy, 3.1);
    const shots = game.enemyProjectiles.filter(shot => shot.weapon === weapon);
    assert.equal(shots.length, count * weave.passes);
    if (zone === 'ShadowedRoad') {
      const width = (Math.max(...game.vehicle.cells.map(cell => cell.gridX)) - Math.min(...game.vehicle.cells.map(cell => cell.gridX)) + 1) * CELL_SIZE;
      assert.ok(shots.every(shot => Math.hypot(shot.targetHint.x - game.vehicle.x, shot.targetHint.y - game.vehicle.y) <= width));
      assert.ok(shots.every(shot => shot.landingMarkerSprite && shot.behavior === 'arc'));
    }
    enemy.diver.phase = 'return'; stepDiverEnemy(game, enemy, 0);
    assert.equal(enemy.diver.phase, 'weave');
  }
});

test('Weyfinder dive flechettes use real 0.75-second intervals independently of enemy fire-rate scaling', () => {
  const { game, enemy } = fixture('TheWeyfindersRoad');
  enemy.diver.phase = 'dive'; enemy.diver.roadAngle = Math.PI / 2;
  enemy.diver.profile.acceleration = enemy.diver.profile.diveSpeed = 0;
  enemy.combatScale = { attackRate: 0.1 };
  stepDiverEnemy(game, enemy, 0);
  assert.equal(game.enemyProjectiles.filter(shot => shot.weapon === 'diver-tracking-flechette').length, 1);
  for (let i = 1; i <= 9; i++) {
    stepDiverEnemy(game, enemy, 0.25);
    assert.equal(game.enemyProjectiles.filter(shot => shot.weapon === 'diver-tracking-flechette').length, 1 + Math.floor(i / 3));
  }
});

test('road dive contact damages once, starts the existing skid/panic/explosion sequence and cannot retrigger', () => {
  const { game, enemy } = fixture('TheWeyfindersRoad');
  onPlayer(game, enemy); enemy.diver.phase = 'dive'; enemy.diver.speed = 0;
  const before = health(game.vehicle);
  stepGame(game, {}, 0);
  assert.ok(health(game.vehicle) < before);
  assert.ok(enemy.carRuntime.spinout);
  assert.ok(game.soundEvents.some(event => /skid/i.test(event.id ?? event.soundId ?? '')) || enemy.carRuntime.spinout.phase === 'spin');
  assert.ok(game.enemyProjectiles.some(shot => shot.weapon === 'diver-ram-blast'));
  const after = health(game.vehicle);
  handleDiverContacts(game);
  assert.equal(health(game.vehicle), after);
  game.performanceDiagnostics.disableCollisions = true;
  for (let i = 0; i < 300 && !enemy.destroyed; i++) stepGame(game, {}, 0.033);
  assert.equal(enemy.destroyed, true);
  assert.ok(enemy.reactionCueQueue.length > 0);
});

test('fly attachment tracks the hull and drinks exactly one HP each half-second', () => {
  const { game, enemy } = fixture('DigitizedStream');
  const cell = onPlayer(game, enemy);
  handleDiverContacts(game);
  assert.equal(enemy.diver.phase, 'attached');
  assert.equal(enemy.diver.attachment.cellId, cell.id);
  assert.equal(game.vehicle.reactionCueQueue[0].text, 'use boosters to detach the fly!');
  const before = health(game.vehicle);
  stepAttachedDiver(game, enemy, 0.49); near(health(game.vehicle), before);
  stepAttachedDiver(game, enemy, 0.01); near(health(game.vehicle), before - 1);
  game.vehicle.x += 40;
  stepAttachedDiver(game, enemy, 0);
  const attachedPoint = localToWorld(enemy.diver.attachment.local, game.vehicle);
  near(enemy.x, attachedPoint.x); near(enemy.y, attachedPoint.y);
});

test('fly detaches after eight consumed voxels or a lost mounting cell', () => {
  const { game, enemy } = fixture('DigitizedStream');
  const core = game.vehicle.cells.find(cell => cell.type === 'core');
  onPlayer(game, enemy, core); handleDiverContacts(game);
  const attached = enemy.diver.attachment;
  game.vehicle.cells = [core]; game.vehicle.connections = []; // No supporting cells can detach before the eight-voxel limit.
  for (const voxel of core.mask.flat()) voxel.hp = voxel.maxHp = 1;
  for (let i = 0; i < 8; i++) stepAttachedDiver(game, enemy, 0.5);
  assert.equal(attached.consumed, 8);
  assert.equal(enemy.diver.attachment, null);
  const second = fixture('DigitizedStream');
  const cell = onPlayer(second.game, second.enemy); handleDiverContacts(second.game);
  cell.attached = false; dislodgeDiverFlies(second.game);
  assert.equal(second.enemy.diver.attachment, null);
});

test('successful boost and ordinary knockback each dislodge flies and prevent immediate reattachment', () => {
  for (const source of ['boost', 'impulse']) {
    const { game, enemy } = fixture('DigitizedStream');
    onPlayer(game, enemy); handleDiverContacts(game);
    if (source === 'boost') stepGame(game, { dodgePressed: true }, 0);
    else { applyImpulse(game.vehicle, game.vehicle, { x: 1, y: 0 }, 20); dislodgeDiverFlies(game); }
    assert.equal(enemy.diver.attachment, null);
    assert.equal(enemy.diver.phase, 'regroup');
    onPlayer(game, enemy); handleDiverContacts(game);
    assert.equal(enemy.diver.attachment, null);
  }
});

test('hoppers beeline toward an attached fly and eat it with no prey-beam damage to the player', () => {
  const { game, enemy } = fixture('DigitizedStream');
  const core = game.vehicle.cells.find(cell => cell.type === 'core');
  onPlayer(game, enemy, core); handleDiverContacts(game);
  const hopper = createEnemy(enemy.x - 30, enemy.y);
  hopper.kind = 'hopperFrog'; hopper.archetypeId = 'hopping_stream_mob.digitized_stream'; hopper.hopTimer = 10;
  game.enemies.push(hopper);
  const before = health(game.vehicle);
  stepGame(game, {}, 0);
  assert.equal(hopper.hopperRescue, true);
  assert.ok(hopper.vx > 0);
  assert.equal(enemy.destroyed, true);
  assert.equal(enemy.diver.consumedByHopper, true);
  assert.ok(hopper.hopperConsumedScrap > 0);
  near(health(game.vehicle), before);
});

test('walker kicks use a live physical leg, correct cannon damage/impulse, and the ordered angry reactions', () => {
  for (const zone of ['StarlightRoad', 'TwilightCrossroads', 'ShadowedRoad']) {
    const { game, enemy } = fixture(zone);
    onPlayer(game, enemy);
    const before = health(game.vehicle);
    handleDiverContacts(game);
    assert.ok(health(game.vehicle) < before);
    assert.ok(enemy.diver.kick);
    assert.deepEqual(enemy.reactionCueQueue.map(cue => cue.text), ['😠', '🤬', '😤']);
    enemy.diver.kick.age = 0.325;
    const leg = enemy.cells.find(cell => cell.id === enemy.diver.kick.cellId);
    assert.ok(Math.abs(diverKickPose(enemy, leg).x) > CELL_SIZE * 2);
    const stats = diverContactStats();
    near(stats.kickDamage, 27 * 2 * 1.05 * 1.5); near(stats.kickImpulse, 55 * 1.05 ** 5);
  }
});

test('ghost chills stack to 45%, refresh for three seconds on new contact and fully expire', () => {
  const { game, enemy } = fixture('GhostForrest');
  const speed = vehicleMaxSpeed(game.vehicle);
  for (let i = 1; i <= 4; i++) {
    game.time += 1;
    onPlayer(game, enemy); handleDiverContacts(game);
    near(game.vehicle.diverChill.remaining, 3);
    assert.equal(game.vehicle.diverChill.stacks, Math.min(3, i));
    near(vehicleMaxSpeed(game.vehicle), speed * (1 - 0.15 * Math.min(3, i)));
    stepPlayerDiverStatus(game, 0.25);
  }
  assert.deepEqual(game.vehicle.reactionCueQueue.slice(-3).map(cue => cue.text), ['🥶', '🥶 ❄️', '🧊 🥶']);
  stepPlayerDiverStatus(game, 2.75);
  assert.equal(game.vehicle.diverChill.stacks, 0); near(vehicleMaxSpeed(game.vehicle), speed);
});

test('desert contact recoils two body lengths, fires three aimed blades over one second, poofs and teleports to tracking', () => {
  const { game, enemy } = fixture('ShadowedDesert');
  onPlayer(game, enemy); handleDiverContacts(game);
  assert.equal(enemy.diver.phase, 'snakeRecoil');
  assert.equal(enemy.reactionCueQueue[0].text, '😲');
  const origin = worldToRoadOffset(enemy, game.road);
  advance(game, enemy, 0.25);
  const away = worldToRoadOffset(enemy, game.road);
  near(Math.hypot(away.x - origin.x, away.y - origin.y), diverBodySpan(enemy) * 2, 0.01);
  advance(game, enemy, 1.2);
  const shots = game.enemyProjectiles.filter(shot => shot.weapon === 'diver-blade');
  assert.equal(shots.length, 3);
  assert.ok(shots.every(shot => Math.abs(shot.angle - Math.atan2(game.vehicle.y - shot.y, game.vehicle.x - shot.x)) < 1e-7));
  assert.equal(enemy.diver.phase, 'snakeVanish'); assert.equal(enemy.phasedOut, true);
  assert.ok(enemy.reactionCueQueue.some(cue => cue.text === '💨'));
  advance(game, enemy, 0.6);
  assert.equal(enemy.diver.phase, 'track'); assert.equal(enemy.phasedOut, false);
  near(worldToRoadOffset(enemy, game.road).y, -arcadePlayBounds(game.road).ahead * 0.72);
});

test('Freedom Pass keeps two level-20 orbit blades, reflects five times, then fires the survivors and regroups', () => {
  const { game, enemy } = fixture('FreedomsPass');
  enemy.diver.phase = 'dive'; enemy.phasedOut = false; enemy.diver.roadAngle = Math.PI / 2;
  const point = roadOffsetToWorld({ x: 0, y: arcadePlayBounds(game.road).behind * 0.9 }, game.road);
  enemy.x = point.x; enemy.y = point.y;
  stepDiverEnemy(game, enemy, 0);
  assert.equal(enemy.diver.phase, 'ricochet'); assert.equal(enemy.diver.ricochets, 1);
  const blades = game.enemyProjectiles.filter(shot => shot.diverOrbitOwner);
  assert.equal(blades.length, 2);
  near(blades[0].damage, 22 * 1.05 ** 20 * 3);
  near(blades[0].projectileDeflectionProbability, 1 - 0.67 * 0.95 ** 20);
  assert.equal(enemy.phasedOut, false);
  for (let i = 0; i < 4; i++) {
    const limits = diverVisibleLimits(game, enemy);
    const edge = roadOffsetToWorld({ x: limits.right + 1, y: 0 }, game.road);
    enemy.x = edge.x; enemy.y = edge.y; enemy.diver.roadAngle = 0;
    stepDiverEnemy(game, enemy, 0);
  }
  assert.equal(enemy.diver.ricochets, 5); assert.equal(enemy.diver.phase, 'regroup');
  assert.ok(blades.every(shot => !shot.diverOrbitOwner && Math.hypot(shot.vx, shot.vy) > 200));
  advance(game, enemy, 3);
  assert.equal(enemy.diver.phase, 'track'); assert.equal(enemy.diver.bladeCycle, false);
});

test('an orbit blade hit triggers early return and launches its remaining partner', () => {
  const { game, enemy } = fixture('FreedomsPass');
  enemy.phasedOut = false; enemy.diver.phase = 'dive'; enemy.diver.roadAngle = Math.PI / 2;
  ensureDiverOrbitBlades(game, enemy);
  const blades = game.enemyProjectiles.filter(shot => shot.diverOrbitOwner);
  const radius = enemy.radius + blades[0].radius + CELL_SIZE * 1.5;
  enemy.x = game.vehicle.x + radius; enemy.y = game.vehicle.y;
  syncDiverOrbitBlades(game);
  stepGame(game, {}, 0);
  assert.equal(enemy.diver.phase, 'regroup');
  assert.equal(blades.filter(shot => shot.lifetime <= 0).length, 1);
  assert.equal(blades.filter(shot => shot.lifetime > 0 && !shot.diverOrbitOwner).length, 1);
});

test('orbit blades deflect player attacks through live collision handling and vanish when their owner dies', () => {
  const { game, enemy } = fixture('FreedomsPass');
  enemy.phasedOut = false; enemy.diver.phase = 'dive'; enemy.diver.roadAngle = 0;
  ensureDiverOrbitBlades(game, enemy); syncDiverOrbitBlades(game);
  const blade = game.enemyProjectiles.find(shot => shot.diverOrbitOwner);
  game.playerProjectiles.push(createProjectile(blade.x, blade.y, 100, 0, { team: 'player', damage: 1, radius: 1 }));
  game.rng.next = () => 0;
  stepGame(game, {}, 0);
  assert.ok(game.enemyProjectiles.some(shot => shot.deflected && shot.team === 'enemy'));
  assert.equal(game.playerProjectiles[0].lifetime, 0);
  enemy.destroyed = true;
  syncDiverOrbitBlades(game);
  assert.ok(game.enemyProjectiles.filter(shot => shot.diverOrbitOwner).every(shot => shot.lifetime === 0));
});

test('zone-specific motion and contacts are disabled for Normal runs; phased Divers cannot collide', () => {
  const { game, enemy } = fixture('GhostForrest');
  onPlayer(game, enemy); enemy.phasedOut = true;
  handleDiverContacts(game); assert.equal(game.vehicle.diverChill, undefined);
  enemy.phasedOut = false; game.runMode = 'normal';
  handleDiverContacts(game); assert.equal(game.vehicle.diverChill, undefined);
  const other = createDiverEnemy(0, 100, 'insect');
  configureDiverFlavor(game, other, 'DigitizedStream');
  assert.equal(other.diver.zone, undefined); assert.equal(other.diver.phase, 'approach');
});

test('turn mortar bursts fire seven shots over three seconds and cancel if their gun is lost', () => {
  const { game, enemy } = fixture('ShadowedRoad');
  startDiverSpiral(enemy, 'mortar');
  stepDiverBurst(game, enemy, 0);
  assert.equal(game.enemyProjectiles.length, 1);
  for (let i = 1; i <= 6; i++) {
    stepDiverBurst(game, enemy, 0.5);
    assert.equal(game.enemyProjectiles.length, i + 1);
  }
  assert.equal(enemy.diver.flavorBursts.length, 0);
  startDiverSpiral(enemy, 'mortar');
  for (const cell of enemy.cells.filter(cell => cell.type === 'gun')) cell.state.destroyed = true;
  stepDiverBurst(game, enemy, 3);
  assert.equal(game.enemyProjectiles.length, 7);
  assert.equal(enemy.diver.flavorBursts.length, 0);
});

test('attached flies panic before hoppers reach feeding range, and explosion knockback shakes them loose', () => {
  const { game, enemy } = fixture('DigitizedStream');
  onPlayer(game, enemy); handleDiverContacts(game);
  const hopper = createEnemy(enemy.x - 100, enemy.y); hopper.kind = 'hopperFrog';
  game.enemies.push(hopper);
  stepDiverEnemy(game, enemy, 0);
  assert.ok(enemy.diver.hopperFear.active);
  assert.ok(enemy.reactionCueQueue.some(cue => cue.text === '😱' || cue.text === '😨'));
  game.enemies = [enemy];
  const bomb = createProjectile(game.vehicle.x, game.vehicle.y, 0, 0, { team: 'enemy', weapon: 'diver-time-bomb', damage: 0, impulse: 0, lifetime: 0, explodeOnExpire: true, blastOnExpire: { radius: 15, damage: 1, impulse: 30 } });
  bomb.readyToExplode = true; game.enemyProjectiles.push(bomb);
  stepGame(game, {}, 0);
  assert.equal(enemy.diver.attachment, null);
  assert.ok(game.enemyProjectiles.some(shot => shot.weapon === 'enemy-pulse-blast'));
});

test('mobile portrait and landscape use their visible play bounds for weaving and ricochets', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const { game, enemy } = fixture('ShadowedRoad');
    configureRoadLaneForViewport(game.road, viewport.width, viewport.height);
    configureDiverFlavor(game, enemy, 'ShadowedRoad');
    const limits = diverVisibleLimits(game, enemy);
    for (let frame = 0; frame < 3600 && enemy.diver.phase !== 'track'; frame++) {
      stepDiverEnemy(game, enemy, 1 / 60);
      const point = worldToRoadOffset(enemy, game.road);
      assert.ok(point.x >= limits.left - 1e-6 && point.x <= limits.right + 1e-6);
    }
    assert.equal(enemy.diver.phase, 'track');
  }
});

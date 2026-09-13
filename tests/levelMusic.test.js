import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createLevelEnemies, isBossLevel, stepGame } from '../src/core/game.js';
import { DEFAULT_LEVEL_MUSIC, STEPPES_OF_APOLLON_SKOTEINOS_MUSIC, hasBossMusicBeforeLevel, isBossMusic, musicForLevel } from '../src/core/levelMusic.js';

test('boss levels are selected by boss soundtrack names', () => {
  const tracks = ['road-a', 'BossFight_alpha', 'road-b', 'SomeBossTheme'];
  assert.equal(isBossLevel(1, tracks), false);
  assert.equal(isBossLevel(2, tracks), true);
  assert.equal(isBossLevel(4, tracks), true);
  assert.equal(isBossMusic('TwilightCrossroads_BossFight'), true);
});

test('level music rotates through the default soundtrack list', () => {
  assert.equal(musicForLevel(1), DEFAULT_LEVEL_MUSIC[0]);
  assert.equal(musicForLevel(DEFAULT_LEVEL_MUSIC.length + 1), DEFAULT_LEVEL_MUSIC[0]);
});

test('steppes of apollon skoteinos music is staged for future zone wiring', () => {
  assert.deepEqual(STEPPES_OF_APOLLON_SKOTEINOS_MUSIC, [
    'SteppesOfApollonSkoteinos_TheObviousRoad_1',
    'SteppesOfApollonSkoteinos_TheObviousRoad_2',
    'SteppesOfApollonSkoteinos_MirageOfTruth_1',
    'SteppesOfApollonSkoteinos_MirageOfTruth_2',
    'SteppesOfApollonSkoteinos_DarkenedApollo_1',
    'SteppesOfApollonSkoteinos_DarkenedApollo_2',
    'SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_1',
    'SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_2',
  ]);
  assert.equal(STEPPES_OF_APOLLON_SKOTEINOS_MUSIC.every((track) => DEFAULT_LEVEL_MUSIC.includes(track)), false);
  assert.equal(isBossMusic('SteppesOfApollonSkoteinos_EclipseOfTheFalseSun_BossFight_1'), true);
});

test('boss soundtrack levels add a boss and cut standard enemy count', () => {
  const enemies = createLevelEnemies({ x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 }, 4, ['road', 'road', 'road', 'BossFight']);
  assert.equal(enemies.some((enemy) => enemy.kind === 'boss'), true);
  assert.equal(enemies.filter((enemy) => enemy.kind !== 'boss').length, 2);
});

test('zone 1 boss track routes to the Weyfinder Road hotrod boss', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 1, ['BossFight_1']);
  assert.equal(enemies.some((enemy) => enemy.kind === 'roadBossCar'), true);
  assert.equal(enemies.find((enemy) => enemy.kind === 'roadBossCar').archetypeId, 'boss.weyfinder_road_hotrod.prototype0');
});

test('Shadowed Road traversal tracks use car enemies, mine droppers, and the hotrod boss variant', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 3, ['ShadowedRoad_1']);
  assert.equal(enemies.some((enemy) => enemy.archetypeId === 'shadowed_road_mine_dropper.prototype0'), true);
  assert.equal(enemies.some((enemy) => enemy.archetypeId === 'weyfinder_road_flechette_racer.prototype0'), true);

  const bosses = createLevelEnemies(road, 1, ['ShadowedRoad_BossFight_1']);
  const boss = bosses.find((enemy) => enemy.kind === 'roadBossCar');
  assert.equal(boss.archetypeId, 'boss.shadowed_road_hotrod.prototype0');
  assert.equal(boss.roadBossCar.variant, 'shadowedRoad');
  assert.equal(boss.roadBossCar.escapeCar, true);
});

test('starlight and twilight boss tracks route to the zeppelin boss', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const starlight = createLevelEnemies(road, 1, ['StarlightRoad_BossFight']);
  const twilight = createLevelEnemies(road, 1, ['TwilightCrossroads_BossFight']);
  assert.equal(starlight.some((enemy) => enemy.kind === 'zeppelinBoss'), true);
  assert.equal(twilight.some((enemy) => enemy.kind === 'zeppelinBoss'), true);
});

test('pirates road boss tracks route to the pirate dreadnought boss', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 1, ['PiratesRoad_BossFight']);
  assert.equal(enemies.some((enemy) => enemy.kind === 'pirateBoss'), true);
  assert.equal(enemies.find((enemy) => enemy.kind === 'pirateBoss').archetypeId, 'boss.pirate_dreadnought.prototype0');
});

test('post-boss non-boss levels include enhanced enemies', () => {
  assert.equal(hasBossMusicBeforeLevel(3, ['road', 'BossFight', 'road']), true);
  const enemies = createLevelEnemies({ x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 }, 3, ['road', 'BossFight', 'road']);
  assert.equal(enemies.some((enemy) => enemy.kind === 'enhanced'), true);
});

test('game tracks current music when starting the next level', () => {
  const game = createGame(1147, { levelMusic: ['road-one', 'BossFight_two'] });
  assert.equal(game.currentMusic, 'road-one');
  game.levelComplete = true;
  stepGame(game, { nextLevelPressed: true }, 1 / 60);
  assert.equal(game.currentMusic, 'BossFight_two');
});

test('zone soundtrack names route standard spawns to zone archetypes', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const weyfinder = createLevelEnemies(road, 1, ['TheWeyfindersRoad_1'])[0];
  assert.equal(weyfinder.archetypeId, 'weyfinder_road_car.prototype0');
  assert.equal(weyfinder.assetId, 'example.construct.weyfinder_road_car_sculpted');
  assert.equal(weyfinder.presentation.variant, 'roadCar');
  assert.equal(weyfinder.cells.filter((cell) => cell.role === 'wheelBlock').length, 16);
  const levelThreeEnemies = createLevelEnemies(road, 3, ['TheWeyfindersRoad_3']);
  const racer = levelThreeEnemies.find((enemy) => enemy.archetypeId === 'weyfinder_road_flechette_racer.prototype0');
  assert.equal(racer.assetId, 'example.construct.weyfinder_road_flechette_racer_sculpted');
  assert.equal(racer.presentation.variant, 'sideStrafeFlechetteRacer');
  assert.equal(racer.carBehavior.trackingFlechettes, true);
  assert.equal(Math.hypot(racer.x - road.x, racer.y - road.y) > road.halfWidth, true);
  const ghost = createLevelEnemies(road, 1, ['GhostForrestPathway_1'])[0];
  assert.equal(ghost.archetypeId, 'ghost_phaser.ghost_forrest');
  assert.equal(ghost.presentation.variant, 'ghostWraith');
  assert.equal(ghost.presentation.sprite, undefined);
  const frog = createLevelEnemies(road, 1, ['DigitizedStream_1'])[0];
  assert.equal(frog.archetypeId, 'hopping_stream_mob.digitized_stream');
  assert.equal(frog.assetId, 'example.construct.tractor_frog_sculpted');
  assert.equal(frog.hopperVisualBias, 1.5);
  assert.equal(frog.presentation.variant, 'tractorFrog');
  assert.equal(frog.presentation.sprite, undefined);
  assert.equal(createLevelEnemies(road, 1, ['PiratesRoad_1'])[0].archetypeId, 'heavy_mortar_boat.pirates_road');
  assert.equal(createLevelEnemies(road, 2, ['PiratesRoad_1']).some((enemy) => enemy.archetypeId === 'mortar_skiff.prototype0'), true);
  const starlight = createLevelEnemies(road, 1, ['StarlightRoad_1'])[0];
  assert.equal(starlight.archetypeId, 'starlight_walker.prototype0');
  assert.equal(starlight.assetId, 'example.construct.spidery_walker_sculpted');
  assert.equal(starlight.elevation.layeredExposure, true);
  assert.equal(starlight.poseRig.groups.some((group) => group.role === 'legAssembly'), true);
  const twilight = createLevelEnemies(road, 1, ['TwilightCrossroads'])[0];
  assert.equal(twilight.archetypeId, 'twilight_walker.prototype0');
  assert.equal(twilight.assetId, 'example.construct.spider_walker_sculpted');
  assert.equal(createLevelEnemies(road, 1, ['ShadowedDesert_Journey'])[0].archetypeId, 'scrap_buzzard.shadowed_desert');
  assert.equal(createLevelEnemies(road, 1, ['FreedomsPass_Journey'])[0].archetypeId, 'inchworm_carrier.freedoms_pass');
});

test('zone archetype spawns include sculpted leaders and basic brood turrets', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 1, ['DigitizedStream_1']);
  assert.equal(enemies[0].assetId, 'example.construct.tractor_frog_sculpted');
  assert.equal(enemies[0].presentation.sprite, undefined);
  assert.equal(enemies.slice(1).length >= 1, true);
  assert.equal(enemies.slice(1).length <= 3, true);
  assert.equal(enemies.slice(1).every((enemy) => enemy.archetypeId === 'hopping_stream_mob.digitized_stream.brood_turret'), true);
  assert.equal(enemies.slice(1).every((enemy) => enemy.assetId === 'basic_turret'), true);
});

test('walker brood escorts use the smaller multileg walker instead of raised turrets', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 1, ['TwilightCrossroads']);
  const escorts = enemies.slice(1);
  assert.equal(enemies[0].assetId, 'example.construct.spider_walker_sculpted');
  assert.equal(escorts.length >= 1, true);
  assert.equal(escorts.length <= 3, true);
  assert.equal(escorts.every((enemy) => enemy.archetypeId === 'twilight_walker.prototype0.brood_walker'), true);
  assert.equal(escorts.every((enemy) => enemy.assetId === 'example.construct.spidery_walker_sculpted'), true);
  assert.equal(escorts.every((enemy) => enemy.poseRig.groups.some((group) => group.role === 'legAssembly')), true);
});

test('freedoms pass inchworm spawns as linked head and body segment enemies', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemies = createLevelEnemies(road, 1, ['FreedomsPass_Journey']);
  const head = enemies.find((enemy) => enemy.archetypeId === 'inchworm_carrier.freedoms_pass');
  const segments = enemies.filter((enemy) => enemy.archetypeId === 'inchworm_segment.freedoms_pass');
  assert.equal(head.assetId, 'example.construct.inchworm_head_sculpted');
  assert.equal(head.inchworm.role, 'head');
  assert.equal(segments.length >= 4, true);
  assert.equal(segments.every((segment) => segment.assetId === 'example.construct.inchworm_body_segment_sculpted'), true);
  assert.equal(segments.every((segment) => segment.inchworm.suppressDeathBlast), true);
  assert.equal(head.inchworm.segmentIds.length, segments.length);
});

test('enemy round upgrades scale two deterministic enemy traits per level', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemy = createLevelEnemies(road, 6, ['PiratesRoad_1'])[0];
  const upgradedTraits = Object.values(enemy.levelUpgrades).reduce((sum, value) => sum + value, 0);
  assert.equal(upgradedTraits, 10);
  assert.equal(Object.values(enemy.combatScale).some((scale) => scale > 1), true);
});

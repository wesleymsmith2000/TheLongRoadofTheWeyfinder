import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createLevelEnemies, isBossLevel, stepGame } from '../src/core/game.js';
import { DEFAULT_LEVEL_MUSIC, hasBossMusicBeforeLevel, isBossMusic, musicForLevel } from '../src/core/levelMusic.js';

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

test('boss soundtrack levels add a boss and cut standard enemy count', () => {
  const enemies = createLevelEnemies({ x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 }, 4, ['road', 'road', 'road', 'BossFight']);
  assert.equal(enemies.some((enemy) => enemy.kind === 'boss'), true);
  assert.equal(enemies.filter((enemy) => enemy.kind !== 'boss').length, 2);
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
  const ghost = createLevelEnemies(road, 1, ['GhostForrestPathway_1'])[0];
  assert.equal(ghost.archetypeId, 'ghost_phaser.ghost_forrest');
  assert.equal(ghost.presentation.sprite.assetId, 'sprite.enemy.ghost_phaser');
  const frog = createLevelEnemies(road, 1, ['DigitizedStream_1'])[0];
  assert.equal(frog.archetypeId, 'hopping_stream_mob.digitized_stream');
  assert.equal(frog.moduleLinearScale, 2);
  assert.equal(frog.hopperVisualBias, 1.5);
  assert.equal(frog.presentation.variant, 'tractorFrog');
  assert.equal(frog.presentation.sprite, undefined);
  assert.equal(createLevelEnemies(road, 1, ['PiratesRoad_1'])[0].archetypeId, 'heavy_mortar_boat.pirates_road');
  assert.equal(createLevelEnemies(road, 2, ['PiratesRoad_1'])[1].archetypeId, 'mortar_skiff.prototype0');
  assert.equal(createLevelEnemies(road, 1, ['StarlightRoad_1'])[0].archetypeId, 'starlight_walker.prototype0');
  assert.equal(createLevelEnemies(road, 1, ['TwilightCrossroads'])[0].archetypeId, 'twilight_walker.prototype0');
  assert.equal(createLevelEnemies(road, 1, ['ShadowedDesert_Journey'])[0].archetypeId, 'scrap_buzzard.shadowed_desert');
  assert.equal(createLevelEnemies(road, 1, ['FreedomsPass_Journey'])[0].archetypeId, 'inchworm_carrier.freedoms_pass');
});

test('enemy round upgrades scale two deterministic enemy traits per level', () => {
  const road = { x: 0, y: 0, heading: -Math.PI / 2, halfWidth: 300, halfHeight: 300 };
  const enemy = createLevelEnemies(road, 6, ['PiratesRoad_1'])[0];
  const upgradedTraits = Object.values(enemy.levelUpgrades).reduce((sum, value) => sum + value, 0);
  assert.equal(upgradedTraits, 10);
  assert.equal(Object.values(enemy.combatScale).some((scale) => scale > 1), true);
});

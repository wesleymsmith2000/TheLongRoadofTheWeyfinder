import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame } from '../src/core/game.js';
import {
  consumeProceduralMusicCue,
  createProceduralMusicState,
  desiredMusicState,
  layerTargetsForState,
  musicSituationSnapshot,
  stepProceduralMusic,
} from '../src/core/proceduralMusic.js';

test('procedural music maps combat situations to semantic states', () => {
  assert.equal(desiredMusicState({}), 'TRAVEL');
  assert.equal(desiredMusicState({ incomingWarnings: 1 }), 'ATTENTION');
  assert.equal(desiredMusicState({ warningCount: 1 }), 'SUSPICION');
  assert.equal(desiredMusicState({ bossCount: 1 }), 'MANIFESTATION');
  assert.equal(desiredMusicState({ victoryBanner: true, bossCount: 1 }), 'AFTERIMAGE');
});

test('procedural music emits cues only when the semantic signature changes', () => {
  const game = createGame(1147, { levelMusic: ['road-one'] });
  game.music = createProceduralMusicState({ baseTrack: 'road-one' });

  stepProceduralMusic(game, 0.2);
  const first = consumeProceduralMusicCue(game.music);
  assert.equal(first.semanticState, 'ATTENTION');

  stepProceduralMusic(game, 0.2);
  assert.equal(consumeProceduralMusicCue(game.music), null);

  game.enemySpawnQueue = [];
  game.enemies = [];
  game.incomingMarkers = [];
  stepProceduralMusic(game, 0.2);
  const quiet = consumeProceduralMusicCue(game.music);
  assert.equal(quiet.semanticState, 'TRAVEL');
});

test('procedural music layer volumes fade toward state targets deterministically', () => {
  const music = createProceduralMusicState({ baseTrack: 'road-one' });
  music.layerTargets = layerTargetsForState('SUSPICION');
  const game = {
    currentMusic: 'road-one',
    music,
    enemies: [{ destroyed: false, walkerSweepWarning: { target: { x: 0, y: 0 } } }],
    enemyProjectiles: [],
    incomingMarkers: [],
    vehicle: { cells: [{ attached: true, state: { destroyed: false } }] },
  };

  stepProceduralMusic(game, 0.1);
  assert.equal(music.layerVolumes.suspicion > 0, true);
  assert.equal(music.layerVolumes.suspicion < music.layerTargets.suspicion, true);

  stepProceduralMusic(game, 3);
  assert.equal(music.layerVolumes.suspicion, music.layerTargets.suspicion);
});

test('procedural music damage snapshot includes destroyed attached cells', () => {
  const snapshot = musicSituationSnapshot({
    enemies: [],
    enemyProjectiles: [],
    incomingMarkers: [],
    vehicle: {
      cells: [
        { attached: true, state: { destroyed: false } },
        { attached: true, state: { destroyed: true } },
      ],
    },
  });

  assert.equal(snapshot.playerDamageRatio, 0.5);
  assert.equal(desiredMusicState(snapshot), 'ATTENTION');
});

test('game procedural music announces warnings and victory afterimage', () => {
  const game = createGame(1147, { levelMusic: ['road-one'] });
  game.incomingMarkers.push({ lifetime: 1 });
  for (let index = 0; index < 7; index += 1) stepGame(game, {}, 1 / 30);
  assert.equal(game.music.semanticState, 'ATTENTION');

  game.enemies[0].walkerSweepWarning = { target: { x: 0, y: 0 }, timer: 1 };
  for (let index = 0; index < 7; index += 1) stepGame(game, {}, 1 / 30);
  assert.equal(game.music.semanticState, 'SUSPICION');

  game.levelComplete = true;
  for (let index = 0; index < 7; index += 1) stepGame(game, {}, 1 / 30);
  assert.equal(game.music.semanticState, 'AFTERIMAGE');
});

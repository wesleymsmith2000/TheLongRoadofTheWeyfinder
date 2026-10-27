import { createDiverEnemy, diverLevelContext, diverWavesCleared, DIVER_MIN_WAVES } from './diverEnemy.js';
import { createIncomingMarker, SPAWN_WARNING_LEAD } from './incomingWarning.js';
import { arcadePlayBounds } from './arcadeMode.js';
import { roadOffsetToWorld, worldToRoadOffset } from './camera.js';
import { configureDiverFlavor, diverApproachPoint } from './diverFlavor.js';

const BOSS_KINDS = new Set(['boss', 'roadBossCar', 'pirateBoss', 'zeppelinBoss']);

export function resetArcadeBossStage(game, bossLevel) {
  game.arcadeBossStage = null;
  if (game.runMode !== 'arcade' || game.sandbox?.enabled || !bossLevel) return;
  const pending = game.enemySpawnQueue.filter(entry => BOSS_KINDS.has(entry.enemy.kind));
  game.enemySpawnQueue = game.enemySpawnQueue.filter(entry => !BOSS_KINDS.has(entry.enemy.kind));
  for (const enemy of game.enemies.filter(enemy => BOSS_KINDS.has(enemy.kind))) pending.push({ enemy, type: enemy.kind });
  game.enemies = game.enemies.filter(enemy => !BOSS_KINDS.has(enemy.kind));
  game.arcadeBossStage = { pending, released: pending.length === 0, vanguardSpawned: false, vanguard: null };
  if (game.diverWaves) game.diverWaves.stopAfterRequired = true;
}

export function arcadeBossPending(game) {
  return Boolean(game.arcadeBossStage?.pending.length);
}

export function stepArcadeBossStage(game, dt, onSpawn = () => {}) {
  if (!arcadeBossPending(game) || !diverWavesCleared(game)) return;
  // Ordinary escorts finish before the finale as well.
  if (game.enemySpawnQueue.length || game.enemies.some(enemy => !enemy.destroyed && !enemy.arcadeGapDiver && enemy.countsForCompletion !== false)) return;
  const stage = game.arcadeBossStage;
  if (!stage.vanguardSpawned) {
    if (!stage.vanguard) {
      const count = 1 + Math.floor(game.rng.next() * 3);
      stage.vanguard = { nextIn: 2, entries: Array.from({ length: count }, (_, i) => ({ x: count === 1 ? 0 : (i / (count - 1) * 2 - 1) * game.road.halfWidth * 0.65, phaseOffset: game.rng.range(0, 1) })) };
      for (const entry of stage.vanguard.entries) {
        const point = diverApproachPoint(game, diverLevelContext(game.level, game.levelMusic).zone, entry.x);
        game.incomingMarkers.push(createIncomingMarker(point, 'diver', 2));
      }
      return;
    }
    stage.vanguard.nextIn = Math.max(0, stage.vanguard.nextIn - dt);
    if (stage.vanguard.nextIn > 0) return;
    const context = diverLevelContext(game.level, game.levelMusic);
    for (const [i, entry] of stage.vanguard.entries.entries()) {
      const point = roadOffsetToWorld({ x: entry.x, y: -arcadePlayBounds(game.road).ahead * 0.94 }, game.road);
      const enemy = createDiverEnemy(point.x, point.y, context.theme, { roadHeading: game.road.heading, phaseOffset: entry.phaseOffset });
      configureDiverFlavor(game, enemy, context.zone);
      if (context.zone === 'ShadowedRoad') enemy.palette = { ...enemy.palette, armor: '#444f5c', core: '#9aafbb', gun: '#ff884e' };
      enemy.bossVanguardDiver = true;
      enemy.targetId = `boss-vanguard:${game.level}:${i}`;
      onSpawn(enemy);
      game.enemies.push(enemy);
    }
    stage.vanguardSpawned = true;
    stage.vanguard = null;
    return;
  }
  const elapsed = game.time - game.levelStartTime;
  for (const entry of game.arcadeBossStage.pending) {
    const offset = worldToRoadOffset(entry.enemy, game.road);
    const point = roadOffsetToWorld({ x: Math.max(-game.road.halfWidth * 0.7, Math.min(game.road.halfWidth * 0.7, offset.x)), y: -arcadePlayBounds(game.road).ahead - 90 }, game.road);
    Object.assign(entry.enemy, point);
    game.enemySpawnQueue.push({ ...entry, at: elapsed + SPAWN_WARNING_LEAD, triggerDistance: null, markerShown: false });
  }
  game.arcadeBossStage.pending = [];
  game.arcadeBossStage.released = true;
  game.arcadeEmptyScreenSeconds = 0;
}

export function diverScheduleFinished(game) {
  return Boolean(game.diverWaves?.stopAfterRequired && game.diverWaves.wavesSpawned >= DIVER_MIN_WAVES);
}

import { clamp } from './math.js';
import { roadOffsetToWorld, worldToRoadOffset } from './camera.js';
import { arcadePlayBounds } from './arcadeMode.js';
import { createDiverEnemy, diverLevelContext, diverWavesCleared, DIVER_MIN_WAVES } from './diverEnemy.js';
import { Rng } from './rng.js';

export function arcadeObjectVisible(game, object) {
  const width = game.road.viewWidth ?? game.road.halfWidth * 2;
  const height = game.road.viewHeight ?? game.road.halfHeight * 2;
  const center = game.camera ?? game.road;
  const radius = object.radius ?? 0;
  return !object.destroyed && !object.phasedOut && Math.abs(object.x - center.x) <= width * 0.5 + radius &&
    object.y - center.y >= -height * 0.58 - radius && object.y - center.y <= height * 0.42 + radius;
}

export function retireArcadeGapDivers(game) {
  for (const enemy of game.enemies) {
    if (!enemy.arcadeGapDiver || enemy.destroyed || enemy.diver.gapExit) continue;
    enemy.diver.gapExit = true;
    enemy.diver.phase = 'gapExit';
    enemy.diver.speed = Math.max(0, Math.hypot(enemy.vx, enemy.vy));
    const position = worldToRoadOffset(enemy, game.road);
    const exit = roadOffsetToWorld({ x: Math.sign(position.x || 1) * (game.road.viewWidth ?? game.road.halfWidth * 2), y: -arcadePlayBounds(game.road).ahead - enemy.radius * 2 }, game.road);
    enemy.diver.gapExitAngle = Math.atan2(exit.y - enemy.y, exit.x - enemy.x);
  }
}

export function stepArcadeGapDivers(game, dt, onSpawn = () => {}) {
  if (game.runMode !== 'arcade' || game.sandbox?.enabled || game.levelComplete || game.gameOver) return;
  const scheduledEnemies = game.enemies.filter(enemy => !enemy.arcadeGapDiver && !enemy.destroyed);
  const combatFinished = !game.enemySpawnQueue.length && !scheduledEnemies.some(enemy => enemy.countsForCompletion !== false) && diverWavesCleared(game);
  if (game.victoryBanner || combatFinished) {
    retireArcadeGapDivers(game);
    game.arcadeGapQuietSeconds = 0;
    return;
  }
  const occupied = scheduledEnemies.some(enemy => arcadeObjectVisible(game, enemy)) || game.scrapPickups.some(scrap => arcadeObjectVisible(game, scrap));
  if (occupied || game.enemies.some(enemy => enemy.arcadeGapDiver && !enemy.destroyed)) {
    game.arcadeGapQuietSeconds = 0;
    return;
  }
  game.arcadeGapQuietSeconds = (game.arcadeGapQuietSeconds ?? 0) + dt;
  if (game.arcadeGapQuietSeconds < 2) return;
  game.arcadeGapSpawnCount = (game.arcadeGapSpawnCount ?? 0) + 1;
  const rng = new Rng((game.seed ?? 1147) ^ (game.level * 65537) ^ (game.arcadeGapSpawnCount * 104729));
  const point = roadOffsetToWorld({ x: clamp(worldToRoadOffset(game.vehicle, game.road).x + rng.range(-0.3, 0.3) * game.road.halfWidth, -game.road.halfWidth * 0.7, game.road.halfWidth * 0.7), y: -arcadePlayBounds(game.road).ahead * 0.72 }, game.road);
  const enemy = createDiverEnemy(point.x, point.y, diverLevelContext(game.level, game.levelMusic).theme, { roadHeading: game.road.heading });
  enemy.arcadeGapDiver = true;
  enemy.countsForCompletion = false;
  enemy.diver.random = rng;
  enemy.diver.phase = 'track';
  enemy.targetId = `gap-diver:${game.level}:${game.arcadeGapSpawnCount}`;
  onSpawn(enemy);
  game.enemies.push(enemy);
  game.arcadeGapQuietSeconds = 0;
}

export function arcadeLevelProgress(game, stageProgress) {
  const state = game.diverWaves;
  if (!state) return { fraction: stageProgress, wavesCleared: 0, wavesRequired: 0 };
  const alive = game.enemies.filter(enemy => enemy.diver && !enemy.arcadeGapDiver && !enemy.destroyed).length;
  const wavesCleared = Math.min(DIVER_MIN_WAVES, (state.wavesCleared ?? 0) + (state.waitingForClear && alive === 0 ? 1 : 0));
  const partial = state.waitingForClear && alive > 0 ? clamp(1 - alive / Math.max(1, state.currentWaveSize ?? alive), 0, 1) : 0;
  const diverProgress = clamp((wavesCleared + partial) / DIVER_MIN_WAVES, 0, 1);
  return { fraction: game.levelComplete ? 1 : Math.min(0.985, clamp(stageProgress, 0, 1) * 0.5 + diverProgress * 0.5), wavesCleared, wavesRequired: DIVER_MIN_WAVES };
}

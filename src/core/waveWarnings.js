import { arcadeObjectVisible } from './arcadePacing.js';
import { DIVER_MIN_WAVES } from './diverEnemy.js';
import { diverScheduleFinished } from './arcadeBossStage.js';

export function waveWarnings(game) {
  if (game.gameOver || game.levelComplete || game.victoryBanner) return [];
  const elapsed = game.time - game.levelStartTime;
  const queue = game.enemySpawnQueue ?? [];
  const quiet = game.runMode === 'arcade' && !game.sandbox?.enabled &&
    !(game.enemies ?? []).some(enemy => !enemy.arcadeGapDiver && arcadeObjectVisible(game, enemy));
  const rushEta = quiet ? Math.max(0, 15 - (game.arcadeEmptyScreenSeconds ?? 0)) : Infinity;
  const standardEta = Math.min(...queue.map(entry => {
    if (entry.triggerDistance == null) return Math.max(0, entry.at - elapsed);
    const distance = Math.max(0, entry.triggerDistance - (game.road.routeDistance ?? 0));
    return distance === 0 ? 0 : game.road.speed > 0 ? distance / game.road.speed : Infinity;
  }), queue.length ? rushEta : Infinity);
  const result = [];
  if (Number.isFinite(standardEta)) result.push({ kind: 'standard', text: 'HOSTILE VESSELS INBOUND', eta: standardEta });
  const state = game.diverWaves;
  if (game.arcadeBossStage?.vanguard) result.push({ kind: 'diver', text: 'INTERCEPTORS INBOUND', eta: game.arcadeBossStage.vanguard.nextIn });
  const liveDivers = (game.enemies ?? []).some(enemy => enemy.diver && !enemy.arcadeGapDiver && !enemy.destroyed);
  if (state && !diverScheduleFinished(game) && !liveDivers && !state.waitingForClear) {
    const eta = Math.min(state.nextIn, !queue.length && state.wavesSpawned < DIVER_MIN_WAVES ? rushEta : Infinity);
    if (Number.isFinite(eta)) result.push({ kind: 'diver', text: 'INTERCEPTORS INBOUND', eta: Math.max(0, eta) });
  }
  return result;
}

export function formatWaveEta(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

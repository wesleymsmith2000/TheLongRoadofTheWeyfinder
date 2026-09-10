export const MUSIC_SCHEMA_VERSION = 1;

export const MUSIC_STATES = Object.freeze([
  'TRAVEL',
  'ATTENTION',
  'SUSPICION',
  'MANIFESTATION',
  'AFTERIMAGE',
]);

export const MUSIC_LAYERS = Object.freeze({
  travel: 'travel',
  attention: 'attention',
  suspicion: 'suspicion',
  manifestation: 'manifestation',
  afterimage: 'afterimage',
});

const UPDATE_INTERVAL_SECONDS = 0.2;
const FADE_RATE_PER_SECOND = 1.35;

export function createProceduralMusicState(options = {}) {
  const baseTrack = options.baseTrack ?? null;
  const layerTargets = normalizeLayerMap(options.layerTargets, { travel: 1 });
  return {
    schemaVersion: MUSIC_SCHEMA_VERSION,
    baseTrack,
    semanticState: options.semanticState ?? 'TRAVEL',
    pendingCue: null,
    revision: 0,
    updateTimer: 0,
    layerTargets,
    layerVolumes: normalizeLayerMap(options.layerVolumes, layerTargets),
    lastSignature: null,
  };
}

export function setProceduralMusicBaseTrack(music, baseTrack) {
  const state = ensureProceduralMusicState(music);
  if (state.baseTrack === baseTrack) return state;
  state.baseTrack = baseTrack ?? null;
  state.revision += 1;
  state.pendingCue = {
    kind: 'baseTrack',
    semanticState: state.semanticState,
    baseTrack: state.baseTrack,
    revision: state.revision,
  };
  return state;
}

export function stepProceduralMusic(game, dt) {
  const state = ensureProceduralMusicState(game.music, { baseTrack: game.currentMusic });
  game.music = state;
  if (state.baseTrack !== game.currentMusic) setProceduralMusicBaseTrack(state, game.currentMusic);
  state.updateTimer = Math.max(0, (state.updateTimer ?? 0) - dt);
  if (state.updateTimer <= 0) {
    state.updateTimer = UPDATE_INTERVAL_SECONDS;
    const snapshot = musicSituationSnapshot(game);
    const desired = desiredMusicState(snapshot);
    const signature = musicSignature(snapshot, desired);
    if (signature !== state.lastSignature) {
      state.lastSignature = signature;
      state.semanticState = desired;
      state.layerTargets = layerTargetsForState(desired, snapshot);
      state.revision += 1;
      state.pendingCue = {
        kind: 'semanticState',
        semanticState: desired,
        baseTrack: state.baseTrack,
        snapshot,
        layerTargets: { ...state.layerTargets },
        revision: state.revision,
      };
    }
  }
  fadeLayerVolumes(state, dt);
  return state;
}

export function consumeProceduralMusicCue(music) {
  if (!music?.pendingCue) return null;
  const cue = music.pendingCue;
  music.pendingCue = null;
  return cue;
}

export function musicSituationSnapshot(game) {
  const enemies = game.enemies ?? [];
  const activeEnemies = enemies.filter((enemy) => !enemy.destroyed);
  const bossCount = activeEnemies.filter((enemy) => enemy.kind === 'boss' || enemy.kind === 'zeppelinBoss' || enemy.kind === 'pirateBoss' || enemy.kind === 'roadBossCar').length;
  const warningCount = activeCombatWarnings(activeEnemies);
  return {
    incomingWarnings: game.incomingMarkers?.length ?? 0,
    activeEnemies: activeEnemies.length,
    bossCount,
    warningCount,
    enemyProjectiles: game.enemyProjectiles?.length ?? 0,
    playerDamageRatio: playerDamageRatio(game),
    levelComplete: Boolean(game.levelComplete),
    gameOver: Boolean(game.gameOver),
    victoryBanner: Boolean(game.victoryBanner),
  };
}

export function desiredMusicState(snapshot) {
  if (snapshot.levelComplete || snapshot.victoryBanner) return 'AFTERIMAGE';
  if (snapshot.gameOver) return 'SUSPICION';
  if (snapshot.bossCount > 0) return 'MANIFESTATION';
  if (snapshot.warningCount > 0 || snapshot.enemyProjectiles >= 36) return 'SUSPICION';
  if (snapshot.incomingWarnings > 0 || snapshot.activeEnemies > 0 || snapshot.playerDamageRatio >= 0.45) return 'ATTENTION';
  return 'TRAVEL';
}

export function layerTargetsForState(state, snapshot = {}) {
  if (state === 'AFTERIMAGE') return normalizeLayerMap({}, { travel: 0.25, afterimage: 1 });
  if (state === 'MANIFESTATION') {
    const pressure = clamp((snapshot.enemyProjectiles ?? 0) / 80, 0, 1);
    return normalizeLayerMap({}, { travel: 0.35, attention: 0.4, suspicion: 0.35 + pressure * 0.25, manifestation: 1 });
  }
  if (state === 'SUSPICION') return normalizeLayerMap({}, { travel: 0.45, attention: 0.45, suspicion: 1 });
  if (state === 'ATTENTION') return normalizeLayerMap({}, { travel: 0.72, attention: 0.82, suspicion: 0.12 });
  return normalizeLayerMap({}, { travel: 1 });
}

function ensureProceduralMusicState(music, options = {}) {
  if (music?.schemaVersion === MUSIC_SCHEMA_VERSION) return music;
  return createProceduralMusicState({ ...options, ...(music ?? {}) });
}

function normalizeLayerMap(source = {}, defaults = {}) {
  const result = {};
  for (const layer of Object.values(MUSIC_LAYERS)) result[layer] = clamp(source[layer] ?? defaults[layer] ?? 0, 0, 1);
  return result;
}

function fadeLayerVolumes(state, dt) {
  state.layerVolumes ??= normalizeLayerMap();
  state.layerTargets ??= normalizeLayerMap();
  const maxStep = FADE_RATE_PER_SECOND * dt;
  for (const layer of Object.values(MUSIC_LAYERS)) {
    const current = state.layerVolumes[layer] ?? 0;
    const target = state.layerTargets[layer] ?? 0;
    const delta = clamp(target - current, -maxStep, maxStep);
    state.layerVolumes[layer] = clamp(current + delta, 0, 1);
  }
}

function activeCombatWarnings(enemies) {
  let count = 0;
  for (const enemy of enemies) {
    if (enemy.walkerSweepWarning) count += 1;
    if (enemy.zeppelin?.laserWarning) count += 1;
    if ((enemy.zeppelin?.harpoonCharge?.timer ?? 0) > 0) count += 1;
    for (const arm of enemy.arms ?? []) {
      if (arm.laser?.target) count += 1;
    }
  }
  return count;
}

function playerDamageRatio(game) {
  const cells = game.vehicle?.cells ?? [];
  let live = 0;
  let total = 0;
  for (const cell of cells) {
    if (!cell.attached) continue;
    total += 1;
    if (!cell.state?.destroyed) live += 1;
  }
  if (total <= 0) return 1;
  return 1 - live / total;
}

function musicSignature(snapshot, state) {
  return [
    state,
    snapshot.incomingWarnings > 0 ? 1 : 0,
    snapshot.activeEnemies > 0 ? 1 : 0,
    snapshot.bossCount > 0 ? 1 : 0,
    snapshot.warningCount > 0 ? 1 : 0,
    Math.min(3, Math.floor((snapshot.enemyProjectiles ?? 0) / 24)),
    Math.min(3, Math.floor((snapshot.playerDamageRatio ?? 0) * 4)),
  ].join(':');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

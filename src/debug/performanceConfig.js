export const PERFORMANCE_DIAGNOSTIC_DEFAULTS = Object.freeze({
  noDomSync: false,
  noSfx: false,
  noEnemyBulletSfx: false,
  perfMonitorOff: false,
  perfMonitorCountersOnly: false,
  dprMode: 'native',
  simpleBossRender: false,
  noProjectileRender: false,
  freezeTerrainStreaming: false,
  disableCollisions: false,
  disableArmDetonationFx: false,
  disableArmShrapnel: false,
});

export function createPerformanceDiagnostics(overrides = {}, environment = globalThis) {
  const state = {
    ...PERFORMANCE_DIAGNOSTIC_DEFAULTS,
    dprMode: defaultDprMode(environment),
    ...overrides,
  };
  return {
    state,
    set(patch = {}) {
      for (const [key, value] of Object.entries(patch)) {
        if (key in state) state[key] = normalizeValue(key, value);
      }
      return this.snapshot();
    },
    reset() {
      Object.assign(state, PERFORMANCE_DIAGNOSTIC_DEFAULTS, { dprMode: defaultDprMode(environment) });
      return this.snapshot();
    },
    snapshot() {
      return { ...state };
    },
    effectiveDpr(nativeDpr = 1) {
      return effectiveDpr(nativeDpr, state.dprMode);
    },
    monitorMode() {
      if (state.perfMonitorOff) return 'off';
      return state.perfMonitorCountersOnly ? 'counters' : 'full';
    },
  };
}

export function installPerformanceDiagnosticsGlobal(diagnostics, target = globalThis) {
  if (!target) return diagnostics;
  target.WeyfinderPerf = Object.freeze({
    state: diagnostics.state,
    set(patch) {
      return diagnostics.set(patch);
    },
    reset() {
      return diagnostics.reset();
    },
    snapshot() {
      return diagnostics.snapshot();
    },
  });
  return diagnostics;
}

export function effectiveDpr(nativeDpr = 1, dprMode = 'native') {
  const dpr = Math.max(1, Number(nativeDpr) || 1);
  if (dprMode === '1') return 1;
  if (dprMode === '1.5') return Math.min(dpr, 1.5);
  return dpr;
}

function defaultDprMode(environment) {
  const coarse = environment?.matchMedia?.('(max-width: 700px), (pointer: coarse)')?.matches ?? false;
  return coarse ? '1.5' : 'native';
}

function normalizeValue(key, value) {
  if (key === 'dprMode') return ['native', '1.5', '1'].includes(value) ? value : PERFORMANCE_DIAGNOSTIC_DEFAULTS.dprMode;
  return Boolean(value);
}

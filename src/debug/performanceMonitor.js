const DEFAULT_WINDOW = 180;
const THRESHOLDS = [33, 50, 100];
const SLICE_NAMES = ['input', 'simulation', 'ui', 'render', 'audio'];
const COUNTER_NAMES = [
  'playerProjectiles',
  'enemyProjectiles',
  'smokeParticles',
  'scrapPickups',
  'enemies',
  'enemyCells',
  'liveEnemyCells',
  'vehicleCells',
  'terrainChunks',
  'terrainCacheBuilds',
  'terrainPendingChunks',
  'audioPlayCalls',
  'enemyBulletSoundEvents',
];

export function createPerformanceMonitor(options = {}) {
  const windowSize = Math.max(30, Math.floor(options.windowSize ?? DEFAULT_WINDOW));
  const now = options.now ?? (() => performance.now());
  const getMode = options.getMode ?? (() => options.mode ?? 'full');
  const getOverlayVisible = options.getOverlayVisible ?? (() => false);
  const summaryIntervalMs = Math.max(0, options.summaryIntervalMs ?? 1000);
  const rafGap = new Float32Array(windowSize);
  const jsWork = new Float32Array(windowSize);
  const slices = Object.fromEntries(SLICE_NAMES.map((name) => [name, new Float32Array(windowSize)]));
  const counters = Object.fromEntries(COUNTER_NAMES.map((name) => [name, new Float32Array(windowSize)]));
  let cursor = 0;
  let sampleCount = 0;
  let previousRafTimestamp = null;
  let active = null;
  let cachedSummary = emptySummary(windowSize);
  let lastSummaryAt = -Infinity;

  return {
    beginFrame(timestamp = now()) {
      const mode = getMode();
      if (mode === 'off') {
        active = null;
        return;
      }
      active = {
        mode,
        start: timestamp,
        cursor: timestamp,
        rafGapMs: previousRafTimestamp == null ? 0 : Math.max(0, timestamp - previousRafTimestamp),
        sliceValues: Object.create(null),
      };
      previousRafTimestamp = timestamp;
    },
    mark(name, timestamp = now()) {
      if (!active || active.mode === 'counters') return;
      if (!slices[name]) return;
      active.sliceValues[name] = (active.sliceValues[name] ?? 0) + Math.max(0, timestamp - active.cursor);
      active.cursor = timestamp;
    },
    endFrame(frameCounters = {}, timestamp = now()) {
      if (!active) return cachedSummary;
      const mode = active.mode;
      const frameJsWork = Math.max(0, timestamp - active.start);
      rafGap[cursor] = active.rafGapMs;
      jsWork[cursor] = frameJsWork;
      for (const name of SLICE_NAMES) slices[name][cursor] = mode === 'full' ? active.sliceValues[name] ?? 0 : 0;
      for (const name of COUNTER_NAMES) counters[name][cursor] = finite(frameCounters[name]);
      cursor = (cursor + 1) % windowSize;
      sampleCount = Math.min(windowSize, sampleCount + 1);
      active = null;
      const longFrame = frameJsWork > 50 || rafGapAt(1) > 60;
      if (summaryIntervalMs === 0 || getOverlayVisible() || longFrame || timestamp - lastSummaryAt >= summaryIntervalMs) {
        cachedSummary = buildSummary({ windowSize, sampleCount, cursor, rafGap, jsWork, slices, counters });
        lastSummaryAt = timestamp;
      }
      return cachedSummary;
    },
    summary() {
      cachedSummary = buildSummary({ windowSize, sampleCount, cursor, rafGap, jsWork, slices, counters });
      lastSummaryAt = now();
      return cachedSummary;
    },
    reset() {
      rafGap.fill(0);
      jsWork.fill(0);
      for (const values of Object.values(slices)) values.fill(0);
      for (const values of Object.values(counters)) values.fill(0);
      cursor = 0;
      sampleCount = 0;
      previousRafTimestamp = null;
      active = null;
      cachedSummary = emptySummary(windowSize);
      lastSummaryAt = -Infinity;
    },
  };

  function rafGapAt(samplesBack) {
    if (sampleCount === 0) return 0;
    const index = (cursor - samplesBack + windowSize) % windowSize;
    return rafGap[index] ?? 0;
  }
}

export function summarizePerformanceSamples(samples = []) {
  const frameTimes = samples.map((sample) => sample.frameMs);
  const sliceNames = new Set(samples.flatMap((sample) => Object.keys(sample.slices ?? {})));
  const counterNames = new Set(samples.flatMap((sample) => Object.keys(sample.counters ?? {})));
  const slices = {};
  const counters = {};
  for (const name of sliceNames) slices[name] = summarizeNumbers(samples.map((sample) => sample.slices?.[name] ?? 0));
  for (const name of counterNames) counters[name] = lastFinite(samples.map((sample) => sample.counters?.[name]));
  return {
    sampleCount: samples.length,
    windowSize: Math.max(samples.length, 1),
    frame: summarizeNumbers(frameTimes),
    rafGap: summarizeNumbers(frameTimes),
    jsWork: summarizeNumbers(frameTimes),
    slowFrames: Object.fromEntries(THRESHOLDS.map((threshold) => [`over${threshold}ms`, frameTimes.filter((value) => value > threshold).length])),
    slices,
    counters,
  };
}

function buildSummary({ windowSize, sampleCount, cursor, rafGap, jsWork, slices, counters }) {
  if (sampleCount <= 0) return emptySummary(windowSize);
  const frameValues = ringValues(jsWork, sampleCount, cursor, windowSize);
  const rafValues = ringValues(rafGap, sampleCount, cursor, windowSize);
  const sliceSummary = {};
  const counterSummary = {};
  for (const name of SLICE_NAMES) sliceSummary[name] = summarizeNumbers(ringValues(slices[name], sampleCount, cursor, windowSize));
  for (const name of COUNTER_NAMES) counterSummary[name] = lastFinite(ringValues(counters[name], sampleCount, cursor, windowSize));
  return {
    sampleCount,
    windowSize,
    frame: summarizeNumbers(frameValues),
    rafGap: summarizeNumbers(rafValues),
    jsWork: summarizeNumbers(frameValues),
    slowFrames: Object.fromEntries(THRESHOLDS.map((threshold) => [`over${threshold}ms`, countOver(frameValues, threshold)])),
    slices: sliceSummary,
    counters: counterSummary,
  };
}

function emptySummary(windowSize) {
  return {
    sampleCount: 0,
    windowSize,
    frame: { avg: 0, p95: 0, max: 0 },
    rafGap: { avg: 0, p95: 0, max: 0 },
    jsWork: { avg: 0, p95: 0, max: 0 },
    slowFrames: Object.fromEntries(THRESHOLDS.map((threshold) => [`over${threshold}ms`, 0])),
    slices: {},
    counters: {},
  };
}

function ringValues(values, sampleCount, cursor, windowSize) {
  const result = new Array(sampleCount);
  const start = sampleCount < windowSize ? 0 : cursor;
  for (let index = 0; index < sampleCount; index += 1) {
    result[index] = values[(start + index) % windowSize];
  }
  return result;
}

function countOver(values, threshold) {
  let count = 0;
  for (const value of values) {
    if (value > threshold) count += 1;
  }
  return count;
}

function summarizeNumbers(values) {
  const finiteValues = [];
  for (const value of values) {
    if (Number.isFinite(value)) finiteValues.push(value);
  }
  if (finiteValues.length === 0) return { avg: 0, p95: 0, max: 0 };
  finiteValues.sort((a, b) => a - b);
  let sum = 0;
  for (const value of finiteValues) sum += value;
  const p95 = finiteValues[Math.min(finiteValues.length - 1, Math.floor(finiteValues.length * 0.95))];
  return { avg: sum / finiteValues.length, p95, max: finiteValues[finiteValues.length - 1] };
}

function lastFinite(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index];
  }
  return 0;
}

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}
